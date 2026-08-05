import type { Metadata } from "next";
import { generatePageMetadata } from "@/lib/seo-metadata";
import { CheckCircle2, FileText, Clock, Globe, Award, Shield, Building2 } from "lucide-react";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  return generatePageMetadata("standards", locale, "/standards");
}

// 标准类别分组
const CATEGORY_GROUPS = {
  enterprise: { label: "企业标准", icon: Building2, color: "text-orange-600" },
  industry: { label: "行业标准", icon: FileText, color: "text-blue-600" },
  international: { label: "国际标准", icon: Globe, color: "text-green-600" },
};

const STANDARDS = [
  // === 企业标准 ===
  {
    category: "enterprise",
    title: "神雕农机二手农机检测评估规范",
    status: "published",
    number: "SD/QB-001-2026",
    description: "神雕农机企业标准，规定二手农机的检测流程、评估等级（A/B/C/D四级）、5大类20项检测项目及评分标准。涵盖发动机、传动系统、液压系统、电气系统、外观结构五大模块的全面检测。",
    scope: "适用于神雕农机平台所有二手农机设备的检测评估",
    date: "2026-01",
  },
  {
    category: "enterprise",
    title: "神雕农机跨境交易服务规范",
    status: "published",
    number: "SD/QB-002-2026",
    description: "规范农机跨境交易的全流程服务标准，包括设备信息发布、第三方验车、资金监管支付、国际物流运输、售后维保等各环节的操作规程和质量要求。明确各环节责任主体和时限要求。",
    scope: "适用于中国农机出口至俄罗斯、中亚、东欧、非洲、东南亚等市场的交易服务",
    date: "2026-02",
  },
  {
    category: "enterprise",
    title: "神雕农机一机一码身份编码规则",
    status: "drafting",
    number: "SD/QB-003-2026",
    description: "定义神雕农机平台农机唯一身份编码的编码规则、信息结构、二维码生成与识读标准。实现从出厂到报废的全生命周期溯源，包含制造信息、交易记录、维保历史等核心数据。",
    scope: "适用于在神雕农机平台流通的所有二手农机设备",
    date: "预计 2026-Q4",
  },
  // === 行业标准 ===
  {
    category: "industry",
    title: "二手农业机械技术状况评估规范",
    status: "published",
    number: "T/CAMA XX-2026",
    description: "中国农业机械工业协会（CAMA）团体标准，规定二手农业机械技术状况评估的等级标准（A/B/C/D四级）、检测项目（5大类20项）、评估流程和报告格式。为行业提供统一的评估依据。",
    scope: "适用于青储机、收割机、打捆机、拖拉机等主要农机品类的二手设备评估",
    date: "2026-03",
  },
  {
    category: "industry",
    title: "农业机械安全要求",
    status: "published",
    number: "GB 10395.1-2025",
    description: "国家标准，规定农业机械的设计、制造、使用和维护中的安全要求。涵盖机械安全、电气安全、噪声控制、操作防护等方面，确保操作人员和使用环境的安全。",
    scope: "适用于所有在中国境内销售和使用的农业机械",
    date: "2025-06",
  },
  {
    category: "industry",
    title: "二手农业机械质量等级",
    status: "published",
    number: "T/CAMA XX-2025",
    description: "团体标准，建立二手农业机械的质量分级体系。根据使用年限、工作小时、技术状况、外观完好度等指标，将二手农机分为优等品、一等品、合格品和等外品四个等级。",
    scope: "适用于所有二手农业机械的质量分级与定价参考",
    date: "2025-09",
  },
  {
    category: "industry",
    title: "农机检验检测机构能力要求",
    status: "drafting",
    number: "T/CAMA XX-2027",
    description: "规定从事农机检验检测的机构应具备的人员资质、设备条件、检测能力和质量管理体系要求。建立检测机构准入标准和评级机制，确保检测结果的权威性和公正性。",
    scope: "适用于第三方农机检测机构、主机厂授权检测中心",
    date: "预计 2027-Q1",
  },
  {
    category: "industry",
    title: "农机交易从业人员资质要求",
    status: "planning",
    number: "拟立项",
    description: "规定农机交易中介、评估师、检测员等从业人员的资质等级、培训要求和考核标准。建立从业人员持证上岗制度，提升行业服务专业化水平。",
    scope: "适用于农机交易行业的各类从业人员",
    date: "拟 2027-Q2 立项",
  },
  // === 国际标准 ===
  {
    category: "international",
    title: "ISO 4254 农业机械安全",
    status: "published",
    number: "ISO 4254-1:2023",
    description: "国际标准化组织（ISO）发布的农业机械安全国际标准，规定农业机械的基本安全要求和验证方法。涵盖防护装置、紧急停止、操作位置、维修通道等安全设计要求，是农机国际贸易的重要技术依据。",
    scope: "适用于出口至欧盟、北美等市场的农业机械安全合规要求",
    date: "2023",
  },
  {
    category: "international",
    title: "OECD 拖拉机试验规范",
    status: "published",
    number: "OECD Code 2",
    description: "经济合作与发展组织（OECD）官方拖拉机试验标准代码，规定农业拖拉机的性能试验方法和报告格式。涵盖功率测试、液压提升力测试、PTO性能、噪声测试等核心试验项目。OECD认证是国际公认的拖拉机性能认证。",
    scope: "适用于出口至OECD成员国的农业拖拉机性能认证",
    date: "2022",
  },
  {
    category: "international",
    title: "ISO 3600 农林机械 操作手册",
    status: "published",
    number: "ISO 3600:2015",
    description: "国际标准，规定农林机械操作手册的内容要求、编写规范和格式标准。确保操作手册包含安全信息、操作规程、维护指南等必要内容，便于用户正确安全地使用设备。",
    scope: "适用于所有出口农机的操作手册编写要求",
    date: "2015",
  },
  {
    category: "international",
    title: "EU 机械指令 2006/42/EC",
    status: "published",
    number: "2006/42/EC",
    description: "欧盟机械指令，规定在欧盟市场销售的机械设备必须满足的安全和健康要求。农机出口至欧盟须通过CE认证，加贴CE标志。是农机进入欧洲市场的强制性合规要求。",
    scope: "适用于出口至欧盟市场的所有农业机械",
    date: "2006",
  },
];

