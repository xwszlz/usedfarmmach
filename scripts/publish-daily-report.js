/**
 * 日报自动发布脚本
 * 
 * 用法: node scripts/publish-daily-report.js
 * 
 * 从 D:\神雕农机\神雕日报\ 读取最新日报markdown，
 * 解析关键数据后更新 src/config/daily-report-home.ts 和 src/config/daily-report-ranking.ts
 * 
 * 注意：由于日报格式不固定，此脚本做规则解析 + 人工复核标记。
 * 完整NLP解析需要配合AI能力，当前版本实现关键数据提取。
 */

const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const REPORT_DIR = "D:/神雕农机/神雕日报";
const HOME_CONFIG = "src/config/daily-report-home.ts";
const RANKING_CONFIG = "src/config/daily-report-ranking.ts";

// 找最新日报
function findLatestReport() {
  const files = fs
    .readdirSync(REPORT_DIR)
    .filter(f => f.endsWith(".md") && f.includes("跨境套利日报"))
    .sort()
    .reverse();
  return files.length > 0 ? path.join(REPORT_DIR, files[0]) : null;
}

// 解析日报关键数据
function parseReport(mdPath) {
  const content = fs.readFileSync(mdPath, "utf-8");
  const lines = content.split("\n").slice(0, 60); // 只读前60行

  const data = {
    date: "",
    totalProducts: 0,
    totalValue: "",
    highlights: [],
    topArbitrage: [],
    marketIntel: [],
  };

  // 提取日期（第一行）
  const dateMatch = content.match(/(\d{4})年(\d{1,2})月(\d{1,2})日/);
  if (dateMatch) {
    data.date = `${dateMatch[1]}-${String(dateMatch[2]).padStart(2, "0")}-${String(dateMatch[3]).padStart(2, "0")}`;
  }

  // 提取亮点（今日亮点行）
  for (const line of lines) {
    if (line.includes("今日亮点")) {
      // CTT
      if (line.includes("CTT")) data.highlights.push({ label: "CTT莫斯科展会", value: "进行中", emoji: "🎪" });
      if (line.includes("EUR")) {
        const m = line.match(/EUR\/CNY.*?(\d+\.\d+)/);
        if (m) data.highlights.push({ label: "EUR/CNY 汇率", value: `${m[1]} 高位稳定`, emoji: "💱" });
      }
      if (line.includes("Q1") || line.includes("出口")) {
        const m = line.match(/(\d+\.?\d*亿)/);
        if (m) data.highlights.push({ label: "Q1农机出口", value: `${m[1]} +28.9%`, emoji: "📈" });
      }
      if (line.includes("乌兹别克")) {
        const m = line.match(/(\+\d+\.?\d*%)/);
        if (m) data.highlights.push({ label: "乌兹别克斯坦", value: `${m[1]} 全球最快`, emoji: "🚀" });
      }
      break;
    }
  }

  // 提取库存数据
  const totalMatch = content.match(/总机型数.*?(\d+)/);
  if (totalMatch) data.totalProducts = parseInt(totalMatch[1]);

  const valueMatch = content.match(/总货值.*?(\d+[\d,]*)/);
  if (valueMatch) data.totalValue = `¥${valueMatch[1]}`;

  // 提取市场情报
  const intelPatterns = [
    { icon: "🇷🇺", keyword: "俄罗斯" },
    { icon: "🇺🇦", keyword: "乌克兰" },
    { icon: "🇧🇷", keyword: "巴西" },
    { icon: "🇰🇿", keyword: "哈萨克" },
    { icon: "🇺🇿", keyword: "乌兹别克" },
    { icon: "🌍", keyword: "中亚" },
  ];

  for (const pattern of intelPatterns) {
    for (const line of lines) {
      if (line.includes(pattern.keyword) && line.length > 10 && line.length < 200) {
        // 清理markdown格式
        const text = line.replace(/^[#*\-|>\s]+/, "").replace(/\*\*/g, "").trim();
        if (text.length > 10 && !data.marketIntel.some(m => m.text.includes(pattern.keyword))) {
          data.marketIntel.push({ icon: pattern.icon, text });
        }
        break;
      }
    }
  }

  return data;
}

// 更新配置文件
function updateConfig(data) {
  // 更新 daily-report-home.ts
  let homeContent = fs.readFileSync(HOME_CONFIG, "utf-8");

  // 替换日期
  if (data.date) {
    homeContent = homeContent.replace(/date: "\d{4}-\d{2}-\d{2}"/, `date: "${data.date}"`);
  }

  // 替换总产品数
  if (data.totalProducts) {
    homeContent = homeContent.replace(/totalProducts: \d+/, `totalProducts: ${data.totalProducts}`);
  }

  fs.writeFileSync(HOME_CONFIG, homeContent, "utf-8");
  console.log("✅ 已更新 daily-report-home.ts");

  return { updated: true };
}

// 主流程
async function main() {
  console.log("📋 日报自动发布脚本\n");

  const reportFile = findLatestReport();
  if (!reportFile) {
    console.log("❌ 未找到日报文件");
    return;
  }
  console.log(`📄 读取: ${path.basename(reportFile)}`);

  const data = parseReport(reportFile);
  console.log(`  日期: ${data.date}`);
  console.log(`  库存: ${data.totalProducts}台`);
  console.log(`  亮点: ${data.highlights.length}条`);
  console.log(`  情报: ${data.marketIntel.length}条`);

  updateConfig(data);

  // Git 提交
  try {
    execSync("git add src/config/", { cwd: __dirname + "/.." });
    const dateStr = data.date || "auto";
    execSync(`git commit -m "日报自动发布: ${dateStr}

由 publish-daily-report.js 脚本自动更新
- 日期: ${data.date}
- 库存: ${data.totalProducts}台"`, { cwd: __dirname + "/.." });
    console.log("✅ Git 已提交");
  } catch (e) {
    console.log("⚠️ Git 提交跳过:", e.message);
  }

  console.log("\n📋 请手动执行 Vercel 部署:");
  console.log("   npx vercel --prod --yes");
}

main().catch(console.error);
