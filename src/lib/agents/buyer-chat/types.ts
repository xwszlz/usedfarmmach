// ───────────────────────────────────────────────
// 买家多语客服 Agent — 类型定义
// 场景: #7 多语客服 Agent (Buyer Chat)
// ───────────────────────────────────────────────

export type ChatLocale = "zh" | "en" | "ru" | "es" | "pt" | "ar" | "fr" | "hi";

export type ChatIntent =
  | "price_inquiry"      // 询价
  | "product_compare"    // 产品对比
  | "shipping"           // 物流/运输
  | "payment"            // 付款方式
  | "warranty"           // 售后/质保
  | "technical_spec"     // 技术参数
  | "general"            // 通用闲聊
  | "hand_over"          // 要求转人工
  | "unknown";

export interface ChatMessageInput {
  sessionId?: string;          // 已有会话继续；空则新建
  visitorId: string;            // 访客指纹（匿名）或登录用户ID
  productId?: string;          // 当前产品页ID（可选上下文）
  locale: ChatLocale;
  content: string;              // 用户消息
}

export interface ChatMessageOutput {
  sessionId: string;
  messageId: string;
  role: "assistant";
  content: string;
  intent: ChatIntent;
  confidence: number;
  suggestedProducts?: Array<{
    id: string;
    brand: string;
    modelName: string;
    year: number;
    priceCny: number;
    priceUsd?: number | null;
    imageUrl?: string;
    arbitragePercent?: number | null;
  }>;
  actions?: ChatAction[];
  model?: string;
  tokensUsed?: { prompt: number; completion: number };
  latencyMs?: number;
}

export type ChatAction =
  | { type: "show_product"; productId: string }
  | { type: "compare"; productIds: [string, string] }
  | { type: "contact_whatsapp"; phone: string }
  | { type: "contact_email"; email: string }
  | { type: "hand_over"; reason: string }
  | { type: "schedule_call"; link: string };

export interface ChatContext {
  locale: ChatLocale;
  productId?: string;
  product?: ProductContext | null;
  recentMessages: { role: "user" | "assistant"; content: string }[];
  arbitrageTop3?: ArbitrageProductContext[];
  brandMap?: Record<string, string>; // brandId -> nameEn
}

export interface ProductContext {
  id: string;
  brand: string;
  modelName: string;
  year: number;
  workingHours?: number | null;
  condition: string;
  priceCny: number;
  priceUsd?: number | null;
  location: string;
  description?: string | null;
  images: string[];
  internationalPrices: { source: string; priceForeignCny: number; currency: string; country?: string | null }[];
  arbitragePercent?: number | null;
}

export interface ArbitrageProductContext {
  id: string;
  brand: string;
  modelName: string;
  year: number;
  priceCny: number;
  priceDiffPercent: number;
  imageUrl?: string;
}

export interface BuyerChatAgentInput {
  sessionId?: string;
  visitorId: string;
  productId?: string;
  locale: ChatLocale;
  content: string;
  dryRun?: boolean;
}

export interface BuyerChatAgentOutput {
  success: boolean;
  sessionId: string;
  message: ChatMessageOutput;
  error?: string;
}

// FAQ 知识条目
export interface FAQEntry {
  questionZh: string;
  questionEn: string;
  questionRu?: string;
  answerZh: string;
  answerEn: string;
  answerRu?: string;
  tags: string[];
}
