/**
 * POST /api/agents/seller-helper/sales-strategy/export/pdf
 * AI 销售策略 · 导出《作战手册》PDF（T2 → T12 二段式解锁）
 *
 * 流程：登录校验 → 服务端重建 channels（解锁判定 + 重取联系方式）
 *       → 渲染 PDF → 返回 application/pdf（Content-Disposition: attachment; filename="ai-sales-strategy-<id>.pdf"）。
 *
 * 计费（2026-10-28 起）：**免费**。导出是纯渲染，零 LLM 调用、零模型成本；统一到成本加成口径后
 *   其成本本就为 0，故不再收取名义积分（此前按固定名义 token 计费属重复收费）。
 *   渲染失败直接 500 —— 本来就不扣费，因此「钱扣了却拿不到文件」的风险彻底消失。
 *
 * ── T12 二段式解锁（本次增量）────────────────────────────────────────────────
 * 现状缺陷：旧实现直接渲染 `body.channels` 的 `phoneMasked` ⇒ PDF 永远星号，
 *   用户付费解锁后仍拿不到可拨打的号码，「今天该打的电话」整章失效（付费价值归零）。
 * 修正（与 export/excel/route.ts 同口径）：
 *   1. `body.channels` **只信 3 个字段**：`candidateId` / `rationale` / **数组顺序**；
 *      公司名、电话、品牌、地区等一律服务端按 `candidateId` 从当前站点 prisma 重取
 *      （修掉「客户端传什么就渲染什么、服务端不校验」的隐患）。
 *   2. `candidateId` 支持 `lead_xxx` / `dealer_xxx` 两种前缀（与 `retrieval.fetchLeadDealerContact` 同规则解析）。
 *   3. 解锁判定：`PiiAuditLog.field = "unlock:dealer_<id>"`（同 Excel 路由）/ `"unlock:lead_<id>"`。
 *      已解锁 → 明文；未解锁 → `maskPhone` / `maskEmail` / 微信占位。
 *   4. ⚠️ 既有 `buildPdf` **只读 `*Masked` 三个槽位**（`export.ts` 本期零改动），
 *      故已解锁行必须把**明文写进 `*Masked` 槽位**，否则 PDF 上仍是星号；
 *      `phone` 字段同时填明文，供 T10 v2 渲染器区分语义。两处都填。
 *   5. 取不到的行（id 不存在 / 库异常）**直接丢弃**，绝不编造占位联系方式。
 *   6. DB 任何异常/超时 ⇒ `unlockedSet=∅`、`channels=[]`，仍返回 200 + 可打开的 PDF
 *      （查库失败不能让用户拿不到文件、更不能扣费后报错）。
 *
 * 合规：明文 PII 的放行条件有两条（取「或」）：
 *   ① 本用户曾为该 candidateId 解锁（PiiAuditLog 有 `unlock:` 记录）；
 *   ② 当前用户为 super_admin / admin（`canViewFullPii`，职务必需 ⇒ 全量明文 + 必须在
 *      `PiiAuditLog` 留一条 `action:"export"` 的汇总记录，field 前缀 `export:`）。
 *   非管理员行为与改造前逐字不变。本路由只读当前站点 prisma，不触达 .com / ARK。
 */
import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { canViewFullPii, maskEmail, maskPhone } from "@/lib/pii";
import {
  UNLOCK_FIELD_PREFIX,
  buildUnlockedContactSets,
  recordAdminFullPiiExport,
  type ExportAuditScope,
} from "@/lib/sales-strategy/pii-export";
import {
  buildPdf,
  type StrategyExportChannel,
  type StrategyExportPayload,
  type StrategyExportWebStatus,
} from "@/lib/sales-strategy/export";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// ── 常量 ────────────────────────────────────────────────────────────────────

/** 未解锁行的微信占位（微信无公网标准，占位不暴露任何信息） */
const WECHAT_PLACEHOLDER = "微信:********";

