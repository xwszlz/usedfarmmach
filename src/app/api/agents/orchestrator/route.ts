// ═══════════════════════════════════════════════════════
// #0 调度者 Agent — API 路由
// GET   /api/agents/orchestrator         查询所有 Agent 状态
// POST  /api/agents/orchestrator         手动触发指定 Agent
// GET   /api/agents/orchestrator/health  健康检查
// GET   /api/agents/orchestrator/logs    查询运行日志（?agentId=xxx&limit=20）
// ═══════════════════════════════════════════════════════

import { NextRequest, NextResponse } from "next/server";
import {
  initAgentRegistry,
  getAgentStatus,
  triggerAgent,
  checkHealth,
  getRunLogs,
  updateAgentStatus,
} from "@/lib/agents/orchestrator/agent";

export const dynamic = "force-dynamic";

// ── 简单认证检查 ──
function checkAuth(req: NextRequest): NextResponse | null {
  const apiKey = process.env.CRON_API_KEY || "dev-secret-key";
  const auth = req.headers.get("Authorization");
  if (process.env.NODE_ENV === "production") {
    if (!auth || !auth.startsWith("Bearer ") || auth.substring(7) !== apiKey) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }
  }
  return null;
}

// ── GET：查询状态 ──

export async function GET(request: NextRequest) {
  try {
    // 确保注册表已初始化
    await initAgentRegistry();

    const { searchParams } = new URL(request.url);
    const action = searchParams.get("action") || "status";

    if (action === "health") {
      const result = await checkHealth({ checkAll: true });
      return NextResponse.json(result, { status: result.ok ? 200 : 503 });
    }

    if (action === "logs") {
      const agentId = searchParams.get("agentId");
      if (!agentId) {
        return NextResponse.json({ ok: false, error: "Missing agentId" }, { status: 400 });
      }
      const limit = Math.min(parseInt(searchParams.get("limit") || "20", 10), 100);
      const offset = parseInt(searchParams.get("offset") || "0", 10);
      const logs = await getRunLogs(agentId, limit, offset);
      return NextResponse.json({ ok: true, agentId, logs, count: logs.length });
    }

    // 默认返回状态
    const agentId = searchParams.get("agentId") || undefined;
    const includeHistory = searchParams.get("history") !== "false";
    const historyLimit = parseInt(searchParams.get("limit") || "10", 10);

    const result = await getAgentStatus({
      agentId,
      includeHistory,
      historyLimit,
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error("[Orchestrator] GET error:", error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Internal error" },
      { status: 500 }
    );
  }
}

// ── POST：触发 Agent / 更新状态 ──

export async function POST(request: NextRequest) {
  const authFail = checkAuth(request);
  if (authFail) return authFail;

  try {
    await initAgentRegistry();

    const body = await request.json();
    const { action } = body;

    if (action === "trigger") {
      const { agentId, params, triggeredBy } = body;
      if (!agentId) {
        return NextResponse.json({ ok: false, error: "Missing agentId" }, { status: 400 });
      }

      const result = await triggerAgent({ agentId, params, triggeredBy });
      return NextResponse.json(result, { status: result.ok ? 200 : 500 });
    }

    if (action === "pause" || action === "resume" || action === "disable") {
      const { agentId } = body;
      if (!agentId) {
        return NextResponse.json({ ok: false, error: "Missing agentId" }, { status: 400 });
      }
      const statusMap: Record<string, string> = {
        pause: "paused",
        resume: "active",
        disable: "disabled",
      };
      await updateAgentStatus(agentId, statusMap[action] as any);
      return NextResponse.json({ ok: true, agentId, status: statusMap[action], message: `Agent ${agentId} is now ${statusMap[action]}` });
    }

    return NextResponse.json({ ok: false, error: "Unknown action" }, { status: 400 });
  } catch (error) {
    console.error("[Orchestrator] POST error:", error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Internal error" },
      { status: 500 }
    );
  }
}
