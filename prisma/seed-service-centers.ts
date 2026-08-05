/**
 * 服务网点种子数据
 * 运行: npx tsx prisma/seed-service-centers.ts
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const SERVICE_CENTERS = [
  // 河北省 — 省级中心
  {
    name: "神雕农机河北省服务中心",
    level: "province",
    province: "河北",
    city: "石家庄",
    district: null,
    address: "石家庄市裕华区裕华东路88号",
    contactPerson: "张经理",
    contactPhone: "0311-88888001",
    services: ["inspection", "valuation", "trade", "parts"],
    businessHours: "8:30-17:30（周一至周六）",
    description: "省级综合服务中心，提供设备检测、评估鉴定、交易撮合、配件供应",
  },
  // 河北省 — 县域网点
  {
    name: "衡水桃城区服务点",
    level: "county",
    province: "河北",
    city: "衡水",
    district: "桃城区",
    address: "衡水市桃城区人民东路56号",
    contactPerson: "李工",
    contactPhone: "0318-2222001",
    services: ["inspection", "repair"],
    businessHours: "8:30-17:00（周一至周五）",
  },
  {
    name: "邢台宁晋县服务点",
    level: "county",
    province: "河北",
    city: "邢台",
    district: "宁晋县",
    address: "邢台市宁晋县凤凰路北段",
    contactPerson: "王工",
    contactPhone: "0319-5858001",
    services: ["inspection", "repair", "parts"],
    businessHours: "8:30-17:00（周一至周五）",
  },
  // 山东省
  {
    name: "神雕农机山东省服务中心",
    level: "province",
    province: "山东",
    city: "济南",
    district: null,
    address: "济南市历下区经十路9999号",
    contactPerson: "赵经理",
    contactPhone: "0531-88888002",
    services: ["inspection", "valuation", "trade", "parts", "transport"],
    businessHours: "8:30-17:30（周一至周六）",
    description: "省级综合服务中心",
  },
  {
    name: "潍坊寿光服务点",
    level: "county",
    province: "山东",
    city: "潍坊",
    district: "寿光市",
    address: "潍坊市寿光市圣城街道",
    contactPerson: "刘工",
    contactPhone: "0536-5222001",
    services: ["inspection", "repair"],
    businessHours: "8:30-17:00（周一至周五）",
  },
  // 河南省
  {
    name: "神雕农机河南省服务中心",
    level: "province",
    province: "河南",
    city: "郑州",
    district: null,
    address: "郑州市金水区花园路100号",
    contactPerson: "陈经理",
    contactPhone: "0371-88888003",
    services: ["inspection", "valuation", "trade", "parts"],
    businessHours: "8:30-17:30（周一至周六）",
  },
  {
    name: "洛阳孟津服务点",
    level: "county",
    province: "河南",
    city: "洛阳",
    district: "孟津区",
    address: "洛阳市孟津区城关镇",
    contactPerson: "杨工",
    contactPhone: "0379-6799001",
    services: ["inspection", "repair", "parts"],
    businessHours: "8:30-17:00（周一至周五）",
  },
  // 内蒙古
  {
    name: "神雕农机内蒙古服务中心",
    level: "province",
    province: "内蒙古",
    city: "呼和浩特",
    district: null,
    address: "呼和浩特市赛罕区大学东路",
    contactPerson: "宝经理",
    contactPhone: "0471-88888004",
    services: ["inspection", "valuation", "trade", "parts", "transport"],
    businessHours: "8:30-17:30（周一至周六）",
    description: "辐射呼伦贝尔、锡林郭勒等牧区",
  },
  // 黑龙江
  {
    name: "神雕农机黑龙江服务中心",
    level: "province",
    province: "黑龙江",
    city: "哈尔滨",
    district: null,
    address: "哈尔滨市南岗区红旗大街",
    contactPerson: "孙经理",
    contactPhone: "0451-88888005",
    services: ["inspection", "valuation", "trade", "parts"],
    businessHours: "8:30-17:30（周一至周六）",
  },
  // 江苏
  {
    name: "神雕农机江苏省服务中心",
    level: "province",
    province: "江苏",
    city: "南京",
    district: null,
    address: "南京市建邺区江东中路",
    contactPerson: "周经理",
    contactPhone: "025-88888006",
    services: ["inspection", "valuation", "trade", "parts", "transport"],
    businessHours: "8:30-17:30（周一至周六）",
  },
  // 新疆
  {
    name: "神雕农机新疆服务中心",
    level: "province",
    province: "新疆",
    city: "乌鲁木齐",
    district: null,
    address: "乌鲁木齐市新市区北京路",
    contactPerson: "马经理",
    contactPhone: "0991-88888007",
    services: ["inspection", "valuation", "trade", "parts", "transport"],
    businessHours: "9:00-18:00（周一至周六）",
    description: "辐射南疆北疆大型农场",
  },
];

async function main() {
  console.log("开始播种服务网点数据...");

  for (const center of SERVICE_CENTERS) {
    const existing = await prisma.serviceCenter.findFirst({
      where: { name: center.name },
    });

    if (existing) {
      console.log(`  跳过已存在: ${center.name}`);
      continue;
    }

    await prisma.serviceCenter.create({
      data: {
        ...center,
        services: JSON.stringify(center.services),
      } as any,
    });
    console.log(`  创建: ${center.name}`);
  }

  const total = await prisma.serviceCenter.count();
  console.log(`\n完成! 共 ${total} 个服务网点`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