// `unlock:` 系列前缀（`unlock:` / `unlock:dealer_` / `unlock:lead_`）与「已解锁集合」构建，
// 已统一抽到 `@/lib/sales-strategy/pii-export`（`UNLOCK_FIELD_PREFIX` / `buildUnlockedContactSets`），
// 本文件与 `export/excel/route.ts` **import 同一份实现**。
// 原因：两端口径一旦各写一份就容易分叉 —— 会出现「Excel 给明文、PDF 仍打码」这种
// 同一用户、同一数据、两种结果的故障，且极难在联调中发现。禁止再在本文件里重定义前缀。

/** candidateId 前缀解析（与 `retrieval.fetchLeadDealerContact` 完全一致的正则） */
const CANDIDATE_ID_RE = /^(lead|dealer)_(.+)$/;

/** 单次导出最多渲染的渠道行数（防超大 body 打爆渲染） */
const MAX_CHANNELS = 60;

/** DB 兜底闸：超时/异常一律降级为空，避免导出被慢库拖死 */
const DB_TIMEOUT_MS = 3000;

/** 允许透传的检索状态枚举（非法值一律丢弃，防止污染渲染层） */
const WEB_STATUSES: ReadonlySet<string> = new Set<StrategyExportWebStatus>([
  "ok",
  "partial",
  "timeout",
  "disabled",
  "error",
]);

function getLocaleFromRequest(request: NextRequest): "zh" | "en" {
  const referer = request.headers.get("referer") || "";
  const m = referer.match(/\/([a-z]{2})\b/) || referer.match(/\/([a-z]{2})$/);
  if (m && ["zh", "en", "ru", "es", "pt", "fr", "hi", "ar"].includes(m[1])) return m[1] as "zh" | "en";
  return "zh";
}

// ── DB 兜底 ─────────────────────────────────────────────────────────────────

/**
 * 给 Prisma 查询加超时闸：超时 / 异常都返回 `null`（调用方按「空」处理）。
 *
 * 实现要点（与 `retrieval.withDbTimeout` 同款）：内部 `p.catch(() => null)` 先吞掉迟到异常，
 * 避免 `Promise.race` 之后的 unhandledRejection（Node 会把进程日志刷红，影响 serverless 实例）。
 */
async function withDbTimeout<T>(p: Promise<T>, ms: number = DB_TIMEOUT_MS): Promise<T | null> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const guarded: Promise<T | null> = p.catch(() => null);
    const timeout = new Promise<null>((resolve) => {
      timer = setTimeout(() => resolve(null), ms);
    });
    return await Promise.race([guarded, timeout]);
  } catch {
    return null;
  } finally {
    if (timer) clearTimeout(timer);
  }
}

// ── 解锁集（与 Excel 路由同一份实现，本文件不再保留本地复刻）─────────────────
//
// 解锁集构建已抽到 `@/lib/sales-strategy/pii-export` 的 `buildUnlockedContactSets`：
// 同一前缀常量、同一 `slice(前缀长度)` 取 id 规则，只认 `unlock:dealer_` / `unlock:lead_`。
//
// 本路由用到 `lead` 集合，因为 `unlock-contact` 路由对所有 candidateId 统一写
// `field = "unlock:<candidateId>"`，线索解锁同样留过 PiiAuditLog，PDF 也必须给明文
// （解锁自 2026-10-28 起免费，但审计记录照旧写入，故本判定口径不变）。
//
// 历史 TODO(去重) 已就地解决：两路由 import 同一模块，从根上排除「有人只改一处导致口径分叉」。

// ── 客户端入参：只信 candidateId / rationale / 顺序 ──────────────────────────

interface ChannelSeed {
  /** 原始 candidateId（`lead_xxx` / `dealer_xxx`） */
  candidateId: string;
  /** LLM 给出的推荐理由（唯一允许客户端提供的文本，非 PII） */
  rationale: string | null;
}

