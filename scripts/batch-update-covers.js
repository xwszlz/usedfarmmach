const fs = require('fs');
const path = require('path');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();
const prod = new PrismaClient({
  datasources: { db: { url: 'postgresql://neondb_owner:npg_2axm9AIJpTSL@ep-silent-dust-aohnq8uc.c-2.ap-southeast-1.aws.neon.tech/neondb?sslmode=require' } }
});

const DST_BASE = 'D:/神雕农机/usedfarmmach/public/images/products';
const SKIP_IDS = new Set(['cmpfohy08000tkrh5vaaw12nd', 'cmpdknitp001v11kwskpdqx6s']);

// 匹配数据库产品
async function matchProduct(brand, model, year) {
  const products = await prisma.product.findMany({
    where: { brand: { nameZh: { contains: brand } }, modelName: model, year },
    include: { brand: true },
  });
  const p = products.find(p => !SKIP_IDS.has(p.id));
  return p || null;
}

// 更新DB封面
async function updateCover(db, label, productId, coverUrl) {
  await db.productImage.updateMany({ where: { productId, isPrimary: true }, data: { isPrimary: false } });
  const existing = await db.productImage.findFirst({ where: { productId, url: coverUrl } });
  if (existing) {
    await db.productImage.update({ where: { id: existing.id }, data: { isPrimary: true, sortOrder: 0 } });
    console.log(`  ${label}: updated → PRIMARY`);
  } else {
    await db.productImage.create({ data: { productId, url: coverUrl, isPrimary: true, sortOrder: 0 } });
    console.log(`  ${label}: created → PRIMARY`);
  }
}

async function main() {
  // 找到所有临时文件夹
  const tmpDirs = fs.readdirSync(DST_BASE).filter(d => d.startsWith('_tmp_'));
  console.log(`Found ${tmpDirs.length} temp folders\n`);

  let count = 0;
  for (const dir of tmpDirs) {
    // 解析: _tmp_品牌_型号_年份
    const parts = dir.replace('_tmp_', '').split('_');
    const year = parseInt(parts[parts.length - 1]);
    const model = parts[parts.length - 2];
    const brand = parts.slice(0, parts.length - 2).join('_');

    const product = await matchProduct(brand, model, year);
    if (!product) {
      console.log(`SKIP: ${brand} ${model} (${year}) — no DB match`);
      continue;
    }

    // 重命名文件夹为 productId
    const tmpPath = path.join(DST_BASE, dir);
    const finalDir = path.join(DST_BASE, product.id);
    if (!fs.existsSync(finalDir)) {
      fs.renameSync(tmpPath, finalDir);
    } else {
      // 如果已存在，只移动 cover.jpg
      const coverSrc = path.join(tmpPath, 'cover.jpg');
      const coverDst = path.join(finalDir, 'cover.jpg');
      if (fs.existsSync(coverSrc)) {
        fs.copyFileSync(coverSrc, coverDst);
      }
    }

    const coverUrl = `/images/products/${product.id}/cover.jpg`;

    // 更新本地 + 生产DB
    await updateCover(prisma, 'LOCAL', product.id, coverUrl);
    await updateCover(prod, 'PROD', product.id, coverUrl);

    count++;
    console.log(`${count}. ✅ ${product.brand?.nameZh || brand} ${product.modelName} (${product.year}) → ${coverUrl}\n`);
  }

  console.log(`Total: ${count} products updated`);
}

main()
  .then(() => { prisma.$disconnect(); prod.$disconnect(); })
  .catch(e => { console.error(e); prisma.$disconnect(); prod.$disconnect(); });
