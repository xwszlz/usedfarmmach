/**
 * 零配件种子数据（旧版 V1，使用 PartLegacy 模型）
 * 运行: npx tsx prisma/seed-parts.ts
 * 覆盖8大品类：发动机、液压、传动、电气、滤芯、轮胎、轴承、车身
 * 品牌覆盖：约翰迪尔、克拉斯、纽荷兰、久保田、道依茨等
 * 注意：V2 重构后新数据请使用 prisma/seed-parts-v2.ts（四级分类体系）
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

interface PartSeed {
  nameZh: string;
  nameEn: string;
  nameRu: string;
  brand: string;
  category: string;
  price: number;
  stockStatus: string;
  compatibleModels: string[];
  descriptionZh: string;
  descriptionEn: string;
  descriptionRu: string;
}

const PARTS: PartSeed[] = [
  // === 发动机配件 (engine) ===
  {
    nameZh: "约翰迪尔机油滤芯",
    nameEn: "John Deere Oil Filter",
    nameRu: "Масляный фильтр John Deere",
    brand: "John Deere",
    category: "engine",
    price: 180,
    stockStatus: "in_stock",
    compatibleModels: ["5045E", "5055E", "5065E", "5075E", "5085E"],
    descriptionZh: "约翰迪尔原厂机油滤芯，高效过滤发动机机油中的杂质，保护发动机延长使用寿命。建议每250工作小时更换一次。",
    descriptionEn: "Genuine John Deere oil filter, efficiently filters impurities in engine oil. Recommended replacement every 250 working hours.",
    descriptionRu: "Оригинальный масляный фильтр John Deere, эффективно фильтрует примеси в моторном масле. Замена каждые 250 моточасов.",
  },
  {
    nameZh: "约翰迪尔活塞环组件",
    nameEn: "John Deere Piston Ring Set",
    nameRu: "Комплект поршневых колец John Deere",
    brand: "John Deere",
    category: "engine",
    price: 2800,
    stockStatus: "in_stock",
    compatibleModels: ["6105H", "6125H", "6155R", "6175R"],
    descriptionZh: "约翰迪尔发动机活塞环组件，原厂配件，精密加工确保气密性。适用于大修更换，恢复发动机压缩性能。",
    descriptionEn: "John Deere engine piston ring set, OEM part with precision machining. Suitable for engine overhaul to restore compression.",
    descriptionRu: "Комплект поршневых колец двигателя John Deere, оригинальная деталь. Подходит для капитального ремонта двигателя.",
  },
  {
    nameZh: "道依茨气缸垫",
    nameEn: "Deutz Cylinder Head Gasket",
    nameRu: "Прокладка головки блока цилиндров Deutz",
    brand: "Deutz",
    category: "engine",
    price: 950,
    stockStatus: "low_stock",
    compatibleModels: ["BF4M1013", "BF6M1013", "TCD2013"],
    descriptionZh: "道依茨发动机气缸垫，耐高温高压材质，确保缸体与缸盖之间的密封。原厂品质，安装便捷。",
    descriptionEn: "Deutz engine cylinder head gasket, high-temperature resistant material. OEM quality for reliable sealing.",
    descriptionRu: "Прокладка ГБЦ двигателя Deutz, термостойкий материал. Оригинальное качество.",
  },
  {
    nameZh: "克拉斯发动机皮带",
    nameEn: "CLAAS Engine Drive Belt",
    nameRu: "Ремень двигателя CLAAS",
    brand: "CLAAS",
    category: "engine",
    price: 420,
    stockStatus: "in_stock",
    compatibleModels: ["LEXION 770", "LEXION 780", "JAGUAR 880", "JAGUAR 980"],
    descriptionZh: "克拉斯收割机发动机传动皮带，高强度橡胶材质，耐磨耐高温，保证发动机附件稳定驱动。",
    descriptionEn: "CLAAS harvester engine drive belt, high-strength rubber, heat and wear resistant.",
    descriptionRu: "Ремень двигателя комбайна CLAAS, высокопрочная резина, износостойкий.",
  },
  // === 液压系统 (hydraulic) ===
  {
    nameZh: "克拉斯液压泵总成",
    nameEn: "CLAAS Hydraulic Pump Assembly",
    nameRu: "Гидравлический насос CLAAS",
    brand: "CLAAS",
    category: "hydraulic",
    price: 12500,
    stockStatus: "in_stock",
    compatibleModels: ["LEXION 770", "LEXION 780", "LEXION 8800"],
    descriptionZh: "克拉斯原厂液压泵总成，高压大流量设计，为收割机液压系统提供稳定动力输出。原厂配件，品质保证。",
    descriptionEn: "Genuine CLAAS hydraulic pump assembly, high-pressure large-flow design for stable hydraulic power.",
    descriptionRu: "Оригинальный гидравлический насос CLAAS, высокое давление и большой расход.",
  },
  {
    nameZh: "纽荷兰液压油缸",
    nameEn: "New Holland Hydraulic Cylinder",
    nameRu: "Гидроцилиндр New Holland",
    brand: "New Holland",
    category: "hydraulic",
    price: 3600,
    stockStatus: "in_stock",
    compatibleModels: ["T7.270", "T7.315", "T8.420", "T9.700"],
    descriptionZh: "纽荷兰拖拉机液压油缸，双作用油缸，镀铬活塞杆防锈耐腐。用于提升器和三点悬挂系统。",
    descriptionEn: "New Holland tractor hydraulic cylinder, double-acting, chrome-plated piston rod.",
    descriptionRu: "Гидроцилиндр трактора New Holland, двустороннего действия, хромированный шток.",
  },
  {
    nameZh: "通用液压控制阀",
    nameEn: "Universal Hydraulic Control Valve",
    nameRu: "Универсальный гидравлический клапан",
    brand: "Parker",
    category: "hydraulic",
    price: 2200,
    stockStatus: "in_stock",
    compatibleModels: ["通用兼容", "John Deere 6R系列", "CLAAS Arion系列"],
    descriptionZh: "Parker品牌通用液压控制阀，三路四位通阀，适用于各类农机的液压系统改造和维修。压力范围0-250bar。",
    descriptionEn: "Parker universal hydraulic control valve, 3-spool 4-way, pressure range 0-250bar.",
    descriptionRu: "Универсальный гидравлический клапан Parker, 3-золотниковый, давление 0-250 бар.",
  },
  // === 传动系统 (transmission) ===
  {
    nameZh: "纽荷兰离合器片总成",
    nameEn: "New Holland Clutch Disc Assembly",
    nameRu: "Комплект диска сцепления New Holland",
    brand: "New Holland",
    category: "transmission",
    price: 2800,
    stockStatus: "in_stock",
    compatibleModels: ["TD5.90", "TD5.110", "T6.155", "T6.175"],
    descriptionZh: "纽荷兰拖拉机离合器片总成，含从动盘和压盘，摩擦材料耐高温耐磨损，换挡平顺。",
    descriptionEn: "New Holland tractor clutch disc assembly, includes driven plate and pressure plate.",
    descriptionRu: "Комплект диска сцепления трактора New Holland, включает ведомый диск и нажимной диск.",
  },
  {
    nameZh: "约翰迪尔传动皮带组",
    nameEn: "John Deere Drive Belt Set",
    nameRu: "Комплект приводных ремней John Deere",
    brand: "John Deere",
    category: "transmission",
    price: 680,
    stockStatus: "in_stock",
    compatibleModels: ["S660", "S670", "S680", "S690"],
    descriptionZh: "约翰迪尔收割机传动皮带组（3条装），高强度V带，传递动力稳定。建议成组更换确保传动平衡。",
    descriptionEn: "John Deere harvester drive belt set (3-pack), high-strength V-belts.",
    descriptionRu: "Комплект приводных ремней комбайна John Deere (3 шт.), высокопрочные клиновые ремни.",
  },
  {
    nameZh: "克拉斯传动齿轮",
    nameEn: "CLAAS Drive Gear",
    nameRu: "Шестерня привода CLAAS",
    brand: "CLAAS",
    category: "transmission",
    price: 1900,
    stockStatus: "low_stock",
    compatibleModels: ["LEXION 740", "LEXION 750", "JAGUAR 870"],
    descriptionZh: "克拉斯收割机传动齿轮，合金钢材质精密加工，齿面高频淬火处理，耐磨性强。",
    descriptionEn: "CLAAS harvester drive gear, alloy steel with high-frequency hardened teeth.",
    descriptionRu: "Шестерня привода комбайна CLAAS, легированная сталь, закалённые зубья.",
  },
  // === 电气系统 (electrical) ===
  {
    nameZh: "博世发电机总成",
    nameEn: "Bosch Alternator Assembly",
    nameRu: "Генератор Bosch",
    brand: "Bosch",
    category: "electrical",
    price: 1600,
    stockStatus: "in_stock",
    compatibleModels: ["通用12V/24V", "John Deere 6R系列", "New Holland T系列"],
    descriptionZh: "博世品牌发电机总成，24V/55A输出，内置稳压器，为农机电气系统提供稳定电力。通用型安装支架适配多种机型。",
    descriptionEn: "Bosch alternator assembly, 24V/55A output with built-in regulator. Universal mounting bracket.",
    descriptionRu: "Генератор Bosch, 24В/55А, со встроенным регулятором. Универсальный кронштейн.",
  },
  {
    nameZh: "约翰迪尔起动机",
    nameEn: "John Deere Starter Motor",
    nameRu: "Стартер John Deere",
    brand: "John Deere",
    category: "electrical",
    price: 2200,
    stockStatus: "in_stock",
    compatibleModels: ["6155R", "6175R", "6195R", "8R 410"],
    descriptionZh: "约翰迪尔原厂起动机，12V大扭矩启动电机，低温启动性能优越。原厂配件确保匹配性和可靠性。",
    descriptionEn: "Genuine John Deere starter motor, 12V high-torque, excellent cold-start performance.",
    descriptionRu: "Оригинальный стартер John Deere, 12В, высокий крутящий момент, отличный холодный пуск.",
  },
  {
    nameZh: "通用温度传感器",
    nameEn: "Universal Temperature Sensor",
    nameRu: "Универсальный датчик температуры",
    brand: "Universal",
    category: "electrical",
    price: 150,
    stockStatus: "in_stock",
    compatibleModels: ["通用兼容", "多数农机型号"],
    descriptionZh: "通用型发动机温度传感器，NTC热敏电阻，测量范围-40°C至150°C。适配各类农机发动机水温监测。",
    descriptionEn: "Universal engine temperature sensor, NTC thermistor, range -40°C to 150°C.",
    descriptionRu: "Универсальный датчик температуры двигателя, NTC термистор, диапазон -40°C...150°C.",
  },
  // === 滤芯滤清 (filters) ===
  {
    nameZh: "约翰迪尔空气滤芯",
    nameEn: "John Deere Air Filter",
    nameRu: "Воздушный фильтр John Deere",
    brand: "John Deere",
    category: "filters",
    price: 320,
    stockStatus: "in_stock",
    compatibleModels: ["5045E", "5055E", "5065E", "5075E"],
    descriptionZh: "约翰迪尔原厂空气滤芯，高效纸质滤材，过滤精度高，防止灰尘进入发动机。建议每500工作小时更换。",
    descriptionEn: "Genuine John Deere air filter, high-efficiency paper element. Replace every 500 working hours.",
    descriptionRu: "Оригинальный воздушный фильтр John Deere, высокоэффективный бумажный элемент.",
  },
  {
    nameZh: "克拉斯燃油滤清器",
    nameEn: "CLAAS Fuel Filter",
    nameRu: "Топливный фильтр CLAAS",
    brand: "CLAAS",
    category: "filters",
    price: 280,
    stockStatus: "in_stock",
    compatibleModels: ["LEXION 770", "LEXION 780", "JAGUAR 880"],
    descriptionZh: "克拉斯原厂燃油滤清器，油水分离设计，有效过滤燃油中的杂质和水分。保护喷油嘴和高压油泵。",
    descriptionEn: "Genuine CLAAS fuel filter with water separation, protects injectors and high-pressure pump.",
    descriptionRu: "Оригинальный топливный фильтр CLAAS с отделением воды, защита форсунок и ТНВД.",
  },
  {
    nameZh: "久保田机油滤芯组",
    nameEn: "Kubota Oil Filter Kit",
    nameRu: "Комплект масляных фильтров Kubota",
    brand: "Kubota",
    category: "filters",
    price: 260,
    stockStatus: "in_stock",
    compatibleModels: ["PRO688Q", "PRO888GM", "DC-70G"],
    descriptionZh: "久保田原厂机油滤芯组（2只装），适用于收割机和拖拉机。褶皱式滤纸增大过滤面积，过滤效率高。",
    descriptionEn: "Kubota OEM oil filter kit (2-pack) for harvesters and tractors. Pleated paper for large filtration area.",
    descriptionRu: "Комплект масляных фильтров Kubota (2 шт.) для комбайнов и тракторов.",
  },
  // === 轮胎轮毂 (tires) ===
  {
    nameZh: "拖拉机前轮轮胎 11.2-24",
    nameEn: "Tractor Front Tire 11.2-24",
    nameRu: "Передняя шина трактора 11.2-24",
    brand: "Apollo",
    category: "tires",
    price: 1200,
    stockStatus: "in_stock",
    compatibleModels: ["通用50-80马力拖拉机", "John Deere 5E系列", "New Holland TD系列"],
    descriptionZh: "拖拉机前轮轮胎，规格11.2-24，加深花纹设计，抓地力强。耐磨损橡胶配方，使用寿命长。",
    descriptionEn: "Tractor front tire 11.2-24, deep tread pattern for strong grip. Wear-resistant rubber compound.",
    descriptionRu: "Передняя шина трактора 11.2-24, глубокий протектор, износостойкая резина.",
  },
  {
    nameZh: "拖拉机后轮轮胎 18.4-38",
    nameEn: "Tractor Rear Tire 18.4-38",
    nameRu: "Задняя шина трактора 18.4-38",
    brand: "BKT",
    category: "tires",
    price: 4800,
    stockStatus: "in_stock",
    compatibleModels: ["通用100-200马力拖拉机", "John Deere 6R系列", "Case IH Puma系列"],
    descriptionZh: "拖拉机后轮驱动轮胎，规格18.4-38，R1花纹设计，大牵引力。适合旱田作业，耐磨耐穿刺。",
    descriptionEn: "Tractor rear drive tire 18.4-38, R1 tread pattern, high traction for dry field operations.",
    descriptionRu: "Задняя ведущая шина трактора 18.4-38, рисунок R1, высокое тяговое усилие.",
  },
  {
    nameZh: "收割机转向轮轮胎 14.9-24",
    nameEn: "Harvester Steer Tire 14.9-24",
    nameRu: "Направляющая шина комбайна 14.9-24",
    brand: "Mitas",
    category: "tires",
    price: 2600,
    stockStatus: "low_stock",
    compatibleModels: ["CLAAS LEXION系列", "John Deere S系列", "New Holland CR系列"],
    descriptionZh: "收割机转向轮轮胎，规格14.9-24，导向花纹设计，转向灵活。适合收割机前轮使用，承载能力强。",
    descriptionEn: "Harvester steer tire 14.9-24, directional tread for responsive steering. High load capacity.",
    descriptionRu: "Направляющая шина комбайна 14.9-24, направленный протектор, высокая грузоподъёмность.",
  },
  // === 轴承密封 (bearings) ===
  {
    nameZh: "液压油缸密封件组",
    nameEn: "Hydraulic Cylinder Seal Kit",
    nameRu: "Комплект уплотнений гидроцилиндра",
    brand: "Parker",
    category: "bearings",
    price: 320,
    stockStatus: "in_stock",
    compatibleModels: ["通用兼容", "各类液压油缸"],
    descriptionZh: "Parker品牌液压油缸密封件组，含活塞密封、活塞杆密封、防尘圈等全套密封件。NBR材质耐油耐高温。",
    descriptionEn: "Parker hydraulic cylinder seal kit, includes all seals. NBR material, oil and heat resistant.",
    descriptionRu: "Комплект уплотнений гидроцилиндра Parker, полный набор, материал NBR.",
  },
  {
    nameZh: "约翰迪尔深沟球轴承 6308",
    nameEn: "John Deere Deep Groove Ball Bearing 6308",
    nameRu: "Шарикоподшипник John Deere 6308",
    brand: "John Deere",
    category: "bearings",
    price: 85,
    stockStatus: "in_stock",
    compatibleModels: ["通用6308轴承位", "传动系统通用"],
    descriptionZh: "约翰迪尔原厂深沟球轴承6308，密封型设计，免维护。适用于传动轴、皮带轮等高速旋转部位。",
    descriptionEn: "Genuine John Deere deep groove ball bearing 6308, sealed design, maintenance-free.",
    descriptionRu: "Оригинальный шарикоподшипник John Deere 6308, уплотнённый, без обслуживания.",
  },
  {
    nameZh: "克拉斯圆锥滚子轴承 32208",
    nameEn: "CLAAS Tapered Roller Bearing 32208",
    nameRu: "Роликоподшипник конический CLAAS 32208",
    brand: "CLAAS",
    category: "bearings",
    price: 180,
    stockStatus: "in_stock",
    compatibleModels: ["LEXION系列传动系统", "JAGUAR系列传动系统"],
    descriptionZh: "克拉斯收割机圆锥滚子轴承32208，可承受轴向和径向联合载荷。适用于收割机传动轴支撑部位。",
    descriptionEn: "CLAAS tapered roller bearing 32208, handles combined axial and radial loads.",
    descriptionRu: "Конический роликоподшипник CLAAS 32208, воспринимает комбинированные нагрузки.",
  },
  // === 车身外观 (body) ===
  {
    nameZh: "约翰迪尔驾驶室门",
    nameEn: "John Deere Cab Door",
    nameRu: "Дверь кабины John Deere",
    brand: "John Deere",
    category: "body",
    price: 5200,
    stockStatus: "out_of_stock",
    compatibleModels: ["6155R", "6175R", "6195R", "8R 410"],
    descriptionZh: "约翰迪尔拖拉机驾驶室门总成，含门框、玻璃、密封条、铰链。原厂配件，安装便捷，密封性好。",
    descriptionEn: "John Deere tractor cab door assembly, includes frame, glass, seal, hinges.",
    descriptionRu: "Дверь кабины трактора John Deere, в сборе с рамой, стеклом, уплотнителем, петлями.",
  },
  {
    nameZh: "克拉斯挡泥板组件",
    nameEn: "CLAAS Mudguard Assembly",
    nameRu: "Крыло CLAAS",
    brand: "CLAAS",
    category: "body",
    price: 850,
    stockStatus: "in_stock",
    compatibleModels: ["LEXION 770", "LEXION 780", "JAGUAR 880"],
    descriptionZh: "克拉斯收割机挡泥板组件，工程塑料材质，抗冲击耐老化。有效防止泥水飞溅，保护车身和行人安全。",
    descriptionEn: "CLAAS harvester mudguard assembly, impact-resistant engineering plastic.",
    descriptionRu: "Крыло комбайна CLAAS, ударопрочный инженерный пластик.",
  },
  {
    nameZh: "拖拉机座椅总成（空气悬挂）",
    nameEn: "Tractor Air Suspension Seat",
    nameRu: "Сиденье трактора с пневмоподвеской",
    brand: "Grammer",
    category: "body",
    price: 3800,
    stockStatus: "in_stock",
    compatibleModels: ["通用兼容", "多数拖拉机收割机驾驶室"],
    descriptionZh: "Grammer品牌空气悬挂座椅，高度可调，腰部支撑可调。配备安全带和扶手，长时间作业舒适不疲劳。适配各类农机驾驶室。",
    descriptionEn: "Grammer air suspension seat, adjustable height and lumbar support. Fits most tractor and harvester cabs.",
    descriptionRu: "Сиденье с пневмоподвеской Grammer, регулируемая высота и поясная поддержка.",
  },
];

async function main() {
  console.log("开始播种零配件数据...");

  // 先清空旧数据（可重复执行）
  await prisma.partLegacy.deleteMany({});
  console.log("已清空旧数据");

  for (const p of PARTS) {
    await prisma.partLegacy.create({
      data: {
        nameZh: p.nameZh,
        nameEn: p.nameEn,
        nameRu: p.nameRu,
        brand: p.brand,
        category: p.category,
        price: p.price,
        currency: "CNY",
        stockStatus: p.stockStatus,
        compatibleModels: p.compatibleModels,
        images: [],
        descriptionZh: p.descriptionZh,
        descriptionEn: p.descriptionEn,
        descriptionRu: p.descriptionRu,
        isActive: true,
      },
    });
    console.log(`  创建: [${p.category}] ${p.nameZh} (${p.brand})`);
  }

  const total = await prisma.partLegacy.count();
  console.log(`\n完成! 共 ${total} 个零配件`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
