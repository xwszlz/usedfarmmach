// ═══════════════════════════════════════════════════════
// #0 调度者 Agent — 核心引擎
// 职责：Agent 注册、状态监控、手动触发、健康检查
// ═══════════════════════════════════════════════════════

import { prisma } from "@/lib/db";
import {
  BUILT_IN_AGENTS,
  type AgentDefinition,
  type AgentRunLog,
  type AgentStatus,
  type RunStatus,
  type OrchestratorStatusInput,
  type OrchestratorStatusOutput,
  type OrchestratorTriggerInput,
  type OrchestratorTriggerOutput,
  type OrchestratorHealthInput,
  type OrchestratorHealthOutput,
  type AgentStatusOutput,
  type TriggerType,
} from "./types";
import type { PriceSource } from "@/lib/agents/price-intel/types";

export const ORCHESTRATOR_VERSION = "0.1.0";

// ── 初始化：确保所有内置 Agent 已注册到 DB ──

export async function initAgentRegistry(): Promise<void> {
  for (const agent of BUILT_IN_AGENTS) {
    await prisma.agentDefinition.upsert({
      where: { agentId: agent.agentId },
      update: {
        name: agent.name,
        description: agent.description,
        version: agent.version,
        triggerType: agent.triggerType,
        schedule: agent.schedule,
        endpoint: agent.endpoint,
        dependencies: agent.dependencies ? JSON.stringify(agent.dependencies) : null,
      },
      create: {
        agentId: agent.agentId,
        name: agent.name,
        description: agent.description,
        version: agent.version,
        triggerType: agent.triggerType,
        schedule: agent.schedule,
        endpoint: agent.endpoint,
        dependencies: agent.dependencies ? JSON.stringify(agent.dependencies) : null,
        status: "active",
      },
    });
  }
  console.log("[Orchestrator] Agent registry initialized:", BUILT_IN_AGENTS.length, "agents");
}

// ── 查询所有 Agent 状态 ──

export async function getAgentStatus(
  input: OrchestratorStatusInput = {}
): Promise<OrchestratorStatusOutput> {
  const { agentId, includeHistory = true, historyLimit = 10 } = input;

  const where = agentId ? { agentId } : {};

  const agents = await prisma.agentDefinition.findMany({
    where,
    orderBy: { agentId: "asc" },
  });

  const agentOutputs: AgentStatusOutput[] = [];

  for (const agent of agents) {
    // 查询最近运行记录
    const recentRuns = includeHistory
      ? await prisma.agentRunLog.findMany({
          where: { agentId: agent.agentId },
          orderBy: { startedAt: "desc" },
          take: historyLimit,
        })
      : [];

    // 统计
    const totalRuns = await prisma.agentRunLog.count({
      where: { agentId: agent.agentId },
    });
    const successRuns = await prisma.agentRunLog.count({
      where: { agentId: agent.agentId, status: "success" },
    });
    const successRate = totalRuns > 0 ? Math.round((successRuns / totalRuns) * 100) : 0;

    // 当前是否运行中
    const runningNow = await prisma.agentRunLog.findFirst({
      where: { agentId: agent.agentId, status: "running" },
    });

    const deps = agent.dependencies ? JSON.parse(agent.dependencies) as string[] : undefined;

    agentOutputs.push({
      agentId: agent.agentId,
      name: agent.name,
      status: agent.status as AgentStatus,
      version: agent.version,
      triggerType: agent.triggerType as TriggerType,
      schedule: agent.schedule || undefined,
      lastRunAt: agent.lastRunAt ? agent.lastRunAt.toISOString() : undefined,
      nextRunAt: agent.nextRunAt ? agent.nextRunAt.toISOString() : undefined,
      lastRunStatus: recentRuns[0]?.status as RunStatus,
      totalRuns,
      successRate,
      recentRuns: recentRuns.map((run) => {
        let parsedResult: Record<string, unknown> | undefined;
        if (run.result) {
          try {
            parsedResult = JSON.parse(run.result);
          } catch {
            // ignore
          }
        }
        let parsedMeta: Record<string, unknown> | undefined;
        if (run.metadata) {
          try {
            parsedMeta = JSON.parse(run.metadata);
          } catch {
            // ignore
          }
        }
        return {
          id: run.id,
          status: run.status as RunStatus,
          startedAt: run.startedAt.toISOString(),
          completedAt: run.completedAt?.toISOString(),
          durationMs: run.durationMs || undefined,
          errorMessage: run.errorMessage || undefined,
          result: parsedResult,
          metadata: parsedMeta,
        };
      }),
    });
  }

  const runningNowCount = agentOutputs.filter(
    (a) => a.recentRuns.length > 0 && a.recentRuns[0].status === "running"
  ).length;

  return {
    ok: true,
    timestamp: new Date().toISOString(),
    agents: agentOutputs,
    summary: {
      total: agentOutputs.length,
      active: agentOutputs.filter((a) => a.status === "active").length,
      paused: agentOutputs.filter((a) => a.status === "paused").length,
      error: agentOutputs.filter((a) => a.status === "error").length,
      runningNow: runningNowCount,
    },
  };
}

