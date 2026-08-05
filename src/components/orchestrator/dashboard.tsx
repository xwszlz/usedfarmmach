"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  Play,
  Pause,
  RotateCcw,
  Activity,
  CheckCircle,
  AlertCircle,
  Clock,
  ChevronDown,
  ChevronUp,
  Terminal,
  Zap,
  Server,
  TrendingUp,
  AlertTriangle,
} from "lucide-react";

// ── 类型定义 ──

type RunStatus = "running" | "success" | "failed" | "cancelled" | "timeout";
type AgentStatus = "active" | "paused" | "disabled" | "error";

interface AgentRun {
  id: string;
  status: RunStatus;
  startedAt: string;
  completedAt?: string;
  durationMs?: number;
  errorMessage?: string;
  result?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}

interface AgentItem {
  agentId: string;
  name: string;
  status: AgentStatus;
  version: string;
  triggerType: string;
  schedule?: string;
  lastRunAt?: string;
  nextRunAt?: string;
  lastRunStatus?: RunStatus;
  totalRuns: number;
  successRate: number;
  recentRuns: AgentRun[];
}

interface OrchestratorData {
  ok: boolean;
  timestamp: string;
  agents: AgentItem[];
  summary: {
    total: number;
    active: number;
    paused: number;
    error: number;
    runningNow: number;
  };
}

// ── 状态颜色映射 ──

const statusColors: Record<AgentStatus, string> = {
  active: "bg-green-500",
  paused: "bg-yellow-500",
  disabled: "bg-gray-400",
  error: "bg-red-500",
};

const runStatusColors: Record<RunStatus, string> = {
  running: "text-blue-500",
  success: "text-green-500",
  failed: "text-red-500",
  cancelled: "text-gray-500",
  timeout: "text-orange-500",
};

const runStatusBg: Record<RunStatus, string> = {
  running: "bg-blue-50 border-blue-200",
  success: "bg-green-50 border-green-200",
  failed: "bg-red-50 border-red-200",
  cancelled: "bg-gray-50 border-gray-200",
  timeout: "bg-orange-50 border-orange-200",
};

const runStatusIcons: Record<RunStatus, React.ReactNode> = {
  running: <Activity className="w-4 h-4 animate-pulse" />,
  success: <CheckCircle className="w-4 h-4" />,
  failed: <AlertCircle className="w-4 h-4" />,
  cancelled: <AlertTriangle className="w-4 h-4" />,
  timeout: <Clock className="w-4 h-4" />,
};

// ── 主组件 ──

