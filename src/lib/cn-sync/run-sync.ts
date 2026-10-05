/**
 * .cn → .com 产品同步「增量同步核心」（运行于 .com / Vercel）
 *
 * 流程：拉取 .cn 导出接口（keyset 分页）→ 内容哈希判变更 → 幂等 upsert 到 Neon →
 *       写 ProductSyncMap 账本 → 写 CnSyncRunLog → 失败告警。
 *
 * 关键约束（详见实施清单 §3.3）：
 * - 幂等：neonProductId = item.id（cuid 直通）；sourceHash 相同且 isActive → 仅刷 lastSeenAt（skipped）；
 * - 冲突守卫（认领优先）：无 map 记录但 .com 已有同 id 产品时——
 *     · 若该产品同属「系统卖家」（.cn 库系从 .com 复制、cuid 直通的历史产品）→ **认领（adopted）**：
 *       仅补写 ProductSyncMap 账本，**不写 Product、不改任何字段**；
 *       并做**血缘校验**：若同 id 但模型/年份不符 → 仍认领但告警（捕获「cuid 被复用」的静默冻结）；
 *     · 否则（id 被非同步产品占用）→ 跳过 + 告警（绝不覆盖，算 conflict）；
 * - 字段映射：只写白名单字段；显式断言不含 latitude/longitude/sellerId/contact*；
 *   createdAt 仅 create 传，updatedAt 交给 Prisma @updatedAt（不手写）；
 * - 卖家归属：resolveSystemSeller 挂 email=miniprogram@shendiao.com（.com 可见性规则的判定键）；
 * - 品牌/分类：先查后建，匹配到就复用（绝不覆盖 .com 既有丰富字段）；
 *   若既有品牌 isImported !== true（出境 item 恒为国际品牌）→ 记 brandMismatch 告警（产品仍挂该品牌）；
 * - 不同步 Valuation（用户已拍板）。
 */
import crypto from "crypto";
import bcrypt from "bcryptjs";
import { Prisma } from "@prisma/client";
import type { PrismaClient } from "@prisma/client";
import { pickProductWhitelist } from "@/lib/cn-sync/field-whitelist";
import {
  iterateIncremental,
  type CnExportItem,
  type FetchPageFn,
} from "@/lib/cn-sync/cn-export-client";
import { resolveCnSyncClient, writeCnSyncRunLog, type CnSyncStatus } from "@/lib/cn-sync/runtime";
import { pushToGroup, type GroupPushPayload } from "@/lib/wecom/group-webhook";

/** 系统卖家邮箱：.com /api/products 可见性规则以该 email 为判定键 */
export const MINIAPP_SELLER_EMAIL = "miniprogram@shendiao.com";

/** 增量分页尺寸（<= 导出接口上限 500） */
export const INCREMENTAL_PAGE_LIMIT = 200;

export interface SyncStats {
  ok: boolean;
  processed: number;
  created: number;
  updated: number;
  skipped: number;
  /** 认领的历史产品：.com 已有同 id 且同属系统卖家 → 仅补账本，不写 Product */
  adopted: number;
  conflict: number;
  errors: number;
  /** 命中「既有品牌 isImported 不一致」的产品数（产品仍同步，但可能不可见） */
  brandMismatch: number;
  /** 认领时命中「同 id 但机型/年份不符」的产品数（血缘可疑，仅上报） */
  lineageMismatch: number;
  /** 时间预算耗尽：本轮未跑完（安全停在产品边界，下一轮继续）。纯增量字段 */
  partial?: boolean;
  error?: string;
}

// ────────────────────────── 纯函数（可单测） ──────────────────────────

/** 递归按键名排序，保证对象序列化稳定（字段顺序无关） */
function sortDeep(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortDeep);
  if (value && typeof value === "object") {
    const src = value as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const k of Object.keys(src).sort()) out[k] = sortDeep(src[k]);
    return out;
  }
  return value;
}

