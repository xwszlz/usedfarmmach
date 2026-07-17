// ───────────────────────────────────────────────
// API: POST /api/agents/buyer-chat  —  发送消息
//       GET  /api/agents/buyer-chat  —  加载会话历史
// ───────────────────────────────────────────────

import { NextResponse } from "next/server";
import { z } from "zod";
import { buyerChatAgent } from "@/lib/agents/buyer-chat/agent";
import { ChatLocale } from "@/lib/agents/buyer-chat/types";

const chatInputSchema = z.object({
  sessionId: z.string().optional(),
  visitorId: z.string().min(1),
  productId: z.string().optional(),
  locale: z.enum(["zh", "en", "ru", "es", "pt", "ar", "fr", "hi"]).default("en"),
  content: z.string().min(1).max(2000),
  dryRun: z.boolean().optional(),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = chatInputSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid input", details: parsed.error.format() }, { status: 400 });
    }

    const result = await buyerChatAgent.run(parsed.data);
    return NextResponse.json(result, { status: result.success ? 200 : 500 });
  } catch (e) {
    const err = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ success: false, error: err }, { status: 500 });
  }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get("sessionId");
    const visitorId = searchParams.get("visitorId");
    const productId = searchParams.get("productId") || undefined;

    if (sessionId) {
      const history = await buyerChatAgent.getHistory(sessionId);
      return NextResponse.json({ success: true, sessionId, history });
    }

    if (visitorId) {
      // 传入 productId，确保只加载该产品的会话，避免跨产品上下文污染
      const sessions = await buyerChatAgent.listSessions(visitorId, productId);
      return NextResponse.json({ success: true, visitorId, sessions });
    }

    return NextResponse.json({ error: "Missing sessionId or visitorId" }, { status: 400 });
  } catch (e) {
    const err = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ success: false, error: err }, { status: 500 });
  }
}
