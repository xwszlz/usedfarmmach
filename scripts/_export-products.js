const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
p.product.findMany({
  where: { status: 'active' },
  select: {
    id:true, modelName:true, year:true, priceCny:true,
    condition:true, workingHours:true, location:true,
    brand:{select:{nameZh:true,nameEn:true}},
    category:{select:{nameZh:true}}
  },
  orderBy: { priceCny: 'desc' }
}).then(ps => {
  require('fs').writeFileSync(
    'D:/神雕农机/神雕日报/_temp_products.json',
    JSON.stringify(ps.map(p=>({...p,
      brandNameZh:p.brand?.nameZh||'',brandNameEn:p.brand?.nameEn||'',
      categoryName:p.category?.nameZh||''
    })))
  );
  process.exit(0);
});
