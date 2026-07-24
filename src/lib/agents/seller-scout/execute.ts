/**
 * #1 卖方采集 Agent — 核心执行逻辑
 *
 * 共享模块：被 /api/agents/seller-scout 和 orchestrator 共同调用
 * 避免内部 HTTP 调用的稳定性问题
 */
import { execSync } from "child_process";
import * as path from "path";
import * as fs from "fs";

export type ScoutMode = "domestic" | "international" | "all";

export interface ScoutInput {
  mode?: ScoutMode;
  dryRun?: boolean;
  maxBrands?: number;
}

export interface ScoutOutput {
  ok: boolean;
  mode: ScoutMode;
  startedAt: string;
  finishedAt: string;
  durationMs: number;
  summary: {
    domesticCount: number;
    intlCount: number;
    importsRun: number;
    platforms?: Record<string, number>;
  };
  log: string[];
  error?: string;
}

/** 找到仓库根目录：当前是 /api/agents/seller-scout 或 /lib/agents/seller-scout */
function findRepoRoot(): string {
  // process.cwd() 在 Vercel 上是仓库根目录
  // 在本地可能是 usedfarmmach 子目录
  const cwd = process.cwd();
  // 如果当前在 usedfarmmach 子目录
  if (path.basename(cwd) === "usedfarmmach") return cwd;
  // 否则尝试找 usedfarmmach 子目录
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
 * 主执行入口
 */
export async function executeSellerScout(input: ScoutInput): Promise<ScoutOutput> {
  const mode = input.mode || "all";
  const dryRun = !!input.dryRun;
  const startedAt = new Date();
  const logs: string[] = [];
  const log = (msg: string) => logs.push(`[${new Date().toISOString()}] ${msg}`);

  log(`🚜 seller-scout 执行开始 mode=${mode} dryRun=${dryRun}`);

  const repoRoot = findRepoRoot();
  // 脚本目录：仓库根目录的 scripts/
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

        const resultPath = path.join(repoRoot, "usedfarmmach", "scripts", "domestic_sellers_data_v2.json");
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
            const importScript = path.join(repoRoot, "usedfarmmach", "scripts", "import-seller-scout-domestic.ts");
            if (fs.existsSync(importScript)) {
              log("  ▶ 导入国内数据...");
              const ir = runTsx(importScript, path.join(repoRoot, "usedfarmmach"));
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

        const resultPath = path.join(repoRoot, "usedfarmmach", "scripts", "agriaffaires_data.json");
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
            const importScript = path.join(repoRoot, "usedfarmmach", "scripts", "import-seller-scout.ts");
            if (fs.existsSync(importScript)) {
              log("  ▶ 导入国际数据...");
              const ir = runTsx(importScript, path.join(repoRoot, "usedfarmmach"));
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
      startedAt: startedAt.toISOString(),
      finishedAt: finishedAt.toISOString(),
      durationMs: finishedAt.getTime() - startedAt.getTime(),
      summary: { domesticCount, intlCount, importsRun, platforms },
      log: logs,
    };
  } catch (err: any) {
    log(`❌ 异常: ${err.message}`);
    return {
      ok: false,
      mode,
      startedAt: startedAt.toISOString(),
      finishedAt: new Date().toISOString(),
      durationMs: Date.now() - startedAt.getTime(),
      summary: { domesticCount, intlCount, importsRun, platforms },
      log: logs,
      error: err.message,
    };
  }
}