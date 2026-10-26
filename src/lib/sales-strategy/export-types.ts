/**
 * AI 销售策略 · 导出层契约（N01「契约冻结」，唯一类型真相）
 * ─────────────────────────────────────────────────────────
 * 职责：集中定义 PDF / Excel 导出链路用到的全部入参与中间结构，使
 *   - `export.ts`（PDF 渲染，buildPdf）
 *   - `export-excel.ts`（Excel 渲染，buildExcel）
 *   - `export/pdf/route.ts`、`export/excel/route.ts`（路由）
 *   - `components/seller/sales-strategy-export-buttons.tsx`（前端透传）
 * 共享同一份类型定义，避免各处手写结构漂移。
 *
 * 冻结约定（后续任务只允许「追加可选字段」，禁止改名 / 改必填 / 删字段）：
 *   - 消费者：T10（PDF 8 章）、T11（Excel 三 Sheet）、T12（PDF 路由解锁）、N03（前端透传）
 *   - 既有 import 路径不变：`@/lib/sales-strategy/export` 继续 re-export 本文件全部类型，
 *     因此 `@/lib/sales-strategy/export` 无需改动调用方即可继续编译。
 *   - 所有「预置字段」一律声明为可选（`?`），保证既有测试中的手写字面量
 *     （`__tests__/export.test.ts`、`export/{pdf,excel}/__tests__/route.test.ts`）无需改动。
 *
 * 合规红线（#1 数据不出境 / PII 最小化）：
 *   本文件只描述「结构」，不包含任何取数 / 脱敏逻辑；
 *   明文 PII 的放行唯一条件是 `channel.id ∈ unlockedSet`（见 export-excel.ts 与 T12）。
 */

import type { StrategyLlmResult } from "./prompt";

/**
 * 外部检索（Web 证据）状态，透传到导出层供渲染层降级判断。
 *
 * ⚠️ 契约说明（N01 冻结时的取舍）：
 *   `web-evidence.ts`（T07）的 `WebEvidenceStatus` 为 `"ok" | "partial" | "timeout" | "disabled"`，
 *   本类型在其基础上**取并集**追加 `"error"`（导出路由层可能直接把渲染/取数异常记为 error）。
 *   取并集而非取交集，保证 T07/T10/N03 任意一方传入其自有状态值都能通过类型检查；
 *   渲染层只判 `!== "ok"`，故并集不会引入行为歧义。
 */
export type StrategyExportWebStatus = "ok" | "partial" | "timeout" | "disabled" | "error";

/**
 * 导出 PDF / Excel 时使用的「渠道」结构。
 *
 * 基础 6 字段（脱敏联系方式 + 基础属性）沿用 T2 已上线契约，语义不变；
 * 其后的字段均为 N01 预置的可选字段，由 T10（8 章渲染）/ T12（服务端解锁重取）填充。
 */
export interface StrategyExportChannel {
  /** 候选 id：`lead_xxx` 或 `dealer_xxx` */
  candidateId: string;
  /** 渠道类型：线索 / 经销商（仅 `dealer` 参与 PII 解锁门禁） */
  type: "lead" | "dealer";
  /** 渠道名称（公司名 / 联系人组织名，公开信息） */
  name: string;
  /** 品牌（公开信息） */
  brand?: string | null;
  /** 机型（公开信息） */
  model?: string | null;
  /** 地区（公开信息，国别/省份自由文本） */
  region?: string | null;
  /** LLM 给出的推荐理由（PDF 渠道卡展示） */
  rationale?: string;
  /** 脱敏电话（`@/lib/pii` 的 `maskPhone` 产出；未解锁行唯一可用值） */
  phoneMasked: string;
  /** 脱敏微信（无公网标准 → 统一占位 `微信:********`） */
  wechatMasked: string;
  /** 脱敏邮箱（`@/lib/pii` 的 `maskEmail` 产出） */
  emailMasked: string;

