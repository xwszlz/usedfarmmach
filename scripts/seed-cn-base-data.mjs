#!/usr/bin/env node
/**
 * seed-cn-base-data.mjs — .cn 国内站基础数据一次性 seed 脚本
 *
 * 功能：从 .com 生产库（Neon，境外）【只读】拉取公开字典数据，
 *       灌入境内 .cn 库（cn-postgres，ECS 本地 PG）。
 *
 * ⚠️ 合规红线（违反即返工）：
 *   1. 只拷贝【公开字典/内容】表（白名单见 TABLE_DEFS）：
 *      Brand、Category、MachineType、SubSystem、ComponentGroup、Part、
 *      CompatibleMachine、PartLegacy、ExchangeRate、Article、MarketIntel、
 *      PriceIndex、IndustryReport、GovSubsidyPolicy、Expo、Booth、
 *      ShowcaseItem、FieldVideo、ServiceCenter、OverseasWarehouse、FinancialService
 *   2. 严禁拷贝任何用户隐私/交易/依赖用户数据的表（黑名单见 SKIPPED_TABLES）：
 *      User、Product、Inquiry、Order、Chat*、Favorite、PaymentRecord、
 *      Stripe*、EscrowOrder、GuaranteeIntent、ExpoRegistration、
 *      GovMachineryData（含 ownerName/车牌）等一律不碰。
 *   3. 脱敏：Booth.merchantId、ShowcaseItem.productId、IndustryReport.authorId
 *      不拷贝（置空/不 SELECT），避免引用 .cn 库不存在的 User/Product。
 *   4. 数据流向 = 境外(.com Neon) → 境内(.cn 本地 PG)，方向合规。
 *
 * 用法：
 *   # 方式 A：显式传两个连接串
 *   COM_DATABASE_URL="postgresql://..." CN_DATABASE_URL="postgresql://..." \
 *     node scripts/seed-cn-base-data.mjs
 *
 *   # 方式 B：CN URL 自动读 .env.cn 的 DATABASE_URL_CN（推荐；host=cn-postgres）
 *   #   .cn 本地调试：docker-compose.yml 的 postgres 服务需临时加 ports: "5432:5432"
 *   #   （或把 DATABASE_URL_CN 的 host 改成 127.0.0.1）
 *   COM_DATABASE_URL="postgresql://..." node scripts/seed-cn-base-data.mjs
 *
 * 幂等：INSERT ... ON CONFLICT ("id") DO NOTHING，重复执行安全；
 *       已存在的行跳过，仅统计 skipped。
 *
 * 输出：每张表「源行数 / 新插入 / 已存在跳过」，末尾汇总 + 黑名单审计。
 */
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const ENV_CN_FILE = path.join(ROOT, ".env.cn");

// ============================================================
// 白名单表定义（顺序 = 外键依赖顺序）
//   table        : PG 表名（Prisma 模型名，PascalCase，SQL 中加双引号）
//   where        : 可选过滤（仅拷公开/启用/已发布行）
//   excludeCols  : 脱敏列（不 SELECT 不 INSERT，置空）
//   note         : 审计说明
// ============================================================
const TABLE_DEFS = [
  { table: "Brand", note: "品牌字典" },
  { table: "Category", note: "分类字典（自引用层级，自动拓扑重试）" },
  { table: "MachineType", note: "机型字典" },
  { table: "ExchangeRate", note: "汇率" },
  { table: "Article", where: `"status" = 'published'`, note: "公开文章（仅已发布）" },
  { table: "MarketIntel", where: `"isActive" = true`, note: "市场情报（仅启用）" },
  { table: "PriceIndex", note: "价格指数" },
  { table: "IndustryReport", where: `"status" = 'published'`, excludeCols: ["authorId"], note: "行业报告（仅已发布；脱敏 authorId）" },
  { table: "GovSubsidyPolicy", where: `"status" = 'active'`, note: "政府补贴政策（仅生效）" },
  { table: "Expo", note: "展会" },
  { table: "ServiceCenter", where: `"isActive" = true`, note: "服务中心（仅启用）" },
  { table: "OverseasWarehouse", where: `"status" = 'active'`, note: "海外仓（仅启用）" },
  { table: "FinancialService", where: `"isActive" = true`, note: "金融服务（仅启用）" },
  { table: "SubSystem", note: "子系统字典（依赖 MachineType）" },
  { table: "ComponentGroup", note: "部件组字典（依赖 SubSystem）" },
  { table: "Part", note: "配件字典（依赖 ComponentGroup）" },
  { table: "CompatibleMachine", note: "配件兼容机型（依赖 Part）" },
  { table: "PartLegacy", note: "旧配件字典（无外键）" },
  { table: "Booth", excludeCols: ["merchantId"], note: "展位（脱敏 merchantId；依赖 Expo/Brand）" },
  { table: "ShowcaseItem", excludeCols: ["productId"], note: "展品展示（脱敏 productId；依赖 Booth/Brand）" },
  { table: "FieldVideo", note: "地头展视频（boothId 可空，依赖 Booth）" },
];

