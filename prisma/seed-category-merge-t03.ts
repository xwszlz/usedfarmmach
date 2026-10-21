/**
 * prisma/seed-category-merge-t03.ts — 品类字典「新旧两套并存」合并（T03）
 *
 * 背景（.com 生产库 Neon 实测，2026-10-16）：
 *   - `Category` 表共 51 行 = 28 个新树节点（有 code / parentId / isLeaf / nameEn）
 *     + 23 个旧孤儿品类（code = null，平铺无层级，属 T01/T02 之前的历史数据）。
 *   - 23 个孤儿共挂 58 台商品（全站 153 台）—— 孤儿不是垃圾数据，绝对不能盲删。
 *   - 其中 3 个与新树节点「真重复」（拖拉机 / 打捆机 / 收割机）：
 *       先把商品改挂到新树节点，再**仅当该孤儿挂载商品数归零且 demand 数也为 0** 时才删除孤儿行。
 *   - 其余 20 个是真实品类：**并入新树**——补 `code` + `nameEn` + `parentId` + `isLeaf:true`，
 *       保留原 `nameZh`（前台/卖家已按中文名习惯使用）、保留全部商品挂载关系。
 *
 * 红线（改本脚本前请先读）：
 *   1. **不删任何挂着商品的品类**（Product.categoryId 非空外键，盲删 = 线上商品详情 500）。
 *   2. **只并入、不破坏外键**：本脚本对商品只做 `product.updateMany` 改挂，永不 delete product。
 *   3. **幂等可重复执行**：ORPHAN_ABSORB 走 update（重复执行结果一致）；
 *      DUPLICATE_MERGE 改挂后 count 归零才删，已删行 findUnique 返回 null → 自动 skip。
 *   4. 孤儿并入后前台导航/下拉统一走新树（见 src/app/api/categories/route.ts、
 *      src/app/api/brands-categories/route.ts 的同步改动）。
 *
 * 安全设计：
 *   - 默认 **dry-run**（只打印计划），必须显式传 `--apply` 才写库。
 *   - code 写入单独 try/catch：若 `Category.code` 唯一键被其他行占用（Prisma P2002），
 *     WARN 并跳过该条，**不中断整批**。
 *   - 只作用于「目标库里真实存在」的 id；在 .cn（不同 DB）跑时这些 .com 的 id 不存在则自动跳过。
 *
 * 用法：
 *   npx tsx prisma/seed-category-merge-t03.ts            # dry-run（默认）
 *   npx tsx prisma/seed-category-merge-t03.ts --apply    # 写库
 *   库选择：SITE=cn → DATABASE_URL_CN；否则 DATABASE_URL（.com / Neon）
 */

import { prisma } from "../src/lib/db";

const APPLY = process.argv.includes("--apply");

/* ---------------------------------------------------------------- *
 * ① 真重复孤儿 → 并入新树节点（orphanId → 目标节点 code）
 *    语义：orphanId 上的商品全部改挂 targetCode；改挂后若该孤儿 0 商品且 0 demand，才删除孤儿行。
 * ---------------------------------------------------------------- */
const DUPLICATE_MERGE: Record<string, string> = {
  // 拖拉机（2 台）→ 农用拖拉机 tractor
  cmv92ngko0000wiz3apc56li9: "tractor",
  // 打捆机（1 台）→ 打捆机械大类 baler
  cmv936sod000xii5navu63peq: "baler",
  // 收割机（1 台）→ 收获机械大类 harvester
  cmv936yaj0018ii5n805nmfa0: "harvester",
};

/* ---------------------------------------------------------------- *
 * ② 真实孤儿品类 → 并入新树（补 code / nameEn / parentId / isLeaf，保留 nameZh 与商品）
 *    zh 字段仅用于日志可读性与人工核对，不写库。
 * ---------------------------------------------------------------- */
type Absorb = { id: string; code: string; nameEn: string; parentCode: string; zh: string };