/**
 * 从 `body.channels` 中**只**提取 `candidateId` / `rationale`，并保留数组顺序。
 *
 * 其余字段（name/phone/brand/region/…）一律丢弃并在服务端重取，
 * 避免「客户端传什么就渲染什么」的伪造与越权。
 */
function readChannelSeeds(rawChannels: unknown): ChannelSeed[] {
  if (!Array.isArray(rawChannels)) return [];
  const seen = new Set<string>();
  const seeds: ChannelSeed[] = [];
  for (const item of rawChannels) {
    if (seeds.length >= MAX_CHANNELS) break;
    if (!item || typeof item !== "object") continue;
    const rec = item as Record<string, unknown>;
    const candidateId = typeof rec.candidateId === "string" ? rec.candidateId.trim() : "";
    if (!CANDIDATE_ID_RE.test(candidateId)) continue;
    if (seen.has(candidateId)) continue;
    seen.add(candidateId);
    const rationaleRaw = typeof rec.rationale === "string" ? rec.rationale.trim() : "";
    seeds.push({ candidateId, rationale: rationaleRaw ? rationaleRaw : null });
  }
  return seeds;
}

// ── 服务端重取 + PII 二段式 ─────────────────────────────────────────────────

interface DealerContactRow {
  id: string;
  name: string | null;
  brands: string[];
  models: string[];
  regions: string[];
  role: string | null;
  country: string | null;
  city: string | null;
  contactPerson: string | null;
  phone: string | null;
  wechat: string | null;
  email: string | null;
}

interface LeadContactRow {
  id: string;
  name: string | null;
  brand: string | null;
  model: string | null;
  region: string | null;
  location: string | null;
  phone: string | null;
  wechat: string | null;
  email: string | null;
}

/** 公司名为空时的展示兜底（与 PRD §4.1 的「未命名渠道 <id 前 6 位>」一致，不含任何 PII） */
function fallbackName(id: string, zh: boolean): string {
  return zh ? `未命名渠道 ${id.slice(0, 6)}` : `Unnamed channel ${id.slice(0, 6)}`;
}

/**
 * 单条渠道的 PII 二段式装配。
 *
 * 已解锁（逐条解锁 **或** `fullPii` 全量放行）⇒ 明文写进 `*Masked` 槽位
 * （`buildPdf` 只读这三个槽位）+ `unlocked:true` + `phone` 明文；
 * 未解锁 ⇒ `maskPhone` / `maskEmail` / 微信占位。
 *
 * @param fullPii 全量明文放行标记：`true` 时整份渠道表走 unlocked 分支，
 *                `unlockedDealers` / `unlockedLeads` 被忽略。仅由路由在
 *                `canViewFullPii(role)`（super_admin / admin）为真时传 `true`，缺省 `false` = 老行为。
 */
