/**
 * #1 卖方采集 Agent — 核心执行逻辑
 *
 * 双模式：
 *  - 本地模式（有 Python + scripts/ 目录，如本地开发 / run_seller_scout_v2.bat）：
 *    直接跑 Python 爬虫 + tsx 导入，返回真实条数。
 *  - 云端模式（Vercel serverless，无 Python 环境）：
 *    触发 GitHub Actions workflow（seller-scout.yml，真正跑 Python），
 *    轮询运行直至完成或超时，再回读 RawListing 表统计，返回真实条数。
 *
 * 共享模块：被 /api/agents/seller-scout 和 orchestrator 共同调用，
 * 避免内部 HTTP 调用的稳定性问题。
 */
import { execSync } from "child_process";
import * as path from "path";
import * as fs from "fs";
import { prisma } from "@/lib/db";

export type ScoutMode = "domestic" | "international" | "all";
export type TriggerMode = "local" | "github-actions";

export interface ScoutInput {
  mode?: ScoutMode;
  dryRun?: boolean;
  maxBrands?: number;
  /** 云端模式轮询 GitHub Actions 完成的最大等待毫秒数（默认 90s） */
  awaitMs?: number;
}

export interface ScoutOutput {
  ok: boolean;
  mode: ScoutMode;
  /** 实际执行方式：本地直跑 或 触发 GitHub Actions */
  triggeredVia: TriggerMode;
  startedAt: string;
  finishedAt: string;
  durationMs: number;
  summary: {
    domesticCount: number;
    intlCount: number;
    importsRun: number;
    totalListings: number;
    platforms?: Record<string, number>;
  };
  /** 云端模式：本次触发的工作流运行信息 */
  github?: {
    dispatched: boolean;
    runId?: number;
    runStatus?: string; // queued | in_progress | completed
    runUrl?: string;
    awaited: boolean;
  };
  log: string[];
  error?: string;
}