const CERTIFICATION_FLOW = [
  {
    step: 1,
    title: "机构认证",
    desc: "营业执照、经营许可证、场地证明、注册资本验证",
    icon: Shield,
    detail: "验证企业合法经营资质，确认经营场所和仓储条件符合平台要求",
  },
  {
    step: 2,
    title: "人员认证",
    desc: "评估师资格证书、检测员上岗证、农机操作证",
    icon: Award,
    detail: "审核从业人员专业资质，确保具备农机检测评估的专业能力",
  },
  {
    step: 3,
    title: "车辆认证",
    desc: "第三方检测报告、一机一码档案、维保记录",
    icon: FileText,
    detail: "对设备进行全面检测，建立一机一码身份档案，生成检测报告",
  },
  {
    step: 4,
    title: "平台审核",
    desc: "提交材料→平台审核→现场验核→认证标识上线",
    icon: CheckCircle2,
    detail: "平台对提交材料进行审核，必要时进行现场验核，通过后赋予认证标识",
  },
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
        <p className="mt-1 text-sm text-gray-400">
          企业标准 · 行业标准 · 国际标准 — 三级标准体系全面覆盖
        </p>
      </div>

      {/* Standards List — 按类别分组 */}
      <div className="space-y-8 mb-12">
        {Object.entries(CATEGORY_GROUPS).map(([groupKey, groupInfo]) => {
          const groupStandards = STANDARDS.filter((s) => s.category === groupKey);
          if (groupStandards.length === 0) return null;
          const GroupIcon = groupInfo.icon;
          return (
            <div key={groupKey}>
              <h2 className={`text-xl font-semibold text-gray-900 mb-4 flex items-center gap-2 ${groupInfo.color}`}>
                <GroupIcon className="h-5 w-5" />
                {groupInfo.label}
                <span className="text-sm font-normal text-gray-400">({groupStandards.length})</span>
              </h2>
              <div className="space-y-4">
                {groupStandards.map((std, idx) => {
                  const status = STATUS_MAP[std.status];
                  return (
                    <div
                      key={`${groupKey}-${idx}`}
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
            </div>
          );
        })}
      </div>

      {/* Certification Flow */}
      <div className="mb-12">
        <h2 className="text-xl font-semibold text-gray-900 mb-2 flex items-center gap-2">
          <Shield className="h-5 w-5 text-blue-600" />
          神雕农机三重认证流程
        </h2>
        <p className="text-sm text-gray-500 mb-6">
          神雕农机平台建立"机构+人员+车辆"三重认证体系，确保交易安全与设备品质可追溯
        </p>
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
                <p className="text-sm text-gray-500 mb-2">{item.desc}</p>
                <p className="text-xs text-gray-400">{item.detail}</p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Certification Steps Detail */}
      <div className="mb-12 rounded-xl border border-gray-200 p-6">
        <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <Award className="h-5 w-5 text-orange-600" />
          神雕农机认证申请流程
        </h3>
        <ol className="space-y-3">
          <li className="flex gap-3 text-sm text-gray-600">
            <span className="flex-shrink-0 flex h-6 w-6 items-center justify-center rounded-full bg-orange-100 text-orange-600 font-medium text-xs">1</span>
            <span><strong>在线申请：</strong>登录神雕农机平台，进入认证中心，选择认证类型（机构/人员/车辆），填写申请表并上传相关资质材料。</span>
          </li>
          <li className="flex gap-3 text-sm text-gray-600">
            <span className="flex-shrink-0 flex h-6 w-6 items-center justify-center rounded-full bg-orange-100 text-orange-600 font-medium text-xs">2</span>
            <span><strong>材料审核：</strong>平台审核团队在3个工作日内完成材料初审，必要时要求补充材料。审核通过后进入下一阶段。</span>
          </li>
          <li className="flex gap-3 text-sm text-gray-600">
            <span className="flex-shrink-0 flex h-6 w-6 items-center justify-center rounded-full bg-orange-100 text-orange-600 font-medium text-xs">3</span>
            <span><strong>现场验核：</strong>对于机构认证和车辆认证，平台安排专业人员上门验核。确认经营场所、设备状况与申请材料一致。</span>
          </li>
          <li className="flex gap-3 text-sm text-gray-600">
            <span className="flex-shrink-0 flex h-6 w-6 items-center justify-center rounded-full bg-orange-100 text-orange-600 font-medium text-xs">4</span>
            <span><strong>认证发放：</strong>验核通过后，平台在2个工作日内发放电子认证证书，并在平台展示认证标识。认证有效期1年，到期续审。</span>
          </li>
        </ol>
      </div>

      {/* Compliance Statement */}
      <div className="rounded-xl bg-blue-50 border border-blue-200 p-6">
        <div className="flex items-start gap-3">
          <Globe className="h-6 w-6 text-blue-600 flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="font-semibold text-gray-900 mb-2">平台合规承诺</h3>
            <p className="text-sm text-gray-600 leading-relaxed">
              神雕农机全球交易平台严格遵守国家相关法律法规，积极参与中国农业机械工业协会（CAMA）团体标准制定工作。
              平台所有交易流程均参照已发布的企业标准、行业标准及国际标准执行，确保交易透明、设备品质可追溯、买卖双方权益得到保障。
            </p>
            <p className="text-sm text-gray-600 leading-relaxed mt-2">
              我们承诺：平台可以盈利但不可暴利。平台赚的是"效率提升节省出来的钱"，而非"信息不对称多出来的钱"。
              所有认证信息公开透明，用户可随时查询验证。
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