function buildChannel(
  seed: ChannelSeed,
  dealerMap: Map<string, DealerContactRow>,
  leadMap: Map<string, LeadContactRow>,
  unlockedDealers: Set<string>,
  unlockedLeads: Set<string>,
  zh: boolean,
  fullPii = false
): StrategyExportChannel | null {
  const m = CANDIDATE_ID_RE.exec(seed.candidateId);
  if (!m) return null;
  const type: "lead" | "dealer" = m[1] === "dealer" ? "dealer" : "lead";
  const rawId = m[2];

  if (type === "dealer") {
    const row = dealerMap.get(rawId);
    if (!row) return null; // 取不到 → 丢弃，不编造
    const unlocked = fullPii || unlockedDealers.has(row.id);
    const regionText = [row.country, row.city].filter(Boolean).join(" · ") || row.regions?.[0] || null;
    return {
      candidateId: seed.candidateId,
      type,
      name: (row.name ?? "").trim() || fallbackName(row.id, zh),
      brand: row.brands?.[0] ?? null,
      model: row.models?.[0] ?? null,
      region: regionText,
      ...(seed.rationale ? { rationale: seed.rationale } : {}),
      // ⚠️ 已解锁时必须覆盖 *Masked 槽位（buildPdf 零改动约束）
      phoneMasked: unlocked ? row.phone ?? "" : maskPhone(row.phone),
      wechatMasked: unlocked ? row.wechat ?? "" : WECHAT_PLACEHOLDER,
      emailMasked: unlocked ? row.email ?? "" : maskEmail(row.email),
      role: row.role ?? null,
      unlocked,
      contactPersonMasked: unlocked ? row.contactPerson ?? null : row.contactPerson ? (zh ? "已隐藏" : "Hidden") : null,
      phone: unlocked ? row.phone ?? null : null,
    };
  }

  const row = leadMap.get(rawId);
  if (!row) return null; // 取不到 → 丢弃，不编造
  const unlocked = fullPii || unlockedLeads.has(row.id);
  return {
    candidateId: seed.candidateId,
    type,
    name: (row.name ?? "").trim() || fallbackName(row.id, zh),
    brand: row.brand ?? null,
    model: row.model ?? null,
    region: row.region ?? row.location ?? null,
    ...(seed.rationale ? { rationale: seed.rationale } : {}),
    phoneMasked: unlocked ? row.phone ?? "" : maskPhone(row.phone),
    wechatMasked: unlocked ? row.wechat ?? "" : WECHAT_PLACEHOLDER,
    emailMasked: unlocked ? row.email ?? "" : maskEmail(row.email),
    // Lead 表无 role/country/city/contactPerson 列 ⇒ 一律 null（不猜）
    role: null,
    unlocked,
    contactPersonMasked: null,
    phone: unlocked ? row.phone ?? null : null,
  };
}

/** 按 candidateId 前缀拆分出待重取的 id 列表 */
function splitCandidateIds(seeds: ChannelSeed[]): { dealerIds: string[]; leadIds: string[] } {
  const dealerIds: string[] = [];
  const leadIds: string[] = [];
  for (const s of seeds) {
    const m = CANDIDATE_ID_RE.exec(s.candidateId);
    if (!m) continue;
    if (m[1] === "dealer") dealerIds.push(m[2]);
    else leadIds.push(m[2]);
  }
  return { dealerIds, leadIds };
}