const ORPHAN_ABSORB: Absorb[] = [
  { id: "cmpzm1o1a0013yllpyzxbdzwa", code: "corn_stalk_grain_harvester", nameEn: "Corn Stalk & Grain Harvester", parentCode: "harvester", zh: "茎穗双收" },
  // ⚠️ 口径待老板确认：「跑车」在农机语境按田间转运车理解，暂挂 农用运输机械大类
  { id: "cmpzm1obo001ayllppsc6r4p6", code: "field_cart", nameEn: "Field Cart", parentCode: "transport", zh: "跑车" },
  { id: "cmpzm1p8e001uyllp88krix1v", code: "packing_machine", nameEn: "Packing Machine", parentCode: "baler", zh: "打包机" },
  { id: "cmpzm1pgf001zyllp2opej2or", code: "corn_thresher_air", nameEn: "Air-suction Corn Thresher", parentCode: "harvester", zh: "风吸玉米脱粒机" },
  { id: "cmpzm1po00024yllpowe0nmo6", code: "spare_parts", nameEn: "Spare Parts", parentCode: "root", zh: "配件" },
  { id: "cmpzm1pw00029yllp14kwlnyc", code: "fertilizer_spreader", nameEn: "Fertilizer Spreader", parentCode: "seeding", zh: "施肥机" },
  { id: "cmpzm1qvs002tyllp042a9ozp", code: "sugar_beet_harvester", nameEn: "Sugar Beet Harvester", parentCode: "harvester", zh: "甜菜机" },
  { id: "cmpzm1r0w002wyllph62dgtcr", code: "self_propelled_forage_forklift", nameEn: "Self-propelled Forage Forklift", parentCode: "forage", zh: "自走式多功能牧草叉车" },
  { id: "cmr4jzult0000at1b4zp23lmi", code: "tomato_harvester", nameEn: "Tomato Harvester", parentCode: "harvester", zh: "番茄采收机" },
  { id: "cmrxec1je00015fp9u9vrxbz3", code: "power_harrow_seeder", nameEn: "Power Harrow Seeder", parentCode: "seeding", zh: "驱动耙播种机" },
  { id: "excavator", code: "excavator", nameEn: "Excavator", parentCode: "root", zh: "挖掘机" },
  { id: "loader", code: "loader", nameEn: "Loader", parentCode: "root", zh: "装载机" },
  { id: "wrapper", code: "bale_wrapper", nameEn: "Bale Wrapper", parentCode: "baler", zh: "裹包机" },
  { id: "header", code: "header", nameEn: "Combine Header", parentCode: "harvester", zh: "割台" },
  { id: "pickup", code: "pickup_header", nameEn: "Pickup Header", parentCode: "harvester", zh: "捡拾台" },
  { id: "stone-picker", code: "stone_picker", nameEn: "Stone Picker", parentCode: "tillage", zh: "捡石机" },
  { id: "stacker", code: "bale_stacker", nameEn: "Bale Stacker", parentCode: "baler", zh: "码垛机" },
  { id: "handler", code: "telehandler", nameEn: "Telehandler", parentCode: "transport", zh: "伸缩臂夹包机" },
  // ⚠️ 口径待老板确认：「单收」按单行/单割台谷物收获理解，暂挂 收获机械大类
  { id: "cmpzm1mcw0001yllpzg9l9ovq", code: "single_grain_header", nameEn: "Single-row Grain Header", parentCode: "harvester", zh: "单收" },
  // ⚠️ 口径待老板确认：「粪污泵」属粪污处理设备，暂无对应大类，暂挂 root（农机设备总根）
  { id: "cmpzm1mn90004yllpkbrxmsm0", code: "manure_pump", nameEn: "Manure Pump", parentCode: "root", zh: "粪污泵" },
];

/* ---------------------------------------------------------------- */

