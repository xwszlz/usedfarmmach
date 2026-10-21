/**
 * 诊断 Brand.code 唯一键冲突：拉全部品牌，按 code 分组找重复。
 */
import { PrismaClient } from "@prisma/client";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL 未设置");
  process.exit(2);
}
const prisma = new PrismaClient({ datasources: { db: { url } } });

async function main() {
  const brands = await prisma.brand.findMany({
    where: { code: { not: null } },
    select: { id: true, code: true, nameEn: true, nameZh: true },
  });
  console.log(`非 null code 品牌数 = ${brands.length}`);
  const map = new Map<string, typeof brands>();
  for (const b of brands) {
    const k = b.code as string;
    if (!map.has(k)) map.set(k, []);
    map.get(k)!.push(b);
  }
  const dups = [...map.entries()].filter(([, v]) => v.length > 1);
  console.log(`重复 code 组数 = ${dups.length}`);
  for (const [code, arr] of dups) {
    console.log(`\n  code=${JSON.stringify(code)} n=${arr.length}`);
    for (const b of arr) {
      console.log(`      id=${b.id}  ${b.nameEn ?? ""}/${b.nameZh ?? ""}`);
    }
  }
}

async function run() {
  let lastErr: unknown;
  for (let i = 1; i <= 8; i++) {
    try {
      await main();
      await prisma.$disconnect();
      return;
    } catch (e) {
      lastErr = e;
      console.warn(`连接失败第${i}次，${2}s 重试…`);
      await new Promise((r) => setTimeout(r, 2000));
    }
  }
  console.error("最终失败:", lastErr);
  process.exit(1);
}

run().catch((e) => { console.error(e); process.exit(1); });
