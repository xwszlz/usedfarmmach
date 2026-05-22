/**
 * 从出口农机库存表.xlsx补录缺失产品
 * 执行：npx tsx scripts/import-missing-products.ts
 */
import { PrismaClient } from "@prisma/client";
import * as fs from "fs";

const prisma = new PrismaClient();

// 品牌映射：Excel品牌名 → 数据库brandId
const BRAND_MAP: Record<string, { id: string; nameZh: string; nameEn: string; originCountry: string; isImported: boolean }> = {
  "克拉斯": { id: "claas", nameZh: "克拉斯", nameEn: "CLAAS", originCountry: "DE", isImported: true },
  "克罗尼": { id: "krone", nameZh: "克罗尼", nameEn: "Krone", originCountry: "DE", isImported: true },
  "纽荷兰": { id: "new-holland", nameZh: "纽荷兰", nameEn: "New Holland", originCountry: "US", isImported: true },
  "迪尔": { id: "john-deere", nameZh: "约翰迪尔", nameEn: "John Deere", originCountry: "US", isImported: true },
  "约翰迪尔": { id: "john-deere", nameZh: "约翰迪尔", nameEn: "John Deere", originCountry: "US", isImported: true },
  "奥库": { id: "orkel", nameZh: "奥库", nameEn: "Orkel", originCountry: "NO", isImported: true },
  "凯斯": { id: "case-ih", nameZh: "凯斯", nameEn: "Case IH", originCountry: "US", isImported: true },
  "芬特": { id: "fendt", nameZh: "芬特", nameEn: "Fendt", originCountry: "DE", isImported: true },
  "迈科农机": { id: "maike", nameZh: "迈科农机", nameEn: "Maike", originCountry: "CN", isImported: false },
  "东洋": { id: "toyonoki", nameZh: "东洋", nameEn: "Toyonoki", originCountry: "JP", isImported: true },
  "马赛": { id: "massey", nameZh: "马赛", nameEn: "Massey Ferguson", originCountry: "US", isImported: true },
  "康斯凯尔": { id: "kongskilde", nameZh: "康斯凯尔", nameEn: "Kongskilde", originCountry: "DK", isImported: true },
  "牧神": { id: "mushen", nameZh: "牧神", nameEn: "Mushen", originCountry: "CN", isImported: false },
  "盈嘉": { id: "yingjia", nameZh: "盈嘉", nameEn: "Yingjia", originCountry: "CN", isImported: false },
  "格立莫": { id: "grimme", nameZh: "格立莫", nameEn: "Grimme", originCountry: "DE", isImported: true },
  "都麦": { id: "dorma", nameZh: "都麦", nameEn: "Dorma", originCountry: "DE", isImported: true },
  "库恩": { id: "kuhn", nameZh: "库恩", nameEn: "Kuhn", originCountry: "FR", isImported: true },
  "爱科麦赛弗格森": { id: "massey-ferguson", nameZh: "爱科麦赛弗格森", nameEn: "Massey Ferguson", originCountry: "US", isImported: true },
  "东方红": { id: "dongfanghong", nameZh: "东方红", nameEn: "Dongfanghong", originCountry: "CN", isImported: false },
  "德翔": { id: "dexiang", nameZh: "德翔", nameEn: "Dexiang", originCountry: "CN", isImported: false },
  "格兰": { id: "grain", nameZh: "格兰", nameEn: "Grain", originCountry: "NO", isImported: true },
  "arcusln": { id: "arcusin", nameZh: "Arcusin", nameEn: "Arcusin", originCountry: "SE", isImported: true },
};

// 品类映射
const CATEGORY_MAP: Record<string, { id: string; nameZh: string; nameEn: string }> = {
  "打捆机": { id: "baler", nameZh: "打捆机", nameEn: "Baler" },
  "割草机": { id: "mower", nameZh: "割草机", nameEn: "Mower" },
  "青储机": { id: "forage-harvester", nameZh: "青储机", nameEn: "Forage Harvester" },
  "裹包机": { id: "wrapper", nameZh: "裹包机", nameEn: "Bale Wrapper" },
  "捡石机": { id: "stone-picker", nameZh: "捡石机", nameEn: "Stone Picker" },
  "搂草机": { id: "rake", nameZh: "搂草机", nameEn: "Rake" },
  "捡拾台": { id: "pickup", nameZh: "捡拾台", nameEn: "Pickup Header" },
  "割台-直收": { id: "header", nameZh: "割台", nameEn: "Header" },
  "码垛机": { id: "stacker", nameZh: "码垛机", nameEn: "Stacker" },
  "拖拉机": { id: "tractor", nameZh: "拖拉机", nameEn: "Tractor" },
  "茎穗双收": { id: "corn-harvester", nameZh: "茎穗兼收机", nameEn: "Corn Harvester" },
  "茎穗兼收机": { id: "corn-harvester", nameZh: "茎穗兼收机", nameEn: "Corn Harvester" },
  "收获机": { id: "harvester", nameZh: "收获机", nameEn: "Harvester" },
  "胡萝卜采收机": { id: "harvester", nameZh: "收获机", nameEn: "Harvester" },
  "精播机（气吸）": { id: "seeder", nameZh: "播种机", nameEn: "Seeder" },
  "条播机（气吹式）": { id: "seeder", nameZh: "播种机", nameEn: "Seeder" },
  "圆捆打包缠膜机": { id: "baler", nameZh: "打捆机", nameEn: "Baler" },
  "圆捆打捆机": { id: "baler", nameZh: "打捆机", nameEn: "Baler" },
  "圆捆机（铝滚式）": { id: "baler", nameZh: "打捆机", nameEn: "Baler" },
  "圆捆机（皮带）": { id: "baler", nameZh: "打捆机", nameEn: "Baler" },
  "伸缩臂夹包机": { id: "handler", nameZh: "伸缩臂夹包机", nameEn: "Telehandler" },
};

// 缺失产品数据
const MISSING_PRODUCTS = [
  { brand: "克罗尼", model: "1270XC", year: 0, priceWan: 11.8, type: "打捆机", desc: "1685小时，20360包" },
  { brand: "克罗尼", model: "big420割草机", year: 2007, priceWan: 49.0, type: "割草机", desc: "3折，40迈.3670小时" },
  { brand: "都麦", model: "6200", year: 2022, priceWan: 29.0, type: "割台-直收", desc: "全新，割燕麦，可挂接克拉斯，纽荷兰，克罗尼" },
  { brand: "格立莫", model: "1000", year: 2016, priceWan: 30.0, type: "胡萝卜采收机", desc: "背负式，单行，重型收获机三点悬挂背负式 160马力拖拉机可带，配备335厘米夹拔皮带" },
  { brand: "克拉斯", model: "300", year: 2018, priceWan: 9.0, type: "捡拾台", desc: "3米 挂接克拉斯8系" },
  { brand: "克拉斯", model: "PU300", year: 2021, priceWan: 5.0, type: "捡拾台", desc: "配克拉斯" },
  { brand: "库恩", model: "法国精播机", year: 2011, priceWan: 13.0, type: "精播机（气吸）", desc: "2个种仓，1个260升。播种9行，宽度7米 播种玉米、豆类、葵花、高粱等作物" },
  { brand: "arcusln", model: "FSX63·72", year: 2014, priceWan: 48.0, type: "码垛机", desc: "捡拾装车码垛一体机 配备动力130马力以上拖拉机" },
  { brand: "迪尔", model: "6950", year: 2000, priceWan: 11.0, type: "青储机", desc: "发动机良好，割台良好，两驱发动机，500多马力" },
  { brand: "迪尔", model: "7180", year: 2014, priceWan: 27.0, type: "青储机", desc: "迪尔发动机，二驱380马力，发动机5420小时，轧辊3675小时，冠军445割台，4.5米宽" },
  { brand: "迪尔", model: "8400", year: 2016, priceWan: 68.0, type: "青储机", desc: "轧辊小时数：1985 发动机小时数：4095 540马力 两驱 冠军445割台 2017年出厂 4.5米" },
  { brand: "克拉斯", model: "850", year: 2010, priceWan: 38.5, type: "青储机", desc: "轧辊小时数：4053 发动机小时数：5245 发动机马力：412 二驱 冠军345割台 4.5米" },
  { brand: "克拉斯", model: "850", year: 2020, priceWan: 119.0, type: "青储机", desc: "轧辊小时数：1515 发动机小时数：2444 发动机马力：430 二驱 奥贝斯割台450 2020年出厂 4.5米" },
  { brand: "克拉斯", model: "890", year: 2008, priceWan: 32.0, type: "青储机", desc: "冠军割台，4.5米510马力，四驱 发动机小时数：7700 轧辊小时数：5234" },
  { brand: "克拉斯", model: "970（欧版）", year: 2017, priceWan: 163.0, type: "青储机", desc: "轧辊小时数：2965 发动机小时数：4125 四驱 775马力 奥贝斯750割台 2014年7.5米" },
  { brand: "克罗尼", model: "600", year: 2014, priceWan: 63.0, type: "青储机", desc: "轧辊小时数：2898 发动机小时数:4262 克罗尼割台603 2014出厂 宽度6米" },
  { brand: "纽荷兰", model: "FR450", year: 2013, priceWan: 21.5, type: "青储机", desc: "纽荷兰450，轧辊3250 发动机马力400 发动机4600小时 二驱 2013年冠军445割台" },
  { brand: "纽荷兰", model: "FR450（四驱）", year: 2013, priceWan: 35.0, type: "青储机", desc: "菲亚特发动机马力420，四驱，工作3306小时，发动机小时数4369，割台鑫万达445，宽度4.5" },
  { brand: "纽荷兰", model: "FR500（9040）", year: 2015, priceWan: 35.0, type: "青储机", desc: "500马力四驱 轧辊小时数：3527 发动机小时数：4667 冠军割台445 2013年 4.5米" },
  { brand: "格兰", model: "挪威条播机", year: 2017, priceWan: 12.0, type: "条播机（气吹式）", desc: "4米宽，自重3吨 进口2204拖拉机以上可带，只能播种小颗粒作物" },
  { brand: "东方红", model: "LX2004", year: 2023, priceWan: 26.5, type: "拖拉机", desc: "全新 国四 四驱200马力 重托" },
  { brand: "爱科麦赛弗格森", model: "3404", year: 2022, priceWan: 105.0, type: "拖拉机", desc: "四驱340马力，前悬挂,2986小时,烧尿素" },
  { brand: "德翔", model: "9YDB-0.5", year: 2025, priceWan: 1.6, type: "圆捆机（铝滚式）", desc: "整机重600kg，打捆电机功率5.5kw，工作效率50-70捆/小时" },
  { brand: "德翔", model: "9YY-0.5", year: 2025, priceWan: 2.5, type: "圆捆机（皮带）", desc: "整机重800kg，打捆电机功率7.5kw，工作效率50-70捆/小时" },
  { brand: "库恩", model: "890大方捆", year: 2014, priceWan: 8.0, type: "打捆机", desc: "轮胎良好、四道绳、捡拾宽度2.1米、草捆宽80高度80-90" },
];

async function main() {
  console.log("📦 开始补录缺失产品...\n");

  // Get or create admin user
  let adminUser = await prisma.user.findFirst({ where: { role: "admin" } });
  if (!adminUser) {
    adminUser = await prisma.user.create({
      data: {
        email: "admin@usedfarmmach.com",
        passwordHash: "$2a$10$placeholder",
        role: "admin",
        companyName: "神雕农机",
        country: "CN",
      },
    });
    console.log("  ✅ 创建管理员用户");
  }

  // Ensure brands exist
  for (const [key, brandData] of Object.entries(BRAND_MAP)) {
    const existing = await prisma.brand.findFirst({ where: { id: brandData.id } });
    if (!existing) {
      await prisma.brand.create({ data: brandData });
      console.log(`  ✅ 创建品牌: ${brandData.nameZh}`);
    }
  }

  // Ensure categories exist
  for (const [key, catData] of Object.entries(CATEGORY_MAP)) {
    const existing = await prisma.category.findFirst({ where: { id: catData.id } });
    if (!existing) {
      await prisma.category.create({ data: catData });
      console.log(`  ✅ 创建品类: ${catData.nameZh}`);
    }
  }

  // Import missing products
  let imported = 0;
  for (const prod of MISSING_PRODUCTS) {
    const brandData = BRAND_MAP[prod.brand];
    const catData = CATEGORY_MAP[prod.type];
    if (!brandData || !catData) {
      console.log(`  ⏭️ 跳过 ${prod.brand} ${prod.model}（品牌或品类未映射）`);
      continue;
    }

    // Check if already exists (by brand+model+year)
    const existingBrand = await prisma.brand.findFirst({ where: { id: brandData.id } });
    if (!existingBrand) continue;

    const existing = await prisma.product.findFirst({
      where: {
        brandId: brandData.id,
        modelName: prod.model,
        year: prod.year || 0,
      },
    });

    if (existing) {
      console.log(`  ⏭️ 已存在: ${prod.brand} ${prod.model} (${prod.year})`);
      continue;
    }

    const priceCny = prod.priceWan * 10000; // 万元 → 元
    const priceUsd = Math.round(prod.priceWan * 10000 / 7.25); // 美元

    await prisma.product.create({
      data: {
        sellerId: adminUser.id,
        brandId: brandData.id,
        categoryId: catData.id,
        modelName: prod.model,
        year: prod.year || 0,
        condition: "good",
        priceCny: priceCny,
        priceUsd: priceUsd,
        location: "河北",
        descriptionZh: prod.desc,
        descriptionEn: prod.desc,
        status: "active",
      },
    });

    console.log(`  ✅ 导入: ${prod.brand} ${prod.model} (${prod.year}) - ${prod.priceWan}万`);
    imported++;
  }

  console.log(`\n🎉 完成！新增 ${imported} 个产品`);

  // Summary
  const total = await prisma.product.count();
  console.log(`📊 数据库总产品数: ${total}`);

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
