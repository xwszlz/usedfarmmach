"use client";

import { useLocale } from "next-intl";
import Link from "next/link";

export default function RulesClient() {
  const locale = useLocale();
  const isZh = locale === "zh";

  const flowSteps = [
    {
      num: "01",
      title: isZh ? "浏览设备" : "Browse",
      desc: isZh ? "查看设备参数、图片、风险告知，全面了解设备现状" : "Review specs, photos, and risk disclosures",
    },
    {
      num: "02",
      title: isZh ? "发起议价" : "Make Offer",
      desc: isZh ? "输入您的心理价位，提交报价给卖家" : "Submit your best offer to the seller",
    },
    {
      num: "03",
      title: isZh ? "卖家回应" : "Seller Response",
      desc: isZh ? "卖家可接受、拒绝或反价，双方充分沟通" : "Seller accepts, rejects, or counter-offers",
    },
    {
      num: "04",
      title: isZh ? "成交交付" : "Deal & Delivery",
      desc: isZh ? "确认成交后，线下交接设备与全套法律文件" : "Confirm deal, arrange delivery with legal documents",
    },
  ];

  const guarantees = [
    {
      icon: "🔒",
      title: isZh ? "资金安全" : "Fund Safety",
      desc: isZh ? "平台不代收代付，买卖双方直接交易，资金直达" : "No escrow — direct buyer-seller transactions",
    },
    {
      icon: "📋",
      title: isZh ? "信息透明" : "Transparency",
      desc: isZh ? "设备现状、风险告知、法律文件全部公开公示" : "Full disclosure of condition, risks, and legal docs",
    },
    {
      icon: "⚖️",
      title: isZh ? "法律保障" : "Legal Protection",
      desc: isZh ? "附法院处置成交确认书等全套法律文件" : "Complete legal documents included",
    },
  ];

  const risks = [
    isZh ? "部分设备通过司法处置渠道获得，可能无法办理过户手续" : "Some equipment acquired via judicial disposal may not be transferable",
    isZh ? "设备可能存在零部件缺失（如前配重、后悬挂等），需另行配置" : "Equipment may have missing parts requiring separate purchase",
    isZh ? "在线议价非拍卖，卖家有权接受或拒绝任何报价" : "Online negotiation is not an auction — sellers may accept or reject any offer",
    isZh ? "交易为线下交付，请实地验机后再确认成交" : "Delivery is offline — inspect equipment in person before confirming",
  ];

  const faqs = [
    {
      q: isZh ? "在线议价和拍卖有什么区别？" : "What's the difference between negotiation and auction?",
      a: isZh
        ? "在线议价是买家出价、卖家决定是否成交的模式。不像拍卖有时间限制和竞价压力，议价更灵活，双方可以充分沟通。"
        : "Negotiation lets buyers make offers and sellers decide whether to accept. Unlike auctions, there's no time pressure — it's more flexible.",
    },
    {
      q: isZh ? "设备无法过户怎么办？" : "What if the equipment can't be transferred?",
      a: isZh
        ? "部分设备通过司法处置渠道获得，所有权已合法转移但无法办理过户。我们提供全套法律文件（法院处置成交确认书、评估报告等）证明合法所有权。"
        : "Some equipment was acquired via judicial disposal. Ownership is legally transferred but registration transfer may not be possible. Full legal documents are provided.",
    },
    {
      q: isZh ? "如何确保设备质量？" : "How is equipment quality ensured?",
      a: isZh
        ? "我们如实披露设备现状（包括缺失部件、工作时长等），建议您实地看车验机后再决定是否成交。所有已知瑕疵均在详情页公示。"
        : "We fully disclose equipment condition including missing parts and working hours. We recommend in-person inspection before closing the deal.",
    },
    {
      q: isZh ? "成交后如何交付？" : "How does delivery work after a deal?",
      a: isZh
        ? "成交后买卖双方线下交接。交付时附带法院处置成交确认书、设备评估报告、交接清单等全套法律文件。"
        : "Delivery is arranged offline between buyer and seller. Full legal documents are provided at handover.",
    },
    {
      q: isZh ? "服务费不交会怎么样？" : "What happens if I don't pay the service fee?",
      a: isZh
        ? "成交后7日内未支付服务费，平台有权：(1)隐藏该成交记录，(2)限制卖家后续发布议价，(3)冻结买家议价权限，(4)按《在线议价服务协议》追索。未来接入支付分账后，服务费将从成交款中自动扣除，无需主动支付。"
        : "If service fee is unpaid after 7 days, the platform may: (1) hide the deal record, (2) restrict seller's future listings, (3) freeze buyer's negotiation access, (4) pursue per the Service Agreement. Once payment split is integrated, fees auto-deduct.",
    },
  ];

  return (
    <div className="min-h-screen bg-[#F9FAFC]">
      {/* Hero */}
      <div className="bg-[#1E40AF] px-6 py-10 md:px-12">
        <div className="max-w-5xl mx-auto">
          <h1 className="text-2xl md:text-3xl font-bold text-white">
            {isZh ? "议价规则与合规公示" : "Negotiation Rules & Compliance"}
          </h1>
          <p className="text-sm md:text-base text-blue-200 mt-2">
            {isZh ? "透明交易 · 合规先行 · 保障双方权益" : "Transparent · Compliant · Protected"}
          </p>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 md:px-6 py-8 space-y-6">
        {/* Compliance Declaration */}
        <div className="bg-white rounded-xl p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-3">{isZh ? "合规声明" : "Compliance Declaration"}</h2>
          <div className="bg-gray-50 rounded-xl p-4 space-y-3 text-sm text-gray-700 leading-relaxed">
            <p>
              {isZh
                ? "本平台提供的「在线议价」功能不属于《中华人民共和国拍卖法》规制的拍卖活动，而是买卖双方就二手农机设备进行价格协商的交易撮合服务。"
                : "The 'Online Negotiation' feature on this platform is not an auction under the PRC Auction Law. It is a price negotiation service between buyers and sellers of used farm machinery."}
            </p>
            <p>
              {isZh
                ? "平台作为信息中介，不参与定价、不代收代付资金、不承担交易担保责任。买卖双方应自行判断交易风险，遵守相关法律法规。"
                : "The platform serves as an information intermediary. It does not set prices, handle funds, or guarantee transactions. Both parties must assess risks independently."}
            </p>
            <p>
              {isZh
                ? "所有设备信息均真实披露，包括已知瑕疵、司法处置渠道、无法过户等风险。买家在出价前应仔细阅读设备详情和风险告知。"
                : "All equipment information is truthfully disclosed, including known defects, judicial disposal sources, and transfer risks. Buyers should review details carefully before making an offer."}
            </p>
          </div>
        </div>

        {/* Flow Steps */}
        <div className="bg-white rounded-xl p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">{isZh ? "议价流程" : "Negotiation Process"}</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
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
          <h2 className="text-xl font-bold text-gray-900 mb-4">{isZh ? "交易保障" : "Transaction Guarantees"}</h2>
          <div className="grid md:grid-cols-3 gap-4">
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
            {isZh ? "费用说明" : "Fee Schedule"}
          </h2>
          <div className="bg-amber-50 rounded-xl p-4 space-y-4">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-amber-500 text-white text-xs font-bold">
                {isZh ? "现行费率" : "Current Rate"}
              </span>
              <span className="text-sm text-gray-600">
                {isZh ? "生效日期：2026-07-19" : "Effective: 2026-07-19"}
              </span>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <div className="bg-white rounded-xl p-4 border border-amber-200">
                <p className="text-xs text-gray-500 mb-1">{isZh ? "买家议价成交费" : "Buyer Transaction Fee"}</p>
                <p className="text-3xl font-bold text-amber-600 font-mono">2%</p>
                <p className="text-xs text-gray-500 mt-1">
                  {isZh ? "按成交价收取，成交后支付" : "Of deal price, paid after closing"}
                </p>
              </div>
              <div className="bg-white rounded-xl p-4 border border-amber-200">
                <p className="text-xs text-gray-500 mb-1">{isZh ? "卖家成交佣金" : "Seller Commission"}</p>
                <p className="text-3xl font-bold text-amber-600 font-mono">3%</p>
                <p className="text-xs text-gray-500 mt-1">
                  {isZh ? "按成交价收取，成交后支付" : "Of deal price, paid after closing"}
                </p>
              </div>
            </div>

            <div className="bg-white rounded-xl p-4 border border-amber-200">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div>
                  <p className="text-xs text-gray-500">{isZh ? "综合服务费" : "Total Service Fee"}</p>
                  <p className="text-2xl font-bold text-gray-900 font-mono">5%</p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-gray-500">{isZh ? "示例：成交价 ¥200,000" : "Example: ¥200,000 deal"}</p>
                  <p className="text-sm font-semibold text-gray-700 font-mono">
                    {isZh ? "服务费 ¥10,000" : "Fee: ¥10,000"}
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl p-4 border border-gray-200">
              <p className="text-sm font-semibold text-gray-900 mb-2">
                {isZh ? "费用收取方式" : "How Fees Are Collected"}
              </p>
              <ul className="text-sm text-gray-700 space-y-2 leading-relaxed">
                <li className="flex items-start gap-2">
                  <span className="flex-shrink-0 mt-1 w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                  <span>
                    {isZh
                      ? "现阶段平台不代收交易款项。买家将设备款直接支付给卖家，买卖双方按成交价各自向平台支付服务费。"
                      : "Currently the platform does not handle funds. Buyers pay sellers directly; both parties pay the platform separately."}
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="flex-shrink-0 mt-1 w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                  <span>
                    {isZh
                      ? "服务费支付方式：对公转账 / 微信支付 / 支付宝。成交后7日内未支付将影响后续使用。"
                      : "Payment methods: bank transfer, WeChat Pay, or Alipay. Late payment after 7 days affects account access."}
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="flex-shrink-0 mt-1 w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                  <span>
                    {isZh
                      ? "未来接入第三方支付分账后，将自动从成交款中扣除服务费，无需双方主动支付。"
                      : "Once third-party payment split is integrated, fees will be auto-deducted from the transaction."}
                  </span>
                </li>
              </ul>
            </div>

            <div className="bg-amber-100/60 rounded-xl p-4 border border-amber-300">
              <p className="text-sm font-semibold text-amber-900 mb-2">
                {isZh ? "与 IronPlanet/Ritchie Bros 对比" : "vs IronPlanet / Ritchie Bros"}
              </p>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-xs text-gray-600">{isZh ? "IronPlanet 综合费率" : "IronPlanet total"}</p>
                  <p className="font-bold text-red-600 font-mono">15-22%</p>
                </div>
                <div>
                  <p className="text-xs text-gray-600">{isZh ? "神雕农机" : "Shen Diao"}</p>
                  <p className="font-bold text-green-600 font-mono">5%</p>
                </div>
              </div>
              <p className="text-xs text-gray-600 mt-2">
                {isZh
                  ? "一台 ¥20 万的拖拉机：IronPlanet 约 ¥3-4 万，我们 ¥1 万。"
                  : "A ¥200K tractor: IronPlanet ~¥30-40K, ours ¥10K."}
              </p>
            </div>
          </div>
        </div>

        {/* Risk Warnings */}
        <div className="bg-white rounded-xl p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">{isZh ? "风险提示" : "Risk Warnings"}</h2>
          <div className="bg-red-50 rounded-xl p-4 space-y-3">
            {risks.map((risk, idx) => (
              <div key={idx} className="flex items-start gap-2 text-sm text-red-700">
                <span className="flex-shrink-0 mt-0.5">⚠</span>
                <span>{risk}</span>
              </div>
            ))}
          </div>
        </div>

        {/* FAQ */}
        <div className="bg-white rounded-xl p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">{isZh ? "常见问题" : "FAQ"}</h2>
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
            ← {isZh ? "返回议价列表" : "Back to Negotiations"}
          </Link>
        </div>
      </div>
    </div>
  );
}