// ============================================================
// 黑名单（明确【不】拷贝，供审计打印）
// ============================================================
const SKIPPED_TABLES = [
  // 用户/账号/隐私
  "User", "PiiAuditLog", "EmailSendLog", "UsageLog", "Subscriber",
  "Certification", "ApiKey", "AccountLink", "CheckIn", "Invitation", "UserMilestone",
  // 用户发布/交易/订单/支付
  "Product", "ProductImage", "ProductVideo", "Demand", "Inquiry",
  "Valuation", "CreditTransaction", "CreditLot", "ElectronicContract",
  "EscrowOrder", "PaymentRecord", "GuaranteeIntent", "Order", "Quote",
  "Review", "RentalListing", "Promotion", "LoanApplication", "ServiceOrder",
  "ValuationReportOrder", "Auction", "Bid", "InspectionBooking", "InspectionReport",
  "Warranty", "MaintenanceRecord", "StripeCustomer", "StripeSubscription", "StripeInvoice",
  // 会话/消息/社交
  "ChatSession", "ChatMessage", "Favorite", "Follow", "SavedSearch", "SellerRating",
  "Notification", "ExpoRegistration", "ExpoInquiry",
  // 依赖 Product（不拷 Product 故跳过）
  "InternationalPrice", "ArbitrageTopCache", "BlockchainRecord",
  "GovMachineryData", "MachineryIdentity", "MachineryEvent", "RawListing",
  // 内部运营/配置（可能含密钥/收款码/运营参数）
  "SystemConfig", "DailyQuota", "RiskReview", "AgentDefinition", "AgentRunLog", "SiteStat",
  // 商户敏感信息（营业执照/银行账号/法人）
  "ContractTemplate",
];

// ============================================================
// 工具函数
// ============================================================
/** 解析 .env.cn 中 DATABASE_URL_CN（不依赖 dotenv，避免歧义） */
function readCnDatabaseUrl() {
  if (process.env.CN_DATABASE_URL) return process.env.CN_DATABASE_URL;
  if (existsSync(ENV_CN_FILE)) {
    const lines = readFileSync(ENV_CN_FILE, "utf8").split("\n");
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq <= 0) continue;
      const key = trimmed.slice(0, eq).trim();
      if (key === "DATABASE_URL_CN") {
        return trimmed.slice(eq + 1).trim();
      }
    }
  }
  return undefined;
}

/** pg 返回值规范化：null/Date/Array/object → 可安全作为 SQL 参数 */
function normalize(v) {
  if (v === null || v === undefined) return null;
  if (Buffer.isBuffer(v)) return v;
  if (v instanceof Date) return v;
  if (Array.isArray(v)) return v; // node-postgres 自动转 postgres array literal
  if (typeof v === "object") return JSON.stringify(v); // jsonb 列接受 JSON 字符串
  return v;
}

/** 获取表列清单（public schema，按 ordinal 排序），排除脱敏列 */
async function getColumns(client, table, excludeCols = []) {
  const res = await client.query(
    `SELECT column_name FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = $1
     ORDER BY ordinal_position`,
    [table]
  );
  const cols = res.rows.map((r) => r.column_name).filter((c) => !excludeCols.includes(c));
  if (!cols.length) {
    throw new Error(`表 ${table} 无可用列（可能不存在，或全部被排除）`);
  }
  return cols;
}

/** 插入一行（幂等），返回 'inserted' | 'skipped'；FK 错误向上抛由调用方重试 */
async function insertRow(client, table, cols, row) {
  const placeholders = cols.map((_, i) => `$${i + 1}`).join(", ");
  const quotedCols = cols.map((c) => `"${c}"`).join(", ");
  const sql = `INSERT INTO "${table}" (${quotedCols}) VALUES (${placeholders}) ON CONFLICT ("id") DO NOTHING`;
  const res = await client.query(sql, cols.map((c) => normalize(row[c])));
  return res.rowCount === 1 ? "inserted" : "skipped";
}

/** 判断是否为外键违反（23503）/ 无效引用错误，用于拓扑重试 */
function isFkError(err) {
  return err && typeof err.code === "string" && (err.code === "23503" || err.code === "23502");
}

/** 打印分隔线 */
function hr() {
  console.log("-".repeat(70));
}