// ── 触发 Agent 执行 ──

export async function triggerAgent(
  input: OrchestratorTriggerInput
): Promise<OrchestratorTriggerOutput> {
  const { agentId, params = {}, triggeredBy = "manual" } = input;

  const agent = await prisma.agentDefinition.findUnique({
    where: { agentId },
  });

  if (!agent) {
    return { ok: false, agentId, runId: "", status: "failed", startedAt: new Date().toISOString(), message: "Agent not found", error: `Agent ${agentId} not found in registry` };
  }

  if (agent.status === "disabled") {
    return { ok: false, agentId, runId: "", status: "failed", startedAt: new Date().toISOString(), message: "Agent is disabled", error: `Agent ${agentId} is disabled` };
  }

  // 检查是否已有运行中
  const running = await prisma.agentRunLog.findFirst({
    where: { agentId, status: "running" },
  });

  if (running) {
    return { ok: false, agentId, runId: running.id, status: "running", startedAt: running.startedAt.toISOString(), message: "Agent is already running", error: `Agent ${agentId} has a running job since ${running.startedAt.toISOString()}` };
  }

  // 创建运行记录
  const runLog = await prisma.agentRunLog.create({
    data: {
      agentId,
      triggeredBy: triggeredBy as string,
      status: "running",
      metadata: JSON.stringify({ params, source: "orchestrator" }),
    },
  });

  const startTime = Date.now();
  let result: Record<string, unknown> = {};
  let errorMsg: string | null = null;
  let finalStatus: RunStatus = "success";

  try {
    // 根据 Agent 类型调用对应的执行逻辑
    result = await executeAgent(agentId, params);

    // 更新 Agent 最后运行时间
    await prisma.agentDefinition.update({
      where: { agentId },
      data: { lastRunAt: new Date() },
    });
  } catch (err) {
    errorMsg = err instanceof Error ? err.message : String(err);
    finalStatus = "failed";
    console.error(`[Orchestrator] Agent ${agentId} execution failed:`, errorMsg);
  }

  // 更新运行记录
  const durationMs = Date.now() - startTime;
  await prisma.agentRunLog.update({
    where: { id: runLog.id },
    data: {
      status: finalStatus,
      completedAt: new Date(),
      durationMs,
      result: result ? JSON.stringify(result) : null,
      errorMessage: errorMsg,
    },
  });

  return {
    ok: finalStatus === "success",
    agentId,
    runId: runLog.id,
    status: finalStatus,
    startedAt: runLog.startedAt.toISOString(),
    message: finalStatus === "success" ? `Agent ${agentId} completed in ${durationMs}ms` : `Agent ${agentId} failed: ${errorMsg}`,
    result: finalStatus === "success" ? result : undefined,
    error: errorMsg || undefined,
  };
}

// ── 执行具体 Agent 的内联逻辑 ──

