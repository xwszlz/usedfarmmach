const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

async function main() {
  const imgs = await p.productImage.findMany({
    where: { productId: 'cmpzm1r610030yllp7jcxhfv5' },
    orderBy: { sortOrder: 'asc' },
    select: { id: true, url: true, sortOrder: true, isPrimary: true }
  });
  console.log('Total images:', imgs.length);
  imgs.forEach((i, idx) => {
    const fname = i.url.substring(i.url.lastIndexOf('/'));
    console.log('[' + idx + '] sort=' + i.sortOrder + ' primary=' + (i.isPrimary ? 'YES' : '  ') + ' ' + fname);
  });
  await p.$disconnect();
}
main();