export async function POST(request: NextRequest) {
  const locale = getLocaleFromRequest(request);
  const zh = locale === "zh";
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json(
        {
          success: false,
          error: zh ? "请先登录后再导出" : "Please sign in to export.",
          code: "LOGIN_REQUIRED",
          loginUrl: `/${locale}/auth/login`,
        },
        { status: 401 }
      );
    }

    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;

    // ── 客户端只提供 candidateId / rationale / 顺序，其余一律服务端重取 ──
    const seeds = readChannelSeeds(body.channels);
    const { dealerIds, leadIds } = splitCandidateIds(seeds);

    // ── 角色放行判定：super_admin / admin 导出即全量明文（不需要逐个点过「解锁」）──
    // `user.role ?? ""` 兜底：老 token / 测试桩可能没有 role ⇒ 按「无权限」处理（安全默认）。
    const fullPii = canViewFullPii(user.role ?? "");

    // ── 解锁集 + 经销商/线索明文，三查并行；任一失败/超时降级为空（不阻断导出）──
    // 管理员走 `fullPii` 全量放行 ⇒ 解锁集查询直接跳过（省一次 DB 往返）。
    const [auditFields, dealerRows, leadRows] = await Promise.all([
      fullPii
        ? Promise.resolve(null)
        : withDbTimeout(
            prisma.piiAuditLog.findMany({
              where: { actorId: user.id, field: { startsWith: UNLOCK_FIELD_PREFIX } },
              select: { field: true },
            })
          ),
      dealerIds.length > 0
        ? withDbTimeout(
            prisma.dealer.findMany({
              where: { id: { in: dealerIds } },
              select: {
                id: true,
                name: true,
                brands: true,
                models: true,
                regions: true,
                role: true,
                country: true,
                city: true,
                contactPerson: true,
                phone: true,
                wechat: true,
                email: true,
              },
            })
          )
        : Promise.resolve(null),
      leadIds.length > 0
        ? withDbTimeout(
            prisma.lead.findMany({
              where: { id: { in: leadIds } },
              select: {
                id: true,
                name: true,
                brand: true,
                model: true,
                region: true,
                location: true,
                phone: true,
                wechat: true,
                email: true,
              },
            })
          )
        : Promise.resolve(null),
    ]);

    const { dealers: unlockedDealers, leads: unlockedLeads } = buildUnlockedContactSets(auditFields ?? []);
    const dealerMap = new Map<string, DealerContactRow>(
      ((dealerRows ?? []) as DealerContactRow[]).map((r) => [r.id, r])
    );
    const leadMap = new Map<string, LeadContactRow>(
      ((leadRows ?? []) as LeadContactRow[]).map((r) => [r.id, r])
    );

    // ── 按 body 原顺序装配；取不到的候选丢弃 ──
    const channels: StrategyExportChannel[] = [];
    for (const seed of seeds) {
      const ch = buildChannel(seed, dealerMap, leadMap, unlockedDealers, unlockedLeads, zh, fullPii);
      if (ch) channels.push(ch);
    }

    // 留痕用的渠道构成（与 PDF 正文无关，只进审计 purpose）
    const dealerCount = channels.filter((c) => c.type === "dealer").length;
    const leadCount = channels.length - dealerCount;
    const auditScope: ExportAuditScope =
      dealerCount > 0 && leadCount > 0 ? "dealer+lead" : leadCount > 0 ? "lead" : "dealer";

    // ── 透传字段（strategy/product 为 LLM 结果，非 PII；webStatus 走白名单）──
    const webStatus =
      typeof body.webStatus === "string" && WEB_STATUSES.has(body.webStatus)
        ? (body.webStatus as StrategyExportWebStatus)
        : undefined;
    const webNote = typeof body.webNote === "string" ? body.webNote.slice(0, 200) : undefined;

    // ── 先渲染 PDF（不重跑 LLM）；渲染失败直接 500 不扣费 ──
    const payload: StrategyExportPayload = {
      strategy: (body.strategy ?? {}) as StrategyExportPayload["strategy"],
      product: (body.product ?? null) as StrategyExportPayload["product"],
      channels,
      locale,
      ...(webStatus ? { webStatus } : {}),
      ...(webNote ? { webNote } : {}),
    };
    const pdfBytes = await buildPdf(payload);

    // ── 留痕：管理员导出全量明文 PII（一次导出写一条汇总记录）──
    // 时机：放在渲染成功之后 —— 文件确实生成出来了才记账，避免「记了导出却 500 没文件」的假阳性。
    // 刻意不吞异常：留痕失败 ⇒ 抛给外层 catch ⇒ 500 且不发文件（导出免费、重试即可；
    // 而「明文已外发却查不到谁导的」是不可补救的合规缺口，宁可失败在明处）。
    // field 形如 `export:dealer_batch` / `export:dealer+lead_batch`，**不带** `unlock:` 前缀
    // （带 `unlock:` 会被 buildUnlockedContactSets 当成「已解锁」⇒ 永久解锁，是权限泄漏）。
    if (fullPii && channels.length > 0) {
      await recordAdminFullPiiExport({
        actorId: user.id,
        role: user.role ?? "",
        channel: "pdf",
        scope: `dealer=${dealerCount};lead=${leadCount}`,
        rows: channels.length,
        auditScope,
      });
    }

    // ── 导出不扣费（零 LLM 成本；见文件头「计费」说明）──
    const fileId = Date.now().toString(36);
    return new NextResponse(new Uint8Array(pdfBytes), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="ai-sales-strategy-${fileId}.pdf"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error: any) {
    console.error("[ExportPDF] 未处理异常:", error?.message);
    return NextResponse.json(
      {
        success: false,
        error: zh ? "导出失败，请稍后重试" : "Export failed, please retry.",
        code: "SERVER_ERROR",
      },
      { status: 500 }
    );
  }
}