async function executeAgent(
  agentId: string,
  params: Record<string, unknown>
): Promise<Record<string, unknown>> {
  switch (agentId) {
    case "price-intel": {
      // 调用 #3 价格采集 Agent 的 API
      const { priceIntelAgent } = await import("@/lib/agents/price-intel/agent");
      const result = await priceIntelAgent.run({
        sources: (params.sources as string[])?.filter((s): s is PriceSource =>
          ["snapshot", "brief", "daily_md", "manual"].includes(s)
        ) || undefined,
        maxFilesPerSource: (params.maxFilesPerSource as number) || 3,
        force: !!params.force,
        dryRun: !!params.dryRun,
        targetDate: (params.targetDate as string) || undefined,
      });
      return {
        totalCollected: result.totalCollected,
        totalImported: result.totalImported,
        totalUpdated: result.totalUpdated,
        totalSkipped: result.totalSkipped,
        ok: result.ok,
      };
    }

    case "buyer-chat": {
      // #7 是被动响应型，不能主动触发完整运行
      // 返回健康状态即可
      return { mode: "passive", message: "Buyer-chat is a passive agent, triggered per message" };
    }

    case "seller-helper": {
      // #8 也是被动响应型
      return { mode: "passive", message: "Seller-helper is a passive agent, triggered per upload" };
    }

    case "export-compliance": {
      // #10 出口合规 Agent
      const { exportComplianceAgent } = await import("@/lib/agents/export-compliance/agent");
      const result = await exportComplianceAgent.run({
        productId: (params.productId as string) || undefined,
        brandId: (params.brandId as string) || undefined,
        brandName: (params.brandName as string) || undefined,
        modelName: (params.modelName as string) || undefined,
        purchasePriceCny: (params.purchasePriceCny as number) || undefined,
        year: (params.year as number) || undefined,
        category: (params.category as string) || undefined,
        targetCountries: (params.targetCountries as string[]) || undefined,
        dryRun: !!params.dryRun,
      });
      return {
        ok: result.ok,
        ipCheck: result.ipCheck ? { brandName: result.ipCheck.brandName, safeCountries: result.ipCheck.exportSafety.filter((s) => s.isSafe).map((s) => s.countryCode) } : null,
        certMatchCount: result.certificationMatch.length,
        costBreakdownCount: result.costBreakdown.length,
        documentCount: result.documentTemplates.length,
        bestChoice: result.valuationLink?.bestChoice || null,
        durationMs: result.durationMs,
      };
    }

    case "seller-scout": {
      // #1 本地直接执行采集 + 导入（不再走 GitHub Actions 中转）
      const mode = (params.mode as string) || "all";
      const dryRun = !!params.dryRun;

      // 构建 baseUrl：NEXTAUTH_URL > VERCEL_URL > localhost
      let baseUrl = process.env.NEXTAUTH_URL;
      if (!baseUrl && process.env.VERCEL_URL) {
        baseUrl = `https://${process.env.VERCEL_URL}`;
      }
      if (!baseUrl) baseUrl = "http://localhost:3000";

      try {
        const apiKey = process.env.CRON_API_KEY || "dev-secret-key";
        const resp = await fetch(`${baseUrl}/api/agents/seller-scout`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({ mode, dryRun }),
        });
        const data = await resp.json();
        return {
          mode: "direct-execution",
          ok: data.ok,
          summary: data.summary,
          log: data.log || [],
          durationMs: data.durationMs,
          message: dryRun
            ? "DryRun 模式，仅采集不导入"
            : `采集完成：国内 ${data.summary?.domesticCount || 0} 条 / 国际 ${data.summary?.intlCount || 0} 条，已导入数据库`,
        };
      } catch (err: any) {
        return {
          mode: "direct-execution",
          ok: false,
          error: `本地执行失败: ${err.message}`,
          message: "请检查 /api/agents/seller-scout 路由是否正常，或 Python 脚本路径是否正确",
        };
      }
    }

    case "buyer-match": {
      const { buyerMatchAgent } = await import("@/lib/agents/buyer-match/agent");
      const result = await buyerMatchAgent.run({
        brandId: (params.brandId as string) || undefined,
        brandName: (params.brandName as string) || undefined,
        modelName: (params.modelName as string) || undefined,
        budgetMin: (params.budgetMin as number) || undefined,
        budgetMax: (params.budgetMax as number) || undefined,
        country: (params.country as string) || undefined,
        province: (params.province as string) || undefined,
        limit: (params.limit as number) || 10,
      });
      return { ok: result.ok, totalMatches: result.totalMatches, topMatch: result.matches[0] || null };
    }

    case "arbitrage-analyzer": {
      const { arbitrageAnalyzerAgent } = await import("@/lib/agents/arbitrage-analyzer/agent");
      const result = await arbitrageAnalyzerAgent.run({
        productId: (params.productId as string) || undefined,
        brandId: (params.brandId as string) || undefined,
        targetCountries: (params.targetCountries as string[]) || undefined,
        minMarginPct: (params.minMarginPct as number) || 10,
        limit: (params.limit as number) || 20,
      });
      return { ok: result.ok, totalOpportunities: result.totalOpportunities, summary: result.summary, topOpportunity: result.opportunities[0] || null };
    }

    case "content-engine": {
      const { contentEngineAgent } = await import("@/lib/agents/content-engine/agent");
      const { ContentEngineInputSchema } = await import("@/lib/agents/content-engine/types");
      const parsed = ContentEngineInputSchema.parse({
        productId: (params.productId as string) || undefined,
        brandName: (params.brandName as string) || undefined,
        modelName: (params.modelName as string) || undefined,
        year: (params.year as number) || undefined,
        category: (params.category as string) || undefined,
        languages: (params.languages as string[]) || ["zh", "en"],
        contentType: (params.contentType as string) || "product_description",
      });
      const result = await contentEngineAgent.run(parsed);
      return { ok: result.ok, contentType: result.contentType, generatedCount: result.contents.length, languages: result.contents.map((c) => c.lang) };
    }

    case "data-dashboard": {
      const { dataDashboardAgent } = await import("@/lib/agents/data-dashboard/agent");
      const result = await dataDashboardAgent.run({
        days: (params.days as number) || 30,
        includeRevenue: params.includeRevenue !== false,
        includeUsers: params.includeUsers !== false,
        includeProducts: params.includeProducts !== false,
        includeInquiries: params.includeInquiries !== false,
      });
      return { ok: result.ok, period: result.period, metrics: result.metrics };
    }

    case "risk-control": {
      const { riskControlAgent } = await import("@/lib/agents/risk-control/agent");
      const { RiskControlInputSchema } = await import("@/lib/agents/risk-control/types");
      const parsed = RiskControlInputSchema.parse({
        checkType: (params.checkType as string) || "listing_scan",
        targetProductId: (params.targetProductId as string) || undefined,
        targetUserId: (params.targetUserId as string) || undefined,
        limit: (params.limit as number) || 50,
      });
      const result = await riskControlAgent.run(parsed);
      return { ok: result.ok, checkType: result.checkType, totalFindings: result.totalFindings, summary: result.summary, criticalFindings: result.findings.filter((f) => f.severity === "critical") };
    }

    default:
      throw new Error(`Unknown agent: ${agentId}`);
  }
}

