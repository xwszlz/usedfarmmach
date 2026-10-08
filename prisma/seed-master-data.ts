/**
 * prisma/seed-master-data.ts — 主数据字典装载（T01 骨架）
 *
 * 职责边界（T01）：
 *   1) ModelDictionary：按 modelCode 幂等 upsert 全量（55 条，来自 model.json）
 *   2) Category：只建 6 个「新叶」行（round_baler / square_baler / tractor_compact /
 *      tractor_mid / tractor_high / corn_harvester），isLeaf=true —— 不回填既有行
 *   3) Brand / 既有 Category 的 code 回填属于 T02，本文件不做
 *
 * 用法：
 *   npx tsx prisma/seed-master-data.ts [--dry-run]
 *   库选择：SITE=cn → DATABASE_URL_CN；否则 DATABASE_URL（见 src/lib/db.ts）
 */
import fs from "fs";
import path from "path";
import { prisma } from "../src/lib/db";

const DRY = process.argv.includes("--dry-run");

interface BrandJsonItem {
  code: string;
  display_name: string;
  origin_country?: string;
  brand_value_factor?: number;
  schema_comment?: string;
}
interface CategoryJsonItem {
  code: string;
  display_name: string;
  parent_code: string | null;
  schema_comment?: string;
}
interface ModelJsonItem {
  model_code: string;
  display_name: string;
  brand_code: string;
  category_code: string;
  spec_note?: string;
  model_popularity_factor?: number;
}
interface JsonWrap<T> {
  version?: string;
  items: T[];
}

function loadJson<T>(file: string): JsonWrap<T> {
  const p = path.join(__dirname, "master-data", file);
  const raw = fs.readFileSync(p, "utf-8");
  const d = JSON.parse(raw) as JsonWrap<T>;
  if (!Array.isArray(d.items)) {
    throw new Error(`[seed-master-data] ${file} 缺少 items 数组`);
  }
  return d;
}

/** T01 只装载这 6 个新叶 Category（其余品类回填在 T02） */
const NEW_LEAF_CODES = [
  "round_baler",
  "square_baler",
  "tractor_compact",
  "tractor_mid",
  "tractor_high",
  "corn_harvester",
];

async function main() {
  const brands = loadJson<BrandJsonItem>("brand.json");
  const categories = loadJson<CategoryJsonItem>("category.json");
  const models = loadJson<ModelJsonItem>("model.json");

  console.log(
    `[seed-master-data] 载入 brand=${brands.items.length} category=${categories.items.length} model=${models.items.length}${DRY ? "（--dry-run，不写库）" : ""}`,
  );

  // ── 1) ModelDictionary：按 modelCode 幂等 upsert ─────────────────
  const dictVersion = models.version ?? "1.0.0";
  let modelUpserts = 0;
  for (const m of models.items) {
    const data = {
      displayName: m.display_name,
      brandCode: m.brand_code,
      categoryCode: m.category_code,
      modelPopularityFactor: m.model_popularity_factor ?? 1.0,
      specNote: m.spec_note ?? null,
      dictVersion,
    };
    if (DRY) {
      console.log(`  [dry] ModelDictionary.upsert ${m.model_code}`);
    } else {
      await prisma.modelDictionary.upsert({
        where: { modelCode: m.model_code },
        update: data,
        create: { modelCode: m.model_code, ...data },
      });
    }
    modelUpserts++;
  }
  console.log(`[seed-master-data] ModelDictionary 将写入 ${modelUpserts} 条`);

  // ── 2) Category 新叶：按 code 幂等（code 尚无 @unique 索引前的兼容写法）──
  // 注意：T01 schema 已加 code @unique ⇒ 可用 upsert(where:{code})；
  // 但既有行 code=NULL，findFirst→update/create 的幂等写法同样成立。
  const catByName = new Map(categories.items.map((c) => [c.code, c]));
  let leafCreated = 0;
  for (const code of NEW_LEAF_CODES) {
    const c = catByName.get(code);
    if (!c) {
      console.warn(`[seed-master-data] ⚠️ category.json 缺少新叶 ${code}，跳过`);
      continue;
    }
    const parent = c.parent_code ? catByName.get(c.parent_code) : null;
    // 父行必须已存在（按 nameZh 查；查不到则跳过并警告，T02 负责全量层级）
    let parentId: string | null = null;
    if (parent) {
      const p = await prisma.category.findFirst({
        where: { nameZh: parent.display_name },
        select: { id: true },
      });
      if (!p) {
        console.warn(
          `[seed-master-data] ⚠️ 父品类「${parent.display_name}」不在库，${code} 暂挂顶层（parentId=null）`,
        );
      } else {
        parentId = p.id;
      }
    }
    const existing = await prisma.category.findFirst({ where: { code } });
    if (DRY) {
      console.log(
        `  [dry] Category.${existing ? "update" : "create"} code=${code} isLeaf=true parentId=${parentId}`,
      );
    } else if (existing) {
      await prisma.category.update({
        where: { id: existing.id },
        data: { code, isLeaf: true, parentId },
      });
    } else {
      await prisma.category.create({
        data: {
          code,
          isLeaf: true,
          parentId,
          nameZh: c.display_name,
          nameEn: code,
        },
      });
    }
    leafCreated++;
  }
  console.log(`[seed-master-data] Category 新叶将写入 ${leafCreated} 条`);

  console.log(
    DRY
      ? "[seed-master-data] --dry-run 完成，未写库"
      : "[seed-master-data] 完成（T01 范围：ModelDictionary + 6 新叶 Category）",
  );
}

main()
  .catch((e) => {
    console.error("[seed-master-data] 失败:", e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
