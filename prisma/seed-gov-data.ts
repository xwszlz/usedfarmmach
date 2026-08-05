/**
 * 政府农机数据种子数据
 * 运行: npx tsx prisma/seed-gov-data.ts
 * 包含：补贴政策（GovSubsidyPolicy）和登记信息（GovMachineryData）
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// ═══════════════════════════════════════════════════════
// 补贴政策
// ═══════════════════════════════════════════════════════

interface PolicySeed {
  title: string;
  policyNumber: string;
  region: string;
  category: string;
  machineryTypes: string[];
  subsidyAmount: number | null;
  subsidyRatio: number | null;
  maxSubsidy: number | null;
  effectiveDate: Date;
  expiryDate: Date | null;
  description: string;
  requirements: string;
  applicationUrl: string;
  source: string;
  status: string;
}

const POLICIES: PolicySeed[] = [
  {
    title: "河北省2025-2026年农机购置补贴实施方案",
    policyNumber: "冀农机〔2025〕12号",
    region: "河北",
    category: "purchase",
    machineryTypes: ["拖拉机", "联合收割机", "播种机", "打捆机", "青饲料收获机"],
    subsidyAmount: null,
    subsidyRatio: 0.3,
    maxSubsidy: 80000,
    effectiveDate: new Date("2025-03-01"),
    expiryDate: new Date("2026-12-31"),
    description: "河北省农业农村厅发布的农机购置补贴政策，对购置符合条件的农业机械给予不超过购机价格30%的补贴，单台最高补贴8万元。重点补贴大马力拖拉机、高性能收割机等粮食生产关键机具。",
    requirements: "1. 河北省户籍或在河北省注册的农业经营主体\n2. 购机人须直接从事农业生产\n3. 购买的农机须在补贴目录范围内\n4. 每户年度补贴机具数量不超过5台\n5. 须在购机后30日内提交补贴申请",
    applicationUrl: "http://www.hebnjbt.gov.cn",
    source: "河北省农业农村厅",
    status: "active",
  },
  {
    title: "山东省2025年农机报废更新补贴政策",
    policyNumber: "鲁农机〔2025〕08号",
    region: "山东",
    category: "scrap",
    machineryTypes: ["拖拉机", "联合收割机", "播种机", "插秧机"],
    subsidyAmount: 15000,
    subsidyRatio: null,
    maxSubsidy: 50000,
    effectiveDate: new Date("2025-01-01"),
    expiryDate: new Date("2026-06-30"),
    description: "山东省对老旧农机实施报废更新补贴，报废老旧农机并购买新机的，可同时享受报废补贴和购置补贴。报废大中型拖拉机补贴1.5万元，联合收割机补贴3万元，最高补贴5万元。",
    requirements: "1. 山东省户籍或在山东省注册的农业经营主体\n2. 报废机具须使用满8年（收割机满6年）\n3. 机具须有合法来源证明（登记证书或购机发票）\n4. 报废机具须送至指定拆解企业\n5. 购买新机须在补贴目录范围内",
    applicationUrl: "http://www.sdnjbt.gov.cn",
    source: "山东省农业农村厅",
    status: "active",
  },
  {
    title: "河南省2025年农机深松整地作业补贴",
    policyNumber: "豫农机〔2025〕05号",
    region: "河南",
    category: "operation",
    machineryTypes: ["深松机", "大马力拖拉机"],
    subsidyAmount: 35,
    subsidyRatio: null,
    maxSubsidy: null,
    effectiveDate: new Date("2025-06-01"),
    expiryDate: new Date("2025-11-30"),
    description: "河南省对农机深松整地作业给予补贴，每亩补贴35元。鼓励使用大马力拖拉机配套深松机进行30cm以上深松作业，改善土壤耕层结构，提升粮食产量。",
    requirements: "1. 在河南省行政区域内实施深松作业\n2. 作业深度须达到30cm以上\n3. 作业面积须经GPS核实\n4. 补贴对象为实施作业的农机合作社或农机户\n5. 须在作业完成后15日内提交验收申请",
    applicationUrl: "http://www.hnnjbt.gov.cn",
    source: "河南省农业农村厅",
    status: "active",
  },
  {
    title: "黑龙江省2025年大型农机购置累加补贴",
    policyNumber: "黑农机〔2025〕10号",
    region: "黑龙江",
    category: "purchase",
    machineryTypes: ["200马力以上拖拉机", "大型联合收割机", "青饲料收获机", "打捆机"],
    subsidyAmount: null,
    subsidyRatio: 0.35,
    maxSubsidy: 150000,
    effectiveDate: new Date("2025-04-01"),
    expiryDate: new Date("2026-03-31"),
    description: "黑龙江省对购置200马力以上大型拖拉机、大型联合收割机等给予累加补贴，在中央补贴基础上额外补贴5%-10%，单台最高补贴15万元。重点支持粮食主产区的大型农机化发展。",
    requirements: "1. 黑龙江省户籍或在黑龙江省注册的农业经营主体\n2. 农业经营规模不低于200亩\n3. 购机须用于自有耕地作业\n4. 须提供土地流转证明或承包合同\n5. 每户年度补贴机具不超过3台",
    applicationUrl: "http://www.hljnjbt.gov.cn",
    source: "黑龙江省农业农村厅",
    status: "active",
  },
  {
    title: "内蒙古自治区2025年牧区机械化补贴政策",
    policyNumber: "内农机〔2025〕06号",
    region: "内蒙古",
    category: "purchase",
    machineryTypes: ["青饲料收获机", "打捆机", "裹包机", "TMR搅拌车", "撒肥车"],
    subsidyAmount: null,
    subsidyRatio: 0.3,
    maxSubsidy: 60000,
    effectiveDate: new Date("2025-03-15"),
    expiryDate: new Date("2026-03-14"),
    description: "内蒙古自治区针对牧区特色，对饲草收获加工机械、养殖设备等给予专项补贴。补贴比例不超过购机价格30%，单台最高补贴6万元。支持牧区饲草机械化生产和规模化养殖。",
    requirements: "1. 内蒙古自治区牧区户籍或注册的牧业经营主体\n2. 须在牧区从事畜牧业生产经营\n3. 购机须在牧区机械化补贴目录范围内\n4. 牧业合作社优先补贴\n5. 购机后须用于自有牧场作业",
    applicationUrl: "http://www.nmgnjbt.gov.cn",
    source: "内蒙古自治区农牧厅",
    status: "active",
  },
  {
    title: "农业农村部2025年全国农机购置补贴政策",
    policyNumber: "农业农村部公告〔2025〕1号",
    region: "全国",
    category: "purchase",
    machineryTypes: ["拖拉机", "联合收割机", "播种机", "插秧机", "植保无人机", "打捆机", "烘干机"],
    subsidyAmount: null,
    subsidyRatio: 0.3,
    maxSubsidy: 100000,
    effectiveDate: new Date("2025-01-01"),
    expiryDate: new Date("2026-12-31"),
    description: "农业农村部发布的全国性农机购置补贴政策，对购置符合条件的农业机械给予补贴。补贴标准按档次分档确定，补贴额不超过机具销售均价的30%，单台最高补贴10万元。覆盖全国31个省区市。",
    requirements: "1. 直接从事农业生产的个人或农业经营组织\n2. 购机须在补贴产品目录范围内\n3. 须在购机后按规定时限内申请\n4. 补贴机具须在2年内不转让\n5. 每户年度享受补贴资金不超过50万元",
    applicationUrl: "http://www.njbt.gov.cn",
    source: "农业农村部",
    status: "active",
  },
  {
    title: "江苏省2025年农机贷款贴息政策",
    policyNumber: "苏农机〔2025〕03号",
    region: "江苏",
    category: "loan",
    machineryTypes: ["拖拉机", "联合收割机", "插秧机", "烘干机"],
    subsidyAmount: null,
    subsidyRatio: 0.5,
    maxSubsidy: 30000,
    effectiveDate: new Date("2025-01-01"),
    expiryDate: new Date("2026-12-31"),
    description: "江苏省对农机购置贷款给予贴息补贴，贴息比例为贷款利息的50%，单台设备最高贴息3万元。降低农户购机融资成本，鼓励通过贷款方式购置农机设备。",
    requirements: "1. 江苏省户籍或在江苏省注册的农业经营主体\n2. 贷款须用于购置补贴目录内农机\n3. 贷款须来自指定合作银行\n4. 须按期偿还贷款本息\n5. 贴息资金在贷款还清后一次性发放",
    applicationUrl: "http://www.jsnjbt.gov.cn",
    source: "江苏省农业农村厅",
    status: "active",
  },
  {
    title: "新疆维吾尔自治区2025年棉花采收机械化补贴",
    policyNumber: "新农机〔2025〕04号",
    region: "新疆",
    category: "purchase",
    machineryTypes: ["采棉机", "大型拖拉机", "播种机"],
    subsidyAmount: null,
    subsidyRatio: 0.25,
    maxSubsidy: 200000,
    effectiveDate: new Date("2025-02-01"),
    expiryDate: new Date("2026-01-31"),
    description: "新疆针对棉花产业机械化，对购置采棉机及配套设备给予专项补贴。补贴比例不超过购机价格25%，单台最高补贴20万元。推动新疆棉花全程机械化，提升采收效率。",
    requirements: "1. 新疆维吾尔自治区棉花种植户或经营主体\n2. 棉花种植面积不低于100亩\n3. 购机须用于自有棉田作业\n4. 须提供土地承包或流转证明\n5. 采棉机操作人员须持证上岗",
    applicationUrl: "http://www.xjnjbt.gov.cn",
    source: "新疆维吾尔自治区农业农村厅",
    status: "active",
  },
];

// ═══════════════════════════════════════════════════════
// 农机登记信息
// ═══════════════════════════════════════════════════════

interface MachinerySeed {
  registrationNo: string;
  plateNumber: string | null;
  ownerName: string;
  brandName: string;
  modelName: string;
  category: string;
  enginePower: number | null;
  emissionStandard: string;
  inspectionDate: Date;
  inspectionResult: string;
  registrationStatus: string;
}

const MACHINERY: MachinerySeed[] = [
  {
    registrationNo: " 冀农机字第A20240001号",
    plateNumber: "冀A·农机001",
    ownerName: "石家庄市张三农机合作社",
    brandName: "John Deere",
    modelName: "8R 410",
    category: "拖拉机",
    enginePower: 410,
    emissionStandard: "国IV",
    inspectionDate: new Date("2024-08-15"),
    inspectionResult: "合格",
    registrationStatus: "active",
  },
  {
    registrationNo: " 冀农机字第A20240002号",
    plateNumber: "冀A·农机002",
    ownerName: "邢台李四家庭农场",
    brandName: "CLAAS",
    modelName: "LEXION 780",
    category: "联合收割机",
    enginePower: 780,
    emissionStandard: "Stage V",
    inspectionDate: new Date("2024-09-20"),
    inspectionResult: "合格",
    registrationStatus: "active",
  },
  {
    registrationNo: " 鲁农机字第B20240003号",
    plateNumber: "鲁B·农机003",
    ownerName: "潍坊寿光王五农业公司",
    brandName: "New Holland",
    modelName: "T7.315",
    category: "拖拉机",
    enginePower: 315,
    emissionStandard: "国IV",
    inspectionDate: new Date("2024-07-10"),
    inspectionResult: "合格",
    registrationStatus: "active",
  },
  {
    registrationNo: " 鲁农机字第B20240004号",
    plateNumber: "鲁B·农机004",
    ownerName: "德州赵六农机合作社",
    brandName: "Kubota",
    modelName: "PRO688Q",
    category: "联合收割机",
    enginePower: 67,
    emissionStandard: "国III",
    inspectionDate: new Date("2024-10-05"),
    inspectionResult: "合格",
    registrationStatus: "active",
  },
  {
    registrationNo: " 豫农机字第C20240005号",
    plateNumber: "豫C·农机005",
    ownerName: "洛阳孟津孙七农场",
    brandName: "Case IH",
    modelName: "Puma 240",
    category: "拖拉机",
    enginePower: 240,
    emissionStandard: "国IV",
    inspectionDate: new Date("2024-06-18"),
    inspectionResult: "合格",
    registrationStatus: "active",
  },
  {
    registrationNo: " 黑农机字第D20240006号",
    plateNumber: "黑D·农机006",
    ownerName: "哈尔滨周八农业开发有限公司",
    brandName: "John Deere",
    modelName: "S790",
    category: "联合收割机",
    enginePower: 527,
    emissionStandard: "Stage V",
    inspectionDate: new Date("2024-08-30"),
    inspectionResult: "合格",
    registrationStatus: "active",
  },
  {
    registrationNo: " 黑农机字第D20240007号",
    plateNumber: "黑D·农机007",
    ownerName: "绥化市吴九家庭农场",
    brandName: "CLAAS",
    modelName: "JAGUAR 980",
    category: "青饲料收获机",
    enginePower: 780,
    emissionStandard: "Stage V",
    inspectionDate: new Date("2024-09-12"),
    inspectionResult: "合格",
    registrationStatus: "active",
  },
  {
    registrationNo: " 内农机字第E20240008号",
    plateNumber: "蒙E·农机008",
    ownerName: "锡林郭勒盟郑十牧业合作社",
    brandName: "Krone",
    modelName: "Big Pack 1290 HDP",
    category: "打捆机",
    enginePower: null,
    emissionStandard: "不适用",
    inspectionDate: new Date("2024-07-25"),
    inspectionResult: "合格",
    registrationStatus: "active",
  },
  {
    registrationNo: " 苏农机字第F20240009号",
    plateNumber: "苏F·农机009",
    ownerName: "盐城市钱十一农机服务公司",
    brandName: "New Holland",
    modelName: "CR8.90",
    category: "联合收割机",
    enginePower: 448,
    emissionStandard: "Stage V",
    inspectionDate: new Date("2024-10-20"),
    inspectionResult: "合格",
    registrationStatus: "active",
  },
  {
    registrationNo: " 新农机字第G20240010号",
    plateNumber: "新G·农机010",
    ownerName: "阿克苏市孙十二棉花种植合作社",
    brandName: "John Deere",
    modelName: "CP690",
    category: "采棉机",
    enginePower: 417,
    emissionStandard: "Stage V",
    inspectionDate: new Date("2024-09-05"),
    inspectionResult: "合格",
    registrationStatus: "active",
  },
];

async function main() {
  console.log("开始播种政府农机数据...");

  // 清空旧数据（可重复执行）
  await prisma.govSubsidyPolicy.deleteMany({});
  await prisma.govMachineryData.deleteMany({});
  console.log("已清空旧数据");

  // 播种补贴政策
  console.log("\n--- 补贴政策 ---");
  for (const p of POLICIES) {
    await prisma.govSubsidyPolicy.create({
      data: {
        title: p.title,
        policyNumber: p.policyNumber,
        region: p.region,
        category: p.category,
        machineryTypes: JSON.stringify(p.machineryTypes),
        subsidyAmount: p.subsidyAmount,
        subsidyRatio: p.subsidyRatio,
        maxSubsidy: p.maxSubsidy,
        effectiveDate: p.effectiveDate,
        expiryDate: p.expiryDate,
        description: p.description,
        requirements: p.requirements,
        applicationUrl: p.applicationUrl,
        source: p.source,
        status: p.status,
      },
    });
    console.log(`  创建: [${p.region}] ${p.title}`);
  }

  // 播种登记信息
  console.log("\n--- 登记信息 ---");
  for (const m of MACHINERY) {
    await prisma.govMachineryData.create({
      data: {
        registrationNo: m.registrationNo,
        plateNumber: m.plateNumber,
        ownerName: m.ownerName,
        brandName: m.brandName,
        modelName: m.modelName,
        category: m.category,
        enginePower: m.enginePower,
        emissionStandard: m.emissionStandard,
        inspectionDate: m.inspectionDate,
        inspectionResult: m.inspectionResult,
        registrationStatus: m.registrationStatus,
        dataSource: "gov_registry",
      },
    });
    console.log(`  创建: ${m.brandName} ${m.modelName} (${m.registrationNo.trim()})`);
  }

  const policyCount = await prisma.govSubsidyPolicy.count();
  const machineryCount = await prisma.govMachineryData.count();
  console.log(`\n完成! 共 ${policyCount} 条补贴政策, ${machineryCount} 条登记信息`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
