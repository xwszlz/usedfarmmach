// ═══════════════════════════════════════════════════════
// #0 调度者 Agent — 类型定义
// 职责：统筹协调所有 Agent 的运行、监控、报警
// ═══════════════════════════════════════════════════════

export type AgentStatus = "active" | "paused" | "disabled" | "error";
export type RunStatus = "running" | "success" | "failed" | "cancelled" | "timeout";
export type TriggerType = "manual" | "cron" | "webhook" | "dependency";

export interface AgentDefinition {
  id: string;
  agentId: string;
  name: string;
  description?: string | null;
  version: string;
  triggerType: TriggerType;
  schedule?: string | null;
  endpoint?: string | null;
  dependencies?: string[] | null;
  status: AgentStatus;
  lastRunAt?: Date | null;
  nextRunAt?: Date | null;
  config?: Record<string, unknown> | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface AgentRunLog {
  id: string;
  agentId: string;
  triggeredBy: TriggerType | string;
  status: RunStatus;
  startedAt: Date;
  completedAt?: Date | null;
  durationMs?: number | null;
  result?: Record<string, unknown> | null;
  errorMessage?: string | null;
  metadata?: Record<string, unknown> | null;
}

// ── 调度器输入输出 ──

export interface OrchestratorStatusInput {
  agentId?: string; // 指定查询某个 Agent，空则查询全部
  includeHistory?: boolean; // 是否包含最近运行记录
  historyLimit?: number; // 历史记录条数（默认 10）
}

export interface OrchestratorTriggerInput {
  agentId: string; // 要触发的 Agent ID
  params?: Record<string, unknown>; // 传递给 Agent 的参数
  triggeredBy?: TriggerType | string; // 默认 manual，cron 调用可写 cron
}

export interface OrchestratorHealthInput {
  checkAll?: boolean; // 是否检查所有 Agent 健康度
  agentIds?: string[]; // 指定检查的 Agent
}

// ── 输出类型 ──

export interface AgentStatusOutput {
  agentId: string;
  name: string;
  status: AgentStatus;
  version: string;
  triggerType: TriggerType;
  schedule?: string;
  lastRunAt?: string;
  nextRunAt?: string;
  lastRunStatus?: RunStatus;
  totalRuns: number;
  successRate: number; // 0-100
  recentRuns: Array<{
    id: string;
    status: RunStatus;
    startedAt: string;
    completedAt?: string;
    durationMs?: number;
    errorMessage?: string;
    result?: Record<string, unknown>;
    metadata?: Record<string, unknown>;
  }>;
}

export interface OrchestratorStatusOutput {
  ok: boolean;
  timestamp: string;
  agents: AgentStatusOutput[];
  summary: {
    total: number;
    active: number;
    paused: number;
    error: number;
    runningNow: number;
  };
}

export interface OrchestratorTriggerOutput {
  ok: boolean;
  agentId: string;
  runId: string;
  status: RunStatus;
  startedAt: string;
  message: string;
  result?: Record<string, unknown>;
  error?: string;
}

export interface OrchestratorHealthOutput {
  ok: boolean;
  timestamp: string;
  overall: "healthy" | "warning" | "critical";
  agents: Array<{
    agentId: string;
    name: string;
    status: AgentStatus;
    health: "healthy" | "warning" | "critical";
    lastRunAt?: string;
    lastRunStatus?: RunStatus;
    message?: string;
  }>;
}

// ── 内置 Agent 注册表（静态配置，与 DB 同步） ──

export const BUILT_IN_AGENTS: Array<{
  agentId: string;
  name: string;
  description: string;
  version: string;
  triggerType: TriggerType;
  schedule?: string;
  endpoint?: string;
  dependencies?: string[];
}> = [
  {
    agentId: "seller-scout",
    name: "#1 卖方采集",
    description: "从国内外二手农机网站采集产品列表数据（Agriaffaires + 国内全平台）",
    version: "1.0.0",
    triggerType: "cron",
    schedule: "0 6 * * *", // 每天 06:00 UTC+8
    endpoint: "/api/agents/seller-scout",
  },
  {
    agentId: "price-intel",
    name: "#3 国际价格采集",
    description: "从国际网站采集二手农机价格，更新套利数据",
    version: "0.1.0",
    triggerType: "cron",
    schedule: "0 7 * * 1", // 每周一 07:00 UTC+8
    endpoint: "/api/cron/update-prices",
    dependencies: ["seller-scout"], // 价格采集依赖卖方数据
  },
  {
    agentId: "buyer-chat",
    name: "#7 多语客服",
    description: "8语AI客服，支持产品咨询、套利推荐、操作手册",
    version: "0.2.0",
    triggerType: "manual", // 被动响应，不需要定时
    endpoint: "/api/agents/buyer-chat",
  },
  {
    agentId: "seller-helper",
    name: "#8 卖家助手",
    description: "AI拍照识别农机品牌/型号/年份，一键填充表单",
    version: "0.1.0",
    triggerType: "manual", // 被动响应
    endpoint: "/api/agents/seller-helper/recognize",
  },
  {
    agentId: "export-compliance",
    name: "#10 出口合规",
    description: "品牌知识产权核查、目标国认证匹配、出口全链条成本计算、报关单据模板、估值联动推荐最优出口国",
    version: "0.1.0",
    triggerType: "manual", // 按需触发
    endpoint: "/api/agents/export-compliance",
    dependencies: ["price-intel"], // 依赖价格数据做利润分析
  },
  {
    agentId: "buyer-match",
    name: "#2 买家匹配",
    description: "买家需求与产品库智能匹配，按匹配度排序推荐",
    version: "0.1.0",
    triggerType: "manual",
    endpoint: "/api/agents/buyer-match",
  },
  {
    agentId: "arbitrage-analyzer",
    name: "#4 套利分析",
    description: "国内外价差分析，计算套利空间，按利润率排序推荐",
    version: "0.1.0",
    triggerType: "manual",
    endpoint: "/api/agents/arbitrage-analyzer",
    dependencies: ["price-intel", "export-compliance"],
  },
  {
    agentId: "content-engine",
    name: "#5 内容引擎",
    description: "8语SEO内容自动生成：产品描述、meta标签、分类落地页",
    version: "0.1.0",
    triggerType: "manual",
    endpoint: "/api/agents/content-engine",
  },
  {
    agentId: "data-dashboard",
    name: "#6 数据看板",
    description: "平台运营数据聚合：用户/产品/询价/收入统计，增长趋势，转化漏斗",
    version: "0.1.0",
    triggerType: "manual",
    endpoint: "/api/agents/data-dashboard",
  },
  {
    agentId: "risk-control",
    name: "#9 风控合规",
    description: "违规listing检测、异常用户行为、PII访问审计、合规检查清单",
    version: "0.1.0",
    triggerType: "manual",
    endpoint: "/api/agents/risk-control",
  },
];
