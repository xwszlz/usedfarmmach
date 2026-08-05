/**
 * 日报解析器
 *
 * 从跨境套利日报 MD 文件中提取结构化数据：
 * - 国际报价表（Agriaffaires / Agroline 等平台）
 * - 即时事件（AGRO展倒计时、ECB议息等）
 * - 市场趋势文本
 */

import fs from "fs";
import path from "path";

export interface IntlPriceEntry {
  model: string;
  year: number | null;
  priceForeign: string; // 原始价格文本，如 "£310,000"
  priceCny: string;     // 人民币换算文本，如 "211.5万"
  hours: string;        // 工时文本
  location: string;     // 国际卖家所在地
  platform: string;     // 来源平台
}

export interface UpcomingEvent {
  name: string;
  countdown: string;
  advice: string;
}

export interface DailyReportData {
  date: string;
  intlPrices: IntlPriceEntry[];
  upcomingEvent: UpcomingEvent | null;
  marketTrends: string[];
}

/**
 * 读取最新的跨境套利日报 MD 文件
 *
 * @returns MD 文件内容和日期，如果找不到返回 null
 */
export function readLatestDailyReport(): { content: string; date: string } | null {
  const reportsDir = path.join(process.cwd(), "public", "daily-reports");

  try {
    // 查找最新的 MD 文件
    const files = fs.readdirSync(reportsDir)
      .filter(f => f.includes("跨境套利日报") && f.endsWith(".md"))
      .sort()
      .reverse();

    if (files.length === 0) return null;

    const latestFile = files[0];
    const filePath = path.join(reportsDir, latestFile);

    // 从文件名提取日期 YYYY-MM-DD
    const dateMatch = latestFile.match(/(\d{4}-\d{2}-\d{2})/);
    const date = dateMatch ? dateMatch[1] : new Date().toISOString().split("T")[0];

    const content = fs.readFileSync(filePath, "utf-8");
    return { content, date };
  } catch (error) {
    console.error("[DailyReportParser] 读取日报失败:", error);
    return null;
  }
}

/**
 * 从日报 MD 中提取国际报价表
 *
 * 日报中的报价表格式通常为：
 * | 型号 | 年份 | 工时 | 价格(外币) | 价格(人民币) | 位置 | 平台 |
 *
 * @param mdContent 日报 MD 内容
 * @param brandFilter 品牌过滤关键词（可选）
 * @param modelFilter 型号过滤关键词（可选）
 */
export function parseIntlPricesFromMd(
  mdContent: string,
  brandFilter?: string,
  modelFilter?: string
): IntlPriceEntry[] {
  const entries: IntlPriceEntry[] = [];
  const lines = mdContent.split("\n");

  let inTable = false;
  let currentPlatform = "";

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    // 检测平台标题（如 "### Agriaffaires UK" 或 "**Agroline**"）
    const platformMatch = line.match(/^#{1,4}\s*(Agriaffaires|Agroline|TractorHouse|Mascus|e-Farm|MachineryPete)/i);
    if (platformMatch) {
      currentPlatform = platformMatch[1];
      inTable = false;
      continue;
    }

    // 检测表格开始（以 | 开头的行）
    if (line.startsWith("|") && line.includes("---")) {
      inTable = true;
      continue;
    }

    if (inTable && line.startsWith("|")) {
      const cells = line.split("|").map(c => c.trim()).filter(c => c);

      // 跳过分隔行和表头
      if (cells.every(c => c.includes("---") || c === "")) continue;
      if (cells[0]?.toLowerCase().includes("型号") || cells[0]?.toLowerCase().includes("model")) continue;

      // 尝试解析报价行
      // 典型格式: | 970 | 2021 | 1,950h | £310,000 | 211.5万 | UK | Agriaffaires |
      if (cells.length >= 4) {
        const model = cells[0] || "";
        const year = parseInt(cells[1]) || null;
        const hours = cells[2] || "";
        const priceForeign = cells[3] || "";
        const priceCny = cells[4] || cells[3] || "";
        const location = cells[5] || cells[4] || "";
        const platform = cells[6] || currentPlatform || "";

        // 品牌过滤
        if (brandFilter) {
          const brandLower = brandFilter.toLowerCase();
          const allText = (model + " " + line).toLowerCase();
          // 对于已知国际品牌，检查是否包含
          if (!isBrandInText(brandFilter, allText) && !modelFilter) {
            continue;
          }
        }

        // 型号过滤
        if (modelFilter) {
          const modelLower = modelFilter.toLowerCase();
          const entryModelLower = model.toLowerCase();
          if (!entryModelLower.includes(modelLower) && !modelLower.includes(entryModelLower)) {
            continue;
          }
        }

        // 至少要有价格信息才算有效条目
        if (priceForeign || priceCny) {
          entries.push({
            model,
            year,
            priceForeign,
            priceCny,
            hours,
            location,
            platform: platform || currentPlatform,
          });
        }
      }
    }

    // 表格结束
    if (inTable && !line.startsWith("|") && line !== "") {
      inTable = false;
    }
  }

  return entries.slice(0, 10); // 最多返回10条
}