/** 稳定序列化：字段顺序不同 → 产出同一字符串 */
export function normalize(value: unknown): string {
  return JSON.stringify(sortDeep(value));
}

/** sha256 十六进制 */
export function sha256(input: string): string {
  return crypto.createHash("sha256").update(input).digest("hex");
}

/** 内容哈希：对白名单裁剪后的 payload 做稳定序列化再 sha256 */
export function contentHash(item: CnExportItem): string {
  return sha256(normalize(pickProductWhitelist(item as Record<string, unknown>)));
}

function strOrNull(v: unknown): string | null {
  return v === null || v === undefined || v === "" ? null : String(v);
}

function numOrNull(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function intOrNull(v: unknown): number | null {
  const n = numOrNull(v);
  return n === null ? null : Math.trunc(n);
}

function intOr(v: unknown, fallback: number): number {
  const n = intOrNull(v);
  return n === null ? fallback : n;
}

function parseDate(v: unknown): Date | null {
  if (typeof v !== "string" || !v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** 出境 payload → Prisma 标量（**不含** id/sellerId/status/createdAt/updatedAt/坐标/PII） */
export interface ProductScalars {
  modelName: string;
  year: number;
  condition: string;
  priceCny: number;
  priceUsd: number | null;
  location: string;
  province: string | null;
  city: string | null;
  country: string | null;
  descriptionZh: string | null;
  priceMode: string;
  tradeTerm: string;
  tradePort: string | null;
  enginePower: number | null;
  engineType: string | null;
  driveSystem: string | null;
  mainConfig: string | null;
  netWeight: number | null;
  overallLength: number | null;
  overallWidth: number | null;
  overallHeight: number | null;
  aiGenerated: boolean;
}

/**
 * 字段映射（白名单明确枚举，默认不含任何禁字段）。
 * 注意：这里绝不从 item 直接展开，避免 PII / 坐标被顺手带入。
 */
export function mapProductScalars(item: CnExportItem): ProductScalars {
  return {
    modelName: String(item.modelName ?? ""),
    year: intOr(item.year, 0),
    condition: String(item.condition ?? ""),
    priceCny: numOrNull(item.priceCny) ?? 0,
    priceUsd: numOrNull(item.priceUsd),
    location: String(item.location ?? ""),
    province: strOrNull(item.province),
    city: strOrNull(item.city),
    country: strOrNull(item.country),
    descriptionZh: strOrNull(item.descriptionZh),
    priceMode: String(item.priceMode ?? "por"),
    tradeTerm: String(item.tradeTerm ?? "FOB"),
    tradePort: strOrNull(item.tradePort),
    enginePower: intOrNull(item.enginePower),
    engineType: strOrNull(item.engineType),
    driveSystem: strOrNull(item.driveSystem),
    mainConfig: strOrNull(item.mainConfig),
    netWeight: numOrNull(item.netWeight),
    overallLength: numOrNull(item.overallLength),
    overallWidth: numOrNull(item.overallWidth),
    overallHeight: numOrNull(item.overallHeight),
    aiGenerated: Boolean(item.aiGenerated),
  };
}

function mapImages(productId: string, images: unknown): Prisma.ProductImageCreateManyInput[] {
  if (!Array.isArray(images)) return [];
  const out: Prisma.ProductImageCreateManyInput[] = [];
  for (const raw of images) {
    if (!raw || typeof raw !== "object") continue;
    const o = raw as Record<string, unknown>;
    const url = typeof o.url === "string" ? o.url : "";
    if (!url) continue;
    out.push({
      productId,
      url,
      sortOrder: intOr(o.sortOrder, 0),
      isPrimary: Boolean(o.isPrimary),
    });
  }
  return out;
}

function mapVideos(productId: string, videos: unknown): Prisma.ProductVideoCreateManyInput[] {
  if (!Array.isArray(videos)) return [];
  const out: Prisma.ProductVideoCreateManyInput[] = [];
  for (const raw of videos) {
    if (!raw || typeof raw !== "object") continue;
    const o = raw as Record<string, unknown>;
    const url = typeof o.url === "string" ? o.url : "";
    if (!url) continue;
    out.push({
      productId,
      url,
      sortOrder: intOr(o.sortOrder, 0),
      title: strOrNull(o.title),
      duration: intOrNull(o.duration),
      moderationStatus: strOrNull(o.moderationStatus) ?? "pending",
    });
  }
  return out;
}

// ────────────────────────── DB 解析（先查后建，绝不覆盖） ──────────────────────────

/** 复用/创建系统卖家 miniprogram@shendiao.com（零自然人 PII） */
export async function resolveSystemSeller(client: PrismaClient): Promise<string> {
  const existing = await client.user.findUnique({ where: { email: MINIAPP_SELLER_EMAIL } });
  if (existing) return existing.id;

  const random = crypto.randomBytes(32).toString("hex");
  const passwordHash = await bcrypt.hash(random, 10);
  try {
    const created = await client.user.create({
      data: {
        email: MINIAPP_SELLER_EMAIL,
        username: "miniprogram",
        passwordHash,
        role: "seller",
        companyName: "小程序发布",
        country: "CN",
        preferredLanguage: "zh",
        credits: 999999, // 系统账号，避免发布积分不足
        isActive: true,
      },
    });
    return created.id;
  } catch (e) {
    // 并发创建竞争：唯一约束失败 → 重新查询
    const again = await client.user.findUnique({ where: { email: MINIAPP_SELLER_EMAIL } });
    if (again) return again.id;
    throw e;
  }
}

/** 解析品牌的结果：id + 是否命中「既有品牌 isImported 不一致」 */
export interface ResolveBrandResult {
  id: string;
  /** 匹配到既有 brand 但其 isImported !== true（出境 item 恒为国际品牌，故不一致即 mismatch） */
  importedMismatch: boolean;
}

/**
 * 解析品牌：先 nameZh 精确、再 nameEn 大小写不敏感；匹配到复用（绝不覆盖），否则创建。
 *
 * ⚠️ 匹配到既有品牌时**不校验也不覆盖 isImported**（additive-only；同名可能系误匹配，强改会误伤）。
 * 但若既有品牌 isImported!==true，产品挂上去会命中 .com 可见性规则失败（静默不可见），
 * 故通过 importedMismatch 上报，由上层告警。产品仍挂到既有 brandId（数据在，改对 flag 即可见）。
 */
export async function resolveBrand(
  client: PrismaClient,
  brand: unknown
): Promise<ResolveBrandResult> {
  const b = (brand ?? {}) as Record<string, unknown>;
  const nameZh = strOrNull(b.nameZh);
  const nameEn = strOrNull(b.nameEn);
  if (!nameZh) throw new Error("cn-sync: brand.nameZh missing");

  let found = await client.brand.findFirst({ where: { nameZh } });
  if (!found && nameEn) {
    found = await client.brand.findFirst({
      where: { nameEn: { equals: nameEn, mode: "insensitive" } },
    });
  }
  if (found) {
    // 复用，绝不覆盖既有字段（含 isImported）；仅上报不一致
    return { id: found.id, importedMismatch: found.isImported !== true };
  }

  const created = await client.brand.create({
    data: {
      nameZh,
      nameEn: nameEn ?? nameZh,
      originCountry: strOrNull(b.originCountry) ?? "",
      isImported: b.isImported === undefined ? true : Boolean(b.isImported),
    },
  });
  return { id: created.id, importedMismatch: false };
}

/** 解析分类：先 nameZh 精确、再 nameEn 大小写不敏感；匹配到复用，否则创建 */
export async function resolveCategory(
  client: PrismaClient,
  category: unknown
): Promise<string> {
  const c = (category ?? {}) as Record<string, unknown>;
  const nameZh = strOrNull(c.nameZh);
  const nameEn = strOrNull(c.nameEn);
  if (!nameZh) throw new Error("cn-sync: category.nameZh missing");

  let found = await client.category.findFirst({ where: { nameZh } });
  if (!found && nameEn) {
    found = await client.category.findFirst({
      where: { nameEn: { equals: nameEn, mode: "insensitive" } },
    });
  }
  if (found) return found.id;

  const created = await client.category.create({
    data: { nameZh, nameEn: nameEn ?? nameZh },
  });
  return created.id;
}

// ────────────────────────── 幂等 upsert ──────────────────────────

export type UpsertResult = "created" | "updated" | "skipped" | "adopted" | "conflict";

/** upsert 结果 + 品牌一致性上报（产品已同步，但既有品牌 isImported 不一致 → 可能不可见） */
export interface UpsertOutcome {
  result: UpsertResult;
  /** 命中「既有但 isImported!==true」的品牌时非空；产品仍挂该 brandId（绝不覆盖品牌） */
  brandMismatchBrand: { brandId: string; nameZh: string } | null;
  /**
   * 血缘可疑告警：认领时发现「同 id 但 .com/.cn 机型或年份不符」时非空（仅上报，认领照做）。
   * 用于捕获「同一 cuid 被复用为另一台机器」这类静默冻结失败。
   */
  lineageWarning: string | null;
  /**
   * 本轮「应就 id 冲突告警」的条目（抑制账本裁决：首次 / hash 变化 / 距上次告警超阈值）。
   * 由 runCnProductSync 汇总后**每轮只推一条**；被抑制的冲突返回 null。
   */
  conflictAlert: { cnProductId: string; neonProductId: string } | null;
}

/**
 * 冲突抑制账本（ProductSyncConflict）：对「id 被 .com 非同步产品占用」的冲突做
 * 「快跳 + 告警限流」，避免每轮重判 + 每台重复告警。
 *
 * 决策：
 * - 命中且 sourceHash 相同 且 距上次告警未超阈值 → 仅刷 lastSeenAt，**不告警**（返回 false）；
 * - 未命中 / hash 已变 / 距上次告警已超阈值 → 记/刷账本（含 lastAlertAt）→ **需告警**（返回 true）；
 *
 * 容错：账本读写失败（典型：新表尚未建，Prisma P2021）→ console.warn 并**退化为旧的
 *       逐台告警**，绝不因此中断同步（便于灰度/回滚）。
 *
 * ⚠️ 本表刻意独立于 ProductSyncMap：后者 isActive=true 的行会被 reconcile 物理删除，
 *    把冲突写进去会误伤 .com 自有的那批产品（破坏对账护栏③）。
 */
async function handleConflict(
  client: PrismaClient,
  input: { cnProductId: string; neonProductId: string; sourceHash: string; sellerId: string }
): Promise<boolean> {
  const now = new Date();
  const hoursRaw = Number(process.env.CN_SYNC_CONFLICT_ALERT_HOURS ?? 24);
  const alertHours = Number.isFinite(hoursRaw) && hoursRaw >= 0 ? hoursRaw : 24;
  const alertWindowMs = alertHours * 3_600_000;

  try {
    const row = await client.productSyncConflict.findUnique({
      where: { cnProductId: input.cnProductId },
    });

    if (row && row.sourceHash === input.sourceHash) {
      const lastAlert = row.lastAlertAt ? row.lastAlertAt.getTime() : 0;
      if (now.getTime() - lastAlert < alertWindowMs) {
        // 快跳：同内容且近期已告警 → 仅刷新 lastSeenAt，不告警
        await client.productSyncConflict.update({
          where: { cnProductId: input.cnProductId },
          data: { lastSeenAt: now },
        });
        return false;
      }
      // 同内容但告警已过期 → 刷新并再次告警
      await client.productSyncConflict.update({
        where: { cnProductId: input.cnProductId },
        data: { lastSeenAt: now, lastAlertAt: now },
      });
      return true;
    }

    // 首次出现 / 内容已变 → 记账并告警
    await client.productSyncConflict.upsert({
      where: { cnProductId: input.cnProductId },
      create: {
        cnProductId: input.cnProductId,
        neonProductId: input.neonProductId,
        sourceHash: input.sourceHash,
        reason: "id-owned-by-other-seller",
        lastSeenAt: now,
        lastAlertAt: now,
      },
      update: { sourceHash: input.sourceHash, lastSeenAt: now, lastAlertAt: now },
    });
    return true;
  } catch (e) {
    // 灰度兜底：表不存在（P2021）等 → 退化为旧的逐台告警，绝不中断同步
    console.warn(
      `[cn-sync] ProductSyncConflict 读写失败，退化为逐台告警：${
        e instanceof Error ? e.message : String(e)
      }`
    );
    await pushToGroup({
      title: "⚠️ .cn→.com 同步 id 冲突",
      lines: [
        `id \`${input.cnProductId}\` 已被非同步产品占用（sellerId=${input.sellerId}），已跳过（绝不覆盖）`,
        `处置：核对该 id 是否为 .cn 同名产品；若是历史独立创建，需人工决定是否迁移。`,
      ],
      level: "warn",
    });
    return false;
  }
}

/**
 * 幂等 upsert 一条产品。
 * 返回 { result, brandMismatchBrand, lineageWarning, conflictAlert }：
 * - result：created | updated | skipped（哈希未变）| adopted（同 id 且同属系统卖家 → 仅补账本）
 *           | conflict（id 被非同步产品占用，绝不覆盖）；
 * - brandMismatchBrand：命中 isImported 不一致的既有品牌时非空（仅上报，不覆盖）；
 * - lineageWarning：认领时「同 id 但机型/年份不符」时非空（仅上报，不阻断认领）；
 * - conflictAlert：本轮应就 id 冲突告警的条目（抑制账本裁决），否则 null。
 */
export async function upsertProduct(
  client: PrismaClient,
  item: CnExportItem
): Promise<UpsertOutcome> {
  const neonId = item.id;
  if (typeof neonId !== "string" || !neonId) {
    throw new Error("cn-sync: item.id missing");
  }

  const map = await client.productSyncMap.findUnique({ where: { cnProductId: neonId } });

  // 冲突守卫（认领优先）：无账本记录、但 .com 已有同 id 产品
  let adoptExisting = false;
  let lineageWarning: string | null = null;
  if (!map) {
    const existing = await client.product.findUnique({
      where: { id: neonId },
      select: { id: true, sellerId: true, modelName: true, year: true },
    });
    if (existing) {
      const sysSellerId = await resolveSystemSeller(client);
      if (existing.sellerId === sysSellerId) {
        // .cn 库系从 .com 复制（cuid 直通）→ 属「同系统卖家的历史产品」→ 认领
        adoptExisting = true;
        // 同 id 但机型/年份不符 → 血缘可疑：仍认领（不阻断），但必须告警，不能静默
        const inModel = String(item.modelName ?? "");
        const inYear = Number(item.year ?? NaN);
        if (existing.modelName !== inModel || existing.year !== inYear) {
          lineageWarning =
            `id \`${neonId}\`：.com 侧为「${existing.modelName} / ${existing.year}」，` +
            `.cn 侧为「${inModel} / ${inYear}」`;
        }
      } else {
        // 真正的 id 冲突：被非同步产品占用 → 跳过（绝不覆盖）。
        // 用抑制账本做「快跳 + 告警限流」，由上层每轮汇总一条告警（不再逐台推）。
        const conflictHash = contentHash(item);
        const shouldAlert = await handleConflict(client, {
          cnProductId: neonId,
          neonProductId: neonId,
          sourceHash: conflictHash,
          sellerId: existing.sellerId,
        });
        return {
          result: "conflict",
          brandMismatchBrand: null,
          lineageWarning: null,
          conflictAlert: shouldAlert ? { cnProductId: neonId, neonProductId: neonId } : null,
        };
      }
    }
  }

  const hash = contentHash(item);

  // 认领：仅补账本（幂等 upsert，防并发），**不写 Product、不改任何字段、不解析品牌/分类**
  if (adoptExisting) {
    await client.productSyncMap.upsert({
      where: { cnProductId: neonId },
      create: {
        cnProductId: neonId,
        neonProductId: neonId,
        sourceHash: hash,
        sourceUpdatedAt: parseDate(item.updatedAt) ?? new Date(),
        isActive: true,
        lastSeenAt: new Date(),
      },
      update: {
        sourceHash: hash,
        sourceUpdatedAt: parseDate(item.updatedAt) ?? new Date(),
        isActive: true,
        deletedAt: null,
        lastSeenAt: new Date(),
      },
    });
    return { result: "adopted", brandMismatchBrand: null, lineageWarning, conflictAlert: null };
  }

  if (map && map.isActive && map.sourceHash === hash) {
    // 内容未变 → 仅刷新存活标记
    await client.productSyncMap.update({
      where: { cnProductId: neonId },
      data: { lastSeenAt: new Date() },
    });
    return { result: "skipped", brandMismatchBrand: null, lineageWarning: null, conflictAlert: null };
  }

  const sellerId = await resolveSystemSeller(client);
  const brandRes = await resolveBrand(client, item.brand);
  const brandId = brandRes.id;
  const brandMismatchBrand = brandRes.importedMismatch
    ? {
        brandId,
        nameZh: strOrNull((item.brand as Record<string, unknown> | undefined)?.nameZh) ?? "",
      }
    : null;
  const categoryId = await resolveCategory(client, item.category);

  const scalars = mapProductScalars(item);
  const status = String(item.status ?? "active");
  const createdAt = parseDate(item.createdAt);
  const sourceUpdatedAt = parseDate(item.updatedAt) ?? new Date();

  const createData: Prisma.ProductUncheckedCreateInput = {
    id: neonId,
    sellerId,
    brandId,
    categoryId,
    status,
    ...(createdAt ? { createdAt } : {}),
    ...scalars,
  };
  const updateData: Prisma.ProductUncheckedUpdateInput = {
    brandId,
    categoryId,
    status,
    ...scalars, // 注意：不含 updatedAt（交 Prisma @updatedAt）
  };

  await client.$transaction(async (tx) => {
    await tx.product.upsert({
      where: { id: neonId },
      create: createData,
      update: updateData,
    });

    // 关联表：先删后建（幂等重建）；两表 FK 均 onDelete: Cascade，安全
    await tx.productImage.deleteMany({ where: { productId: neonId } });
    const imgs = mapImages(neonId, item.images);
    if (imgs.length) await tx.productImage.createMany({ data: imgs });

    await tx.productVideo.deleteMany({ where: { productId: neonId } });
    const vids = mapVideos(neonId, item.videos);
    if (vids.length) await tx.productVideo.createMany({ data: vids });

    // 账本 upsert
    await tx.productSyncMap.upsert({
      where: { cnProductId: neonId },
      create: {
        cnProductId: neonId,
        neonProductId: neonId,
        sourceHash: hash,
        sourceUpdatedAt,
        isActive: true,
        lastSeenAt: new Date(),
      },
      update: {
        sourceHash: hash,
        sourceUpdatedAt,
        isActive: true,
        deletedAt: null,
        lastSeenAt: new Date(),
      },
    });
  });

  return { result: map ? "updated" : "created", brandMismatchBrand, lineageWarning: null, conflictAlert: null };
}

// ────────────────────────── 主入口 ──────────────────────────

export interface RunCnProductSyncOptions {
  mode?: "incremental";
  since?: string;
  /** 注入 Prisma 客户端（单测用）；缺省则延迟加载真实单例 */
  client?: PrismaClient;
  /** 注入分页抓取函数（单测用）；缺省走真实 HTTP */
  fetchPage?: FetchPageFn;
  /** 分页尺寸覆盖（单测用） */
  limit?: number;
  /** 注入告警推送函数（单测用）；缺省走真实企微 webhook */
  pushAlert?: (payload: GroupPushPayload) => Promise<void>;
}

/**
 * 执行一次增量同步。不抛出（失败写入 run log + 告警并返回 ok=false）。
 */
export async function runCnProductSync(
  opts: RunCnProductSyncOptions = {}
): Promise<SyncStats> {
  const t0 = Date.now();
  const stats: SyncStats = {
    ok: true,
    processed: 0,
    created: 0,
    updated: 0,
    skipped: 0,
    adopted: 0,
    conflict: 0,
    errors: 0,
    brandMismatch: 0,
    lineageMismatch: 0,
  };
  // 时间预算：默认 240s（Vercel Pro 单函数上限 300s，留 60s 给收尾写日志 + 推送）
  const budgetMs = Number(process.env.CN_SYNC_RUN_BUDGET_MS ?? 240_000);
  const effectiveBudgetMs = Number.isFinite(budgetMs) && budgetMs > 0 ? budgetMs : 240_000;
  const deadlineAt = t0 + effectiveBudgetMs;
  let status: CnSyncStatus = "success";
  let errorMessage: string | undefined;
  let client: PrismaClient | null = null;
  const mismatchBrands = new Map<string, string>(); // brandId -> nameZh（跨产品去重）
  const lineageWarnings = new Set<string>(); // 血缘可疑告警（跨产品去重）
  const pushAlert = opts.pushAlert ?? pushToGroup; // 告警推送（单测可注入）
  const conflictAlerts = new Set<string>(); // 本轮「需告警」的 id 冲突（抑制账本裁决，跨产品去重）

  try {
    client = await resolveCnSyncClient(opts.client);
    const result = await iterateIncremental(
      async (item) => {
        try {
          const outcome = await upsertProduct(client as PrismaClient, item);
          stats[outcome.result] += 1;
          if (outcome.brandMismatchBrand) {
            stats.brandMismatch += 1;
            if (!mismatchBrands.has(outcome.brandMismatchBrand.brandId)) {
              mismatchBrands.set(
                outcome.brandMismatchBrand.brandId,
                outcome.brandMismatchBrand.nameZh
              );
            }
          }
          if (outcome.lineageWarning) {
            stats.lineageMismatch += 1;
            lineageWarnings.add(outcome.lineageWarning);
          }
          if (outcome.conflictAlert) {
            conflictAlerts.add(outcome.conflictAlert.cnProductId);
          }
        } catch (e) {
          stats.errors += 1;
          console.error(
            `[cn-sync] upsert failed for ${item.id}:`,
            e instanceof Error ? e.message : String(e)
          );
        }
      },
      {
        since: opts.since,
        limit: opts.limit ?? INCREMENTAL_PAGE_LIMIT,
        fetchPage: opts.fetchPage,
        deadlineAt,
      }
    );
    stats.processed = result.processed;
    if (result.error === "time-budget-exceeded") {
      // 时间预算耗尽：本轮未跑完（安全停在产品边界）→ 记为 partial（非 error，避免拖垮对账护栏②）
      status = "partial";
      errorMessage = "time-budget-exceeded";
      stats.partial = true;
      stats.ok = false;
    } else if (result.error) {
      status = "error";
      errorMessage = result.error;
      stats.ok = false;
    }
  } catch (e) {
    status = "error";
    errorMessage = e instanceof Error ? e.message : String(e);
    stats.ok = false;
  }

  // MEDIUM-2：让失败原因随 stats 一起进 CnSyncRunLog / cron 响应（reconcile 同款写法）
  if (errorMessage) stats.error = errorMessage;

  if (client) {
    await writeCnSyncRunLog(client, "incremental", status, stats, Date.now() - t0, errorMessage);
  }

  // id 冲突（未覆盖）：由抑制账本裁决「本轮需告警」集合，每轮只推 1 条汇总（最多列 10 个 id）
  if (conflictAlerts.size > 0) {
    await pushAlert({
      title: `⚠️ .cn→.com 同步：${conflictAlerts.size} 台 id 冲突已跳过（未覆盖）`,
      lines: [
        ...Array.from(conflictAlerts).slice(0, 10).map((id) => `- \`${id}\``),
        `本轮共遇见 ${stats.conflict} 台冲突（含已抑制的重复项）；以上 ${conflictAlerts.size} 台为本轮需关注项。`,
        "这些 id 在 .com 侧已被「非同步来源」产品占用，同步器按设计不覆盖。",
        "处置：核对该 id 是否为 .cn 同名产品；若是历史独立创建，需人工决定是否迁移。",
      ],
      level: "warn",
    });
  }

  // 品牌 isImported 不一致：每轮最多 1 条告警（按 brandId 去重，循环结束后统一推）
  if (mismatchBrands.size > 0) {
    const lines = Array.from(mismatchBrands.entries()).map(
      ([brandId, nameZh]) => `- ${nameZh}（brandId=${brandId}, isImported=false）`
    );
    lines.push(
      "产品已同步并挂到该品牌，但因 .com 可见性规则要求 isImported=true，当前网站不可见。",
      "请人工确认该品牌是否为进口品牌并修正标记，或核对是否同名误匹配。"
    );
    await pushAlert({
      title: "⚠️ .cn→.com 同步：品牌 isImported 不一致，产品可能不可见",
      lines,
      level: "warn",
    });
  }

  // 血缘可疑（同 id 但机型/年份不符）：每轮最多 1 条告警（循环结束后统一推，去重后最多列 10 条）
  if (lineageWarnings.size > 0) {
    await pushAlert({
      title: "⚠️ .cn→.com 同步：同 id 但机型不一致（血缘可疑，已认领未覆盖）",
      lines: [
        ...Array.from(lineageWarnings).slice(0, 10),
        "这些 id 在 .com / .cn 指向的机型或年份不同。已按「认领」处理（只补账本、不覆盖字段），",
        "但请人工核对该 id 是否被复用。若确属同一台机器的数据修订，可忽略本告警。",
      ],
      level: "warn",
    });
  }

  // partial（时间预算耗尽）：本轮未跑完 → 独立告警（不复用「❌ 失败」分支）
  if (stats.partial) {
    await pushAlert({
      title: "⚠️ .cn→.com 同步未跑完（时间预算耗尽）",
      lines: [
        `本轮已处理 ${stats.processed} 台（created=${stats.created} updated=${stats.updated} skipped=${stats.skipped} adopted=${stats.adopted} conflict=${stats.conflict} errors=${stats.errors}）。`,
        `预算 ${effectiveBudgetMs}ms 内未跑完全量；已安全停在产品边界（无半写），下一轮从同一水位继续（幂等）。`,
      ],
      level: "warn",
    });
  }

  if (status === "error") {
    await pushAlert({
      title: "❌ .cn→.com 产品增量同步失败",
      lines: [
        `原因：${errorMessage ?? "unknown"}`,
        `processed=${stats.processed} created=${stats.created} updated=${stats.updated} skipped=${stats.skipped} adopted=${stats.adopted} conflict=${stats.conflict} errors=${stats.errors}`,
      ],
      level: "warn",
    });
  }

  return stats;
}
