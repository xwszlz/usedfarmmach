/**
 * 线索手动录入 —— 批量写入服务（P0）
 *
 * 将前端经列映射后的结构化行写入 `RawListing`，逐行写 PII 审计。
 * 设计要点：
 *  - source 采用 R9 命名：`manual_dealer`（境内）/ `manual_dealer_intl`（境外），
 *    **去掉 "82" 死数字面量**；过渡期兼容读取旧值 `manual_cn_lead`（归一为 `manual_dealer`）。
 *  - contentHash 采用 **R2 锁定公式**（纳入 sellerPhone/sellerName，与采集公式不同），
 *    保证每家独立成行、同机型不同卖家不互吞。
 *  - 幂等三层：批内按 contentHash 去重 → 逐行 create → 唯一冲突 catch 跳过。
 *  - 每行新建成功 → writePiiAuditLog({ actorId, targetListingId: row.id, field:"contact", action:"import" })。
 *  - **归属写库**：每行按 `resolveStoreScope(row)` 落 `RawListing.goodsRegion`；
 *    `unknown`（判不出货物所在地）**不入库**，转待核队列。
 *  - **前置自检**：写入前查一次 `information_schema.columns` 确认 `goodsRegion` 列存在；
 *    不存在则抛错，**一条都不写**（老板可在界面上跑一次导入即验证 `prisma db push` 是否已生效）。
 *
 * ⚠️ 本文件零 schema 变更，只写 RawListing / PiiAuditLog 两表。
 */
import { createHash } from "crypto";
import { prisma } from "@/lib/db";
import { writePiiAuditLog } from "@/lib/audit";
import {
  MANUAL_SOURCE_WHITELIST,
  resolveLeadSource,
  resolveStoreScope,
  SOURCE_MANUAL_DEALER,
  SOURCE_MANUAL_DEALER_INTL,
  SOURCE_MANUAL_LEGACY_CN,
  type StoreScope,
} from "./store-scope";

/** 单条录入行（已在前端完成列映射，键为 RawListing 规范字段） */
export interface ImportLeadRow {
  brandName: string;
  modelName: string;
  year?: number | null;
  workingHours?: number | null;
  condition?: string | null;
  priceRaw?: number | null;
  currency?: string | null;
  priceCny?: number | null;
  location?: string | null;
  sellerName?: string | null;
  sellerPhone?: string | null;
  sellerWechat?: string | null;
  sellerWhatsapp?: string | null;
  sellerEmail?: string | null;
  sourceUrl?: string | null;
  notes?: string | null;
  /** 采集来源标识；必须在白名单内（缺省由归属自动推导） */
  source?: string | null;
  /** 人工权威归属：cn | intl | unknown；给出时碾压自动推断 */
  goodsRegion?: string | null;
  /** 货源地国别 code（ISO 3166-1 alpha-2），可选，辅助归属推断 */
  locationCode?: string | null;
}

/** 单行被拦截的明细（供前端逐行展示 / 导出待核清单） */
export interface ImportRowIssue {
  /** 行号（从 1 开始，即提交数组下标 + 1） */
  lineNo: number;
  /** 行的可视标识（品牌·机型·地区），便于人工定位 */
  identity: string;
  /** 归属（cn / intl / unknown） */
  scope: StoreScope;
  /** 拦截原因原文 */
  reason: string;
}

/** 批量导入结果汇总 */
export interface ImportLeadResult {
  /** 成功新建行数 */
  imported: number;
  /** 因唯一冲突（已存在同 contentHash）跳过的行数（含批内重复与跨批重导） */
  skipped: number;
  /** 行级校验失败（缺必填字段 / 字段类型错误 / source 非法）行数 */
  errors: number;
  /** 前若干条校验/写入错误样本，供前端展示 */
  sampleErrors: string[];
  /** 归属判不出（unknown）→ **未入库**、转待核队列的行数 */
  pending: number;
  /** 待核明细样本（最多 50 条） */
  pendingDetail: ImportRowIssue[];
  /** 本次实际写入的归属分布（便于核对） */
  importedByScope: Record<StoreScope, number>;
}

/** 默认写入源标识（兼容期保留常量；新写入一律用 R9 命名） */
export const MANUAL_LEAD_SOURCE = SOURCE_MANUAL_LEGACY_CN;
/** R9：境内人工行 source */
export const MANUAL_DEALER_SOURCE = SOURCE_MANUAL_DEALER;
/** R9：境外人工行 source */
export const MANUAL_DEALER_INTL_SOURCE = SOURCE_MANUAL_DEALER_INTL;
/** 默认写入状态（进线索池 listLeads，不进审核流 listRawListings 默认 needs_review） */
export const MANUAL_LEAD_STATUS = "imported";

/** goodsRegion 列缺失时的统一报错信息（前端据此提示 prisma db push） */
export const GOODS_REGION_MISSING_MESSAGE =
  "RawListing.goodsRegion 列未落库，请先执行 prisma db push（再重试本导入）";

