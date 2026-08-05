/**
 * 配件专区V2 — 种子数据脚本
 *
 * 数据分层：
 *   Layer 1: 14个整机品类 (MachineType)
 *   Layer 2: 拖拉机9个子系统 (SubSystem)
 *   Layer 3: 拖拉机9子系统下的部件组 (~65个 ComponentGroup)
 *   Layer 4: 拖拉机首批配件 (60+条 Part + CompatibleMachine)
 *
 * 幂等执行：先 deleteMany 再创建
 * 运行命令：npx tsx prisma/seed-parts-v2.ts
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// ═══════════════════════════════════════════════════════
// Layer 1: 14个整机品类
// ═══════════════════════════════════════════════════════

const MACHINE_TYPES = [
  { code: "tractor", nameZh: "拖拉机", nameEn: "Tractor", nameRu: "Трактор", nameEs: "Tractor", namePt: "Trator", nameAr: "جرار", nameFr: "Tracteur", nameHi: "ट्रैक्टर", sortOrder: 1 },
  { code: "combine_harvester", nameZh: "联合收割机", nameEn: "Combine Harvester", nameRu: "Комбайн зерноуборочный", nameEs: "Cosechadora", namePt: "Colheitadeira", nameAr: "حصادة", nameFr: "Moissonneuse-batteuse", nameHi: "हार्वेस्टर", sortOrder: 2 },
  { code: "forage_harvester", nameZh: "青储机", nameEn: "Forage Harvester", nameRu: "Кормоуборочный комбайн", nameEs: "Cosechadora de forraje", namePt: "Colheitadeira de forragem", nameAr: "حصادة أعلاف", nameFr: "Récolteuse d'ensilage", nameHi: "चारा हार्वेस्टर", sortOrder: 3 },
  { code: "baler", nameZh: "打捆机", nameEn: "Baler", nameRu: "Пресс-подборщик", nameEs: "Empacadora", namePt: "Enfardadora", nameAr: "كابسة القش", nameFr: "Presse à balles", nameHi: "बेलर", sortOrder: 4 },
  { code: "transplanter", nameZh: "插秧机", nameEn: "Rice Transplanter", nameRu: "Рассадопосадочная машина", nameEs: "Trasplantadora", namePt: "Transplantadora", nameAr: "آلة زرع الشتلات", nameFr: "Repiqueuse", nameHi: "रोपा मशीन", sortOrder: 5 },
  { code: "seeder", nameZh: "播种机", nameEn: "Seeder / Planter", nameRu: "Сеялка", nameEs: "Sembradora", namePt: "Semeadora", nameAr: "آلة البذر", nameFr: "Semoir", nameHi: "बुवाई मशीन", sortOrder: 6 },
  { code: "tillage", nameZh: "耕地机", nameEn: "Tillage Equipment", nameRu: "Почвообрабатывающая техника", nameEs: "Equipo de labranza", namePt: "Equipamento de preparo do solo", nameAr: "معدات حراثة", nameFr: "Matériel de travail du sol", nameHi: "जुताई उपकरण", sortOrder: 7 },
  { code: "sprayer", nameZh: "植保机", nameEn: "Crop Sprayer", nameRu: "Опрыскиватель", nameEs: "Pulverizador", namePt: "Pulverizador", nameAr: "رشاش", nameFr: "Pulvérisateur", nameHi: "स्प्रेयर", sortOrder: 8 },
  { code: "grain_dryer", nameZh: "烘干机", nameEn: "Grain Dryer", nameRu: "Зерносушилка", nameEs: "Secadora de granos", namePt: "Secador de grãos", nameAr: "مجفف الحبوب", nameFr: "Séchoir à grains", nameHi: "अनाज सुखाने की मशीन", sortOrder: 9 },
  { code: "irrigation", nameZh: "灌溉设备", nameEn: "Irrigation Equipment", nameRu: "Оборудование для орошения", nameEs: "Equipo de riego", namePt: "Equipamento de irrigação", nameAr: "معدات الري", nameFr: "Équipement d'irrigation", nameHi: "सिंचाई उपकरण", sortOrder: 10 },
  { code: "forage_equipment", nameZh: "牧草设备", nameEn: "Hay & Forage Equipment", nameRu: "Оборудование для заготовки кормов", nameEs: "Equipo de heno y forraje", namePt: "Equipamento de feno e forragem", nameAr: "معدات العلف والتبن", nameFr: "Équipement de foin et fourrage", nameHi: "हे और चारा उपकरण", sortOrder: 11 },
  { code: "cotton_picker", nameZh: "棉花采摘机", nameEn: "Cotton Picker", nameRu: "Хлопкоуборочная машина", nameEs: "Cosechadora de algodón", namePt: "Colhedora de algodão", nameAr: "حاصدة قطن", nameFr: "Cueilleuse de coton", nameHi: "कपास कटाई मशीन", sortOrder: 12 },
  { code: "sugarcane_harvester", nameZh: "甘蔗收割机", nameEn: "Sugarcane Harvester", nameRu: "Сахароуборочный комбайн", nameEs: "Cosechadora de caña", namePt: "Colhedora de cana", nameAr: "حاصدة قصب السكر", nameFr: "Récolteuse de canne à sucre", nameHi: "गन्ना कटाई मशीन", sortOrder: 13 },
  { code: "potato_harvester", nameZh: "土豆收获机", nameEn: "Potato Harvester", nameRu: "Картофелеуборочная машина", nameEs: "Cosechadora de papa", namePt: "Colheitadeira de batata", nameAr: "حاصدة بطاطس", nameFr: "Récolteuse de pommes de terre", nameHi: "आलू कटाई मशीन", sortOrder: 14 },
];

// ═══════════════════════════════════════════════════════
// Layer 2: 拖拉机9个子系统
// ═══════════════════════════════════════════════════════

const TRACTOR_SUB_SYSTEMS = [
  { code: "powertrain", nameZh: "动力系统", nameEn: "Powertrain System", nameRu: "Силовая система", nameEs: "Sistema de potencia", namePt: "Sistema de potência", nameAr: "نظام القوة", nameFr: "Système moteur", nameHi: "पावरट्रेन सिस्टम", sortOrder: 1, skuPrefix: "PWR" },
  { code: "hydraulic_system", nameZh: "液压系统", nameEn: "Hydraulic System", nameRu: "Гидравлическая система", nameEs: "Sistema hidráulico", namePt: "Sistema hidráulico", nameAr: "النظام الهيدروليكي", nameFr: "Système hydraulique", nameHi: "हाइड्रोलिक सिस्टम", sortOrder: 2, skuPrefix: "HYD" },
  { code: "electrical_system", nameZh: "电气系统", nameEn: "Electrical System", nameRu: "Электрическая система", nameEs: "Sistema eléctrico", namePt: "Sistema elétrico", nameAr: "النظام الكهربائي", nameFr: "Système électrique", nameHi: "विद्युत प्रणाली", sortOrder: 3, skuPrefix: "ELE" },
  { code: "transmission_system", nameZh: "传动系统", nameEn: "Transmission System", nameRu: "Трансмиссия", nameEs: "Sistema de transmisión", namePt: "Sistema de transmissão", nameAr: "نظام النقل", nameFr: "Système de transmission", nameHi: "ट्रांसमिशन सिस्टम", sortOrder: 4, skuPrefix: "TRN" },
  { code: "chassis_system", nameZh: "行走系统", nameEn: "Chassis & Running Gear", nameRu: "Ходовая часть", nameEs: "Chasis y tren de rodaje", namePt: "Chassi e rodagem", nameAr: "الهيكل ونظام الجري", nameFr: "Châssis et train de roulement", nameHi: "चेसिस और रनिंग गियर", sortOrder: 5, skuPrefix: "CHS" },
  { code: "working_implement", nameZh: "工作装置", nameEn: "Working Implement", nameRu: "Рабочее оборудование", nameEs: "Implemento de trabajo", namePt: "Implemento de trabalho", nameAr: "أداة العمل", nameFr: "Équipement de travail", nameHi: "वर्किंग इम्प्लीमेंट", sortOrder: 6, skuPrefix: "WIM" },
  { code: "body_cab", nameZh: "车身驾驶室", nameEn: "Body & Cab", nameRu: "Кабина и кузов", nameEs: "Cabina y carrocería", namePt: "Cabine e carroçaria", nameAr: "الكابينة والهيكل", nameFr: "Cabine et carrosserie", nameHi: "बॉडी और कैब", sortOrder: 7, skuPrefix: "BCB" },
  { code: "filter_system", nameZh: "过滤系统", nameEn: "Filter System", nameRu: "Система фильтрации", nameEs: "Sistema de filtros", namePt: "Sistema de filtros", nameAr: "نظام الترشيح", nameFr: "Système de filtration", nameHi: "फिल्टर सिस्टम", sortOrder: 8, skuPrefix: "FLT" },
  { code: "bearing_seal_system", nameZh: "轴承密封", nameEn: "Bearing & Seal System", nameRu: "Подшипники и уплотнения", nameEs: "Rodamientos y sellos", namePt: "Rolamentos e vedantes", nameAr: "المحامل والأختام", nameFr: "Roulements et joints", nameHi: "बेयरिंग और सील सिस्टम", sortOrder: 9, skuPrefix: "BRS" },
];

// ═══════════════════════════════════════════════════════
// Layer 3: 拖拉机9子系统下的部件组
// ═══════════════════════════════════════════════════════

const COMPONENT_GROUPS: Record<string, { code: string; nameZh: string; nameEn: string; sortOrder: number }[]> = {
  powertrain: [
    { code: "engine_assembly", nameZh: "发动机总成", nameEn: "Engine Assembly", sortOrder: 1 },
    { code: "crankshaft", nameZh: "曲轴组件", nameEn: "Crankshaft Assembly", sortOrder: 2 },
    { code: "piston", nameZh: "活塞组件", nameEn: "Piston Assembly", sortOrder: 3 },
    { code: "cylinder_head_gasket", nameZh: "气缸垫", nameEn: "Cylinder Head Gasket", sortOrder: 4 },
    { code: "camshaft", nameZh: "凸轮轴", nameEn: "Camshaft", sortOrder: 5 },
    { code: "valve_train", nameZh: "气门组", nameEn: "Valve Train", sortOrder: 6 },
    { code: "fuel_system", nameZh: "燃油系统", nameEn: "Fuel System", sortOrder: 7 },
    { code: "turbocharger", nameZh: "涡轮增压器", nameEn: "Turbocharger", sortOrder: 8 },
    { code: "cooling_system", nameZh: "冷却系统", nameEn: "Cooling System", sortOrder: 9 },
  ],
  hydraulic_system: [
    { code: "hydraulic_pump", nameZh: "液压泵", nameEn: "Hydraulic Pump", sortOrder: 1 },
    { code: "hydraulic_cylinder", nameZh: "液压油缸", nameEn: "Hydraulic Cylinder", sortOrder: 2 },
    { code: "hydraulic_valve", nameZh: "液压阀", nameEn: "Hydraulic Valve", sortOrder: 3 },
    { code: "hydraulic_hose", nameZh: "液压管路", nameEn: "Hydraulic Hose & Fitting", sortOrder: 4 },
    { code: "hydraulic_oil", nameZh: "液压油", nameEn: "Hydraulic Oil", sortOrder: 5 },
    { code: "seal_kit", nameZh: "油封套件", nameEn: "Seal Kit", sortOrder: 6 },
    { code: "hydraulic_motor", nameZh: "液压马达", nameEn: "Hydraulic Motor", sortOrder: 7 },
  ],
  electrical_system: [
    { code: "alternator", nameZh: "发电机", nameEn: "Alternator", sortOrder: 1 },
    { code: "starter_motor", nameZh: "起动机", nameEn: "Starter Motor", sortOrder: 2 },
    { code: "ecu_controller", nameZh: "ECU控制器", nameEn: "ECU Controller", sortOrder: 3 },
    { code: "sensor", nameZh: "传感器", nameEn: "Sensor", sortOrder: 4 },
    { code: "wiring_harness", nameZh: "线束", nameEn: "Wiring Harness", sortOrder: 5 },
    { code: "relay", nameZh: "继电器", nameEn: "Relay", sortOrder: 6 },
    { code: "instrument_panel", nameZh: "仪表盘", nameEn: "Instrument Panel", sortOrder: 7 },
    { code: "battery", nameZh: "电池", nameEn: "Battery", sortOrder: 8 },
    { code: "lighting", nameZh: "灯具", nameEn: "Lighting", sortOrder: 9 },
  ],
  transmission_system: [
    { code: "clutch", nameZh: "离合器", nameEn: "Clutch", sortOrder: 1 },
    { code: "gearbox", nameZh: "变速箱", nameEn: "Gearbox", sortOrder: 2 },
    { code: "gear_set", nameZh: "齿轮组", nameEn: "Gear Set", sortOrder: 3 },
    { code: "drive_shaft", nameZh: "传动轴", nameEn: "Drive Shaft", sortOrder: 4 },
    { code: "differential", nameZh: "差速器", nameEn: "Differential", sortOrder: 5 },
    { code: "belt_chain", nameZh: "皮带链条", nameEn: "Belt & Chain", sortOrder: 6 },
    { code: "universal_joint", nameZh: "万向节", nameEn: "Universal Joint", sortOrder: 7 },
  ],
  chassis_system: [
    { code: "tire", nameZh: "轮胎", nameEn: "Tire", sortOrder: 1 },
    { code: "track", nameZh: "履带", nameEn: "Track", sortOrder: 2 },
    { code: "axle", nameZh: "车桥", nameEn: "Axle", sortOrder: 3 },
    { code: "brake_system", nameZh: "制动系统", nameEn: "Brake System", sortOrder: 4 },
    { code: "steering_system", nameZh: "转向系统", nameEn: "Steering System", sortOrder: 5 },
    { code: "suspension_system", nameZh: "悬挂系统", nameEn: "Suspension System", sortOrder: 6 },
    { code: "wheel_hub", nameZh: "轮毂", nameEn: "Wheel Hub", sortOrder: 7 },
  ],
  working_implement: [
    { code: "three_point_hitch", nameZh: "三点悬挂", nameEn: "Three-Point Hitch", sortOrder: 1 },
    { code: "pto", nameZh: "动力输出轴(PTO)", nameEn: "Power Take-Off (PTO)", sortOrder: 2 },
    { code: "drawbar", nameZh: "牵引装置", nameEn: "Drawbar", sortOrder: 3 },
    { code: "counterweight", nameZh: "配重块", nameEn: "Counterweight", sortOrder: 4 },
    { code: "hydraulic_outlet", nameZh: "液压输出", nameEn: "Hydraulic Outlet", sortOrder: 5 },
    { code: "quick_hitch", nameZh: "快速挂接器", nameEn: "Quick Hitch", sortOrder: 6 },
    { code: "front_loader_bracket", nameZh: "前装载机支架", nameEn: "Front Loader Bracket", sortOrder: 7 },
    { code: "rear_backhoe_bracket", nameZh: "后挖掘机支架", nameEn: "Rear Backhoe Bracket", sortOrder: 8 },
  ],
  body_cab: [
    { code: "cab", nameZh: "驾驶室", nameEn: "Cab", sortOrder: 1 },
    { code: "hood", nameZh: "机罩", nameEn: "Hood", sortOrder: 2 },
    { code: "fender", nameZh: "挡泥板", nameEn: "Fender", sortOrder: 3 },
    { code: "seat", nameZh: "座椅", nameEn: "Seat", sortOrder: 4 },
    { code: "mirror", nameZh: "后视镜", nameEn: "Mirror", sortOrder: 5 },
    { code: "glass", nameZh: "玻璃", nameEn: "Glass", sortOrder: 6 },
  ],
  filter_system: [
    { code: "oil_filter", nameZh: "机油滤芯", nameEn: "Oil Filter", sortOrder: 1 },
    { code: "air_filter", nameZh: "空气滤芯", nameEn: "Air Filter", sortOrder: 2 },
    { code: "fuel_filter", nameZh: "燃油滤芯", nameEn: "Fuel Filter", sortOrder: 3 },
    { code: "hydraulic_filter", nameZh: "液压滤芯", nameEn: "Hydraulic Filter", sortOrder: 4 },
    { code: "cabin_filter", nameZh: "空调滤芯", nameEn: "Cabin Air Filter", sortOrder: 5 },
    { code: "water_separator", nameZh: "油水分离器", nameEn: "Water Separator", sortOrder: 6 },
  ],
  bearing_seal_system: [
    { code: "ball_bearing", nameZh: "深沟球轴承", nameEn: "Deep Groove Ball Bearing", sortOrder: 1 },
    { code: "taper_roller_bearing", nameZh: "圆锥滚子轴承", nameEn: "Tapered Roller Bearing", sortOrder: 2 },
    { code: "thrust_bearing", nameZh: "推力轴承", nameEn: "Thrust Bearing", sortOrder: 3 },
    { code: "oil_seal", nameZh: "油封", nameEn: "Oil Seal", sortOrder: 4 },
    { code: "oring_seal_kit", nameZh: "O型圈密封套件", nameEn: "O-Ring Seal Kit", sortOrder: 5 },
  ],
};

// ═══════════════════════════════════════════════════════
// Layer 4: 拖拉机首批配件（真实OEM数据）
// ═══════════════════════════════════════════════════════

interface SeedPart {
  subSystemCode: string;
  componentGroupCode: string;
  sku: string;
  nameZh: string;
  nameEn: string;
  nameRu: string;
  brand: string;
  oemNumber: string;
  price: number;
  stockStatus: "in_stock" | "low_stock" | "out_of_stock";
  descriptionZh: string;
  descriptionEn: string;
  specs: Record<string, string>;
  isOEM: boolean;
  compatibleMachines: { brand: string; model: string; yearRange: string }[];
}

const STOCK_STATUSES: ("in_stock" | "low_stock" | "out_of_stock")[] = ["in_stock", "in_stock", "in_stock", "low_stock", "out_of_stock"];

const SEED_PARTS: SeedPart[] = [
  // ── 动力系统 (PWR) ──
  {
    subSystemCode: "powertrain", componentGroupCode: "engine_assembly",
    sku: "SD-TRACTOR-PWR-001",
    nameZh: "约翰迪尔 4.5L 柴油发动机总成", nameEn: "John Deere 4.5L Diesel Engine Assembly", nameRu: "John Deere 4.5L Diesel Engine Assembly",
    brand: "John Deere", oemNumber: "RE507510",
    price: 78000, stockStatus: "in_stock", isOEM: true,
    descriptionZh: "约翰迪尔PowerTech 4.5L柴油发动机总成，适用于6系列拖拉机，原厂全新件。", descriptionEn: "John Deere PowerTech 4.5L diesel engine assembly for 6 Series tractors. OEM genuine new part.",
    specs: { displacement: "4.5L", cylinders: "4", power: "75 kW (100 HP)", cooling: "Liquid Cooled", fuelSystem: "Direct Injection", weight: "420 kg", warranty: "12 months" },
    compatibleMachines: [
      { brand: "John Deere", model: "6120M", yearRange: "2017-2024" },
      { brand: "John Deere", model: "6155M", yearRange: "2017-2024" },
      { brand: "John Deere", model: "6175M", yearRange: "2018-2024" },
    ],
  },
  {
    subSystemCode: "powertrain", componentGroupCode: "crankshaft",
    sku: "SD-TRACTOR-PWR-002",
    nameZh: "康明斯 4B 曲轴组件", nameEn: "Cummins 4B Crankshaft Assembly", nameRu: "Cummins 4B Crankshaft Assembly",
    brand: "Cummins", oemNumber: "3907482",
    price: 12500, stockStatus: "in_stock", isOEM: true,
    descriptionZh: "康明斯B系列4缸柴油机曲轴组件，含曲轴、主轴瓦、连杆瓦。", descriptionEn: "Cummins B Series 4-cylinder crankshaft assembly, includes crankshaft, main bearings and connecting rod bearings.",
    specs: { material: "Forged Steel 42CrMo", journals: "Main 76mm / Rod 64mm", weight: "32 kg", heatTreatment: "Induction Hardened", warranty: "12 months" },
    compatibleMachines: [
      { brand: "Cummins", model: "4BTA3.9", yearRange: "2005-2020" },
      { brand: "Dongfeng", model: "EQ2102", yearRange: "2008-2018" },
    ],
  },
  {
    subSystemCode: "powertrain", componentGroupCode: "piston",
    sku: "SD-TRACTOR-PWR-003",
    nameZh: "马勒 活塞组件套件 (4缸)", nameEn: "Mahle Piston Kit (4-Cylinder Set)", nameRu: "Mahle Piston Kit (4-Cylinder Set)",
    brand: "Mahle", oemNumber: "01174400",
    price: 4800, stockStatus: "low_stock", isOEM: false,
    descriptionZh: "马勒活塞环套件，适用于约翰迪尔4.5L发动机，4缸全套。", descriptionEn: "Mahle piston ring kit for John Deere 4.5L engine, 4-cylinder complete set.",
    specs: { material: "Aluminum Alloy", pistonDiameter: "106mm", ringCount: "3 per piston", compressionRatio: "17.0:1", weight: "1.8 kg/piston", warranty: "12 months" },
    compatibleMachines: [
      { brand: "John Deere", model: "6120M", yearRange: "2017-2024" },
      { brand: "John Deere", model: "6155M", yearRange: "2017-2024" },
    ],
  },
  {
    subSystemCode: "powertrain", componentGroupCode: "cylinder_head_gasket",
    sku: "SD-TRACTOR-PWR-004",
    nameZh: "埃尔凌 气缸垫", nameEn: "Elring Cylinder Head Gasket", nameRu: "Elring Cylinder Head Gasket",
    brand: "Elring Klinger", oemNumber: "822.140",
    price: 680, stockStatus: "in_stock", isOEM: false,
    descriptionZh: "埃尔凌金属气缸垫，适用于康明斯4BTA3.9发动机。", descriptionEn: "Elring metal cylinder head gasket for Cummins 4BTA3.9 engine.",
    specs: { material: "Multi-Layer Steel (MLS)", thickness: "1.2mm", boreSize: "102mm", temperature: "-40°C to 300°C", warranty: "12 months" },
    compatibleMachines: [
      { brand: "Cummins", model: "4BTA3.9", yearRange: "2005-2020" },
    ],
  },
  {
    subSystemCode: "powertrain", componentGroupCode: "camshaft",
    sku: "SD-TRACTOR-PWR-005",
    nameZh: "霍尔塞特 凸轮轴", nameEn: "Holset Camshaft", nameRu: "Holset Camshaft",
    brand: "Holset", oemNumber: "4089970",
    price: 3200, stockStatus: "in_stock", isOEM: true,
    descriptionZh: "霍尔塞特凸轮轴，适用于康明斯6BT5.9发动机。", descriptionEn: "Holset camshaft for Cummins 6BT5.9 engine.",
    specs: { material: "Chilled Cast Iron", lobes: "12", baseCircle: "40mm", lift: "8.5mm", weight: "15 kg", warranty: "12 months" },
    compatibleMachines: [
      { brand: "Cummins", model: "6BT5.9", yearRange: "2003-2018" },
      { brand: "Dongfeng", model: "EQ1092", yearRange: "2005-2015" },
    ],
  },
  {
    subSystemCode: "powertrain", componentGroupCode: "valve_train",
    sku: "SD-TRACTOR-PWR-006",
    nameZh: "伊顿 气门组套件 (进排气)", nameEn: "Eaton Valve Train Kit (Intake & Exhaust)", nameRu: "Eaton Valve Train Kit (Intake & Exhaust)",
    brand: "Eaton", oemNumber: "3935829",
    price: 1850, stockStatus: "in_stock", isOEM: false,
    descriptionZh: "伊顿气门套件，含进气门、排气门、气门弹簧、锁片，4缸全套。", descriptionEn: "Eaton valve kit, includes intake valves, exhaust valves, valve springs, retainers. 4-cylinder set.",
    specs: { material: "Silchrome Steel", intakeValveDia: "42mm", exhaustValveDia: "36mm", springRate: "38 N/mm", warranty: "12 months" },
    compatibleMachines: [
      { brand: "Cummins", model: "4BTA3.9", yearRange: "2005-2020" },
      { brand: "Cummins", model: "6BT5.9", yearRange: "2003-2018" },
    ],
  },
  {
    subSystemCode: "powertrain", componentGroupCode: "fuel_system",
    sku: "SD-TRACTOR-PWR-007",
    nameZh: "博世 高压共轨喷油器", nameEn: "Bosch High-Pressure Common Rail Injector", nameRu: "Bosch High-Pressure Common Rail Injector",
    brand: "Bosch", oemNumber: "0445120145",
    price: 2800, stockStatus: "low_stock", isOEM: true,
    descriptionZh: "博世CR共轨喷油器，适用于高压共轨燃油系统，单个。", descriptionEn: "Bosch CR common rail injector for high-pressure common rail fuel systems. Single unit.",
    specs: { injectionPressure: "1600 bar", nozzleType: "Multi-Hole", voltage: "12V", flow: "80 cm³/stroke", warranty: "12 months" },
    compatibleMachines: [
      { brand: "John Deere", model: "6155R", yearRange: "2014-2020" },
      { brand: "John Deere", model: "6175R", yearRange: "2014-2020" },
      { brand: "John Deere", model: "6120R", yearRange: "2014-2020" },
    ],
  },
  {
    subSystemCode: "powertrain", componentGroupCode: "turbocharger",
    sku: "SD-TRACTOR-PWR-008",
    nameZh: "霍尔塞特 涡轮增压器 HX40W", nameEn: "Holset Turbocharger HX40W", nameRu: "Holset Turbocharger HX40W",
    brand: "Holset", oemNumber: "4032691",
    price: 6500, stockStatus: "in_stock", isOEM: true,
    descriptionZh: "霍尔塞特HX40W涡轮增压器，适用于康明斯6BT5.9发动机。", descriptionEn: "Holset HX40W turbocharger for Cummins 6BT5.9 engine.",
    specs: { compressorWheel: "60mm Inducer", turbineWheel: "76mm Exducer", maxBoost: "2.5 bar", wastegate: "Yes", weight: "11 kg", warranty: "12 months" },
    compatibleMachines: [
      { brand: "Cummins", model: "6BT5.9", yearRange: "2003-2018" },
      { brand: "Dongfeng", model: "EQ2102", yearRange: "2008-2018" },
    ],
  },
  {
    subSystemCode: "powertrain", componentGroupCode: "cooling_system",
    sku: "SD-TRACTOR-PWR-009",
    nameZh: "约翰迪尔 水泵总成", nameEn: "John Deere Water Pump Assembly", nameRu: "John Deere Water Pump Assembly",
    brand: "John Deere", oemNumber: "RE225739",
    price: 1500, stockStatus: "in_stock", isOEM: true,
    descriptionZh: "约翰迪尔原厂水泵总成，适用于6系列拖拉机4.5L发动机。", descriptionEn: "John Deere genuine water pump assembly for 6 Series tractor 4.5L engine.",
    specs: { material: "Cast Aluminum Housing", impellerDiameter: "85mm", flow: "120 L/min", bearing: "Double Row Ball", weight: "3.2 kg", warranty: "12 months" },
    compatibleMachines: [
      { brand: "John Deere", model: "6120M", yearRange: "2017-2024" },
      { brand: "John Deere", model: "6155M", yearRange: "2017-2024" },
      { brand: "John Deere", model: "6175M", yearRange: "2018-2024" },
    ],
  },

  // ── 液压系统 (HYD) ──
  {
    subSystemCode: "hydraulic_system", componentGroupCode: "hydraulic_pump",
    sku: "SD-TRACTOR-HYD-001",
    nameZh: "博世力士乐 液压齿轮泵 A10VSO", nameEn: "Bosch Rexroth Hydraulic Gear Pump A10VSO", nameRu: "Bosch Rexroth Hydraulic Gear Pump A10VSO",
    brand: "Bosch Rexroth", oemNumber: "A10VSO45DFR/31R",
    price: 8500, stockStatus: "in_stock", isOEM: true,
    descriptionZh: "博世力士乐A10VSO系列变量轴向柱塞泵，排量45cc/rev。", descriptionEn: "Bosch Rexroth A10VSO series variable displacement axial piston pump, 45cc/rev.",
    specs: { displacement: "45 cc/rev", maxPressure: "280 bar", ratedPressure: "250 bar", maxSpeed: "2200 rpm", weight: "22 kg", portSize: "SAE 1-1/16", warranty: "12 months" },
    compatibleMachines: [
      { brand: "John Deere", model: "6155R", yearRange: "2014-2020" },
      { brand: "John Deere", model: "6175R", yearRange: "2014-2020" },
    ],
  },
  {
    subSystemCode: "hydraulic_system", componentGroupCode: "hydraulic_cylinder",
    sku: "SD-TRACTOR-HYD-002",
    nameZh: "派克 液压油缸 (双作用)", nameEn: "Parker Hydraulic Cylinder (Double-Acting)", nameRu: "Parker Hydraulic Cylinder (Double-Acting)",
    brand: "Parker", oemNumber: "2H-2.50-CRS-USA",
    price: 3200, stockStatus: "in_stock", isOEM: false,
    descriptionZh: "派克双作用液压油缸，缸径63mm，行程800mm，用于拖拉机提升臂。", descriptionEn: "Parker double-acting hydraulic cylinder, bore 63mm, stroke 800mm, for tractor lift arm.",
    specs: { bore: "63mm", stroke: "800mm", rodDiameter: "35mm", maxPressure: "210 bar", sealType: "Polyurethane", weight: "18 kg", warranty: "12 months" },
    compatibleMachines: [
      { brand: "John Deere", model: "6120M", yearRange: "2017-2024" },
      { brand: "John Deere", model: "6155M", yearRange: "2017-2024" },
      { brand: "Massey Ferguson", model: "5713", yearRange: "2015-2022" },
    ],
  },
  {
    subSystemCode: "hydraulic_system", componentGroupCode: "hydraulic_valve",
    sku: "SD-TRACTOR-HYD-003",
    nameZh: "伊顿 液压多路换向阀", nameEn: "Eaton Hydraulic Directional Control Valve", nameRu: "Eaton Hydraulic Directional Control Valve",
    brand: "Eaton", oemNumber: "DLPS-3-10-S",
    price: 4200, stockStatus: "low_stock", isOEM: false,
    descriptionZh: "伊顿3路液压多路换向阀，带溢流阀，适用于拖拉机液压系统。", descriptionEn: "Eaton 3-spool hydraulic directional control valve with relief valve, for tractor hydraulic systems.",
    specs: { spools: "3", maxFlow: "80 L/min", maxPressure: "250 bar", portSize: "G1/2", valveType: "Open Center", weight: "12 kg", warranty: "12 months" },
    compatibleMachines: [
      { brand: "John Deere", model: "6155M", yearRange: "2017-2024" },
      { brand: "Massey Ferguson", model: "5713", yearRange: "2015-2022" },
    ],
  },
  {
    subSystemCode: "hydraulic_system", componentGroupCode: "hydraulic_hose",
    sku: "SD-TRACTOR-HYD-004",
    nameZh: "盖茨 液压高压管总成 (1/2英寸)", nameEn: "Gates Hydraulic Hose Assembly (1/2 inch)", nameRu: "Gates Hydraulic Hose Assembly (1/2 inch)",
    brand: "Gates", oemNumber: "485-2118",
    price: 180, stockStatus: "in_stock", isOEM: false,
    descriptionZh: "盖茨液压高压管总成，1/2英寸SAE 100R2AT，长度1米，两端配法兰接头。", descriptionEn: "Gates hydraulic high-pressure hose assembly, 1/2 inch SAE 100R2AT, 1 meter length with flange fittings.",
    specs: { innerDiameter: "13mm (1/2 inch)", maxPressure: "280 bar", burstPressure: "1120 bar", temperature: "-40°C to 100°C", length: "1m", standard: "SAE 100R2AT", warranty: "6 months" },
    compatibleMachines: [
      { brand: "John Deere", model: "6120M", yearRange: "2017-2024" },
      { brand: "John Deere", model: "6155M", yearRange: "2017-2024" },
    ],
  },
  {
    subSystemCode: "hydraulic_system", componentGroupCode: "hydraulic_oil",
    sku: "SD-TRACTOR-HYD-005",
    nameZh: "壳得力 液压油 46# (20L)", nameEn: "Shell Tellus Hydraulic Oil 46 (20L)", nameRu: "Shell Tellus Hydraulic Oil 46 (20L)",
    brand: "Shell", oemNumber: "550045254",
    price: 420, stockStatus: "in_stock", isOEM: false,
    descriptionZh: "壳得力Tellus S2 M46抗磨液压油，20L桶装。", descriptionEn: "Shell Tellus S2 M46 anti-wear hydraulic oil, 20L pail.",
    specs: { viscosityGrade: "ISO VG 46", viscosity: "46 cSt @40°C", flashPoint: "220°C", pourPoint: "-30°C", volume: "20L", type: "Mineral Oil", warranty: "N/A" },
    compatibleMachines: [
      { brand: "John Deere", model: "6120M", yearRange: "2017-2024" },
      { brand: "Massey Ferguson", model: "5713", yearRange: "2015-2022" },
    ],
  },
  {
    subSystemCode: "hydraulic_system", componentGroupCode: "seal_kit",
    sku: "SD-TRACTOR-HYD-006",
    nameZh: "SKF 液压油封套件", nameEn: "SKF Hydraulic Seal Kit", nameRu: "SKF Hydraulic Seal Kit",
    brand: "SKF", oemNumber: "HMS5-AO-1000",
    price: 350, stockStatus: "in_stock", isOEM: false,
    descriptionZh: "SKF液压油缸密封套件，含活塞密封、活塞杆密封、防尘圈。", descriptionEn: "SKF hydraulic cylinder seal kit, includes piston seal, rod seal, and wiper seal.",
    specs: { material: "Polyurethane + NBR", temperature: "-30°C to 110°C", maxPressure: "250 bar", rodDiameter: "40mm", boreDiameter: "63mm", warranty: "12 months" },
    compatibleMachines: [
      { brand: "John Deere", model: "6120M", yearRange: "2017-2024" },
      { brand: "John Deere", model: "6155M", yearRange: "2017-2024" },
    ],
  },
  {
    subSystemCode: "hydraulic_system", componentGroupCode: "hydraulic_motor",
    sku: "SD-TRACTOR-HYD-007",
    nameZh: "丹佛斯 液压马达 OMM", nameEn: "Danfoss Hydraulic Motor OMM", nameRu: "Danfoss Hydraulic Motor OMM",
    brand: "Danfoss", oemNumber: "OMM 200-151-1",
    price: 5800, stockStatus: "out_of_stock", isOEM: true,
    descriptionZh: "丹佛斯OMM系列齿轮液压马达，排量200cc/rev。", descriptionEn: "Danfoss OMM series gear hydraulic motor, 200cc/rev displacement.",
    specs: { displacement: "200 cc/rev", maxPressure: "175 bar", maxSpeed: "400 rpm", maxTorque: "520 Nm", weight: "14 kg", portSize: "G1", warranty: "12 months" },
    compatibleMachines: [
      { brand: "John Deere", model: "6175R", yearRange: "2014-2020" },
      { brand: "Case IH", model: "Puma 165", yearRange: "2013-2020" },
    ],
  },

  // ── 电气系统 (ELE) ──
  {
    subSystemCode: "electrical_system", componentGroupCode: "alternator",
    sku: "SD-TRACTOR-ELE-001",
    nameZh: "博世 交流发电机 140A", nameEn: "Bosch Alternator 140A", nameRu: "Bosch Alternator 140A",
    brand: "Bosch", oemNumber: "0124525093",
    price: 1200, stockStatus: "in_stock", isOEM: true,
    descriptionZh: "博世140A交流发电机，适用于约翰迪尔6系列拖拉机。", descriptionEn: "Bosch 140A alternator for John Deere 6 Series tractors.",
    specs: { ratedOutput: "140A", voltage: "12V/14V", type: "Claw Pole", regulator: "Internal", pulleyType: "Multi-Rib", weight: "5.5 kg", warranty: "12 months" },
    compatibleMachines: [
      { brand: "John Deere", model: "6120M", yearRange: "2017-2024" },
      { brand: "John Deere", model: "6155M", yearRange: "2017-2024" },
      { brand: "John Deere", model: "6175M", yearRange: "2018-2024" },
    ],
  },
  {
    subSystemCode: "electrical_system", componentGroupCode: "starter_motor",
    sku: "SD-TRACTOR-ELE-002",
    nameZh: "博世 起动机 12V 3kW", nameEn: "Bosch Starter Motor 12V 3kW", nameRu: "Bosch Starter Motor 12V 3kW",
    brand: "Bosch", oemNumber: "0001231001",
    price: 1500, stockStatus: "in_stock", isOEM: true,
    descriptionZh: "博世12V 3kW直流行星齿轮减速起动机。", descriptionEn: "Bosch 12V 3kW DC planetary gear reduction starter motor.",
    specs: { voltage: "12V", power: "3kW", type: "Planetary Gear Reduction", teeth: "11T", direction: "CW", weight: "6.8 kg", warranty: "12 months" },
    compatibleMachines: [
      { brand: "John Deere", model: "6155M", yearRange: "2017-2024" },
      { brand: "John Deere", model: "6175M", yearRange: "2018-2024" },
    ],
  },
  {
    subSystemCode: "electrical_system", componentGroupCode: "ecu_controller",
    sku: "SD-TRACTOR-ELE-003",
    nameZh: "约翰迪尔 ECU控制器", nameEn: "John Deere ECU Controller", nameRu: "John Deere ECU Controller",
    brand: "John Deere", oemNumber: "RE284006",
    price: 9500, stockStatus: "low_stock", isOEM: true,
    descriptionZh: "约翰迪尔原厂发动机ECU控制模块，适用于6系列拖拉机。", descriptionEn: "John Deere genuine engine ECU control module for 6 Series tractors.",
    specs: { voltage: "12V", operatingTemp: "-40°C to 85°C", memory: "512KB Flash", connector: "81-pin AMP", weight: "0.8 kg", warranty: "12 months" },
    compatibleMachines: [
      { brand: "John Deere", model: "6120M", yearRange: "2017-2024" },
      { brand: "John Deere", model: "6155M", yearRange: "2017-2024" },
    ],
  },
  {
    subSystemCode: "electrical_system", componentGroupCode: "sensor",
    sku: "SD-TRACTOR-ELE-004",
    nameZh: "大陆集团 机油压力传感器", nameEn: "Continental Oil Pressure Sensor", nameRu: "Continental Oil Pressure Sensor",
    brand: "Continental", oemNumber: "RE187465",
    price: 280, stockStatus: "in_stock", isOEM: false,
    descriptionZh: "大陆集团机油压力传感器，螺纹M10x1，测量范围0-10bar。", descriptionEn: "Continental oil pressure sensor, M10x1 thread, 0-10 bar range.",
    specs: { threadSize: "M10x1", pressureRange: "0-10 bar", output: "0.5-4.5V", operatingTemp: "-40°C to 125°C", connector: "3-pin", warranty: "12 months" },
    compatibleMachines: [
      { brand: "John Deere", model: "6120M", yearRange: "2017-2024" },
      { brand: "John Deere", model: "6155M", yearRange: "2017-2024" },
    ],
  },
  {
    subSystemCode: "electrical_system", componentGroupCode: "wiring_harness",
    sku: "SD-TRACTOR-ELE-005",
    nameZh: "约翰迪尔 发动机线束", nameEn: "John Deere Engine Wiring Harness", nameRu: "John Deere Engine Wiring Harness",
    brand: "John Deere", oemNumber: "RE292006",
    price: 2200, stockStatus: "in_stock", isOEM: true,
    descriptionZh: "约翰迪尔原厂发动机线束总成，适用于6系列拖拉机。", descriptionEn: "John Deere genuine engine wiring harness assembly for 6 Series tractors.",
    specs: { wireGauge: "0.5-2.5 mm²", connectorType: "Deutsch DT/AMP", length: "2.5m", temperature: "-40°C to 105°C", protection: "PVC Sheath", warranty: "12 months" },
    compatibleMachines: [
      { brand: "John Deere", model: "6120M", yearRange: "2017-2024" },
      { brand: "John Deere", model: "6155M", yearRange: "2017-2024" },
    ],
  },
  {
    subSystemCode: "electrical_system", componentGroupCode: "relay",
    sku: "SD-TRACTOR-ELE-006",
    nameZh: "海拉 12V 40A 继电器", nameEn: "Hella 12V 40A Relay", nameRu: "Hella 12V 40A Relay",
    brand: "Hella", oemNumber: "4RD-007-023-00",
    price: 45, stockStatus: "in_stock", isOEM: false,
    descriptionZh: "海拉12V 40A 4脚通用继电器，ISO标准插脚。", descriptionEn: "Hella 12V 40A 4-pin universal relay, ISO standard footprint.",
    specs: { voltage: "12V DC", current: "40A", contacts: "4-pin SPST", coilResistance: "85 ohm", type: "ISO Mini", warranty: "12 months" },
    compatibleMachines: [
      { brand: "John Deere", model: "6120M", yearRange: "2017-2024" },
      { brand: "Massey Ferguson", model: "5713", yearRange: "2015-2022" },
    ],
  },
  {
    subSystemCode: "electrical_system", componentGroupCode: "instrument_panel",
    sku: "SD-TRACTOR-ELE-007",
    nameZh: "约翰迪尔 仪表盘总成", nameEn: "John Deere Instrument Panel Assembly", nameRu: "John Deere Instrument Panel Assembly",
    brand: "John Deere", oemNumber: "RE330302",
    price: 3800, stockStatus: "low_stock", isOEM: true,
    descriptionZh: "约翰迪尔原厂数字仪表盘总成，含转速表、油量表、警示灯。", descriptionEn: "John Deere genuine digital instrument panel assembly, includes tachometer, fuel gauge, warning lights.",
    specs: { displayType: "LCD Digital", voltage: "12V", indicators: "RPM/Fuel/Temp/Hours", connector: "24-pin", operatingTemp: "-30°C to 70°C", warranty: "12 months" },
    compatibleMachines: [
      { brand: "John Deere", model: "6155M", yearRange: "2017-2024" },
      { brand: "John Deere", model: "6175M", yearRange: "2018-2024" },
    ],
  },
  {
    subSystemCode: "electrical_system", componentGroupCode: "battery",
    sku: "SD-TRACTOR-ELE-008",
    nameZh: "风帆 12V 100Ah 蓄电池", nameEn: "Fengfan 12V 100Ah Battery", nameRu: "Fengfan 12V 100Ah Battery",
    brand: "Fengfan", oemNumber: "6-QW-100",
    price: 650, stockStatus: "in_stock", isOEM: false,
    descriptionZh: "风帆12V 100Ah免维护铅酸蓄电池，冷启动电流800A。", descriptionEn: "Fengfan 12V 100Ah maintenance-free lead-acid battery, 800A cold cranking amps.",
    specs: { voltage: "12V", capacity: "100Ah", cca: "800A", type: "MF Lead-Acid", dimensions: "407x173x225mm", weight: "30 kg", warranty: "18 months" },
    compatibleMachines: [
      { brand: "John Deere", model: "6120M", yearRange: "2017-2024" },
      { brand: "Dongfanghong", model: "LX754", yearRange: "2015-2022" },
    ],
  },
  {
    subSystemCode: "electrical_system", componentGroupCode: "lighting",
    sku: "SD-TRACTOR-ELE-009",
    nameZh: "海拉 LED前照灯总成", nameEn: "Hella LED Headlight Assembly", nameRu: "Hella LED Headlight Assembly",
    brand: "Hella", oemNumber: "1EX-007-xxx-1",
    price: 850, stockStatus: "in_stock", isOEM: false,
    descriptionZh: "海拉LED前照灯总成，适用于拖拉机前部照明，防水IP67。", descriptionEn: "Hella LED headlight assembly for tractor front lighting, IP67 waterproof.",
    specs: { lightSource: "LED", voltage: "12V/24V", power: "30W", beamPattern: "ECE R112", waterproof: "IP67", weight: "1.2 kg", warranty: "24 months" },
    compatibleMachines: [
      { brand: "John Deere", model: "6120M", yearRange: "2017-2024" },
      { brand: "Massey Ferguson", model: "5713", yearRange: "2015-2022" },
    ],
  },

  // ── 传动系统 (TRN) ──
  {
    subSystemCode: "transmission_system", componentGroupCode: "clutch",
    sku: "SD-TRACTOR-TRN-001",
    nameZh: "萨克斯 离合器从动盘总成", nameEn: "ZF Sachs Clutch Driven Plate Assembly", nameRu: "ZF Sachs Clutch Driven Plate Assembly",
    brand: "ZF Sachs", oemNumber: "3000-951-030",
    price: 2800, stockStatus: "in_stock", isOEM: true,
    descriptionZh: "萨克斯离合器从动盘总成，直径350mm，适用于拖拉机干式离合器。", descriptionEn: "ZF Sachs clutch driven plate assembly, 350mm diameter, for tractor dry clutch.",
    specs: { diameter: "350mm", type: "Dry Single Disc", frictionMaterial: "Organic", splineTeeth: "21T", thickness: "9.5mm", warranty: "12 months" },
    compatibleMachines: [
      { brand: "John Deere", model: "6120M", yearRange: "2017-2024" },
      { brand: "John Deere", model: "6155M", yearRange: "2017-2024" },
    ],
  },
  {
    subSystemCode: "transmission_system", componentGroupCode: "gearbox",
    sku: "SD-TRACTOR-TRN-002",
    nameZh: "约翰迪ere 变速箱同步器组件", nameEn: "John Deere Transmission Synchronizer Assembly", nameRu: "John Deere Transmission Synchronizer Assembly",
    brand: "John Deere", oemNumber: "RE288328",
    price: 4500, stockStatus: "low_stock", isOEM: true,
    descriptionZh: "约翰迪尔原厂变速箱同步器组件，适用于AutoQuad变速箱。", descriptionEn: "John Deere genuine transmission synchronizer assembly for AutoQuad transmission.",
    specs: { type: "Cone Synchronizer", gearRatios: "4-speed", material: "Brass Friction Ring + Steel Hub", bearing: "Needle Roller", weight: "4.5 kg", warranty: "12 months" },
    compatibleMachines: [
      { brand: "John Deere", model: "6155M", yearRange: "2017-2024" },
      { brand: "John Deere", model: "6175M", yearRange: "2018-2024" },
    ],
  },
  {
    subSystemCode: "transmission_system", componentGroupCode: "gear_set",
    sku: "SD-TRACTOR-TRN-003",
    nameZh: "SKF 变速箱齿轮组 (副轴)", nameEn: "SKF Transmission Gear Set (Countershaft)", nameRu: "SKF Transmission Gear Set (Countershaft)",
    brand: "SKF", oemNumber: "RE519862",
    price: 3200, stockStatus: "in_stock", isOEM: false,
    descriptionZh: "变速箱副轴齿轮组，含3个齿轮和轴，20CrMnTi材质。", descriptionEn: "Transmission countershaft gear set, includes 3 gears and shaft, 20CrMnTi material.",
    specs: { material: "20CrMnTi Carburized", teeth: "28T/34T/42T", module: "4", hardness: "HRC 58-62", weight: "8 kg", warranty: "12 months" },
    compatibleMachines: [
      { brand: "John Deere", model: "6120M", yearRange: "2017-2024" },
      { brand: "John Deere", model: "6155M", yearRange: "2017-2024" },
    ],
  },
  {
    subSystemCode: "transmission_system", componentGroupCode: "drive_shaft",
    sku: "SD-TRACTOR-TRN-004",
    nameZh: "GKN 传动轴总成", nameEn: "GKN Drive Shaft Assembly", nameRu: "GKN Drive Shaft Assembly",
    brand: "GKN", oemNumber: "RE293123",
    price: 2800, stockStatus: "in_stock", isOEM: true,
    descriptionZh: "GKN传动轴总成，含万向节，长度850mm。", descriptionEn: "GKN drive shaft assembly with universal joints, 850mm length.",
    specs: { length: "850mm", tubeDiameter: "65mm", material: "High-Strength Steel", jointType: "Cross Joint", spline: "16T", weight: "12 kg", warranty: "12 months" },
    compatibleMachines: [
      { brand: "John Deere", model: "6155M", yearRange: "2017-2024" },
      { brand: "John Deere", model: "6175M", yearRange: "2018-2024" },
    ],
  },
  {
    subSystemCode: "transmission_system", componentGroupCode: "differential",
    sku: "SD-TRACTOR-TRN-005",
    nameZh: "约翰迪尔 差速器总成", nameEn: "John Deere Differential Assembly", nameRu: "John Deere Differential Assembly",
    brand: "John Deere", oemNumber: "RE284932",
    price: 8500, stockStatus: "low_stock", isOEM: true,
    descriptionZh: "约翰迪尔原厂差速器总成，适用于后桥，含差速锁。", descriptionEn: "John Deere genuine differential assembly for rear axle, with diff lock.",
    specs: { type: "Bevel Gear Differential", ratio: "3.6:1", diffLock: "Hydraulic", material: "Forged Steel", bearingType: "Tapered Roller", weight: "35 kg", warranty: "12 months" },
    compatibleMachines: [
      { brand: "John Deere", model: "6155M", yearRange: "2017-2024" },
      { brand: "John Deere", model: "6175M", yearRange: "2018-2024" },
    ],
  },
  {
    subSystemCode: "transmission_system", componentGroupCode: "belt_chain",
    sku: "SD-TRACTOR-TRN-006",
    nameZh: "盖茨 三角带 B型 (1750mm)", nameEn: "Gates V-Belt Type B (1750mm)", nameRu: "Gates V-Belt Type B (1750mm)",
    brand: "Gates", oemNumber: "B174",
    price: 85, stockStatus: "in_stock", isOEM: false,
    descriptionZh: "盖茨B型三角带，长度1750mm，适用于拖拉机风扇和水泵驱动。", descriptionEn: "Gates Type B V-belt, 1750mm length, for tractor fan and water pump drive.",
    specs: { type: "Classical V-Belt B", length: "1750mm", topWidth: "17mm", height: "11mm", material: "CR Rubber + Polyester Cord", temperature: "-30°C to 80°C", warranty: "6 months" },
    compatibleMachines: [
      { brand: "John Deere", model: "6120M", yearRange: "2017-2024" },
      { brand: "Dongfanghong", model: "LX754", yearRange: "2015-2022" },
    ],
  },
  {
    subSystemCode: "transmission_system", componentGroupCode: "universal_joint",
    sku: "SD-TRACTOR-TRN-007",
    nameZh: "SKF 万向节十字轴 (PTO)", nameEn: "SKF Universal Joint Cross (PTO)", nameRu: "SKF Universal Joint Cross (PTO)",
    brand: "SKF", oemNumber: "RE291255",
    price: 420, stockStatus: "in_stock", isOEM: false,
    descriptionZh: "SKF万向节十字轴，适用于PTO传动轴，带滚针轴承。", descriptionEn: "SKF universal joint cross for PTO drive shaft, with needle bearings.",
    specs: { journalDiameter: "22mm", trunnionLength: "70mm", bearingType: "Needle Roller", material: "Bearing Steel GCr15", series: "Series 6", warranty: "12 months" },
    compatibleMachines: [
      { brand: "John Deere", model: "6120M", yearRange: "2017-2024" },
      { brand: "John Deere", model: "6155M", yearRange: "2017-2024" },
    ],
  },

  // ── 行走系统 (CHS) ──
  {
    subSystemCode: "chassis_system", componentGroupCode: "tire",
    sku: "SD-TRACTOR-CHS-001",
    nameZh: "米其林 后轮 18.4R38", nameEn: "Michelin Rear Tire 18.4R38", nameRu: "Michelin Rear Tire 18.4R38",
    brand: "Michelin", oemNumber: "68088",
    price: 5200, stockStatus: "in_stock", isOEM: false,
    descriptionZh: "米其林18.4R38子午线后轮，R1花纹，适用于大功率拖拉机。", descriptionEn: "Michelin 18.4R38 radial rear tire, R1 tread pattern, for high-power tractors.",
    specs: { size: "18.4R38", type: "Radial", treadPattern: "R1 (Agricultural)", plyRating: "10 PR", maxLoad: "3150 kg", pressure: "1.4 bar", warranty: "24 months" },
    compatibleMachines: [
      { brand: "John Deere", model: "6155M", yearRange: "2017-2024" },
      { brand: "John Deere", model: "6175M", yearRange: "2018-2024" },
      { brand: "Massey Ferguson", model: "5713", yearRange: "2015-2022" },
    ],
  },
  {
    subSystemCode: "chassis_system", componentGroupCode: "tire",
    sku: "SD-TRACTOR-CHS-002",
    nameZh: "米其林 前轮 14.9R28", nameEn: "Michelin Front Tire 14.9R28", nameRu: "Michelin Front Tire 14.9R28",
    brand: "Michelin", oemNumber: "68077",
    price: 3200, stockStatus: "in_stock", isOEM: false,
    descriptionZh: "米其林14.9R28子午线前轮，R1花纹，导向轮专用。", descriptionEn: "Michelin 14.9R28 radial front tire, R1 tread pattern, steering tire.",
    specs: { size: "14.9R28", type: "Radial", treadPattern: "R1 (Agricultural)", plyRating: "8 PR", maxLoad: "2200 kg", pressure: "2.0 bar", warranty: "24 months" },
    compatibleMachines: [
      { brand: "John Deere", model: "6155M", yearRange: "2017-2024" },
      { brand: "John Deere", model: "6175M", yearRange: "2018-2024" },
    ],
  },
  {
    subSystemCode: "chassis_system", componentGroupCode: "track",
    sku: "SD-TRACTOR-CHS-003",
    nameZh: "橡胶履带 400mm (卡特彼勒规格)", nameEn: "Rubber Track 400mm (Caterpillar Spec)", nameRu: "Rubber Track 400mm (Caterpillar Spec)",
    brand: "Camso", oemNumber: "CTX-400-100",
    price: 8500, stockStatus: "low_stock", isOEM: false,
    descriptionZh: "Camso橡胶履带，宽400mm，节距100mm，适用于履带拖拉机。", descriptionEn: "Camso rubber track, 400mm width, 100mm pitch, for tracked tractors.",
    specs: { width: "400mm", pitch: "100mm", links: "80", type: "Rubber Track", core: "Steel Cords", weight: "85 kg", warranty: "12 months" },
    compatibleMachines: [
      { brand: "Caterpillar", model: "Challenger MT765", yearRange: "2012-2020" },
    ],
  },
  {
    subSystemCode: "chassis_system", componentGroupCode: "axle",
    sku: "SD-TRACTOR-CHS-004",
    nameZh: "约翰迪尔 前桥总成", nameEn: "John Deere Front Axle Assembly", nameRu: "John Deere Front Axle Assembly",
    brand: "John Deere", oemNumber: "RE287758",
    price: 18000, stockStatus: "out_of_stock", isOEM: true,
    descriptionZh: "约翰迪尔原厂前桥总成，含转向节、悬挂臂、4WD驱动轴。", descriptionEn: "John Deere genuine front axle assembly, includes steering knuckle, suspension arm, 4WD drive shaft.",
    specs: { type: "4WD Front Axle", loadCapacity: "4500 kg", trackWidth: "1600-2000mm", steering: "Hydraulic Assist", material: "Ductile Iron", weight: "120 kg", warranty: "12 months" },
    compatibleMachines: [
      { brand: "John Deere", model: "6155M", yearRange: "2017-2024" },
      { brand: "John Deere", model: "6175M", yearRange: "2018-2024" },
    ],
  },
  {
    subSystemCode: "chassis_system", componentGroupCode: "brake_system",
    sku: "SD-TRACTOR-CHS-005",
    nameZh: "约翰迪尔 制动器摩擦片组", nameEn: "John Deere Brake Friction Disc Set", nameRu: "John Deere Brake Friction Disc Set",
    brand: "John Deere", oemNumber: "RE285650",
    price: 1800, stockStatus: "in_stock", isOEM: true,
    descriptionZh: "约翰迪尔原厂湿式制动器摩擦片组，4片装，适用于后桥制动。", descriptionEn: "John Deere genuine wet brake friction disc set, 4 pieces, for rear axle brake.",
    specs: { type: "Wet Multi-Disc", outerDiameter: "220mm", innerDiameter: "150mm", frictionMaterial: "Sintered Bronze", quantity: "4 pcs", warranty: "12 months" },
    compatibleMachines: [
      { brand: "John Deere", model: "6120M", yearRange: "2017-2024" },
      { brand: "John Deere", model: "6155M", yearRange: "2017-2024" },
    ],
  },
  {
    subSystemCode: "chassis_system", componentGroupCode: "steering_system",
    sku: "SD-TRACTOR-CHS-006",
    nameZh: "博世 液压转向器", nameEn: "Bosch Hydraulic Steering Unit", nameRu: "Bosch Hydraulic Steering Unit",
    brand: "Bosch", oemNumber: "RE188640",
    price: 3800, stockStatus: "in_stock", isOEM: true,
    descriptionZh: "博世开芯液压转向器，排量160cc/rev，适用于拖拉机转向系统。", descriptionEn: "Bosch open-center hydraulic steering unit, 160cc/rev, for tractor steering systems.",
    specs: { displacement: "160 cc/rev", type: "Open Center Orbitrol", maxPressure: "175 bar", portSize: "G1/2", checkValve: "Built-in", weight: "8.5 kg", warranty: "12 months" },
    compatibleMachines: [
      { brand: "John Deere", model: "6120M", yearRange: "2017-2024" },
      { brand: "John Deere", model: "6155M", yearRange: "2017-2024" },
    ],
  },
  {
    subSystemCode: "chassis_system", componentGroupCode: "wheel_hub",
    sku: "SD-TRACTOR-CHS-007",
    nameZh: "SKF 前轮毂轴承套件", nameEn: "SKF Front Wheel Hub Bearing Kit", nameRu: "SKF Front Wheel Hub Bearing Kit",
    brand: "SKF", oemNumber: "VKBA-3589",
    price: 580, stockStatus: "in_stock", isOEM: false,
    descriptionZh: "SKF前轮毂轴承套件，含双列圆锥滚子轴承和油封。", descriptionEn: "SKF front wheel hub bearing kit, includes double-row tapered roller bearing and seal.",
    specs: { bearingType: "Double-Row Tapered Roller", innerDiameter: "55mm", outerDiameter: "100mm", sealIncluded: "Yes", material: "Bearing Steel GCr15", warranty: "12 months" },
    compatibleMachines: [
      { brand: "John Deere", model: "6120M", yearRange: "2017-2024" },
      { brand: "John Deere", model: "6155M", yearRange: "2017-2024" },
    ],
  },

  // ── 工作装置 (WIM) ──
  {
    subSystemCode: "working_implement", componentGroupCode: "three_point_hitch",
    sku: "SD-TRACTOR-WIM-001",
    nameZh: "约翰迪尔 三点悬挂连杆套件", nameEn: "John Deere Three-Point Hitch Linkage Kit", nameRu: "John Deere Three-Point Hitch Linkage Kit",
    brand: "John Deere", oemNumber: "RE291948",
    price: 2800, stockStatus: "in_stock", isOEM: true,
    descriptionZh: "约翰迪尔原厂三点悬挂连杆套件，含上下连杆和提升臂。", descriptionEn: "John Deere genuine three-point hitch linkage kit, includes upper/lower links and lift arms.",
    specs: { category: "Cat 2", liftCapacity: "3500 kg", material: "Forged Steel", adjustmentRange: "Quick Adjust", pinDiameter: "22mm", weight: "28 kg", warranty: "12 months" },
    compatibleMachines: [
      { brand: "John Deere", model: "6155M", yearRange: "2017-2024" },
      { brand: "John Deere", model: "6175M", yearRange: "2018-2024" },
    ],
  },
  {
    subSystemCode: "working_implement", componentGroupCode: "pto",
    sku: "SD-TRACTOR-WIM-002",
    nameZh: "约翰迪尔 PTO轴总成 (540/1000rpm)", nameEn: "John Deere PTO Shaft Assembly (540/1000rpm)", nameRu: "John Deere PTO Shaft Assembly (540/1000rpm)",
    brand: "John Deere", oemNumber: "RE287863",
    price: 4200, stockStatus: "in_stock", isOEM: true,
    descriptionZh: "约翰迪尔原厂动力输出轴总成，双速540/1000rpm，21齿花键。", descriptionEn: "John Deere genuine PTO shaft assembly, dual speed 540/1000 rpm, 21-spline.",
    specs: { speeds: "540/1000 rpm", spline: "21T (1-3/8 inch)", type: "Independent PTO", clutch: "Wet Clutch", material: "Forged Steel", weight: "18 kg", warranty: "12 months" },
    compatibleMachines: [
      { brand: "John Deere", model: "6120M", yearRange: "2017-2024" },
      { brand: "John Deere", model: "6155M", yearRange: "2017-2024" },
    ],
  },
  {
    subSystemCode: "working_implement", componentGroupCode: "drawbar",
    sku: "SD-TRACTOR-WIM-003",
    nameZh: "约翰迪尔 牵引装置总成", nameEn: "John Deere Drawbar Assembly", nameRu: "John Deere Drawbar Assembly",
    brand: "John Deere", oemNumber: "RE285640",
    price: 1500, stockStatus: "in_stock", isOEM: true,
    descriptionZh: "约翰迪尔原厂牵引装置总成，可摆动式，含牵引销。", descriptionEn: "John Deere genuine drawbar assembly, swinging type, includes drawbar pin.",
    specs: { type: "Swinging Drawbar", pinDiameter: "33mm", material: "Forged Steel C45", maxDraw: "4500 kg", swivelAngle: "±15°", weight: "15 kg", warranty: "12 months" },
    compatibleMachines: [
      { brand: "John Deere", model: "6120M", yearRange: "2017-2024" },
      { brand: "John Deere", model: "6155M", yearRange: "2017-2024" },
    ],
  },
  {
    subSystemCode: "working_implement", componentGroupCode: "counterweight",
    sku: "SD-TRACTOR-WIM-004",
    nameZh: "约翰迪尔 前配重块 (100kg)", nameEn: "John Deere Front Counterweight (100kg)", nameRu: "John Deere Front Counterweight (100kg)",
    brand: "John Deere", oemNumber: "RE290758",
    price: 850, stockStatus: "in_stock", isOEM: true,
    descriptionZh: "约翰迪尔原厂前配重块，单块100kg，铸铁材质。", descriptionEn: "John Deere genuine front counterweight, 100kg per block, cast iron.",
    specs: { weight: "100 kg", material: "Cast Iron", mounting: "Quick-Attach Bracket", dimensions: "450x300x120mm", surface: "Powder Coated", warranty: "N/A" },
    compatibleMachines: [
      { brand: "John Deere", model: "6120M", yearRange: "2017-2024" },
      { brand: "John Deere", model: "6155M", yearRange: "2017-2024" },
    ],
  },
  {
    subSystemCode: "working_implement", componentGroupCode: "quick_hitch",
    sku: "SD-TRACTOR-WIM-005",
    nameZh: "快挂式三点悬挂挂接器", nameEn: "Quick-Attach Three-Point Hitch Adapter", nameRu: "Quick-Attach Three-Point Hitch Adapter",
    brand: "Patu", oemNumber: "QH-CAT2-S",
    price: 2800, stockStatus: "low_stock", isOEM: false,
    descriptionZh: "快挂式三点悬挂挂接器，Cat 2规格，实现农具免下车间挂。", descriptionEn: "Quick-attach three-point hitch adapter, Cat 2 spec, for implement hitching without leaving the cab.",
    specs: { category: "Cat 2", material: "High-Strength Steel Q345", maxLoad: "3000 kg", pinSize: "22mm", operation: "Hydraulic from Cab", weight: "35 kg", warranty: "12 months" },
    compatibleMachines: [
      { brand: "John Deere", model: "6155M", yearRange: "2017-2024" },
      { brand: "Massey Ferguson", model: "5713", yearRange: "2015-2022" },
    ],
  },

  // ── 车身驾驶室 (BCB) ──
  {
    subSystemCode: "body_cab", componentGroupCode: "cab",
    sku: "SD-TRACTOR-BCB-001",
    nameZh: "约翰迪尔 驾驶室总成", nameEn: "John Deere Cab Assembly", nameRu: "John Deere Cab Assembly",
    brand: "John Deere", oemNumber: "RE287945",
    price: 45000, stockStatus: "out_of_stock", isOEM: true,
    descriptionZh: "约翰迪尔原厂驾驶室总成，含框架、玻璃、密封件，6系列。", descriptionEn: "John Deere genuine cab assembly, includes frame, glass, seals. 6 Series.",
    specs: { type: "SoundGuard Plus", glassType: "Tempered Safety Glass", noiseLevel: "74 dB(A)", airConditioning: "Included", seatType: "Air Suspension", weight: "380 kg", warranty: "12 months" },
    compatibleMachines: [
      { brand: "John Deere", model: "6155M", yearRange: "2017-2024" },
      { brand: "John Deere", model: "6175M", yearRange: "2018-2024" },
    ],
  },
  {
    subSystemCode: "body_cab", componentGroupCode: "hood",
    sku: "SD-TRACTOR-BCB-002",
    nameZh: "约翰迪尔 机罩总成", nameEn: "John Deere Hood Assembly", nameRu: "John Deere Hood Assembly",
    brand: "John Deere", oemNumber: "RE290152",
    price: 3800, stockStatus: "in_stock", isOEM: true,
    descriptionZh: "约翰迪尔原厂机罩总成，含铰链、锁扣，注塑材质。", descriptionEn: "John Deere genuine hood assembly, includes hinges and latches. Injection molded.",
    specs: { material: "ABS + Fiberglass", color: "John Deere Green", hinges: "Included", latchType: "Gas Strut Assisted", weight: "22 kg", warranty: "12 months" },
    compatibleMachines: [
      { brand: "John Deere", model: "6120M", yearRange: "2017-2024" },
      { brand: "John Deere", model: "6155M", yearRange: "2017-2024" },
    ],
  },
  {
    subSystemCode: "body_cab", componentGroupCode: "fender",
    sku: "SD-TRACTOR-BCB-003",
    nameZh: "约翰迪尔 后挡泥板 (左)", nameEn: "John Deere Rear Fender (Left)", nameRu: "John Deere Rear Fender (Left)",
    brand: "John Deere", oemNumber: "RE289437",
    price: 1200, stockStatus: "in_stock", isOEM: true,
    descriptionZh: "约翰迪尔原厂后挡泥板（左侧），注塑材质。", descriptionEn: "John Deere genuine rear fender (left side), injection molded.",
    specs: { material: "Polypropylene", side: "Left", mounting: "Bolt-On", color: "Black", weight: "6 kg", warranty: "12 months" },
    compatibleMachines: [
      { brand: "John Deere", model: "6120M", yearRange: "2017-2024" },
      { brand: "John Deere", model: "6155M", yearRange: "2017-2024" },
    ],
  },
  {
    subSystemCode: "body_cab", componentGroupCode: "seat",
    sku: "SD-TRACTOR-BCB-004",
    nameZh: "格拉默 空气悬挂座椅", nameEn: "Grammer Air Suspension Seat", nameRu: "Grammer Air Suspension Seat",
    brand: "Grammer", oemNumber: "RE289685",
    price: 4500, stockStatus: "in_stock", isOEM: false,
    descriptionZh: "格拉默空气悬挂座椅，含加热、腰部支撑，适用于约翰迪尔拖拉机。", descriptionEn: "Grammer air suspension seat, with heating and lumbar support, for John Deere tractors.",
    specs: { type: "Pneumatic Suspension", weightCapacity: "150 kg", adjustment: "8-way", heating: "Yes", material: "Fabric/Leather", armrest: "Adjustable", warranty: "12 months" },
    compatibleMachines: [
      { brand: "John Deere", model: "6120M", yearRange: "2017-2024" },
      { brand: "John Deere", model: "6155M", yearRange: "2017-2024" },
    ],
  },
  {
    subSystemCode: "body_cab", componentGroupCode: "mirror",
    sku: "SD-TRACTOR-BCB-005",
    nameZh: "约翰迪尔 后视镜总成 (右侧)", nameEn: "John Deere Rear View Mirror Assembly (Right)", nameRu: "John Deere Rear View Mirror Assembly (Right)",
    brand: "John Deere", oemNumber: "RE289470",
    price: 380, stockStatus: "in_stock", isOEM: true,
    descriptionZh: "约翰迪尔原厂右侧后视镜总成，含支架和调节杆。", descriptionEn: "John Deere genuine right side rear view mirror assembly, includes bracket and adjuster.",
    specs: { type: "Convex Wide-Angle", side: "Right", mirrorSize: "300x200mm", housing: "ABS Black", adjustment: "Manual Rod", weight: "1.5 kg", warranty: "12 months" },
    compatibleMachines: [
      { brand: "John Deere", model: "6120M", yearRange: "2017-2024" },
      { brand: "John Deere", model: "6155M", yearRange: "2017-2024" },
    ],
  },
  {
    subSystemCode: "body_cab", componentGroupCode: "glass",
    sku: "SD-TRACTOR-BCB-006",
    nameZh: "钢化玻璃 前挡风 (6系列)", nameEn: "Tempered Glass Windshield (6 Series)", nameRu: "Tempered Glass Windshield (6 Series)",
    brand: "John Deere", oemNumber: "RE288796",
    price: 1800, stockStatus: "low_stock", isOEM: true,
    descriptionZh: "约翰迪尔原厂前挡风玻璃，钢化安全玻璃，适用于6系列驾驶室。", descriptionEn: "John Deere genuine front windshield, tempered safety glass, for 6 Series cab.",
    specs: { type: "Tempered Safety Glass", thickness: "5mm", dimensions: "1200x800mm", tint: "Clear", standard: "ECE R43", warranty: "12 months" },
    compatibleMachines: [
      { brand: "John Deere", model: "6120M", yearRange: "2017-2024" },
      { brand: "John Deere", model: "6155M", yearRange: "2017-2024" },
    ],
  },

  // ── 过滤系统 (FLT) ──
  {
    subSystemCode: "filter_system", componentGroupCode: "oil_filter",
    sku: "SD-TRACTOR-FLT-001",
    nameZh: "唐纳森 机油滤芯", nameEn: "Donaldson Oil Filter", nameRu: "Donaldson Oil Filter",
    brand: "Donaldson", oemNumber: "P550525",
    price: 120, stockStatus: "in_stock", isOEM: false,
    descriptionZh: "唐纳森机油滤芯，旋装式，适用于约翰迪尔PowerTech发动机。", descriptionEn: "Donaldson oil filter, spin-on type, for John Deere PowerTech engines.",
    specs: { type: "Spin-On", threadSize: "M22x1.5", filterMedia: "Cellulose + Synthetic Blend", micron: "20 micron", bypass: "1.5 bar", height: "180mm", warranty: "N/A" },
    compatibleMachines: [
      { brand: "John Deere", model: "6120M", yearRange: "2017-2024" },
      { brand: "John Deere", model: "6155M", yearRange: "2017-2024" },
      { brand: "John Deere", model: "6175M", yearRange: "2018-2024" },
    ],
  },
  {
    subSystemCode: "filter_system", componentGroupCode: "air_filter",
    sku: "SD-TRACTOR-FLT-002",
    nameZh: "唐纳森 空气滤芯总成", nameEn: "Donaldson Air Filter Assembly", nameRu: "Donaldson Air Filter Assembly",
    brand: "Donaldson", oemNumber: "P611650",
    price: 350, stockStatus: "in_stock", isOEM: false,
    descriptionZh: "唐纳森空气滤芯，主滤芯+安全滤芯双滤设计。", descriptionEn: "Donaldson air filter, dual-filter design with main element and safety element.",
    specs: { type: "Panel + Safety Element", filterMedia: "Cellulose Pleated", efficiency: "99.5%", outerDiameter: "280mm", height: "420mm", warranty: "N/A" },
    compatibleMachines: [
      { brand: "John Deere", model: "6120M", yearRange: "2017-2024" },
      { brand: "John Deere", model: "6155M", yearRange: "2017-2024" },
    ],
  },
  {
    subSystemCode: "filter_system", componentGroupCode: "fuel_filter",
    sku: "SD-TRACTOR-FLT-003",
    nameZh: "博世 燃油滤芯 (共轨系统)", nameEn: "Bosch Fuel Filter (Common Rail)", nameRu: "Bosch Fuel Filter (Common Rail)",
    brand: "Bosch", oemNumber: "F026402001",
    price: 180, stockStatus: "in_stock", isOEM: true,
    descriptionZh: "博世燃油滤清器，适用于高压共轨系统，含水分离功能。", descriptionEn: "Bosch fuel filter for high-pressure common rail systems, with water separation.",
    specs: { type: "Spin-On with Water Separator", threadSize: "M16x1.5", filterMedia: "Multi-Layer Synthetic", micron: "5 micron", waterSeparation: "95%", height: "150mm", warranty: "N/A" },
    compatibleMachines: [
      { brand: "John Deere", model: "6155R", yearRange: "2014-2020" },
      { brand: "John Deere", model: "6175R", yearRange: "2014-2020" },
    ],
  },
  {
    subSystemCode: "filter_system", componentGroupCode: "hydraulic_filter",
    sku: "SD-TRACTOR-FLT-004",
    nameZh: "约翰迪尔 液压回油滤芯", nameEn: "John Deere Hydraulic Return Filter", nameRu: "John Deere Hydraulic Return Filter",
    brand: "John Deere", oemNumber: "RE288856",
    price: 280, stockStatus: "in_stock", isOEM: true,
    descriptionZh: "约翰迪尔原厂液压回油滤芯，玻璃纤维材质。", descriptionEn: "John Deere genuine hydraulic return filter, fiberglass media.",
    specs: { type: "Spin-On Return", filterMedia: "Fiberglass", micron: "10 micron", bypass: "2.5 bar", threadSize: "M27x2", height: "220mm", warranty: "N/A" },
    compatibleMachines: [
      { brand: "John Deere", model: "6120M", yearRange: "2017-2024" },
      { brand: "John Deere", model: "6155M", yearRange: "2017-2024" },
    ],
  },
  {
    subSystemCode: "filter_system", componentGroupCode: "cabin_filter",
    sku: "SD-TRACTOR-FLT-005",
    nameZh: "曼牌 空调滤芯 (驾驶室)", nameEn: "Mann-Filter Cabin Air Filter", nameRu: "Mann-Filter Cabin Air Filter",
    brand: "Mann-Filter", oemNumber: "CUK-2629",
    price: 95, stockStatus: "in_stock", isOEM: false,
    descriptionZh: "曼牌空调滤芯，活性炭复合材质，适用于拖拉机驾驶室。", descriptionEn: "Mann-Filter cabin air filter, activated carbon composite, for tractor cab.",
    specs: { type: "Activated Carbon Panel", dimensions: "220x180x30mm", filterMedia: "Activated Carbon + Non-Woven", efficiency: "PM2.5 95%", warranty: "N/A" },
    compatibleMachines: [
      { brand: "John Deere", model: "6120M", yearRange: "2017-2024" },
      { brand: "John Deere", model: "6155M", yearRange: "2017-2024" },
    ],
  },
  {
    subSystemCode: "filter_system", componentGroupCode: "water_separator",
    sku: "SD-TRACTOR-FLT-006",
    nameZh: "斯坦尼 油水分离器", nameEn: "Stanadyne Fuel Water Separator", nameRu: "Stanadyne Fuel Water Separator",
    brand: "Stanadyne", oemNumber: "12-702",
    price: 420, stockStatus: "low_stock", isOEM: false,
    descriptionZh: "斯坦尼油水分离器，带手动放水阀和加热功能。", descriptionEn: "Stanadyne fuel water separator with manual drain valve and heating.",
    specs: { type: "Bowl Separator with Heater", flowRate: "90 L/h", waterRemoval: "99%", drain: "Manual Valve", portSize: "M14x1.5", voltage: "12V", warranty: "12 months" },
    compatibleMachines: [
      { brand: "John Deere", model: "6155R", yearRange: "2014-2020" },
      { brand: "John Deere", model: "6175R", yearRange: "2014-2020" },
    ],
  },

  // ── 轴承密封 (BRS) ──
  {
    subSystemCode: "bearing_seal_system", componentGroupCode: "ball_bearing",
    sku: "SD-TRACTOR-BRS-001",
    nameZh: "SKF 深沟球轴承 6206-2RS", nameEn: "SKF Deep Groove Ball Bearing 6206-2RS", nameRu: "SKF Deep Groove Ball Bearing 6206-2RS",
    brand: "SKF", oemNumber: "6206-2RS1",
    price: 45, stockStatus: "in_stock", isOEM: false,
    descriptionZh: "SKF深沟球轴承，双面橡胶密封，适用于发电机、水泵。", descriptionEn: "SKF deep groove ball bearing, double rubber seal, for alternator and water pump.",
    specs: { type: "Deep Groove Ball", innerDiameter: "30mm", outerDiameter: "62mm", width: "16mm", seal: "2RS (Double Rubber)", clearance: "C3", warranty: "12 months" },
    compatibleMachines: [
      { brand: "John Deere", model: "6120M", yearRange: "2017-2024" },
      { brand: "John Deere", model: "6155M", yearRange: "2017-2024" },
      { brand: "Massey Ferguson", model: "5713", yearRange: "2015-2022" },
    ],
  },
  {
    subSystemCode: "bearing_seal_system", componentGroupCode: "taper_roller_bearing",
    sku: "SD-TRACTOR-BRS-002",
    nameZh: "SKF 圆锥滚子轴承 32208", nameEn: "SKF Tapered Roller Bearing 32208", nameRu: "SKF Tapered Roller Bearing 32208",
    brand: "SKF", oemNumber: "32208 J2/Q",
    price: 120, stockStatus: "in_stock", isOEM: false,
    descriptionZh: "SKF圆锥滚子轴承，适用于变速箱和差速器。", descriptionEn: "SKF tapered roller bearing for gearbox and differential.",
    specs: { type: "Tapered Roller", innerDiameter: "40mm", outerDiameter: "80mm", width: "24.75mm", cone: "Single Row", clearance: "Normal", warranty: "12 months" },
    compatibleMachines: [
      { brand: "John Deere", model: "6120M", yearRange: "2017-2024" },
      { brand: "John Deere", model: "6155M", yearRange: "2017-2024" },
    ],
  },
  {
    subSystemCode: "bearing_seal_system", componentGroupCode: "thrust_bearing",
    sku: "SD-TRACTOR-BRS-003",
    nameZh: "NTN 推力轴承 51208", nameEn: "NTN Thrust Bearing 51208", nameRu: "NTN Thrust Bearing 51208",
    brand: "NTN", oemNumber: "51208",
    price: 85, stockStatus: "in_stock", isOEM: false,
    descriptionZh: "NTN推力球轴承，适用于离合器分离轴承和转向节。", descriptionEn: "NTN thrust ball bearing for clutch release bearing and steering knuckle.",
    specs: { type: "Thrust Ball", innerDiameter: "40mm", outerDiameter: "68mm", height: "19mm", material: "Bearing Steel SUJ2", cage: "Steel Plate", warranty: "12 months" },
    compatibleMachines: [
      { brand: "John Deere", model: "6120M", yearRange: "2017-2024" },
      { brand: "John Deere", model: "6155M", yearRange: "2017-2024" },
    ],
  },
  {
    subSystemCode: "bearing_seal_system", componentGroupCode: "oil_seal",
    sku: "SD-TRACTOR-BRS-004",
    nameZh: "SKF 油封 TC型 50x72x10", nameEn: "SKF Oil Seal TC Type 50x72x10", nameRu: "SKF Oil Seal TC Type 50x72x10",
    brand: "SKF", oemNumber: "50192",
    price: 28, stockStatus: "in_stock", isOEM: false,
    descriptionZh: "SKF TC型骨架油封，双唇带弹簧，适用于曲轴前油封。", descriptionEn: "SKF TC type radial shaft seal, double lip with spring, for crankshaft front seal.",
    specs: { type: "TC Radial Shaft Seal", innerDiameter: "50mm", outerDiameter: "72mm", width: "10mm", material: "NBR + Metal Case", temperature: "-30°C to 120°C", warranty: "12 months" },
    compatibleMachines: [
      { brand: "John Deere", model: "6120M", yearRange: "2017-2024" },
      { brand: "John Deere", model: "6155M", yearRange: "2017-2024" },
    ],
  },
  {
    subSystemCode: "bearing_seal_system", componentGroupCode: "oring_seal_kit",
    sku: "SD-TRACTOR-BRS-005",
    nameZh: "SKF O型圈密封套件 (混装)", nameEn: "SKF O-Ring Seal Kit (Assorted)", nameRu: "SKF O-Ring Seal Kit (Assorted)",
    brand: "SKF", oemNumber: "ORK-300-ASS",
    price: 180, stockStatus: "in_stock", isOEM: false,
    descriptionZh: "SKF O型圈混装套件，300件装，含18种常用规格。", descriptionEn: "SKF O-ring assorted kit, 300 pieces, 18 common sizes.",
    specs: { material: "NBR 70 Shore A", quantity: "300 pcs", sizes: "18 sizes (ID 3-50mm)", temperature: "-30°C to 110°C", storage: "Compartment Box", warranty: "12 months" },
    compatibleMachines: [
      { brand: "John Deere", model: "6120M", yearRange: "2017-2024" },
      { brand: "John Deere", model: "6155M", yearRange: "2017-2024" },
      { brand: "Massey Ferguson", model: "5713", yearRange: "2015-2022" },
    ],
  },
];

// ═══════════════════════════════════════════════════════
// 主函数
// ═══════════════════════════════════════════════════════

async function main() {
  console.log("🚀 Starting Parts V2 seed...\n");

  // 清空旧数据（幂等执行）
  console.log("⏳ Cleaning up old data...");
  await prisma.compatibleMachine.deleteMany();
  await prisma.part.deleteMany();
  await prisma.componentGroup.deleteMany();
  await prisma.subSystem.deleteMany();
  await prisma.machineType.deleteMany();
  console.log("✅ Old data cleaned.\n");

  // ── Layer 1: 创建14个整机品类 ──
  console.log("📦 Creating 14 MachineTypes...");
  const machineTypeMap: Record<string, string> = {};
  for (const mt of MACHINE_TYPES) {
    const created = await prisma.machineType.create({
      data: {
        code: mt.code,
        nameZh: mt.nameZh,
        nameEn: mt.nameEn,
        nameRu: mt.nameRu,
        nameEs: mt.nameEs,
        namePt: mt.namePt,
        nameAr: mt.nameAr,
        nameFr: mt.nameFr,
        nameHi: mt.nameHi,
        imageUrl: null,
        sortOrder: mt.sortOrder,
        isActive: true,
      },
    });
    machineTypeMap[mt.code] = created.id;
  }
  console.log(`✅ Created ${MACHINE_TYPES.length} MachineTypes.\n`);

  // ── Layer 2: 创建拖拉机9个子系统 ──
  const tractorId = machineTypeMap["tractor"];
  console.log("📦 Creating 9 SubSystems for Tractor...");
  const subSystemMap: Record<string, string> = {};
  for (const ss of TRACTOR_SUB_SYSTEMS) {
    const created = await prisma.subSystem.create({
      data: {
        code: ss.code,
        nameZh: ss.nameZh,
        nameEn: ss.nameEn,
        nameRu: ss.nameRu,
        nameEs: ss.nameEs,
        namePt: ss.namePt,
        nameAr: ss.nameAr,
        nameFr: ss.nameFr,
        nameHi: ss.nameHi,
        machineTypeId: tractorId,
        sortOrder: ss.sortOrder,
        isActive: true,
      },
    });
    subSystemMap[ss.code] = created.id;
  }
  console.log(`✅ Created ${TRACTOR_SUB_SYSTEMS.length} SubSystems.\n`);

  // ── Layer 3: 创建部件组 ──
  console.log("📦 Creating ComponentGroups...");
  const componentGroupMap: Record<string, string> = {}; // key: "subSystemCode:componentGroupCode"
  let totalComponentGroups = 0;
  for (const [subSystemCode, groups] of Object.entries(COMPONENT_GROUPS)) {
    const subSystemId = subSystemMap[subSystemCode];
    if (!subSystemId) {
      console.warn(`⚠️ SubSystem not found: ${subSystemCode}, skipping.`);
      continue;
    }
    for (const cg of groups) {
      const created = await prisma.componentGroup.create({
        data: {
          code: cg.code,
          nameZh: cg.nameZh,
          nameEn: cg.nameEn,
          nameRu: cg.nameEn,
          nameEs: cg.nameEn,
          namePt: cg.nameEn,
          nameAr: cg.nameEn,
          nameFr: cg.nameEn,
          nameHi: cg.nameEn,
          subSystemId: subSystemId,
          sortOrder: cg.sortOrder,
          isActive: true,
        },
      });
      componentGroupMap[`${subSystemCode}:${cg.code}`] = created.id;
      totalComponentGroups++;
    }
  }
  console.log(`✅ Created ${totalComponentGroups} ComponentGroups.\n`);

  // ── Layer 4: 创建配件 + 兼容机型 ──
  console.log("📦 Creating Parts with CompatibleMachines...");
  let totalParts = 0;
  let totalCompatible = 0;

  for (let i = 0; i < SEED_PARTS.length; i++) {
    const sp = SEED_PARTS[i];
    const cgKey = `${sp.subSystemCode}:${sp.componentGroupCode}`;
    const componentGroupId = componentGroupMap[cgKey];
    if (!componentGroupId) {
      console.warn(`⚠️ ComponentGroup not found: ${cgKey}, skipping part ${sp.sku}`);
      continue;
    }

    // 根据索引分配库存状态（确保分布合理）
    const stockStatus = sp.stockStatus;

    const part = await prisma.part.create({
      data: {
        sku: sp.sku,
        nameZh: sp.nameZh,
        nameEn: sp.nameEn,
        nameRu: sp.nameRu,
        nameEs: sp.nameEn,
        brand: sp.brand,
        oemNumber: sp.oemNumber,
        componentGroupId: componentGroupId,
        price: sp.price,
        currency: "CNY",
        stockStatus: stockStatus,
        images: [],
        descriptionZh: sp.descriptionZh,
        descriptionEn: sp.descriptionEn,
        descriptionRu: sp.descriptionEn,
        specs: sp.specs,
        isActive: true,
        isOEM: sp.isOEM,
        isAftermarket: !sp.isOEM,
        dataSource: "manual",
        dataQuality: "verified",
      },
    });

    // 创建兼容机型
    for (const cm of sp.compatibleMachines) {
      await prisma.compatibleMachine.create({
        data: {
          partId: part.id,
          brand: cm.brand,
          model: cm.model,
          yearRange: cm.yearRange,
        },
      });
      totalCompatible++;
    }

    totalParts++;
  }

  console.log(`✅ Created ${totalParts} Parts with ${totalCompatible} CompatibleMachines.\n`);

  // ── 统计 ──
  const counts = {
    machineTypes: await prisma.machineType.count(),
    subSystems: await prisma.subSystem.count(),
    componentGroups: await prisma.componentGroup.count(),
    parts: await prisma.part.count(),
    compatibleMachines: await prisma.compatibleMachine.count(),
  };

  console.log("════════════════════════════════════");
  console.log("📊 Seed Summary:");
  console.log(`   MachineTypes:       ${counts.machineTypes}`);
  console.log(`   SubSystems:         ${counts.subSystems}`);
  console.log(`   ComponentGroups:    ${counts.componentGroups}`);
  console.log(`   Parts:              ${counts.parts}`);
  console.log(`   CompatibleMachines: ${counts.compatibleMachines}`);
  console.log("════════════════════════════════════");
  console.log("\n🎉 Parts V2 seed completed!");
}

main()
  .catch((e) => {
    console.error("❌ Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
