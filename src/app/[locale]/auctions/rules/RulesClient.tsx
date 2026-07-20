"use client";

import { useLocale } from "next-intl";
import Link from "next/link";
import { MessageSquare, FileText, ShieldCheck, AlertCircle } from "lucide-react";

export default function RulesClient() {
  const locale = useLocale();
  const isZh = locale === "zh";

  const flowSteps = [
    {
      num: "01",
      title: isZh ? "浏览设备" : "Browse",
      desc: isZh ? "查看设备参数、图片、评估报告、风险告知，全面了解设备现状" : "Review specs, photos, appraisal, and risk disclosures",
    },
    {
      num: "02",
      title: isZh ? "预约看车" : "Inspect",
      desc: isZh ? "实地查验设备状况，确认设备信息无误后再报价" : "Inspect equipment in person before making an offer",
    },
    {
      num: "03",
      title: isZh ? "提交报价" : "Submit Offer",
      desc: isZh ? "输入您的心理价位，一对一提交给卖家。报价相互不可见" : "Submit your price privately to the seller. Offers are not visible to others",
    },
    {
      num: "04",
      title: isZh ? "卖家回复" : "Seller Response",
      desc: isZh ? "卖家审阅后可接受、拒绝。卖方可接受或拒绝任何报价" : "Seller reviews and accepts or rejects. Seller may accept or reject any offer",
    },
    {
      num: "05",
      title: isZh ? "成交交付" : "Deal & Delivery",
      desc: isZh ? "确认成交后，签署买卖合同，线下交接设备与全套法律文件" : "Sign contract, arrange delivery with full legal documents",
    },
  ];

  const guarantees = [
    {
      icon: "🔒",
      title: isZh ? "资金安全" : "Fund Safety",
      desc: isZh ? "平台不代收代付任何资金。买卖双方直接交易，资金直达。保证金由双方自行约定，平台不介入" : "No escrow — direct buyer-seller transactions. Deposits agreed between parties, platform does not handle funds",
    },
    {
      icon: "📋",
      title: isZh ? "信息透明" : "Transparency",
      desc: isZh ? "设备现状、已知瑕疵、评估报告、法律文件全部公开公示。卖方对故意隐瞒的重大瑕疵依法承担责任" : "Full disclosure of condition, defects, appraisal, and legal docs. Seller liable for concealed defects",
    },
    {
      icon: "⚖️",
      title: isZh ? "法律保障" : "Legal Protection",
      desc: isZh ? "附法院处置成交确认书等全套法律文件。卖方配合过户，因权属瑕疵导致无法过户可解除合同" : "Complete legal documents included. Seller assists with transfer; buyer may cancel for title defects",
    },
    {
      icon: "🤝",
      title: isZh ? "权责对等" : "Fair Liability",
      desc: isZh ? "买卖双方违约责任对等。卖方无法交付须赔偿，买方逾期付款同样承担责任" : "Mutual liability. Seller liable for non-delivery, buyer liable for late payment",
    },
  ];

  const risks = [
    isZh ? "本平台提供的是在线询价/报价服务，不是拍卖。卖家有权接受或拒绝任何报价，无需说明理由" : "This is an online inquiry/quote service, not an auction. Seller may accept or reject any offer without explanation",
    isZh ? "报价相互不可见，不存在公开竞价。买家之间无法看到彼此的报价" : "Offers are private — buyers cannot see each other's offers. No public bidding",
    isZh ? "部分设备通过司法处置渠道获得，卖方应配合过户但具体程序需咨询当地农机监理机构" : "Some equipment acquired via judicial disposal. Seller assists with transfer but local agricultural machinery procedures vary",
    isZh ? "设备可能存在零部件缺失（如前配重、后悬挂等），详情页已公示。建议实地验机后再报价" : "Equipment may have missing parts (disclosed on listing). In-person inspection recommended",
    isZh ? "平台不设定保证金、不设定加价幅度、不设定最低启动人数。交易条款由买卖双方在合同中约定" : "Platform sets no deposit, no increment, no minimum participants. Terms agreed in the contract",
    isZh ? "交易为线下交付。请在签署合同前仔细阅读格式条款（特别是瑕疵告知、过户事宜、违约责任）" : "Delivery is offline. Review standard terms carefully (defects, transfer, liability) before signing",
  ];

  const faqs = [
    {
      q: isZh ? "在线询价和拍卖有什么区别？" : "What's the difference between inquiry and auction?",
      a: isZh
        ? "在线询价是买家一对一提交报价、卖家决定是否成交的模式。与拍卖有本质区别：①不存在公开竞价，报价相互不可见；②卖方可接受或拒绝任何报价；③不设固定加价幅度；④不设最低启动人数；⑤平台不设定保证金。这是一种价格协商服务，不是拍卖活动。"
        : "Online inquiry lets buyers submit private offers and sellers decide whether to accept. Key differences from auctions: (1) no public bidding — offers are private; (2) seller may accept or reject any offer; (3) no fixed increment; (4) no minimum participants; (5) platform sets no deposit. This is a price negotiation service, not an auction.",
    },
    {
      q: isZh ? "设备无法过户怎么办？" : "What if the equipment can't be transferred?",
      a: isZh
        ? "卖方确认其为合法所有权人或经授权的处置权人，并应配合买方办理过户手续。因卖方权属瑕疵（如非合法所有权人、存在抵押/查封等）导致无法过户的，买方有权解除合同，卖方应退还已付全部款项并赔偿直接损失。买方应自行了解当地农机上牌政策。"
        : "Seller confirms legal title and shall assist with transfer. If title defects prevent transfer, buyer may cancel and recover full payment plus direct losses. Buyers should check local agricultural machinery registration policies.",
    },
    {
      q: isZh ? "如何确保设备质量？" : "How is equipment quality ensured?",
      a: isZh
        ? "卖方如实告知已知瑕疵（缺少前配重、后悬挂等），标的物按现状交付。卖方对经合理查验可发现的瑕疵不承担担保责任，但对明知或应知而未披露的重大瑕疵，以及因故意隐瞒或虚假陈述导致的损失，仍依法承担责任。买方在交付后发现隐蔽瑕疵的，应在约定期限内书面通知卖方。"
        : "Seller discloses known defects. Equipment sold as-is. Seller not liable for discoverable defects but remains liable for known but undisclosed defects or misrepresentation. Buyer should report hidden defects within the agreed period.",
    },
    {
      q: isZh ? "需要交保证金吗？" : "Is a deposit required?",
      a: isZh
        ? "本平台不强制收取保证金。如卖家要求缴纳诚意金，由买卖双方自行约定金额和支付方式，平台不代收、不验证、不托管。这与拍卖不同——拍卖中保证金是参与竞拍的门槛，而在询价模式中，保证金（如有）仅是双方的商业安排。"
        : "The platform does not require deposits. Any earnest money is agreed between buyer and seller directly — the platform does not collect, verify, or hold funds. Unlike auctions, deposits here are a commercial arrangement between parties.",
    },
    {
      q: isZh ? "成交后违约责任如何？" : "What about liability for breach?",
      a: isZh
        ? "买卖双方违约责任对等。买方逾期付款：保证金（如有）不予退还 + 合同解除 + 六个月内不得参与同类议价。卖方无法交付：退还已付款项 + 支付合同总价5%-10%违约金 + 赔偿实际损失。卖方权属虚假或隐瞒重大瑕疵：买方有权解除合同并要求赔偿。"
        : "Liability is mutual. Buyer late payment: deposit (if any) forfeited + contract cancelled + 6-month restriction. Seller non-delivery: full refund + 5-10% penalty + actual losses. Title fraud or concealed defects: buyer may cancel and claim damages.",
    },
    {
      q: isZh ? "服务费怎么收？" : "How are service fees charged?",
      a: isZh
        ? "成交后收取综合服务费5%（买方2%+卖方3%）。现阶段平台不代收交易款项，买卖双方按成交价各自向平台支付服务费。未来接入第三方支付分账后，将自动从成交款中扣除。"
        : "5% total service fee after closing (buyer 2% + seller 3%). Currently the platform does not handle funds; both parties pay fees separately. Auto-deduction will be available once payment split is integrated.",
    },
  ];

  return (
    <div className="min-h-screen bg-[#F9FAFC]">
      {/* Hero */}
      <div className="bg-[#1E40AF] px-6 py-10 md:px-12">
        <div className="max-w-5xl mx-auto">
          <h1 className="text-2xl md:text-3xl font-bold text-white">
            {isZh ? "询价规则与合规公示" : "Inquiry Rules & Compliance"}
          </h1>
          <p className="text-sm md:text-base text-blue-200 mt-2">
            {isZh ? "透明交易 · 合规先行 · 保障双方权益" : "Transparent · Compliant · Protected"}
          </p>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 md:px-6 py-8 space-y-6">
        {/* Compliance Declaration (强化) */}
        <div className="bg-white rounded-xl p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-3 flex items-center gap-2">
            <ShieldCheck className="h-6 w-6 text-green-600" />
            {isZh ? "合规声明" : "Compliance Declaration"}
          </h2>
          <div className="bg-gray-50 rounded-xl p-4 space-y-3 text-sm text-gray-700 leading-relaxed">
            <p>
              <strong>{isZh ? "一、非拍卖声明：": "1. Non-Auction Declaration: "}</strong>
              {isZh
                ? "本平台提供的「在线询价」功能不属于《中华人民共和国拍卖法》规制的拍卖活动。其核心区别在于：①不存在公开竞价（报价相互不可见）；②不存在价高者得（卖方可接受或拒绝任何报价）；③不设固定加价幅度；④不设最低启动人数；⑤平台不设定保证金。本功能为买卖双方就二手农机设备进行价格协商的交易撮合服务。"
                : "The 'Online Inquiry' feature is not an auction under the PRC Auction Law. Key distinctions: (1) no public bidding (offers are private); (2) no highest-bidder-wins (seller may accept or reject any offer); (3) no fixed increment; (4) no minimum participants; (5) platform sets no deposit. This is a price negotiation service."}
            </p>
            <p>
              <strong>{isZh ? "二、平台定位：": "2. Platform Role: "}</strong>
              {isZh
                ? "平台作为信息中介和居间人，仅提供信息发布和沟通工具。平台不参与定价、不代收代付资金、不设定竞价规则、不确定成交结果、不承担交易担保责任。买卖双方应自行判断交易风险，遵守相关法律法规。"
                : "The platform serves as an information intermediary. It does not set prices, handle funds, define bidding rules, determine outcomes, or guarantee transactions. Both parties assess risks independently."}
            </p>
            <p>
              <strong>{isZh ? "三、信息披露：": "3. Information Disclosure: "}</strong>
              {isZh
                ? "所有设备信息均真实披露，包括已知瑕疵、司法处置渠道、无法过户风险等。卖方对明知或应知而未披露的重大瑕疵，以及因故意隐瞒或虚假陈述导致的损失，依法承担责任。"
                : "All equipment information is truthfully disclosed, including known defects, judicial disposal sources, and transfer risks. Seller remains liable for known but undisclosed defects."}
            </p>
            <p>
              <strong>{isZh ? "四、权属保证：": "4. Title Guarantee: "}</strong>
              {isZh
                ? "卖方确认其为标的物的合法所有权人或经合法授权的处置权人。卖方应配合买方办理过户手续。因卖方权属瑕疵导致无法过户的，买方有权解除合同并要求赔偿。"
                : "Seller confirms legal title or authorized disposal rights. Seller shall assist with transfer. Buyer may cancel for title defects."}
            </p>
          </div>
        </div>

        {/* Flow Steps */}
        <div className="bg-white rounded-xl p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">{isZh ? "询价流程" : "Inquiry Process"}</h2>
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
          <h2 className="text-xl font-bold text-gray-900 mb-4">{isZh ? "交易保障" : "Transaction Guarantees"}</h2>
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
                <p className="text-xs text-gray-500 mb-1">{isZh ? "买家成交费" : "Buyer Fee"}</p>
                <p className="text-3xl font-bold text-amber-600 font-mono">2%</p>
                <p className="text-xs text-gray-500 mt-1">
                  {isZh ? "按成交价收取，成交后支付" : "Of deal price, paid after closing"}
                </p>
              </div>
              <div className="bg-white rounded-xl p-4 border border-amber-200">
                <p className="text-xs text-gray-500 mb-1">{isZh ? "卖家成交费" : "Seller Fee"}</p>
                <p className="text-3xl font-bold text-amber-600 font-mono">3%</p>
                <p className="text-xs text-gray-500 mt-1">
                  {isZh ? "按成交价收取，成交后支付" : "Of deal price, paid after closing"}
                </p>
              </div>
            </div>

            <div className="bg-white rounded-xl p-4 border border-gray-200">
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
          <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
            <AlertCircle className="h-6 w-6 text-red-500" />
            {isZh ? "风险提示" : "Risk Warnings"}
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
            {isZh ? "格式条款特别提示" : "Standard Terms Notice"}
          </h2>
          <div className="bg-blue-50 rounded-xl p-4 space-y-3 text-sm text-blue-900 leading-relaxed">
            <p>
              {isZh
                ? "根据《中华人民共和国民法典》第496条，本平台特别提示您注意以下条款（完整条款详见买卖合同）："
                : "Per PRC Civil Code Art. 496, please note the following terms (full terms in the sales contract):"}
            </p>
            <div className="space-y-2 ml-4">
              <div className="flex items-start gap-2">
                <span className="font-bold">①</span>
                <span>
                  <strong>{isZh ? "瑕疵告知及免责：": "Defects & Disclaimer: "}</strong>
                  {isZh
                    ? "标的物按现状交付。卖方对经合理查验可发现的瑕疵不承担担保责任，但对明知或应知而未披露的重大瑕疵，以及因故意隐瞒或虚假陈述导致的损失，仍依法承担责任。"
                    : "Sold as-is. Seller not liable for discoverable defects but remains liable for concealed defects or misrepresentation."}
                </span>
              </div>
              <div className="flex items-start gap-2">
                <span className="font-bold">②</span>
                <span>
                  <strong>{isZh ? "过户事宜：": "Transfer: "}</strong>
                  {isZh
                    ? "卖方应配合买方办理过户手续。因卖方权属瑕疵导致无法过户的，买方有权解除合同，卖方应退还已付全部款项并赔偿直接损失。"
                    : "Seller shall assist with transfer. Buyer may cancel for title defects and recover full payment plus losses."}
                </span>
              </div>
              <div className="flex items-start gap-2">
                <span className="font-bold">③</span>
                <span>
                  <strong>{isZh ? "违约责任：": "Liability: "}</strong>
                  {isZh
                    ? "买卖双方违约责任对等。卖方无法交付须退还已付款项并支付违约金；买方逾期付款保证金不予退还。"
                    : "Mutual liability. Seller refunds plus penalty for non-delivery; buyer forfeits deposit for late payment."}
                </span>
              </div>
              <div className="flex items-start gap-2">
                <span className="font-bold">④</span>
                <span>
                  <strong>{isZh ? "非拍卖声明：": "Non-Auction: "}</strong>
                  {isZh
                    ? "本功能为在线询价/报价，不是拍卖。卖方可接受或拒绝任何报价。报价相互不可见。"
                    : "This is an inquiry/quote service, not an auction. Seller may accept or reject any offer. Offers are private."}
                </span>
              </div>
            </div>
            <p className="text-xs text-blue-600 mt-2">
              {isZh
                ? "请在签署买卖合同前仔细阅读上述条款。如有疑问，可咨询专业律师。"
                : "Please review these terms carefully before signing the contract. Consult a lawyer if needed."}
            </p>
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
            ← {isZh ? "返回询价列表" : "Back to Listings"}
          </Link>
        </div>
      </div>
    </div>
  );
}
