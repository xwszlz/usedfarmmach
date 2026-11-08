/**
 * .cn 补贴机型实拍图 —— 20 条试跑抓取器（T05）
 * ===========================================================================
 * 🔴 只在【境内 ECS 容器】运行：SITE=cn + DATABASE_URL_CN（阿里云 RDS 北京）+
 *    OSS_ACCESS_KEY_ID / OSS_ACCESS_KEY_SECRET，OSS 固定 oss-cn-beijing（见 @/lib/oss-upload）。
 * 🔴 数据不出境：出站请求只访问 seed 自带的 sourceUrl 本身，URL / header 不拼接
 *    任何补贴库字段（modelKey/brandName/category/modelName 等）；不把 .cn 数据放境外 runner。
 * 🔴 本脚本只交代码，由境内运维执行；AI 不执行、不预置任何官方域名、不提供 seed 数据。
 *
 * 运行（ECS 容器内，沿用仓库既有 .ts 脚本 runner「npx tsx」，不改 package.json）：
 *   npx tsx scripts/fetch_subsidy_images.ts --seed-file /opt/cn/seed.jsonl --limit 20
 *
 * 前置 env（/opt/cn/.env.cn 注入后 force-recreate app 才生效）：
 *   CN_SUBSIDY_IMAGE_ENABLED=true
 *   SUBSIDY_IMAGE_SOURCE_ALLOWLIST=<官方域名逗号分隔>   # 空白名单 ⇒ fail-closed，0 新增
 *
 * seed jsonl：每行一个对象
 *   {"modelKey":"品牌|品类|型号","brandName":"...","category":"...","modelName":"...","sourceUrl":"https://..."}
 *   由境内运维准备 20 行；本脚本不内置任何域名 / 数据。
 */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { prisma } from "@/lib/db";
import { uploadBufferToOSS } from "@/lib/oss-upload";
import { getRawFeatureConfig, isImageFetchAllowed } from "@/lib/subsidy/raw-mode";
import { assertSourceAllowed } from "@/lib/subsidy/image-review";

/** 本轮只做 20 条试跑，硬上限 20；不做 Top100/Top500/全量 3000+。 */
const LIMIT_HARD_MAX = 20;
const OSS_KEY_PREFIX = "subsidy-images";

interface SeedRow {
  modelKey: string;
  brandName: string;
  category: string;
  modelName: string;
  sourceUrl: string;
}

interface CliArgs {
  seedFile: string;
  limit: number;
}

function parseArgs(argv: string[]): CliArgs {
  let seedFile = "";
  let limit = 20;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--seed-file" && argv[i + 1]) {
      seedFile = argv[++i];
    } else if (argv[i] === "--limit" && argv[i + 1]) {
      limit = Number(argv[++i]);
    }
  }
  if (!seedFile) throw new Error("--seed-file <jsonl> 必填");
  if (!Number.isInteger(limit) || limit < 1) {
    throw new Error(`--limit 必须是正整数，收到：${String(limit)}`);
  }
  if (limit > LIMIT_HARD_MAX) {
    throw new Error(
      `--limit 硬上限为 ${LIMIT_HARD_MAX}，本轮仅做 20 条试跑，不做 Top100/Top500/全量`
    );
  }
  return { seedFile, limit };
}

function readSeed(path: string): SeedRow[] {
  const lines = readFileSync(path, "utf8")
    .split(/\r?\n/)
    .filter((l) => l.trim() !== "");
  const required: Array<keyof SeedRow> = [
    "modelKey",
    "brandName",
    "category",
    "modelName",
    "sourceUrl",
  ];
  return lines.map((line, i) => {
    const r = JSON.parse(line) as Partial<SeedRow>;
    for (const k of required) {
      if (typeof r[k] !== "string" || r[k] === "") {
        throw new Error(`seed 第 ${i + 1} 行缺字段或为空：${k}`);
      }
    }
    return r as SeedRow;
  });
}

function extFromContentType(contentType: string): string {
  if (/jpeg|jpg/i.test(contentType)) return "jpg";
  if (/png/i.test(contentType)) return "png";
  if (/webp/i.test(contentType)) return "webp";
  if (/gif/i.test(contentType)) return "gif";
  return "bin";
}

async function main(): Promise<void> {
  const { seedFile, limit } = parseArgs(process.argv.slice(2));
  const config = getRawFeatureConfig();

  // 全局 fail-closed：开关未开 / 白名单为空 ⇒ 拒绝运行（0 新增）
  if (!isImageFetchAllowed(config)) {
    console.error(
      "[fetch_subsidy_images] 图片抓取未启用或来源白名单为空，拒绝运行（fail-closed）"
    );
    process.exitCode = 1;
    return;
  }

  const seeds = readSeed(seedFile);
  let created = 0;
  let skipped = 0;

  for (const seed of seeds.slice(0, limit)) {
    try {
      // 每条先过两道 fail-closed 闸；不通过就跳过并记日志，该条 0 新增
      if (!isImageFetchAllowed(config)) {
        console.warn(`[skip] ${seed.modelKey}: 白名单为空/开关未启用`);
        skipped++;
        continue;
      }
      assertSourceAllowed(seed.sourceUrl, config);

      // 出站请求：只访问 sourceUrl 本身，重定向由 fetch 跟随；
      // URL / header 不带任何补贴库字段（数据不出境）。
      const res = await fetch(seed.sourceUrl, { redirect: "follow" });
      if (res.status !== 200) {
        console.warn(`[skip] ${seed.modelKey}: httpStatus=${res.status}（非 200）`);
        skipped++;
        continue;
      }
      const contentType = (res.headers.get("content-type") ?? "").toLowerCase();
      if (!contentType.startsWith("image/")) {
        console.warn(`[skip] ${seed.modelKey}: contentType=${contentType || "空"}（非 image/*）`);
        skipped++;
        continue;
      }

      const finalUrl = res.url; // 重定向终点
      const buffer = Buffer.from(await res.arrayBuffer());
      const sha256 = createHash("sha256").update(buffer).digest("hex");
      const fetchedAt = new Date();
      const sourceDomain = new URL(seed.sourceUrl).hostname;

      // 上传 OSS：复用仓库既有 helper（region 固定 oss-cn-beijing，凭证读 env）；
      // ossKey 只用 sha256，不含任何补贴库字段。
      const ossKey = `${OSS_KEY_PREFIX}/${sha256}.${extFromContentType(contentType)}`;
      const ossUrl = await uploadBufferToOSS(ossKey, buffer, contentType);

      // 登记 9 项留痕 + 固定 pending（自动上架率 0）
      await prisma.subsidyModelImage.create({
        data: {
          modelKey: seed.modelKey,
          brandName: seed.brandName,
          category: seed.category,
          modelName: seed.modelName,
          sourceUrl: seed.sourceUrl,
          sourceDomain,
          finalUrl,
          httpStatus: res.status,
          contentType,
          fetchedAt,
          sha256,
          ossUrl,
          sortOrder: 0,
          isPrimary: false,
          reviewStatus: "pending",
        },
      });
      created++;
      console.log(`[ok] ${seed.modelKey} -> ${ossUrl}`);
    } catch (e) {
      skipped++;
      const msg = e instanceof Error ? e.message : String(e);
      console.warn(`[skip] ${seed.modelKey}: ${msg}`);
    }
  }

  console.log(`[done] created=${created} skipped=${skipped} limit=${limit}`);
}

void main()
  .catch((e) => {
    console.error("[fetch_subsidy_images] 致命错误:", e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
