// ───────────────────────────────────────────────
// 买家多语客服 Agent — 核心 Agent 类
// 轻量级 LLM 调用 (OpenRouter) + 意图分类 + 产品上下文 RAG
// v0.2.0 — 新增：AI 回复中推荐产品时，返回产品卡片数据
// ───────────────────────────────────────────────

import { prisma } from "@/lib/db";
import axios from "axios";
import {
  BuyerChatAgentInput,
  BuyerChatAgentOutput,
  ChatMessageOutput,
  ChatIntent,
  ChatAction,
  ChatLocale,
} from "./types";
import {
  fetchProductContext,
  fetchArbitrageTop3,
  findFAQAnswer,
  fetchBrandMap,
} from "./sources";

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || "";
const OPENROUTER_BASE = "https://openrouter.ai/api/v1";
const DEFAULT_MODEL = "openai/gpt-4o-mini";
const FALLBACK_MODEL = "google/gemini-2.0-flash-001";

// ── 意图分类（快速规则层，避免 LLM 延迟）──────
function ruleBasedIntent(query: string, locale: ChatLocale): ChatIntent | null {
  const lower = query.toLowerCase();
  const kw: Record<ChatIntent, string[]> = {
    price_inquiry: ["price", "cost", "how much", "多少钱", "价格", "цена", "precio", "prix"],
    product_compare: ["compare", "vs", "versus", "对比", "比较", "сравн", "comparar", "comparer"],
    shipping: ["ship", "deliver", "transport", "运费", "物流", "运输", "доставк", "envío", "livraison"],
    payment: ["pay", "payment", "invoice", "付款", "支付", "оплат", "pago", "paiement"],
    warranty: ["warranty", "guarantee", "repair", "保修", "质保", "гарант", "garantía", "garantie"],
    technical_spec: ["spec", "hours", "engine", "power", "参数", "马力", "功率", "характеристик", "especif", "spécif"],
    hand_over: ["human", "agent", "sales", "人工", "客服", "经理", "менеджер", "agente", "agent"],
    general: [],
    unknown: [],
  };
  for (const [intent, words] of Object.entries(kw) as [ChatIntent, string[]][]) {
    if (words.some((w) => lower.includes(w))) return intent;
  }
  return null;
}

// ── 系统提示词构建 ─────────────────────────────
function buildSystemPrompt(ctx: {
  locale: ChatLocale;
  productId?: string;
  product?: any;
  arbitrageTop3?: any[];
  brandMap?: Record<string, string>;
}): string {
  const { locale, product, arbitrageTop3 } = ctx;
  const langName: Record<ChatLocale, string> = {
    zh: "中文", en: "English", ru: "Русский",
    es: "Español", pt: "Português", ar: "العربية",
    fr: "Français", hi: "हिन्दी",
  };
  let prompt = `You are an expert agricultural machinery sales assistant for "UsedFarmMach.com" (神雕农机).
You are chatting with an international buyer in ${langName[locale]}.

RULES:
1. Always respond in ${langName[locale]} ONLY.
2. Be concise (under 150 words), friendly, and professional.
3. If the user asks about a specific product, provide COMPREHENSIVE information including:
   - Basic specs (model, year, hours, condition, price)
   - Operation guidelines (how to operate, key controls, safety notes)
   - Maintenance schedule (daily checks, periodic service, common consumables)
   - Compatible accessories (attachments, spare parts, upgrade options)
   - Arbitrage opportunity (if price gap exists)
   Use the product context below AND your knowledge of agricultural machinery.
4. If they ask about shipping/payment/warranty, give exact facts from the FAQ knowledge.
5. If the user mentions price gaps or arbitrage, highlight the arbitrage percentage and profit potential.
6. If you cannot answer confidently, suggest "hand_over" (transfer to human) — NEVER make up prices or specs.
7. When suggesting products, include the product ID in brackets like [PRODUCT_ID:xxx] so the frontend can render cards.
8. Suggest 1-2 related products if relevant.
9. If the user asks "操作手册", "保养", "配件", or equivalents in other languages, provide detailed operation/maintenance/accessory info.
`;

  if (product) {
    prompt += `
CURRENT PRODUCT CONTEXT:
- Brand: ${product.brand}
- Model: ${product.modelName} (${product.year})
- Condition: ${product.condition}
- Working Hours: ${product.workingHours ?? "N/A"}
- Location: ${product.location}
- Domestic Price: ¥${product.priceCny.toLocaleString()}
- International Price: ${product.internationalPrices[0]
        ? `¥${product.internationalPrices[0].priceForeignCny.toLocaleString()} (${product.internationalPrices[0].source}, ${product.internationalPrices[0].country})`
        : "N/A"}
- Arbitrage Gap: ${product.arbitragePercent !== null && product.arbitragePercent !== undefined ? `${product.arbitragePercent > 0 ? "+" : ""}${product.arbitragePercent}%` : "N/A"}
`;
  }

  if (arbitrageTop3 && arbitrageTop3.length > 0) {
    prompt += `
TOP ARBITRAGE OPPORTUNITIES TODAY:
${arbitrageTop3
      .map(
        (p: any, i: number) =>
          `${i + 1}. ${p.brand} ${p.modelName} ${p.year} — ¥${p.priceCny.toLocaleString()} (gap ${p.priceDiffPercent > 0 ? "+" : ""}${p.priceDiffPercent}%) [PRODUCT_ID:${p.id}]`
      )
      .join("\n")}
`;
  }

  prompt += `
AVAILABLE ACTIONS (JSON only, never show to user):
- {"type":"show_product","productId":"..."}
- {"type":"compare","productIds":["...","..."]}
- {"type":"contact_whatsapp","phone":"+86-..."}
- {"type":"contact_email","email":"..."}
- {"type":"hand_over","reason":"..."}
`;

  return prompt;
}

