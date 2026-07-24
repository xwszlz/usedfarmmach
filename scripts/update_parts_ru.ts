import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';

const prisma = new PrismaClient();

async function main() {
  // 读翻译结果
  const data = JSON.parse(fs.readFileSync('D:/神雕农机/deliverables/marketing-campaign/parts-ru-names-2026-07-24.json', 'utf-8'));
  const parts = data || []; // 兼容包装体
  const entries = Array.isArray(parts) ? parts : (parts.parts || []);

  console.log(`读入 ${entries.length} 条俄文名`);

  let updated = 0;
  let errors = 0;

  for (const entry of entries) {
    try {
      const r = await prisma.part.updateMany({
        where: { sku: entry.sku },
        data: { nameRu: entry.nameRu },
      });
      if (r.count > 0) updated++;
    } catch (e) {
      console.error(`  ✗ ${entry.sku}: ${e instanceof Error ? e.message : String(e)}`);
      errors++;
    }
  }

  console.log(`\n更新完成：成功 ${updated} 条，失败 ${errors} 条`);
  await prisma.$disconnect();
}

main();
