const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// 俄语品牌名称映射
const brandRuNames = {
  'CLAAS': 'КЛААС',
  'Krone': 'Кроне',
  'New Holland': 'Нью Холланд',
  'John Deere': 'Джон Дир',
  'Orkel': 'Оркель',
  'Case IH': 'Кейс АЙ-ЭЙЧ',
  'Fendt': 'Фендт',
  'Maike': 'Майке',
  'Toyonoki': 'Тойоноки',
  'Grimme': 'Гримме',
  'Kuhn': 'Кун',
  'Arcusin': 'Аркусин',
  'Massey Ferguson': 'Массей Фергюсон',
  'Dongfanghong': 'Дунфанхун',
  'Dexiang': 'Дэсян',
  'Mushen': 'Мушэнь',
  'Yingjia': 'Инцзя',
};

// 俄语品类名称映射
const categoryRuNames = {
  '青储机': 'Силосоуборочный комбайн',
  '打捆机': 'Пресс-подборщик',
  '割草机': 'Косилка',
  '裹包机': 'Упаковщик',
  '捡石机': 'Камнеподборщик',
  '搂草机': 'Грабли',
  '收获机': 'Уборочная машина',
  '拖拉机': 'Трактор',
  '播种机': 'Сеялка',
  '码垛机': 'Паллетайзер',
  '捡拾台': 'Подборщик',
  '割台': 'Жатка',
  '茎穗兼收机': 'Комбайн для стеблей и початков',
};

async function main() {
  // 更新品牌俄语名称
  const brands = await prisma.brand.findMany();
  let updatedBrands = 0;
  
  for (const brand of brands) {
    const ruName = brandRuNames[brand.nameEn] || brandRuNames[brand.nameZh] || brand.nameEn;
    await prisma.brand.update({
      where: { id: brand.id },
      data: { nameRu: ruName }
    });
    updatedBrands++;
  }
  console.log(`已更新 ${updatedBrands} 个品牌的俄语名称`);

  // 更新品类俄语名称
  const categories = await prisma.category.findMany();
  let updatedCategories = 0;
  
  for (const cat of categories) {
    const ruName = categoryRuNames[cat.nameZh] || cat.nameEn;
    await prisma.category.update({
      where: { id: cat.id },
      data: { nameRu: ruName }
    });
    updatedCategories++;
  }
  console.log(`已更新 ${updatedCategories} 个品类的俄语名称`);

  // 产品俄语描述暂留空（后续可用AI翻译补录）
  const productsWithoutRuDesc = await prisma.product.count({
    where: { descriptionRu: null }
  });
  console.log(`${productsWithoutRuDesc} 个产品缺少俄语描述（可后续补充）`);
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });