const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const p = new PrismaClient();

async function main() {
  const productId = 'cmpzm1oh0001eyllprbd1yd3t';
  const data = JSON.parse(fs.readFileSync('D:/神雕农机/scripts/falanxin_upload_result.json', 'utf-8'));

  // 先删除该产品的旧图片记录（如果有）
  const deleted = await p.productImage.deleteMany({ where: { productId } });
  console.log(`清理旧记录: ${deleted.count} 条`);

  // 创建新图片记录
  for (const item of data) {
    await p.productImage.create({
      data: {
        productId,
        url: item.url,
        sortOrder: item.sort_order,
        isPrimary: item.is_primary,
      }
    });
    console.log(`  ✅ ${item.filename} ${item.is_primary ? '【封面】' : ''}`);
  }

  console.log(`\n✅ 共创建 ${data.length} 条图片记录`);
}

main().catch(e => { console.error('❌', e.message); process.exit(1); }).finally(() => p.$disconnect());
