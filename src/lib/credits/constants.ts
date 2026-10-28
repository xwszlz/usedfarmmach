/**
 * 积分体系常量定义（共享知识 §8.3/§8.4/§8.6/§8.7/§8.11/§8.13）
 * 数值默认值以 PRD 为准；运营可调项存 SystemConfig，代码只兜底默认值。
 *
 * ⚠️ 积分单位（2026-10-13 起）：1 元 = 100 积分。
 *    2026-10-28 起**全球统一购买力**：所有币种的充值额都先折回人民币再换积分
 *    （1 元 = 100 积分，全球等值），不再存在「1 美元 = 100 积分」这种与汇率脱钩的独立锚点。
 *    本文件中所有「积分数」常量均已按新单位 ×100；priceCny、天数、次数、名额、周期、比例
 *    等非积分数值保持不变。充值/扣费口径必须同一版本上线，详见 prisma/migrate-credits-x100.ts。
 */

// ─── 流水类型枚举（CreditTransaction.type）─────────────────────
export const TXN_TYPES = [
  "register_gift",
  "cert_gift",
  "invite_reward",
  "checkin",
  "recharge",
  "first_order_reward",
  "admin_adjust",
  "publish_cost",
  "mall_cost",
  "ai_deduct",
  "inquiry_cost",
  "viewcontact_cost",
  "expire",
  "migration",
] as const;
export type TxnType = (typeof TXN_TYPES)[number];

// ─── 账户枚举（CreditLot.account / CreditTransaction.account）──
export const ACCOUNTS = ["gift", "recharge"] as const;
export type CreditAccount = (typeof ACCOUNTS)[number];
/** 扣减跨账户时流水 account 取值 */
export const MIXED_ACCOUNT = "mixed";

// ─── 批次有效期（天）──────────────────────────────────────────
export const GIFT_TTL_DAYS = 90;
export const RECHARGE_TTL_DAYS = 365;

// ─── 里程碑事件枚举（UserMilestone.event）─────────────────────
export const MILESTONE_EVENTS = [
  "register_gift",
  "cert_personal",
  "cert_enterprise",
  "first_publish",
  "first_inquiry",
  "first_deal",
  "email_verified_gift",
] as const;
export type MilestoneEvent = (typeof MILESTONE_EVENTS)[number];

// ─── 奖励数值默认值（可被 SystemConfig reward_values 覆盖）────
export const DEFAULT_REWARD_VALUES = {
  registerGift: 1000, // 全球统一口径（2026-10-28）：双站同值、不按币种区分。发布每台扣 1 积分
  certPersonal: 500, // 实名认证（certType=personnel/personal）
  certEnterprise: 1000, // 企业认证（certType=institution/enterprise）
  inviteCertInviter: 1000, // 被邀请人认证通过 → 邀请人
  inviteCertInvitee: 500, // 被邀请人认证通过 → 被邀请人（不占邀请人月额度）
  inviteFirstPublish: 500, // 被邀请人首次发布 → 邀请人
  inviteFirstPayCap: 5000, // 被邀请人首次付费 → 邀请人封顶
  /** 比例系数：实付金额(元) × 10% × 100 = 积分。100 即「1 元 = 100 积分」的单位换算，
   *  故原 0.1 在新单位下写作 0.1 × 100 = 10（floor 取整）。⚠️ 非积分数值，勿再 ×100。 */
  inviteFirstPayRate: 10,
  inviteMonthCap: 20000, // 邀请人每月 invite_reward 入账上限
  checkinDaily: 100, // 每日签到
  checkinStreakBonus: 300, // 连击第 7 天额外（计入月上限）
  checkinStreakCycle: 7, // 连击周期（天数，非积分，不受 ×100 影响）
  checkinMonthCap: 1000, // 每月签到积分上限（含连击）
  firstPublish: 200, // 首次发布
  firstInquiry: 500, // 首次收到询价（卖家）
  firstDeal: 2000, // 首次标记成交
  emailVerifiedGift: 500, // 邮箱验证成功（与注册礼包一致）
} as const;
export type RewardValues = {
  [K in keyof typeof DEFAULT_REWARD_VALUES]: number;
};

// ─── 消费数值 ─────────────────────────────────────────────────
// 注：原发布产品扣积分常量已删除，现直接以字面量 1 体现于发布链路（seller/products、internal/products 路由）。

/** 商城商品定价（积分） */
export const MALL_PRICES = {
  topPerDay: 500, // 置顶卡 /天/台
  refresh: 200, // 刷新卡 /次/台
  aiReport: 1000, // AI 报告抵扣（仅 standard/19.9 档）
  homeFeaturePerDay: 2000, // 首页推荐位 /天/台
} as const;

/** 首页推荐位每日名额（名额上限，非积分，不受 ×100 影响） */
export const HOME_FEATURE_DAILY_CAP = 10;
/** AI 报告积分抵扣仅开放的标准档 */
export const AI_REPORT_CREDITS_TIER = "standard";
/** AI 报告积分抵扣价（积分；新单位 1 元 = 100 积分） */
export const AI_REPORT_CREDITS_COST = 1000;

