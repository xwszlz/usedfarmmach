import type { Metadata } from "next";
import { generatePageMetadata } from "@/lib/seo-metadata";
import { CheckCircle2, FileText, Clock, Globe, Award, Shield, Building2 } from "lucide-react";
import { translate } from "@/lib/i18n-runtime";
import { getLocale } from "next-intl/server";
export async function generateMetadata({ params, }: {
    params: Promise<{
        locale: string;
    }>;
}): Promise<Metadata> {
    const { locale } = await params;
    return generatePageMetadata("standards", locale, "/standards");
}
// 标准类别分组
function getCATEGORY_GROUPS(locale: string) {
  return {
    enterprise: { label: translate("企业标准", locale), icon: Building2, color: "text-orange-600" },
    industry: { label: translate("行业标准", locale), icon: FileText, color: "text-blue-600" },
    international: { label: translate("国际标准", locale), icon: Globe, color: "text-green-600" },
};
}
function getSTANDARDS(locale: string) {
  return [
    // === 企业标准 ===
    {
        category: "enterprise",
        title: translate("神雕农机二手农机检测评估规范", locale),
        status: "published",
        number: "SD/QB-001-2026",
        description: translate("神雕农机企业标准，规定二手农机的检测流程、评估等级（A/B/C/D四级）、5大类20项检测项目及评分标准。涵盖发动机、传动系统、液压系统、电气系统、外观结构五大模块的全面检测。", locale),
        scope: "\u9002\u7528\u4E8E\u795E\u96D5\u519C\u673A\u5E73\u53F0\u6240\u6709\u4E8C\u624B\u519C\u673A\u8BBE\u5907\u7684\u68C0\u6D4B\u8BC4\u4F30",
        date: "2026-01",
    },
    {
        category: "enterprise",
        title: translate("神雕农机跨境交易服务规范", locale),
        status: "published",
        number: "SD/QB-002-2026",
        description: translate("规范农机跨境交易的全流程服务标准，包括设备信息发布、第三方验车、资金监管支付、国际物流运输、售后维保等各环节的操作规程和质量要求。明确各环节责任主体和时限要求。", locale),
        scope: "\u9002\u7528\u4E8E\u4E2D\u56FD\u519C\u673A\u51FA\u53E3\u81F3\u4FC4\u7F57\u65AF\u3001\u4E2D\u4E9A\u3001\u4E1C\u6B27\u3001\u975E\u6D32\u3001\u4E1C\u5357\u4E9A\u7B49\u5E02\u573A\u7684\u4EA4\u6613\u670D\u52A1",
        date: "2026-02",
    },
    {
        category: "enterprise",
        title: translate("神雕农机一机一码身份编码规则", locale),
        status: "drafting",
        number: "SD/QB-003-2026",
        description: translate("定义神雕农机平台农机唯一身份编码的编码规则、信息结构、二维码生成与识读标准。实现从出厂到报废的全生命周期溯源，包含制造信息、交易记录、维保历史等核心数据。", locale),
        scope: "\u9002\u7528\u4E8E\u5728\u795E\u96D5\u519C\u673A\u5E73\u53F0\u6D41\u901A\u7684\u6240\u6709\u4E8C\u624B\u519C\u673A\u8BBE\u5907",
        date: "\u9884\u8BA1 2026-Q4",
    },
    // === 行业标准 ===
    {
        category: "industry",
        title: translate("二手农业机械技术状况评估规范", locale),
        status: "published",
        number: "T/CAMA XX-2026",
        description: translate("中国农业机械工业协会（CAMA）团体标准，规定二手农业机械技术状况评估的等级标准（A/B/C/D四级）、检测项目（5大类20项）、评估流程和报告格式。为行业提供统一的评估依据。", locale),
        scope: "\u9002\u7528\u4E8E\u9752\u50A8\u673A\u3001\u6536\u5272\u673A\u3001\u6253\u6346\u673A\u3001\u62D6\u62C9\u673A\u7B49\u4E3B\u8981\u519C\u673A\u54C1\u7C7B\u7684\u4E8C\u624B\u8BBE\u5907\u8BC4\u4F30",
        date: "2026-03",
    },
    {
        category: "industry",
        title: translate("农业机械安全要求", locale),
        status: "published",
        number: "GB 10395.1-2025",
        description: translate("国家标准，规定农业机械的设计、制造、使用和维护中的安全要求。涵盖机械安全、电气安全、噪声控制、操作防护等方面，确保操作人员和使用环境的安全。", locale),
        scope: "\u9002\u7528\u4E8E\u6240\u6709\u5728\u4E2D\u56FD\u5883\u5185\u9500\u552E\u548C\u4F7F\u7528\u7684\u519C\u4E1A\u673A\u68B0",
        date: "2025-06",
    },
    {
        category: "industry",
        title: translate("二手农业机械质量等级", locale),
        status: "published",
        number: "T/CAMA XX-2025",
        description: translate("团体标准，建立二手农业机械的质量分级体系。根据使用年限、工作小时、技术状况、外观完好度等指标，将二手农机分为优等品、一等品、合格品和等外品四个等级。", locale),
        scope: "\u9002\u7528\u4E8E\u6240\u6709\u4E8C\u624B\u519C\u4E1A\u673A\u68B0\u7684\u8D28\u91CF\u5206\u7EA7\u4E0E\u5B9A\u4EF7\u53C2\u8003",
        date: "2025-09",
    },
    {
        category: "industry",
        title: translate("农机检验检测机构能力要求", locale),
        status: "drafting",
        number: "T/CAMA XX-2027",
        description: translate("规定从事农机检验检测的机构应具备的人员资质、设备条件、检测能力和质量管理体系要求。建立检测机构准入标准和评级机制，确保检测结果的权威性和公正性。", locale),
        scope: "\u9002\u7528\u4E8E\u7B2C\u4E09\u65B9\u519C\u673A\u68C0\u6D4B\u673A\u6784\u3001\u4E3B\u673A\u5382\u6388\u6743\u68C0\u6D4B\u4E2D\u5FC3",
        date: "\u9884\u8BA1 2027-Q1",
    },
    {
        category: "industry",
        title: translate("农机交易从业人员资质要求", locale),
        status: "planning",
        number: "\u62DF\u7ACB\u9879",
        description: translate("规定农机交易中介、评估师、检测员等从业人员的资质等级、培训要求和考核标准。建立从业人员持证上岗制度，提升行业服务专业化水平。", locale),
        scope: "\u9002\u7528\u4E8E\u519C\u673A\u4EA4\u6613\u884C\u4E1A\u7684\u5404\u7C7B\u4ECE\u4E1A\u4EBA\u5458",
        date: "\u62DF 2027-Q2 \u7ACB\u9879",
    },
    // === 国际标准 ===
    {
        category: "international",
        title: translate("ISO 4254 农业机械安全", locale),
        status: "published",
        number: "ISO 4254-1:2023",
        description: translate("国际标准化组织（ISO）发布的农业机械安全国际标准，规定农业机械的基本安全要求和验证方法。涵盖防护装置、紧急停止、操作位置、维修通道等安全设计要求，是农机国际贸易的重要技术依据。", locale),
        scope: "\u9002\u7528\u4E8E\u51FA\u53E3\u81F3\u6B27\u76DF\u3001\u5317\u7F8E\u7B49\u5E02\u573A\u7684\u519C\u4E1A\u673A\u68B0\u5B89\u5168\u5408\u89C4\u8981\u6C42",
        date: "2023",
    },
    {
        category: "international",
        title: translate("OECD 拖拉机试验规范", locale),
        status: "published",
        number: "OECD Code 2",
        description: translate("经济合作与发展组织（OECD）官方拖拉机试验标准代码，规定农业拖拉机的性能试验方法和报告格式。涵盖功率测试、液压提升力测试、PTO性能、噪声测试等核心试验项目。OECD认证是国际公认的拖拉机性能认证。", locale),
        scope: "\u9002\u7528\u4E8E\u51FA\u53E3\u81F3OECD\u6210\u5458\u56FD\u7684\u519C\u4E1A\u62D6\u62C9\u673A\u6027\u80FD\u8BA4\u8BC1",
        date: "2022",
    },
    {
        category: "international",
        title: translate("ISO 3600 农林机械 操作手册", locale),
        status: "published",
        number: "ISO 3600:2015",
        description: translate("国际标准，规定农林机械操作手册的内容要求、编写规范和格式标准。确保操作手册包含安全信息、操作规程、维护指南等必要内容，便于用户正确安全地使用设备。", locale),
        scope: "\u9002\u7528\u4E8E\u6240\u6709\u51FA\u53E3\u519C\u673A\u7684\u64CD\u4F5C\u624B\u518C\u7F16\u5199\u8981\u6C42",
        date: "2015",
    },
    {
        category: "international",
        title: translate("EU 机械指令 2006/42/EC", locale),
        status: "published",
        number: "2006/42/EC",
        description: translate("欧盟机械指令，规定在欧盟市场销售的机械设备必须满足的安全和健康要求。农机出口至欧盟须通过CE认证，加贴CE标志。是农机进入欧洲市场的强制性合规要求。", locale),
        scope: "\u9002\u7528\u4E8E\u51FA\u53E3\u81F3\u6B27\u76DF\u5E02\u573A\u7684\u6240\u6709\u519C\u4E1A\u673A\u68B0",
        date: "2006",
    },
];
}
function getCERTIFICATION_FLOW(locale: string) {
  return [
    {
        step: 1,
        title: translate("机构认证", locale),
        desc: "\u8425\u4E1A\u6267\u7167\u3001\u7ECF\u8425\u8BB8\u53EF\u8BC1\u3001\u573A\u5730\u8BC1\u660E\u3001\u6CE8\u518C\u8D44\u672C\u9A8C\u8BC1",
        icon: Shield,
        detail: "\u9A8C\u8BC1\u4F01\u4E1A\u5408\u6CD5\u7ECF\u8425\u8D44\u8D28\uFF0C\u786E\u8BA4\u7ECF\u8425\u573A\u6240\u548C\u4ED3\u50A8\u6761\u4EF6\u7B26\u5408\u5E73\u53F0\u8981\u6C42",
    },
    {
        step: 2,
        title: translate("人员认证", locale),
        desc: "\u8BC4\u4F30\u5E08\u8D44\u683C\u8BC1\u4E66\u3001\u68C0\u6D4B\u5458\u4E0A\u5C97\u8BC1\u3001\u519C\u673A\u64CD\u4F5C\u8BC1",
        icon: Award,
        detail: "\u5BA1\u6838\u4ECE\u4E1A\u4EBA\u5458\u4E13\u4E1A\u8D44\u8D28\uFF0C\u786E\u4FDD\u5177\u5907\u519C\u673A\u68C0\u6D4B\u8BC4\u4F30\u7684\u4E13\u4E1A\u80FD\u529B",
    },
    {
        step: 3,
        title: translate("车辆认证", locale),
        desc: "\u7B2C\u4E09\u65B9\u68C0\u6D4B\u62A5\u544A\u3001\u4E00\u673A\u4E00\u7801\u6863\u6848\u3001\u7EF4\u4FDD\u8BB0\u5F55",
        icon: FileText,
        detail: "\u5BF9\u8BBE\u5907\u8FDB\u884C\u5168\u9762\u68C0\u6D4B\uFF0C\u5EFA\u7ACB\u4E00\u673A\u4E00\u7801\u8EAB\u4EFD\u6863\u6848\uFF0C\u751F\u6210\u68C0\u6D4B\u62A5\u544A",
    },
    {
        step: 4,
        title: translate("平台审核", locale),
        desc: "\u63D0\u4EA4\u6750\u6599\u2192\u5E73\u53F0\u5BA1\u6838\u2192\u73B0\u573A\u9A8C\u6838\u2192\u8BA4\u8BC1\u6807\u8BC6\u4E0A\u7EBF",
        icon: CheckCircle2,
        detail: "\u5E73\u53F0\u5BF9\u63D0\u4EA4\u6750\u6599\u8FDB\u884C\u5BA1\u6838\uFF0C\u5FC5\u8981\u65F6\u8FDB\u884C\u73B0\u573A\u9A8C\u6838\uFF0C\u901A\u8FC7\u540E\u8D4B\u4E88\u8BA4\u8BC1\u6807\u8BC6",
    },
];
}
function getSTATUS_MAP(locale: string): Record<string, {
    label: string;
    color: string;
}> {
  return {
    published: { label: translate("已发布", locale), color: "bg-green-100 text-green-700" },
    drafting: { label: translate("制定中", locale), color: "bg-blue-100 text-blue-700" },
    planning: { label: translate("规划中", locale), color: "bg-gray-100 text-gray-600" },
};
}
export default async function StandardsPage({ params, }: {
    params: Promise<{
        locale: string;
    }>;
}) {
  const locale = await getLocale();
    void params;
    return (<div className="mx-auto max-w-5xl px-4 py-12 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="mb-10 text-center">
        <h1 className="text-3xl font-bold text-gray-900 sm:text-4xl">{translate("标准规范", locale)}</h1>
        <p className="mt-3 text-gray-500">{translate("推动农机交易行业标准化、规范化，保障交易双方权益", locale)}</p>
        <p className="mt-1 text-sm text-gray-400">{translate("企业标准 · 行业标准 · 国际标准 — 三级标准体系全面覆盖", locale)}</p>
      </div>

      {/* Standards List — 按类别分组 */}
      <div className="space-y-8 mb-12">
        {Object.entries(getCATEGORY_GROUPS(locale)).map(async ([groupKey, groupInfo]) => {
  const locale = await getLocale();
            const groupStandards = getSTANDARDS(locale).filter((s) => s.category === groupKey);
            if (groupStandards.length === 0)
                return null;
            const GroupIcon = groupInfo.icon;
            return (<div key={groupKey}>
              <h2 className={`text-xl font-semibold text-gray-900 mb-4 flex items-center gap-2 ${groupInfo.color}`}>
                <GroupIcon className="h-5 w-5"/>
                {groupInfo.label}
                <span className="text-sm font-normal text-gray-400">({groupStandards.length})</span>
              </h2>
              <div className="space-y-4">
                {groupStandards.map(async (std, idx) => {
  const locale = await getLocale();
                    const status = getSTATUS_MAP(locale)[std.status];
                    return (<div key={`${groupKey}-${idx}`} className="rounded-xl border border-gray-200 p-5 hover:border-blue-300 hover:shadow-sm transition-all">
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
                            <span>{translate("编号:", locale)}{std.number}</span>
                            <span>{translate("适用范围:", locale)}{std.scope}</span>
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3"/> {std.date}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>);
                })}
              </div>
            </div>);
        })}
      </div>

      {/* Certification Flow */}
      <div className="mb-12">
        <h2 className="text-xl font-semibold text-gray-900 mb-2 flex items-center gap-2">
          <Shield className="h-5 w-5 text-blue-600"/>{translate("神雕农机三重认证流程", locale)}</h2>
        <p className="text-sm text-gray-500 mb-6">{translate("神雕农机平台建立\"机构+人员+车辆\"三重认证体系，确保交易安全与设备品质可追溯", locale)}</p>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {getCERTIFICATION_FLOW(locale).map((item) => {
            const Icon = item.icon;
            return (<div key={item.step} className="relative rounded-xl border border-gray-200 p-5">
                <div className="absolute -top-3 -left-3 flex h-8 w-8 items-center justify-center rounded-full bg-blue-600 text-white text-sm font-bold">
                  {item.step}
                </div>
                <Icon className="h-8 w-8 text-blue-600 mb-3 mt-1"/>
                <h3 className="font-semibold text-gray-900 mb-1">{item.title}</h3>
                <p className="text-sm text-gray-500 mb-2">{item.desc}</p>
                <p className="text-xs text-gray-400">{item.detail}</p>
              </div>);
        })}
        </div>
      </div>

      {/* Certification Steps Detail */}
      <div className="mb-12 rounded-xl border border-gray-200 p-6">
        <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <Award className="h-5 w-5 text-orange-600"/>{translate("神雕农机认证申请流程", locale)}</h3>
        <ol className="space-y-3">
          <li className="flex gap-3 text-sm text-gray-600">
            <span className="flex-shrink-0 flex h-6 w-6 items-center justify-center rounded-full bg-orange-100 text-orange-600 font-medium text-xs">1</span>
            <span><strong>{translate("在线申请：", locale)}</strong>{translate("登录神雕农机平台，进入认证中心，选择认证类型（机构/人员/车辆），填写申请表并上传相关资质材料。", locale)}</span>
          </li>
          <li className="flex gap-3 text-sm text-gray-600">
            <span className="flex-shrink-0 flex h-6 w-6 items-center justify-center rounded-full bg-orange-100 text-orange-600 font-medium text-xs">2</span>
            <span><strong>{translate("材料审核：", locale)}</strong>{translate("平台审核团队在3个工作日内完成材料初审，必要时要求补充材料。审核通过后进入下一阶段。", locale)}</span>
          </li>
          <li className="flex gap-3 text-sm text-gray-600">
            <span className="flex-shrink-0 flex h-6 w-6 items-center justify-center rounded-full bg-orange-100 text-orange-600 font-medium text-xs">3</span>
            <span><strong>{translate("现场验核：", locale)}</strong>{translate("对于机构认证和车辆认证，平台安排专业人员上门验核。确认经营场所、设备状况与申请材料一致。", locale)}</span>
          </li>
          <li className="flex gap-3 text-sm text-gray-600">
            <span className="flex-shrink-0 flex h-6 w-6 items-center justify-center rounded-full bg-orange-100 text-orange-600 font-medium text-xs">4</span>
            <span><strong>{translate("认证发放：", locale)}</strong>{translate("验核通过后，平台在2个工作日内发放电子认证证书，并在平台展示认证标识。认证有效期1年，到期续审。", locale)}</span>
          </li>
        </ol>
      </div>

      {/* Compliance Statement */}
      <div className="rounded-xl bg-blue-50 border border-blue-200 p-6">
        <div className="flex items-start gap-3">
          <Globe className="h-6 w-6 text-blue-600 flex-shrink-0 mt-0.5"/>
          <div>
            <h3 className="font-semibold text-gray-900 mb-2">{translate("平台合规承诺", locale)}</h3>
            <p className="text-sm text-gray-600 leading-relaxed">{translate("神雕农机全球交易平台严格遵守国家相关法律法规，积极参与中国农业机械工业协会（CAMA）团体标准制定工作。 平台所有交易流程均参照已发布的企业标准、行业标准及国际标准执行，确保交易透明、设备品质可追溯、买卖双方权益得到保障。", locale)}</p>
            <p className="text-sm text-gray-600 leading-relaxed mt-2">{translate("我们承诺：平台可以盈利但不可暴利。平台赚的是\"效率提升节省出来的钱\"，而非\"信息不对称多出来的钱\"。 所有认证信息公开透明，用户可随时查询验证。", locale)}</p>
          </div>
        </div>
      </div>
    </div>);
}
