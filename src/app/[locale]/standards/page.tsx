import type { Metadata } from "next";
import { generatePageMetadata } from "@/lib/seo-metadata";
import { CheckCircle2, FileText, Clock, Globe, Award, Shield } from "lucide-react";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  return generatePageMetadata("standards", locale, "/standards");
}

const STANDARDS = [
  {
    title: "二手农机技术状况评估规范",
    status: "published",
    number: "T/CAMA XX-2026",
    description: "规定二手农机技术状况评估的等级标准（A/B/C/D四级）、检测项目（5大类20项）、评估流程和报告格式。",
    scope: "适用于青储机、收割机、打捆机、拖拉机等主要农机品类的二手设备评估",
    date: "2026-03",
  },
  {
    title: "农机跨境交易服务规范",
    status: "published",
    number: "T/CAMA XX-2026",
    description: "规范农机跨境交易的服务流程，包括信息发布、验车、支付、物流、售后各环节的标准要求。",
    scope: "适用于中国境内农机出口至俄罗斯、中亚、东欧、非洲等市场的交易服务",
    date: "2026-04",
  },
  {
    title: "农机一机一码身份编码规则",
    status: "drafting",
    number: "T/CAMA XX-2026",
    description: "定义农机唯一身份编码的编码规则、信息结构、二维码生成与识读标准，实现全生命周期溯源。",
    scope: "适用于所有在中国市场流通的二手农机设备",
    date: "预计 2026-Q4",
  },
  {
    title: "农机检验检测机构能力要求",
    status: "drafting",
    number: "T/CAMA XX-2027",
    description: "规定从事农机检验检测的机构应具备的人员资质、设备条件、检测能力和质量管理体系要求。",
    scope: "适用于第三方农机检测机构、主机厂授权检测中心",
    date: "预计 2027-Q1",
  },
  {
    title: "农机出口技术准备指南",
    status: "published",
    number: "团体标准",
    description: "指导农机出口前的技术准备工作，包括清洁、维修、改装、认证、包装、运输固定等环节。",
    scope: "适用于所有出口农机的技术准备过程",
    date: "2026-05",
  },
  {
    title: "农机交易从业人员资质要求",
    status: "planning",
    number: "拟立项",
    description: "规定农机交易中介、评估师、检测员等从业人员的资质等级、培训要求和考核标准。",
    scope: "适用于农机交易行业的各类从业人员",
    date: "拟 2027-Q2 立项",
  },
];

const CERTIFICATION_FLOW = [
  { step: 1, title: "机构认证", desc: "营业执照、经营许可证、场地证明", icon: Shield },
  { step: 2, title: "人员认证", desc: "评估师资格证书、检测员上岗证", icon: Award },
  { step: 3, title: "车辆认证", desc: "第三方检测报告、一机一码档案", icon: FileText },
  { step: 4, title: "平台审核", desc: "提交材料→平台审核→认证标识上线", icon: CheckCircle2 },
];

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  published: { label: "已发布", color: "bg-green-100 text-green-700" },
  drafting: { label: "制定中", color: "bg-blue-100 text-blue-700" },
  planning: { label: "规划中", color: "bg-gray-100 text-gray-600" },
};

export default function StandardsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  void params;

  return (
    <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="mb-10 text-center">
        <h1 className="text-3xl font-bold text-gray-900 sm:text-4xl">
          标准规范
        </h1>
        <p className="mt-3 text-gray-500">
          推动农机交易行业标准化、规范化，保障交易双方权益
        </p>
      </div>

      {/* Standards List */}
      <div className="space-y-4 mb-12">
        <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <FileText className="h-5 w-5 text-blue-600" />
          已发布与制定中的标准
        </h2>
        {STANDARDS.map((std, idx) => {
          const status = STATUS_MAP[std.status];
          return (
            <div
              key={idx}
              className="rounded-xl border border-gray-200 p-5 hover:border-blue-300 hover:shadow-sm transition-all"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="font-semibold text-gray-900">{std.title}</h3>
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${status.color}`}>
                      {status.label}
                    </span>
                  </div>
                  <p className="text-sm text-gray-600 mb-2">{std.description}</p>
                  <div className="flex flex-wrap gap-4 text-xs text-gray-400">
                    <span>编号: {std.number}</span>
                    <span>适用范围: {std.scope}</span>
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" /> {std.date}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Certification Flow */}
      <div className="mb-12">
        <h2 className="text-xl font-semibold text-gray-900 mb-6 flex items-center gap-2">
          <Shield className="h-5 w-5 text-blue-600" />
          三重认证流程
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {CERTIFICATION_FLOW.map((item) => {
            const Icon = item.icon;
            return (
              <div key={item.step} className="relative rounded-xl border border-gray-200 p-5">
                <div className="absolute -top-3 -left-3 flex h-8 w-8 items-center justify-center rounded-full bg-blue-600 text-white text-sm font-bold">
                  {item.step}
                </div>
                <Icon className="h-8 w-8 text-blue-600 mb-3 mt-1" />
                <h3 className="font-semibold text-gray-900 mb-1">{item.title}</h3>
                <p className="text-sm text-gray-500">{item.desc}</p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Compliance Statement */}
      <div className="rounded-xl bg-blue-50 border border-blue-200 p-6">
        <div className="flex items-start gap-3">
          <Globe className="h-6 w-6 text-blue-600 flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="font-semibold text-gray-900 mb-2">平台合规承诺</h3>
            <p className="text-sm text-gray-600 leading-relaxed">
              神雕农机全球交易平台严格遵守国家相关法律法规，积极参与中国农业机械工业协会（CAMA）团体标准制定工作。
              平台所有交易流程均参照已发布的团体标准执行，确保交易透明、设备品质可追溯、买卖双方权益得到保障。
            </p>
            <p className="text-sm text-gray-600 leading-relaxed mt-2">
              我们承诺：平台可以盈利但不可暴利。平台赚的是"效率提升节省出来的钱"，而非"信息不对称多出来的钱"。
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
