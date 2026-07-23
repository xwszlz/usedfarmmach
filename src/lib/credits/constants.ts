/**
 * 积分体系常量定义（共享知识 §8.3/§8.4/§8.6/§8.7/§8.11/§8.13）
 * 数值默认值以 PRD 为准；运营可调项存 SystemConfig，代码只兜底默认值。
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
  registerGift: 5, // 注册即送（Q1 临时口径）
  certPersonal: 5, // 实名认证（certType=personnel/personal）
  certEnterprise: 10, // 企业认证（certType=institution/enterprise）
  inviteCertInviter: 10, // 被邀请人认证通过 → 邀请人
  inviteCertInvitee: 5, // 被邀请人认证通过 → 被邀请人（不占邀请人月额度）
  inviteFirstPublish: 5, // 被邀请人首次发布 → 邀请人
  inviteFirstPayCap: 50, // 被邀请人首次付费 → 邀请人封顶
  inviteFirstPayRate: 0.1, // 实付金额 × 10%（floor 取整）
  inviteMonthCap: 200, // 邀请人每月 invite_reward 入账上限
  checkinDaily: 1, // 每日签到
  checkinStreakBonus: 3, // 连击第 7 天额外（计入月上限）
  checkinStreakCycle: 7, // 连击周期
  checkinMonthCap: 10, // 每月签到积分上限（含连击）
  firstPublish: 2, // 首次发布
  firstInquiry: 5, // 首次收到询价（卖家）
  firstDeal: 20, // 首次标记成交
  emailVerifiedGift: 5, // 邮箱验证成功（与注册礼包一致）
} as const;
export type RewardValues = {
  [K in keyof typeof DEFAULT_REWARD_VALUES]: number;
};

// ─── 消费数值 ─────────────────────────────────────────────────
export const PUBLISH_COST = 1; // 发布产品扣积分

/** 商城商品定价（积分） */
export const MALL_PRICES = {
  topPerDay: 5, // 置顶卡 /天/台
  refresh: 2, // 刷新卡 /次/台
  aiReport: 10, // AI 报告抵扣（仅 standard/19.9 档）
  homeFeaturePerDay: 20, // 首页推荐位 /天/台
} as const;

/** 首页推荐位每日名额 */
export const HOME_FEATURE_DAILY_CAP = 10;
/** AI 报告积分抵扣仅开放的标准档 */
export const AI_REPORT_CREDITS_TIER = "standard";
/** AI 报告积分抵扣价（分） */
export const AI_REPORT_CREDITS_COST = 10;

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
  { sku: "pack10", credits: 10, priceCny: 20, audienceZh: "偶尔卖一两台的个人卖家", audienceEn: "Individual sellers listing occasionally" },
  { sku: "pack30", credits: 30, priceCny: 54, audienceZh: "月发 10 台以内的小经销商", audienceEn: "Small dealers posting up to 10/mo" },
  { sku: "pack60", credits: 60, priceCny: 96, audienceZh: "中等车商", audienceEn: "Mid-size dealers" },
  { sku: "pack150", credits: 150, priceCny: 199, audienceZh: "大经销商", audienceEn: "Large dealers" },
];

export interface PlanSku {
  sku: string;
  tier: string;
  priceCny: number;
  credits: number; // 开通发放的充值积分（基础版 50，其余 0）
  popular?: boolean;
}

export const DEFAULT_PLANS: PlanSku[] = [
  { sku: "plan_basic", tier: "basic", priceCny: 99, credits: 50 },
  { sku: "plan_premium", tier: "premium", priceCny: 299, credits: 0, popular: true },
  { sku: "plan_enterprise", tier: "enterprise", priceCny: 999, credits: 0 },
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
