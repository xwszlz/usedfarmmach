/**
 * 金融保险服务种子数据
 * 运行: npx tsx prisma/seed-finance.ts
 * 类型覆盖：贷款(loan)、保险(insurance)、租赁(lease)
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

interface FinanceSeed {
  serviceName: string;
  serviceType: string;
  provider: string;
  interestRate: number | null;
  maxAmount: number | null;
  maxTerm: number | null;
  downPayment: number | null;
  coverage: string | null;
  premium: number | null;
  description: string;
  requirements: string;
  sortOrder: number;
}

const SERVICES: FinanceSeed[] = [
  // === 贷款产品 (loan) ===
  {
    serviceName: "农机设备分期贷款",
    serviceType: "loan",
    provider: "中国农业银行",
    interestRate: 4.35,
    maxAmount: 500000,
    maxTerm: 36,
    downPayment: 20,
    coverage: null,
    premium: null,
    description: "面向农机购买者提供设备分期贷款，首付低至20%，最长期限36个月。支持拖拉机、收割机、打捆机等各类农机设备。",
    requirements: "1. 年龄18-60周岁，具有完全民事行为能力\n2. 有稳定收入来源，具备还款能力\n3. 购买设备须用于农业生产\n4. 提供身份证明、收入证明、购机合同\n5. 需提供设备抵押或担保人",
    sortOrder: 1,
  },
  {
    serviceName: "跨境农机采购贷款",
    serviceType: "loan",
    provider: "中国进出口银行",
    interestRate: 3.85,
    maxAmount: 2000000,
    maxTerm: 60,
    downPayment: 30,
    coverage: null,
    premium: null,
    description: "面向跨境农机采购商提供的专项贷款，支持大宗设备出口采购，利率优惠，额度高，期限灵活。覆盖出口至俄罗斯、中亚、东南亚等地区的农机交易。",
    requirements: "1. 企业法人或个体工商户\n2. 有跨境贸易经验，年营业额不低于100万元\n3. 提供进出口相关资质证明\n4. 购机合同及报关单据\n5. 需提供不低于贷款额30%的担保",
    sortOrder: 2,
  },
  {
    serviceName: "二手农机快速贷款",
    serviceType: "loan",
    provider: "网商银行",
    interestRate: 5.8,
    maxAmount: 100000,
    maxTerm: 24,
    downPayment: 10,
    coverage: null,
    premium: null,
    description: "面向个体农户和小型合作社的快速审批贷款，线上申请，最快当天放款。适合急需购买二手农机设备的农户。",
    requirements: "1. 年龄22-55周岁\n2. 信用记录良好（征信无不良）\n3. 实名认证手机号使用6个月以上\n4. 有农业生产相关经营证明\n5. 线上完成申请，无需线下抵押",
    sortOrder: 3,
  },
  {
    serviceName: "农机合作社集群贷款",
    serviceType: "loan",
    provider: "中国邮政储蓄银行",
    interestRate: 4.05,
    maxAmount: 1000000,
    maxTerm: 48,
    downPayment: 15,
    coverage: null,
    premium: null,
    description: "面向农机专业合作社的集群授信贷款，以合作社为单位申请，额度高、利率低，支持批量采购农机设备。",
    requirements: "1. 注册成立满2年的农机合作社\n2. 社员不少于10人\n3. 近年度经营收入不低于50万元\n4. 提供合作社营业执照、章程、财务报表\n5. 合作社理事长提供连带担保",
    sortOrder: 4,
  },
  // === 保险产品 (insurance) ===
  {
    serviceName: "二手农机交易质量险",
    serviceType: "insurance",
    provider: "中国人保财险",
    interestRate: null,
    maxAmount: null,
    maxTerm: 12,
    downPayment: null,
    coverage: "覆盖发动机、传动系统、液压系统、电气系统四大核心部件的因质量问题导致的维修费用。单次最高赔付5万元，累计最高赔付15万元。",
    premium: 1.5,
    description: "为二手农机交易提供质量保障保险，买家购机后12个月内，如因设备本身质量问题导致的维修费用，由保险公司承担赔付。",
    requirements: "1. 通过神雕农机平台完成交易\n2. 交易前完成第三方检测报告\n3. 保费按设备成交价的1.5%收取\n4. 理赔需提供维修发票及检测证明\n5. 自然损耗及人为损坏不在保障范围",
    sortOrder: 5,
  },
  {
    serviceName: "农机运输物流险",
    serviceType: "insurance",
    provider: "中国太平洋保险",
    interestRate: null,
    maxAmount: null,
    maxTerm: null,
    downPayment: null,
    coverage: "覆盖农机设备在运输途中的因交通事故、自然灾害、装卸事故等导致的设备损坏或灭失。最高赔付额为设备声明价值的100%。",
    premium: 0.8,
    description: "为农机跨境运输及国内长途运输提供全程物流保险，保障设备从发货到签收全过程的运输安全。",
    requirements: "1. 运输设备须有明确的发货地和收货地\n2. 保费按设备声明价值的0.8%收取\n3. 需提供运输合同及设备价值证明\n4. 理赔需在事故发生后48小时内报案\n5. 赔付金额以设备实际损失为限",
    sortOrder: 6,
  },
  {
    serviceName: "农机作业责任险",
    serviceType: "insurance",
    provider: "中华联合保险",
    interestRate: null,
    maxAmount: null,
    maxTerm: 12,
    downPayment: null,
    coverage: "覆盖农机作业过程中对第三方造成的人身伤害及财产损失。每次事故最高赔付50万元，累计最高赔付100万元。",
    premium: 0.5,
    description: "为农机作业提供第三方责任保险，保障作业过程中意外事故导致的第三方损失，降低农机使用风险。",
    requirements: "1. 农机设备须已完成登记备案\n2. 保费按设备购置价的0.5%收取\n3. 操作人员须持有相应资质证书\n4. 酒驾、违规操作不在保障范围\n5. 年度投保，到期续保",
    sortOrder: 7,
  },
  // === 租赁产品 (lease) ===
  {
    serviceName: "农机设备融资租赁",
    serviceType: "lease",
    provider: "远东宏信租赁",
    interestRate: 5.2,
    maxAmount: 3000000,
    maxTerm: 60,
    downPayment: 10,
    coverage: null,
    premium: null,
    description: "以融资租赁方式提供农机设备使用权，期满后可购买、续租或退还。适合资金压力较大但急需设备投入生产的农户和企业。",
    requirements: "1. 企业或个体工商户，经营满1年\n2. 信用记录良好\n3. 首付比例不低于设备价值的10%\n4. 提供经营场所证明及财务报表\n5. 租赁期间设备须购买保险",
    sortOrder: 8,
  },
  {
    serviceName: "季节性农机短期租赁",
    serviceType: "lease",
    provider: "神雕农机自营",
    interestRate: null,
    maxAmount: null,
    maxTerm: 3,
    downPayment: null,
    coverage: null,
    premium: null,
    description: "面向农忙季节的短期设备租赁服务，按日/周/月计费，灵活租期。涵盖拖拉机、收割机、播种机等常用农机，含配送及基础维护。",
    requirements: "1. 提供有效身份证明\n2. 缴纳设备价值20%的押金\n3. 最短租期1天，最长3个月\n4. 操作人员须持有农机操作证\n5. 设备如有损坏照价赔偿",
    sortOrder: 9,
  },
];

async function main() {
  console.log("开始播种金融保险服务数据...");

  // 先清空旧数据（可重复执行）
  await prisma.financialService.deleteMany({});
  console.log("已清空旧数据");

  for (const svc of SERVICES) {
    await prisma.financialService.create({
      data: {
        serviceName: svc.serviceName,
        serviceType: svc.serviceType,
        provider: svc.provider,
        interestRate: svc.interestRate,
        maxAmount: svc.maxAmount,
        maxTerm: svc.maxTerm,
        downPayment: svc.downPayment,
        coverage: svc.coverage,
        premium: svc.premium,
        description: svc.description,
        requirements: svc.requirements,
        sortOrder: svc.sortOrder,
        isActive: true,
      },
    });
    console.log(`  创建: [${svc.serviceType}] ${svc.serviceName}`);
  }

  const total = await prisma.financialService.count();
  console.log(`\n完成! 共 ${total} 个金融保险产品`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
