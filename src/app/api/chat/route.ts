// ───────────────────────────────────────────────
// 小程序「智能客服」公开接口（方案 B：关键词 FAQ 静态匹配）
//   ⚠️ 不调用任何生成式 AI / 大模型，纯规则匹配，零 AI 资质要求、零合规风险
//   POST /api/chat  { message, scene?, productId?, productTitle? }
//     scene ∈ profile | about | detail | (空=通用)
//     匹配顺序：场景专属 FAQ 优先，未命中回退公共 FAQ；均未命中返回转人工提示
//     detail 场景答案支持 {{title}} 占位符，由 productTitle 注入
//   → WECOM_GROUP_WEBHOOK_URL 未配则静默跳过推群
// ───────────────────────────────────────────────
import { pushToGroup } from "@/lib/wecom/group-webhook";
import faqCommon from "@/lib/agents/buyer-chat/faq-common.json";
import faqProfile from "@/lib/agents/buyer-chat/faq-profile.json";
import faqAbout from "@/lib/agents/buyer-chat/faq-about.json";
import faqDetail from "@/lib/agents/buyer-chat/faq-detail.json";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type FaqItem = {
  keywords: string[];
  answer: string;
  intent?: string;
};

// 场景 → 专属知识库
const SCENE_FAQ: Record<string, FaqItem[]> = {
  profile: faqProfile as FaqItem[],
  about: faqAbout as FaqItem[],
  detail: faqDetail as FaqItem[],
};

const COMMON_FAQ: FaqItem[] = faqCommon as FaqItem[];

const FALLBACK =
  "这个问题我暂时没有标准答案，已为你转人工。\n" +
  "请复制邮箱联系：jiusei0319@gmail.com\n" +
  "也可在「我的 → 关于」页查看联系方式。\n" +
  "（你也可换种说法，比如「怎么发布」「运费多少」「怎么估价」）";

function matchFAQ(
  message: string,
  items: FaqItem[]
): { item: FaqItem | null; score: number } {
  const text = message.toLowerCase();
  let best: FaqItem | null = null;
  let bestScore = 0;
  for (const item of items) {
    let score = 0;
    for (const kw of item.keywords) {
      if (text.includes(kw.toLowerCase())) score += 1;
    }
    if (score > bestScore) {
      bestScore = score;
      best = item;
    }
  }
  return { item: best, score: bestScore };
}

export async function GET() {
  return Response.json({
    ok: true,
    service: "buyer-chat-faq",
    scenes: ["profile", "about", "detail"],
    note: "POST /api/chat with { message, scene?, productId?, productTitle? }",
  });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const message: string | undefined = body?.message;

    if (!message || typeof message !== "string" || !message.trim()) {
      return Response.json({ success: false, error: "message is required" }, { status: 400 });
    }

    const scene: string =
      typeof body?.scene === "string" && SCENE_FAQ[body.scene] ? body.scene : "";
    const productTitle: string =
      typeof body?.productTitle === "string" ? body.productTitle : "";

    // 候选顺序：场景专属优先，再回退公共（保证场景命中优先于通用）
    const sceneItems = scene ? SCENE_FAQ[scene] : [];
    const candidates = [...sceneItems, ...COMMON_FAQ];

    const { item, score } = matchFAQ(message.trim(), candidates);
    let reply = score > 0 && item ? item.answer : FALLBACK;
    let intent = score > 0 && item?.intent ? item.intent : "hand_over";

    // 详情场景个性化：用机器名替换占位符
    if (productTitle && reply.includes("{{title}}")) {
      reply = reply.replace(/\{\{title\}\}/g, productTitle);
    }

    // 推监控群（未配 webhook 静默跳过，不影响主流程）
    try {
      await pushToGroup({
        title: "💬 小程序智能客服对话",
        lines: [
          `**场景**: ${scene || "通用"}`,
          `**问**: ${message.trim()}`,
          `**答**: ${reply.slice(0, 800)}`,
          reply.length > 800 ? "_（回复较长，已截断）_" : "",
        ].filter(Boolean),
        level: intent === "hand_over" ? "warn" : "info",
      });
    } catch {
      /* 推群失败不影响回复 */
    }

    return Response.json({
      success: true,
      reply,
      intent,
      scene: scene || "common",
      suggestedProducts: [],
    });
  } catch (e) {
    const err = e instanceof Error ? e.message : String(e);
    console.error("[chat] error:", err);
    return Response.json({ success: false, error: err }, { status: 500 });
  }
}
