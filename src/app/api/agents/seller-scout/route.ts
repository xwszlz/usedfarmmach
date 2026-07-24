/**
 * POST  /api/agents/seller-scout   触发卖方采集
 * GET   /api/agents/seller-scout   查询状态
 *
 * Body (POST):
 *   {
 *     mode?: "domestic" | "international" | "all"    // 默认 all
 *     dryRun?: boolean
 *   }
 *
 * 直接调用 execute.ts 共享模块，不走内部 fetch
 */
import { NextRequest, NextResponse } from "next/server";
import * as path from "path";
import * as fs from "fs";
import { executeSellerScout } from "@/lib/agents/seller-scout/execute";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

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

export async function POST(request: NextRequest) {
  const authFail = checkAuth(request);
  if (authFail) return authFail;

  let body: { mode?: "domestic" | "international" | "all"; dryRun?: boolean; maxBrands?: number } = {};
  try { const text = await request.text(); body = text ? JSON.parse(text) : {}; }
  catch { /* use defaults */ }

  const result = await executeSellerScout(body);
  return NextResponse.json(result, { status: result.ok ? 200 : 500 });
}

export async function GET() {
  const repoRoot = process.cwd();
  const scriptsDir = path.join(repoRoot, "scripts");

  const domesticPy = fs.existsSync(path.join(scriptsDir, "seller_scout_domestic_scraper.py"));
  const intlPy = fs.existsSync(path.join(scriptsDir, "scrape_agriaffaires.py"));
  const importDomestic = fs.existsSync(path.join(repoRoot, "scripts", "import-seller-scout-domestic.ts"));
  const importIntl = fs.existsSync(path.join(repoRoot, "scripts", "import-seller-scout.ts"));

  const domesticResult = path.join(repoRoot, "scripts", "domestic_sellers_data_v2.json");
  const intlResult = path.join(repoRoot, "scripts", "agriaffaires_data.json");
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
    agentName: "seller-scout",
    version: "1.0.1",
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