// ============================================================
// 主流程
// ============================================================
async function main() {
  console.log("=".repeat(70));
  console.log("seed-cn-base-data — .com 公开字典 → .cn 基础数据拷贝");
  console.log("=".repeat(70));

  const comUrl = process.env.COM_DATABASE_URL || process.env.DATABASE_URL;
  const cnUrl = readCnDatabaseUrl();

  if (!comUrl) {
    console.error("ERROR: 缺少 .com 库连接串。请设置环境变量 COM_DATABASE_URL（.com Neon 只读 URL）。");
    console.error("示例：COM_DATABASE_URL=\"postgresql://...\" node scripts/seed-cn-base-data.mjs");
    process.exit(1);
  }
  if (!cnUrl) {
    console.error("ERROR: 缺少 .cn 库连接串。请设置 CN_DATABASE_URL，或在 .env.cn 配置 DATABASE_URL_CN。");
    process.exit(1);
  }

  // 红线自查：目标必须是境内地址（禁止写境外）
  const cnHost = (() => {
    try {
      return new URL(cnUrl).hostname;
    } catch {
      return "(无法解析)";
    }
  })();
  console.log(`源库  (.com) : ${new URL(comUrl).host}  [只读拉取]`);
  console.log(`目标  (.cn)  : ${cnHost}  [写入]`);
  if (/neon\.tech/i.test(cnUrl) || /neon\.tech/i.test(cnHost)) {
    console.error("ERROR: 目标库指向 neon.tech（境外）！违反数据不出境红线，已中止。");
    process.exit(1);
  }
  if (!/cn-postgres|127\.0\.0\.1|localhost|rds|aliyuncs|pgm/i.test(cnHost) && !/neon\.tech/i.test(comUrl)) {
    // 仅提示，不阻止：host 可能是内网别名
    console.warn("WARN: 目标 host 非常见境内模式（cn-postgres/localhost/aliyuncs），请人工确认目标为境内库。");
  }

  const comClient = new pg.Client({ connectionString: comUrl });
  const cnClient = new pg.Client({ connectionString: cnUrl });
  await comClient.connect();
  await cnClient.connect();
  console.log("已连接源库与目标库。\n");

  const summary = [];
  let totalSource = 0;
  let totalInserted = 0;
  let totalSkipped = 0;
  const errors = [];

  for (const def of TABLE_DEFS) {
    const { table } = def;
    const label = `${table}${def.note ? `（${def.note}）` : ""}`;
    try {
      // 1) 取列（排除脱敏列）
      const cols = await getColumns(cnClient, table, def.excludeCols || []);

      // 2) 从 .com 只读 SELECT
      const where = def.where ? ` WHERE ${def.where}` : "";
      const selectSql = `SELECT ${cols.map((c) => `"${c}"`).join(", ")} FROM "${table}"${where}`;
      const src = await comClient.query(selectSql);
      const rows = src.rows;
      totalSource += rows.length;

      if (!rows.length) {
        console.log(`[SKIP] ${label}：源库 0 行，无需拷贝`);
        summary.push({ table, source: 0, inserted: 0, skipped: 0, error: null });
        continue;
      }

      // 3) 写入 .cn（幂等；FK 违反则下一轮重试，最多 20 轮）
      let inserted = 0;
      let skipped = 0;
      const pending = rows.slice();
      let round = 0;
      while (pending.length > 0 && round < 20) {
        const next = [];
        for (const row of pending) {
          try {
            const result = await insertRow(cnClient, table, cols, row);
            if (result === "inserted") inserted++;
            else skipped++;
          } catch (err) {
            if (isFkError(err) && round < 19) {
              next.push(row); // 外键依赖未就绪，下轮重试
            } else {
              throw err;
            }
          }
        }
        pending.length = 0;
        pending.push(...next);
        round++;
      }
      if (pending.length > 0) {
        throw new Error(`外键拓扑重试 20 轮后仍有 ${pending.length} 行未插入（请检查依赖顺序）`);
      }

      totalInserted += inserted;
      totalSkipped += skipped;
      console.log(`[OK]   ${label}：源 ${rows.length} 行 → 新插入 ${inserted} / 已存在跳过 ${skipped}`);
      summary.push({ table, source: rows.length, inserted, skipped, error: null });
    } catch (err) {
      console.error(`[FAIL] ${label}：${err.message}`);
      summary.push({ table, source: -1, inserted: 0, skipped: 0, error: err.message });
      errors.push(`${table}: ${err.message}`);
    }
  }

  hr();
  console.log("汇总：");
  for (const s of summary) {
    const status = s.error ? "FAIL" : "OK";
    console.log(
      `  ${status.padEnd(4)} ${s.table.padEnd(20)} 源=${String(s.source).padStart(6)} 插入=${String(s.inserted).padStart(6)} 跳过=${String(s.skipped).padStart(6)}${s.error ? `  错误=${s.error}` : ""}`
    );
  }
  hr();
  console.log(`总计：源 ${totalSource} 行 → 新插入 ${totalInserted} 行 / 已存在跳过 ${totalSkipped} 行`);

  if (errors.length) {
    console.error(`\n有 ${errors.length} 张表失败，请人工排查：`);
    errors.forEach((e) => console.error(`  - ${e}`));
  }

  console.log("\n黑名单审计（本次【未】拷贝，含用户隐私/交易/依赖用户数据/内部配置）：");
  console.log("  " + SKIPPED_TABLES.join(", "));
  console.log("\n脱敏说明：Booth.merchantId、ShowcaseItem.productId、IndustryReport.authorId 已置空（不引用 .cn 不存在的 User/Product）。");

  await comClient.end();
  await cnClient.end();
  console.log("\n完成。");
}

main().catch((err) => {
  console.error("脚本执行失败：", err);
  process.exit(1);
});