// ─── SKU 定义（价格/分值以 SystemConfig 为准，此处为兜底默认）─
export const ORDER_TYPES = ["credit_pack", "membership"] as const;
export type OrderType = (typeof ORDER_TYPES)[number];

export interface CreditPackSku {
  sku: string;
  credits: number;
  priceCny: number;
  audienceZh: string;
  audienceEn: string;
}

export const DEFAULT_CREDIT_PACKS: CreditPackSku[] = [
  { sku: "pack10", credits: 1000, priceCny: 20, audienceZh: "偶尔卖一两台的个人卖家", audienceEn: "Individual sellers listing occasionally" },
  { sku: "pack30", credits: 3000, priceCny: 54, audienceZh: "月发 10 台以内的小经销商", audienceEn: "Small dealers posting up to 10/mo" },
  { sku: "pack60", credits: 6000, priceCny: 96, audienceZh: "中等车商", audienceEn: "Mid-size dealers" },
  { sku: "pack150", credits: 15000, priceCny: 199, audienceZh: "大经销商", audienceEn: "Large dealers" },
];

export interface PlanSku {
  sku: string;
  tier: string;
  priceCny: number;
  credits: number; // 开通发放的充值积分（基础版 5000，其余 0）
  popular?: boolean;
}

export const DEFAULT_PLANS: PlanSku[] = [
  { sku: "plan_basic", tier: "basic", priceCny: 88, credits: 5000 },
  { sku: "plan_premium", tier: "premium", priceCny: 158, credits: 0, popular: true },
  { sku: "plan_enterprise", tier: "enterprise", priceCny: 288, credits: 0 },
];

export const ALL_SKUS = [
  ...DEFAULT_CREDIT_PACKS.map((p) => p.sku),
  ...DEFAULT_PLANS.map((p) => p.sku),
] as const;

// ─── 订单状态 ─────────────────────────────────────────────────
export const ORDER_STATUS = ["pending", "paid", "closed", "rejected", "refunded"] as const;
export type OrderStatus = (typeof ORDER_STATUS)[number];
/** pending 订单自动关闭时长（小时） */
export const ORDER_AUTO_CLOSE_HOURS = 24;

// ─── 邀请/风控 ────────────────────────────────────────────────
export const INVITATION_STATUS = ["bound", "risk_hold", "completed"] as const;
export const RISK_RULES = ["same_device", "same_phone", "same_payaccount", "multi_register_ip"] as const;
export type RiskRule = (typeof RISK_RULES)[number];
/** 同 IP 24h 注册 ≥N 触发风控 */
export const MULTI_REGISTER_IP_THRESHOLD = 3;
/** 注册后允许补填邀请码的窗口（小时） */
export const INVITE_BIND_WINDOW_HOURS = 24;

// ─── 认证类型映射（§8.11：personnel→实名 institution→企业 vehicle 不发分）─
export const CERT_EVENT_MAP: Record<string, MilestoneEvent | null> = {
  personnel: "cert_personal",
  personal: "cert_personal", // 别名兼容（U1）
  institution: "cert_enterprise",
  enterprise: "cert_enterprise", // 别名兼容（U1）
  vehicle: null, // 车辆认证不发分
};

export const CERT_MILESTONE_REWARD: Record<string, keyof RewardValues> = {
  cert_personal: "certPersonal",
  cert_enterprise: "certEnterprise",
};

// ─── SystemConfig 键名 ───────────────────────────────────────
export const CONFIG_KEYS = {
  annualBillingEnabled: "annual_billing_enabled",
  creditPacks: "credit_packs",
  plans: "plans",
  complianceText: "compliance_text",
  paymentQr: "payment_qr",
  rewardValues: "reward_values",
  // ── AI 销售策略按量计费（决策 B：[商业机密·内部]）──
  // 计费系数：cost = 实际 token 消耗 × ai_cost_coeff；代码只读取、不写明文倍数。
  // 护栏：单次成本（积分）超过 ai_cost_guardrail_credits 直接熔断，防不可控高价检索。
  aiCostCoeff: "ai_cost_coeff",
  aiCostGuardrail: "ai_cost_guardrail_credits",
} as const;

// ─── 合规文案默认值（§8.9 统一出处）──────────────────────────
export const DEFAULT_COMPLIANCE_TEXT = {
  zh: "本服务为增值信息服务费，积分仅用于平台信息服务，不可提现、不可转让、不可退款",
  en: "This is a value-added information service fee. Credits are for platform information services only — non-withdrawable, non-transferable, non-refundable.",
};

export const DEFAULT_PAYMENT_QR = {
  wechat: "/qrcode/wechat-pay.png",
  alipay: "/qrcode/alipay.jpg",
};

export const RECHARGE_SLA_TEXT = {
  zh: "工作日 2 小时内到账",
  en: "Credited within 2 hours on business days",
};

// ─── 徽章 ────────────────────────────────────────────────────
export const BADGE_DEALT_SELLER = "dealt_seller";