// ── 健康检查 ──

export async function checkHealth(
  input: OrchestratorHealthInput = {}
): Promise<OrchestratorHealthOutput> {
  const { checkAll = true, agentIds } = input;

  const where = !checkAll && agentIds ? { agentId: { in: agentIds } } : {};

  const agents = await prisma.agentDefinition.findMany({ where });

  const agentHealths: OrchestratorHealthOutput["agents"] = [];
  let criticalCount = 0;
  let warningCount = 0;

  for (const agent of agents) {
    // 获取最近一条运行记录
    const lastRun = await prisma.agentRunLog.findFirst({
      where: { agentId: agent.agentId },
      orderBy: { startedAt: "desc" },
    });

    let health: "healthy" | "warning" | "critical" = "healthy";
    let message: string | undefined;

    if (agent.status === "error") {
      health = "critical";
      message = "Agent is in error status";
      criticalCount++;
    } else if (agent.status === "disabled") {
      health = "warning";
      message = "Agent is disabled";
      warningCount++;
    } else if (lastRun) {
      if (lastRun.status === "failed") {
        health = "warning";
        message = `Last run failed: ${lastRun.errorMessage || "unknown error"}`;
        warningCount++;
      } else if (lastRun.status === "running") {
        // 检查是否运行过久（超过 30 分钟）
        const runningMinutes = (Date.now() - lastRun.startedAt.getTime()) / 60000;
        if (runningMinutes > 30) {
          health = "warning";
          message = `Agent has been running for ${Math.round(runningMinutes)} minutes, may be stuck`;
          warningCount++;
        }
      }
    } else if (agent.triggerType === "cron" && !agent.lastRunAt) {
      health = "warning";
      message = "Cron agent has never run";
      warningCount++;
    }

    agentHealths.push({
      agentId: agent.agentId,
      name: agent.name,
      status: agent.status as AgentStatus,
      health,
      lastRunAt: agent.lastRunAt?.toISOString() || undefined,
      lastRunStatus: lastRun?.status as RunStatus || undefined,
      message,
    });
  }

  const overall = criticalCount > 0 ? "critical" : warningCount > 0 ? "warning" : "healthy";

  return {
    ok: overall !== "critical",
    timestamp: new Date().toISOString(),
    overall,
    agents: agentHealths,
  };
}

// ── 更新 Agent 状态 ──

export async function updateAgentStatus(agentId: string, status: AgentStatus): Promise<void> {
  await prisma.agentDefinition.update({
    where: { agentId },
    data: { status },
  });
}

// ── 获取运行日志 ──

export async function getRunLogs(
  agentId: string,
  limit = 50,
  offset = 0
): Promise<AgentRunLog[]> {
  const logs = await prisma.agentRunLog.findMany({
    where: { agentId },
    orderBy: { startedAt: "desc" },
    skip: offset,
    take: limit,
  });

  return logs.map((log) => ({
    id: log.id,
    agentId: log.agentId,
    triggeredBy: log.triggeredBy as TriggerType,
    status: log.status as RunStatus,
    startedAt: log.startedAt,
    completedAt: log.completedAt,
    durationMs: log.durationMs,
    result: log.result ? JSON.parse(log.result) : null,
    errorMessage: log.errorMessage,
    metadata: log.metadata ? JSON.parse(log.metadata) : null,
  }));
}
