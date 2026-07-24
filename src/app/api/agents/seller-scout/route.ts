/**
 * POST  /api/agents/seller-scout   触发卖方采集（国内+国外）
 * GET   /api/agents/seller-scout   查询采集状态
 *
 * Body (POST):
 *   {
 *     mode?: "domestic" | "international" | "all"    // 默认 all
 *     maxBrands?: number                              // 最多处理品牌数
 *     dryRun?: boolean                                // 只看不写DB
 *   }
 *
 * 执行流程：
 *   1. 国内：调用 Python 爬虫 seller_scout_domestic_scraper.py → 写入 JSON
 *   2. 国际：调用 Python 爬虫 scrape_agriaffaires.py → 写入 JSON
 *   3. 导入：调用 tsx import-seller-scout*.ts → 导入 RawListing 表
 */
import { NextRequest, NextResponse } from "next/server";
import { execSync } from "child_process";
import * as path from "path";
import * as fs from "fs";

export const dynamic = "force-dynamic";
export const maxDuration = 120; // 国内采集可能较慢，给 120s

const AGENT_NAME = "seller-scout";
const AGENT_VERSION = "1.0.0";

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

function runScript(scriptPath: string, args: string = "", cwd: string): { stdout: string; stderr: string; exitCode: number } {
  try {
    const cmd = `python "${scriptPath}" ${args}`;
    const result = execSync(cmd, { cwd, timeout: 90000, encoding: "utf-8", maxBuffer: 10 * 1024 * 1024 });
    return { stdout: result, stderr: "", exitCode: 0 };
  } catch (err: any) {
    return { stdout: err.stdout || "", stderr: err.stderr || err.message || "", exitCode: err.status || 1 };
  }
}

export async function POST(request: NextRequest) {
  const authFail = checkAuth(request);
  if (authFail) return authFail;

  let body: { mode?: string; maxBrands?: number; dryRun?: boolean } = {};
  try { const text = await request.text(); body = text ? JSON.parse(text) : {}; }
  catch { /* use defaults */ }

  const mode = body.mode || "all";
  const logs: string[] = [];
  const startTime = Date.now();
  let logsStr = (msg: string) => logs.push(`[${new Date().toISOString()}] ${msg}`);

  logsStr(`${AGENT_NAME}@${AGENT_VERSION} 启动, mode=${mode}`);

  const scriptsDir = path.join(process.cwd(), "..", "scripts");
  const appScriptsDir = path.join(process.cwd(), "scripts");
  let domesticCount = 0;
  let intlCount = 0;
  let importCount = 0;

  try {
    // ── 1) 国内爬虫 ──
    if (mode === "all" || mode === "domestic") {
      logsStr("▶ 国内卖家全平台采集...");
      const pyPath = path.join(scriptsDir, "seller_scout_domestic_scraper.py");
      
      if (fs.existsSync(pyPath)) {
        const proxyArg = process.env.HTTPS_PROXY ? `HTTPS_PROXY=${process.env.HTTPS_PROXY}` : "";
        const r = runScript(pyPath, "", scriptsDir);
        logsStr(`  爬虫完毕: exit=${r.exitCode}`);

        // 读取结果
        const resultPath = path.join(appScriptsDir, "domestic_sellers_data_v2.json");
        if (fs.existsSync(resultPath)) {
          const raw = fs.readFileSync(resultPath, "utf-8");
          const data = JSON.parse(raw);
          domesticCount = data.totalListings || 0;
          logsStr(`  国内采集: ${domesticCount} 条`);

          // 导入DB
          if (!body.dryRun) {
            logsStr("  ▶ 导入数据库...");
            const importScript = path.join(appScriptsDir, "import-seller-scout-domestic.ts");
            if (fs.existsSync(importScript)) {
              try {
                const res = execSync(`npx tsx "${importScript}"`, { cwd: process.cwd(), timeout: 60000, encoding: "utf-8" });
                logsStr(`  导入完成`);
                importCount += 1;
              } catch (e: any) {
                logsStr(`  导入失败: ${(e.stderr || e.message || "").slice(0, 200)}`);
              }
            }
          }
        } else {
          logsStr("  ⚠️ 国内采集文件未生成");
        }
      } else {
        logsStr("  ⚠️ 国内爬虫脚本不存在");
      }
    }

    // ── 2) 国际爬虫（Agriaffaires） ──
    if (mode === "all" || mode === "international") {
      logsStr("▶ 国际卖家采集 (Agriaffaires)...");
      const pyPath = path.join(scriptsDir, "scrape_agriaffaires.py");
      if (fs.existsSync(pyPath)) {
        const r = runScript(pyPath, "", scriptsDir);
        logsStr(`  爬虫完毕: exit=${r.exitCode}`);

        const resultPath = path.join(appScriptsDir, "agriaffaires_data.json");
        if (fs.existsSync(resultPath)) {
          const raw = fs.readFileSync(resultPath, "utf-8");
          const data = JSON.parse(raw);
          intlCount = data.totalListings || 0;
          logsStr(`  国际采集: ${intlCount} 条`);

          if (!body.dryRun) {
            logsStr("  ▶ 导入数据库...");
            const importScript = path.join(appScriptsDir, "import-seller-scout.ts");
            if (fs.existsSync(importScript)) {
              try {
                const res = execSync(`npx tsx "${importScript}"`, { cwd: process.cwd(), timeout: 60000, encoding: "utf-8" });
                logsStr(`  导入完成`);
                importCount += 1;
              } catch (e: any) {
                logsStr(`  导入失败: ${(e.stderr || e.message || "").slice(0, 200)}`);
              }
            }
          }
        } else {
          logsStr("  ⚠️ 国际采集文件未生成");
        }
      } else {
        logsStr("  ⚠️ 国际爬虫脚本不存在");
      }
    }

  } catch (err: any) {
    logsStr(`❌ 异常: ${err.message}`);
  }

  logsStr(`✅ 完成 ${Date.now() - startTime}ms`);

  return NextResponse.json({
    ok: true,
    agentId: AGENT_NAME,
    mode,
    startedAt: new Date(startTime).toISOString(),
    finishedAt: new Date().toISOString(),
    durationMs: Date.now() - startTime,
    summary: { domesticCount, intlCount, importsRun: importCount },
    log: logs,
  });
}

