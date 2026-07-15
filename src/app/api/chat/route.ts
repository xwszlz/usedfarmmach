// ───────────────────────────────────────────────
// 小程序「智能客服」公开接口
//  POST /api/chat  { message, sessionId?, productId? }
//   → 调 BuyerChatAgent 生成回复，可选推监控群
//   → 不需要企微回调密钥，匿名可用；WECOM_GROUP_WEBHOOK_URL 未配则静默跳过推群
// ───────────────────────────────────────────────
import { buyerChatAgent } from "@/lib/agents/buyer-chat/agent";
import { pushToGroup } from "@/lib/wecom/group-webhook";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json({
    ok: true,
    service: "buyer-chat",
    note: "POST /api/chat with { message, sessionId?, productId? }",
  });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const message: string | undefined = body?.message;
    const sessionId: string | undefined = body?.sessionId;
    const productId: string | undefined = body?.productId;

    if (!message || typeof message !== "string" || !message.trim()) {
      return Response.json({ success: false, error: "message is required" }, { status: 400 });
    }

    const result = await buyerChatAgent.run({
      visitorId: `miniapp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      productId: productId || undefined,
      locale: "zh",
      content: message.trim(),
      sessionId: sessionId || undefined,
    });

    if (!result.success || !result.message) {
      return Response.json(
        { success: false, error: result.error || "ai service failed" },
        { status: 500 }
      );
    }

    const reply = result.message.content;
    const intent = result.message.intent;

    // 推监控群（未配 webhook 静默跳过，不影响主流程）
    try {
      await pushToGroup({
        title: "💬 小程序智能客服对话",
        lines: [
          `**问**: ${message.trim()}`,
          `**AI答**: ${reply.slice(0, 800)}`,
          reply.length > 800 ? "_（回复较长，已截断）_" : "",
        ].filter(Boolean),
        level: intent === "hand_over" ? "warn" : "info",
      });
    } catch {
      /* 推群失败不影响回复 */
    }

    return Response.json({
      success: true,
      sessionId: result.sessionId,
      reply,
      intent,
      suggestedProducts: result.message.suggestedProducts || [],
    });
  } catch (e) {
    const err = e instanceof Error ? e.message : String(e);
    console.error("[chat] error:", err);
    return Response.json({ success: false, error: err }, { status: 500 });
  }
}
