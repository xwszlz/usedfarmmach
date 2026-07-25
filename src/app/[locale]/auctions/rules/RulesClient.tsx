"use client";

import { useLocale } from "next-intl";
import Link from "next/link";
import { MessageSquare, FileText, ShieldCheck, AlertCircle } from "lucide-react";
import { useTr } from "@/lib/i18n-tr";

export default function RulesClient() {
  const locale = useLocale();
  const tr = useTr();

  const flowSteps = [
    {
      num: "01",
      title: tr("浏览设备"),
      desc: tr("查看设备参数、图片、评估报告、风险告知，全面了解设备现状"),
    },
    {
      num: "02",
      title: tr("预约看车"),
      desc: tr("实地查验设备状况，确认设备信息无误后再报价"),
    },
    {
      num: "03",
      title: tr("提交报价"),
      desc: tr("输入您的心理价位，一对一提交给卖家。报价相互不可见"),
    },
    {
      num: "04",
      title: tr("卖家回复"),
      desc: tr("卖家审阅后可接受、拒绝。卖方可接受或拒绝任何报价"),
    },
    {
      num: "05",
      title: tr("成交交付"),
      desc: tr("确认成交后，签署买卖合同，线下交接设备与全套法律文件"),
    },
  ];

  const guarantees = [
    {
      icon: "🔒",
      title: tr("资金安全"),
      desc: tr("平台不代收代付任何资金。买卖双方直接交易，资金直达。保证金由双方自行约定，平台不介入"),
    },
    {
      icon: "📋",
      title: tr("信息透明"),
      desc: tr("设备现状、已知瑕疵、评估报告、法律文件全部公开公示。卖方对故意隐瞒的重大瑕疵依法承担责任"),
    },
    {
      icon: "⚖️",
      title: tr("法律保障"),
      desc: tr("交易受《中华人民共和国民法典》等法律法规保护。买卖双方在线达成的意向与线下签署的买卖合同具有法律效力。平台提供格式条款提示与合同模板参考，协助双方明确权责。"),
    },
    {
      icon: "🤝",
      title: tr("权责对等"),
      desc: tr("买卖双方违约责任对等。卖方无法交付须赔偿，买方逾期付款同样承担责任"),
    },
  ];

  const risks = [
    tr("本平台提供的是在线询价/报价服务，不是拍卖。卖家有权接受或拒绝任何报价，无需说明理由"),
    tr("报价相互不可见，不存在公开竞价。买家之间无法看到彼此的报价"),
    tr("部分设备通过租赁渠道取得，权属文件可能存在不完整的情形。卖方如实披露权属状况，不协助办理过户手续，买方应自行了解过户可行性并自担风险。"),
    tr("设备按现状交付，具体配置与零部件完整性以详情页公示与实地验机为准。建议报价前实地查验。"),
    tr("平台不设定保证金、不设定加价幅度、不设定最低启动人数。交易条款由买卖双方在合同中约定"),
    tr("交易为线下交付。请在签署合同前仔细阅读格式条款（特别是瑕疵告知、过户事宜、违约责任）"),
  ];

  const faqs = [
    {
      q: tr("在线询价和拍卖有什么区别？"),
      a: tr("在线询价是买家一对一提交报价、卖家决定是否成交的模式。与拍卖有本质区别：①不存在公开竞价，报价相互不可见；②卖方可接受或拒绝任何报价；③不设固定加价幅度；④不设最低启动人数；⑤平台不设定保证金。这是一种价格协商服务，不是拍卖活动。"),
    },
    {
      q: tr("设备无法过户怎么办？"),
      a: tr("不同设备权属来源不同，部分设备可能存在登记证书缺失、租赁取得或过户限制。卖方应在详情页如实披露权属来源与已知限制，买方应在报价前自行向当地农机管理部门了解过户、上牌可行性。因无法过户或上牌导致的全部风险由买方自行承担；卖方不存在隐瞒或虚假陈述的，买方不得以此为由要求解除合同或索赔。"),
    },
    {
      q: tr("如何确保设备质量？"),
      a: tr("卖方应在详情页如实告知已知瑕疵（如零部件缺失、外观损伤、功能异常等），标的物按现状交付。卖方对经合理查验可发现的瑕疵不承担担保责任，但对明知或应知而未披露的重大瑕疵，以及因故意隐瞒或虚假陈述导致的损失，仍依法承担责任。买方在交付后发现隐蔽瑕疵的，应在约定期限内书面通知卖方。"),
    },
    {
      q: tr("需要交保证金吗？"),
      a: tr("本平台不强制收取保证金。如卖家要求缴纳诚意金，由买卖双方自行约定金额和支付方式，平台不代收、不验证、不托管。这与拍卖不同——拍卖中保证金是参与竞拍的门槛，而在询价模式中，保证金（如有）仅是双方的商业安排。"),
    },
    {
      q: tr("成交后违约责任如何？"),
      a: tr("买卖双方违约责任对等。买方逾期付款：保证金（如有）不予退还 + 合同解除 + 六个月内不得参与同类询价。卖方无法交付：退还已付款项 + 支付合同总价5%-10%违约金 + 赔偿实际损失。卖方权属虚假或隐瞒重大瑕疵：买方有权解除合同并要求赔偿。"),
    },
    {
      q: tr("成交后服务费怎么收？"),
      a: tr("本功能为信息发布与价格协商撮合服务，平台不收取任何交易服务费、佣金或成交手续费。会员费、AI估值费等属于增值信息服务费，与设备交易无关。买卖双方按合同约定自行完成交易及资金收付。"),
    },
  ];

  return (
    <div className="min-h-screen bg-[#F9FAFC]">
      {/* Hero */}
      <div className="bg-[#1E40AF] px-6 py-10 md:px-12">
        <div className="max-w-5xl mx-auto">
          <h1 className="text-2xl md:text-3xl font-bold text-white">
            {tr("询价规则与合规公示")}
          </h1>
          <p className="text-sm md:text-base text-blue-200 mt-2">
            {tr("透明交易 · 合规先行 · 保障双方权益")}
          </p>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 md:px-6 py-8 space-y-6">
        {/* Compliance Declaration (强化) */}
        <div className="bg-white rounded-xl p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-3 flex items-center gap-2">
            <ShieldCheck className="h-6 w-6 text-green-600" />
            {tr("合规声明")}
          </h2>
          <div className="bg-gray-50 rounded-xl p-4 space-y-3 text-sm text-gray-700 leading-relaxed">
            <p>
              <strong>{tr("一、非拍卖声明：")}</strong>
              {tr("本平台提供的「在线询价」功能不属于《中华人民共和国拍卖法》规制的拍卖活动。其核心区别在于：①不存在公开竞价（报价相互不可见）；②不存在价高者得（卖方可接受或拒绝任何报价）；③不设固定加价幅度；④不设最低启动人数；⑤平台不设定保证金。本功能为买卖双方就二手农机设备进行价格协商的交易撮合服务。")}
            </p>
            <p>
              <strong>{tr("二、平台定位：")}</strong>
              {tr("平台作为信息中介和居间人，仅提供信息发布和沟通工具。平台不参与定价、不代收代付资金、不设定竞价规则、不确定成交结果、不承担交易担保责任。买卖双方应自行判断交易风险，遵守相关法律法规。")}
            </p>
            <p>
              <strong>{tr("三、信息披露：")}</strong>
              {tr("所有设备信息均真实披露，包括已知瑕疵、租赁取得渠道、无法过户风险等。卖方对明知或应知而未披露的重大瑕疵，以及因故意隐瞒或虚假陈述导致的损失，依法承担责任。")}
            </p>
            <p>
              <strong>{tr("四、权属保证：")}</strong>
              {tr("卖方如实披露标的物权属状况。因部分标的暂无农机登记证书等权属文件，过户存在障碍，卖方不协助办理过户手续。买方应在交易前自行了解过户可行性并自担风险。卖方已如实披露不存在隐瞒或虚假陈述的，买方不得以此为由要求解除合同或索赔。")}
            </p>
          </div>
        </div>

        {/* Flow Steps */}
        <div className="bg-white rounded-xl p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">{tr("询价流程")}</h2>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {flowSteps.map((step, idx) => (
              <div key={idx} className="relative">
                <div className="bg-gray-50 rounded-xl p-4 h-full">
                  <p className="text-2xl font-bold text-[#1E40AF] font-mono mb-2">{step.num}</p>
                  <p className="font-semibold text-gray-900 mb-1">{step.title}</p>
                  <p className="text-xs text-gray-500 leading-relaxed">{step.desc}</p>
                </div>
                {idx < flowSteps.length - 1 && (
                  <div className="hidden md:block absolute top-1/2 -right-2 text-gray-300 text-xl">→</div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Guarantees */}
        <div className="bg-white rounded-xl p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">{tr("交易保障")}</h2>
          <div className="grid md:grid-cols-2 gap-4">
            {guarantees.map((g, idx) => (
              <div key={idx} className="bg-gray-50 rounded-xl p-4">
                <div className="text-3xl mb-2">{g.icon}</div>
                <p className="font-semibold text-gray-900 mb-1">{g.title}</p>
                <p className="text-sm text-gray-500">{g.desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Fee Schedule */}
        <div className="bg-white rounded-xl p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">
            {tr("平台服务说明")}
          </h2>
          <div className="bg-blue-50 rounded-xl p-4 space-y-4">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-blue-500 text-white text-xs font-bold">
                {tr("信息撮合平台")}
              </span>
              <span className="text-sm text-gray-600">
                {tr("平台不收取任何交易服务费")}
              </span>
            </div>

            <div className="bg-white rounded-xl p-4 border border-blue-200">
              <p className="text-sm text-gray-700 leading-relaxed mb-3">
                {tr("本平台定位为农机设备信息发布与交流平台，提供信息展示、AI估值参考等增值服务。平台不参与交易撮合、不代收代付任何交易资金、不收取任何与成交相关的服务费或佣金。买卖双方自行完成交易，资金直接往来。")}
              </p>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <div className="bg-white rounded-xl p-4 border border-gray-200">
                <p className="text-xs text-gray-500 mb-1">{tr("会员服务")}</p>
                <p className="text-lg font-bold text-gray-900">
                  {tr("免费 / ¥99 / ¥299 / ¥999")}
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  {tr("不同等级会员可享受不同的信息查看次数、AI估值次数等增值权益")}
                </p>
              </div>
              <div className="bg-white rounded-xl p-4 border border-gray-200">
                <p className="text-xs text-gray-500 mb-1">{tr("AI智能估值")}</p>
                <p className="text-lg font-bold text-gray-900">
                  {tr("按次付费")}
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  {tr("基于设备参数、市场行情、使用年限等数据，提供参考估值报告")}
                </p>
              </div>
            </div>

            <div className="bg-white rounded-xl p-4 border border-gray-200">
              <p className="text-sm font-semibold text-gray-900 mb-2">
                {tr("重要说明")}
              </p>
              <ul className="text-sm text-gray-700 space-y-2 leading-relaxed">
                <li className="flex items-start gap-2">
                  <span className="flex-shrink-0 mt-1 w-1.5 h-1.5 rounded-full bg-blue-500"></span>
                  <span>
                    {tr("平台不收取任何与交易相关的服务费、佣金或手续费。交易完全由买卖双方自行协商完成。")}
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="flex-shrink-0 mt-1 w-1.5 h-1.5 rounded-full bg-blue-500"></span>
                  <span>
                    {tr("平台不代收代付任何交易资金，不设资金池，不提供资金托管或担保服务。")}
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="flex-shrink-0 mt-1 w-1.5 h-1.5 rounded-full bg-blue-500"></span>
                  <span>
                    {tr("保证金（如有）由买卖双方自行约定和收付，平台不设定金额、不验证凭证、不参与纠纷处理。")}
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="flex-shrink-0 mt-1 w-1.5 h-1.5 rounded-full bg-blue-500"></span>
                  <span>
                    {tr("会员费和AI估值费属于增值信息服务费，与交易无关，开具增值税发票。")}
                  </span>
                </li>
              </ul>
            </div>
          </div>
        </div>

        {/* Risk Warnings */}
        <div className="bg-white rounded-xl p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
            <AlertCircle className="h-6 w-6 text-red-500" />
            {tr("风险提示")}
          </h2>
          <div className="bg-red-50 rounded-xl p-4 space-y-3">
            {risks.map((risk, idx) => (
              <div key={idx} className="flex items-start gap-2 text-sm text-red-700">
                <span className="flex-shrink-0 mt-0.5">⚠</span>
                <span>{risk}</span>
              </div>
            ))}
          </div>
        </div>

        {/* 格式条款特别提示确认 */}
        <div className="bg-white rounded-xl p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
            <FileText className="h-6 w-6 text-blue-600" />
            {tr("格式条款特别提示")}
          </h2>
          <div className="bg-blue-50 rounded-xl p-4 space-y-3 text-sm text-blue-900 leading-relaxed">
            <p>
              {tr("根据《中华人民共和国民法典》第496条，本平台特别提示您注意以下条款（完整条款详见买卖合同）：")}
            </p>
            <div className="space-y-2 ml-4">
              <div className="flex items-start gap-2">
                <span className="font-bold">①</span>
                <span>
                  <strong>{tr("瑕疵告知及免责：")}</strong>
                  {tr("标的物按现状交付。卖方对经合理查验可发现的瑕疵不承担担保责任，但对明知或应知而未披露的重大瑕疵，以及因故意隐瞒或虚假陈述导致的损失，仍依法承担责任。")}
                </span>
              </div>
              <div className="flex items-start gap-2">
                <span className="font-bold">②</span>
                <span>
                  <strong>{tr("过户事宜：")}</strong>
                  {tr("因部分标的物暂无农机登记证书，过户存在障碍，卖方不协助办理过户手续。买方应在交易前自行了解过户可行性并自担风险。")}
                </span>
              </div>
              <div className="flex items-start gap-2">
                <span className="font-bold">③</span>
                <span>
                  <strong>{tr("违约责任：")}</strong>
                  {tr("买卖双方违约责任对等。卖方无法交付须退还已付款项并支付违约金；买方逾期付款保证金不予退还。")}
                </span>
              </div>
              <div className="flex items-start gap-2">
                <span className="font-bold">④</span>
                <span>
                  <strong>{tr("非拍卖声明：")}</strong>
                  {tr("本功能为在线询价/报价，不是拍卖。卖方可接受或拒绝任何报价。报价相互不可见。")}
                </span>
              </div>
            </div>
            <p className="text-xs text-blue-600 mt-2">
              {tr("请在签署买卖合同前仔细阅读上述条款。如有疑问，可咨询专业律师。")}
            </p>
          </div>
        </div>

        {/* FAQ */}
        <div className="bg-white rounded-xl p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">{tr("常见问题")}</h2>
          <div className="space-y-3">
            {faqs.map((faq, idx) => (
              <div key={idx} className="bg-gray-50 rounded-xl p-4">
                <p className="font-semibold text-gray-900 text-sm mb-1">{faq.q}</p>
                <p className="text-sm text-gray-600 leading-relaxed">{faq.a}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Back Link */}
        <div className="text-center py-4">
          <Link href={`/${locale}/auctions`} className="text-[#1E40AF] hover:underline font-medium">
            ← {tr("返回询价列表")}
          </Link>
        </div>
      </div>
    </div>
  );
}