export async function GET() {
  const scriptsDir = path.join(process.cwd(), "..", "scripts");
  const appScriptsDir = path.join(process.cwd(), "scripts");

  // 检查各脚本是否存在
  const domesticPy = fs.existsSync(path.join(scriptsDir, "seller_scout_domestic_scraper.py"));
  const intlPy = fs.existsSync(path.join(scriptsDir, "scrape_agriaffaires.py"));
  const importDomestic = fs.existsSync(path.join(appScriptsDir, "import-seller-scout-domestic.ts"));
  const importIntl = fs.existsSync(path.join(appScriptsDir, "import-seller-scout.ts"));

  // 检查上次结果
  const domesticResult = path.join(appScriptsDir, "domestic_sellers_data_v2.json");
  const intlResult = path.join(appScriptsDir, "agriaffaires_data.json");
  let domesticStats = null;
  let intlStats = null;
  try {
    if (fs.existsSync(domesticResult)) {
      const d = JSON.parse(fs.readFileSync(domesticResult, "utf-8"));
      domesticStats = { totalListings: d.totalListings, scrapedAt: d.scrapedAt, platforms: d.platformStats };
    }
    if (fs.existsSync(intlResult)) {
      const d = JSON.parse(fs.readFileSync(intlResult, "utf-8"));
      intlStats = { totalListings: d.totalListings, scrapedAt: d.scrapedAt };
    }
  } catch {}

  return NextResponse.json({
    ok: true,
    agentName: AGENT_NAME,
    version: AGENT_VERSION,
    scripts: {
      domesticScraper: domesticPy,
      internationalScraper: intlPy,
      importDomestic: importDomestic,
      importInternational: importIntl,
    },
    lastRun: {
      domestic: domesticStats,
      international: intlStats,
    },
  });
}