export function OrchestratorDashboard() {
  const [data, setData] = useState<OrchestratorData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedAgent, setExpandedAgent] = useState<string | null>(null);
  const [triggeringAgent, setTriggeringAgent] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      setRefreshing(true);
      const res = await fetch("/api/agents/orchestrator?history=true&limit=10", {
        cache: "no-store",
        credentials: "include",
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setData(json);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const timer = setInterval(fetchData, 30000); // 30 秒自动刷新
    return () => clearInterval(timer);
  }, [fetchData]);

  const triggerAgent = async (agentId: string) => {
    setTriggeringAgent(agentId);
    try {
      const res = await fetch("/api/agents/orchestrator", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ action: "trigger", agentId }),
      });
      const result = await res.json();
      if (!result.ok) {
        const errMsg = result.error || result.message || "未知错误";
        alert(`❌ 触发失败：${errMsg}\n\n查看 dashboard 展开详情可看到完整结果。`);
      } else {
        const msg = result.message || `Agent ${agentId} 触发成功`;
        const workflowUrl = result.result?.workflowUrl as string | undefined;
        const guide = result.result?.guide as string | undefined;
        let alertText = `✅ ${msg}`;
        if (workflowUrl) {
          alertText += `\n\n查看运行进度：\n${workflowUrl}`;
        }
        if (guide) {
          alertText += `\n\n⚙️ ${guide}`;
        }
        alert(alertText);
        fetchData(); // 刷新状态
      }
    } catch (err) {
      alert(`触发异常: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setTriggeringAgent(null);
    }
  };

  const toggleAgent = async (agentId: string, action: "pause" | "resume" | "disable") => {
    try {
      const res = await fetch("/api/agents/orchestrator", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ action, agentId }),
      });
      const result = await res.json();
      if (result.ok) {
        fetchData();
      } else {
        alert(`操作失败: ${result.error}`);
      }
    } catch (err) {
      alert(`操作异常: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="flex flex-col items-center gap-4">
          <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-gray-500">加载调度者状态...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <p className="text-red-600 font-medium">加载失败</p>
          <p className="text-gray-500 text-sm mt-2">
            {error.includes("401")
              ? "登录状态已失效或未登录，请重新登录后再访问"
              : error}
          </p>
          <div className="mt-4 flex gap-2 justify-center">
            <button
              onClick={fetchData}
              className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
            >
              重试
            </button>
            {error.includes("401") && (
              <a
                href="/zh/auth/login?redirect=/zh/admin/orchestrator"
                className="px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
              >
                重新登录
              </a>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (!data) return null;

  const { summary, agents } = data;

  return (
    <div className="space-y-6">
      {/* 头部标题 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Zap className="w-6 h-6 text-blue-500" />
            #0 调度者 Agent
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            智能体群协同控制中心 · {agents.length} 个 Agent 已注册
          </p>
        </div>
        <button
          onClick={fetchData}
          disabled={refreshing}
          className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-lg text-sm hover:bg-gray-50 disabled:opacity-50"
        >
          <RotateCcw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} />
          {refreshing ? "刷新中..." : "刷新"}
        </button>
      </div>

      {/* 状态摘要卡片 */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <SummaryCard
          icon={<Server className="w-5 h-5 text-blue-500" />}
          label="总 Agent"
          value={summary.total}
          color="blue"
        />
        <SummaryCard
          icon={<CheckCircle className="w-5 h-5 text-green-500" />}
          label="活跃"
          value={summary.active}
          color="green"
        />
        <SummaryCard
          icon={<Pause className="w-5 h-5 text-yellow-500" />}
          label="暂停"
          value={summary.paused}
          color="yellow"
        />
        <SummaryCard
          icon={<AlertCircle className="w-5 h-5 text-red-500" />}
          label="异常"
          value={summary.error}
          color="red"
        />
        <SummaryCard
          icon={<Activity className="w-5 h-5 text-blue-500 animate-pulse" />}
          label="运行中"
          value={summary.runningNow}
          color="blue"
        />
      </div>

      {/* Agent 列表 */}
      <div className="space-y-4">
        {agents.map((agent) => (
          <div
            key={agent.agentId}
            className="border rounded-xl bg-white shadow-sm overflow-hidden"
          >
            {/* Agent 头部信息 */}
            <div className="p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`w-3 h-3 rounded-full ${statusColors[agent.status]}`} />
                <div>
                  <h3 className="font-semibold text-gray-900">{agent.name}</h3>
                  <p className="text-xs text-gray-500">
                    {agent.agentId} · v{agent.version} · {agent.triggerType}
                    {agent.schedule && ` · ${agent.schedule}`}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                {/* 成功率 */}
                <div className="text-right hidden sm:block">
                  <div className="text-sm font-medium text-gray-700">
                    {agent.successRate}%
                  </div>
                  <div className="text-xs text-gray-400">
                    {agent.totalRuns} 次运行
                  </div>
                </div>

                {/* 操作按钮 */}
                <div className="flex items-center gap-2">
                  {agent.status === "active" && (
                    <button
                      onClick={() => triggerAgent(agent.agentId)}
                      disabled={triggeringAgent === agent.agentId}
                      className="flex items-center gap-1 px-3 py-1.5 bg-green-500 text-white text-sm rounded-lg hover:bg-green-600 disabled:opacity-50"
                    >
                      <Play className="w-3 h-3" />
                      {triggeringAgent === agent.agentId ? "触发中..." : "运行"}
                    </button>
                  )}

                  {agent.status === "active" ? (
                    <button
                      onClick={() => toggleAgent(agent.agentId, "pause")}
                      className="p-1.5 text-gray-500 hover:text-yellow-600 hover:bg-yellow-50 rounded"
                      title="暂停"
                    >
                      <Pause className="w-4 h-4" />
                    </button>
                  ) : agent.status === "paused" ? (
                    <button
                      onClick={() => toggleAgent(agent.agentId, "resume")}
                      className="p-1.5 text-gray-500 hover:text-green-600 hover:bg-green-50 rounded"
                      title="恢复"
                    >
                      <Play className="w-4 h-4" />
                    </button>
                  ) : null}

                  <button
                    onClick={() => toggleAgent(agent.agentId, "disable")}
                    className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded"
                    title="禁用"
                  >
                    <AlertTriangle className="w-4 h-4" />
                  </button>

                  <button
                    onClick={() =>
                      setExpandedAgent(
                        expandedAgent === agent.agentId ? null : agent.agentId
                      )
                    }
                    className="p-1.5 text-gray-400 hover:text-gray-600"
                  >
                    {expandedAgent === agent.agentId ? (
                      <ChevronUp className="w-4 h-4" />
                    ) : (
                      <ChevronDown className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>
            </div>

            {/* 最近运行状态条 */}
            <div className="px-4 pb-3">
              <div className="flex items-center gap-1.5">
                {agent.recentRuns.slice(0, 10).map((run) => (
                  <div
                    key={run.id}
                    className={`w-3 h-3 rounded-full ${
                      run.status === "success"
                        ? "bg-green-400"
                        : run.status === "running"
                        ? "bg-blue-400 animate-pulse"
                        : run.status === "failed"
                        ? "bg-red-400"
                        : "bg-gray-300"
                    }`}
                    title={`${run.status} · ${new Date(run.startedAt).toLocaleString()}`}
                  />
                ))}
                {agent.recentRuns.length === 0 && (
                  <span className="text-xs text-gray-400">暂无运行记录</span>
                )}
              </div>
            </div>

            {/* 展开详情 */}
            {expandedAgent === agent.agentId && (
              <div className="border-t px-4 py-4 bg-gray-50 space-y-3">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                  <div>
                    <span className="text-gray-500">最后运行：</span>
                    <span className="text-gray-900">
                      {agent.lastRunAt
                        ? new Date(agent.lastRunAt).toLocaleString()
                        : "从未"}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-500">下次运行：</span>
                    <span className="text-gray-900">
                      {agent.nextRunAt
                        ? new Date(agent.nextRunAt).toLocaleString()
                        : "手动触发"}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-500">上次状态：</span>
                    <span className={runStatusColors[agent.lastRunStatus || "cancelled"]}>
                      {agent.lastRunStatus || "无"}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-500">总运行：</span>
                    <span className="text-gray-900">{agent.totalRuns} 次</span>
                  </div>
                </div>

                {/* 最近运行记录 */}
                {agent.recentRuns.length > 0 && (
                  <div className="mt-3">
                    <h4 className="text-sm font-medium text-gray-700 mb-2 flex items-center gap-1">
                      <Terminal className="w-4 h-4" />
                      最近运行记录
                    </h4>
                    <div className="space-y-2">
                      {agent.recentRuns.slice(0, 5).map((run) => (
                        <div
                          key={run.id}
                          className={`p-2 rounded-lg border text-sm ${runStatusBg[run.status]}`}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              {runStatusIcons[run.status]}
                              <span className={runStatusColors[run.status]}>
                                {run.status}
                              </span>
                              <span className="text-gray-500">
                                {new Date(run.startedAt).toLocaleString()}
                              </span>
                            </div>
                            <div className="text-gray-500">
                              {run.durationMs
                                ? `${(run.durationMs / 1000).toFixed(1)}s`
                                : "-"}
                            </div>
                          </div>

                          {/* 结果详情（折叠） */}
                          {(run.result || run.errorMessage) && (
                            <details className="mt-2 text-xs">
                              <summary className="cursor-pointer text-gray-500 hover:text-gray-700">
                                {run.result ? "查看运行结果" : "查看错误详情"}
                              </summary>
                              <div className="mt-2 p-2 bg-white border border-gray-200 rounded font-mono text-xs whitespace-pre-wrap break-all">
                                {run.errorMessage ? (
                                  <span className="text-red-600">{run.errorMessage}</span>
                                ) : run.result ? (
                                  <pre className="text-gray-700">
                                    {JSON.stringify(run.result, null, 2)}
                                  </pre>
                                ) : null}
                              </div>
                            </details>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* 底部时间戳 */}
      <div className="text-center text-xs text-gray-400 py-4">
        数据更新时间：{new Date(data.timestamp).toLocaleString()} · 每 30 秒自动刷新
      </div>
    </div>
  );
}

// ── 摘要卡片 ──

function SummaryCard({
  icon,
  label,
  value,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  color: string;
}) {
  const colorMap: Record<string, string> = {
    blue: "bg-blue-50 border-blue-100",
    green: "bg-green-50 border-green-100",
    yellow: "bg-yellow-50 border-yellow-100",
    red: "bg-red-50 border-red-100",
  };

  return (
    <div className={`p-4 rounded-xl border ${colorMap[color] || "bg-gray-50"}`}>
      <div className="flex items-center gap-2 mb-2">
        {icon}
        <span className="text-sm text-gray-600">{label}</span>
      </div>
      <div className="text-2xl font-bold text-gray-900">{value}</div>
    </div>
  );
}