/** 找到仓库根目录：当前是 /api/agents/seller-scout 或 /lib/agents/seller-scout */
function findRepoRoot(): string {
  let dir = process.cwd();
  for (let i = 0; i < 6; i++) {
    if (fs.existsSync(path.join(dir, "scripts"))) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  const cwd = process.cwd();
  if (path.basename(cwd) === "usedfarmmach") return cwd;
  const subdir = path.join(cwd, "usedfarmmach");
  if (fs.existsSync(subdir)) return subdir;
  return cwd;
}

const EXEC_TIMEOUT_MS = 90000; // 90秒（Python 爬虫超时）

function runPython(scriptPath: string, cwd: string, args: string = ""): { ok: boolean; stdout: string; stderr: string } {
  try {
    const cmd = `python "${scriptPath}" ${args}`;
    const stdout = execSync(cmd, {
      cwd,
      timeout: EXEC_TIMEOUT_MS,
      encoding: "utf-8",
      maxBuffer: 10 * 1024 * 1024,
    });
    return { ok: true, stdout, stderr: "" };
  } catch (err: any) {
    return {
      ok: false,
      stdout: err.stdout || "",
      stderr: (err.stderr || err.message || "").slice(0, 500),
    };
  }
}

function runTsx(scriptPath: string, cwd: string): { ok: boolean; stdout: string; stderr: string } {
  try {
    const cmd = `npx tsx "${scriptPath}"`;
    const stdout = execSync(cmd, {
      cwd,
      timeout: 60000,
      encoding: "utf-8",
      maxBuffer: 10 * 1024 * 1024,
    });
    return { ok: true, stdout, stderr: "" };
  } catch (err: any) {
    return {
      ok: false,
      stdout: err.stdout || "",
      stderr: (err.stderr || err.message || "").slice(0, 500),
    };
  }
}

/**
 * 判断当前环境是否能本地跑 Python（Vercel serverless 无 scripts/ 目录、无 Python）
 */
function canRunLocal(): boolean {
  const repoRoot = findRepoRoot();
  const scriptsDir = path.join(repoRoot, "scripts");
  if (!fs.existsSync(scriptsDir)) return false;
  // 进一步确认爬虫脚本存在
  const hasPy =
    fs.existsSync(path.join(scriptsDir, "scrape_agriaffaires.py")) ||
    fs.existsSync(path.join(scriptsDir, "seller_scout_domestic_scraper.py"));
  return hasPy;
}

/**
 * 回读 RawListing 表统计（云端模式展示真实结果用）
 */
async function getSellerScoutDbStats(): Promise<{
  total: number;
  domestic: number;
  intl: number;
  bySource: Record<string, number>;
  lastScrapedAt: string | null;
}> {
  const [total, bySourceRows, last] = await Promise.all([
    prisma.rawListing.count(),
    prisma.rawListing.groupBy({ by: ["source"], _count: { _all: true } }),
    prisma.rawListing.findFirst({ orderBy: { scrapedAt: "desc" }, select: { scrapedAt: true } }),
  ]);
  let domestic = 0;
  let intl = 0;
  const bySource: Record<string, number> = {};
  for (const r of bySourceRows) {
    const c = r._count._all;
    bySource[r.source] = c;
    if (r.source === "agriaffaires") intl += c;
    else domestic += c;
  }
  return {
    total,
    domestic,
    intl,
    bySource,
    lastScrapedAt: last?.scrapedAt?.toISOString() || null,
  };
}

const GH_API = "https://api.github.com";

function ghHeaders(): Record<string, string> {
  const token = process.env.GITHUB_TOKEN;
  return {
    Accept: "application/vnd.github+json",
    Authorization: `Bearer ${token}`,
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "usedfarmmach-orchestrator",
  };
}

/**
 * 触发 GitHub Actions 的 seller-scout.yml workflow
 */
async function triggerGitHubActions(): Promise<{ ok: boolean; runId?: number; runUrl?: string; error?: string }> {
  const token = process.env.GITHUB_TOKEN;
  const repo = process.env.GITHUB_REPO; // 形如 "xwszlz/usedfarmmach"
  if (!token || !repo) {
    return { ok: false, error: "缺少 GITHUB_TOKEN / GITHUB_REPO 环境变量（需在 Vercel 项目配置）" };
  }
  const url = `${GH_API}/repos/${repo}/actions/workflows/seller-scout.yml/dispatches`;
  const res = await fetch(url, {
    method: "POST",
    headers: ghHeaders(),
    body: JSON.stringify({ ref: "main" }),
  });
  if (!res.ok) {
    const txt = await res.text();
    return { ok: false, error: `GitHub dispatch ${res.status}: ${txt.slice(0, 300)}` };
  }
  // 找到刚触发的 run
  await new Promise((r) => setTimeout(r, 4000)); // 等 GH 注册 run
  const listRes = await fetch(
    `${GH_API}/repos/${repo}/actions/runs?event=workflow_dispatch&per_page=5`,
    { headers: ghHeaders() }
  );
  if (!listRes.ok) {
    return { ok: true, runId: undefined, runUrl: `https://github.com/${repo}/actions/workflows/seller-scout.yml` };
  }
  const data: any = await listRes.json();
  const run = data.workflow_runs?.[0];
  if (!run) {
    return { ok: true, runUrl: `https://github.com/${repo}/actions/workflows/seller-scout.yml` };
  }
  return {
    ok: true,
    runId: run.id,
    runUrl: run.html_url || `https://github.com/${repo}/actions/runs/${run.id}`,
  };
}

/**
 * 轮询 GitHub Actions run 状态，直到 completed 或超时
 */
async function awaitGitHubRun(runId: number, timeoutMs: number): Promise<{ status: string; url?: string }> {
  const repo = process.env.GITHUB_REPO!;
  const deadline = Date.now() + timeoutMs;
  let lastStatus = "queued";
  let url: string | undefined;
  while (Date.now() < deadline) {
    const res = await fetch(`${GH_API}/repos/${repo}/actions/runs/${runId}`, { headers: ghHeaders() });
    if (res.ok) {
      const data: any = await res.json();
      lastStatus = data.status;
      url = data.html_url;
      if (data.status === "completed") {
        return { status: "completed", url };
      }
    }
    await new Promise((r) => setTimeout(r, 8000)); // 每 8s 轮询一次
  }
  return { status: lastStatus, url };
}

/**
 * 云端模式主流程：触发 GH → 轮询 → 回读 DB
 */
async function runViaGitHub(input: ScoutInput, logs: string[]): Promise<ScoutOutput> {
  const startedAt = new Date();
  logSafe(logs, "☁️ 云端模式：Vercel 无 Python，改走 GitHub Actions 采集");

  const trig = await triggerGitHubActions();
  if (!trig.ok) {
    logSafe(logs, `  ❌ 触发失败: ${trig.error}`);
    const stats = await getSellerScoutDbStats();
    const finishedAt = new Date();
    return {
      ok: false,
      mode: input.mode || "all",
      triggeredVia: "github-actions",
      startedAt: startedAt.toISOString(),
      finishedAt: finishedAt.toISOString(),
      durationMs: finishedAt.getTime() - startedAt.getTime(),
      summary: { domesticCount: stats.domestic, intlCount: stats.intl, importsRun: 0, totalListings: stats.total, platforms: stats.bySource },
      github: { dispatched: false, awaited: false },
      log: logs,
      error: trig.error,
    };
  }

  logSafe(logs, `  ✅ 已触发 workflow runId=${trig.runId ?? "?"} ${trig.runUrl ?? ""}`);

  let runStatus = "queued";
  let awaited = false;
  if (trig.runId) {
    const awaitMs = Math.min(input.awaitMs ?? 90000, 110000);
    const r = await awaitGitHubRun(trig.runId, awaitMs);
    runStatus = r.status;
    awaited = true;
    logSafe(logs, `  轮询结果: ${runStatus}${runStatus !== "completed" ? "（未完，稍后刷新查看最新数据）" : ""}`);
  }

  // 回读最新 DB 统计
  const stats = await getSellerScoutDbStats();
  logSafe(logs, `  📊 RawListing 当前: 总计 ${stats.total} 条（国内 ${stats.domestic} / 国际 ${stats.intl}），最近采集 ${stats.lastScrapedAt ?? "无"}`);

  const finishedAt = new Date();
  return {
    ok: true,
    mode: input.mode || "all",
    triggeredVia: "github-actions",
    startedAt: startedAt.toISOString(),
    finishedAt: finishedAt.toISOString(),
    durationMs: finishedAt.getTime() - startedAt.getTime(),
    summary: { domesticCount: stats.domestic, intlCount: stats.intl, importsRun: 0, totalListings: stats.total, platforms: stats.bySource },
    github: { dispatched: true, runId: trig.runId, runStatus, runUrl: trig.runUrl, awaited },
    log: logs,
  };
}

function logSafe(logs: string[], msg: string) {
  logs.push(`[${new Date().toISOString()}] ${msg}`);
}

/**
 * 主执行入口（自动选择本地 / 云端模式）
 */
export async function executeSellerScout(input: ScoutInput): Promise<ScoutOutput> {
  const mode = input.mode || "all";
  const dryRun = !!input.dryRun;
  const startedAt = new Date();
  const logs: string[] = [];
  const log = (msg: string) => logSafe(logs, msg);

  log(`🚜 seller-scout 执行开始 mode=${mode} dryRun=${dryRun}`);

  // ── 云端模式（Vercel）：无 Python，走 GitHub Actions ──
  if (!canRunLocal()) {
    return runViaGitHub(input, logs);
  }

  // ── 本地模式：直接跑 Python ──
  log("💻 本地模式：检测到 scripts/ 与 Python 爬虫，直接执行");
  const repoRoot = findRepoRoot();
  const scriptsDir = path.join(repoRoot, "scripts");

  let domesticCount = 0;
  let intlCount = 0;
  let importsRun = 0;
  const platforms: Record<string, number> = {};

  try {
    // ── 1) 国内爬虫 ──
    if (mode === "all" || mode === "domestic") {
      log("▶ [1/3] 国内全平台采集...");
      const pyScript = path.join(scriptsDir, "seller_scout_domestic_scraper.py");

      if (!fs.existsSync(pyScript)) {
        log(`  ⚠️ 脚本不存在: ${pyScript}`);
      } else {
        const r = runPython(pyScript, scriptsDir);
        log(`  爬虫 exit=${r.ok ? 0 : 1}`);
        if (r.stdout) log(`  stdout: ${r.stdout.slice(-300)}`);

        const resultPath = path.join(scriptsDir, "domestic_sellers_data_v2.json");
        if (fs.existsSync(resultPath)) {
          try {
            const data = JSON.parse(fs.readFileSync(resultPath, "utf-8"));
            domesticCount = data.totalListings || 0;
            if (data.platformStats) {
              for (const [p, c] of Object.entries(data.platformStats)) {
                platforms[p] = (platforms[p] || 0) + (c as number);
              }
            }
            log(`  ✅ 国内采集: ${domesticCount} 条`);
          } catch (e: any) {
            log(`  ⚠️ 解析结果失败: ${e.message}`);
          }

          if (!dryRun) {
            const importScript = path.join(scriptsDir, "import-seller-scout-domestic.ts");
            if (fs.existsSync(importScript)) {
              log("  ▶ 导入国内数据...");
              const ir = runTsx(importScript, repoRoot);
              log(`  导入 exit=${ir.ok ? 0 : 1}`);
              if (ir.ok) importsRun += 1;
            }
          }
        } else {
          log("  ⚠️ 国内采集文件未生成（可能被平台反爬）");
        }
      }
    }

    // ── 2) 国际爬虫 ──
    if (mode === "all" || mode === "international") {
      log("▶ [2/3] 国际采集 (Agriaffaires)...");
      const pyScript = path.join(scriptsDir, "scrape_agriaffaires.py");

      if (!fs.existsSync(pyScript)) {
        log(`  ⚠️ 脚本不存在: ${pyScript}`);
      } else {
        const r = runPython(pyScript, scriptsDir);
        log(`  爬虫 exit=${r.ok ? 0 : 1}`);
        if (r.stdout) log(`  stdout: ${r.stdout.slice(-300)}`);

        const resultPath = path.join(scriptsDir, "agriaffaires_data.json");
        if (fs.existsSync(resultPath)) {
          try {
            const data = JSON.parse(fs.readFileSync(resultPath, "utf-8"));
            intlCount = data.totalListings || 0;
            platforms["agriaffaires"] = (platforms["agriaffaires"] || 0) + intlCount;
            log(`  ✅ 国际采集: ${intlCount} 条`);
          } catch (e: any) {
            log(`  ⚠️ 解析结果失败: ${e.message}`);
          }

          if (!dryRun) {
            const importScript = path.join(scriptsDir, "import-seller-scout.ts");
            if (fs.existsSync(importScript)) {
              log("  ▶ 导入国际数据...");
              const ir = runTsx(importScript, repoRoot);
              log(`  导入 exit=${ir.ok ? 0 : 1}`);
              if (ir.ok) importsRun += 1;
            }
          }
        } else {
          log("  ⚠️ 国际采集文件未生成");
        }
      }
    }

    log(`✅ 完成 domestic=${domesticCount} intl=${intlCount} imports=${importsRun}`);

    const finishedAt = new Date();
    return {
      ok: true,
      mode,
      triggeredVia: "local",
      startedAt: startedAt.toISOString(),
      finishedAt: finishedAt.toISOString(),
      durationMs: finishedAt.getTime() - startedAt.getTime(),
      summary: { domesticCount, intlCount, importsRun, totalListings: domesticCount + intlCount, platforms },
      log: logs,
    };
  } catch (err: any) {
    log(`❌ 异常: ${err.message}`);
    return {
      ok: false,
      mode,
      triggeredVia: "local",
      startedAt: startedAt.toISOString(),
      finishedAt: new Date().toISOString(),
      durationMs: Date.now() - startedAt.getTime(),
      summary: { domesticCount, intlCount, importsRun, totalListings: domesticCount + intlCount, platforms },
      log: logs,
      error: err.message,
    };
  }
}

/**
 * 仅回读 DB 统计（供面板实时展示，不触发采集）
 */
export async function getSellerScoutStats() {
  return getSellerScoutDbStats();
}