/**
 * R2 锁定 contentHash：纳入 sellerPhone / sellerName（与采集公式不同）。
 * 注：本仓库 schema 无 priceEur 字段（仅有 priceCny / priceRaw），
 * 故价格部分以 `priceCny ?? priceRaw ?? ""` 等价替换，避免引用不存在的字段。
 */
export function generateContentHash(row: ImportLeadRow): string {
  const brandName = (row.brandName ?? "").toString();
  const modelName = (row.modelName ?? "").toString();
  const year = row.year == null ? "" : String(row.year);
  const location = (row.location ?? "").toString();
  const pricePart = row.priceCny != null
    ? String(row.priceCny)
    : row.priceRaw != null
      ? String(row.priceRaw)
      : "";
  const sellerPhone = (row.sellerPhone ?? "").toString();
  const sellerName = (row.sellerName ?? "").toString();
  const raw = `${brandName}|${modelName}|${year}|${location}|${pricePart}|${sellerPhone}|${sellerName}`;
  return createHash("md5").update(raw, "utf8").digest("hex");
}

/** 行的可视标识：品牌·机型·地区（前端/接口据此定位被拦截的行） */
export function rowIdentity(row: ImportLeadRow): string {
  const brand = (row.brandName ?? "").toString().trim() || "（无品牌）";
  const model = (row.modelName ?? "").toString().trim() || "（无机型）";
  const loc = (row.location ?? "").toString().trim() || "（无地区）";
  return `${brand} · ${model} · ${loc}`;
}

/** 行级校验：返回错误信息数组（空数组表示通过） */
function validateRow(row: ImportLeadRow, lineNo: number): string[] {
  const errs: string[] = [];
  const brandName = (row.brandName ?? "").toString().trim();
  const modelName = (row.modelName ?? "").toString().trim();
  if (!brandName) errs.push(`第 ${lineNo} 行：缺少必填字段 brandName（品牌）`);
  if (!modelName) errs.push(`第 ${lineNo} 行：缺少必填字段 modelName（机型/型号）`);
  // 数值字段类型校验（null/undefined 放行，交由 DB 默认值/可空约束处理）
  const numFields: Array<keyof ImportLeadRow> = ["year", "workingHours", "priceRaw", "priceCny"];
  for (const f of numFields) {
    const v = row[f];
    if (v != null && typeof v !== "number" && Number.isNaN(Number(v))) {
      errs.push(`第 ${lineNo} 行：字段 ${String(f)} 不是合法数字（值为 ${String(v)}）`);
    }
  }
  // ── source 白名单校验（R9：拒绝任何含 "82" 的旧命名）──
  const source = (row.source ?? "").toString().trim();
  if (source) {
    if (source.includes("82")) {
      errs.push(
        `第 ${lineNo} 行：source「${source}」为含 "82" 的旧命名，已废弃；` +
          `请使用 ${SOURCE_MANUAL_DEALER}（境内）或 ${SOURCE_MANUAL_DEALER_INTL}（境外）`,
      );
    } else if (!MANUAL_SOURCE_WHITELIST.includes(source)) {
      errs.push(
        `第 ${lineNo} 行：source「${source}」不在白名单内（可选：${MANUAL_SOURCE_WHITELIST.join(" / ")}）`,
      );
    }
  }
  return errs;
}

/**
 * **前置自检**：确认 `RawListing.goodsRegion` 列已落库。
 *
 * 目的：老板在界面上跑一次导入即可验证 `prisma db push` 是否生效，无需 SSH 登录服务器。
 * 每次调用最多执行一条 `information_schema.columns` 轻量查询（仅在写行前调用一次）。
 *
 * @throws 列不存在 / 查询失败时抛出明确错误，调用方应中止整批写入（一条都不写）。
 */
export async function assertGoodsRegionColumnExists(): Promise<void> {
  let rows: Array<{ columnName: string }> = [];
  try {
    rows = await prisma.$queryRaw<Array<{ columnName: string }>>`
      SELECT column_name AS "columnName"
      FROM information_schema.columns
      WHERE table_schema = current_schema()
        AND table_name = 'RawListing'
        AND lower(column_name) = 'goodsregion'
      LIMIT 1
    `;
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    throw new Error(`${GOODS_REGION_MISSING_MESSAGE}（列探测失败：${msg}）`);
  }
  if (!rows || rows.length === 0) {
    throw new Error(GOODS_REGION_MISSING_MESSAGE);
  }
}

/**
 * 批量导入线索。
 *
 * 归属口径：每行按 `resolveStoreScope(row)` 定归属 → 写入 `RawListing.goodsRegion`；
 * **归属为 unknown（判不出货物所在地）的行一律不入库**，计入 `pending`（待核队列）。
 *
 * @param rows 已列映射后的行数组（前端提交）
 * @param actorId 操作人用户 id（用于 PII 审计）
 * @returns 汇总结果
 * @throws `assertGoodsRegionColumnExists` 未通过 → 抛出，调用方应返回明确错误给用户
 */
