import { PrismaClient } from "@prisma/client";
import * as fs from "fs";
import * as path from "path";

const prisma = new PrismaClient();

interface ImportProduct {
  modelName: string;
  brandName: string;
  categoryName: string;
  year: number;
  workingHours: number | null;
  condition: string;
  priceCny: number;
  priceUsd: number | null;
  location: string;
  descriptionZh: string;
  descriptionEn: string;
}

const sampleProducts: ImportProduct[] = [
  {
    modelName: "504",
    brandName: "john-deere",
    categoryName: "tractor",
    year: 2020,
    workingHours: 1200,
    condition: "good",
    priceCny: 185000,
    priceUsd: 22000,
    location: "山东",
    descriptionZh: "约翰迪尔504拖拉机，2020年出厂，工作1200小时，车况良好。配备动力换挡变速箱，空调驾驶室。",
    descriptionEn: "John Deere 504 tractor, 2020 model, 1200 working hours, good condition. Power shift transmission, AC cabin.",
  },
  {
    modelName: "954",
    brandName: "john-deere",
    categoryName: "tractor",
    year: 2019,
    workingHours: 2500,
    condition: "good",
    priceCny: 350000,
    priceUsd: 42000,
    location: "河南",
    descriptionZh: "约翰迪尔954大马力拖拉机，适合大面积农田作业，配置高，性能稳定。",
    descriptionEn: "John Deere 954 high-horsepower tractor, suitable for large-scale farming, high configuration, stable performance.",
  },
  {
    modelName: "LX954",
    brandName: "kubota",
    categoryName: "tractor",
    year: 2021,
    workingHours: 800,
    condition: "excellent",
    priceCny: 280000,
    priceUsd: 35000,
    location: "江苏",
    descriptionZh: "久保田LX954拖拉机，2021年出厂，仅800小时，车况优秀。低油耗，操控灵活。",
    descriptionEn: "Kubota LX954 tractor, 2021 model, only 800 hours, excellent condition. Low fuel consumption, agile handling.",
  },
  {
    modelName: "PRO688Q",
    brandName: "kubota",
    categoryName: "combine",
    year: 2020,
    workingHours: 600,
    condition: "excellent",
    priceCny: 420000,
    priceUsd: 55000,
    location: "黑龙江",
    descriptionZh: "久保田PRO688Q收割机，半喂入式，适合水稻收割，低损耗率高效率。",
    descriptionEn: "Kubota PRO688Q combine harvester, half-feed type, ideal for rice harvesting, low loss rate and high efficiency.",
  },
  {
    modelName: "AF4088",
    brandName: "case-ih",
    categoryName: "combine",
    year: 2018,
    workingHours: 1800,
    condition: "fair",
    priceCny: 520000,
    priceUsd: 68000,
    location: "河北",
    descriptionZh: "凯斯AF4088联合收割机，轴流式设计，适合多种作物收割，性价比高。",
    descriptionEn: "Case IH AF4088 combine harvester, axial-flow design, suitable for multiple crops, great value.",
  },
  {
    modelName: "T6030",
    brandName: "new-holland",
    categoryName: "tractor",
    year: 2017,
    workingHours: 3200,
    condition: "fair",
    priceCny: 230000,
    priceUsd: 28000,
    location: "山东",
    descriptionZh: "纽荷兰T6030拖拉机，大马力，适合重负荷作业，维护保养及时。",
    descriptionEn: "New Holland T6030 tractor, high horsepower, suitable for heavy-duty operations, well maintained.",
  },
  {
    modelName: "M1204",
    brandName: "lovol",
    categoryName: "tractor",
    year: 2022,
    workingHours: 500,
    condition: "excellent",
    priceCny: 160000,
    priceUsd: null,
    location: "河南",
    descriptionZh: "雷沃M1204拖拉机，国四排放，新机状态，性价比极高。",
    descriptionEn: "Lovol M1204 tractor, China IV emission, near-new condition, excellent value.",
  },
  {
    modelName: "GN80",
    brandName: "dongfeng",
    categoryName: "tractor",
    year: 2021,
    workingHours: 900,
    condition: "good",
    priceCny: 95000,
    priceUsd: null,
    location: "江苏",
    descriptionZh: "东风GN80拖拉机，小巧灵活，适合大棚和丘陵地区作业。",
    descriptionEn: "Dongfeng GN80 tractor, compact and agile, ideal for greenhouse and hilly terrain.",
  },
  {
    modelName: "2BQF-6",
    brandName: "lovol",
    categoryName: "planter",
    year: 2022,
    workingHours: 200,
    condition: "excellent",
    priceCny: 45000,
    priceUsd: null,
    location: "黑龙江",
    descriptionZh: "雷沃2BQF-6气吸式播种机，6行精量播种，出苗率高。",
    descriptionEn: "Lovol 2BQF-6 pneumatic planter, 6-row precision planting, high germination rate.",
  },
  {
    modelName: "3WP-600",
    brandName: "lovol",
    categoryName: "sprayer",
    year: 2021,
    workingHours: 350,
    condition: "good",
    priceCny: 78000,
    priceUsd: null,
    location: "山东",
    descriptionZh: "雷沃3WP-600自走式喷杆喷雾机，600L药箱，喷幅12米。",
    descriptionEn: "Lovol 3WP-600 self-propelled sprayer, 600L tank, 12m boom width.",
  },
];

async function main() {
  const seller = await prisma.user.findFirst({
    where: { role: "seller" },
  });

  if (!seller) {
    console.error("No seller found. Run seed.ts first.");
    process.exit(1);
  }

  for (const item of sampleProducts) {
    const brand = await prisma.brand.findFirst({
      where: {
        OR: [{ id: item.brandName }, { nameEn: item.brandName }],
      },
    });
    if (!brand) {
      console.warn(`Brand not found: ${item.brandName}, skipping`);
      continue;
    }

    const category = await prisma.category.findFirst({
      where: {
        OR: [{ id: item.categoryName }, { nameEn: item.categoryName }],
      },
    });
    if (!category) {
      console.warn(`Category not found: ${item.categoryName}, skipping`);
      continue;
    }

    const product = await prisma.product.create({
      data: {
        sellerId: seller.id,
        brandId: brand.id,
        categoryId: category.id,
        modelName: item.modelName,
        year: item.year,
        workingHours: item.workingHours,
        condition: item.condition,
        priceCny: item.priceCny,
        priceUsd: item.priceUsd,
        location: item.location,
        descriptionZh: item.descriptionZh,
        descriptionEn: item.descriptionEn,
        status: "active",
      },
    });

    // Create a placeholder image
    await prisma.productImage.create({
      data: {
        productId: product.id,
        url: "/images/placeholders/tractor.svg",
        sortOrder: 0,
        isPrimary: true,
      },
    });

    console.log(`Created product: ${brand.nameEn} ${item.modelName}`);
  }

  console.log("Data import completed!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
