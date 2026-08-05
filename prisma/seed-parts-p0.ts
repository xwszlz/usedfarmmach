/**
 * P0批次配件种子数据脚本
 *
 * 为4个品类新增配件数据：
 *   1. 联合收割机 (combine_harvester) — 8子系统, ~45配件
 *   2. 青储机 (forage_harvester) — 8子系统, ~40配件
 *   3. 打捆机 (baler) — 7子系统, ~32配件
 *   4. 牧草设备 (forage_equipment) — 6子系统, ~23配件
 *
 * 幂等执行：使用 upsert，重复运行不报错，不删除已有数据
 * MachineType 已存在（14个品类已在 seed-parts-v2.ts 中创建）
 *
 * 运行命令：npx tsx prisma/seed-parts-p0.ts
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// ═══════════════════════════════════════════════════════
// 类型定义
// ═══════════════════════════════════════════════════════

interface P0SubSystem {
  machineTypeCode: string;
  code: string;
  nameZh: string;
  nameEn: string;
  nameRu: string;
  nameEs: string;
  namePt: string;
  nameAr: string;
  nameFr: string;
  nameHi: string;
  sortOrder: number;
}

interface P0ComponentGroup {
  machineTypeCode: string;
  subSystemCode: string;
  code: string;
  nameZh: string;
  nameEn: string;
  sortOrder: number;
}

interface P0Part {
  machineTypeCode: string;
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

// ═══════════════════════════════════════════════════════
// P0 子系统数据 (29个)
// ═══════════════════════════════════════════════════════

const P0_SUB_SYSTEMS: P0SubSystem[] = [
  // ── 联合收割机 (combine_harvester) — 8子系统 ──
  { machineTypeCode: "combine_harvester", code: "header_system", nameZh: "割台系统", nameEn: "Header System", nameRu: "Система жатки", nameEs: "Sistema de cabezal", namePt: "Sistema de cabeçalho", nameAr: "نظام رأس الحصاد", nameFr: "Système de barre de coupe", nameHi: "हेडर सिस्टम", sortOrder: 1 },
  { machineTypeCode: "combine_harvester", code: "threshing_system", nameZh: "脱粒系统", nameEn: "Threshing System", nameRu: "Система обмолота", nameEs: "Sistema de trilla", namePt: "Sistema de trilha", nameAr: "نظام الدراسة", nameFr: "Système de battage", nameHi: "थ्रेशिंग सिस्टम", sortOrder: 2 },
  { machineTypeCode: "combine_harvester", code: "cleaning_system", nameZh: "清选系统", nameEn: "Cleaning System", nameRu: "Система очистки", nameEs: "Sistema de limpieza", namePt: "Sistema de limpeza", nameAr: "نظام التنظيف", nameFr: "Système de nettoyage", nameHi: "क्लीनिंग सिस्टम", sortOrder: 3 },
  { machineTypeCode: "combine_harvester", code: "grain_handling", nameZh: "输粮系统", nameEn: "Grain Handling System", nameRu: "Система транспортировки зерна", nameEs: "Sistema de transporte de grano", namePt: "Sistema de transporte de grãos", nameAr: "نظام نقل الحبوب", nameFr: "Système de manutention du grain", nameHi: "ग्रेन हैंडलिंग सिस्टम", sortOrder: 4 },
  { machineTypeCode: "combine_harvester", code: "powertrain", nameZh: "动力系统", nameEn: "Powertrain System", nameRu: "Силовая система", nameEs: "Sistema de potencia", namePt: "Sistema de potência", nameAr: "نظام القوة", nameFr: "Système moteur", nameHi: "पावरट्रेन सिस्टम", sortOrder: 5 },
  { machineTypeCode: "combine_harvester", code: "transmission", nameZh: "传动系统", nameEn: "Transmission System", nameRu: "Трансмиссия", nameEs: "Sistema de transmisión", namePt: "Sistema de transmissão", nameAr: "نظام النقل", nameFr: "Système de transmission", nameHi: "ट्रांसमिशन सिस्टम", sortOrder: 6 },
  { machineTypeCode: "combine_harvester", code: "chassis", nameZh: "行走系统", nameEn: "Chassis & Running Gear", nameRu: "Ходовая часть", nameEs: "Chasis y tren de rodaje", namePt: "Chassi e rodagem", nameAr: "الهيكل ونظام الجري", nameFr: "Châssis et train de roulement", nameHi: "चेसिस और रनिंग गियर", sortOrder: 7 },
  { machineTypeCode: "combine_harvester", code: "electrical", nameZh: "电气系统", nameEn: "Electrical System", nameRu: "Электрическая система", nameEs: "Sistema eléctrico", namePt: "Sistema elétrico", nameAr: "النظام الكهربائي", nameFr: "Système électrique", nameHi: "विद्युत प्रणाली", sortOrder: 8 },

  // ── 青储机 (forage_harvester) — 8子系统 ──
  { machineTypeCode: "forage_harvester", code: "cutting_feeding", nameZh: "切割喂入系统", nameEn: "Cutting & Feeding System", nameRu: "Система резки и подачи", nameEs: "Sistema de corte y alimentación", namePt: "Sistema de corte e alimentação", nameAr: "نظام القطع والتغذية", nameFr: "Système de coupe et d'alimentation", nameHi: "कटिंग और फीडिंग सिस्टम", sortOrder: 1 },
  { machineTypeCode: "forage_harvester", code: "chopping", nameZh: "切碎系统", nameEn: "Chopping System", nameRu: "Система измельчения", nameEs: "Sistema de picado", namePt: "Sistema de picagem", nameAr: "نظام التقطيع", nameFr: "Système de hachage", nameHi: "चॉपिंग सिस्टम", sortOrder: 2 },
  { machineTypeCode: "forage_harvester", code: "blower", nameZh: "抛送系统", nameEn: "Blower & Discharge System", nameRu: "Система выгрузки", nameEs: "Sistema de soplado y descarga", namePt: "Sistema de sopro e descarga", nameAr: "نظام النفخ والتفريغ", nameFr: "Système de soufflage et décharge", nameHi: "ब्लोअर और डिस्चार्ज सिस्टम", sortOrder: 3 },
  { machineTypeCode: "forage_harvester", code: "powertrain", nameZh: "动力系统", nameEn: "Powertrain System", nameRu: "Силовая система", nameEs: "Sistema de potencia", namePt: "Sistema de potência", nameAr: "نظام القوة", nameFr: "Système moteur", nameHi: "पावरट्रेन सिस्टम", sortOrder: 4 },
  { machineTypeCode: "forage_harvester", code: "transmission", nameZh: "传动系统", nameEn: "Transmission System", nameRu: "Трансмиссия", nameEs: "Sistema de transmisión", namePt: "Sistema de transmissão", nameAr: "نظام النقل", nameFr: "Système de transmission", nameHi: "ट्रांसमिशन सिस्टम", sortOrder: 5 },
  { machineTypeCode: "forage_harvester", code: "hydraulic", nameZh: "液压系统", nameEn: "Hydraulic System", nameRu: "Гидравлическая система", nameEs: "Sistema hidráulico", namePt: "Sistema hidráulico", nameAr: "النظام الهيدروليكي", nameFr: "Système hydraulique", nameHi: "हाइड्रोलिक सिस्टम", sortOrder: 6 },
  { machineTypeCode: "forage_harvester", code: "chassis", nameZh: "行走系统", nameEn: "Chassis & Running Gear", nameRu: "Ходовая часть", nameEs: "Chasis y tren de rodaje", namePt: "Chassi e rodagem", nameAr: "الهيكل ونظام الجري", nameFr: "Châssis et train de roulement", nameHi: "चेसिस और रनिंग गियर", sortOrder: 7 },
  { machineTypeCode: "forage_harvester", code: "electrical", nameZh: "电气系统", nameEn: "Electrical System", nameRu: "Электрическая система", nameEs: "Sistema eléctrico", namePt: "Sistema elétrico", nameAr: "النظام الكهربائي", nameFr: "Système électrique", nameHi: "विद्युत प्रणाली", sortOrder: 8 },

  // ── 打捆机 (baler) — 7子系统 ──
  { machineTypeCode: "baler", code: "pickup_system", nameZh: "捡拾系统", nameEn: "Pickup System", nameRu: "Система подбора", nameEs: "Sistema de recolección", namePt: "Sistema de recolhimento", nameAr: "نظام الالتقاط", nameFr: "Système de ramassage", nameHi: "पिकअप सिस्टम", sortOrder: 1 },
  { machineTypeCode: "baler", code: "bale_chamber", nameZh: "成形系统", nameEn: "Bale Chamber", nameRu: "Камера прессования", nameEs: "Cámara de formado", namePt: "Câmara de fardagem", nameAr: "غرفة التشكيل", nameFr: "Chambre de pressage", nameHi: "बेल चैंबर", sortOrder: 2 },
  { machineTypeCode: "baler", code: "knotting_system", nameZh: "打结系统", nameEn: "Knotting System", nameRu: "Система вязания", nameEs: "Sistema de atado", namePt: "Sistema de amarração", nameAr: "نظام الربط", nameFr: "Système de nouage", nameHi: "नॉटिंग सिस्टम", sortOrder: 3 },
  { machineTypeCode: "baler", code: "transmission", nameZh: "传动系统", nameEn: "Transmission System", nameRu: "Трансмиссия", nameEs: "Sistema de transmisión", namePt: "Sistema de transmissão", nameAr: "نظام النقل", nameFr: "Système de transmission", nameHi: "ट्रांसमिशन सिस्टम", sortOrder: 4 },
  { machineTypeCode: "baler", code: "hydraulic", nameZh: "液压系统", nameEn: "Hydraulic System", nameRu: "Гидравлическая система", nameEs: "Sistema hidráulico", namePt: "Sistema hidráulico", nameAr: "النظام الهيدروليكي", nameFr: "Système hydraulique", nameHi: "हाइड्रोलिक सिस्टम", sortOrder: 5 },
  { machineTypeCode: "baler", code: "electrical", nameZh: "电气系统", nameEn: "Electrical System", nameRu: "Электрическая система", nameEs: "Sistema eléctrico", namePt: "Sistema elétrico", nameAr: "النظام الكهربائي", nameFr: "Système électrique", nameHi: "विद्युत प्रणाली", sortOrder: 6 },
  { machineTypeCode: "baler", code: "chassis", nameZh: "行走系统", nameEn: "Chassis & Running Gear", nameRu: "Ходовая часть", nameEs: "Chasis y tren de rodaje", namePt: "Chassi e rodagem", nameAr: "الهيكل ونظام الجري", nameFr: "Châssis et train de roulement", nameHi: "चेसिस और रनिंग गियर", sortOrder: 7 },

  // ── 牧草设备 (forage_equipment) — 6子系统 ──
  { machineTypeCode: "forage_equipment", code: "cutting_system", nameZh: "切割系统", nameEn: "Cutting System", nameRu: "Система резки", nameEs: "Sistema de corte", namePt: "Sistema de corte", nameAr: "نظام القطع", nameFr: "Système de coupe", nameHi: "कटिंग सिस्टम", sortOrder: 1 },
  { machineTypeCode: "forage_equipment", code: "raking_system", nameZh: "搂草系统", nameEn: "Raking System", nameRu: "Система сгребания", nameEs: "Sistema de rastrillado", namePt: "Sistema de enrastelamento", nameAr: "نظام الكناسة", nameFr: "Système de ratissage", nameHi: "रेकिंग सिस्टम", sortOrder: 2 },
  { machineTypeCode: "forage_equipment", code: "transmission", nameZh: "传动系统", nameEn: "Transmission System", nameRu: "Трансмиссия", nameEs: "Sistema de transmisión", namePt: "Sistema de transmissão", nameAr: "نظام النقل", nameFr: "Système de transmission", nameHi: "ट्रांसमिशन सिस्टम", sortOrder: 3 },
  { machineTypeCode: "forage_equipment", code: "hydraulic", nameZh: "液压系统", nameEn: "Hydraulic System", nameRu: "Гидравлическая система", nameEs: "Sistema hidráulico", namePt: "Sistema hidráulico", nameAr: "النظام الهидروليكي", nameFr: "Système hydraulique", nameHi: "हाइड्रोलिक सिस्टम", sortOrder: 4 },
  { machineTypeCode: "forage_equipment", code: "chassis", nameZh: "行走系统", nameEn: "Chassis & Running Gear", nameRu: "Ходовая часть", nameEs: "Chasis y tren de rodaje", namePt: "Chassi e rodagem", nameAr: "الهيكل ونظام الجري", nameFr: "Châssis et train de roulement", nameHi: "चेसिस और रनिंग गियर", sortOrder: 5 },
  { machineTypeCode: "forage_equipment", code: "frame_structure", nameZh: "框架系统", nameEn: "Frame Structure", nameRu: "Рамная конструкция", nameEs: "Estructura del bastidor", namePt: "Estrutura do chassi", nameAr: "هيكل الإطار", nameFr: "Structure du châssis", nameHi: "फ्रेम स्ट्रक्चर", sortOrder: 6 },
];

// ═══════════════════════════════════════════════════════
// P0 部件组数据 (147个)
// ═══════════════════════════════════════════════════════

const P0_COMPONENT_GROUPS: P0ComponentGroup[] = [
  // ── 联合收割机：割台系统 (header_system) — 8个 ──
  { machineTypeCode: "combine_harvester", subSystemCode: "header_system", code: "cutter_bar", nameZh: "切割器", nameEn: "Cutter Bar", sortOrder: 1 },
  { machineTypeCode: "combine_harvester", subSystemCode: "header_system", code: "reel", nameZh: "拨禾轮", nameEn: "Reel", sortOrder: 2 },
  { machineTypeCode: "combine_harvester", subSystemCode: "header_system", code: "auger", nameZh: "螺旋推运器", nameEn: "Auger", sortOrder: 3 },
  { machineTypeCode: "combine_harvester", subSystemCode: "header_system", code: "header_drive", nameZh: "割台传动", nameEn: "Header Drive", sortOrder: 4 },
  { machineTypeCode: "combine_harvester", subSystemCode: "header_system", code: "header_frame", nameZh: "割台机架", nameEn: "Header Frame", sortOrder: 5 },
  { machineTypeCode: "combine_harvester", subSystemCode: "header_system", code: "divider", nameZh: "分禾器", nameEn: "Divider", sortOrder: 6 },
  { machineTypeCode: "combine_harvester", subSystemCode: "header_system", code: "skid_plate", nameZh: "滑板", nameEn: "Skid Plate", sortOrder: 7 },
  { machineTypeCode: "combine_harvester", subSystemCode: "header_system", code: "hydraulic_lift", nameZh: "液压升降", nameEn: "Hydraulic Lift", sortOrder: 8 },

  // ── 联合收割机：脱粒系统 (threshing_system) — 7个 ──
  { machineTypeCode: "combine_harvester", subSystemCode: "threshing_system", code: "threshing_cylinder", nameZh: "脱粒滚筒", nameEn: "Threshing Cylinder", sortOrder: 1 },
  { machineTypeCode: "combine_harvester", subSystemCode: "threshing_system", code: "concave", nameZh: "凹板筛", nameEn: "Concave", sortOrder: 2 },
  { machineTypeCode: "combine_harvester", subSystemCode: "threshing_system", code: "rasp_bar", nameZh: "纹杆", nameEn: "Rasp Bar", sortOrder: 3 },
  { machineTypeCode: "combine_harvester", subSystemCode: "threshing_system", code: "rotor", nameZh: "脱粒转子", nameEn: "Rotor", sortOrder: 4 },
  { machineTypeCode: "combine_harvester", subSystemCode: "threshing_system", code: "straw_walker", nameZh: "逐稿器", nameEn: "Straw Walker", sortOrder: 5 },
  { machineTypeCode: "combine_harvester", subSystemCode: "threshing_system", code: "cleaning_shoe", nameZh: "清选筛", nameEn: "Cleaning Shoe", sortOrder: 6 },
  { machineTypeCode: "combine_harvester", subSystemCode: "threshing_system", code: "cylinder_bearing", nameZh: "滚筒轴承", nameEn: "Cylinder Bearing", sortOrder: 7 },

  // ── 联合收割机：清选系统 (cleaning_system) — 6个 ──
  { machineTypeCode: "combine_harvester", subSystemCode: "cleaning_system", code: "upper_sieve", nameZh: "上筛", nameEn: "Upper Sieve", sortOrder: 1 },
  { machineTypeCode: "combine_harvester", subSystemCode: "cleaning_system", code: "lower_sieve", nameZh: "下筛", nameEn: "Lower Sieve", sortOrder: 2 },
  { machineTypeCode: "combine_harvester", subSystemCode: "cleaning_system", code: "fan", nameZh: "清选风扇", nameEn: "Cleaning Fan", sortOrder: 3 },
  { machineTypeCode: "combine_harvester", subSystemCode: "cleaning_system", code: "sieve_drive", nameZh: "筛箱驱动", nameEn: "Sieve Drive", sortOrder: 4 },
  { machineTypeCode: "combine_harvester", subSystemCode: "cleaning_system", code: "fan_bearing", nameZh: "风扇轴承", nameEn: "Fan Bearing", sortOrder: 5 },
  { machineTypeCode: "combine_harvester", subSystemCode: "cleaning_system", code: "adjusting_mechanism", nameZh: "调节机构", nameEn: "Adjusting Mechanism", sortOrder: 6 },

  // ── 联合收割机：输粮系统 (grain_handling) — 5个 ──
  { machineTypeCode: "combine_harvester", subSystemCode: "grain_handling", code: "elevator_chain", nameZh: "升运器链条", nameEn: "Elevator Chain", sortOrder: 1 },
  { machineTypeCode: "combine_harvester", subSystemCode: "grain_handling", code: "grain_tank", nameZh: "粮仓", nameEn: "Grain Tank", sortOrder: 2 },
  { machineTypeCode: "combine_harvester", subSystemCode: "grain_handling", code: "unloading_auger", nameZh: "卸粮搅龙", nameEn: "Unloading Auger", sortOrder: 3 },
  { machineTypeCode: "combine_harvester", subSystemCode: "grain_handling", code: "grain_spreader", nameZh: "谷物抛撒器", nameEn: "Grain Spreader", sortOrder: 4 },
  { machineTypeCode: "combine_harvester", subSystemCode: "grain_handling", code: "unloading_valve", nameZh: "卸粮阀", nameEn: "Unloading Valve", sortOrder: 5 },

  // ── 联合收割机：动力系统 (powertrain) — 9个 ──
  { machineTypeCode: "combine_harvester", subSystemCode: "powertrain", code: "engine_assembly", nameZh: "发动机总成", nameEn: "Engine Assembly", sortOrder: 1 },
  { machineTypeCode: "combine_harvester", subSystemCode: "powertrain", code: "turbocharger", nameZh: "涡轮增压器", nameEn: "Turbocharger", sortOrder: 2 },
  { machineTypeCode: "combine_harvester", subSystemCode: "powertrain", code: "fuel_pump", nameZh: "高压油泵", nameEn: "Fuel Pump", sortOrder: 3 },
  { machineTypeCode: "combine_harvester", subSystemCode: "powertrain", code: "injector", nameZh: "喷油器", nameEn: "Injector", sortOrder: 4 },
  { machineTypeCode: "combine_harvester", subSystemCode: "powertrain", code: "water_pump", nameZh: "水泵", nameEn: "Water Pump", sortOrder: 5 },
  { machineTypeCode: "combine_harvester", subSystemCode: "powertrain", code: "oil_filter", nameZh: "机油滤芯", nameEn: "Oil Filter", sortOrder: 6 },
  { machineTypeCode: "combine_harvester", subSystemCode: "powertrain", code: "air_filter", nameZh: "空气滤芯", nameEn: "Air Filter", sortOrder: 7 },
  { machineTypeCode: "combine_harvester", subSystemCode: "powertrain", code: "cooling_radiator", nameZh: "冷却散热器", nameEn: "Cooling Radiator", sortOrder: 8 },
  { machineTypeCode: "combine_harvester", subSystemCode: "powertrain", code: "fuel_filter", nameZh: "燃油滤芯", nameEn: "Fuel Filter", sortOrder: 9 },

  // ── 联合收割机：传动系统 (transmission) — 6个 ──
  { machineTypeCode: "combine_harvester", subSystemCode: "transmission", code: "hydrostatic_pump", nameZh: "静液压泵", nameEn: "Hydrostatic Pump", sortOrder: 1 },
  { machineTypeCode: "combine_harvester", subSystemCode: "transmission", code: "hydraulic_motor", nameZh: "液压马达", nameEn: "Hydraulic Motor", sortOrder: 2 },
  { machineTypeCode: "combine_harvester", subSystemCode: "transmission", code: "gearbox", nameZh: "齿轮箱", nameEn: "Gearbox", sortOrder: 3 },
  { machineTypeCode: "combine_harvester", subSystemCode: "transmission", code: "universal_joint", nameZh: "万向节", nameEn: "Universal Joint", sortOrder: 4 },
  { machineTypeCode: "combine_harvester", subSystemCode: "transmission", code: "drive_chain", nameZh: "传动链条", nameEn: "Drive Chain", sortOrder: 5 },
  { machineTypeCode: "combine_harvester", subSystemCode: "transmission", code: "drive_belt", nameZh: "传动带", nameEn: "Drive Belt", sortOrder: 6 },

  // ── 联合收割机：行走系统 (chassis) — 5个 ──
  { machineTypeCode: "combine_harvester", subSystemCode: "chassis", code: "front_axle", nameZh: "前驱动桥", nameEn: "Front Axle", sortOrder: 1 },
  { machineTypeCode: "combine_harvester", subSystemCode: "chassis", code: "rear_axle", nameZh: "后转向桥", nameEn: "Rear Axle", sortOrder: 2 },
  { machineTypeCode: "combine_harvester", subSystemCode: "chassis", code: "drive_tire", nameZh: "驱动轮胎", nameEn: "Drive Tire", sortOrder: 3 },
  { machineTypeCode: "combine_harvester", subSystemCode: "chassis", code: "steer_tire", nameZh: "转向轮胎", nameEn: "Steer Tire", sortOrder: 4 },
  { machineTypeCode: "combine_harvester", subSystemCode: "chassis", code: "brake_system", nameZh: "制动系统", nameEn: "Brake System", sortOrder: 5 },

  // ── 联合收割机：电气系统 (electrical) — 5个 ──
  { machineTypeCode: "combine_harvester", subSystemCode: "electrical", code: "alternator", nameZh: "发电机", nameEn: "Alternator", sortOrder: 1 },
  { machineTypeCode: "combine_harvester", subSystemCode: "electrical", code: "starter", nameZh: "起动机", nameEn: "Starter", sortOrder: 2 },
  { machineTypeCode: "combine_harvester", subSystemCode: "electrical", code: "ecu_controller", nameZh: "ECU控制器", nameEn: "ECU Controller", sortOrder: 3 },
  { machineTypeCode: "combine_harvester", subSystemCode: "electrical", code: "instrument_display", nameZh: "仪表显示屏", nameEn: "Instrument Display", sortOrder: 4 },
  { machineTypeCode: "combine_harvester", subSystemCode: "electrical", code: "work_light", nameZh: "工作灯", nameEn: "Work Light", sortOrder: 5 },

  // ── 青储机：切割喂入系统 (cutting_feeding) — 6个 ──
  { machineTypeCode: "forage_harvester", subSystemCode: "cutting_feeding", code: "feed_roll", nameZh: "喂入辊", nameEn: "Feed Roll", sortOrder: 1 },
  { machineTypeCode: "forage_harvester", subSystemCode: "cutting_feeding", code: "cutting_knife", nameZh: "切割刀片", nameEn: "Cutting Knife", sortOrder: 2 },
  { machineTypeCode: "forage_harvester", subSystemCode: "cutting_feeding", code: "feed_chain", nameZh: "喂入链条", nameEn: "Feed Chain", sortOrder: 3 },
  { machineTypeCode: "forage_harvester", subSystemCode: "cutting_feeding", code: "feed_bearing", nameZh: "喂入轴承", nameEn: "Feed Bearing", sortOrder: 4 },
  { machineTypeCode: "forage_harvester", subSystemCode: "cutting_feeding", code: "metal_detector", nameZh: "金属探测器", nameEn: "Metal Detector", sortOrder: 5 },
  { machineTypeCode: "forage_harvester", subSystemCode: "cutting_feeding", code: "feed_gearbox", nameZh: "喂入齿轮箱", nameEn: "Feed Gearbox", sortOrder: 6 },

  // ── 青储机：切碎系统 (chopping) — 5个 ──
  { machineTypeCode: "forage_harvester", subSystemCode: "chopping", code: "chop_drum", nameZh: "切碎滚筒", nameEn: "Chopping Drum", sortOrder: 1 },
  { machineTypeCode: "forage_harvester", subSystemCode: "chopping", code: "chop_knife", nameZh: "切碎刀片", nameEn: "Chopping Knife", sortOrder: 2 },
  { machineTypeCode: "forage_harvester", subSystemCode: "chopping", code: "counter_knife", nameZh: "定刀", nameEn: "Counter Knife", sortOrder: 3 },
  { machineTypeCode: "forage_harvester", subSystemCode: "chopping", code: "drum_bearing", nameZh: "滚筒轴承", nameEn: "Drum Bearing", sortOrder: 4 },
  { machineTypeCode: "forage_harvester", subSystemCode: "chopping", code: "knife_grinder", nameZh: "磨刀器", nameEn: "Knife Grinder", sortOrder: 5 },

  // ── 青储机：抛送系统 (blower) — 4个 ──
  { machineTypeCode: "forage_harvester", subSystemCode: "blower", code: "blower_fan", nameZh: "抛送风机", nameEn: "Blower Fan", sortOrder: 1 },
  { machineTypeCode: "forage_harvester", subSystemCode: "blower", code: "deflector_valve", nameZh: "转向阀", nameEn: "Deflector Valve", sortOrder: 2 },
  { machineTypeCode: "forage_harvester", subSystemCode: "blower", code: "fan_bearing", nameZh: "风机轴承", nameEn: "Fan Bearing", sortOrder: 3 },
  { machineTypeCode: "forage_harvester", subSystemCode: "blower", code: "discharge_liner", nameZh: "抛送筒衬板", nameEn: "Discharge Liner", sortOrder: 4 },

  // ── 青储机：动力系统 (powertrain) — 7个 ──
  { machineTypeCode: "forage_harvester", subSystemCode: "powertrain", code: "engine_assembly", nameZh: "发动机总成", nameEn: "Engine Assembly", sortOrder: 1 },
  { machineTypeCode: "forage_harvester", subSystemCode: "powertrain", code: "turbocharger", nameZh: "涡轮增压器", nameEn: "Turbocharger", sortOrder: 2 },
  { machineTypeCode: "forage_harvester", subSystemCode: "powertrain", code: "fuel_pump", nameZh: "高压共轨泵", nameEn: "Fuel Pump", sortOrder: 3 },
  { machineTypeCode: "forage_harvester", subSystemCode: "powertrain", code: "injector", nameZh: "喷油器", nameEn: "Injector", sortOrder: 4 },
  { machineTypeCode: "forage_harvester", subSystemCode: "powertrain", code: "oil_filter", nameZh: "机油滤芯", nameEn: "Oil Filter", sortOrder: 5 },
  { machineTypeCode: "forage_harvester", subSystemCode: "powertrain", code: "air_filter", nameZh: "空气滤芯", nameEn: "Air Filter", sortOrder: 6 },
  { machineTypeCode: "forage_harvester", subSystemCode: "powertrain", code: "cooling_system", nameZh: "冷却系统", nameEn: "Cooling System", sortOrder: 7 },

  // ── 青储机：传动系统 (transmission) — 5个 ──
  { machineTypeCode: "forage_harvester", subSystemCode: "transmission", code: "hydrostatic_pump", nameZh: "静液压泵", nameEn: "Hydrostatic Pump", sortOrder: 1 },
  { machineTypeCode: "forage_harvester", subSystemCode: "transmission", code: "hydraulic_motor", nameZh: "液压马达", nameEn: "Hydraulic Motor", sortOrder: 2 },
  { machineTypeCode: "forage_harvester", subSystemCode: "transmission", code: "drive_belt", nameZh: "传动带", nameEn: "Drive Belt", sortOrder: 3 },
  { machineTypeCode: "forage_harvester", subSystemCode: "transmission", code: "universal_joint", nameZh: "万向节", nameEn: "Universal Joint", sortOrder: 4 },
  { machineTypeCode: "forage_harvester", subSystemCode: "transmission", code: "gearbox", nameZh: "齿轮箱", nameEn: "Gearbox", sortOrder: 5 },

  // ── 青储机：液压系统 (hydraulic) — 5个 ──
  { machineTypeCode: "forage_harvester", subSystemCode: "hydraulic", code: "hydraulic_pump", nameZh: "液压主泵", nameEn: "Hydraulic Pump", sortOrder: 1 },
  { machineTypeCode: "forage_harvester", subSystemCode: "hydraulic", code: "hydraulic_cylinder", nameZh: "液压油缸", nameEn: "Hydraulic Cylinder", sortOrder: 2 },
  { machineTypeCode: "forage_harvester", subSystemCode: "hydraulic", code: "hydraulic_valve", nameZh: "液压多路阀", nameEn: "Hydraulic Valve", sortOrder: 3 },
  { machineTypeCode: "forage_harvester", subSystemCode: "hydraulic", code: "return_filter", nameZh: "回油滤芯", nameEn: "Return Filter", sortOrder: 4 },
  { machineTypeCode: "forage_harvester", subSystemCode: "hydraulic", code: "seal_kit", nameZh: "密封套件", nameEn: "Seal Kit", sortOrder: 5 },

  // ── 青储机：行走系统 (chassis) — 5个 ──
  { machineTypeCode: "forage_harvester", subSystemCode: "chassis", code: "front_axle", nameZh: "前驱动桥", nameEn: "Front Axle", sortOrder: 1 },
  { machineTypeCode: "forage_harvester", subSystemCode: "chassis", code: "rear_axle", nameZh: "后转向桥", nameEn: "Rear Axle", sortOrder: 2 },
  { machineTypeCode: "forage_harvester", subSystemCode: "chassis", code: "drive_tire", nameZh: "驱动轮胎", nameEn: "Drive Tire", sortOrder: 3 },
  { machineTypeCode: "forage_harvester", subSystemCode: "chassis", code: "steer_tire", nameZh: "转向轮胎", nameEn: "Steer Tire", sortOrder: 4 },
  { machineTypeCode: "forage_harvester", subSystemCode: "chassis", code: "brake_system", nameZh: "制动系统", nameEn: "Brake System", sortOrder: 5 },

  // ── 青储机：电气系统 (electrical) — 4个 ──
  { machineTypeCode: "forage_harvester", subSystemCode: "electrical", code: "alternator", nameZh: "发电机", nameEn: "Alternator", sortOrder: 1 },
  { machineTypeCode: "forage_harvester", subSystemCode: "electrical", code: "starter", nameZh: "起动机", nameEn: "Starter", sortOrder: 2 },
  { machineTypeCode: "forage_harvester", subSystemCode: "electrical", code: "ecu_controller", nameZh: "ECU控制器", nameEn: "ECU Controller", sortOrder: 3 },
  { machineTypeCode: "forage_harvester", subSystemCode: "electrical", code: "battery", nameZh: "蓄电池", nameEn: "Battery", sortOrder: 4 },

  // ── 打捆机：捡拾系统 (pickup_system) — 5个 ──
  { machineTypeCode: "baler", subSystemCode: "pickup_system", code: "pickup_tine", nameZh: "捡拾弹齿", nameEn: "Pickup Tine", sortOrder: 1 },
  { machineTypeCode: "baler", subSystemCode: "pickup_system", code: "pickup_reel", nameZh: "捡拾滚筒", nameEn: "Pickup Reel", sortOrder: 2 },
  { machineTypeCode: "baler", subSystemCode: "pickup_system", code: "pickup_belt", nameZh: "捡拾传动带", nameEn: "Pickup Belt", sortOrder: 3 },
  { machineTypeCode: "baler", subSystemCode: "pickup_system", code: "tine_bar", nameZh: "弹齿固定板", nameEn: "Tine Bar", sortOrder: 4 },
  { machineTypeCode: "baler", subSystemCode: "pickup_system", code: "pickup_bearing", nameZh: "捡拾轴承", nameEn: "Pickup Bearing", sortOrder: 5 },

  // ── 打捆机：成形系统 (bale_chamber) — 6个 ──
  { machineTypeCode: "baler", subSystemCode: "bale_chamber", code: "chamber_chain", nameZh: "成形链条", nameEn: "Chamber Chain", sortOrder: 1 },
  { machineTypeCode: "baler", subSystemCode: "bale_chamber", code: "chamber_side_plate", nameZh: "成形侧板", nameEn: "Chamber Side Plate", sortOrder: 2 },
  { machineTypeCode: "baler", subSystemCode: "bale_chamber", code: "density_cylinder", nameZh: "密度调节油缸", nameEn: "Density Cylinder", sortOrder: 3 },
  { machineTypeCode: "baler", subSystemCode: "bale_chamber", code: "chamber_roller", nameZh: "成形滚筒", nameEn: "Chamber Roller", sortOrder: 4 },
  { machineTypeCode: "baler", subSystemCode: "bale_chamber", code: "chain_tensioner", nameZh: "链条张紧器", nameEn: "Chain Tensioner", sortOrder: 5 },
  { machineTypeCode: "baler", subSystemCode: "bale_chamber", code: "roller_bearing", nameZh: "滚筒轴承", nameEn: "Roller Bearing", sortOrder: 6 },

  // ── 打捆机：打结系统 (knotting_system) — 5个 ──
  { machineTypeCode: "baler", subSystemCode: "knotting_system", code: "knotter_assembly", nameZh: "打结器总成", nameEn: "Knotter Assembly", sortOrder: 1 },
  { machineTypeCode: "baler", subSystemCode: "knotting_system", code: "bill_hook", nameZh: "夹绳器", nameEn: "Bill Hook", sortOrder: 2 },
  { machineTypeCode: "baler", subSystemCode: "knotting_system", code: "knotter_gear", nameZh: "打结器齿轮", nameEn: "Knotter Gear", sortOrder: 3 },
  { machineTypeCode: "baler", subSystemCode: "knotting_system", code: "knotter_bearing", nameZh: "打结器轴承", nameEn: "Knotter Bearing", sortOrder: 4 },
  { machineTypeCode: "baler", subSystemCode: "knotting_system", code: "knife_blade", nameZh: "切断刀片", nameEn: "Knife Blade", sortOrder: 5 },

  // ── 打捆机：传动系统 (transmission) — 5个 ──
  { machineTypeCode: "baler", subSystemCode: "transmission", code: "drive_chain", nameZh: "传动链条", nameEn: "Drive Chain", sortOrder: 1 },
  { machineTypeCode: "baler", subSystemCode: "transmission", code: "gearbox", nameZh: "齿轮箱", nameEn: "Gearbox", sortOrder: 2 },
  { machineTypeCode: "baler", subSystemCode: "transmission", code: "universal_joint", nameZh: "万向节", nameEn: "Universal Joint", sortOrder: 3 },
  { machineTypeCode: "baler", subSystemCode: "transmission", code: "drive_belt", nameZh: "传动带", nameEn: "Drive Belt", sortOrder: 4 },
  { machineTypeCode: "baler", subSystemCode: "transmission", code: "sprocket", nameZh: "链轮", nameEn: "Sprocket", sortOrder: 5 },

  // ── 打捆机：液压系统 (hydraulic) — 4个 ──
  { machineTypeCode: "baler", subSystemCode: "hydraulic", code: "hydraulic_pump", nameZh: "液压泵", nameEn: "Hydraulic Pump", sortOrder: 1 },
  { machineTypeCode: "baler", subSystemCode: "hydraulic", code: "hydraulic_cylinder", nameZh: "液压油缸", nameEn: "Hydraulic Cylinder", sortOrder: 2 },
  { machineTypeCode: "baler", subSystemCode: "hydraulic", code: "hydraulic_valve", nameZh: "液压阀", nameEn: "Hydraulic Valve", sortOrder: 3 },
  { machineTypeCode: "baler", subSystemCode: "hydraulic", code: "seal_kit", nameZh: "密封套件", nameEn: "Seal Kit", sortOrder: 4 },

  // ── 打捆机：电气系统 (electrical) — 3个 ──
  { machineTypeCode: "baler", subSystemCode: "electrical", code: "controller", nameZh: "控制器", nameEn: "Controller", sortOrder: 1 },
  { machineTypeCode: "baler", subSystemCode: "electrical", code: "sensor", nameZh: "传感器", nameEn: "Sensor", sortOrder: 2 },
  { machineTypeCode: "baler", subSystemCode: "electrical", code: "work_light", nameZh: "工作灯", nameEn: "Work Light", sortOrder: 3 },

  // ── 打捆机：行走系统 (chassis) — 4个 ──
  { machineTypeCode: "baler", subSystemCode: "chassis", code: "tire", nameZh: "行走轮胎", nameEn: "Tire", sortOrder: 1 },
  { machineTypeCode: "baler", subSystemCode: "chassis", code: "hub_bearing", nameZh: "轮毂轴承", nameEn: "Hub Bearing", sortOrder: 2 },
  { machineTypeCode: "baler", subSystemCode: "chassis", code: "support_wheel", nameZh: "支撑轮", nameEn: "Support Wheel", sortOrder: 3 },
  { machineTypeCode: "baler", subSystemCode: "chassis", code: "brake", nameZh: "制动器", nameEn: "Brake", sortOrder: 4 },

  // ── 牧草设备：切割系统 (cutting_system) — 5个 ──
  { machineTypeCode: "forage_equipment", subSystemCode: "cutting_system", code: "cutting_blade", nameZh: "切割刀片", nameEn: "Cutting Blade", sortOrder: 1 },
  { machineTypeCode: "forage_equipment", subSystemCode: "cutting_system", code: "cutter_bar", nameZh: "切割器", nameEn: "Cutter Bar", sortOrder: 2 },
  { machineTypeCode: "forage_equipment", subSystemCode: "cutting_system", code: "blade_holder", nameZh: "刀片夹持器", nameEn: "Blade Holder", sortOrder: 3 },
  { machineTypeCode: "forage_equipment", subSystemCode: "cutting_system", code: "drive_belt", nameZh: "传动带", nameEn: "Drive Belt", sortOrder: 4 },
  { machineTypeCode: "forage_equipment", subSystemCode: "cutting_system", code: "cutter_bearing", nameZh: "切割器轴承", nameEn: "Cutter Bearing", sortOrder: 5 },

  // ── 牧草设备：搂草系统 (raking_system) — 4个 ──
  { machineTypeCode: "forage_equipment", subSystemCode: "raking_system", code: "rake_tine", nameZh: "搂草弹齿", nameEn: "Rake Tine", sortOrder: 1 },
  { machineTypeCode: "forage_equipment", subSystemCode: "raking_system", code: "rake_rotor", nameZh: "搂草转子", nameEn: "Rake Rotor", sortOrder: 2 },
  { machineTypeCode: "forage_equipment", subSystemCode: "raking_system", code: "rotor_bearing", nameZh: "转子轴承", nameEn: "Rotor Bearing", sortOrder: 3 },
  { machineTypeCode: "forage_equipment", subSystemCode: "raking_system", code: "rake_arm", nameZh: "搂草臂", nameEn: "Rake Arm", sortOrder: 4 },

  // ── 牧草设备：传动系统 (transmission) — 4个 ──
  { machineTypeCode: "forage_equipment", subSystemCode: "transmission", code: "drive_chain", nameZh: "传动链条", nameEn: "Drive Chain", sortOrder: 1 },
  { machineTypeCode: "forage_equipment", subSystemCode: "transmission", code: "gearbox", nameZh: "齿轮箱", nameEn: "Gearbox", sortOrder: 2 },
  { machineTypeCode: "forage_equipment", subSystemCode: "transmission", code: "universal_joint", nameZh: "万向节", nameEn: "Universal Joint", sortOrder: 3 },
  { machineTypeCode: "forage_equipment", subSystemCode: "transmission", code: "drive_pulley", nameZh: "传动带轮", nameEn: "Drive Pulley", sortOrder: 4 },

  // ── 牧草设备：液压系统 (hydraulic) — 3个 ──
  { machineTypeCode: "forage_equipment", subSystemCode: "hydraulic", code: "hydraulic_cylinder", nameZh: "液压油缸", nameEn: "Hydraulic Cylinder", sortOrder: 1 },
  { machineTypeCode: "forage_equipment", subSystemCode: "hydraulic", code: "hydraulic_valve", nameZh: "液压阀", nameEn: "Hydraulic Valve", sortOrder: 2 },
  { machineTypeCode: "forage_equipment", subSystemCode: "hydraulic", code: "hydraulic_fitting", nameZh: "液压接头", nameEn: "Hydraulic Fitting", sortOrder: 3 },

  // ── 牧草设备：行走系统 (chassis) — 4个 ──
  { machineTypeCode: "forage_equipment", subSystemCode: "chassis", code: "tire", nameZh: "行走轮胎", nameEn: "Tire", sortOrder: 1 },
  { machineTypeCode: "forage_equipment", subSystemCode: "chassis", code: "hub_bearing", nameZh: "轮毂轴承", nameEn: "Hub Bearing", sortOrder: 2 },
  { machineTypeCode: "forage_equipment", subSystemCode: "chassis", code: "steering_knuckle", nameZh: "转向节", nameEn: "Steering Knuckle", sortOrder: 3 },
  { machineTypeCode: "forage_equipment", subSystemCode: "chassis", code: "support_wheel", nameZh: "支撑轮", nameEn: "Support Wheel", sortOrder: 4 },

  // ── 牧草设备：框架系统 (frame_structure) — 3个 ──
  { machineTypeCode: "forage_equipment", subSystemCode: "frame_structure", code: "main_frame", nameZh: "主框架", nameEn: "Main Frame", sortOrder: 1 },
  { machineTypeCode: "forage_equipment", subSystemCode: "frame_structure", code: "mounting_bracket", nameZh: "悬挂支架", nameEn: "Mounting Bracket", sortOrder: 2 },
  { machineTypeCode: "forage_equipment", subSystemCode: "frame_structure", code: "protective_cover", nameZh: "保护罩", nameEn: "Protective Cover", sortOrder: 3 },
];

// ═══════════════════════════════════════════════════════
// P0 配件数据 (140条)
// ═══════════════════════════════════════════════════════

const P0_PARTS: P0Part[] = [
  // ════════════════════════════════════════════════════
  // 联合收割机 (combine_harvester) — 45条
  // ════════════════════════════════════════════════════

  // ── 割台系统 (HDR) ──
  {
    machineTypeCode: "combine_harvester", subSystemCode: "header_system", componentGroupCode: "cutter_bar",
    sku: "SD-COMBINE-HDR-001", nameZh: "约翰迪尔 割台刀片总成", nameEn: "John Deere Header Cutter Bar Assembly", nameRu: "John Deere Header Cutter Bar Assembly",
    brand: "John Deere", oemNumber: "AH200923", price: 4500, stockStatus: "in_stock", isOEM: true,
    descriptionZh: "约翰迪尔原厂割台刀片总成，高碳钢材质，适用于S系列收割机割台。", descriptionEn: "John Deere genuine header cutter bar assembly, high-carbon steel, for S Series combine headers.",
    specs: { material: "High-Carbon Steel", bladeType: "Serrated", bladeLength: "76mm", hardness: "HRC 55-60", pitch: "76.2mm", coating: "Teflon Anti-Friction", warranty: "12 months" },
    compatibleMachines: [
      { brand: "John Deere", model: "S660", yearRange: "2012-2020" },
      { brand: "John Deere", model: "S670", yearRange: "2012-2020" },
      { brand: "John Deere", model: "S680", yearRange: "2012-2022" },
    ],
  },
  {
    machineTypeCode: "combine_harvester", subSystemCode: "header_system", componentGroupCode: "reel",
    sku: "SD-COMBINE-HDR-002", nameZh: "CLAAS 拨禾轮弹齿", nameEn: "CLAAS Reel Tine", nameRu: "CLAAS Reel Tine",
    brand: "CLAAS", oemNumber: "930765", price: 380, stockStatus: "in_stock", isOEM: true,
    descriptionZh: "CLAAS原厂拨禾轮弹齿，弹簧钢材质，适用于Lexion系列收割机。", descriptionEn: "CLAAS genuine reel tine, spring steel, for Lexion series combines.",
    specs: { material: "Spring Steel 65Mn", tineLength: "320mm", diameter: "6mm", surface: "Galvanized", quantity: "10 pcs/box", warranty: "12 months" },
    compatibleMachines: [
      { brand: "CLAAS", model: "Lexion 770", yearRange: "2015-2023" },
      { brand: "CLAAS", model: "Lexion 750", yearRange: "2015-2023" },
    ],
  },
  {
    machineTypeCode: "combine_harvester", subSystemCode: "header_system", componentGroupCode: "auger",
    sku: "SD-COMBINE-HDR-003", nameZh: "福田雷沃 割台螺旋推运器", nameEn: "Foton Lovol Header Auger", nameRu: "Foton Lovol Header Auger",
    brand: "福田雷沃", oemNumber: "FSL600-04010", price: 8500, stockStatus: "in_stock", isOEM: true,
    descriptionZh: "福田雷沃原厂割台螺旋推运器，适用于谷神GE系列收割机。", descriptionEn: "Foton Lovol genuine header auger, for Gushen GE series combines.",
    specs: { material: "Q345 Steel", diameter: "300mm", length: "3200mm", pitch: "250mm", bladeThickness: "5mm", surface: "Anti-Rust Paint", warranty: "12 months" },
    compatibleMachines: [
      { brand: "福田雷沃", model: "谷神GE80", yearRange: "2018-2024" },
      { brand: "福田雷沃", model: "谷神GE70", yearRange: "2018-2024" },
    ],
  },
  {
    machineTypeCode: "combine_harvester", subSystemCode: "header_system", componentGroupCode: "header_drive",
    sku: "SD-COMBINE-HDR-004", nameZh: "Gates 割台传动V带", nameEn: "Gates Header Drive V-Belt", nameRu: "Gates Header Drive V-Belt",
    brand: "Gates", oemNumber: "740P230", price: 180, stockStatus: "in_stock", isOEM: false,
    descriptionZh: "Gates割台传动V带，双层帘线结构，抗拉耐磨。", descriptionEn: "Gates header drive V-belt, double cord construction, wear resistant.",
    specs: { type: "Banded V-Belt", section: "B", length: "2300mm", cord: "Double Polyester", temperature: "-30°C to 80°C", standard: "ISO 4184", warranty: "12 months" },
    compatibleMachines: [
      { brand: "John Deere", model: "S670", yearRange: "2012-2020" },
      { brand: "CLAAS", model: "Lexion 750", yearRange: "2015-2023" },
    ],
  },
  {
    machineTypeCode: "combine_harvester", subSystemCode: "header_system", componentGroupCode: "cutter_bar",
    sku: "SD-COMBINE-HDR-005", nameZh: "约翰迪尔 护刃器套件(10件)", nameEn: "John Deere Guard Kit (10 pcs)", nameRu: "John Deere Guard Kit (10 pcs)",
    brand: "John Deere", oemNumber: "AH134837", price: 620, stockStatus: "in_stock", isOEM: true,
    descriptionZh: "约翰迪尔原厂护刃器套件，锻钢材质，每套10件。", descriptionEn: "John Deere genuine guard kit, forged steel, 10 pieces per kit.",
    specs: { material: "Forged Steel 45#", quantity: "10 pcs", type: "Standard Guard", surface: "Phosphate Coated", bladeFit: "76mm Pitch", warranty: "12 months" },
    compatibleMachines: [
      { brand: "John Deere", model: "S660", yearRange: "2012-2020" },
      { brand: "John Deere", model: "S670", yearRange: "2012-2020" },
    ],
  },
  {
    machineTypeCode: "combine_harvester", subSystemCode: "header_system", componentGroupCode: "divider",
    sku: "SD-COMBINE-HDR-006", nameZh: "久保田 分禾器尖", nameEn: "Kubota Divider Point", nameRu: "Kubota Divider Point",
    brand: "Kubota", oemNumber: "66531-33210", price: 150, stockStatus: "in_stock", isOEM: true,
    descriptionZh: "久保田原厂分禾器尖，不锈钢材质，适用于PRO系列收割机。", descriptionEn: "Kubota genuine divider point, stainless steel, for PRO series combines.",
    specs: { material: "Stainless Steel 304", length: "280mm", width: "45mm", thickness: "2mm", surface: "Mirror Polished", mounting: "4 Bolt Holes", warranty: "12 months" },
    compatibleMachines: [
      { brand: "Kubota", model: "PRO688", yearRange: "2016-2024" },
      { brand: "Kubota", model: "PRO588", yearRange: "2016-2024" },
    ],
  },
  {
    machineTypeCode: "combine_harvester", subSystemCode: "header_system", componentGroupCode: "hydraulic_lift",
    sku: "SD-COMBINE-HDR-007", nameZh: "Parker 割台升降油缸", nameEn: "Parker Header Lift Cylinder", nameRu: "Parker Header Lift Cylinder",
    brand: "Parker", oemNumber: "HLC-C50-300", price: 2800, stockStatus: "low_stock", isOEM: false,
    descriptionZh: "Parker割台液压升降油缸，双作用式，镀铬活塞杆。", descriptionEn: "Parker header hydraulic lift cylinder, double-acting, chrome plated rod.",
    specs: { bore: "50mm", stroke: "300mm", rodDiameter: "25mm", type: "Double Acting", pressure: "210 bar", seal: "NBR Polyurethane", warranty: "12 months" },
    compatibleMachines: [
      { brand: "John Deere", model: "S670", yearRange: "2012-2020" },
      { brand: "CLAAS", model: "Lexion 770", yearRange: "2015-2023" },
    ],
  },

  // ── 脱粒系统 (THR) ──
  {
    machineTypeCode: "combine_harvester", subSystemCode: "threshing_system", componentGroupCode: "threshing_cylinder",
    sku: "SD-COMBINE-THR-001", nameZh: "约翰迪尔 纹杆式脱粒滚筒", nameEn: "John Deere Rasp Bar Threshing Cylinder", nameRu: "John Deere Rasp Bar Threshing Cylinder",
    brand: "John Deere", oemNumber: "AH211436", price: 12000, stockStatus: "in_stock", isOEM: true,
    descriptionZh: "约翰迪尔原厂纹杆式脱粒滚筒总成，适用于S系列收割机。", descriptionEn: "John Deere genuine rasp bar threshing cylinder assembly for S Series combines.",
    specs: { diameter: "650mm", width: "1700mm", barCount: "8", material: "Cast Steel", surface: "Hardened HRC 50", bearing: "Included", warranty: "12 months" },
    compatibleMachines: [
      { brand: "John Deere", model: "S670", yearRange: "2012-2020" },
      { brand: "John Deere", model: "S680", yearRange: "2012-2022" },
    ],
  },
  {
    machineTypeCode: "combine_harvester", subSystemCode: "threshing_system", componentGroupCode: "concave",
    sku: "SD-COMBINE-THR-002", nameZh: "CLAAS 脱粒凹板筛总成", nameEn: "CLAAS Threshing Concave Assembly", nameRu: "CLAAS Threshing Concave Assembly",
    brand: "CLAAS", oemNumber: "932041", price: 6800, stockStatus: "in_stock", isOEM: true,
    descriptionZh: "CLAAS原厂脱粒凹板筛总成，可调节格栅式。", descriptionEn: "CLAAS genuine threshing concave assembly, adjustable grate type.",
    specs: { type: "Adjustable Grate", material: "Hardox 450", barCount: "14", barGap: "12mm", dimensions: "1700x450mm", surface: "Wear Resistant", warranty: "12 months" },
    compatibleMachines: [
      { brand: "CLAAS", model: "Lexion 770", yearRange: "2015-2023" },
      { brand: "CLAAS", model: "Lexion 750", yearRange: "2015-2023" },
    ],
  },
  {
    machineTypeCode: "combine_harvester", subSystemCode: "threshing_system", componentGroupCode: "rasp_bar",
    sku: "SD-COMBINE-THR-003", nameZh: "福田雷沃 脱粒纹杆(6条)", nameEn: "Foton Lovol Threshing Rasp Bar (6 pcs)", nameRu: "Foton Lovol Threshing Rasp Bar (6 pcs)",
    brand: "福田雷沃", oemNumber: "FSL600-05120", price: 320, stockStatus: "in_stock", isOEM: true,
    descriptionZh: "福田雷沃原厂脱粒纹杆，每套6条，锰钢材质。", descriptionEn: "Foton Lovol genuine threshing rasp bar, 6 pieces per set, manganese steel.",
    specs: { material: "Manganese Steel 65Mn", quantity: "6 pcs", length: "1700mm", width: "45mm", surface: "Hardened HRC 55", threadDirection: "Left", warranty: "12 months" },
    compatibleMachines: [
      { brand: "福田雷沃", model: "谷神GE80", yearRange: "2018-2024" },
      { brand: "福田雷沃", model: "谷神GE70", yearRange: "2018-2024" },
    ],
  },
  {
    machineTypeCode: "combine_harvester", subSystemCode: "threshing_system", componentGroupCode: "rotor",
    sku: "SD-COMBINE-THR-004", nameZh: "Case IH 轴流脱粒转子齿杆", nameEn: "Case IH Axial-Flow Rotor Spike", nameRu: "Case IH Axial-Flow Rotor Spike",
    brand: "Case IH", oemNumber: "87843926", price: 4500, stockStatus: "in_stock", isOEM: true,
    descriptionZh: "Case IH原厂轴流脱粒转子齿杆，适用于Axial-Flow系列。", descriptionEn: "Case IH genuine axial-flow rotor spike for Axial-Flow series.",
    specs: { material: "Cast Steel", toothCount: "12 per bar", length: "2800mm", height: "65mm", surface: "Hardfaced", mounting: "Bolt-On", warranty: "12 months" },
    compatibleMachines: [
      { brand: "Case IH", model: "AF7230", yearRange: "2010-2020" },
      { brand: "Case IH", model: "AF8260", yearRange: "2012-2022" },
    ],
  },
  {
    machineTypeCode: "combine_harvester", subSystemCode: "threshing_system", componentGroupCode: "straw_walker",
    sku: "SD-COMBINE-THR-005", nameZh: "久保田 逐稿器键簧", nameEn: "Kubota Straw Walker Key", nameRu: "Kubota Straw Walker Key",
    brand: "Kubota", oemNumber: "67231-22010", price: 280, stockStatus: "in_stock", isOEM: true,
    descriptionZh: "久保田原厂逐稿器键簧，橡胶材质，减震耐用。", descriptionEn: "Kubota genuine straw walker key, rubber material, durable and shock-absorbing.",
    specs: { material: "Rubber + Steel Core", type: "Step Key", width: "120mm", height: "55mm", durometer: "70 Shore A", color: "Black", warranty: "12 months" },
    compatibleMachines: [
      { brand: "Kubota", model: "PRO688", yearRange: "2016-2024" },
      { brand: "Kubota", model: "PRO588", yearRange: "2016-2024" },
    ],
  },
  {
    machineTypeCode: "combine_harvester", subSystemCode: "threshing_system", componentGroupCode: "cylinder_bearing",
    sku: "SD-COMBINE-THR-006", nameZh: "SKF 脱粒滚筒轴承单元", nameEn: "SKF Threshing Cylinder Bearing Unit", nameRu: "SKF Threshing Cylinder Bearing Unit",
    brand: "SKF", oemNumber: "SY507", price: 380, stockStatus: "in_stock", isOEM: false,
    descriptionZh: "SKF脱粒滚筒轴承单元，铸铁座，免维护设计。", descriptionEn: "SKF threshing cylinder bearing unit, cast iron housing, maintenance-free.",
    specs: { type: "Insert Bearing Unit", innerDiameter: "35mm", housing: "Pillow Block", seal: "Dual Lip Rubber", material: "Bearing Steel", loadRating: "Dynamic 28kN", warranty: "12 months" },
    compatibleMachines: [
      { brand: "John Deere", model: "S670", yearRange: "2012-2020" },
      { brand: "CLAAS", model: "Lexion 750", yearRange: "2015-2023" },
    ],
  },

  // ── 清选系统 (CLN) ──
  {
    machineTypeCode: "combine_harvester", subSystemCode: "cleaning_system", componentGroupCode: "upper_sieve",
    sku: "SD-COMBINE-CLN-001", nameZh: "约翰迪尔 清选上筛总成", nameEn: "John Deere Upper Cleaning Sieve", nameRu: "John Deere Upper Cleaning Sieve",
    brand: "John Deere", oemNumber: "AH154976", price: 3200, stockStatus: "in_stock", isOEM: true,
    descriptionZh: "约翰迪尔原厂清选上筛总成，鱼鳞式可调筛片。", descriptionEn: "John Deere genuine upper cleaning sieve, adjustable louver type.",
    specs: { type: "Adjustable Louver", material: "Aluminum Alloy", dimensions: "1600x800mm", louverCount: "36", adjustRange: "0-15mm", surface: "Anodized", warranty: "12 months" },
    compatibleMachines: [
      { brand: "John Deere", model: "S670", yearRange: "2012-2020" },
      { brand: "John Deere", model: "S680", yearRange: "2012-2022" },
    ],
  },
  {
    machineTypeCode: "combine_harvester", subSystemCode: "cleaning_system", componentGroupCode: "lower_sieve",
    sku: "SD-COMBINE-CLN-002", nameZh: "CLAAS 清选下筛总成", nameEn: "CLAAS Lower Cleaning Sieve", nameRu: "CLAAS Lower Cleaning Sieve",
    brand: "CLAAS", oemNumber: "933215", price: 2800, stockStatus: "in_stock", isOEM: true,
    descriptionZh: "CLAAS原厂清选下筛总成，不锈钢丝网结构。", descriptionEn: "CLAAS genuine lower cleaning sieve, stainless steel wire mesh.",
    specs: { type: "Wire Mesh Sieve", material: "Stainless Steel 304", dimensions: "1600x800mm", meshSize: "8mm", wireDiameter: "2mm", frame: "Aluminum", warranty: "12 months" },
    compatibleMachines: [
      { brand: "CLAAS", model: "Lexion 770", yearRange: "2015-2023" },
      { brand: "CLAAS", model: "Lexion 750", yearRange: "2015-2023" },
    ],
  },
  {
    machineTypeCode: "combine_harvester", subSystemCode: "cleaning_system", componentGroupCode: "fan",
    sku: "SD-COMBINE-CLN-003", nameZh: "福田雷沃 清选风扇叶片", nameEn: "Foton Lovol Cleaning Fan Blade", nameRu: "Foton Lovol Cleaning Fan Blade",
    brand: "福田雷沃", oemNumber: "FSL600-06200", price: 850, stockStatus: "in_stock", isOEM: true,
    descriptionZh: "福田雷沃原厂清选风扇叶片，铝合金材质，6片式。", descriptionEn: "Foton Lovol genuine cleaning fan blade, aluminum alloy, 6 blades.",
    specs: { material: "Aluminum Alloy 6061", bladeCount: "6", diameter: "600mm", hubBore: "40mm", pitch: "Adjustable", surface: "Anodized", warranty: "12 months" },
    compatibleMachines: [
      { brand: "福田雷沃", model: "谷神GE80", yearRange: "2018-2024" },
      { brand: "福田雷沃", model: "谷神GE70", yearRange: "2018-2024" },
    ],
  },
  {
    machineTypeCode: "combine_harvester", subSystemCode: "cleaning_system", componentGroupCode: "fan_bearing",
    sku: "SD-COMBINE-CLN-004", nameZh: "SKF 筛箱驱动轴承 6306-2RS", nameEn: "SKF Sieve Drive Bearing 6306-2RS", nameRu: "SKF Sieve Drive Bearing 6306-2RS",
    brand: "SKF", oemNumber: "6306-2RS1", price: 65, stockStatus: "in_stock", isOEM: false,
    descriptionZh: "SKF深沟球轴承，双面密封，适用于筛箱驱动轴。", descriptionEn: "SKF deep groove ball bearing, double sealed, for sieve drive shaft.",
    specs: { type: "Deep Groove Ball", innerDiameter: "30mm", outerDiameter: "72mm", width: "19mm", seal: "2RS Double Rubber", clearance: "C3", warranty: "12 months" },
    compatibleMachines: [
      { brand: "John Deere", model: "S670", yearRange: "2012-2020" },
      { brand: "CLAAS", model: "Lexion 750", yearRange: "2015-2023" },
    ],
  },
  {
    machineTypeCode: "combine_harvester", subSystemCode: "cleaning_system", componentGroupCode: "fan",
    sku: "SD-COMBINE-CLN-005", nameZh: "Gates 风扇调速V带", nameEn: "Gates Fan Variable Speed V-Belt", nameRu: "Gates Fan Variable Speed V-Belt",
    brand: "Gates", oemNumber: "740P180", price: 120, stockStatus: "in_stock", isOEM: false,
    descriptionZh: "Gates风扇调速V带，变速带设计，适用清选风扇。", descriptionEn: "Gates fan variable speed V-belt, variable speed design, for cleaning fan.",
    specs: { type: "Variable Speed V-Belt", section: "3V", length: "1800mm", cord: "Aramid", temperature: "-35°C to 90°C", standard: "RMA IP-22", warranty: "12 months" },
    compatibleMachines: [
      { brand: "John Deere", model: "S670", yearRange: "2012-2020" },
      { brand: "CLAAS", model: "Lexion 770", yearRange: "2015-2023" },
    ],
  },

  // ── 输粮系统 (GRH) ──
  {
    machineTypeCode: "combine_harvester", subSystemCode: "grain_handling", componentGroupCode: "elevator_chain",
    sku: "SD-COMBINE-GRH-001", nameZh: "约翰迪尔 粮仓升运器链条", nameEn: "John Deere Grain Elevator Chain", nameRu: "John Deere Grain Elevator Chain",
    brand: "John Deere", oemNumber: "AH147022", price: 1200, stockStatus: "in_stock", isOEM: true,
    descriptionZh: "约翰迪尔原厂粮仓升运器链条，带刮板，双排链。", descriptionEn: "John Deere genuine grain elevator chain with scrapers, double strand.",
    specs: { type: "Double Strand Roller Chain", pitch: "19.05mm", length: "4500mm", scraperInterval: "152mm", material: "Carbon Steel", surface: "Nickel Plated", warranty: "12 months" },
    compatibleMachines: [
      { brand: "John Deere", model: "S670", yearRange: "2012-2020" },
      { brand: "John Deere", model: "S680", yearRange: "2012-2022" },
    ],
  },
  {
    machineTypeCode: "combine_harvester", subSystemCode: "grain_handling", componentGroupCode: "grain_spreader",
    sku: "SD-COMBINE-GRH-002", nameZh: "CLAAS 谷物抛撒器", nameEn: "CLAAS Grain Spreader", nameRu: "CLAAS Grain Spreader",
    brand: "CLAAS", oemNumber: "934567", price: 3500, stockStatus: "in_stock", isOEM: true,
    descriptionZh: "CLAAS原厂谷物抛撒器，旋转盘式，均匀布料。", descriptionEn: "CLAAS genuine grain spreader, rotary disc type, uniform distribution.",
    specs: { type: "Rotary Disc", diameter: "400mm", material: "Stainless Steel 304", motor: "12V DC 80W", speed: "60 rpm", distributionAngle: "360°", warranty: "12 months" },
    compatibleMachines: [
      { brand: "CLAAS", model: "Lexion 770", yearRange: "2015-2023" },
      { brand: "CLAAS", model: "Lexion 750", yearRange: "2015-2023" },
    ],
  },
  {
    machineTypeCode: "combine_harvester", subSystemCode: "grain_handling", componentGroupCode: "elevator_chain",
    sku: "SD-COMBINE-GRH-003", nameZh: "福田雷沃 升运器刮板(20片)", nameEn: "Foton Lovol Elevator Scraper (20 pcs)", nameRu: "Foton Lovol Elevator Scraper (20 pcs)",
    brand: "福田雷沃", oemNumber: "FSL600-07100", price: 280, stockStatus: "in_stock", isOEM: true,
    descriptionZh: "福田雷沃原厂升运器刮板，耐磨橡胶材质，每套20片。", descriptionEn: "Foton Lovol genuine elevator scraper, wear-resistant rubber, 20 pcs per set.",
    specs: { material: "Wear-Resistant Rubber", quantity: "20 pcs", dimensions: "120x60mm", thickness: "8mm", hardness: "75 Shore A", color: "Black", warranty: "12 months" },
    compatibleMachines: [
      { brand: "福田雷沃", model: "谷神GE80", yearRange: "2018-2024" },
      { brand: "福田雷沃", model: "谷神GE70", yearRange: "2018-2024" },
    ],
  },
  {
    machineTypeCode: "combine_harvester", subSystemCode: "grain_handling", componentGroupCode: "unloading_auger",
    sku: "SD-COMBINE-GRH-004", nameZh: "铁岭机械 卸粮搅龙", nameEn: "Tieling Machinery Unloading Auger", nameRu: "Tieling Machinery Unloading Auger",
    brand: "铁岭机械", oemNumber: "TL-AGR200", price: 2600, stockStatus: "low_stock", isOEM: false,
    descriptionZh: "铁岭机械卸粮搅龙，无缝钢管焊接螺旋叶片。", descriptionEn: "Tieling Machinery unloading auger, seamless steel tube with welded spiral flight.",
    specs: { material: "Q235 Seamless Steel", diameter: "200mm", length: "3500mm", pitch: "200mm", bladeThickness: "4mm", surface: "Anti-Rust Primer", warranty: "12 months" },
    compatibleMachines: [
      { brand: "John Deere", model: "S670", yearRange: "2012-2020" },
      { brand: "福田雷沃", model: "谷神GE80", yearRange: "2018-2024" },
    ],
  },
  {
    machineTypeCode: "combine_harvester", subSystemCode: "grain_handling", componentGroupCode: "unloading_valve",
    sku: "SD-COMBINE-GRH-005", nameZh: "Eaton 卸粮管液压阀", nameEn: "Eaton Unloading Tube Hydraulic Valve", nameRu: "Eaton Unloading Tube Hydraulic Valve",
    brand: "Eaton", oemNumber: "WVS-2-10", price: 1800, stockStatus: "in_stock", isOEM: false,
    descriptionZh: "Eaton卸粮管液压控制阀，二位二通换向阀。", descriptionEn: "Eaton unloading tube hydraulic valve, 2-position 2-way directional valve.",
    specs: { type: "2/2 Way Directional", portSize: "G1/2", pressure: "250 bar", flow: "40 L/min", voltage: "12V DC", seal: "NBR", warranty: "12 months" },
    compatibleMachines: [
      { brand: "John Deere", model: "S670", yearRange: "2012-2020" },
      { brand: "CLAAS", model: "Lexion 750", yearRange: "2015-2023" },
    ],
  },

  // ── 联合收割机：动力系统 (PWR) ──
  {
    machineTypeCode: "combine_harvester", subSystemCode: "powertrain", componentGroupCode: "engine_assembly",
    sku: "SD-COMBINE-PWR-001", nameZh: "约翰迪尔 6.8L 柴油发动机总成", nameEn: "John Deere 6.8L Diesel Engine Assembly", nameRu: "John Deere 6.8L Diesel Engine Assembly",
    brand: "John Deere", oemNumber: "RE239928", price: 95000, stockStatus: "in_stock", isOEM: true,
    descriptionZh: "约翰迪尔PowerTech 6.8L柴油发动机总成，适用于S系列收割机。", descriptionEn: "John Deere PowerTech 6.8L diesel engine assembly for S Series combines.",
    specs: { displacement: "6.8L", cylinders: "6", power: "205 kW (275 HP)", cooling: "Liquid Cooled", fuelSystem: "Electronic Unit Injection", weight: "680 kg", warranty: "12 months" },
    compatibleMachines: [
      { brand: "John Deere", model: "S670", yearRange: "2012-2020" },
      { brand: "John Deere", model: "S680", yearRange: "2012-2022" },
    ],
  },
  {
    machineTypeCode: "combine_harvester", subSystemCode: "powertrain", componentGroupCode: "turbocharger",
    sku: "SD-COMBINE-PWR-002", nameZh: "Bosch 涡轮增压器", nameEn: "Bosch Turbocharger", nameRu: "Bosch Turbocharger",
    brand: "Bosch", oemNumber: "0281002400", price: 8500, stockStatus: "in_stock", isOEM: false,
    descriptionZh: "Bosch涡轮增压器，废气涡轮式，适用于6-8L柴油机。", descriptionEn: "Bosch turbocharger, exhaust gas turbine type, for 6-8L diesel engines.",
    specs: { type: "Wastegate Turbo", maxBoost: "2.2 bar", compressor: "Aluminum", turbine: "Inconel", bearing: "Journal Bearing", oilCooled: "Yes", warranty: "12 months" },
    compatibleMachines: [
      { brand: "John Deere", model: "S670", yearRange: "2012-2020" },
      { brand: "CLAAS", model: "Lexion 770", yearRange: "2015-2023" },
    ],
  },
  {
    machineTypeCode: "combine_harvester", subSystemCode: "powertrain", componentGroupCode: "fuel_pump",
    sku: "SD-COMBINE-PWR-003", nameZh: "潍柴 高压油泵", nameEn: "Weichai High Pressure Fuel Pump", nameRu: "Weichai High Pressure Fuel Pump",
    brand: "潍柴", oemNumber: "WD615-22100", price: 6800, stockStatus: "in_stock", isOEM: false,
    descriptionZh: "潍柴高压分配式油泵，适用于6缸柴油机。", descriptionEn: "Weichai high pressure distributor fuel pump, for 6-cylinder diesel engines.",
    specs: { type: "Distributor Pump", maxPressure: "1200 bar", cylinders: "6", fuelFeed: "400 L/h", governor: "Mechanical", material: "Aluminum + Steel", warranty: "12 months" },
    compatibleMachines: [
      { brand: "John Deere", model: "S670", yearRange: "2012-2020" },
      { brand: "福田雷沃", model: "谷神GE80", yearRange: "2018-2024" },
    ],
  },
  {
    machineTypeCode: "combine_harvester", subSystemCode: "powertrain", componentGroupCode: "injector",
    sku: "SD-COMBINE-PWR-004", nameZh: "Bosch 喷油器总成", nameEn: "Bosch Injector Assembly", nameRu: "Bosch Injector Assembly",
    brand: "Bosch", oemNumber: "0445120128", price: 2800, stockStatus: "in_stock", isOEM: false,
    descriptionZh: "Bosch电控喷油器总成，共轨系统适用。", descriptionEn: "Bosch electronic injector assembly, for common rail systems.",
    specs: { type: "Electromagnetic Common Rail", nozzle: "6-Hole", sprayAngle: "150°", openingPressure: "220 bar", voltage: "12V", responseTime: "0.2ms", warranty: "12 months" },
    compatibleMachines: [
      { brand: "John Deere", model: "S670", yearRange: "2012-2020" },
      { brand: "CLAAS", model: "Lexion 750", yearRange: "2015-2023" },
    ],
  },
  {
    machineTypeCode: "combine_harvester", subSystemCode: "powertrain", componentGroupCode: "water_pump",
    sku: "SD-COMBINE-PWR-005", nameZh: "福田雷沃 水泵总成", nameEn: "Foton Lovol Water Pump Assembly", nameRu: "Foton Lovol Water Pump Assembly",
    brand: "福田雷沃", oemNumber: "FSL600-09010", price: 1200, stockStatus: "in_stock", isOEM: true,
    descriptionZh: "福田雷沃原厂水泵总成，离心式，带轴承和密封。", descriptionEn: "Foton Lovol genuine water pump assembly, centrifugal type, with bearing and seal.",
    specs: { type: "Centrifugal", flow: "180 L/min", impeller: "Cast Iron", drive: "Belt Drive", inlet: "40mm", outlet: "32mm", warranty: "12 months" },
    compatibleMachines: [
      { brand: "福田雷沃", model: "谷神GE80", yearRange: "2018-2024" },
      { brand: "福田雷沃", model: "谷神GE70", yearRange: "2018-2024" },
    ],
  },
  {
    machineTypeCode: "combine_harvester", subSystemCode: "powertrain", componentGroupCode: "oil_filter",
    sku: "SD-COMBINE-PWR-006", nameZh: "Donaldson 机油滤芯", nameEn: "Donaldson Oil Filter", nameRu: "Donaldson Oil Filter",
    brand: "Donaldson", oemNumber: "P551320", price: 180, stockStatus: "in_stock", isOEM: false,
    descriptionZh: "Donaldson机油滤芯，旋装式，高效过滤。", descriptionEn: "Donaldson oil filter, spin-on type, high efficiency filtration.",
    specs: { type: "Spin-On Full Flow", filterMedia: "Cellulose + Synthetic Blend", micron: "20 micron", bypass: "1.5 bar", threadSize: "M22x1.5", capacity: "1.2L", warranty: "N/A" },
    compatibleMachines: [
      { brand: "John Deere", model: "S670", yearRange: "2012-2020" },
      { brand: "CLAAS", model: "Lexion 750", yearRange: "2015-2023" },
    ],
  },
  {
    machineTypeCode: "combine_harvester", subSystemCode: "powertrain", componentGroupCode: "air_filter",
    sku: "SD-COMBINE-PWR-007", nameZh: "Donaldson 空气滤芯总成", nameEn: "Donaldson Air Filter Assembly", nameRu: "Donaldson Air Filter Assembly",
    brand: "Donaldson", oemNumber: "P181066", price: 450, stockStatus: "in_stock", isOEM: false,
    descriptionZh: "Donaldson空气滤芯总成，干式纸质滤芯，带安全滤芯。", descriptionEn: "Donaldson air filter assembly, dry paper element, with safety filter.",
    specs: { type: "Dry Panel + Safety", filterMedia: "Cellulose Paper", efficiency: "99.5%", outerDiameter: "320mm", height: "450mm", preCleaner: "Optional", warranty: "N/A" },
    compatibleMachines: [
      { brand: "John Deere", model: "S670", yearRange: "2012-2020" },
      { brand: "CLAAS", model: "Lexion 770", yearRange: "2015-2023" },
    ],
  },

  // ── 联合收割机：传动系统 (TRN) ──
  {
    machineTypeCode: "combine_harvester", subSystemCode: "transmission", componentGroupCode: "hydrostatic_pump",
    sku: "SD-COMBINE-TRN-001", nameZh: "Danfoss 静液压驱动泵", nameEn: "Danfoss Hydrostatic Drive Pump", nameRu: "Danfoss Hydrostatic Drive Pump",
    brand: "Danfoss", oemNumber: "151B-0605", price: 28000, stockStatus: "in_stock", isOEM: false,
    descriptionZh: "Danfoss静液压驱动泵，变量轴向柱塞式。", descriptionEn: "Danfoss hydrostatic drive pump, variable displacement axial piston.",
    specs: { type: "Variable Axial Piston", displacement: "60 cc/rev", maxPressure: "420 bar", speed: "2500 rpm", port: "SAE 6000 PSI", control: "Electric Proportional", warranty: "12 months" },
    compatibleMachines: [
      { brand: "John Deere", model: "S670", yearRange: "2012-2020" },
      { brand: "CLAAS", model: "Lexion 770", yearRange: "2015-2023" },
    ],
  },
  {
    machineTypeCode: "combine_harvester", subSystemCode: "transmission", componentGroupCode: "hydraulic_motor",
    sku: "SD-COMBINE-TRN-002", nameZh: "Eaton 驱动马达", nameEn: "Eaton Drive Motor", nameRu: "Eaton Drive Motor",
    brand: "Eaton", oemNumber: "6423-421", price: 22000, stockStatus: "low_stock", isOEM: false,
    descriptionZh: "Eaton液压驱动马达，定量轴向柱塞式，带制动器。", descriptionEn: "Eaton hydraulic drive motor, fixed displacement axial piston, with brake.",
    specs: { type: "Fixed Axial Piston", displacement: "55 cc/rev", maxPressure: "400 bar", speed: "3000 rpm", brake: "Multi-Disc", port: "SAE 6000 PSI", warranty: "12 months" },
    compatibleMachines: [
      { brand: "John Deere", model: "S670", yearRange: "2012-2020" },
      { brand: "CLAAS", model: "Lexion 750", yearRange: "2015-2023" },
    ],
  },
  {
    machineTypeCode: "combine_harvester", subSystemCode: "transmission", componentGroupCode: "gearbox",
    sku: "SD-COMBINE-TRN-003", nameZh: "福田雷沃 传动齿轮箱", nameEn: "Foton Lovol Drive Gearbox", nameRu: "Foton Lovol Drive Gearbox",
    brand: "福田雷沃", oemNumber: "FSL600-10030", price: 8500, stockStatus: "in_stock", isOEM: true,
    descriptionZh: "福田雷沃原厂传动齿轮箱，3档变速，含齿轮和轴承。", descriptionEn: "Foton Lovol genuine drive gearbox, 3-speed, with gears and bearings.",
    specs: { type: "Constant Mesh 3-Speed", ratio: "1:3.2 / 1:1.6 / 1:1", material: "20CrMnTi", oilCapacity: "3.5L", bearing: "SKF", weight: "45 kg", warranty: "12 months" },
    compatibleMachines: [
      { brand: "福田雷沃", model: "谷神GE80", yearRange: "2018-2024" },
      { brand: "福田雷沃", model: "谷神GE70", yearRange: "2018-2024" },
    ],
  },
  {
    machineTypeCode: "combine_harvester", subSystemCode: "transmission", componentGroupCode: "universal_joint",
    sku: "SD-COMBINE-TRN-004", nameZh: "洛阳轴承 万向节总成", nameEn: "LYC Universal Joint Assembly", nameRu: "LYC Universal Joint Assembly",
    brand: "洛阳轴承", oemNumber: "LYC-GU1000", price: 850, stockStatus: "in_stock", isOEM: false,
    descriptionZh: "洛阳轴承万向节总成，十字轴式，含轴承和油封。", descriptionEn: "LYC universal joint assembly, cross type, with bearings and seals.",
    specs: { type: "Cross Joint", outerDiameter: "100mm", shaftDiameter: "30mm", material: "20Cr", bearing: "Needle Roller", angle: "35°", warranty: "12 months" },
    compatibleMachines: [
      { brand: "John Deere", model: "S670", yearRange: "2012-2020" },
      { brand: "福田雷沃", model: "谷神GE80", yearRange: "2018-2024" },
    ],
  },
  {
    machineTypeCode: "combine_harvester", subSystemCode: "transmission", componentGroupCode: "drive_chain",
    sku: "SD-COMBINE-TRN-005", nameZh: "Gates 传动链条", nameEn: "Gates Drive Chain", nameRu: "Gates Drive Chain",
    brand: "Gates", oemNumber: "560P240", price: 320, stockStatus: "in_stock", isOEM: false,
    descriptionZh: "Gates滚子传动链条，合金钢材质，预拉伸处理。", descriptionEn: "Gates roller drive chain, alloy steel, pre-stretched.",
    specs: { type: "Roller Chain", pitch: "15.875mm", length: "240 links", material: "Alloy Steel", tensile: "25 kN", surface: "Black Oxide", warranty: "12 months" },
    compatibleMachines: [
      { brand: "John Deere", model: "S670", yearRange: "2012-2020" },
      { brand: "CLAAS", model: "Lexion 750", yearRange: "2015-2023" },
    ],
  },

  // ── 联合收割机：行走系统 (CHS) ──
  {
    machineTypeCode: "combine_harvester", subSystemCode: "chassis", componentGroupCode: "front_axle",
    sku: "SD-COMBINE-CHS-001", nameZh: "约翰迪尔 前驱动桥总成", nameEn: "John Deere Front Drive Axle Assembly", nameRu: "John Deere Front Drive Axle Assembly",
    brand: "John Deere", oemNumber: "AH167890", price: 28000, stockStatus: "in_stock", isOEM: true,
    descriptionZh: "约翰迪尔原厂前驱动桥总成，含差速器和行星减速。", descriptionEn: "John Deere genuine front drive axle assembly, with differential and planetary reduction.",
    specs: { type: "Drive Axle with Differential", loadCapacity: "12 ton", ratio: "1:5.8", brake: "Multi-Disc Wet", material: "Cast Steel", weight: "280 kg", warranty: "12 months" },
    compatibleMachines: [
      { brand: "John Deere", model: "S670", yearRange: "2012-2020" },
      { brand: "John Deere", model: "S680", yearRange: "2012-2022" },
    ],
  },
  {
    machineTypeCode: "combine_harvester", subSystemCode: "chassis", componentGroupCode: "rear_axle",
    sku: "SD-COMBINE-CHS-002", nameZh: "CLAAS 后转向桥", nameEn: "CLAAS Rear Steer Axle", nameRu: "CLAAS Rear Steer Axle",
    brand: "CLAAS", oemNumber: "935789", price: 18000, stockStatus: "low_stock", isOEM: true,
    descriptionZh: "CLAAS原厂后转向桥，含转向油缸和转向节。", descriptionEn: "CLAAS genuine rear steer axle, with steering cylinder and knuckle.",
    specs: { type: "Steer Axle", loadCapacity: "8 ton", steeringAngle: "45°", brake: "Drum", material: "Cast Steel", weight: "180 kg", warranty: "12 months" },
    compatibleMachines: [
      { brand: "CLAAS", model: "Lexion 770", yearRange: "2015-2023" },
      { brand: "CLAAS", model: "Lexion 750", yearRange: "2015-2023" },
    ],
  },
  {
    machineTypeCode: "combine_harvester", subSystemCode: "chassis", componentGroupCode: "drive_tire",
    sku: "SD-COMBINE-CHS-003", nameZh: "福田雷沃 驱动轮胎 710/70R38", nameEn: "Foton Lovol Drive Tire 710/70R38", nameRu: "Foton Lovol Drive Tire 710/70R38",
    brand: "福田雷沃", oemNumber: "FSL-T710", price: 6500, stockStatus: "in_stock", isOEM: true,
    descriptionZh: "福田雷沃原厂驱动轮胎，子午线结构，宽断面设计。", descriptionEn: "Foton Lovol genuine drive tire, radial construction, wide section design.",
    specs: { type: "Radial Agricultural", size: "710/70R38", pattern: "R-1W Lug", loadIndex: "169D", ply: "10", pressure: "1.6 bar", weight: "180 kg", warranty: "12 months" },
    compatibleMachines: [
      { brand: "福田雷沃", model: "谷神GE80", yearRange: "2018-2024" },
      { brand: "John Deere", model: "S670", yearRange: "2012-2020" },
    ],
  },
  {
    machineTypeCode: "combine_harvester", subSystemCode: "chassis", componentGroupCode: "steer_tire",
    sku: "SD-COMBINE-CHS-004", nameZh: "铁岭机械 转向轮胎 14.9-24", nameEn: "Tieling Machinery Steer Tire 14.9-24", nameRu: "Tieling Machinery Steer Tire 14.9-24",
    brand: "铁岭机械", oemNumber: "TL-T149", price: 2800, stockStatus: "in_stock", isOEM: false,
    descriptionZh: "铁岭机械转向轮胎，斜交结构，适用于收割机后桥。", descriptionEn: "Tieling Machinery steer tire, bias construction, for combine rear axle.",
    specs: { type: "Bias Agricultural", size: "14.9-24", pattern: "R-3", loadIndex: "130A8", ply: "8", pressure: "2.0 bar", weight: "65 kg", warranty: "12 months" },
    compatibleMachines: [
      { brand: "福田雷沃", model: "谷神GE80", yearRange: "2018-2024" },
      { brand: "John Deere", model: "S660", yearRange: "2012-2020" },
    ],
  },
  {
    machineTypeCode: "combine_harvester", subSystemCode: "chassis", componentGroupCode: "brake_system",
    sku: "SD-COMBINE-CHS-005", nameZh: "Eaton 制动摩擦片", nameEn: "Eaton Brake Friction Plate", nameRu: "Eaton Brake Friction Plate",
    brand: "Eaton", oemNumber: "BK-250", price: 450, stockStatus: "in_stock", isOEM: false,
    descriptionZh: "Eaton制动摩擦片，湿式多片式制动器用。", descriptionEn: "Eaton brake friction plate, for wet multi-disc brake.",
    specs: { type: "Wet Multi-Disc", outerDiameter: "250mm", innerDiameter: "170mm", thickness: "5mm", material: "Copper-Based Sintered", teeth: "24T", warranty: "12 months" },
    compatibleMachines: [
      { brand: "John Deere", model: "S670", yearRange: "2012-2020" },
      { brand: "CLAAS", model: "Lexion 750", yearRange: "2015-2023" },
    ],
  },

  // ── 联合收割机：电气系统 (ELE) ──
  {
    machineTypeCode: "combine_harvester", subSystemCode: "electrical", componentGroupCode: "alternator",
    sku: "SD-COMBINE-ELE-001", nameZh: "Bosch 交流发电机", nameEn: "Bosch Alternator", nameRu: "Bosch Alternator",
    brand: "Bosch", oemNumber: "0124625023", price: 2800, stockStatus: "in_stock", isOEM: false,
    descriptionZh: "Bosch交流发电机，140A大电流输出，内置整流器。", descriptionEn: "Bosch alternator, 140A high current output, built-in rectifier.",
    specs: { type: "Claw Pole Alternator", voltage: "12V", current: "140A", regulator: "Built-in", pulley: "Single Groove", weight: "6 kg", warranty: "12 months" },
    compatibleMachines: [
      { brand: "John Deere", model: "S670", yearRange: "2012-2020" },
      { brand: "CLAAS", model: "Lexion 750", yearRange: "2015-2023" },
    ],
  },
  {
    machineTypeCode: "combine_harvester", subSystemCode: "electrical", componentGroupCode: "starter",
    sku: "SD-COMBINE-ELE-002", nameZh: "Bosch 起动机", nameEn: "Bosch Starter Motor", nameRu: "Bosch Starter Motor",
    brand: "Bosch", oemNumber: "0001125040", price: 2200, stockStatus: "in_stock", isOEM: false,
    descriptionZh: "Bosch电起动起动机，4.0kW大功率，适用于大排量柴油机。", descriptionEn: "Bosch electric starter motor, 4.0kW high power, for large displacement diesel.",
    specs: { type: "Direct Drive Starter", voltage: "12V", power: "4.0 kW", teeth: "11T", direction: "CW", weight: "8 kg", warranty: "12 months" },
    compatibleMachines: [
      { brand: "John Deere", model: "S670", yearRange: "2012-2020" },
      { brand: "CLAAS", model: "Lexion 770", yearRange: "2015-2023" },
    ],
  },
  {
    machineTypeCode: "combine_harvester", subSystemCode: "electrical", componentGroupCode: "ecu_controller",
    sku: "SD-COMBINE-ELE-003", nameZh: "约翰迪尔 收割机ECU控制器", nameEn: "John Deere Combine ECU Controller", nameRu: "John Deere Combine ECU Controller",
    brand: "John Deere", oemNumber: "AH259876", price: 8500, stockStatus: "in_stock", isOEM: true,
    descriptionZh: "约翰迪尔原厂收割机ECU控制器，控制割台和脱粒系统。", descriptionEn: "John Deere genuine combine ECU controller, controls header and threshing systems.",
    specs: { type: "ARM Cortex-A9", channels: "32 I/O", voltage: "12V", protocol: "CAN Bus J1939", memory: "256MB Flash", connector: "AMP 48-Pin", warranty: "12 months" },
    compatibleMachines: [
      { brand: "John Deere", model: "S670", yearRange: "2012-2020" },
      { brand: "John Deere", model: "S680", yearRange: "2012-2022" },
    ],
  },
  {
    machineTypeCode: "combine_harvester", subSystemCode: "electrical", componentGroupCode: "instrument_display",
    sku: "SD-COMBINE-ELE-004", nameZh: "风帆 仪表显示屏", nameEn: "Fengfan Instrument Display", nameRu: "Fengfan Instrument Display",
    brand: "风帆", oemNumber: "FS-DISP70", price: 1800, stockStatus: "in_stock", isOEM: false,
    descriptionZh: "风帆7寸液晶仪表显示屏，触控操作，CAN总线通信。", descriptionEn: "Fengfan 7-inch LCD instrument display, touch operation, CAN bus communication.",
    specs: { type: "TFT LCD Touch", size: "7 inch", resolution: "1024x600", voltage: "12V", protocol: "CAN Bus J1939", brightness: "500 nits", warranty: "12 months" },
    compatibleMachines: [
      { brand: "福田雷沃", model: "谷神GE80", yearRange: "2018-2024" },
      { brand: "John Deere", model: "S670", yearRange: "2012-2020" },
    ],
  },
  {
    machineTypeCode: "combine_harvester", subSystemCode: "electrical", componentGroupCode: "work_light",
    sku: "SD-COMBINE-ELE-005", nameZh: "Bosch 工作灯LED总成", nameEn: "Bosch LED Work Light Assembly", nameRu: "Bosch LED Work Light Assembly",
    brand: "Bosch", oemNumber: "0301-200", price: 380, stockStatus: "in_stock", isOEM: false,
    descriptionZh: "Bosch LED工作灯总成，防震防水，夜间作业照明。", descriptionEn: "Bosch LED work light assembly, shockproof and waterproof, for night operation lighting.",
    specs: { type: "LED Flood Beam", voltage: "12V", power: "30W", luminous: "3000 lm", beam: "60° Flood", waterproof: "IP67", warranty: "12 months" },
    compatibleMachines: [
      { brand: "John Deere", model: "S670", yearRange: "2012-2020" },
      { brand: "CLAAS", model: "Lexion 750", yearRange: "2015-2023" },
    ],
  },
  // ════════════════════════════════════════════════════
  // 青储机 (forage_harvester) — 40条
  // ════════════════════════════════════════════════════

  // ── 切割喂入系统 (CTF) ──
  {
    machineTypeCode: "forage_harvester", subSystemCode: "cutting_feeding", componentGroupCode: "feed_roll",
    sku: "SD-FORAGE-CTF-001", nameZh: "约翰迪尔 喂入辊总成", nameEn: "John Deere Feed Roll Assembly", nameRu: "John Deere Feed Roll Assembly",
    brand: "John Deere", oemNumber: "R185432", price: 8500, stockStatus: "in_stock", isOEM: true,
    descriptionZh: "约翰迪尔原厂喂入辊总成，带锯齿纹表面，适用于7000系列青储机。", descriptionEn: "John Deere genuine feed roll assembly, serrated surface, for 7000 series forage harvesters.",
    specs: { material: "Hardox 500 Steel", diameter: "200mm", width: "800mm", surface: "Serrated", drive: "Hydraulic Motor", bearing: "SKF Included", warranty: "12 months" },
    compatibleMachines: [
      { brand: "John Deere", model: "7180", yearRange: "2014-2022" },
      { brand: "John Deere", model: "7200", yearRange: "2015-2023" },
    ],
  },
  {
    machineTypeCode: "forage_harvester", subSystemCode: "cutting_feeding", componentGroupCode: "cutting_knife",
    sku: "SD-FORAGE-CTF-002", nameZh: "CLAAS 切割刀片(高碳钢)", nameEn: "CLAAS Cutting Knife (High-Carbon Steel)", nameRu: "CLAAS Cutting Knife (High-Carbon Steel)",
    brand: "CLAAS", oemNumber: "945123", price: 180, stockStatus: "in_stock", isOEM: true,
    descriptionZh: "CLAAS原厂切割刀片，高碳钢材质，适用于Jaguar系列青储机。", descriptionEn: "CLAAS genuine cutting knife, high-carbon steel, for Jaguar series forage harvesters.",
    specs: { material: "High-Carbon Steel C80", length: "120mm", width: "25mm", thickness: "3mm", hardness: "HRC 58", edge: "Double Bevel", warranty: "12 months" },
    compatibleMachines: [
      { brand: "CLAAS", model: "Jaguar 980", yearRange: "2015-2023" },
      { brand: "CLAAS", model: "Jaguar 960", yearRange: "2015-2023" },
    ],
  },
  {
    machineTypeCode: "forage_harvester", subSystemCode: "cutting_feeding", componentGroupCode: "feed_chain",
    sku: "SD-FORAGE-CTF-003", nameZh: "Gates 喂入辊链条", nameEn: "Gates Feed Roll Chain", nameRu: "Gates Feed Roll Chain",
    brand: "Gates", oemNumber: "560P280", price: 450, stockStatus: "in_stock", isOEM: false,
    descriptionZh: "Gates喂入辊传动链条，双排滚子链，耐磨损。", descriptionEn: "Gates feed roll drive chain, double strand roller chain, wear resistant.",
    specs: { type: "Double Strand Roller Chain", pitch: "19.05mm", length: "280 links", tensile: "35 kN", material: "Alloy Steel", surface: "Nickel Plated", warranty: "12 months" },
    compatibleMachines: [
      { brand: "John Deere", model: "7200", yearRange: "2015-2023" },
      { brand: "CLAAS", model: "Jaguar 960", yearRange: "2015-2023" },
    ],
  },
  {
    machineTypeCode: "forage_harvester", subSystemCode: "cutting_feeding", componentGroupCode: "feed_bearing",
    sku: "SD-FORAGE-CTF-004", nameZh: "SKF 压紧辊轴承单元", nameEn: "SKF Feed Roll Bearing Unit", nameRu: "SKF Feed Roll Bearing Unit",
    brand: "SKF", oemNumber: "SY510", price: 420, stockStatus: "in_stock", isOEM: false,
    descriptionZh: "SKF压紧辊轴承单元，铸铁座，重型设计。", descriptionEn: "SKF feed roll bearing unit, cast iron housing, heavy duty design.",
    specs: { type: "Insert Bearing Unit", innerDiameter: "50mm", housing: "Pillow Block", seal: "Triple Lip", loadRating: "Dynamic 42kN", material: "Bearing Steel", warranty: "12 months" },
    compatibleMachines: [
      { brand: "John Deere", model: "7200", yearRange: "2015-2023" },
      { brand: "CLAAS", model: "Jaguar 980", yearRange: "2015-2023" },
    ],
  },
  {
    machineTypeCode: "forage_harvester", subSystemCode: "cutting_feeding", componentGroupCode: "metal_detector",
    sku: "SD-FORAGE-CTF-005", nameZh: "Bosch 金属探测器传感器", nameEn: "Bosch Metal Detector Sensor", nameRu: "Bosch Metal Detector Sensor",
    brand: "Bosch", oemNumber: "0281002912", price: 2800, stockStatus: "in_stock", isOEM: false,
    descriptionZh: "Bosch金属探测器传感器，电感式，防止金属异物进入切碎系统。", descriptionEn: "Bosch metal detector sensor, inductive type, prevents metal debris from entering chopping system.",
    specs: { type: "Inductive Proximity", sensingRange: "40mm", voltage: "12V DC", output: "PNK NC/NO", frequency: "200 Hz", protection: "IP67", warranty: "12 months" },
    compatibleMachines: [
      { brand: "John Deere", model: "7200", yearRange: "2015-2023" },
      { brand: "CLAAS", model: "Jaguar 960", yearRange: "2015-2023" },
    ],
  },
  {
    machineTypeCode: "forage_harvester", subSystemCode: "cutting_feeding", componentGroupCode: "feed_gearbox",
    sku: "SD-FORAGE-CTF-006", nameZh: "福田雷沃 喂入传动齿轮箱", nameEn: "Foton Lovol Feed Drive Gearbox", nameRu: "Foton Lovol Feed Drive Gearbox",
    brand: "福田雷沃", oemNumber: "FSL9Q-02010", price: 6800, stockStatus: "in_stock", isOEM: true,
    descriptionZh: "福田雷沃原厂喂入传动齿轮箱，2档可调，含离合器。", descriptionEn: "Foton Lovol genuine feed drive gearbox, 2-speed adjustable, with clutch.",
    specs: { type: "Constant Mesh 2-Speed", ratio: "1:2.5 / 1:4.0", material: "20CrMnTi", clutch: "Overload Protection", oilCapacity: "2.5L", weight: "32 kg", warranty: "12 months" },
    compatibleMachines: [
      { brand: "福田雷沃", model: "9QZ-2800", yearRange: "2019-2024" },
      { brand: "福田雷沃", model: "9QZ-2200", yearRange: "2019-2024" },
    ],
  },

  // ── 切碎系统 (CHP) ──
  {
    machineTypeCode: "forage_harvester", subSystemCode: "chopping", componentGroupCode: "chop_knife",
    sku: "SD-FORAGE-CHP-001", nameZh: "约翰迪尔 切碎滚筒刀片", nameEn: "John Deere Chopping Drum Knife", nameRu: "John Deere Chopping Drum Knife",
    brand: "John Deere", oemNumber: "R185567", price: 220, stockStatus: "in_stock", isOEM: true,
    descriptionZh: "约翰迪尔原厂切碎滚筒刀片，硬质合金刃口，可翻转使用。", descriptionEn: "John Deere genuine chopping drum knife, carbide edge, reversible.",
    specs: { material: "Tool Steel + Carbide Edge", length: "160mm", width: "40mm", thickness: "6mm", hardness: "HRC 62", edge: "Carbide Tipped", warranty: "12 months" },
    compatibleMachines: [
      { brand: "John Deere", model: "7200", yearRange: "2015-2023" },
      { brand: "John Deere", model: "7180", yearRange: "2014-2022" },
    ],
  },
  {
    machineTypeCode: "forage_harvester", subSystemCode: "chopping", componentGroupCode: "chop_drum",
    sku: "SD-FORAGE-CHP-002", nameZh: "CLAAS 切碎滚筒总成", nameEn: "CLAAS Chopping Drum Assembly", nameRu: "CLAAS Chopping Drum Assembly",
    brand: "CLAAS", oemNumber: "945345", price: 15000, stockStatus: "in_stock", isOEM: true,
    descriptionZh: "CLAAS原厂切碎滚筒总成，24刀片，适用于Jaguar系列。", descriptionEn: "CLAAS genuine chopping drum assembly, 24 knives, for Jaguar series.",
    specs: { diameter: "450mm", width: "850mm", knifeCount: "24", material: "Steel + Hardfaced", speed: "1200 rpm", balance: "G6.3", warranty: "12 months" },
    compatibleMachines: [
      { brand: "CLAAS", model: "Jaguar 980", yearRange: "2015-2023" },
      { brand: "CLAAS", model: "Jaguar 960", yearRange: "2015-2023" },
    ],
  },
  {
    machineTypeCode: "forage_harvester", subSystemCode: "chopping", componentGroupCode: "counter_knife",
    sku: "SD-FORAGE-CHP-003", nameZh: "Krone 定刀(耐磨合金)", nameEn: "Krone Counter Knife (Wear-Resistant Alloy)", nameRu: "Krone Counter Knife (Wear-Resistant Alloy)",
    brand: "Krone", oemNumber: "760-1234", price: 380, stockStatus: "in_stock", isOEM: true,
    descriptionZh: "Krone原厂定刀，耐磨合金钢，与切碎刀片配合使用。", descriptionEn: "Krone genuine counter knife, wear-resistant alloy steel, works with chopping knives.",
    specs: { material: "Hardox 600", length: "160mm", width: "30mm", thickness: "8mm", hardness: "HRC 58", edge: "Single Bevel", warranty: "12 months" },
    compatibleMachines: [
      { brand: "Krone", model: "BigX 780", yearRange: "2016-2024" },
      { brand: "Krone", model: "BigX 650", yearRange: "2016-2024" },
    ],
  },
  {
    machineTypeCode: "forage_harvester", subSystemCode: "chopping", componentGroupCode: "drum_bearing",
    sku: "SD-FORAGE-CHP-004", nameZh: "SKF 切碎滚筒轴承 22220E", nameEn: "SKF Chopping Drum Bearing 22220E", nameRu: "SKF Chopping Drum Bearing 22220E",
    brand: "SKF", oemNumber: "22220E", price: 680, stockStatus: "in_stock", isOEM: false,
    descriptionZh: "SKF调心滚子轴承，适用于切碎滚筒高速旋转工况。", descriptionEn: "SKF spherical roller bearing, for high-speed chopping drum applications.",
    specs: { type: "Spherical Roller", innerDiameter: "100mm", outerDiameter: "180mm", width: "46mm", cage: "Brass", clearance: "C3", loadRating: "Dynamic 360kN", warranty: "12 months" },
    compatibleMachines: [
      { brand: "CLAAS", model: "Jaguar 980", yearRange: "2015-2023" },
      { brand: "John Deere", model: "7200", yearRange: "2015-2023" },
    ],
  },
  {
    machineTypeCode: "forage_harvester", subSystemCode: "chopping", componentGroupCode: "knife_grinder",
    sku: "SD-FORAGE-CHP-005", nameZh: "牧羊 刀片磨刀器总成", nameEn: "Muyang Knife Grinder Assembly", nameRu: "Muyang Knife Grinder Assembly",
    brand: "牧羊", oemNumber: "MY-GRIND01", price: 3200, stockStatus: "in_stock", isOEM: true,
    descriptionZh: "牧羊自动磨刀器总成，砂轮式，可在线磨刀。", descriptionEn: "Muyang automatic knife grinder assembly, grinding wheel type, in-line sharpening.",
    specs: { type: "Grinding Wheel Auto", motor: "0.75 kW 12V", grindingWheel: "CBN 150mm", grit: "80#", feed: "Automatic", stroke: "200mm", warranty: "12 months" },
    compatibleMachines: [
      { brand: "CLAAS", model: "Jaguar 960", yearRange: "2015-2023" },
      { brand: "福田雷沃", model: "9QZ-2800", yearRange: "2019-2024" },
    ],
  },

  // ── 抛送系统 (BLW) ──
  {
    machineTypeCode: "forage_harvester", subSystemCode: "blower", componentGroupCode: "blower_fan",
    sku: "SD-FORAGE-BLW-001", nameZh: "约翰迪尔 抛送风机叶轮", nameEn: "John Deere Blower Fan Impeller", nameRu: "John Deere Blower Fan Impeller",
    brand: "John Deere", oemNumber: "R185678", price: 5500, stockStatus: "in_stock", isOEM: true,
    descriptionZh: "约翰迪尔原厂抛送风机叶轮，6叶片，高效率气流设计。", descriptionEn: "John Deere genuine blower fan impeller, 6 blades, high-efficiency airflow design.",
    specs: { material: "Hardox 450 Steel", bladeCount: "6", diameter: "800mm", hubBore: "60mm", speed: "1400 rpm", balance: "G6.3", warranty: "12 months" },
    compatibleMachines: [
      { brand: "John Deere", model: "7200", yearRange: "2015-2023" },
      { brand: "John Deere", model: "7180", yearRange: "2014-2022" },
    ],
  },
  {
    machineTypeCode: "forage_harvester", subSystemCode: "blower", componentGroupCode: "deflector_valve",
    sku: "SD-FORAGE-BLW-002", nameZh: "Eaton 抛送筒液压转向阀", nameEn: "Eaton Discharge Deflector Hydraulic Valve", nameRu: "Eaton Discharge Deflector Hydraulic Valve",
    brand: "Eaton", oemNumber: "WVS-2-16", price: 2200, stockStatus: "in_stock", isOEM: false,
    descriptionZh: "Eaton抛送筒液压转向阀，电液比例控制。", descriptionEn: "Eaton discharge deflector hydraulic valve, electro-hydraulic proportional control.",
    specs: { type: "Proportional Directional", portSize: "G3/4", pressure: "250 bar", flow: "60 L/min", voltage: "12V DC", signal: "PWM", warranty: "12 months" },
    compatibleMachines: [
      { brand: "John Deere", model: "7200", yearRange: "2015-2023" },
      { brand: "CLAAS", model: "Jaguar 980", yearRange: "2015-2023" },
    ],
  },
  {
    machineTypeCode: "forage_harvester", subSystemCode: "blower", componentGroupCode: "fan_bearing",
    sku: "SD-FORAGE-BLW-003", nameZh: "SKF 风机轴承单元 UCP210", nameEn: "SKF Fan Bearing Unit UCP210", nameRu: "SKF Fan Bearing Unit UCP210",
    brand: "SKF", oemNumber: "UCP210", price: 280, stockStatus: "in_stock", isOEM: false,
    descriptionZh: "SKF风机轴承单元，立式座，适用于抛送风机轴。", descriptionEn: "SKF fan bearing unit, pillow block, for blower fan shaft.",
    specs: { type: "Insert Bearing Unit", innerDiameter: "50mm", housing: "Pillow Block", seal: "Dual Lip", loadRating: "Dynamic 35kN", setscrew: "2", warranty: "12 months" },
    compatibleMachines: [
      { brand: "John Deere", model: "7200", yearRange: "2015-2023" },
      { brand: "CLAAS", model: "Jaguar 960", yearRange: "2015-2023" },
    ],
  },
  {
    machineTypeCode: "forage_harvester", subSystemCode: "blower", componentGroupCode: "discharge_liner",
    sku: "SD-FORAGE-BLW-004", nameZh: "铁岭机械 抛送筒衬板(耐磨)", nameEn: "Tieling Machinery Discharge Liner (Wear-Resistant)", nameRu: "Tieling Machinery Discharge Liner (Wear-Resistant)",
    brand: "铁岭机械", oemNumber: "TL-BLP-01", price: 850, stockStatus: "in_stock", isOEM: false,
    descriptionZh: "铁岭机械抛送筒耐磨衬板，高分子聚乙烯材质。", descriptionEn: "Tieling Machinery discharge wear liner, UHMWPE material.",
    specs: { material: "UHMWPE Polyethylene", thickness: "10mm", width: "300mm", length: "800mm", hardness: "65 Shore D", temperature: "-40°C to 80°C", warranty: "12 months" },
    compatibleMachines: [
      { brand: "福田雷沃", model: "9QZ-2800", yearRange: "2019-2024" },
      { brand: "John Deere", model: "7200", yearRange: "2015-2023" },
    ],
  },

  // ── 青储机：动力系统 (PWR) ──
  {
    machineTypeCode: "forage_harvester", subSystemCode: "powertrain", componentGroupCode: "engine_assembly",
    sku: "SD-FORAGE-PWR-001", nameZh: "约翰迪尔 9.0L 柴油发动机总成", nameEn: "John Deere 9.0L Diesel Engine Assembly", nameRu: "John Deere 9.0L Diesel Engine Assembly",
    brand: "John Deere", oemNumber: "RE293928", price: 120000, stockStatus: "in_stock", isOEM: true,
    descriptionZh: "约翰迪尔PowerTech 9.0L柴油发动机总成，适用于7000系列青储机。", descriptionEn: "John Deere PowerTech 9.0L diesel engine assembly for 7000 series forage harvesters.",
    specs: { displacement: "9.0L", cylinders: "6", power: "313 kW (420 HP)", cooling: "Liquid Cooled", fuelSystem: "Electronic Unit Injection", weight: "850 kg", warranty: "12 months" },
    compatibleMachines: [
      { brand: "John Deere", model: "7200", yearRange: "2015-2023" },
      { brand: "John Deere", model: "7180", yearRange: "2014-2022" },
    ],
  },
  {
    machineTypeCode: "forage_harvester", subSystemCode: "powertrain", componentGroupCode: "turbocharger",
    sku: "SD-FORAGE-PWR-002", nameZh: "Bosch 涡轮增压器", nameEn: "Bosch Turbocharger", nameRu: "Bosch Turbocharger",
    brand: "Bosch", oemNumber: "0281002500", price: 9500, stockStatus: "in_stock", isOEM: false,
    descriptionZh: "Bosch大流量涡轮增压器，适用于9L以上柴油机。", descriptionEn: "Bosch high-flow turbocharger, for 9L+ diesel engines.",
    specs: { type: "Wastegate Turbo", maxBoost: "2.8 bar", compressor: "Aluminum", turbine: "Inconel 713C", bearing: "Journal Bearing", oilCooled: "Yes", warranty: "12 months" },
    compatibleMachines: [
      { brand: "John Deere", model: "7200", yearRange: "2015-2023" },
      { brand: "CLAAS", model: "Jaguar 980", yearRange: "2015-2023" },
    ],
  },
  {
    machineTypeCode: "forage_harvester", subSystemCode: "powertrain", componentGroupCode: "fuel_pump",
    sku: "SD-FORAGE-PWR-003", nameZh: "潍柴 高压共轨泵", nameEn: "Weichai High Pressure Common Rail Pump", nameRu: "Weichai High Pressure Common Rail Pump",
    brand: "潍柴", oemNumber: "WP12-22100", price: 8500, stockStatus: "in_stock", isOEM: false,
    descriptionZh: "潍柴高压共轨油泵，适用于大功率柴油机。", descriptionEn: "Weichai high pressure common rail pump, for high-power diesel engines.",
    specs: { type: "Common Rail HP Pump", maxPressure: "2200 bar", cylinders: "6", fuelFeed: "600 L/h", drive: "Gear Drive", material: "Aluminum + Steel", warranty: "12 months" },
    compatibleMachines: [
      { brand: "John Deere", model: "7200", yearRange: "2015-2023" },
      { brand: "福田雷沃", model: "9QZ-2800", yearRange: "2019-2024" },
    ],
  },
  {
    machineTypeCode: "forage_harvester", subSystemCode: "powertrain", componentGroupCode: "injector",
    sku: "SD-FORAGE-PWR-004", nameZh: "Bosch 喷油器", nameEn: "Bosch Injector", nameRu: "Bosch Injector",
    brand: "Bosch", oemNumber: "0445120188", price: 3200, stockStatus: "in_stock", isOEM: false,
    descriptionZh: "Bosch共轨电控喷油器，高响应速度，精密雾化。", descriptionEn: "Bosch common rail electronic injector, high response, precise atomization.",
    specs: { type: "Piezo Common Rail", nozzle: "8-Hole", sprayAngle: "148°", openingPressure: "280 bar", voltage: "12V", responseTime: "0.1ms", warranty: "12 months" },
    compatibleMachines: [
      { brand: "John Deere", model: "7200", yearRange: "2015-2023" },
      { brand: "CLAAS", model: "Jaguar 960", yearRange: "2015-2023" },
    ],
  },
  {
    machineTypeCode: "forage_harvester", subSystemCode: "powertrain", componentGroupCode: "oil_filter",
    sku: "SD-FORAGE-PWR-005", nameZh: "Donaldson 机油滤芯", nameEn: "Donaldson Oil Filter", nameRu: "Donaldson Oil Filter",
    brand: "Donaldson", oemNumber: "P551410", price: 220, stockStatus: "in_stock", isOEM: false,
    descriptionZh: "Donaldson大容量机油滤芯，旋装式，适用于大排量发动机。", descriptionEn: "Donaldson high-capacity oil filter, spin-on type, for large displacement engines.",
    specs: { type: "Spin-On Full Flow", filterMedia: "Synthetic Blend", micron: "15 micron", bypass: "1.8 bar", threadSize: "M27x2", capacity: "1.8L", warranty: "N/A" },
    compatibleMachines: [
      { brand: "John Deere", model: "7200", yearRange: "2015-2023" },
      { brand: "CLAAS", model: "Jaguar 980", yearRange: "2015-2023" },
    ],
  },
  {
    machineTypeCode: "forage_harvester", subSystemCode: "powertrain", componentGroupCode: "air_filter",
    sku: "SD-FORAGE-PWR-006", nameZh: "Donaldson 空气滤芯", nameEn: "Donaldson Air Filter", nameRu: "Donaldson Air Filter",
    brand: "Donaldson", oemNumber: "P181088", price: 520, stockStatus: "in_stock", isOEM: false,
    descriptionZh: "Donaldson大流量空气滤芯，圆筒式，带预分离器。", descriptionEn: "Donaldson high-flow air filter, cylindrical, with pre-cleaner.",
    specs: { type: "Cylindrical + Safety", filterMedia: "Cellulose + Nanofiber", efficiency: "99.9%", outerDiameter: "380mm", height: "520mm", preCleaner: "Included", warranty: "N/A" },
    compatibleMachines: [
      { brand: "John Deere", model: "7200", yearRange: "2015-2023" },
      { brand: "CLAAS", model: "Jaguar 960", yearRange: "2015-2023" },
    ],
  },

  // ── 青储机：传动系统 (TRN) ──
  {
    machineTypeCode: "forage_harvester", subSystemCode: "transmission", componentGroupCode: "hydrostatic_pump",
    sku: "SD-FORAGE-TRN-001", nameZh: "Danfoss 静液压驱动泵", nameEn: "Danfoss Hydrostatic Drive Pump", nameRu: "Danfoss Hydrostatic Drive Pump",
    brand: "Danfoss", oemNumber: "151B-0805", price: 32000, stockStatus: "in_stock", isOEM: false,
    descriptionZh: "Danfoss大排量静液压驱动泵，适用于重型青储机。", descriptionEn: "Danfoss large displacement hydrostatic drive pump, for heavy-duty forage harvesters.",
    specs: { type: "Variable Axial Piston", displacement: "80 cc/rev", maxPressure: "450 bar", speed: "2200 rpm", port: "SAE 6000 PSI", control: "Electric Proportional", warranty: "12 months" },
    compatibleMachines: [
      { brand: "John Deere", model: "7200", yearRange: "2015-2023" },
      { brand: "CLAAS", model: "Jaguar 980", yearRange: "2015-2023" },
    ],
  },
  {
    machineTypeCode: "forage_harvester", subSystemCode: "transmission", componentGroupCode: "hydraulic_motor",
    sku: "SD-FORAGE-TRN-002", nameZh: "Eaton 驱动马达", nameEn: "Eaton Drive Motor", nameRu: "Eaton Drive Motor",
    brand: "Eaton", oemNumber: "6423-431", price: 25000, stockStatus: "low_stock", isOEM: false,
    descriptionZh: "Eaton大排量液压驱动马达，带驻车制动器。", descriptionEn: "Eaton large displacement hydraulic drive motor, with parking brake.",
    specs: { type: "Fixed Axial Piston", displacement: "75 cc/rev", maxPressure: "420 bar", speed: "2800 rpm", brake: "Multi-Disc Wet", port: "SAE 6000 PSI", warranty: "12 months" },
    compatibleMachines: [
      { brand: "John Deere", model: "7200", yearRange: "2015-2023" },
      { brand: "CLAAS", model: "Jaguar 960", yearRange: "2015-2023" },
    ],
  },
  {
    machineTypeCode: "forage_harvester", subSystemCode: "transmission", componentGroupCode: "drive_belt",
    sku: "SD-FORAGE-TRN-003", nameZh: "Gates 传动V带", nameEn: "Gates Drive V-Belt", nameRu: "Gates Drive V-Belt",
    brand: "Gates", oemNumber: "864P300", price: 380, stockStatus: "in_stock", isOEM: false,
    descriptionZh: "Gates多楔传动V带，高强度，适用于大功率传动。", descriptionEn: "Gates multi-rib drive V-belt, high strength, for high-power transmission.",
    specs: { type: "Banded Multi-Rib", section: "8K", length: "3000mm", cord: "Aramid", temperature: "-35°C to 90°C", standard: "ISO 9982", warranty: "12 months" },
    compatibleMachines: [
      { brand: "John Deere", model: "7200", yearRange: "2015-2023" },
      { brand: "CLAAS", model: "Jaguar 980", yearRange: "2015-2023" },
    ],
  },
  {
    machineTypeCode: "forage_harvester", subSystemCode: "transmission", componentGroupCode: "universal_joint",
    sku: "SD-FORAGE-TRN-004", nameZh: "洛阳轴承 万向节传动轴", nameEn: "LYC Universal Joint Drive Shaft", nameRu: "LYC Universal Joint Drive Shaft",
    brand: "洛阳轴承", oemNumber: "LYC-GU1200", price: 1200, stockStatus: "in_stock", isOEM: false,
    descriptionZh: "洛阳轴承万向节传动轴，十字轴式，伸缩功能。", descriptionEn: "LYC universal joint drive shaft, cross type, telescoping function.",
    specs: { type: "Telescoping Cross Joint", outerDiameter: "120mm", shaftDiameter: "35mm", material: "20Cr", bearing: "Needle Roller", angle: "35°", warranty: "12 months" },
    compatibleMachines: [
      { brand: "John Deere", model: "7200", yearRange: "2015-2023" },
      { brand: "福田雷沃", model: "9QZ-2800", yearRange: "2019-2024" },
    ],
  },
  {
    machineTypeCode: "forage_harvester", subSystemCode: "transmission", componentGroupCode: "gearbox",
    sku: "SD-FORAGE-TRN-005", nameZh: "福田雷沃 齿轮箱总成", nameEn: "Foton Lovol Gearbox Assembly", nameRu: "Foton Lovol Gearbox Assembly",
    brand: "福田雷沃", oemNumber: "FSL9Q-10030", price: 9500, stockStatus: "in_stock", isOEM: true,
    descriptionZh: "福田雷沃原厂齿轮箱总成，3档变速，含差速器。", descriptionEn: "Foton Lovol genuine gearbox assembly, 3-speed, with differential.",
    specs: { type: "Constant Mesh 3-Speed", ratio: "1:4.5 / 1:2.2 / 1:1", material: "20CrMnTi", oilCapacity: "4.0L", bearing: "SKF", weight: "52 kg", warranty: "12 months" },
    compatibleMachines: [
      { brand: "福田雷沃", model: "9QZ-2800", yearRange: "2019-2024" },
      { brand: "福田雷沃", model: "9QZ-2200", yearRange: "2019-2024" },
    ],
  },

  // ── 青储机：液压系统 (HYD) ──
  {
    machineTypeCode: "forage_harvester", subSystemCode: "hydraulic", componentGroupCode: "hydraulic_pump",
    sku: "SD-FORAGE-HYD-001", nameZh: "Parker 液压主泵", nameEn: "Parker Hydraulic Main Pump", nameRu: "Parker Hydraulic Main Pump",
    brand: "Parker", oemNumber: "PV180", price: 18000, stockStatus: "in_stock", isOEM: false,
    descriptionZh: "Parker液压主泵，变量柱塞式，高压大流量。", descriptionEn: "Parker hydraulic main pump, variable piston, high pressure large flow.",
    specs: { type: "Variable Axial Piston", displacement: "180 cc/rev", maxPressure: "350 bar", speed: "2200 rpm", port: "SAE 6000 PSI", control: "Hydraulic Proportional", warranty: "12 months" },
    compatibleMachines: [
      { brand: "John Deere", model: "7200", yearRange: "2015-2023" },
      { brand: "CLAAS", model: "Jaguar 980", yearRange: "2015-2023" },
    ],
  },
  {
    machineTypeCode: "forage_harvester", subSystemCode: "hydraulic", componentGroupCode: "hydraulic_cylinder",
    sku: "SD-FORAGE-HYD-002", nameZh: "Parker 液压油缸", nameEn: "Parker Hydraulic Cylinder", nameRu: "Parker Hydraulic Cylinder",
    brand: "Parker", oemNumber: "HLC-C80-600", price: 3500, stockStatus: "in_stock", isOEM: false,
    descriptionZh: "Parker液压油缸，双作用式，大行程，适用于切割高度调节。", descriptionEn: "Parker hydraulic cylinder, double-acting, long stroke, for cutting height adjustment.",
    specs: { bore: "80mm", stroke: "600mm", rodDiameter: "40mm", type: "Double Acting", pressure: "250 bar", seal: "NBR Polyurethane", warranty: "12 months" },
    compatibleMachines: [
      { brand: "John Deere", model: "7200", yearRange: "2015-2023" },
      { brand: "CLAAS", model: "Jaguar 960", yearRange: "2015-2023" },
    ],
  },
  {
    machineTypeCode: "forage_harvester", subSystemCode: "hydraulic", componentGroupCode: "hydraulic_valve",
    sku: "SD-FORAGE-HYD-003", nameZh: "Danfoss 液压多路阀", nameEn: "Danfoss Hydraulic Multi-Valve", nameRu: "Danfoss Hydraulic Multi-Valve",
    brand: "Danfoss", oemNumber: "PVG32", price: 12000, stockStatus: "in_stock", isOEM: false,
    descriptionZh: "Danfoss PVG32液压多路阀，比例电控，4联阀组。", descriptionEn: "Danfoss PVG32 hydraulic multi-valve, proportional electric control, 4-section valve bank.",
    specs: { type: "Proportional Directional", sections: "4", maxPressure: "350 bar", flow: "100 L/min", voltage: "12V DC", signal: "PWM", warranty: "12 months" },
    compatibleMachines: [
      { brand: "John Deere", model: "7200", yearRange: "2015-2023" },
      { brand: "CLAAS", model: "Jaguar 980", yearRange: "2015-2023" },
    ],
  },
  {
    machineTypeCode: "forage_harvester", subSystemCode: "hydraulic", componentGroupCode: "return_filter",
    sku: "SD-FORAGE-HYD-004", nameZh: "Donaldson 液压回油滤芯", nameEn: "Donaldson Hydraulic Return Filter", nameRu: "Donaldson Hydraulic Return Filter",
    brand: "Donaldson", oemNumber: "P578456", price: 280, stockStatus: "in_stock", isOEM: false,
    descriptionZh: "Donaldson液压回油滤芯，玻璃纤维材质，高效过滤。", descriptionEn: "Donaldson hydraulic return filter, fiberglass media, high efficiency.",
    specs: { type: "Spin-On Return", filterMedia: "Fiberglass", micron: "10 micron", bypass: "2.5 bar", threadSize: "M27x2", height: "220mm", warranty: "N/A" },
    compatibleMachines: [
      { brand: "John Deere", model: "7200", yearRange: "2015-2023" },
      { brand: "CLAAS", model: "Jaguar 960", yearRange: "2015-2023" },
    ],
  },
  {
    machineTypeCode: "forage_harvester", subSystemCode: "hydraulic", componentGroupCode: "seal_kit",
    sku: "SD-FORAGE-HYD-005", nameZh: "洛阳轴承 液压油封套件", nameEn: "LYC Hydraulic Seal Kit", nameRu: "LYC Hydraulic Seal Kit",
    brand: "洛阳轴承", oemNumber: "LYC-SK50", price: 180, stockStatus: "in_stock", isOEM: false,
    descriptionZh: "洛阳轴承液压油缸密封套件，含活塞密封和活塞杆密封。", descriptionEn: "LYC hydraulic cylinder seal kit, includes piston seal and rod seal.",
    specs: { material: "NBR + PTFE", boreSize: "50mm", rodSize: "25mm", components: "Piston Seal + Rod Seal + Wiper", temperature: "-30°C to 110°C", pressure: "250 bar", warranty: "12 months" },
    compatibleMachines: [
      { brand: "John Deere", model: "7200", yearRange: "2015-2023" },
      { brand: "福田雷沃", model: "9QZ-2800", yearRange: "2019-2024" },
    ],
  },

  // ── 青储机：行走系统 (CHS) ──
  {
    machineTypeCode: "forage_harvester", subSystemCode: "chassis", componentGroupCode: "front_axle",
    sku: "SD-FORAGE-CHS-001", nameZh: "约翰迪尔 前驱动桥总成", nameEn: "John Deere Front Drive Axle Assembly", nameRu: "John Deere Front Drive Axle Assembly",
    brand: "John Deere", oemNumber: "R186234", price: 32000, stockStatus: "in_stock", isOEM: true,
    descriptionZh: "约翰迪尔原厂前驱动桥总成，重型设计，含差速器。", descriptionEn: "John Deere genuine front drive axle assembly, heavy duty, with differential.",
    specs: { type: "Drive Axle with Differential", loadCapacity: "15 ton", ratio: "1:6.2", brake: "Multi-Disc Wet", material: "Cast Steel", weight: "350 kg", warranty: "12 months" },
    compatibleMachines: [
      { brand: "John Deere", model: "7200", yearRange: "2015-2023" },
      { brand: "John Deere", model: "7180", yearRange: "2014-2022" },
    ],
  },
  {
    machineTypeCode: "forage_harvester", subSystemCode: "chassis", componentGroupCode: "rear_axle",
    sku: "SD-FORAGE-CHS-002", nameZh: "CLAAS 后转向桥", nameEn: "CLAAS Rear Steer Axle", nameRu: "CLAAS Rear Steer Axle",
    brand: "CLAAS", oemNumber: "945678", price: 22000, stockStatus: "low_stock", isOEM: true,
    descriptionZh: "CLAAS原厂后转向桥，四轮转向设计。", descriptionEn: "CLAAS genuine rear steer axle, four-wheel steering design.",
    specs: { type: "Steer Axle", loadCapacity: "10 ton", steeringAngle: "50°", brake: "Disc", material: "Cast Steel", weight: "220 kg", warranty: "12 months" },
    compatibleMachines: [
      { brand: "CLAAS", model: "Jaguar 980", yearRange: "2015-2023" },
      { brand: "CLAAS", model: "Jaguar 960", yearRange: "2015-2023" },
    ],
  },
  {
    machineTypeCode: "forage_harvester", subSystemCode: "chassis", componentGroupCode: "drive_tire",
    sku: "SD-FORAGE-CHS-003", nameZh: "福田雷沃 驱动轮胎 710/70R38", nameEn: "Foton Lovol Drive Tire 710/70R38", nameRu: "Foton Lovol Drive Tire 710/70R38",
    brand: "福田雷沃", oemNumber: "FSL9Q-T710", price: 6800, stockStatus: "in_stock", isOEM: true,
    descriptionZh: "福田雷沃原厂驱动轮胎，子午线结构，高承载。", descriptionEn: "Foton Lovol genuine drive tire, radial construction, high load capacity.",
    specs: { type: "Radial Agricultural", size: "710/70R38", pattern: "R-1W Lug", loadIndex: "172D", ply: "12", pressure: "1.6 bar", weight: "200 kg", warranty: "12 months" },
    compatibleMachines: [
      { brand: "福田雷沃", model: "9QZ-2800", yearRange: "2019-2024" },
      { brand: "John Deere", model: "7200", yearRange: "2015-2023" },
    ],
  },
  {
    machineTypeCode: "forage_harvester", subSystemCode: "chassis", componentGroupCode: "steer_tire",
    sku: "SD-FORAGE-CHS-004", nameZh: "铁岭机械 转向轮胎 16.9-24", nameEn: "Tieling Machinery Steer Tire 16.9-24", nameRu: "Tieling Machinery Steer Tire 16.9-24",
    brand: "铁岭机械", oemNumber: "TL-T169", price: 3200, stockStatus: "in_stock", isOEM: false,
    descriptionZh: "铁岭机械转向轮胎，斜交结构，适用于青储机后桥。", descriptionEn: "Tieling Machinery steer tire, bias construction, for forage harvester rear axle.",
    specs: { type: "Bias Agricultural", size: "16.9-24", pattern: "R-3", loadIndex: "135A8", ply: "8", pressure: "2.0 bar", weight: "75 kg", warranty: "12 months" },
    compatibleMachines: [
      { brand: "福田雷沃", model: "9QZ-2800", yearRange: "2019-2024" },
      { brand: "John Deere", model: "7200", yearRange: "2015-2023" },
    ],
  },
  {
    machineTypeCode: "forage_harvester", subSystemCode: "chassis", componentGroupCode: "brake_system",
    sku: "SD-FORAGE-CHS-005", nameZh: "Eaton 制动摩擦片组", nameEn: "Eaton Brake Friction Plate Set", nameRu: "Eaton Brake Friction Plate Set",
    brand: "Eaton", oemNumber: "BK-300", price: 520, stockStatus: "in_stock", isOEM: false,
    descriptionZh: "Eaton制动摩擦片组，湿式多片式，重型制动。", descriptionEn: "Eaton brake friction plate set, wet multi-disc, heavy duty braking.",
    specs: { type: "Wet Multi-Disc", outerDiameter: "300mm", innerDiameter: "200mm", thickness: "6mm", material: "Copper-Based Sintered", teeth: "28T", warranty: "12 months" },
    compatibleMachines: [
      { brand: "John Deere", model: "7200", yearRange: "2015-2023" },
      { brand: "CLAAS", model: "Jaguar 980", yearRange: "2015-2023" },
    ],
  },

  // ── 青储机：电气系统 (ELE) ──
  {
    machineTypeCode: "forage_harvester", subSystemCode: "electrical", componentGroupCode: "alternator",
    sku: "SD-FORAGE-ELE-001", nameZh: "Bosch 交流发电机", nameEn: "Bosch Alternator", nameRu: "Bosch Alternator",
    brand: "Bosch", oemNumber: "0124625035", price: 3200, stockStatus: "in_stock", isOEM: false,
    descriptionZh: "Bosch大功率交流发电机，190A输出，适用于青储机。", descriptionEn: "Bosch high-power alternator, 190A output, for forage harvesters.",
    specs: { type: "Claw Pole Alternator", voltage: "12V", current: "190A", regulator: "Built-in", pulley: "Double Groove", weight: "7.5 kg", warranty: "12 months" },
    compatibleMachines: [
      { brand: "John Deere", model: "7200", yearRange: "2015-2023" },
      { brand: "CLAAS", model: "Jaguar 980", yearRange: "2015-2023" },
    ],
  },
  {
    machineTypeCode: "forage_harvester", subSystemCode: "electrical", componentGroupCode: "starter",
    sku: "SD-FORAGE-ELE-002", nameZh: "Bosch 起动机", nameEn: "Bosch Starter Motor", nameRu: "Bosch Starter Motor",
    brand: "Bosch", oemNumber: "0001125052", price: 2500, stockStatus: "in_stock", isOEM: false,
    descriptionZh: "Bosch大功率起动机，5.0kW，适用于9L以上发动机。", descriptionEn: "Bosch high-power starter motor, 5.0kW, for 9L+ engines.",
    specs: { type: "Gear Reduction Starter", voltage: "12V", power: "5.0 kW", teeth: "12T", direction: "CW", weight: "10 kg", warranty: "12 months" },
    compatibleMachines: [
      { brand: "John Deere", model: "7200", yearRange: "2015-2023" },
      { brand: "CLAAS", model: "Jaguar 960", yearRange: "2015-2023" },
    ],
  },
  {
    machineTypeCode: "forage_harvester", subSystemCode: "electrical", componentGroupCode: "ecu_controller",
    sku: "SD-FORAGE-ELE-003", nameZh: "约翰迪尔 青储机ECU", nameEn: "John Deere Forage Harvester ECU", nameRu: "John Deere Forage Harvester ECU",
    brand: "John Deere", oemNumber: "R186345", price: 9500, stockStatus: "in_stock", isOEM: true,
    descriptionZh: "约翰迪尔原厂青储机ECU控制器，控制切割长度和喂入速度。", descriptionEn: "John Deere genuine forage harvester ECU controller, controls cut length and feed speed.",
    specs: { type: "ARM Cortex-A9", channels: "48 I/O", voltage: "12V", protocol: "CAN Bus ISOBUS", memory: "512MB Flash", connector: "AMP 64-Pin", warranty: "12 months" },
    compatibleMachines: [
      { brand: "John Deere", model: "7200", yearRange: "2015-2023" },
      { brand: "John Deere", model: "7180", yearRange: "2014-2022" },
    ],
  },
  {
    machineTypeCode: "forage_harvester", subSystemCode: "electrical", componentGroupCode: "battery",
    sku: "SD-FORAGE-ELE-004", nameZh: "风帆 蓄电池 12V180Ah", nameEn: "Fengfan Battery 12V180Ah", nameRu: "Fengfan Battery 12V180Ah",
    brand: "风帆", oemNumber: "FS-12N180", price: 1200, stockStatus: "in_stock", isOEM: false,
    descriptionZh: "风帆大容量蓄电池，12V180Ah，适用于青储机起动。", descriptionEn: "Fengfan high-capacity battery, 12V180Ah, for forage harvester starting.",
    specs: { type: "Lead-Acid Maintenance Free", voltage: "12V", capacity: "180Ah", cca: "1000A", dimensions: "513x223x223mm", weight: "45 kg", warranty: "18 months" },
    compatibleMachines: [
      { brand: "John Deere", model: "7200", yearRange: "2015-2023" },
      { brand: "福田雷沃", model: "9QZ-2800", yearRange: "2019-2024" },
    ],
  },

  // ════════════════════════════════════════════════════
  // 打捆机 (baler) — 32条
  // ════════════════════════════════════════════════════

  // ── 捡拾系统 (PKP) ──
  {
    machineTypeCode: "baler", subSystemCode: "pickup_system", componentGroupCode: "pickup_tine",
    sku: "SD-BALER-PKP-001", nameZh: "约翰迪尔 捡拾弹齿", nameEn: "John Deere Pickup Tine", nameRu: "John Deere Pickup Tine",
    brand: "John Deere", oemNumber: "AH220945", price: 120, stockStatus: "in_stock", isOEM: true,
    descriptionZh: "约翰迪尔原厂捡拾弹齿，弹簧钢材质，适用于457/467方捆机。", descriptionEn: "John Deere genuine pickup tine, spring steel, for 457/467 small square balers.",
    specs: { material: "Spring Steel 65Mn", tineLength: "180mm", diameter: "5mm", surface: "Galvanized", quantity: "50 pcs/box", warranty: "12 months" },
    compatibleMachines: [
      { brand: "John Deere", model: "457", yearRange: "2010-2020" },
      { brand: "John Deere", model: "467", yearRange: "2010-2020" },
    ],
  },
  {
    machineTypeCode: "baler", subSystemCode: "pickup_system", componentGroupCode: "pickup_reel",
    sku: "SD-BALER-PKP-002", nameZh: "CLAAS 捡拾滚筒总成", nameEn: "CLAAS Pickup Reel Assembly", nameRu: "CLAAS Pickup Reel Assembly",
    brand: "CLAAS", oemNumber: "946012", price: 6500, stockStatus: "in_stock", isOEM: true,
    descriptionZh: "CLAAS原厂捡拾滚筒总成，含弹齿和轴承，适用于Markant系列。", descriptionEn: "CLAAS genuine pickup reel assembly, with tines and bearings, for Markant series.",
    specs: { diameter: "350mm", width: "1650mm", tineCount: "120", material: "Steel + Spring Steel", bearing: "SKF Included", warranty: "12 months" },
    compatibleMachines: [
      { brand: "CLAAS", model: "Markant 65", yearRange: "2012-2022" },
      { brand: "CLAAS", model: "Quadrant 2200", yearRange: "2015-2023" },
    ],
  },
  {
    machineTypeCode: "baler", subSystemCode: "pickup_system", componentGroupCode: "pickup_belt",
    sku: "SD-BALER-PKP-003", nameZh: "Gates 捡拾传动V带", nameEn: "Gates Pickup Drive V-Belt", nameRu: "Gates Pickup Drive V-Belt",
    brand: "Gates", oemNumber: "864P220", price: 280, stockStatus: "in_stock", isOEM: false,
    descriptionZh: "Gates捡拾传动V带，B型带，抗拉伸设计。", descriptionEn: "Gates pickup drive V-belt, B section, anti-stretch design.",
    specs: { type: "Classical V-Belt", section: "B", length: "2200mm", cord: "Polyester", temperature: "-35°C to 90°C", standard: "ISO 4184", warranty: "12 months" },
    compatibleMachines: [
      { brand: "John Deere", model: "457", yearRange: "2010-2020" },
      { brand: "CLAAS", model: "Markant 65", yearRange: "2012-2022" },
    ],
  },
  {
    machineTypeCode: "baler", subSystemCode: "pickup_system", componentGroupCode: "tine_bar",
    sku: "SD-BALER-PKP-004", nameZh: "福田雷沃 弹齿固定板", nameEn: "Foton Lovol Tine Bar", nameRu: "Foton Lovol Tine Bar",
    brand: "福田雷沃", oemNumber: "FSL9YF-03010", price: 180, stockStatus: "in_stock", isOEM: true,
    descriptionZh: "福田雷沃原厂弹齿固定板，铝合金材质，适用于9YF系列方捆机。", descriptionEn: "Foton Lovol genuine tine bar, aluminum alloy, for 9YF series balers.",
    specs: { material: "Aluminum Alloy 6061", length: "1650mm", width: "40mm", thickness: "8mm", mountingHoles: "24", surface: "Anodized", warranty: "12 months" },
    compatibleMachines: [
      { brand: "福田雷沃", model: "9YF-110", yearRange: "2018-2024" },
      { brand: "福田雷沃", model: "9YF-80", yearRange: "2018-2024" },
    ],
  },
  {
    machineTypeCode: "baler", subSystemCode: "pickup_system", componentGroupCode: "pickup_bearing",
    sku: "SD-BALER-PKP-005", nameZh: "SKF 捡拾滚筒轴承单元", nameEn: "SKF Pickup Reel Bearing Unit", nameRu: "SKF Pickup Reel Bearing Unit",
    brand: "SKF", oemNumber: "SY506", price: 220, stockStatus: "in_stock", isOEM: false,
    descriptionZh: "SKF捡拾滚筒轴承单元，铸铁座，免维护设计。", descriptionEn: "SKF pickup reel bearing unit, cast iron housing, maintenance-free.",
    specs: { type: "Insert Bearing Unit", innerDiameter: "30mm", housing: "Pillow Block", seal: "Dual Lip", loadRating: "Dynamic 18kN", setscrew: "2", warranty: "12 months" },
    compatibleMachines: [
      { brand: "John Deere", model: "457", yearRange: "2010-2020" },
      { brand: "CLAAS", model: "Markant 65", yearRange: "2012-2022" },
    ],
  },

  // ── 成形系统 (BLC) ──
  {
    machineTypeCode: "baler", subSystemCode: "bale_chamber", componentGroupCode: "chamber_chain",
    sku: "SD-BALER-BLC-001", nameZh: "约翰迪尔 成形链条", nameEn: "John Deere Bale Chamber Chain", nameRu: "John Deere Bale Chamber Chain",
    brand: "John Deere", oemNumber: "AH220876", price: 1800, stockStatus: "in_stock", isOEM: true,
    descriptionZh: "约翰迪尔原厂成形链条，合金钢双排链，适用于方捆机压缩室。", descriptionEn: "John Deere genuine bale chamber chain, alloy steel double strand, for baler compression chamber.",
    specs: { type: "Double Strand Roller Chain", pitch: "19.05mm", length: "3200mm", material: "Alloy Steel", tensile: "30 kN", surface: "Black Oxide", warranty: "12 months" },
    compatibleMachines: [
      { brand: "John Deere", model: "457", yearRange: "2010-2020" },
      { brand: "John Deere", model: "467", yearRange: "2010-2020" },
    ],
  },
  {
    machineTypeCode: "baler", subSystemCode: "bale_chamber", componentGroupCode: "chamber_side_plate",
    sku: "SD-BALER-BLC-002", nameZh: "CLAAS 成形室侧板", nameEn: "CLAAS Bale Chamber Side Plate", nameRu: "CLAAS Bale Chamber Side Plate",
    brand: "CLAAS", oemNumber: "946234", price: 2200, stockStatus: "in_stock", isOEM: true,
    descriptionZh: "CLAAS原厂成形室侧板，耐磨钢板，高硬度。", descriptionEn: "CLAAS genuine bale chamber side plate, wear-resistant steel, high hardness.",
    specs: { material: "Hardox 400", thickness: "10mm", width: "800mm", height: "1200mm", hardness: "HBW 400", mounting: "Bolt-On", warranty: "12 months" },
    compatibleMachines: [
      { brand: "CLAAS", model: "Quadrant 2200", yearRange: "2015-2023" },
      { brand: "CLAAS", model: "Markant 65", yearRange: "2012-2022" },
    ],
  },
  {
    machineTypeCode: "baler", subSystemCode: "bale_chamber", componentGroupCode: "density_cylinder",
    sku: "SD-BALER-BLC-003", nameZh: "Parker 密度调节油缸", nameEn: "Parker Density Control Cylinder", nameRu: "Parker Density Control Cylinder",
    brand: "Parker", oemNumber: "HLC-D40-200", price: 2800, stockStatus: "in_stock", isOEM: false,
    descriptionZh: "Parker密度调节油缸，双作用式，控制草捆密度。", descriptionEn: "Parker density control cylinder, double-acting, controls bale density.",
    specs: { bore: "40mm", stroke: "200mm", rodDiameter: "20mm", type: "Double Acting", pressure: "200 bar", seal: "NBR + Polyurethane", warranty: "12 months" },
    compatibleMachines: [
      { brand: "John Deere", model: "467", yearRange: "2010-2020" },
      { brand: "CLAAS", model: "Quadrant 2200", yearRange: "2015-2023" },
    ],
  },
  {
    machineTypeCode: "baler", subSystemCode: "bale_chamber", componentGroupCode: "chamber_roller",
    sku: "SD-BALER-BLC-004", nameZh: "福田雷沃 成形滚筒", nameEn: "Foton Lovol Chamber Roller", nameRu: "Foton Lovol Chamber Roller",
    brand: "福田雷沃", oemNumber: "FSL9YF-04020", price: 850, stockStatus: "in_stock", isOEM: true,
    descriptionZh: "福田雷沃原厂成形滚筒，无缝钢管，表面淬火处理。", descriptionEn: "Foton Lovol genuine chamber roller, seamless steel tube, surface hardened.",
    specs: { material: "Q345 Seamless Steel", diameter: "120mm", width: "1650mm", surface: "Induction Hardened", hardness: "HRC 50", weight: "18 kg", warranty: "12 months" },
    compatibleMachines: [
      { brand: "福田雷沃", model: "9YF-110", yearRange: "2018-2024" },
      { brand: "福田雷沃", model: "9YF-80", yearRange: "2018-2024" },
    ],
  },
  {
    machineTypeCode: "baler", subSystemCode: "bale_chamber", componentGroupCode: "chain_tensioner",
    sku: "SD-BALER-BLC-005", nameZh: "铁岭机械 链条张紧器总成", nameEn: "Tieling Machinery Chain Tensioner Assembly", nameRu: "Tieling Machinery Chain Tensioner Assembly",
    brand: "铁岭机械", oemNumber: "TL-TEN-01", price: 320, stockStatus: "in_stock", isOEM: false,
    descriptionZh: "铁岭机械链条张紧器总成，弹簧式自动调节。", descriptionEn: "Tieling Machinery chain tensioner assembly, spring-loaded automatic adjustment.",
    specs: { type: "Spring Loaded Auto", stroke: "50mm", springForce: "200N", material: "Cast Iron + Spring Steel", pulleyDiameter: "60mm", adjustment: "Automatic", warranty: "12 months" },
    compatibleMachines: [
      { brand: "John Deere", model: "457", yearRange: "2010-2020" },
      { brand: "福田雷沃", model: "9YF-110", yearRange: "2018-2024" },
    ],
  },
  {
    machineTypeCode: "baler", subSystemCode: "bale_chamber", componentGroupCode: "roller_bearing",
    sku: "SD-BALER-BLC-006", nameZh: "SKF 成形滚筒轴承 6205-2RS", nameEn: "SKF Chamber Roller Bearing 6205-2RS", nameRu: "SKF Chamber Roller Bearing 6205-2RS",
    brand: "SKF", oemNumber: "6205-2RS1", price: 45, stockStatus: "in_stock", isOEM: false,
    descriptionZh: "SKF深沟球轴承，双面密封，适用于成形滚筒。", descriptionEn: "SKF deep groove ball bearing, double sealed, for chamber rollers.",
    specs: { type: "Deep Groove Ball", innerDiameter: "25mm", outerDiameter: "52mm", width: "15mm", seal: "2RS Double Rubber", clearance: "C3", loadRating: "Dynamic 14kN", warranty: "12 months" },
    compatibleMachines: [
      { brand: "John Deere", model: "457", yearRange: "2010-2020" },
      { brand: "CLAAS", model: "Markant 65", yearRange: "2012-2022" },
    ],
  },

  // ── 打结系统 (KNT) ──
  {
    machineTypeCode: "baler", subSystemCode: "knotting_system", componentGroupCode: "knotter_assembly",
    sku: "SD-BALER-KNT-001", nameZh: "约翰迪尔 打结器总成", nameEn: "John Deere Knotter Assembly", nameRu: "John Deere Knotter Assembly",
    brand: "John Deere", oemNumber: "AH221034", price: 4500, stockStatus: "in_stock", isOEM: true,
    descriptionZh: "约翰迪尔原厂打结器总成，含夹绳器和切断刀，适用于方捆机。", descriptionEn: "John Deere genuine knotter assembly, includes bill hook and knife, for square balers.",
    specs: { type: "Single Knot", material: "Cast Iron + Steel", twineSize: "2-3mm", operationSpeed: "80 rpm", components: "Bill Hook + Disc + Knife", weight: "2.5 kg", warranty: "12 months" },
    compatibleMachines: [
      { brand: "John Deere", model: "457", yearRange: "2010-2020" },
      { brand: "John Deere", model: "467", yearRange: "2010-2020" },
    ],
  },
  {
    machineTypeCode: "baler", subSystemCode: "knotting_system", componentGroupCode: "bill_hook",
    sku: "SD-BALER-KNT-002", nameZh: "CLAAS 夹绳器", nameEn: "CLAAS Bill Hook", nameRu: "CLAAS Bill Hook",
    brand: "CLAAS", oemNumber: "946345", price: 380, stockStatus: "in_stock", isOEM: true,
    descriptionZh: "CLAAS原厂夹绳器，精密铸造，表面抛光处理。", descriptionEn: "CLAAS genuine bill hook, precision cast, polished surface.",
    specs: { material: "Cast Steel", surface: "Polished", hardness: "HRC 45", jawOpening: "8mm", weight: "120g", warranty: "12 months" },
    compatibleMachines: [
      { brand: "CLAAS", model: "Markant 65", yearRange: "2012-2022" },
      { brand: "CLAAS", model: "Quadrant 2200", yearRange: "2015-2023" },
    ],
  },
  {
    machineTypeCode: "baler", subSystemCode: "knotting_system", componentGroupCode: "knotter_gear",
    sku: "SD-BALER-KNT-003", nameZh: "福田雷沃 打结器齿轮", nameEn: "Foton Lovol Knotter Gear", nameRu: "Foton Lovol Knotter Gear",
    brand: "福田雷沃", oemNumber: "FSL9YF-05030", price: 280, stockStatus: "in_stock", isOEM: true,
    descriptionZh: "福田雷沃原厂打结器齿轮，20CrMnTi渗碳淬火。", descriptionEn: "Foton Lovol genuine knotter gear, 20CrMnTi carburized and hardened.",
    specs: { material: "20CrMnTi", teeth: "28T", module: "2.5", hardness: "HRC 58-62", surface: "Carburized", bore: "20mm", warranty: "12 months" },
    compatibleMachines: [
      { brand: "福田雷沃", model: "9YF-110", yearRange: "2018-2024" },
      { brand: "福田雷沃", model: "9YF-80", yearRange: "2018-2024" },
    ],
  },
  {
    machineTypeCode: "baler", subSystemCode: "knotting_system", componentGroupCode: "knotter_bearing",
    sku: "SD-BALER-KNT-004", nameZh: "NSK 打结器轴承 6204ZZ", nameEn: "NSK Knotter Bearing 6204ZZ", nameRu: "NSK Knotter Bearing 6204ZZ",
    brand: "NSK", oemNumber: "6204ZZ", price: 35, stockStatus: "in_stock", isOEM: false,
    descriptionZh: "NSK深沟球轴承，金属防尘盖，适用于打结器轴。", descriptionEn: "NSK deep groove ball bearing, metal shield, for knotter shaft.",
    specs: { type: "Deep Groove Ball", innerDiameter: "20mm", outerDiameter: "47mm", width: "14mm", seal: "ZZ Metal Shield", clearance: "C3", loadRating: "Dynamic 12.8kN", warranty: "12 months" },
    compatibleMachines: [
      { brand: "John Deere", model: "457", yearRange: "2010-2020" },
      { brand: "CLAAS", model: "Markant 65", yearRange: "2012-2022" },
    ],
  },
  {
    machineTypeCode: "baler", subSystemCode: "knotting_system", componentGroupCode: "knife_blade",
    sku: "SD-BALER-KNT-005", nameZh: "铁岭机械 切绳刀片", nameEn: "Tieling Machinery Twine Knife Blade", nameRu: "Tieling Machinery Twine Knife Blade",
    brand: "铁岭机械", oemNumber: "TL-KNF-01", price: 45, stockStatus: "in_stock", isOEM: false,
    descriptionZh: "铁岭机械切绳刀片，高碳钢淬火，锋利耐用。", descriptionEn: "Tieling Machinery twine knife blade, high-carbon steel hardened, sharp and durable.",
    specs: { material: "High-Carbon Steel T10", length: "60mm", width: "15mm", thickness: "2mm", hardness: "HRC 60", edge: "Single Bevel", warranty: "12 months" },
    compatibleMachines: [
      { brand: "John Deere", model: "457", yearRange: "2010-2020" },
      { brand: "福田雷沃", model: "9YF-110", yearRange: "2018-2024" },
    ],
  },

  // ── 打捆机：传动系统 (TRN) ──
  {
    machineTypeCode: "baler", subSystemCode: "transmission", componentGroupCode: "drive_chain",
    sku: "SD-BALER-TRN-001", nameZh: "Gates 传动链条 50H", nameEn: "Gates Drive Chain 50H", nameRu: "Gates Drive Chain 50H",
    brand: "Gates", oemNumber: "50H-180", price: 380, stockStatus: "in_stock", isOEM: false,
    descriptionZh: "Gates重型滚子链条，预拉伸处理，适用于打捆机主传动。", descriptionEn: "Gates heavy duty roller chain, pre-stretched, for baler main drive.",
    specs: { type: "Roller Chain", pitch: "15.875mm", length: "180 links", material: "Alloy Steel", tensile: "25 kN", surface: "Black Oxide", standard: "ANSI B29.1", warranty: "12 months" },
    compatibleMachines: [
      { brand: "John Deere", model: "457", yearRange: "2010-2020" },
      { brand: "CLAAS", model: "Markant 65", yearRange: "2012-2022" },
    ],
  },
  {
    machineTypeCode: "baler", subSystemCode: "transmission", componentGroupCode: "gearbox",
    sku: "SD-BALER-TRN-002", nameZh: "福田雷沃 传动齿轮箱", nameEn: "Foton Lovol Drive Gearbox", nameRu: "Foton Lovol Drive Gearbox",
    brand: "福田雷沃", oemNumber: "FSL9YF-10030", price: 4500, stockStatus: "in_stock", isOEM: true,
    descriptionZh: "福田雷沃原厂传动齿轮箱，2档变速，含飞轮。", descriptionEn: "Foton Lovol genuine drive gearbox, 2-speed, with flywheel.",
    specs: { type: "Constant Mesh 2-Speed", ratio: "1:3.5 / 1:7.0", material: "20CrMnTi", oilCapacity: "2.0L", bearing: "NSK", weight: "28 kg", warranty: "12 months" },
    compatibleMachines: [
      { brand: "福田雷沃", model: "9YF-110", yearRange: "2018-2024" },
      { brand: "福田雷沃", model: "9YF-80", yearRange: "2018-2024" },
    ],
  },
  {
    machineTypeCode: "baler", subSystemCode: "transmission", componentGroupCode: "universal_joint",
    sku: "SD-BALER-TRN-003", nameZh: "洛阳轴承 万向节传动轴", nameEn: "LYC Universal Joint Drive Shaft", nameRu: "LYC Universal Joint Drive Shaft",
    brand: "洛阳轴承", oemNumber: "LYC-GU800", price: 680, stockStatus: "in_stock", isOEM: false,
    descriptionZh: "洛阳轴承万向节传动轴，十字轴式，配拖拉机PTO。", descriptionEn: "LYC universal joint drive shaft, cross type, for tractor PTO connection.",
    specs: { type: "Telescoping Cross Joint", outerDiameter: "80mm", shaftDiameter: "25mm", material: "20Cr", bearing: "Needle Roller", angle: "35°", length: "1200mm", warranty: "12 months" },
    compatibleMachines: [
      { brand: "John Deere", model: "457", yearRange: "2010-2020" },
      { brand: "福田雷沃", model: "9YF-110", yearRange: "2018-2024" },
    ],
  },
  {
    machineTypeCode: "baler", subSystemCode: "transmission", componentGroupCode: "drive_belt",
    sku: "SD-BALER-TRN-004", nameZh: "Gates 传动V带 B型", nameEn: "Gates Drive V-Belt B Section", nameRu: "Gates Drive V-Belt B Section",
    brand: "Gates", oemNumber: "B78", price: 85, stockStatus: "in_stock", isOEM: false,
    descriptionZh: "Gates B型传动V带，适用于打捆机飞轮传动。", descriptionEn: "Gates B section drive V-belt, for baler flywheel drive.",
    specs: { type: "Classical V-Belt", section: "B", length: "1981mm", cord: "Polyester", temperature: "-35°C to 90°C", standard: "ISO 4184", warranty: "12 months" },
    compatibleMachines: [
      { brand: "John Deere", model: "457", yearRange: "2010-2020" },
      { brand: "CLAAS", model: "Markant 65", yearRange: "2012-2022" },
    ],
  },
  {
    machineTypeCode: "baler", subSystemCode: "transmission", componentGroupCode: "sprocket",
    sku: "SD-BALER-TRN-005", nameZh: "铁岭机械 传动链轮 15T", nameEn: "Tieling Machinery Drive Sprocket 15T", nameRu: "Tieling Machinery Drive Sprocket 15T",
    brand: "铁岭机械", oemNumber: "TL-SPR-15", price: 180, stockStatus: "in_stock", isOEM: false,
    descriptionZh: "铁岭机械传动链轮，15齿，45#钢调质处理。", descriptionEn: "Tieling Machinery drive sprocket, 15 teeth, 45# steel quenched and tempered.",
    specs: { material: "45# Steel", teeth: "15T", pitch: "15.875mm", bore: "25mm", hardness: "HRC 45-50", surface: "Black Oxide", warranty: "12 months" },
    compatibleMachines: [
      { brand: "John Deere", model: "457", yearRange: "2010-2020" },
      { brand: "福田雷沃", model: "9YF-110", yearRange: "2018-2024" },
    ],
  },

  // ── 打捆机：液压系统 (HYD) ──
  {
    machineTypeCode: "baler", subSystemCode: "hydraulic", componentGroupCode: "hydraulic_pump",
    sku: "SD-BALER-HYD-001", nameZh: "Danfoss 液压齿轮泵", nameEn: "Danfoss Hydraulic Gear Pump", nameRu: "Danfoss Hydraulic Gear Pump",
    brand: "Danfoss", oemNumber: "SNP2-025", price: 3500, stockStatus: "in_stock", isOEM: false,
    descriptionZh: "Danfoss液压齿轮泵，小排量，适用于打捆机液压系统。", descriptionEn: "Danfoss hydraulic gear pump, small displacement, for baler hydraulic system.",
    specs: { type: "External Gear Pump", displacement: "25 cc/rev", maxPressure: "250 bar", speed: "3000 rpm", port: "G1/2", direction: "CW", warranty: "12 months" },
    compatibleMachines: [
      { brand: "John Deere", model: "467", yearRange: "2010-2020" },
      { brand: "CLAAS", model: "Quadrant 2200", yearRange: "2015-2023" },
    ],
  },
  {
    machineTypeCode: "baler", subSystemCode: "hydraulic", componentGroupCode: "hydraulic_cylinder",
    sku: "SD-BALER-HYD-002", nameZh: "Parker 尾门油缸", nameEn: "Parker Tailgate Cylinder", nameRu: "Parker Tailgate Cylinder",
    brand: "Parker", oemNumber: "HLC-C50-400", price: 2200, stockStatus: "in_stock", isOEM: false,
    descriptionZh: "Parker尾门开启油缸，双作用式，大行程。", descriptionEn: "Parker tailgate opening cylinder, double-acting, long stroke.",
    specs: { bore: "50mm", stroke: "400mm", rodDiameter: "25mm", type: "Double Acting", pressure: "200 bar", seal: "NBR + Polyurethane", warranty: "12 months" },
    compatibleMachines: [
      { brand: "John Deere", model: "467", yearRange: "2010-2020" },
      { brand: "CLAAS", model: "Quadrant 2200", yearRange: "2015-2023" },
    ],
  },
  {
    machineTypeCode: "baler", subSystemCode: "hydraulic", componentGroupCode: "hydraulic_valve",
    sku: "SD-BALER-HYD-003", nameZh: "Eaton 液压换向阀", nameEn: "Eaton Hydraulic Directional Valve", nameRu: "Eaton Hydraulic Directional Valve",
    brand: "Eaton", oemNumber: "DG4V-3-2C", price: 1200, stockStatus: "in_stock", isOEM: false,
    descriptionZh: "Eaton液压换向阀，二位四通，电磁控制。", descriptionEn: "Eaton hydraulic directional valve, 2-position 4-way, solenoid controlled.",
    specs: { type: "Directional Control", ports: "4-Way", positions: "2", maxPressure: "250 bar", flow: "40 L/min", voltage: "12V DC", warranty: "12 months" },
    compatibleMachines: [
      { brand: "John Deere", model: "467", yearRange: "2010-2020" },
      { brand: "CLAAS", model: "Quadrant 2200", yearRange: "2015-2023" },
    ],
  },
  {
    machineTypeCode: "baler", subSystemCode: "hydraulic", componentGroupCode: "seal_kit",
    sku: "SD-BALER-HYD-004", nameZh: "洛阳轴承 液压密封套件", nameEn: "LYC Hydraulic Seal Kit", nameRu: "LYC Hydraulic Seal Kit",
    brand: "洛阳轴承", oemNumber: "LYC-SK30", price: 120, stockStatus: "in_stock", isOEM: false,
    descriptionZh: "洛阳轴承液压油缸密封套件，含活塞密封和活塞杆密封。", descriptionEn: "LYC hydraulic cylinder seal kit, includes piston seal and rod seal.",
    specs: { material: "NBR + PTFE", boreSize: "30-50mm", rodSize: "15-25mm", components: "Piston Seal + Rod Seal + Wiper", temperature: "-30°C to 110°C", pressure: "250 bar", warranty: "12 months" },
    compatibleMachines: [
      { brand: "John Deere", model: "457", yearRange: "2010-2020" },
      { brand: "福田雷沃", model: "9YF-110", yearRange: "2018-2024" },
    ],
  },

  // ── 打捆机：电气系统 (ELE) ──
  {
    machineTypeCode: "baler", subSystemCode: "electrical", componentGroupCode: "controller",
    sku: "SD-BALER-ELE-001", nameZh: "约翰迪尔 打捆机控制器", nameEn: "John Deere Baler Controller", nameRu: "John Deere Baler Controller",
    brand: "John Deere", oemNumber: "AH221156", price: 3200, stockStatus: "in_stock", isOEM: true,
    descriptionZh: "约翰迪尔原厂打捆机控制器，控制打结和草捆密度。", descriptionEn: "John Deere genuine baler controller, controls knotting and bale density.",
    specs: { type: "ARM Cortex-M4", channels: "16 I/O", voltage: "12V", protocol: "CAN Bus J1939", memory: "128KB Flash", connector: "Deutsch 12-Pin", warranty: "12 months" },
    compatibleMachines: [
      { brand: "John Deere", model: "457", yearRange: "2010-2020" },
      { brand: "John Deere", model: "467", yearRange: "2010-2020" },
    ],
  },
  {
    machineTypeCode: "baler", subSystemCode: "electrical", componentGroupCode: "sensor",
    sku: "SD-BALER-ELE-002", nameZh: "Bosch 草捆长度传感器", nameEn: "Bosch Bale Length Sensor", nameRu: "Bosch Bale Length Sensor",
    brand: "Bosch", oemNumber: "0281002700", price: 680, stockStatus: "in_stock", isOEM: false,
    descriptionZh: "Bosch草捆长度传感器，电感式接近开关。", descriptionEn: "Bosch bale length sensor, inductive proximity switch.",
    specs: { type: "Inductive Proximity", sensingRange: "15mm", voltage: "12V DC", output: "PNP NC", frequency: "500 Hz", protection: "IP67", warranty: "12 months" },
    compatibleMachines: [
      { brand: "John Deere", model: "457", yearRange: "2010-2020" },
      { brand: "CLAAS", model: "Markant 65", yearRange: "2012-2022" },
    ],
  },
  {
    machineTypeCode: "baler", subSystemCode: "electrical", componentGroupCode: "work_light",
    sku: "SD-BALER-ELE-003", nameZh: "Bosch LED工作灯", nameEn: "Bosch LED Work Light", nameRu: "Bosch LED Work Light",
    brand: "Bosch", oemNumber: "0301-150", price: 280, stockStatus: "in_stock", isOEM: false,
    descriptionZh: "Bosch LED工作灯，防震防水，夜间作业照明。", descriptionEn: "Bosch LED work light, shockproof and waterproof, for night operation.",
    specs: { type: "LED Flood Beam", voltage: "12V", power: "20W", luminous: "2000 lm", beam: "60° Flood", waterproof: "IP67", warranty: "12 months" },
    compatibleMachines: [
      { brand: "John Deere", model: "457", yearRange: "2010-2020" },
      { brand: "CLAAS", model: "Quadrant 2200", yearRange: "2015-2023" },
    ],
  },

  // ── 打捆机：行走系统 (CHS) ──
  {
    machineTypeCode: "baler", subSystemCode: "chassis", componentGroupCode: "tire",
    sku: "SD-BALER-CHS-001", nameZh: "福田雷沃 行走轮胎 11.5/80-15.3", nameEn: "Foton Lovol Implement Tire 11.5/80-15.3", nameRu: "Foton Lovol Implement Tire 11.5/80-15.3",
    brand: "福田雷沃", oemNumber: "FSL9YF-T115", price: 1200, stockStatus: "in_stock", isOEM: true,
    descriptionZh: "福田雷沃原厂行走轮胎，农机具专用，高承载。", descriptionEn: "Foton Lovol genuine implement tire, agricultural implement, high load capacity.",
    specs: { type: "Bias Implement", size: "11.5/80-15.3", pattern: "I-3", loadIndex: "133A8", ply: "10", pressure: "2.4 bar", weight: "35 kg", warranty: "12 months" },
    compatibleMachines: [
      { brand: "福田雷沃", model: "9YF-110", yearRange: "2018-2024" },
      { brand: "John Deere", model: "457", yearRange: "2010-2020" },
    ],
  },
  {
    machineTypeCode: "baler", subSystemCode: "chassis", componentGroupCode: "hub_bearing",
    sku: "SD-BALER-CHS-002", nameZh: "SKF 轮毂轴承单元", nameEn: "SKF Hub Bearing Unit", nameRu: "SKF Hub Bearing Unit",
    brand: "SKF", oemNumber: "BR930410", price: 380, stockStatus: "in_stock", isOEM: false,
    descriptionZh: "SKF轮毂轴承单元，双列角接触球轴承，预润滑。", descriptionEn: "SKF hub bearing unit, double row angular contact ball bearing, pre-lubricated.",
    specs: { type: "Double Row Angular Contact", innerDiameter: "25mm", outerDiameter: "52mm", width: "42mm", seal: "Double Lip", studBolt: "M12x4", warranty: "12 months" },
    compatibleMachines: [
      { brand: "John Deere", model: "457", yearRange: "2010-2020" },
      { brand: "CLAAS", model: "Markant 65", yearRange: "2012-2022" },
    ],
  },
  {
    machineTypeCode: "baler", subSystemCode: "chassis", componentGroupCode: "support_wheel",
    sku: "SD-BALER-CHS-003", nameZh: "铁岭机械 支撑轮总成", nameEn: "Tieling Machinery Support Wheel Assembly", nameRu: "Tieling Machinery Support Wheel Assembly",
    brand: "铁岭机械", oemNumber: "TL-SWP-01", price: 450, stockStatus: "in_stock", isOEM: false,
    descriptionZh: "铁岭机械支撑轮总成，含轮辋和轴承，可调高度。", descriptionEn: "Tieling Machinery support wheel assembly, with rim and bearing, height adjustable.",
    specs: { type: "Pneumatic Wheel Assembly", diameter: "400mm", tireSize: "4.00-8", rimMaterial: "Steel", bearing: "6204-2RS", adjustment: "Height Adjustable", warranty: "12 months" },
    compatibleMachines: [
      { brand: "John Deere", model: "457", yearRange: "2010-2020" },
      { brand: "福田雷沃", model: "9YF-110", yearRange: "2018-2024" },
    ],
  },
  {
    machineTypeCode: "baler", subSystemCode: "chassis", componentGroupCode: "brake",
    sku: "SD-BALER-CHS-004", nameZh: "Eaton 机械制动器", nameEn: "Eaton Mechanical Brake", nameRu: "Eaton Mechanical Brake",
    brand: "Eaton", oemNumber: "BK-150", price: 320, stockStatus: "in_stock", isOEM: false,
    descriptionZh: "Eaton机械式驻车制动器，手动操纵杆控制。", descriptionEn: "Eaton mechanical parking brake, manual lever control.",
    specs: { type: "Drum Brake", drumDiameter: "150mm", liningWidth: "40mm", material: "Semi-Metallic", actuation: "Manual Lever", mounting: "Bolt-On", warranty: "12 months" },
    compatibleMachines: [
      { brand: "John Deere", model: "457", yearRange: "2010-2020" },
      { brand: "CLAAS", model: "Markant 65", yearRange: "2012-2022" },
    ],
  },


  // ════════════════════════════════════════════════════
  // 牧草设备 (forage_equipment) — 23条
  // ════════════════════════════════════════════════════

  // ── 切割系统 (CUT) ──
  {
    machineTypeCode: "forage_equipment", subSystemCode: "cutting_system", componentGroupCode: "cutting_blade",
    sku: "SD-FORAGE_EQ-CUT-001", nameZh: "约翰迪尔 切割刀片", nameEn: "John Deere Cutting Blade", nameRu: "John Deere Cutting Blade",
    brand: "John Deere", oemNumber: "AH170023", price: 85, stockStatus: "in_stock", isOEM: true,
    descriptionZh: "约翰迪尔原厂切割刀片，高碳钢锯齿刃口，适用于割草机割台。", descriptionEn: "John Deere genuine cutting blade, high-carbon steel serrated edge, for mower cutter bar.",
    specs: { material: "High-Carbon Steel C80", length: "75mm", width: "25mm", thickness: "2.5mm", hardness: "HRC 55", edge: "Serrated", warranty: "12 months" },
    compatibleMachines: [
      { brand: "John Deere", model: "530", yearRange: "2012-2022" },
      { brand: "John Deere", model: "630", yearRange: "2012-2022" },
    ],
  },
  {
    machineTypeCode: "forage_equipment", subSystemCode: "cutting_system", componentGroupCode: "cutter_bar",
    sku: "SD-FORAGE_EQ-CUT-002", nameZh: "CLAAS 切割器总成", nameEn: "CLAAS Cutter Bar Assembly", nameRu: "CLAAS Cutter Bar Assembly",
    brand: "CLAAS", oemNumber: "947023", price: 5500, stockStatus: "in_stock", isOEM: true,
    descriptionZh: "CLAAS原厂切割器总成，含刀片和护刃器，适用于Disco系列。", descriptionEn: "CLAAS genuine cutter bar assembly, with blades and guards, for Disco series.",
    specs: { type: "Double Action", width: "2800mm", bladeCount: "40", stroke: "76mm", guardCount: "20", material: "Steel", warranty: "12 months" },
    compatibleMachines: [
      { brand: "CLAAS", model: "Disco 3100", yearRange: "2015-2023" },
      { brand: "CLAAS", model: "Disco 9100", yearRange: "2016-2024" },
    ],
  },
  {
    machineTypeCode: "forage_equipment", subSystemCode: "cutting_system", componentGroupCode: "blade_holder",
    sku: "SD-FORAGE_EQ-CUT-003", nameZh: "福田雷沃 刀片夹持器", nameEn: "Foton Lovol Blade Holder", nameRu: "Foton Lovol Blade Holder",
    brand: "福田雷沃", oemNumber: "FSL9G-02010", price: 45, stockStatus: "in_stock", isOEM: true,
    descriptionZh: "福田雷沃原厂刀片夹持器，铝合金材质，适用于9G系列割草机。", descriptionEn: "Foton Lovol genuine blade holder, aluminum alloy, for 9G series mowers.",
    specs: { material: "Aluminum Alloy 6061", length: "80mm", width: "25mm", mountingHoles: "2", clampForce: "Adjustable", weight: "30g", warranty: "12 months" },
    compatibleMachines: [
      { brand: "福田雷沃", model: "9G-180", yearRange: "2018-2024" },
      { brand: "福田雷沃", model: "9G-150", yearRange: "2018-2024" },
    ],
  },
  {
    machineTypeCode: "forage_equipment", subSystemCode: "cutting_system", componentGroupCode: "drive_belt",
    sku: "SD-FORAGE_EQ-CUT-004", nameZh: "Gates 切割传动带", nameEn: "Gates Cutter Drive Belt", nameRu: "Gates Cutter Drive Belt",
    brand: "Gates", oemNumber: "864P150", price: 120, stockStatus: "in_stock", isOEM: false,
    descriptionZh: "Gates切割传动带，多楔带，适用于割草机刀梁驱动。", descriptionEn: "Gates cutter drive belt, multi-rib, for mower cutter bar drive.",
    specs: { type: "Multi-Rib Belt", section: "4PK", length: "1500mm", cord: "Polyester", temperature: "-35°C to 90°C", standard: "ISO 9982", warranty: "12 months" },
    compatibleMachines: [
      { brand: "John Deere", model: "530", yearRange: "2012-2022" },
      { brand: "CLAAS", model: "Disco 3100", yearRange: "2015-2023" },
    ],
  },
  {
    machineTypeCode: "forage_equipment", subSystemCode: "cutting_system", componentGroupCode: "cutter_bearing",
    sku: "SD-FORAGE_EQ-CUT-005", nameZh: "SKF 切割器轴承 6203-2RS", nameEn: "SKF Cutter Bearing 6203-2RS", nameRu: "SKF Cutter Bearing 6203-2RS",
    brand: "SKF", oemNumber: "6203-2RS1", price: 28, stockStatus: "in_stock", isOEM: false,
    descriptionZh: "SKF深沟球轴承，双面密封，适用于切割器偏心轮。", descriptionEn: "SKF deep groove ball bearing, double sealed, for cutter eccentric.",
    specs: { type: "Deep Groove Ball", innerDiameter: "17mm", outerDiameter: "40mm", width: "12mm", seal: "2RS Double Rubber", clearance: "C3", loadRating: "Dynamic 9.5kN", warranty: "12 months" },
    compatibleMachines: [
      { brand: "John Deere", model: "530", yearRange: "2012-2022" },
      { brand: "CLAAS", model: "Disco 3100", yearRange: "2015-2023" },
    ],
  },

  // ── 搂草系统 (RAK) ──
  {
    machineTypeCode: "forage_equipment", subSystemCode: "raking_system", componentGroupCode: "rake_tine",
    sku: "SD-FORAGE_EQ-RAK-001", nameZh: "约翰迪尔 搂草弹齿", nameEn: "John Deere Rake Tine", nameRu: "John Deere Rake Tine",
    brand: "John Deere", oemNumber: "AH170156", price: 35, stockStatus: "in_stock", isOEM: true,
    descriptionZh: "约翰迪尔原厂搂草弹齿，弹簧钢丝，适用于旋转搂草机。", descriptionEn: "John Deere genuine rake tine, spring wire, for rotary rakes.",
    specs: { material: "Spring Steel 65Mn", diameter: "4mm", tineLength: "220mm", curveRadius: "60mm", surface: "Galvanized", quantity: "20 pcs/box", warranty: "12 months" },
    compatibleMachines: [
      { brand: "John Deere", model: "WR1108", yearRange: "2012-2022" },
      { brand: "John Deere", model: "WR1112", yearRange: "2012-2022" },
    ],
  },
  {
    machineTypeCode: "forage_equipment", subSystemCode: "raking_system", componentGroupCode: "rake_rotor",
    sku: "SD-FORAGE_EQ-RAK-002", nameZh: "CLAAS 搂草转子总成", nameEn: "CLAAS Rake Rotor Assembly", nameRu: "CLAAS Rake Rotor Assembly",
    brand: "CLAAS", oemNumber: "947345", price: 3200, stockStatus: "in_stock", isOEM: true,
    descriptionZh: "CLAAS原厂搂草转子总成，含弹齿臂和轴承，适用于Volto系列。", descriptionEn: "CLAAS genuine rake rotor assembly, with tine arms and bearings, for Volto series.",
    specs: { type: "Rotary Rake Rotor", armCount: "10", diameter: "2800mm", material: "Steel Tube + Cast Hub", bearing: "SKF Included", speed: "60-90 rpm", warranty: "12 months" },
    compatibleMachines: [
      { brand: "CLAAS", model: "Volto 1100", yearRange: "2015-2023" },
      { brand: "CLAAS", model: "Volto 1300", yearRange: "2015-2023" },
    ],
  },
  {
    machineTypeCode: "forage_equipment", subSystemCode: "raking_system", componentGroupCode: "rotor_bearing",
    sku: "SD-FORAGE_EQ-RAK-003", nameZh: "NSK 转子轴承 22208E", nameEn: "NSK Rotor Bearing 22208E", nameRu: "NSK Rotor Bearing 22208E",
    brand: "NSK", oemNumber: "22208EAKE4", price: 180, stockStatus: "in_stock", isOEM: false,
    descriptionZh: "NSK调心滚子轴承，适用于搂草机转子主轴。", descriptionEn: "NSK spherical roller bearing, for rake rotor main shaft.",
    specs: { type: "Spherical Roller", innerDiameter: "40mm", outerDiameter: "80mm", width: "23mm", cage: "Steel", clearance: "C3", loadRating: "Dynamic 65kN", warranty: "12 months" },
    compatibleMachines: [
      { brand: "CLAAS", model: "Volto 1100", yearRange: "2015-2023" },
      { brand: "John Deere", model: "WR1108", yearRange: "2012-2022" },
    ],
  },
  {
    machineTypeCode: "forage_equipment", subSystemCode: "raking_system", componentGroupCode: "rake_arm",
    sku: "SD-FORAGE_EQ-RAK-004", nameZh: "福田雷沃 搂草臂", nameEn: "Foton Lovol Rake Arm", nameRu: "Foton Lovol Rake Arm",
    brand: "福田雷沃", oemNumber: "FSL9L-03010", price: 380, stockStatus: "in_stock", isOEM: true,
    descriptionZh: "福田雷沃原厂搂草臂，钢管焊接结构，表面镀锌。", descriptionEn: "Foton Lovol genuine rake arm, welded steel tube, galvanized surface.",
    specs: { material: "Q235 Steel Tube", diameter: "40mm", length: "1200mm", surface: "Hot Galvanized", tineCount: "4", weight: "3.5 kg", warranty: "12 months" },
    compatibleMachines: [
      { brand: "福田雷沃", model: "9L-2200", yearRange: "2018-2024" },
      { brand: "福田雷沃", model: "9L-1800", yearRange: "2018-2024" },
    ],
  },

  // ── 牧草设备：传动系统 (TRN) ──
  {
    machineTypeCode: "forage_equipment", subSystemCode: "transmission", componentGroupCode: "drive_chain",
    sku: "SD-FORAGE_EQ-TRN-001", nameZh: "Gates 传动链条 40H", nameEn: "Gates Drive Chain 40H", nameRu: "Gates Drive Chain 40H",
    brand: "Gates", oemNumber: "40H-120", price: 120, stockStatus: "in_stock", isOEM: false,
    descriptionZh: "Gates轻型滚子链条，适用于牧草设备传动。", descriptionEn: "Gates light duty roller chain, for forage equipment drive.",
    specs: { type: "Roller Chain", pitch: "12.7mm", length: "120 links", material: "Carbon Steel", tensile: "15 kN", surface: "Nickel Plated", standard: "ANSI B29.1", warranty: "12 months" },
    compatibleMachines: [
      { brand: "John Deere", model: "530", yearRange: "2012-2022" },
      { brand: "CLAAS", model: "Volto 1100", yearRange: "2015-2023" },
    ],
  },
  {
    machineTypeCode: "forage_equipment", subSystemCode: "transmission", componentGroupCode: "gearbox",
    sku: "SD-FORAGE_EQ-TRN-002", nameZh: "福田雷沃 传动齿轮箱", nameEn: "Foton Lovol Drive Gearbox", nameRu: "Foton Lovol Drive Gearbox",
    brand: "福田雷沃", oemNumber: "FSL9G-10030", price: 2200, stockStatus: "in_stock", isOEM: true,
    descriptionZh: "福田雷沃原厂传动齿轮箱，90度换向，含伞齿轮。", descriptionEn: "Foton Lovol genuine drive gearbox, 90-degree bevel, with bevel gears.",
    specs: { type: "Bevel Gear 90°", ratio: "1:1.5", material: "20CrMnTi", oilCapacity: "0.8L", bearing: "NSK", weight: "12 kg", warranty: "12 months" },
    compatibleMachines: [
      { brand: "福田雷沃", model: "9G-180", yearRange: "2018-2024" },
      { brand: "福田雷沃", model: "9L-2200", yearRange: "2018-2024" },
    ],
  },
  {
    machineTypeCode: "forage_equipment", subSystemCode: "transmission", componentGroupCode: "universal_joint",
    sku: "SD-FORAGE_EQ-TRN-003", nameZh: "洛阳轴承 万向节", nameEn: "LYC Universal Joint", nameRu: "LYC Universal Joint",
    brand: "洛阳轴承", oemNumber: "LYC-GU600", price: 280, stockStatus: "in_stock", isOEM: false,
    descriptionZh: "洛阳轴承万向节，十字轴式，配拖拉机PTO。", descriptionEn: "LYC universal joint, cross type, for tractor PTO connection.",
    specs: { type: "Cross Joint", outerDiameter: "60mm", shaftDiameter: "20mm", material: "20Cr", bearing: "Needle Roller", angle: "35°", length: "800mm", warranty: "12 months" },
    compatibleMachines: [
      { brand: "John Deere", model: "530", yearRange: "2012-2022" },
      { brand: "福田雷沃", model: "9G-180", yearRange: "2018-2024" },
    ],
  },
  {
    machineTypeCode: "forage_equipment", subSystemCode: "transmission", componentGroupCode: "drive_pulley",
    sku: "SD-FORAGE_EQ-TRN-004", nameZh: "铁岭机械 传动带轮 A型", nameEn: "Tieling Machinery Drive Pulley A Section", nameRu: "Tieling Machinery Drive Pulley A Section",
    brand: "铁岭机械", oemNumber: "TL-PLA-150", price: 85, stockStatus: "in_stock", isOEM: false,
    descriptionZh: "铁岭机械A型传动带轮，铸铁材质，单槽。", descriptionEn: "Tieling Machinery A section drive pulley, cast iron, single groove.",
    specs: { material: "HT250 Cast Iron", diameter: "150mm", groove: "A Section Single", bore: "20mm", keyway: "6x6mm", surface: "Painted", warranty: "12 months" },
    compatibleMachines: [
      { brand: "福田雷沃", model: "9G-180", yearRange: "2018-2024" },
      { brand: "福田雷沃", model: "9L-2200", yearRange: "2018-2024" },
    ],
  },

  // ── 牧草设备：液压系统 (HYD) ──
  {
    machineTypeCode: "forage_equipment", subSystemCode: "hydraulic", componentGroupCode: "hydraulic_cylinder",
    sku: "SD-FORAGE_EQ-HYD-001", nameZh: "Parker 升降油缸", nameEn: "Parker Lift Cylinder", nameRu: "Parker Lift Cylinder",
    brand: "Parker", oemNumber: "HLC-D32-300", price: 1200, stockStatus: "in_stock", isOEM: false,
    descriptionZh: "Parker升降油缸，双作用式，控制割台升降。", descriptionEn: "Parker lift cylinder, double-acting, controls cutter bar lift.",
    specs: { bore: "32mm", stroke: "300mm", rodDiameter: "16mm", type: "Double Acting", pressure: "200 bar", seal: "NBR + Polyurethane", warranty: "12 months" },
    compatibleMachines: [
      { brand: "John Deere", model: "530", yearRange: "2012-2022" },
      { brand: "CLAAS", model: "Disco 3100", yearRange: "2015-2023" },
    ],
  },
  {
    machineTypeCode: "forage_equipment", subSystemCode: "hydraulic", componentGroupCode: "hydraulic_valve",
    sku: "SD-FORAGE_EQ-HYD-002", nameZh: "Eaton 液压控制阀", nameEn: "Eaton Hydraulic Control Valve", nameRu: "Eaton Hydraulic Control Valve",
    brand: "Eaton", oemNumber: "DG4V-2-2C", price: 680, stockStatus: "in_stock", isOEM: false,
    descriptionZh: "Eaton液压控制阀，二位四通电磁换向阀。", descriptionEn: "Eaton hydraulic control valve, 2-position 4-way solenoid directional valve.",
    specs: { type: "Directional Control", ports: "4-Way", positions: "2", maxPressure: "250 bar", flow: "20 L/min", voltage: "12V DC", warranty: "12 months" },
    compatibleMachines: [
      { brand: "John Deere", model: "530", yearRange: "2012-2022" },
      { brand: "CLAAS", model: "Volto 1100", yearRange: "2015-2023" },
    ],
  },
  {
    machineTypeCode: "forage_equipment", subSystemCode: "hydraulic", componentGroupCode: "hydraulic_fitting",
    sku: "SD-FORAGE_EQ-HYD-003", nameZh: "Parker 液压快速接头", nameEn: "Parker Hydraulic Quick Coupler", nameRu: "Parker Hydraulic Quick Coupler",
    brand: "Parker", oemNumber: "FEM-1/2NPT", price: 85, stockStatus: "in_stock", isOEM: false,
    descriptionZh: "Parker液压快速接头，1/2NPT螺纹，带防尘盖。", descriptionEn: "Parker hydraulic quick coupler, 1/2 NPT thread, with dust cap.",
    specs: { type: "Poppet Quick Coupler", thread: "1/2 NPT", maxPressure: "300 bar", flow: "30 L/min", material: "Carbon Steel", seal: "NBR", warranty: "12 months" },
    compatibleMachines: [
      { brand: "John Deere", model: "530", yearRange: "2012-2022" },
      { brand: "福田雷沃", model: "9G-180", yearRange: "2018-2024" },
    ],
  },

  // ── 牧草设备：行走系统 (CHS) ──
  {
    machineTypeCode: "forage_equipment", subSystemCode: "chassis", componentGroupCode: "tire",
    sku: "SD-FORAGE_EQ-CHS-001", nameZh: "福田雷沃 行走轮胎 10/75-15.3", nameEn: "Foton Lovol Implement Tire 10/75-15.3", nameRu: "Foton Lovol Implement Tire 10/75-15.3",
    brand: "福田雷沃", oemNumber: "FSL9G-T107", price: 850, stockStatus: "in_stock", isOEM: true,
    descriptionZh: "福田雷沃原厂行走轮胎，农机具专用，斜交结构。", descriptionEn: "Foton Lovol genuine implement tire, agricultural implement, bias construction.",
    specs: { type: "Bias Implement", size: "10/75-15.3", pattern: "I-3", loadIndex: "125A8", ply: "8", pressure: "2.4 bar", weight: "22 kg", warranty: "12 months" },
    compatibleMachines: [
      { brand: "福田雷沃", model: "9G-180", yearRange: "2018-2024" },
      { brand: "福田雷沃", model: "9L-2200", yearRange: "2018-2024" },
    ],
  },
  {
    machineTypeCode: "forage_equipment", subSystemCode: "chassis", componentGroupCode: "hub_bearing",
    sku: "SD-FORAGE_EQ-CHS-002", nameZh: "SKF 轮毂轴承 6206-2RS", nameEn: "SKF Hub Bearing 6206-2RS", nameRu: "SKF Hub Bearing 6206-2RS",
    brand: "SKF", oemNumber: "6206-2RS1", price: 55, stockStatus: "in_stock", isOEM: false,
    descriptionZh: "SKF深沟球轴承，双面密封，适用于行走轮轮毂。", descriptionEn: "SKF deep groove ball bearing, double sealed, for wheel hub.",
    specs: { type: "Deep Groove Ball", innerDiameter: "30mm", outerDiameter: "62mm", width: "16mm", seal: "2RS Double Rubber", clearance: "C3", loadRating: "Dynamic 19.5kN", warranty: "12 months" },
    compatibleMachines: [
      { brand: "John Deere", model: "530", yearRange: "2012-2022" },
      { brand: "福田雷沃", model: "9G-180", yearRange: "2018-2024" },
    ],
  },
  {
    machineTypeCode: "forage_equipment", subSystemCode: "chassis", componentGroupCode: "steering_knuckle",
    sku: "SD-FORAGE_EQ-CHS-003", nameZh: "铁岭机械 转向节总成", nameEn: "Tieling Machinery Steering Knuckle Assembly", nameRu: "Tieling Machinery Steering Knuckle Assembly",
    brand: "铁岭机械", oemNumber: "TL-SK-01", price: 420, stockStatus: "in_stock", isOEM: false,
    descriptionZh: "铁岭机械转向节总成，锻钢材质，含主销和衬套。", descriptionEn: "Tieling Machinery steering knuckle assembly, forged steel, with king pin and bushing.",
    specs: { material: "40Cr Forged Steel", kingPinDiameter: "20mm", maxAngle: "45°", bushing: "Bronze", bearing: "Needle Roller", weight: "3.5 kg", warranty: "12 months" },
    compatibleMachines: [
      { brand: "John Deere", model: "530", yearRange: "2012-2022" },
      { brand: "福田雷沃", model: "9G-180", yearRange: "2018-2024" },
    ],
  },
  {
    machineTypeCode: "forage_equipment", subSystemCode: "chassis", componentGroupCode: "support_wheel",
    sku: "SD-FORAGE_EQ-CHS-004", nameZh: "铁岭机械 支撑轮 4.00-8", nameEn: "Tieling Machinery Support Wheel 4.00-8", nameRu: "Tieling Machinery Support Wheel 4.00-8",
    brand: "铁岭机械", oemNumber: "TL-SWP-02", price: 180, stockStatus: "in_stock", isOEM: false,
    descriptionZh: "铁岭机械支撑轮，充气式，可调高度。", descriptionEn: "Tieling Machinery support wheel, pneumatic, height adjustable.",
    specs: { type: "Pneumatic Wheel Assembly", diameter: "400mm", tireSize: "4.00-8", rimMaterial: "Steel", bearing: "6204-2RS", adjustment: "Height Adjustable", warranty: "12 months" },
    compatibleMachines: [
      { brand: "John Deere", model: "530", yearRange: "2012-2022" },
      { brand: "CLAAS", model: "Disco 3100", yearRange: "2015-2023" },
    ],
  },

  // ── 框架系统 (FRM) ──
  {
    machineTypeCode: "forage_equipment", subSystemCode: "frame_structure", componentGroupCode: "main_frame",
    sku: "SD-FORAGE_EQ-FRM-001", nameZh: "约翰迪尔 主框架焊接件", nameEn: "John Deere Main Frame Weldment", nameRu: "John Deere Main Frame Weldment",
    brand: "John Deere", oemNumber: "AH170340", price: 4500, stockStatus: "in_stock", isOEM: true,
    descriptionZh: "约翰迪尔原厂主框架焊接件，方管结构，适用于530割草机。", descriptionEn: "John Deere genuine main frame weldment, square tube, for 530 mower.",
    specs: { material: "Q345 Square Tube", tubeSize: "80x80x5mm", length: "2800mm", weight: "85 kg", surface: "Powder Coated", mountingPoints: "12", warranty: "12 months" },
    compatibleMachines: [
      { brand: "John Deere", model: "530", yearRange: "2012-2022" },
      { brand: "John Deere", model: "630", yearRange: "2012-2022" },
    ],
  },
  {
    machineTypeCode: "forage_equipment", subSystemCode: "frame_structure", componentGroupCode: "mounting_bracket",
    sku: "SD-FORAGE_EQ-FRM-002", nameZh: "福田雷沃 三点悬挂支架", nameEn: "Foton Lovol 3-Point Hitch Bracket", nameRu: "Foton Lovol 3-Point Hitch Bracket",
    brand: "福田雷沃", oemNumber: "FSL9G-08010", price: 380, stockStatus: "in_stock", isOEM: true,
    descriptionZh: "福田雷沃原厂三点悬挂支架，钢板焊接，Cat I/II。", descriptionEn: "Foton Lovol genuine 3-point hitch bracket, welded steel plate, Cat I/II.",
    specs: { material: "Q345 Steel Plate", thickness: "10mm", hitchCategory: "Cat I/II", pinHoles: "2", width: "600mm", surface: "Powder Coated", warranty: "12 months" },
    compatibleMachines: [
      { brand: "福田雷沃", model: "9G-180", yearRange: "2018-2024" },
      { brand: "福田雷沃", model: "9L-2200", yearRange: "2018-2024" },
    ],
  },
  {
    machineTypeCode: "forage_equipment", subSystemCode: "frame_structure", componentGroupCode: "protective_cover",
    sku: "SD-FORAGE_EQ-FRM-003", nameZh: "铁岭机械 传动保护罩", nameEn: "Tieling Machinery Drive Guard Cover", nameRu: "Tieling Machinery Drive Guard Cover",
    brand: "铁岭机械", oemNumber: "TL-GCD-01", price: 120, stockStatus: "in_stock", isOEM: false,
    descriptionZh: "铁岭机械传动保护罩，钢板冲压，安全防护。", descriptionEn: "Tieling Machinery drive guard cover, stamped steel, safety protection.",
    specs: { material: "Q235 Steel Plate", thickness: "1.5mm", length: "800mm", width: "200mm", surface: "Powder Coated Yellow", mounting: "Bolt-On", weight: "2.5 kg", warranty: "12 months" },
    compatibleMachines: [
      { brand: "John Deere", model: "530", yearRange: "2012-2022" },
      { brand: "福田雷沃", model: "9G-180", yearRange: "2018-2024" },
    ],
  },
];

// ═══════════════════════════════════════════════════════
// Main 函数 — 幂等种子数据写入
// ═══════════════════════════════════════════════════════

async function main(): Promise<void> {
  console.log("═══════════════════════════════════════════");
  console.log("  P0 配件种子数据脚本 — 启动");
  console.log("═══════════════════════════════════════════\n");

  // ── Step 1: 查询已存在的 MachineType，获取 ID 映射 ──
  console.log("▶ Step 1: 查询已存在的 MachineType ...");

  const machineTypeCodes = [
    "combine_harvester",
    "forage_harvester",
    "baler",
    "forage_equipment",
  ];

  const machineTypes = await prisma.machineType.findMany({
    where: { code: { in: machineTypeCodes } },
  });

  const machineTypeMap = new Map<string, string>();
  for (const mt of machineTypes) {
    machineTypeMap.set(mt.code, mt.id);
  }

  // 校验：4 个品类必须全部存在
  for (const code of machineTypeCodes) {
    if (!machineTypeMap.has(code)) {
      throw new Error(
        `MachineType "${code}" 不存在！请先运行 seed-parts-v2.ts 创建 MachineType。`
      );
    }
  }

  console.log(
    `  ✓ 找到 ${machineTypes.length} 个 MachineType: ${machineTypeCodes.join(", ")}\n`
  );

  // ── Step 2: 创建 SubSystems (upsert by [machineTypeId, code]) ──
  console.log(`▶ Step 2: 创建 SubSystems (${P0_SUB_SYSTEMS.length} 条) ...`);

  let subSystemCount = 0;
  const subSystemIdMap = new Map<string, string>(); // key: `${machineTypeCode}:${subSystemCode}`

  for (const ss of P0_SUB_SYSTEMS) {
    const machineTypeId = machineTypeMap.get(ss.machineTypeCode)!;

    const result = await prisma.subSystem.upsert({
      where: {
        machineTypeId_code: {
          machineTypeId,
          code: ss.code,
        },
      },
      create: {
        machineTypeId,
        code: ss.code,
        nameZh: ss.nameZh,
        nameEn: ss.nameEn,
        nameRu: ss.nameRu,
        nameEs: ss.nameEs,
        namePt: ss.namePt,
        nameAr: ss.nameAr,
        nameFr: ss.nameFr,
        nameHi: ss.nameHi,
        sortOrder: ss.sortOrder,
      },
      update: {
        nameZh: ss.nameZh,
        nameEn: ss.nameEn,
        nameRu: ss.nameRu,
        nameEs: ss.nameEs,
        namePt: ss.namePt,
        nameAr: ss.nameAr,
        nameFr: ss.nameFr,
        nameHi: ss.nameHi,
        sortOrder: ss.sortOrder,
      },
    });

    subSystemIdMap.set(
      `${ss.machineTypeCode}:${ss.code}`,
      result.id
    );
    subSystemCount++;
  }

  console.log(`  ✓ 创建/更新 ${subSystemCount} 个 SubSystem\n`);

  // ── Step 3: 创建 ComponentGroups (upsert by [subSystemId, code]) ──
  console.log(
    `▶ Step 3: 创建 ComponentGroups (${P0_COMPONENT_GROUPS.length} 条) ...`
  );

  let componentGroupCount = 0;
  const componentGroupIdMap = new Map<string, string>(); // key: `${machineTypeCode}:${subSystemCode}:${componentGroupCode}`

  for (const cg of P0_COMPONENT_GROUPS) {
    const subSystemId = subSystemIdMap.get(
      `${cg.machineTypeCode}:${cg.subSystemCode}`
    );

    if (!subSystemId) {
      console.warn(
        `  ⚠ 跳过 ComponentGroup: SubSystem ${cg.machineTypeCode}:${cg.subSystemCode} 未找到`
      );
      continue;
    }

    const result = await prisma.componentGroup.upsert({
      where: {
        subSystemId_code: {
          subSystemId,
          code: cg.code,
        },
      },
      create: {
        subSystemId,
        code: cg.code,
        nameZh: cg.nameZh,
        nameEn: cg.nameEn,
        sortOrder: cg.sortOrder,
      },
      update: {
        nameZh: cg.nameZh,
        nameEn: cg.nameEn,
        sortOrder: cg.sortOrder,
      },
    });

    componentGroupIdMap.set(
      `${cg.machineTypeCode}:${cg.subSystemCode}:${cg.code}`,
      result.id
    );
    componentGroupCount++;
  }

  console.log(`  ✓ 创建/更新 ${componentGroupCount} 个 ComponentGroup\n`);

  // ── Step 4: 创建 Parts + CompatibleMachines (upsert by sku) ──
  console.log(`▶ Step 4: 创建 Parts (${P0_PARTS.length} 条) + CompatibleMachines ...`);

  let partCount = 0;
  let compatibleMachineCount = 0;
  let partErrors = 0;

  for (const part of P0_PARTS) {
    const componentGroupId = componentGroupIdMap.get(
      `${part.machineTypeCode}:${part.subSystemCode}:${part.componentGroupCode}`
    );

    if (!componentGroupId) {
      console.warn(
        `  ⚠ 跳过 Part ${part.sku}: ComponentGroup ${part.machineTypeCode}:${part.subSystemCode}:${part.componentGroupCode} 未找到`
      );
      partErrors++;
      continue;
    }

    try {
      const upsertedPart = await prisma.part.upsert({
        where: { sku: part.sku },
        create: {
          sku: part.sku,
          nameZh: part.nameZh,
          nameEn: part.nameEn,
          nameRu: part.nameRu,
          nameEs: "",
          brand: part.brand,
          oemNumber: part.oemNumber,
          price: part.price,
          currency: "CNY",
          stockStatus: part.stockStatus,
          images: [],
          descriptionZh: part.descriptionZh,
          descriptionEn: part.descriptionEn,
          descriptionRu: "",
          specs: part.specs,
          isOEM: part.isOEM,
          isAftermarket: !part.isOEM,
          dataSource: "P0_SEED",
          dataQuality: "VERIFIED",
          componentGroupId,
        },
        update: {
          nameZh: part.nameZh,
          nameEn: part.nameEn,
          nameRu: part.nameRu,
          brand: part.brand,
          oemNumber: part.oemNumber,
          price: part.price,
          stockStatus: part.stockStatus,
          descriptionZh: part.descriptionZh,
          descriptionEn: part.descriptionEn,
          specs: part.specs,
          isOEM: part.isOEM,
          isAftermarket: !part.isOEM,
          componentGroupId,
        },
      });

      // ── 创建 CompatibleMachines ──
      // 先删除该 SKU 已有的兼容机型，再重新创建（保证幂等）
      await prisma.compatibleMachine.deleteMany({
        where: { partId: upsertedPart.id },
      });

      for (const cm of part.compatibleMachines) {
        await prisma.compatibleMachine.create({
          data: {
            partId: upsertedPart.id,
            brand: cm.brand,
            model: cm.model,
            yearRange: cm.yearRange,
          },
        });
        compatibleMachineCount++;
      }

      partCount++;
    } catch (err) {
      console.error(`  ✗ Part ${part.sku} 写入失败:`, err);
      partErrors++;
    }
  }

  console.log(`  ✓ 创建/更新 ${partCount} 个 Part`);
  console.log(`  ✓ 创建 ${compatibleMachineCount} 个 CompatibleMachine`);
  if (partErrors > 0) {
    console.log(`  ⚠ ${partErrors} 个 Part 跳过/失败`);
  }
  console.log("");

  // ── 统计汇总 ──
  console.log("═══════════════════════════════════════════");
  console.log("  P0 种子数据写入完成 — 统计汇总");
  console.log("═══════════════════════════════════════════");
  console.log(`  MachineType:     ${machineTypeCodes.length} 个 (已存在)`);
  console.log(`  SubSystem:       ${subSystemCount} 个`);
  console.log(`  ComponentGroup:  ${componentGroupCount} 个`);
  console.log(`  Part:            ${partCount} 个`);
  console.log(`  CompatibleMachine: ${compatibleMachineCount} 个`);
  console.log("═══════════════════════════════════════════\n");
}

main()
  .then(() => {
    console.log("✅ P0 种子脚本执行成功！");
  })
  .catch((err) => {
    console.error("❌ P0 种子脚本执行失败:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