  // ── N01 预置（由 T10 / T12 填充；全部可选，缺省不改既有渲染行为）────────────────
  /** 角色：原厂 / 进口商 / 授权经销 / 二手商 / 拍卖行 / 物流 / 政府 / 终端 */
  role?: string | null;
  /** 该行联系方式是否已付费解锁（`true` 时路由写入明文，渲染层可加「已解锁」标记） */
  unlocked?: boolean;
  /** 联系人姓名脱敏后的展示值（未解锁 → `已隐藏`；已解锁 → 明文） */
  contactPersonMasked?: string | null;
  /**
   * 已解锁时的明文电话。
   * ⚠️ 既有 `buildPdf` 只读 `phoneMasked`（零改动约束），故 T12 若要让 PDF 出现明文，
   * 必须同时覆盖 `phoneMasked`；本字段用于 T10 v2 章节与后续 UI 显式区分「明文」语义。
   */
  phone?: string | null;
}

/** 导出 PDF 时使用的「本品」结构（public 属性，不含任何 PII） */
export interface StrategyProductInfo {
  brandName?: string | null;
  modelName?: string | null;
  year?: number | null;
  categoryName?: string | null;
  priceCny?: number | null;
  location?: string | null;
  condition?: string | null;
  workingHours?: number | null;
  isChineseBrand?: boolean;
}

/** `buildPdf` 入参 */
export interface StrategyExportPayload {
  /** LLM 生成的结构化策略（12 个新决策字段全部可选，由 `strategy-schema.ts` 追加） */
  strategy: StrategyLlmResult;
  /** 本品信息；无关联商品时为 null（legacy 兜底文案） */
  product: StrategyProductInfo | null;
  /** 渠道列表（联系方式一律为脱敏值，除 T12 服务端解锁后的明文） */
  channels: StrategyExportChannel[];
  /** 语言：zh（默认）/ en */
  locale?: "zh" | "en";

  // ── N01 预置（由 T10 消费：顶部告警条；由 N03 透传；全部可选）──────────────────
  /** 本次策略的外部检索状态；缺省（undefined）视同 `ok`，不渲染告警条 */
  webStatus?: StrategyExportWebStatus;
  /** 检索状态补充说明（如「部分检索超时（3/5 成功）」），进告警条第二行 */
  webNote?: string;
}

/**
 * `buildExcel` 入参：携带明文联系方式，由路由安全读取；非解锁行由 `buildExcel` 脱敏。
 *
 * 前 12 个字段为 T3 已上线契约；其后 8 个字段对应 `Dealer` 表新增列（T06），
 * 由 `export/excel/route.ts`（T11）二次读取后填入，故**全部可选**——
 * 旧调用方（含既有测试）不传也能编译与运行。
 */
export interface ExcelDealerInput {
  id: string;
  partition: "cn" | "intl";
  /** 分级（A/B/C…），语义冻结，不得被 `priority` 覆盖 */
  grade: string | null;
  brands: string[];
  models: string[];
  regions: string[];
  nature: string | null;
  name: string | null;
  /** 明文联系方式（路由从当前站点 prisma 安全读取；buildExcel 据此门禁） */
  phone: string | null;
  wechat: string | null;
  email: string | null;
  sourceUrl: string | null;

  // ── N01 预置：Dealer 新增 8 列（T06 建列 / T11 读取渲染），全部可选 ──────────────
  /** 国别（`splitCountryCity` 派生，如「荷兰」「中国」） */
  country?: string | null;
  /** 城市 / 省州（`splitCountryCity` 派生，如「Drenthe」「河北」） */
  city?: string | null;
  /** 联系人姓名（**受 PII 门禁**：未解锁渲染「已隐藏」） */
  contactPerson?: string | null;
  /** 角色：原厂 / 进口商 / 授权经销 / 二手商 / 拍卖行 / 物流 / 政府 / 终端 */
  role?: string | null;
  /** 优先级 S/A/B/C（`gradeToPriority` 兜底**永不产出 S**） */
  priority?: string | null;
  /** 建议报价（当前 CSV 无数据源 → 恒 null，禁止编造） */
  suggestedPrice?: string | null;
  /** 跟进状态（schema 默认「未联系」） */
  followStatus?: string | null;
  /** 调研文件溯源（与 `sourceUrl` 语义不同：形如 `公开渠道·en.tec24.com·2026-10-13`） */
  sourcePage?: string | null;
}

/**
 * Excel 版式开关：
 *   - `1`（默认，legacy）：单 Sheet、11 列，即 T3 现状行为，**逐字保留**；
 *   - `2`（T11）：三 Sheet（渠道联系总表 14 列 / 机型价格速查 7 列 / 必办清单 5 列）。
 */
export type BuildExcelLayout = 1 | 2;
