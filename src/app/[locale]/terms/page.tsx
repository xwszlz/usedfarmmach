import { translate } from "@/lib/i18n-runtime";
import type { Metadata } from "next";
import { isCnSite } from "@/config/site";
import { getLocale } from "next-intl/server";
export async function generateMetadata({ params, }: {
    params: Promise<{
        locale: string;
    }>;
}): Promise<Metadata> {
    const { locale } = await params;
    const title = locale === "zh" ? "\u7528\u6237\u534F\u8BAE - \u795E\u96D5\u519C\u673A" : "Terms of Service - AgriTrade";
    const description = locale === "zh"
        ? "\u795E\u96D5\u519C\u673A\u7528\u6237\u534F\u8BAE\uFF1A\u660E\u786E\u5E73\u53F0\u670D\u52A1\u8303\u56F4\u3001\u7528\u6237\u6743\u5229\u4E49\u52A1\u3001\u5E73\u53F0\u8D23\u4EFB\u8FB9\u754C\u3001\u4E89\u8BAE\u89E3\u51B3\u673A\u5236\u7B49\u6761\u6B3E\u3002"
        : "AgriTrade Terms of Service: Platform scope, user rights and obligations, liability, dispute resolution.";
    return {
        title,
        description,
        robots: { index: true, follow: true },
    };
}
export default async function TermsPage({ params, }: {
    params: Promise<{
        locale: string;
    }>;
}) {
    const { locale } = await params;
    const isZh = locale === "zh";
    const isCn = isCnSite();
    return (<div className="mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:px-8">
      <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
        {translate("用户协议", locale)}
      </h1>
      <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
        {translate("最近更新日期：2026年7月17日 | 生效日期：2026年7月17日", locale)}
      </p>

      <div className="prose prose-sm dark:prose-invert mt-8 max-w-none text-gray-700 dark:text-gray-300 leading-relaxed space-y-6">
        {isCn ? <TermsContentCn /> : isZh ? <TermsContentZh /> : <TermsContentEn />}
      </div>
    </div>);
}
async function TermsContentZh() {
  const locale = await getLocale();
    return (<>
      <div className="rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 p-4">
        <p className="text-sm text-amber-800 dark:text-amber-200">
          <strong>{translate("请您仔细阅读以下用户协议（以下简称“本协议”）。", locale)}</strong>{translate("本协议构成您与石家庄神雕农机科技有限公司（以下简称“神雕农机”或“我们”） 之间具有法律约束力的合同。当您注册、登录或使用本平台服务时，即表示您已阅读、理解并同意接受本协议的全部条款。 如您不同意本协议的任何内容，请勿使用本平台服务。", locale)}</p>
      </div>

      <section>
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">{translate("第一条 平台服务范围与定位声明", locale)}</h2>
        <ol className="list-decimal pl-6 space-y-2">
          <li>
            <strong>{translate("平台定位：", locale)}</strong>{translate("神雕农机（usedfarmmach.com及“神雕农机”微信小程序）是一个二手农机及相关设备的信息发布与撮合平台。 我们提供信息展示、搜索、联系、AI估值辅助等服务，", locale)}<strong>{translate("不参与实际交易，不作为买方或卖方当事人，不担保交易的完成。", locale)}</strong>
          </li>
          <li>
            <strong>{translate("服务内容：", locale)}</strong>{translate("本平台提供以下服务：", locale)}<ul className="list-disc pl-6 mt-1 space-y-1">
              <li>{translate("二手农机产品信息发布与展示", locale)}</li>
              <li>{translate("产品搜索、筛选与浏览", locale)}</li>
              <li>{translate("买卖双方在线沟通渠道（询价、联系方式展示）", locale)}</li>
              <li>{translate("AI智能估值服务（国产及国际品牌）", locale)}</li>
              <li>{translate("虚拟博览展示（品牌馆、新锐专业馆）", locale)}</li>
              <li>{translate("AI竞技场（农机多维度对比分析）", locale)}</li>
              <li>{translate("AI工程师认证体系", locale)}</li>
              <li>{translate("行业研究与资讯内容", locale)}</li>
              <li>{translate("零部件信息发布与询价", locale)}</li>
              <li>{translate("会员增值服务", locale)}</li>
            </ul>
          </li>
          <li>
            <strong>{translate("平台角色：", locale)}</strong>{translate("本平台为信息撮合服务提供者，非交易参与方。买卖双方之间的交易行为（包括但不限于价格协商、 合同签订、付款、物流、验收、售后等）由买卖双方自行完成并承担相应风险。", locale)}</li>
        </ol>
      </section>

      <section>
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">{translate("第二条 用户注册与账号管理", locale)}</h2>
        <ol className="list-decimal pl-6 space-y-2">
          <li>
            <strong>{translate("注册资格：", locale)}</strong>{translate("您必须是具有完全民事行为能力的自然人或依法成立的法人/非法人组织方可注册使用本平台。 未满18周岁的自然人不得注册使用本平台。", locale)}</li>
          <li>
            <strong>{translate("注册信息：", locale)}</strong>{translate("您在注册时应提供真实、准确、完整的注册信息（手机号或电子邮箱、密码等）。 如注册信息发生变化，您应及时更新。", locale)}</li>
          <li>
            <strong>{translate("账号安全：", locale)}</strong>{translate("您应妥善保管账号和密码，因您泄露、转让账号密码导致的损失由您自行承担。 您发现账号被盗用或存在安全风险时，应立即通知我们。", locale)}</li>
          <li>
            <strong>{translate("实名认证：", locale)}</strong>{translate("卖家发布产品前须完成实名认证（提供真实姓名、联系电话、企业名称等信息）。 我们有权对卖家身份进行审核，有权拒绝未通过审核的用户发布产品。", locale)}</li>
        </ol>
      </section>

      <section>
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">{translate("第三条 用户行为规范", locale)}</h2>
        <p>{translate("您在使用本平台服务时，应遵守中华人民共和国法律法规，不得利用本平台从事以下行为：", locale)}</p>
        <ol className="list-decimal pl-6 space-y-1 mt-2">
          <li>{translate("发布虚假、欺诈性或误导性的产品信息；", locale)}</li>
          <li>{translate("发布国家禁止交易的限制进出口农机设备；", locale)}</li>
          <li>{translate("冒用他人身份或企业信息；", locale)}</li>
          <li>{translate("侵犯他人知识产权、商业秘密或合法权益；", locale)}</li>
          <li>{translate("恶意刷单、刷评、扰乱平台正常运营秩序；", locale)}</li>
          <li>{translate("未经授权采集、抓取平台数据；", locale)}</li>
          <li>{translate("发布与二手农机交易无关的广告或垃圾信息；", locale)}</li>
          <li>{translate("利用平台从事洗钱、恐怖融资等违法犯罪活动；", locale)}</li>
          <li>{translate("其他违反法律法规或公序良俗的行为。", locale)}</li>
        </ol>
        <p className="mt-2">{translate("如我们发现您存在上述行为，我们有权采取警告、限制功能、暂停服务、封禁账号等措施， 并保留向有关部门举报或追究法律责任的权利。", locale)}</p>
      </section>

      <section>
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">{translate("第四条 禁止交易物品", locale)}</h2>
        <p>{translate("以下物品禁止在本平台发布和交易：", locale)}</p>
        <ol className="list-decimal pl-6 space-y-1 mt-2">
          <li>{translate("国家明令禁止生产、销售和使用的农机设备；", locale)}</li>
          <li>{translate("未取得强制性产品认证（CCC认证）的农机产品（按规定需要认证的）；", locale)}</li>
          <li>{translate("盗窃、抢劫等非法来源的农机设备；", locale)}</li>
          <li>{translate("明知是假冒伪劣的农机产品；", locale)}</li>
          <li>{translate("国家禁止进口的旧农机（如旧拖拉机整车进口，依据《禁止进口货物目录》）;", locale)}</li>
          <li>{translate("其他法律法规禁止交易的物品。", locale)}</li>
        </ol>
      </section>

      <section>
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">{translate("第五条 信息发布规范", locale)}</h2>
        <ol className="list-decimal pl-6 space-y-2">
          <li>{translate("卖家发布产品信息时应确保信息真实、准确、完整，包括但不限于品牌、型号、年份、功率、工作时长、成色描述等。", locale)}</li>
          <li>{translate("产品图片应为实物拍摄，不得使用他人图片或网络图片。AI生成图片须标注“AI生成/示意图”。", locale)}</li>
          <li>{translate("产品价格应标明币种。如标注“面议”，应在联系方式中提供有效沟通渠道。", locale)}</li>
          <li>{translate("卖家应如实描述产品缺陷和维修历史，不得故意隐瞒重大质量问题。", locale)}</li>
          <li>{translate("我们有权对发布的产品信息进行审核，有权删除违反本协议或法律法规的信息。", locale)}</li>
        </ol>
      </section>

      <section>
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">{translate("第六条 AI估值服务免责条款", locale)}</h2>
        <ol className="list-decimal pl-6 space-y-2">
          <li>
            <strong>{translate("服务性质：", locale)}</strong>{translate("AI估值服务基于公开数据（包括全国农机购置补贴数据、市场行情数据等）和算法模型生成估值参考，", locale)}<strong>{translate("估值结果仅供参考，不构成交易建议、价格承诺或价值担保。", locale)}</strong>
          </li>
          <li>
            <strong>{translate("免责声明：", locale)}</strong>{translate("神雕农机不对AI估值结果的准确性、完整性、及时性承担任何法律责任。 用户不应仅依据AI估值结果做出交易决策。交易价格由买卖双方自行协商确定。", locale)}</li>
          <li>
            <strong>{translate("数据来源：", locale)}</strong>{translate("AI估值所使用的补贴数据来源于各省农业农村厅公开发布的农机购置补贴数据， 市场行情数据来源于公开互联网信息。我们不保证上述数据的实时性和全面性。", locale)}</li>
          <li>
            <strong>{translate("估值偏差：", locale)}</strong>{translate("实际成交价可能因设备成色、配置、地区差异、市场供需等因素与AI估值存在较大偏差， 这属于正常现象，不构成我们的违约或过错。", locale)}</li>
        </ol>
      </section>

      <section>
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">{translate("第七条 知识产权保护", locale)}</h2>
        <ol className="list-decimal pl-6 space-y-2">
          <li>
            <strong>{translate("平台内容：", locale)}</strong>{translate("本平台的页面设计、文字内容、Logo、AI生成图片等知识产权归神雕农机或相关权利人所有， 未经授权不得复制、转载或用于其他商业目的。", locale)}</li>
          <li>
            <strong>{translate("品牌展示：", locale)}</strong>{translate("本平台展示的农机品牌名称、Logo等知识产权归相应品牌方所有。 本平台对品牌信息的展示属于指示性使用，不构成对品牌的代言或授权。", locale)}</li>
          <li>
            <strong>{translate("用户内容授权：", locale)}</strong>{translate("您在本平台发布的产品信息、图片等内容，您保留知识产权，同时授权本平台在平台内展示和使用。", locale)}</li>
          <li>
            <strong>{translate("侵权投诉：", locale)}</strong>{translate("如您发现平台上有侵犯您知识产权的内容，请发送侵权通知至 jiusei0319@gmail.com， 我们将在收到通知后及时处理。", locale)}</li>
        </ol>
      </section>

      <section>
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">{translate("第八条 平台责任限制", locale)}</h2>
        <ol className="list-decimal pl-6 space-y-2">
          <li>
            <strong>{translate("信息真实性：", locale)}</strong>{translate("本平台不对用户发布的产品信息的真实性、准确性、完整性进行实质性审查。 买卖双方应自行核实交易对方身份和产品信息。", locale)}</li>
          <li>
            <strong>{translate("交易风险：", locale)}</strong>{translate("本平台不参与实际交易，不对交易标的物的质量、权属、交付、付款等承担任何责任。 交易过程中产生的纠纷由买卖双方自行解决。", locale)}</li>
          <li>
            <strong>{translate("不可抗力：", locale)}</strong>{translate("因不可抗力（自然灾害、政策变化、网络故障等）导致的服务中断或损失，我们不承担责任。", locale)}</li>
          <li>
            <strong>{translate("先行赔付情形：", locale)}</strong>{translate("根据《消费者权益保护法》第四十四条，如我们无法提供卖家真实名称、地址和有效联系方式， 消费者可要求我们先行赔偿。但我们在赔偿后有权向卖家追偿。", locale)}</li>
        </ol>
      </section>

      <section>
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">{translate("第九条 隐私政策", locale)}</h2>
        <p>{translate("我们重视您的个人信息保护。关于我们如何收集、使用、存储、保护和处理您的个人信息， 请参阅我们的“", locale)}<a href="/zh/privacy" className="text-blue-600 dark:text-blue-400 underline">{translate("隐私政策", locale)}</a>{translate("”。 隐私政策构成本协议不可分割的一部分。", locale)}</p>
      </section>

      <section>
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">{translate("第十条 会员服务", locale)}</h2>
        <ol className="list-decimal pl-6 space-y-2">
          <li>
            <strong>{translate("会员等级：", locale)}</strong>{translate("本平台提供以下会员等级：", locale)}<ul className="list-disc pl-6 mt-1">
              <li>{translate("免费会员（Free）：每日5次AI估值查询", locale)}</li>
              <li>{translate("基础会员（Basic）：99元/年，50次AI估值查询", locale)}</li>
              <li>{translate("高级会员（Premium）：299元/年，无限次AI估值查询", locale)}</li>
              <li>{translate("企业会员（Enterprise）：999元/年，无限次查询+企业专属功能", locale)}</li>
            </ul>
          </li>
          <li>
            <strong>{translate("支付方式：", locale)}</strong>{translate("会员费通过对公转账方式收取。 具体收款账户信息将在您选择会员升级时展示。", locale)}</li>
          <li>
            <strong>{translate("退费政策：", locale)}</strong>{translate("会员服务为数字内容服务，一经开通不支持无理由退款。 如因平台原因导致会员服务无法正常使用，我们将按剩余服务期限比例退还会员费。", locale)}</li>
          <li>
            <strong>{translate("会员义务：", locale)}</strong>{translate("会员不得将账号转让、出借给他人使用。如发现违规，我们有权封禁账号且不予退费。", locale)}</li>
        </ol>
      </section>

      <section>
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">{translate("第十一条 账号注销", locale)}</h2>
        <ol className="list-decimal pl-6 space-y-2">
          <li>{translate("您可随时通过“个人中心”申请注销账号，也可发送邮件至 jiusei0319@gmail.com 申请注销。", locale)}</li>
          <li>{translate("账号注销后，我们将在15个工作日内删除您的个人信息或进行匿名化处理。", locale)}</li>
          <li>{translate("账号注销前，请确保已完成所有进行中的交易。注销后未完成的交易由您自行承担后果。", locale)}</li>
          <li>{translate("账号注销后无法恢复，您如需再次使用本平台服务须重新注册。", locale)}</li>
        </ol>
      </section>

      <section>
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">{translate("第十二条 通知与送达", locale)}</h2>
        <ol className="list-decimal pl-6 space-y-2">
          <li>{translate("我们可通过平台公告、站内信、电子邮件或短信等方式向您发送通知。", locale)}</li>
          <li>{translate("通知自发出之时视为已送达您。如您联系方式变更未及时更新，导致无法接收通知的，后果由您承担。", locale)}</li>
          <li>{translate("本协议项下的通知发送至您注册时提供的邮箱或手机号即视为有效送达。", locale)}</li>
        </ol>
      </section>

      <section>
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">{translate("第十三条 协议变更", locale)}</h2>
        <p>{translate("我们可能不时修订本协议。当本协议发生重大变更时，我们将通过平台公告或邮件方式提前通知您。 修订后的协议自公告之日起生效。如您在修订生效后继续使用本平台服务，即视为您同意接受修订后的协议。 如您不同意修订内容，应停止使用本平台服务。", locale)}</p>
      </section>

      <section>
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">{translate("第十四条 争议解决", locale)}</h2>
        <ol className="list-decimal pl-6 space-y-2">
          <li>{translate("本协议的订立、生效、解释、履行和争议解决均适用中华人民共和国法律。", locale)}</li>
          <li>{translate("因本协议或本平台服务产生的争议，双方应首先通过友好协商解决。 协商不成的，任何一方均可向", locale)}<strong>{translate("被告住所地", locale)}</strong>{translate("有管辖权的人民法院提起诉讼。", locale)}</li>
          <li>{translate("在争议解决期间，不涉及争议的条款继续有效。", locale)}</li>
        </ol>
      </section>

      <section>
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">{translate("第十五条 免责声明汇总", locale)}</h2>
        <div className="rounded-lg bg-gray-50 dark:bg-gray-800 p-4 space-y-2 text-sm">
          <p>{translate("1. 本平台不对用户发布信息的真实性、准确性承担担保责任。", locale)}</p>
          <p>{translate("2. 本平台不参与实际交易，不对交易标的物质量、权属、交付承担担保责任。", locale)}</p>
          <p>{translate("3. AI估值结果仅供参考，不构成交易建议或价格承诺。", locale)}</p>
          <p>{translate("4. 本平台不对物流运输、付款安全等交易环节承担担保责任。", locale)}</p>
          <p>{translate("5. 本平台不对卖家履约能力、信用状况承担担保责任。", locale)}</p>
          <p>{translate("6. 因不可抗力导致的服务中断或损失，本平台不承担责任。", locale)}</p>
        </div>
      </section>

      <section>
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">{translate("第十六条 联系方式", locale)}</h2>
        <ul className="space-y-1">
          <li><strong>{translate("运营主体：", locale)}</strong>{translate("石家庄神雕农机科技有限公司", locale)}</li>
          <li><strong>{translate("联系邮箱：", locale)}</strong>jiusei0319@gmail.com</li>
          <li><strong>{translate("注册地址：", locale)}</strong>{translate("河北省石家庄市元氏县马村乡聊村", locale)}</li>
        </ul>
      </section>

      <div className="mt-8 rounded-lg bg-gray-50 dark:bg-gray-800 p-4 text-xs text-gray-500 dark:text-gray-400">
        <p>{translate("本用户协议由石家庄神雕农机科技有限公司制定。本协议中的免责条款已以加粗方式突出显示， 请您特别注意。本协议最终解释权归石家庄神雕农机科技有限公司所有， 但涉及消费者权益保护的条款以《中华人民共和国消费者权益保护法》等强制性法律规定为准。", locale)}</p>
      </div>
    </>);
}
function TermsContentEn() {
    return (<>
      <p className="text-gray-600 dark:text-gray-400">
        Shijiazhuang Shendiao Agricultural Machinery Technology Co., Ltd.
        (&ldquo;we&rdquo; or &ldquo;AgriTrade&rdquo;) operates the usedfarmmach.com website
        and the &ldquo;AgriTrade&rdquo; WeChat Mini Program.
      </p>
      <p className="mt-4 text-sm text-gray-500">
        The English version is a translation of the Chinese Terms of Service for reference only.
        In case of any discrepancy, the Chinese version shall prevail.
        The full English version will be available soon. For now, please refer to the Chinese version.
      </p>
    </>);
}
async function TermsContentCn() {
  const locale = await getLocale();
    return (<>
      <div className="rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 p-4">
        <p className="text-sm text-amber-800 dark:text-amber-200">
          <strong>{translate("请您仔细阅读以下用户协议（以下简称“本协议”）。", locale)}</strong>{translate("本协议构成您与石家庄神雕农机科技有限公司（以下简称“神雕农机”或“我们”） 之间具有法律约束力的合同。当您注册、登录或使用本平台服务时，即表示您已阅读、理解并同意接受本协议的全部条款。 如您不同意本协议的任何内容，请勿使用本平台服务。", locale)}</p>
      </div>

      <section>
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">{translate("第一条 平台服务范围与定位声明", locale)}</h2>
        <ol className="list-decimal pl-6 space-y-2">
          <li>
            <strong>{translate("平台定位：", locale)}</strong>{translate("神雕农机（usedfarmmach.cn及“神雕农机”微信小程序）是一个二手农机及相关设备的信息发布与撮合平台。 我们提供信息展示、搜索、联系、AI估值辅助等服务，", locale)}<strong>{translate("不参与实际交易，不作为买方或卖方当事人，不担保交易的完成。", locale)}</strong>
          </li>
          <li>
            <strong>{translate("服务内容：", locale)}</strong>{translate("本平台提供以下服务：", locale)}<ul className="list-disc pl-6 mt-1 space-y-1">
              <li>{translate("二手农机产品信息发布与展示", locale)}</li>
              <li>{translate("产品搜索、筛选与浏览", locale)}</li>
              <li>{translate("买卖双方在线沟通渠道（询价、联系方式展示）", locale)}</li>
              <li>{translate("AI智能估值服务（国产及国际品牌）", locale)}</li>
              <li>{translate("虚拟博览展示（品牌馆、新锐专业馆）", locale)}</li>
              <li>{translate("AI竞技场（农机多维度对比分析）", locale)}</li>
              <li>{translate("AI工程师认证体系", locale)}</li>
              <li>{translate("行业研究与资讯内容", locale)}</li>
              <li>{translate("零部件信息发布与询价", locale)}</li>
              <li>{translate("会员增值服务", locale)}</li>
            </ul>
          </li>
          <li>
            <strong>{translate("平台角色：", locale)}</strong>{translate("本平台为信息撮合服务提供者，非交易参与方。买卖双方之间的交易行为（包括但不限于价格协商、 合同签订、付款、物流、验收、售后等）由买卖双方自行完成并承担相应风险。", locale)}</li>
        </ol>
      </section>

      <section>
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">{translate("第二条 用户注册与账号管理", locale)}</h2>
        <ol className="list-decimal pl-6 space-y-2">
          <li>
            <strong>{translate("注册资格：", locale)}</strong>{translate("您必须是具有完全民事行为能力的自然人或依法成立的法人/非法人组织方可注册使用本平台。 未满18周岁的自然人不得注册使用本平台。", locale)}</li>
          <li>
            <strong>{translate("注册信息：", locale)}</strong>{translate("您在注册时应提供真实、准确、完整的注册信息（手机号或电子邮箱、密码等）。 如注册信息发生变化，您应及时更新。", locale)}</li>
          <li>
            <strong>{translate("账号安全：", locale)}</strong>{translate("您应妥善保管账号和密码，因您泄露、转让账号密码导致的损失由您自行承担。 您发现账号被盗用或存在安全风险时，应立即通知我们。", locale)}</li>
          <li>
            <strong>{translate("实名认证：", locale)}</strong>{translate("卖家发布产品前须完成实名认证（提供真实姓名、联系电话、企业名称等信息）。 我们有权对卖家身份进行审核，有权拒绝未通过审核的用户发布产品。", locale)}</li>
        </ol>
      </section>

      <section>
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">{translate("第三条 用户行为规范", locale)}</h2>
        <p>{translate("您在使用本平台服务时，应遵守中华人民共和国法律法规，不得利用本平台从事以下行为：", locale)}</p>
        <ol className="list-decimal pl-6 space-y-1 mt-2">
          <li>{translate("发布虚假、欺诈性或误导性的产品信息；", locale)}</li>
          <li>{translate("发布国家禁止交易的限制进出口农机设备；", locale)}</li>
          <li>{translate("冒用他人身份或企业信息；", locale)}</li>
          <li>{translate("侵犯他人知识产权、商业秘密或合法权益；", locale)}</li>
          <li>{translate("恶意刷单、刷评、扰乱平台正常运营秩序；", locale)}</li>
          <li>{translate("未经授权采集、抓取平台数据；", locale)}</li>
          <li>{translate("发布与二手农机交易无关的广告或垃圾信息；", locale)}</li>
          <li>{translate("利用平台从事洗钱、恐怖融资等违法犯罪活动；", locale)}</li>
          <li>{translate("其他违反法律法规或公序良俗的行为。", locale)}</li>
        </ol>
        <p className="mt-2">{translate("如我们发现您存在上述行为，我们有权采取警告、限制功能、暂停服务、封禁账号等措施， 并保留向有关部门举报或追究法律责任的权利。", locale)}</p>
      </section>

      <section>
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">{translate("第四条 禁止交易物品", locale)}</h2>
        <p>{translate("以下物品禁止在本平台发布和交易：", locale)}</p>
        <ol className="list-decimal pl-6 space-y-1 mt-2">
          <li>{translate("国家明令禁止生产、销售和使用的农机设备；", locale)}</li>
          <li>{translate("未取得强制性产品认证（CCC认证）的农机产品（按规定需要认证的）；", locale)}</li>
          <li>{translate("盗窃、抢劫等非法来源的农机设备；", locale)}</li>
          <li>{translate("明知是假冒伪劣的农机产品；", locale)}</li>
          <li>{translate("国家禁止进口的旧农机（如旧拖拉机整车进口，依据《禁止进口货物目录》）;", locale)}</li>
          <li>{translate("其他法律法规禁止交易的物品。", locale)}</li>
        </ol>
      </section>

      <section>
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">{translate("第五条 信息发布规范", locale)}</h2>
        <ol className="list-decimal pl-6 space-y-2">
          <li>{translate("卖家发布产品信息时应确保信息真实、准确、完整，包括但不限于品牌、型号、年份、功率、工作时长、成色描述等。", locale)}</li>
          <li>{translate("产品图片应为实物拍摄，不得使用他人图片或网络图片。AI生成图片须标注“AI生成/示意图”。", locale)}</li>
          <li>{translate("产品价格应标明币种。如标注“面议”，应在联系方式中提供有效沟通渠道。", locale)}</li>
          <li>{translate("卖家应如实描述产品缺陷和维修历史，不得故意隐瞒重大质量问题。", locale)}</li>
          <li>{translate("我们有权对发布的产品信息进行审核，有权删除违反本协议或法律法规的信息。", locale)}</li>
        </ol>
      </section>

      <section>
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">{translate("第六条 AI估值服务免责条款", locale)}</h2>
        <ol className="list-decimal pl-6 space-y-2">
          <li>
            <strong>{translate("服务性质：", locale)}</strong>{translate("AI估值服务基于公开数据（包括全国农机购置补贴数据、市场行情数据等）和算法模型生成估值参考，", locale)}<strong>{translate("估值结果仅供参考，不构成交易建议、价格承诺或价值担保。", locale)}</strong>
          </li>
          <li>
            <strong>{translate("免责声明：", locale)}</strong>{translate("神雕农机不对AI估值结果的准确性、完整性、及时性承担任何法律责任。 用户不应仅依据AI估值结果做出交易决策。交易价格由买卖双方自行协商确定。", locale)}</li>
          <li>
            <strong>{translate("数据来源：", locale)}</strong>{translate("AI估值所使用的补贴数据来源于各省农业农村厅公开发布的农机购置补贴数据， 市场行情数据来源于公开互联网信息。我们不保证上述数据的实时性和全面性。", locale)}</li>
          <li>
            <strong>{translate("估值偏差：", locale)}</strong>{translate("实际成交价可能因设备成色、配置、地区差异、市场供需等因素与AI估值存在较大偏差， 这属于正常现象，不构成我们的违约或过错。", locale)}</li>
        </ol>
      </section>

      <section>
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">{translate("第七条 知识产权保护", locale)}</h2>
        <ol className="list-decimal pl-6 space-y-2">
          <li>
            <strong>{translate("平台内容：", locale)}</strong>{translate("本平台的页面设计、文字内容、Logo、AI生成图片等知识产权归神雕农机或相关权利人所有， 未经授权不得复制、转载或用于其他商业目的。", locale)}</li>
          <li>
            <strong>{translate("品牌展示：", locale)}</strong>{translate("本平台展示的农机品牌名称、Logo等知识产权归相应品牌方所有。 本平台对品牌信息的展示属于指示性使用，不构成对品牌的代言或授权。", locale)}</li>
          <li>
            <strong>{translate("用户内容授权：", locale)}</strong>{translate("您在本平台发布的产品信息、图片等内容，您保留知识产权，同时授权本平台在平台内展示和使用。", locale)}</li>
          <li>
            <strong>{translate("侵权投诉：", locale)}</strong>{translate("如您发现平台上有侵犯您知识产权的内容，请发送侵权通知至 jiusei0319@gmail.com， 我们将在收到通知后及时处理。", locale)}</li>
        </ol>
      </section>

      <section>
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">{translate("第八条 平台责任限制", locale)}</h2>
        <ol className="list-decimal pl-6 space-y-2">
          <li>
            <strong>{translate("信息真实性：", locale)}</strong>{translate("本平台不对用户发布的产品信息的真实性、准确性、完整性进行实质性审查。 买卖双方应自行核实交易对方身份和产品信息。", locale)}</li>
          <li>
            <strong>{translate("交易风险：", locale)}</strong>{translate("本平台不参与实际交易，不对交易标的物的质量、权属、交付、付款等承担任何责任。 交易过程中产生的纠纷由买卖双方自行解决。", locale)}</li>
          <li>
            <strong>{translate("不可抗力：", locale)}</strong>{translate("因不可抗力（自然灾害、政策变化、网络故障等）导致的服务中断或损失，我们不承担责任。", locale)}</li>
          <li>
            <strong>{translate("先行赔付情形：", locale)}</strong>{translate("根据《消费者权益保护法》第四十四条，如我们无法提供卖家真实名称、地址和有效联系方式， 消费者可要求我们先行赔偿。但我们在赔偿后有权向卖家追偿。", locale)}</li>
        </ol>
      </section>

      <section>
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">{translate("第九条 隐私政策", locale)}</h2>
        <p>{translate("我们重视您的个人信息保护。关于我们如何收集、使用、存储、保护和处理您的个人信息， 请参阅我们的“", locale)}<a href="/zh/privacy" className="text-blue-600 dark:text-blue-400 underline">{translate("隐私政策", locale)}</a>{translate("”。 隐私政策构成本协议不可分割的一部分。", locale)}</p>
      </section>

      <section>
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">{translate("第十条 会员服务", locale)}</h2>
        <ol className="list-decimal pl-6 space-y-2">
          <li>
            <strong>{translate("会员等级：", locale)}</strong>{translate("本平台提供以下会员等级（按自然年计费）：", locale)}<ul className="list-disc pl-6 mt-1">
              <li>{translate("免费会员（Free）：每日5次AI估值查询", locale)}</li>
              <li>{translate("基础会员（Basic）：99元/年，50次AI估值查询", locale)}</li>
              <li>{translate("高级会员（Premium）：299元/年，无限次AI估值查询", locale)}</li>
              <li>{translate("企业会员（Enterprise）：999元/年，无限次查询+企业专属功能", locale)}</li>
            </ul>
          </li>
          <li>
            <strong>{translate("支付方式：", locale)}</strong>{translate("会员费通过", locale)}<strong>{translate("微信小程序收发通（微信支付）", locale)}</strong>{translate("收取。资金由微信支付直接清算至本平台商户账户，", locale)}<strong>{translate("平台不触碰、不中转用户资金", locale)}</strong>{translate("；您亦可通过对公银行转账方式缴纳会员费，具体收款账户信息将在您选择会员升级时展示。", locale)}</li>
          <li>
            <strong>{translate("退费政策：", locale)}</strong>{translate("会员服务为数字内容服务，一经开通不支持无理由退款。 如因平台原因导致会员服务无法正常使用，我们将按剩余服务期限比例退还会员费。", locale)}</li>
          <li>
            <strong>{translate("会员义务：", locale)}</strong>{translate("会员不得将账号转让、出借给他人使用。如发现违规，我们有权封禁账号且不予退费。", locale)}</li>
        </ol>
      </section>

      <section>
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">{translate("第十一条 账号注销", locale)}</h2>
        <ol className="list-decimal pl-6 space-y-2">
          <li>{translate("您可随时通过“个人中心”申请注销账号，也可发送邮件至 jiusei0319@gmail.com 申请注销。", locale)}</li>
          <li>{translate("账号注销后，我们将在15个工作日内删除您的个人信息或进行匿名化处理。", locale)}</li>
          <li>{translate("账号注销前，请确保已完成所有进行中的交易。注销后未完成的交易由您自行承担后果。", locale)}</li>
          <li>{translate("账号注销后无法恢复，您如需再次使用本平台服务须重新注册。", locale)}</li>
        </ol>
      </section>

      <section>
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">{translate("第十二条 通知与送达", locale)}</h2>
        <ol className="list-decimal pl-6 space-y-2">
          <li>{translate("我们可通过平台公告、站内信、电子邮件或短信等方式向您发送通知。", locale)}</li>
          <li>{translate("通知自发出之时视为已送达您。如您联系方式变更未及时更新，导致无法接收通知的，后果由您承担。", locale)}</li>
          <li>{translate("本协议项下的通知发送至您注册时提供的邮箱或手机号即视为有效送达。", locale)}</li>
        </ol>
      </section>

      <section>
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">{translate("第十三条 协议变更", locale)}</h2>
        <p>{translate("我们可能不时修订本协议。当本协议发生重大变更时，我们将通过平台公告或邮件方式提前通知您。 修订后的协议自公告之日起生效。如您在修订生效后继续使用本平台服务，即视为您同意接受修订后的协议。 如您不同意修订内容，应停止使用本平台服务。", locale)}</p>
      </section>

      <section>
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">{translate("第十四条 争议解决", locale)}</h2>
        <ol className="list-decimal pl-6 space-y-2">
          <li>{translate("本协议的订立、生效、解释、履行和争议解决均适用中华人民共和国法律。", locale)}</li>
          <li>{translate("因本协议或本平台服务产生的争议，双方应首先通过友好协商解决。 协商不成的，任何一方均可向", locale)}<strong>{translate("被告住所地（河北省石家庄市）", locale)}</strong>{translate("有管辖权的人民法院提起诉讼。", locale)}</li>
          <li>{translate("在争议解决期间，不涉及争议的条款继续有效。", locale)}</li>
        </ol>
      </section>

      <section>
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">{translate("第十五条 免责声明汇总", locale)}</h2>
        <div className="rounded-lg bg-gray-50 dark:bg-gray-800 p-4 space-y-2 text-sm">
          <p>{translate("1. 本平台不对用户发布信息的真实性、准确性承担担保责任。", locale)}</p>
          <p>{translate("2. 本平台不参与实际交易，不对交易标的物质量、权属、交付承担担保责任。", locale)}</p>
          <p>{translate("3. AI估值结果仅供参考，不构成交易建议或价格承诺。", locale)}</p>
          <p>{translate("4. 本平台不对物流运输、付款安全等交易环节承担担保责任。", locale)}</p>
          <p>{translate("5. 本平台不对卖家履约能力、信用状况承担担保责任。", locale)}</p>
          <p>{translate("6. 因不可抗力导致的服务中断或损失，本平台不承担责任。", locale)}</p>
        </div>
      </section>

      <section>
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">{translate("第十六条 联系方式", locale)}</h2>
        <ul className="space-y-1">
          <li><strong>{translate("运营主体：", locale)}</strong>{translate("石家庄神雕农机科技有限公司", locale)}</li>
          <li><strong>{translate("联系邮箱：", locale)}</strong>jiusei0319@gmail.com</li>
          <li><strong>{translate("注册地址：", locale)}</strong>{translate("河北省石家庄市元氏县马村乡聊村", locale)}</li>
        </ul>
      </section>

      <div className="mt-8 rounded-lg bg-gray-50 dark:bg-gray-800 p-4 text-xs text-gray-500 dark:text-gray-400">
        <p>{translate("本用户协议由石家庄神雕农机科技有限公司制定。本协议中的免责条款已以加粗方式突出显示， 请您特别注意。本协议最终解释权归石家庄神雕农机科技有限公司所有， 但涉及消费者权益保护的条款以《中华人民共和国消费者权益保护法》等强制性法律规定为准。", locale)}</p>
      </div>
    </>);
}