async function main() {
  const total = await prisma.category.count();
  const withCode = await prisma.category.count({ where: { code: { not: null } } });
  console.log(
    `[t03] 目标库 Category 共 ${total} 行（有 code ${withCode} / 无 code ${total - withCode}）` +
      `${APPLY ? "" : "（DRY-RUN，不写库）"}`,
  );
  console.log(
    `[t03] 计划：真重复归并 ${Object.keys(DUPLICATE_MERGE).length} 条 | 孤儿并入 ${ORPHAN_ABSORB.length} 条`,
  );

  /* ── 1) 真重复孤儿：先迁移商品，再仅当归零时删除 ─────────────── */
  let migratedProducts = 0;
  let deletedOrphans = 0;
  let skippedOrphans = 0;

  for (const [orphanId, targetCode] of Object.entries(DUPLICATE_MERGE)) {
    const orphan = await prisma.category.findUnique({
      where: { id: orphanId },
      select: { id: true, nameZh: true, nameEn: true },
    });
    if (!orphan) {
      console.log(`  [skip] 重复孤儿 ${orphanId} 在目标库不存在（可能已归并/非 .com）`);
      skippedOrphans++;
      continue;
    }
    const target = await prisma.category.findFirst({
      where: { code: targetCode },
      select: { id: true, nameZh: true },
    });
    if (!target) {
      console.warn(`[t03] ⚠️ 归并目标 code=${targetCode} 未找到，跳过 ${orphan.nameZh}（${orphanId}）`);
      skippedOrphans++;
      continue;
    }

    const pc = await prisma.product.count({ where: { categoryId: orphanId } });
    if (pc > 0) {
      if (APPLY) {
        const upd = await prisma.product.updateMany({
          where: { categoryId: orphanId },
          data: { categoryId: target.id },
        });
        migratedProducts += upd.count;
        console.log(`  [apply] ${orphan.nameZh}（${orphanId}）的 ${upd.count} 台商品改挂 ${targetCode}（${target.nameZh}）`);
      } else {
        migratedProducts += pc;
        console.log(`  [dry] 将迁移 ${pc} 台：${orphan.nameZh}（${orphanId}）→ ${targetCode}（${target.nameZh}）`);
      }
    }

    // 重新 count：仅当商品与 demand 都归零才允许删，避免破坏外键（红线 1）
    const pcAfter = await prisma.product.count({ where: { categoryId: orphanId } });
    const dcAfter = await prisma.demand.count({ where: { categoryId: orphanId } });
    if (pcAfter === 0 && dcAfter === 0) {
      if (APPLY) {
        await prisma.category.delete({ where: { id: orphanId } });
        console.log(`  [apply] 已删重复孤儿 ${orphan.nameZh}（${orphanId}）— 0 商品 / 0 需求`);
      } else {
        console.log(`  [dry] 将删除重复孤儿 ${orphan.nameZh}（${orphanId}）— 0 商品 / 0 需求`);
      }
      deletedOrphans++;
    } else {
      console.warn(
        `[t03] ⚠️ 跳过删除 ${orphan.nameZh}（${orphanId}）：仍挂 ${pcAfter} 台商品 / ${dcAfter} 条需求 —— 需人工复核`,
      );
      skippedOrphans++;
    }
  }
  console.log(
    `[t03] 归并：将迁移 ${migratedProducts} 台商品 | 将删除 ${deletedOrphans} 条 | 跳过 ${skippedOrphans} 条`,
  );

  /* ── 2) 真实孤儿品类：并入新树（补 code / nameEn / parentId / isLeaf） ── */
  let absorbed = 0;
  let skippedAbsorb = 0;

  for (const item of ORPHAN_ABSORB) {
    const existing = await prisma.category.findUnique({
      where: { id: item.id },
      select: { id: true, nameZh: true, code: true },
    });
    if (!existing) {
      console.log(`  [skip] 孤儿 ${item.zh}（${item.id}）在目标库不存在（可能非 .com）`);
      skippedAbsorb++;
      continue;
    }
    const parent = await prisma.category.findFirst({
      where: { code: item.parentCode },
      select: { id: true, nameZh: true },
    });
    if (!parent) {
      console.warn(`[t03] ⚠️ 父节点 code=${item.parentCode} 未找到，跳过 ${item.zh}（${item.id}）并入`);
      skippedAbsorb++;
      continue;
    }
    // 该 code 是否已被别的行占用（唯一键）；占用则 WARN 跳过，不覆盖他人数据
    const codeOwner = await prisma.category.findFirst({
      where: { code: item.code },
      select: { id: true, nameZh: true },
    });
    if (codeOwner && codeOwner.id !== item.id) {
      console.warn(
        `[t03] ⚠️ code=${item.code} 已被 ${codeOwner.nameZh}（${codeOwner.id}）占用，跳过 ${item.zh}（${item.id}）的 code 写入`,
      );
      skippedAbsorb++;
      continue;
    }
    if (existing.code && existing.code !== item.code) {
      console.log(`  [skip] ${item.zh}（${item.id}）已有 code=${existing.code}，视为已并入`);
      skippedAbsorb++;
      continue;
    }

    if (APPLY) {
      // nameZh 不动（前台/卖家已按中文名习惯使用）；只补字典三件套 + isLeaf
      await prisma.category.update({
        where: { id: item.id },
        data: { nameEn: item.nameEn, parentId: parent.id, isLeaf: true },
      });
      // code 单独写：捕获 P2002 唯一键冲突，WARN 跳过，不中断整批
      try {
        await prisma.category.update({ where: { id: item.id }, data: { code: item.code } });
      } catch (e: any) {
        if (e?.code === "P2002") {
          console.warn(`[t03] ⚠️ code=${item.code} 写入冲突（P2002），${item.zh}（${item.id}）的 code 跳过，待人工归并`);
        } else {
          throw e;
        }
      }
      console.log(`  [apply] 并入 ${item.zh} → code=${item.code} en=${item.nameEn} parent=${item.parentCode}（${parent.nameZh}）isLeaf=true`);
    } else {
      console.log(
        `  [dry] 将并入 ${item.zh}（${item.id}）→ code=${item.code} en=${item.nameEn} parent=${item.parentCode}（${parent.nameZh}）isLeaf=true（nameZh 保留）`,
      );
    }
    absorbed++;
  }
  console.log(`[t03] 并入：将并入 ${absorbed} 条 | 跳过 ${skippedAbsorb} 条`);

  console.log(
    `[t03] 汇总：将迁移 ${migratedProducts} 台商品 / 将并入 ${absorbed} 条 / 将删除 ${deletedOrphans} 条孤儿` +
      `${APPLY ? "" : "（DRY-RUN，未写库）"}`,
  );
  console.log(APPLY ? "[t03] --apply 完成" : "[t03] DRY-RUN 完成，未写库");
}

main()
  .catch((e) => { console.error("[t03] 失败:", e); process.exitCode = 1; })
  .finally(async () => { await prisma.$disconnect(); });
