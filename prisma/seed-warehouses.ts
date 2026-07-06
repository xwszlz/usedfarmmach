/**
 * 海外仓种子数据
 * 运行: npx tsx prisma/seed-warehouses.ts
 * 覆盖：中亚、俄罗斯、东南亚、非洲、南美、中东等地区
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

interface WarehouseSeed {
  name: string;
  nameEn: string;
  country: string;
  city: string;
  address: string;
  warehouseType: string;
  capacity: number;
  area: number;
  services: string[];
  contactName: string;
  contactPhone: string;
  contactEmail: string;
  latitude: number;
  longitude: number;
  status: string;
}

const WAREHOUSES: WarehouseSeed[] = [
  {
    name: "神雕农机阿拉木图海外仓",
    nameEn: "ShenDiao Almaty Overseas Warehouse",
    country: "Kazakhstan",
    city: "Almaty",
    address: "ул. Райымбека, 250, Алматы, Казахстан",
    warehouseType: "bonded",
    capacity: 8000,
    area: 3500,
    services: ["保税仓储", "清关代理", "设备组装", "维修保养", "配件分发", "物流配送"],
    contactName: "努尔兰·阿勒腾别克",
    contactPhone: "+7 727 350 1234",
    contactEmail: "almaty@shendiao-agri.kz",
    latitude: 43.222,
    longitude: 76.8512,
    status: "active",
  },
  {
    name: "神雕农机莫斯科海外仓",
    nameEn: "ShenDiao Moscow Overseas Warehouse",
    country: "Russia",
    city: "Moscow",
    address: "Ленинградское шоссе, 71к1, Москва, Россия",
    warehouseType: "standard",
    capacity: 12000,
    area: 5000,
    services: ["普通仓储", "设备检测", "维修保养", "配件供应", "物流配送", "技术培训"],
    contactName: "伊万·彼得罗维奇",
    contactPhone: "+7 495 780 5678",
    contactEmail: "moscow@shendiao-agri.ru",
    latitude: 55.7558,
    longitude: 37.6173,
    status: "active",
  },
  {
    name: "神雕农机克拉斯诺达尔海外仓",
    nameEn: "ShenDiao Krasnodar Overseas Warehouse",
    country: "Russia",
    city: "Krasnodar",
    address: "ул. Красная, 155, Краснодар, Россия",
    warehouseType: "standard",
    capacity: 9500,
    area: 4200,
    services: ["普通仓储", "设备整备", "配件供应", "物流配送", "农忙季节应急调配"],
    contactName: "谢尔盖·伊万诺夫",
    contactPhone: "+7 861 210 3456",
    contactEmail: "krasnodar@shendiao-agri.ru",
    latitude: 45.0355,
    longitude: 38.9753,
    status: "active",
  },
  {
    name: "神雕农机曼谷海外仓",
    nameEn: "ShenDiao Bangkok Overseas Warehouse",
    country: "Thailand",
    city: "Bangkok",
    address: "888/99 Phahonyothin Rd, Chatuchak, Bangkok 10900",
    warehouseType: "standard",
    capacity: 6000,
    area: 2800,
    services: ["普通仓储", "设备组装", "维修保养", "配件分发", "水稻收割机专用仓储"],
    contactName: "Somchai Wichien",
    contactPhone: "+66 2 555 7890",
    contactEmail: "bangkok@shendiao-agri.th",
    latitude: 13.7563,
    longitude: 100.5018,
    status: "active",
  },
  {
    name: "神雕农机胡志明海外仓",
    nameEn: "ShenDiao Ho Chi Minh Overseas Warehouse",
    country: "Vietnam",
    city: "Ho Chi Minh City",
    address: "123 Nguyen Van Linh, District 7, Ho Chi Minh City",
    warehouseType: "bonded",
    capacity: 5500,
    area: 2500,
    services: ["保税仓储", "清关代理", "设备组装", "配件供应", "甘蔗收割机专用仓储"],
    contactName: "Nguyen Van Minh",
    contactPhone: "+84 28 3 555 4321",
    contactEmail: "hochiminh@shendiao-agri.vn",
    latitude: 10.7326,
    longitude: 106.7196,
    status: "active",
  },
  {
    name: "神雕农机拉各斯海外仓",
    nameEn: "ShenDiao Lagos Overseas Warehouse",
    country: "Nigeria",
    city: "Lagos",
    address: "15 Adeyemo Alakija St, Victoria Island, Lagos",
    warehouseType: "standard",
    capacity: 4500,
    area: 2000,
    services: ["普通仓储", "设备组装", "维修保养", "配件供应", "技术培训"],
    contactName: "Emeka Okonkwo",
    contactPhone: "+234 1 270 8090",
    contactEmail: "lagos@shendiao-agri.ng",
    latitude: 6.4474,
    longitude: 3.4084,
    status: "active",
  },
  {
    name: "神雕农机圣保罗海外仓",
    nameEn: "ShenDiao São Paulo Overseas Warehouse",
    country: "Brazil",
    city: "São Paulo",
    address: "Av. dos Bandeirantes, 2500, São Paulo - SP, 04089-001",
    warehouseType: "cold",
    capacity: 7000,
    area: 3200,
    services: ["冷链仓储", "普通仓储", "设备检测", "维修保养", "配件分发", "大豆收割机专用仓储"],
    contactName: "Carlos Eduardo Silva",
    contactPhone: "+55 11 3056 7890",
    contactEmail: "saopaulo@shendiao-agri.br",
    latitude: -23.5505,
    longitude: -46.6333,
    status: "active",
  },
  {
    name: "神雕农机迪拜海外仓",
    nameEn: "ShenDiao Dubai Overseas Warehouse",
    country: "United Arab Emirates",
    city: "Dubai",
    address: "Jebel Ali Free Zone, Dubai, UAE",
    warehouseType: "bonded",
    capacity: 9000,
    area: 4000,
    services: ["保税仓储", "清关代理", "中转分拨", "设备整备", "配件分发", "中东区域物流枢纽"],
    contactName: "Ahmed Al Rashid",
    contactPhone: "+971 4 555 1234",
    contactEmail: "dubai@shendiao-agri.ae",
    latitude: 25.2048,
    longitude: 55.2708,
    status: "active",
  },
  {
    name: "神雕农机塔什干海外仓",
    nameEn: "ShenDiao Tashkent Overseas Warehouse",
    country: "Uzbekistan",
    city: "Tashkent",
    address: "ул. Амира Темура, 108, Ташкент, Узбекистан",
    warehouseType: "standard",
    capacity: 5000,
    area: 2200,
    services: ["普通仓储", "设备组装", "维修保养", "配件供应", "棉花采摘机专用仓储"],
    contactName: "贾洪吉尔·卡里莫夫",
    contactPhone: "+998 71 200 4567",
    contactEmail: "tashkent@shendiao-agri.uz",
    latitude: 41.2995,
    longitude: 69.2401,
    status: "active",
  },
  {
    name: "神雕农机比什凯克海外仓",
    nameEn: "ShenDiao Bishkek Overseas Warehouse",
    country: "Kyrgyzstan",
    city: "Bishkek",
    address: "ул. Чуй, 155, Бишкек, Кыргызстан",
    warehouseType: "standard",
    capacity: 3500,
    area: 1500,
    services: ["普通仓储", "设备整备", "配件供应", "物流配送"],
    contactName: "Бакыт Жумабеков",
    contactPhone: "+996 312 654 321",
    contactEmail: "bishkek@shendiao-agri.kg",
    latitude: 42.8746,
    longitude: 74.5698,
    status: "active",
  },
];

async function main() {
  console.log("开始播种海外仓数据...");

  // 先清空旧数据（可重复执行）
  await prisma.overseasWarehouse.deleteMany({});
  console.log("已清空旧数据");

  for (const wh of WAREHOUSES) {
    await prisma.overseasWarehouse.create({
      data: {
        name: wh.name,
        nameEn: wh.nameEn,
        country: wh.country,
        city: wh.city,
        address: wh.address,
        warehouseType: wh.warehouseType,
        capacity: wh.capacity,
        area: wh.area,
        services: JSON.stringify(wh.services),
        contactName: wh.contactName,
        contactPhone: wh.contactPhone,
        contactEmail: wh.contactEmail,
        latitude: wh.latitude,
        longitude: wh.longitude,
        status: wh.status,
      },
    });
    console.log(`  创建: ${wh.name} (${wh.city}, ${wh.country})`);
  }

  const total = await prisma.overseasWarehouse.count();
  console.log(`\n完成! 共 ${total} 个海外仓`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