export async function importLeadsRows(
  rows: ImportLeadRow[],
  actorId: string,
): Promise<ImportLeadResult> {
  const result: ImportLeadResult = {
    imported: 0,
    skipped: 0,
    errors: 0,
    sampleErrors: [],
    pending: 0,
    pendingDetail: [],
    importedByScope: { cn: 0, intl: 0, unknown: 0 },
  };

  // 入参兜底
  if (!Array.isArray(rows)) {
    return result;
  }

  // ── 前置自检：goodsRegion 列未落库 → 直接抛错，一条都不写 ──
  await assertGoodsRegionColumnExists();

  // 批内按 contentHash 去重（Map 保留首次出现；批内重复视为 skipped，避免唯一冲突）
  const seen = new Map<string, true>();
  const deduplicated: ImportLeadRow[] = [];
  rows.forEach((raw, i) => {
    const lineNo = i + 1;
    const row = { ...raw };
    const errs = validateRow(row, lineNo);
    if (errs.length > 0) {
      result.errors += 1;
      if (result.sampleErrors.length < 20) result.sampleErrors.push(...errs);
      return;
    }
    // 归属判定：unknown（判不出货物所在地）→ 不入库，转待核队列
    const scope = resolveStoreScope(row);
    if (scope === "unknown") {
      result.pending += 1;
      if (result.pendingDetail.length < 50) {
        result.pendingDetail.push({
          lineNo,
          identity: rowIdentity(row),
          scope,
          reason: "判不出货物（机器）实际所在地，需人工回填 goodsRegion 后再导",
        });
      }
      return;
    }
    const hash = generateContentHash(row);
    if (seen.has(hash)) {
      result.skipped += 1;
      return;
    }
    seen.set(hash, true);
    deduplicated.push(row);
  });

  for (const row of deduplicated) {
    const brandName = (row.brandName ?? "").toString().trim();
    const modelName = (row.modelName ?? "").toString().trim();
    const hash = generateContentHash(row);
    const scope = resolveStoreScope(row);
    const source = resolveLeadSource(row, scope);
    try {
      const created = await prisma.rawListing.create({
        data: {
          source,
          sourceUrl: (row.sourceUrl ?? "").toString(),
          status: MANUAL_LEAD_STATUS,
          brandName,
          modelName,
          year: row.year != null ? Number(row.year) : null,
          workingHours: row.workingHours != null ? Number(row.workingHours) : null,
          condition: row.condition ? row.condition.toString() : null,
          priceRaw: row.priceRaw != null ? Number(row.priceRaw) : null,
          currency: row.currency ? row.currency.toString() : null,
          priceCny: row.priceCny != null ? Number(row.priceCny) : null,
          location: (row.location ?? "").toString(),
          sellerName: row.sellerName ? row.sellerName.toString() : null,
          sellerPhone: row.sellerPhone ? row.sellerPhone.toString() : null,
          sellerWechat: row.sellerWechat ? row.sellerWechat.toString() : null,
          sellerWhatsapp: row.sellerWhatsapp ? row.sellerWhatsapp.toString() : null,
          sellerEmail: row.sellerEmail ? row.sellerEmail.toString() : null,
          contentHash: hash,
          scrapedAt: new Date(),
          goodsRegion: scope,
          // notes 拼装：CSV「备注」列是 Round-1 唯一的结构化载体（`[性质]`/`[机型组]`/`[补全]`/
          // `[电话占位]`/`[品牌兜底]`/`[自家·禁外呼]` 等），**必须落库** —— 否则外呼员会拨到
          // 「平台联系」「拍卖页联系」这类占位假号，或把电话打到自家主体。
          // 分隔符固定为 `"\n"`：确定性，且每个标记各占一行，便于 grep/回溯。
          // ⚠️ row.notes 为 undefined / null / "" / 纯空白时，输出与改动前**逐字相同**
          //    （仍只有 `[import] ... ` 一句），这是防回归的关键。
          // ⚠️ notes **不参与** contentHash（hash 只取 brand|model|year|location|price|phone|name），
          //    故本处改动不影响导入幂等，也不会让已入库行产生重复。
          notes: [`[import] ${source} by ${actorId}`, (row.notes ?? "").toString().trim()]
            .filter((part) => part !== "")
            .join("\n"),
        },
      });
      result.imported += 1;
      result.importedByScope[scope] += 1;
      // 逐行 PII 审计（与 reveal-all 同口径：field:"contact"）
      await writePiiAuditLog({
        actorId,
        targetListingId: created.id,
        field: "contact",
        action: "import",
      });
    } catch (e: unknown) {
      const err = e as { code?: string; message?: string };
      const msg = err?.message ?? String(e);
      // 唯一冲突（跨批重导同 contentHash）：跳过该条，计入 skipped
      if (err?.code === "P2002" || /unique|contentHash/i.test(msg)) {
        result.skipped += 1;
      } else {
        // 其他异常：计入 errors，但不中断整批
        result.errors += 1;
        if (result.sampleErrors.length < 20) {
          result.sampleErrors.push(`写入失败（第 ${result.imported + result.errors} 条）：${msg}`);
        }
      }
    }
  }

  return result;
}
