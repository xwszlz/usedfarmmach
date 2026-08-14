/**
 * 跨境套利日报生成器
 *
 * 聚合当日平台数据（基准价 / 采集量 / 库存 / 套利线索），
 * 调用 OpenRouter 生成 Markdown 日报，写入 public/daily-reports/{date}_跨境套利日报.md。
 * 无 OPENROUTER_API_KEY 或调用失败时，降级为结构化模板，保证 cron 永远产出文件。
 */
import fs from "fs";
import path from "path";
import { prisma } from "@/lib/db";

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || "";
const OPENROUTER_BASE = "https://openrouter.ai/api/v1";
const MODEL = process.env.DAILY_REPORT_MODEL || "openai/gpt-4o-mini";

const REPORTS_DIR = path.join(process.cwd(), "public", "daily-reports");

export interface DailyReportResult {
  ok: boolean;
  date: string;
  filePath: string;
  generatedBy: "llm" | "template";
  error?: string;
}

interface AggStats {
  brandBenchmark: { brandCount: number; rowCount: number; top: Array<{ brandNameZh: string | null; model: string; priceCny: number; sampleSize: number; sourceSite: string; region: string | null }> };
  rawListing: { total: number; domestic: number; intl: number; lastScrapedAt: string | null };
  product: { total: number; active: number };
  internationalPrice: { count: number };
}

async function aggregate(): Promise<AggStats> {
  const [brandGroups, brandRows, rawTotal, rawBySource, lastRaw, productTotal, productActive, intlCount] = await Promise.all([
    prisma.brandBenchmark.groupBy({ by: ["brand"], _count: true }),
    prisma.brandBenchmark.findMany({ where: { isActive: true }, orderBy: { updatedAt: "desc" }, take: 12 }),
    prisma.rawListing.count(),
    prisma.rawListing.groupBy({ by: ["source"], _count: { _all: true } }),
    prisma.rawListing.findFirst({ orderBy: { scrapedAt: "desc" }, select: { scrapedAt: true } }),
    prisma.product.count(),
    prisma.product.count({ where: { status: "active" } }),
    prisma.internationalPrice.count(),
  ]);

  let domestic = 0;
  let intl = 0;
  for (const r of rawBySource) {
    if (r.source === "agriaffaires") intl += r._count._all;
    else domestic += r._count._all;
  }

  return {
    brandBenchmark: {
      brandCount: brandGroups.length,
      rowCount: brandRows.length,
      top: brandRows.map((b) => ({
        brandNameZh: b.brandNameZh,
        model: b.model,
        priceCny: Math.round(b.priceCny),
        sampleSize: b.sampleSize,
        sourceSite: b.sourceSite,
        region: b.region,
      })),
    },
    rawListing: { total: rawTotal, domestic, intl, lastScrapedAt: lastRaw?.scrapedAt?.toISOString() || null },
    product: { total: productTotal, active: productActive },
    internationalPrice: { count: intlCount },
  };
}

function buildTemplate(stats: AggStats, date: string): string {
  const lines: string[] = [];
  lines.push(`# 神雕农机跨境套利日报 ${date}`);
  lines.push("");
  lines.push(`> 自动生成 · 数据截至 ${new Date().toISOString().slice(0, 16).replace("T", " ")} (UTC+8)`);
  lines.push("");
  lines.push("## 一、市场概览");
  lines.push("");
  lines.push(`- 国际基准价覆盖品牌：**${stats.brandBenchmark.brandCount}** 个，样本 **${stats.brandBenchmark.rowCount}** 条`);
  lines.push(`- 卖方挂牌（RawListing）：**${stats.rawListing.total}** 条（国内 ${stats.rawListing.domestic} / 国际 ${stats.rawListing.intl}），最近采集 ${stats.rawListing.lastScrapedAt ? stats.rawListing.lastScrapedAt.slice(0, 10) : "无"}`);
  lines.push(`- 平台库存（Product）：**${stats.product.total}** 台，在售 **${stats.product.active}** 台`);
  lines.push(`- 国际配对参考价（InternationalPrice）：**${stats.internationalPrice.count}** 条`);
  lines.push("");
  lines.push("## 二、国际基准价动态（近期样本）");
  lines.push("");
  lines.push("| 品牌 | 机型 | 基准价(CNY) | 样本 | 来源 | 区域 |");
  lines.push("| --- | --- | --- | --- | --- | --- |");
  for (const b of stats.brandBenchmark.top) {
    lines.push(`| ${b.brandNameZh || "-"} | ${b.model} | ${b.priceCny.toLocaleString()} | ${b.sampleSize} | ${b.sourceSite} | ${b.region || "-"} |`);
  }
  lines.push("");
  lines.push("## 三、套利机会提示");
  lines.push("");
  lines.push("- 自动套利计算请在智能体调度中心运行「#4 套利分析」Agent，或查看 InternationalPrice 套利备注。");
  lines.push("- 当前国际基准价样本已就绪，可结合国内挂牌做价差比对。");
  lines.push("");
  lines.push("## 四、采集与数据健康");
  lines.push("");
  lines.push(`- 卖方采集（GitHub Actions 每日 06:00 北京）：最近采集 ${stats.rawListing.lastScrapedAt ? stats.rawListing.lastScrapedAt.slice(0, 16).replace("T", " ") : "暂无"}`);
  lines.push(`- 基准价刷新（Vercel Cron 每日 07:30 北京）：样本 ${stats.brandBenchmark.rowCount} 条`);
  lines.push("");
  lines.push("## 五、风险提示");
  lines.push("");
  lines.push("- 国际行情为公开数据聚合，汇率按采集日折算，存在时滞；成交前请以实时询价为准。");
  lines.push("- 跨境交易须遵守出口管制与目的地国认证要求，详见「#10 出口合规」Agent。");
  lines.push("");
  lines.push("---");
  lines.push(`*本日报由神雕农机智能体群自动生成（模板降级）。*`);
  return lines.join("\n");
}

async function callLLM(system: string, user: string): Promise<string | null> {
  if (!OPENROUTER_API_KEY) return null;
  try {
    const res = await fetch(`${OPENROUTER_BASE}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${OPENROUTER_API_KEY}`,
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
        max_tokens: 1500,
        temperature: 0.4,
      }),
    });
    if (!res.ok) return null;
    const data: any = await res.json();
    return data.choices?.[0]?.message?.content || null;
  } catch {
    return null;
  }
}

export async function generateDailyReport(date: string): Promise<DailyReportResult> {
  const stats = await aggregate();
  const filePath = path.join(REPORTS_DIR, `${date}_跨境套利日报.md`);
  fs.mkdirSync(REPORTS_DIR, { recursive: true });

  let content = "";
  let generatedBy: "llm" | "template" = "template";

  const system = "你是神雕农机跨境二手农机交易平台的资深市场分析师，用简体中文撰写每日套利市场日报，结构清晰、数据驱动、突出可操作套利线索。使用 Markdown，表格对齐。";
  const user = `请根据以下当日平台数据，生成《神雕农机跨境套利日报 ${date}》，包含：市场概览、国际基准价动态（用表格）、套利机会提示、采集与数据健康、风险提示 五个部分。\n\n数据(JSON):\n${JSON.stringify(stats, null, 2)}`;

  const llm = await callLLM(system, user);
  if (llm && llm.trim().length > 100) {
    content = llm.trim();
    generatedBy = "llm";
  } else {
    content = buildTemplate(stats, date);
  }

  fs.writeFileSync(filePath, content, "utf-8");
  return { ok: true, date, filePath, generatedBy };
}