/**
 * 检查品牌名是否在文本中出现
 */
function isBrandInText(brand: string, text: string): boolean {
  const brandAliases: Record<string, string[]> = {
    "克拉斯": ["claas", "克拉斯", "class"],
    "约翰迪尔": ["john deere", "约翰迪尔", "john deere"],
    "纽荷兰": ["new holland", "纽荷兰"],
    "凯斯": ["case ih", "凯斯", "case"],
    "芬特": ["fendt", "芬特"],
    "科罗尼": ["krone", "科罗尼", "克朗"],
    "久保田": ["kubota", "久保田"],
  };

  const aliases = brandAliases[brand] || [brand.toLowerCase()];
  return aliases.some(a => text.includes(a.toLowerCase()));
}

/**
 * 从日报 MD 中提取即时事件（倒计时/重要事件）
 */
export function parseUpcomingEvent(mdContent: string): UpcomingEvent | null {
  const lines = mdContent.split("\n");

  for (const line of lines) {
    // 匹配倒计时模式："倒计时X天" 或 "X天后"
    const countdownMatch = line.match(/倒计时\s*(\d+)\s*天|(\d+)\s*天后/);
    if (countdownMatch) {
      const days = parseInt(countdownMatch[1] || countdownMatch[2]);

      // 尝试提取事件名称
      let eventName = "即将到来的事件";
      const agromMatch = line.match(/AGRO\s*(\d*)/i);
      if (agromMatch) eventName = `AGRO ${agromMatch[1] || "2026"}展`;
      const ecbMatch = line.match(/ECB|欧洲央行/i);
      if (ecbMatch) eventName = "ECB议息会议";

      // 尝试提取日期
      const dateMatch = line.match(/(\d{1,2})\/(\d{1,2})/);

      return {
        name: eventName,
        countdown: `倒计时${days}天`,
        advice: days <= 7
          ? "建议在展会前完成发布，触达展会买家"
          : "关注事件进展，提前布局",
      };
    }
  }

  return null;
}

/**
 * 从日报 MD 中提取市场趋势文本
 */
export function parseMarketTrends(mdContent: string): string[] {
  const trends: string[] = [];
  const lines = mdContent.split("\n");

  for (const line of lines) {
    const trimmed = line.trim();

    // 匹配包含关键词的趋势行
    if (
      (trimmed.includes("套利") || trimmed.includes("汇率") || trimmed.includes("EUR")) &&
      trimmed.length > 10 &&
      trimmed.length < 200 &&
      !trimmed.startsWith("|") &&
      !trimmed.startsWith("#")
    ) {
      trends.push(trimmed);
    }
  }

  return trends.slice(0, 3);
}

/**
 * 读取并解析完整的日报数据
 */
export function getDailyReportData(brand?: string, modelName?: string): DailyReportData | null {
  const report = readLatestDailyReport();
  if (!report) return null;

  return {
    date: report.date,
    intlPrices: parseIntlPricesFromMd(report.content, brand, modelName),
    upcomingEvent: parseUpcomingEvent(report.content),
    marketTrends: parseMarketTrends(report.content),
  };
}