// ── LLM 调用器 ──────────────────────────────────
async function callLLM(
  messages: { role: "system" | "user" | "assistant"; content: string }[],
  model = DEFAULT_MODEL
): Promise<{
  content: string;
  model: string;
  tokens: { prompt: number; completion: number };
  latencyMs: number;
}> {
  const start = Date.now();
  if (!OPENROUTER_API_KEY) {
    throw new Error("OPENROUTER_API_KEY not configured");
  }

  const res = await axios.post(
    `${OPENROUTER_BASE}/chat/completions`,
    { model, messages, temperature: 0.7, max_tokens: 800 },
    {
      headers: {
        Authorization: `Bearer ${OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://usedfarmmach.com",
        "X-Title": "UsedFarmMach Buyer Chat",
      },
      timeout: 20000,
    }
  );

  const data = res.data as any;
  const choice = data.choices?.[0];
  if (!choice) throw new Error("No LLM response choice");

  return {
    content: choice.message.content as string,
    model: (data.model as string) || model,
    tokens: {
      prompt: (data.usage?.prompt_tokens as number) || 0,
      completion: (data.usage?.completion_tokens as number) || 0,
    },
    latencyMs: Date.now() - start,
  };
}

// ── 从回复中提取动作 JSON ─────────────────────
function extractActions(content: string): ChatAction[] {
  const actions: ChatAction[] = [];
  const regex = /\{[^{}]*"type"\s*:\s*"[^"]*"[^{}]*\}/g;
  const matches = content.match(regex) || [];
  for (const m of matches) {
    try {
      const obj = JSON.parse(m);
      if (obj.type) actions.push(obj as ChatAction);
    } catch {
      // ignore
    }
  }
  return actions;
}

// ── 从回复中提取 [PRODUCT_ID:xxx] ────────────
function extractProductIds(content: string): string[] {
  const ids: string[] = [];
  const regex = /\[PRODUCT_ID:([a-zA-Z0-9]+)\]/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(content)) !== null) {
    ids.push(match[1]);
  }
  return [...new Set(ids)];
}

// ── 清理回复（去掉内部标记）───────────────────
function cleanReply(content: string): string {
  return content
    .replace(/\[PRODUCT_ID:[a-zA-Z0-9]+\]/g, "")
    .replace(/\{[^{}]*"type"\s*:\s*"[^"]*"[^{}]*\}/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

// ── 卡片数据类型 ─────────────────────────────
interface SuggestedProductOut {
  id: string;
  brand: string;
  modelName: string;
  year: number;
  priceCny: number;
  priceUsd?: number | null;
  imageUrl?: string;
  arbitragePercent?: number | null;
}

// ── 主 Agent 类 ────────────────────────────────
export class BuyerChatAgent {
  version = "0.2.0";

  async run(input: BuyerChatAgentInput): Promise<BuyerChatAgentOutput> {
    const start = Date.now();
    const { visitorId, productId, locale, content, sessionId, dryRun } = input;

    try {
      // 1. 加载/创建会话
      let session = sessionId
        ? await prisma.chatSession.findUnique({ where: { id: sessionId } })
        : null;

      if (!session) {
        session = await prisma.chatSession.create({
          data: { visitorId, productId: productId || null, locale, status: "active" },
        });
      }

      // 2. 加载历史消息（最近 6 条）
      const history = await prisma.chatMessage.findMany({
        where: { sessionId: session.id },
        orderBy: { createdAt: "asc" },
        take: 6,
        select: { role: true, content: true },
      });

      // 3. 加载上下文
      const [productCtx, arbitrageTop3, brandMap] = await Promise.all([
        productId ? fetchProductContext(productId, locale) : Promise.resolve(null),
        fetchArbitrageTop3(),
        fetchBrandMap(),
      ]);

      // 4. FAQ 快速命中（如果命中直接返回，不走 LLM）
      const faq = findFAQAnswer(content, locale);
      let replyContent: string;
      let intent: ChatIntent = "general";
      let confidence = 0.5;
      let actions: ChatAction[] = [];
      let modelUsed = "faq-cache";
      let tokens = { prompt: 0, completion: 0 };
      let latency = 0;

      // 产品卡片数据（提升到 try 块内，确保所有路径都可访问）
      let suggestedProductsOut: SuggestedProductOut[] = [];

      if (faq) {
        replyContent = faq.answer;
        intent = ruleBasedIntent(content, locale) || "general";
        confidence = 0.95;
      } else {
        // 5. 意图分类（规则层）
        const ruleIntent = ruleBasedIntent(content, locale);
        intent = ruleIntent || "unknown";
        confidence = ruleIntent ? 0.8 : 0.5;

        // 6. 构建 LLM 消息
        const systemPrompt = buildSystemPrompt({
          locale,
          productId,
          product: productCtx,
          arbitrageTop3,
          brandMap,
        });

        const llmMessages: { role: "system" | "user" | "assistant"; content: string }[] = [
          { role: "system", content: systemPrompt },
          ...history.map((h: any) => ({ role: h.role as "user" | "assistant", content: h.content })),
          { role: "user", content },
        ];

        if (!dryRun) {
          // 7. 调用 LLM
          const llmRes = await callLLM(llmMessages);
          replyContent = llmRes.content;
          modelUsed = llmRes.model;
          tokens = llmRes.tokens;
          latency = llmRes.latencyMs;

          // 8. 提取动作 & 产品ID
          actions = extractActions(replyContent);
          const mentionedIds = extractProductIds(replyContent);
          replyContent = cleanReply(replyContent);

          // 9. 如果有推荐产品，加载详情
          if (mentionedIds.length > 0) {
            const suggestedProducts = await prisma.product.findMany({
              where: { id: { in: mentionedIds } },
              include: {
                brand: { select: { nameEn: true, nameZh: true } },
                images: { select: { url: true }, orderBy: { sortOrder: "asc" }, take: 1 },
                internationalPrices: { orderBy: { sourceDate: "desc" }, take: 1 },
              },
            });
            // 存入 actions 以便前端渲染
            for (const p of suggestedProducts) {
              actions.push({ type: "show_product", productId: p.id });
            }
            // 格式化为输出
            suggestedProductsOut = suggestedProducts.map((p) => ({
              id: p.id,
              brand: p.brand?.nameEn || p.brand?.nameZh || "Unknown",
              modelName: p.modelName,
              year: p.year,
              priceCny: p.priceCny,
              priceUsd: p.priceUsd,
              imageUrl: p.images[0]?.url || undefined,
              arbitragePercent: p.internationalPrices[0]
                ? Math.round(
                    ((p.internationalPrices[0].priceForeignCny - p.priceCny) / p.priceCny) * 100
                  )
                : null,
            }));
          }
        } else {
          replyContent = `[dry-run] Would respond to: "${content}" with intent=${intent}`;
          latency = Date.now() - start;
        }
      }

      // 10. 存用户消息 + 助手回复
      if (!dryRun) {
        await prisma.chatMessage.createMany({
          data: [
            {
              sessionId: session.id,
              role: "user",
              content,
              intent: intent,
              metadata: JSON.stringify({ locale, productId }),
            },
            {
              sessionId: session.id,
              role: "assistant",
              content: replyContent,
              intent,
              metadata: JSON.stringify({
                model: modelUsed,
                tokens,
                latencyMs: latency,
                actions,
                confidence,
              }),
            },
          ],
        });

        // 更新会话时间
        await prisma.chatSession.update({
          where: { id: session.id },
          data: { updatedAt: new Date() },
        });
      }

      // 11. 构造输出
      const message: ChatMessageOutput = {
        sessionId: session.id,
        messageId: "",
        role: "assistant",
        content: replyContent,
        intent,
        confidence,
        suggestedProducts: suggestedProductsOut.length > 0 ? suggestedProductsOut : undefined,
        actions,
        model: modelUsed,
        tokensUsed: tokens,
        latencyMs: latency,
      };

      return {
        success: true,
        sessionId: session.id,
        message,
      };
    } catch (e) {
      const err = e instanceof Error ? e.message : String(e);
      console.error("[BuyerChatAgent] error:", err);
      return {
        success: false,
        sessionId: sessionId || "",
        message: {
          sessionId: sessionId || "",
          messageId: "",
          role: "assistant",
          content:
            locale === "zh"
              ? "抱歉，服务暂时不可用，请稍后再试或联系人工客服。"
              : locale === "ru"
                ? "Извините, сервис временно недоступен. Попробуйте позже или свяжитесь с менеджером."
                : "Sorry, the service is temporarily unavailable. Please try again later or contact our sales team.",
          intent: "hand_over",
          confidence: 1.0,
          actions: [{ type: "hand_over", reason: err }],
        },
        error: err,
      };
    }
  }

  // 获取会话历史（供前端加载）
  async getHistory(sessionId: string) {
    const messages = await prisma.chatMessage.findMany({
      where: { sessionId },
      orderBy: { createdAt: "asc" },
      select: { id: true, role: true, content: true, intent: true, createdAt: true },
    });
    return messages;
  }

  // 获取会话列表（供管理后台）
  async listSessions(visitorId?: string) {
    const where = visitorId ? { visitorId } : {};
    return prisma.chatSession.findMany({
      where,
      orderBy: { updatedAt: "desc" },
      take: 50,
      include: {
        messages: { orderBy: { createdAt: "desc" }, take: 1, select: { content: true, role: true } },
      },
    });
  }
}

// 单例
export const buyerChatAgent = new BuyerChatAgent();
