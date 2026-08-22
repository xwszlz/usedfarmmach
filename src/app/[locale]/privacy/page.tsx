import { translate } from "@/lib/i18n-runtime";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { isCnSite } from "@/config/site";
import { getLocale } from "next-intl/server";
export async function generateMetadata({ params, }: {
    params: Promise<{
        locale: string;
    }>;
}): Promise<Metadata> {
    const { locale } = await params;
    const title = locale === "zh" ? "\u9690\u79C1\u653F\u7B56 - \u795E\u96D5\u519C\u673A" : "Privacy Policy - AgriTrade";
    const description = locale === "zh"
        ? "\u795E\u96D5\u519C\u673A\u9690\u79C1\u653F\u7B56\uFF1A\u8BF4\u660E\u6211\u4EEC\u5982\u4F55\u6536\u96C6\u3001\u4F7F\u7528\u3001\u5B58\u50A8\u3001\u4FDD\u62A4\u548C\u5904\u7406\u60A8\u7684\u4E2A\u4EBA\u4FE1\u606F\uFF0C\u4EE5\u53CA\u60A8\u4EAB\u6709\u7684\u4E2A\u4EBA\u4FE1\u606F\u4E3B\u4F53\u6743\u5229\u3002"
        : "AgriTrade Privacy Policy: How we collect, use, store, protect and process your personal information, and your rights.";
    return {
        title,
        description,
        robots: { index: true, follow: true },
    };
}
export default async function PrivacyPage({ params, }: {
    params: Promise<{
        locale: string;
    }>;
}) {
    const { locale } = await params;
    const isZh = locale === "zh";
    const isCn = isCnSite();
    return (<div className="mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:px-8">
      <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
        {translate("隐私政策", locale)}
      </h1>
      <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
        {translate("最近更新日期：2026年7月17日 | 生效日期：2026年7月17日", locale)}
      </p>

      <div className="prose prose-sm dark:prose-invert mt-8 max-w-none text-gray-700 dark:text-gray-300 leading-relaxed space-y-6">
        {isCn ? <PrivacyContentCn /> : isZh ? <PrivacyContentZh /> : <PrivacyContentEn />}
      </div>
    </div>);
}
async function PrivacyContentZh() {
  const locale = await getLocale();
    return (<>
      <p className="text-gray-600 dark:text-gray-400">{translate("石家庄神雕农机科技有限公司（以下简称“我们”或“神雕农机”）运营 usedfarmmach.com 网站及“神雕农机”微信小程序（以下简称“本平台”）。 我们深知个人信息对您的重要性，将严格按照《中华人民共和国个人信息保护法》 （以下简称“PIPL”）、《中华人民共和国数据安全法》、《中华人民共和国网络安全法》 等法律法规，保护您的个人信息。", locale)}</p>

      <section>
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">{translate("一、信息处理者身份", locale)}</h2>
        <ul className="space-y-1">
          <li><strong>{translate("运营主体：", locale)}</strong>{translate("石家庄神雕农机科技有限公司", locale)}</li>
          <li><strong>{translate("注册地址：", locale)}</strong>{translate("河北省石家庄市元氏县马村乡聊村", locale)}</li>
          <li><strong>{translate("联系邮箱：", locale)}</strong>jiusei0319@gmail.com</li>
          <li><strong>{translate("个人信息保护负责人（DPO）：", locale)}</strong>{translate("您可通过上述邮箱联系我们，邮件标题请注明“个人信息保护咨询”。", locale)}</li>
        </ul>
      </section>

      <section>
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">{translate("二、我们收集的个人信息", locale)}</h2>
        <p>{translate("我们仅出于以下明确、合理的目的收集您的个人信息：", locale)}</p>
        <table className="w-full text-sm border border-gray-200 dark:border-gray-700 mt-3">
          <thead className="bg-gray-50 dark:bg-gray-800">
            <tr>
              <th className="border border-gray-200 dark:border-gray-700 px-3 py-2 text-left">{translate("信息类型", locale)}</th>
              <th className="border border-gray-200 dark:border-gray-700 px-3 py-2 text-left">{translate("具体内容", locale)}</th>
              <th className="border border-gray-200 dark:border-gray-700 px-3 py-2 text-left">{translate("收集目的", locale)}</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="border border-gray-200 dark:border-gray-700 px-3 py-2">{translate("注册登录信息", locale)}</td>
              <td className="border border-gray-200 dark:border-gray-700 px-3 py-2">{translate("手机号或电子邮箱、密码（加密存储）", locale)}</td>
              <td className="border border-gray-200 dark:border-gray-700 px-3 py-2">{translate("用户注册、登录、身份验证", locale)}</td>
            </tr>
            <tr>
              <td className="border border-gray-200 dark:border-gray-700 px-3 py-2">{translate("产品发布信息", locale)}</td>
              <td className="border border-gray-200 dark:border-gray-700 px-3 py-2">{translate("农机照片、参数信息、地理位置（省/市/经纬度）", locale)}</td>
              <td className="border border-gray-200 dark:border-gray-700 px-3 py-2">{translate("用户发布二手农机产品信息供买家浏览", locale)}</td>
            </tr>
            <tr>
              <td className="border border-gray-200 dark:border-gray-700 px-3 py-2">{translate("询价/商务信息", locale)}</td>
              <td className="border border-gray-200 dark:border-gray-700 px-3 py-2">{translate("企业名称、联系人姓名、联系电话", locale)}</td>
              <td className="border border-gray-200 dark:border-gray-700 px-3 py-2">{translate("展会询价、品牌认领、配件询价等业务处理", locale)}</td>
            </tr>
            <tr>
              <td className="border border-gray-200 dark:border-gray-700 px-3 py-2">{translate("AI估值数据", locale)}</td>
              <td className="border border-gray-200 dark:border-gray-700 px-3 py-2">{translate("用户上传的农机照片、品牌型号参数", locale)}</td>
              <td className="border border-gray-200 dark:border-gray-700 px-3 py-2">{translate("AI识别、分析及估值服务", locale)}</td>
            </tr>
            <tr>
              <td className="border border-gray-200 dark:border-gray-700 px-3 py-2">{translate("行为数据", locale)}</td>
              <td className="border border-gray-200 dark:border-gray-700 px-3 py-2">{translate("浏览记录、搜索记录、估值查询记录", locale)}</td>
              <td className="border border-gray-200 dark:border-gray-700 px-3 py-2">{translate("改善服务质量、个性化推荐（经匿名化处理后使用）", locale)}</td>
            </tr>
            <tr>
              <td className="border border-gray-200 dark:border-gray-700 px-3 py-2">{translate("微信小程序信息", locale)}</td>
              <td className="border border-gray-200 dark:border-gray-700 px-3 py-2">{translate("微信OpenID、UnionID（经微信授权获取）", locale)}</td>
              <td className="border border-gray-200 dark:border-gray-700 px-3 py-2">{translate("小程序用户身份识别", locale)}</td>
            </tr>
            <tr>
              <td className="border border-gray-200 dark:border-gray-700 px-3 py-2">{translate("会员支付信息", locale)}</td>
              <td className="border border-gray-200 dark:border-gray-700 px-3 py-2">{translate("会员等级、充值记录（支付由持牌支付机构处理，我们不存储完整支付凭证）", locale)}</td>
              <td className="border border-gray-200 dark:border-gray-700 px-3 py-2">{translate("会员服务管理", locale)}</td>
            </tr>
            <tr>
              <td className="border border-gray-200 dark:border-gray-700 px-3 py-2">{translate("设备与技术信息", locale)}</td>
              <td className="border border-gray-200 dark:border-gray-700 px-3 py-2">{translate("IP地址、浏览器类型、操作系统、设备标识符", locale)}</td>
              <td className="border border-gray-200 dark:border-gray-700 px-3 py-2">{translate("安全保障、反欺诈、服务运行维护", locale)}</td>
            </tr>
          </tbody>
        </table>
      </section>

      <section>
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">{translate("三、信息使用规则", locale)}</h2>
        <p>{translate("我们将您的个人信息仅用于本政策第二条约定的收集目的。在以下情形中，我们可能会将您的信息用于其他目的：", locale)}</p>
        <ul className="list-disc pl-6 space-y-1 mt-2">
          <li>{translate("取得您的单独同意后；", locale)}</li>
          <li>{translate("为履行法定义务所必需；", locale)}</li>
          <li>{translate("为应对突发公共卫生事件或紧急情况保护自然人的生命健康和财产安全所必需；", locale)}</li>
          <li>{translate("为公共利益实施新闻报道、舆论监督等行为在合理范围内处理个人信息。", locale)}</li>
        </ul>
        <p className="mt-2">
          <strong>{translate("AI估值服务特别说明：", locale)}</strong>{translate("用户上传的农机照片仅供AI识别和估值分析使用。AI估值结果基于公开数据和算法模型生成， 仅供参考，不构成交易建议或价格承诺。", locale)}</p>
      </section>

      <section>
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">{translate("四、信息共享、转让与公开", locale)}</h2>
        <p>{translate("我们不会向第三方出售您的个人信息。在以下情形中，我们可能共享您的个人信息：", locale)}</p>
        <table className="w-full text-sm border border-gray-200 dark:border-gray-200 mt-3">
          <thead className="bg-gray-50 dark:bg-gray-800">
            <tr>
              <th className="border border-gray-200 dark:border-gray-700 px-3 py-2 text-left">{translate("接收方", locale)}</th>
              <th className="border border-gray-200 dark:border-gray-700 px-3 py-2 text-left">{translate("共享信息", locale)}</th>
              <th className="border border-gray-200 dark:border-gray-700 px-3 py-2 text-left">{translate("共享目的", locale)}</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="border border-gray-200 dark:border-gray-700 px-3 py-2">{translate("阿里云OSS（图片存储）", locale)}</td>
              <td className="border border-gray-200 dark:border-gray-700 px-3 py-2">{translate("用户上传的农机图片", locale)}</td>
              <td className="border border-gray-200 dark:border-gray-700 px-3 py-2">{translate("图片存储和CDN加速", locale)}</td>
            </tr>
            <tr>
              <td className="border border-gray-200 dark:border-gray-700 px-3 py-2">{translate("Vercel（网站托管）", locale)}</td>
              <td className="border border-gray-200 dark:border-gray-700 px-3 py-2">{translate("网站运行所需的技术数据", locale)}</td>
              <td className="border border-gray-200 dark:border-gray-700 px-3 py-2">{translate("网站部署和全球访问加速", locale)}</td>
            </tr>
            <tr>
              <td className="border border-gray-200 dark:border-gray-700 px-3 py-2">{translate("Neon（数据库服务）", locale)}</td>
              <td className="border border-gray-200 dark:border-gray-700 px-3 py-2">{translate("用户注册信息和产品数据", locale)}</td>
              <td className="border border-gray-200 dark:border-gray-700 px-3 py-2">{translate("数据存储和管理", locale)}</td>
            </tr>
            <tr>
              <td className="border border-gray-200 dark:border-gray-700 px-3 py-2">{translate("Resend（邮件服务）", locale)}</td>
              <td className="border border-gray-200 dark:border-gray-700 px-3 py-2">{translate("用户邮箱地址", locale)}</td>
              <td className="border border-gray-200 dark:border-gray-700 px-3 py-2">{translate("注册验证邮件、密码重置邮件", locale)}</td>
            </tr>
            <tr>
              <td className="border border-gray-200 dark:border-gray-700 px-3 py-2">{translate("银行对公转账", locale)}</td>
              <td className="border border-gray-200 dark:border-gray-700 px-3 py-2">{translate("汇款备注信息（由银行直接处理）", locale)}</td>
              <td className="border border-gray-200 dark:border-gray-700 px-3 py-2">{translate("会员费收取", locale)}</td>
            </tr>
          </tbody>
        </table>
        <p className="mt-2">{translate("我们要求所有第三方服务提供商遵守适用的数据保护法律，并采取合理的安全措施保护您的个人信息。", locale)}</p>
      </section>

      <section>
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">{translate("五、数据出境（跨境传输）专章", locale)}</h2>
        <p>{translate("由于本平台使用海外云服务提供商，您的部分个人信息可能被传输至中华人民共和国境外进行处理。 我们依据《中华人民共和国个人信息保护法》（以下简称“个保法”）第三十八条至第四十条、 以及《促进和规范数据跨境流动规定》的要求履行告知与单独同意义务。具体跨境传输情况如下：", locale)}</p>
        <table className="w-full text-sm border border-gray-200 dark:border-gray-700 mt-3">
          <thead className="bg-gray-50 dark:bg-gray-800">
            <tr>
              <th className="border border-gray-200 dark:border-gray-700 px-3 py-2 text-left">{translate("境外接收方", locale)}</th>
              <th className="border border-gray-200 dark:border-gray-700 px-3 py-2 text-left">{translate("所在国家/地区", locale)}</th>
              <th className="border border-gray-200 dark:border-gray-700 px-3 py-2 text-left">{translate("传输的个人信息", locale)}</th>
              <th className="border border-gray-200 dark:border-gray-700 px-3 py-2 text-left">{translate("处理目的", locale)}</th>
              <th className="border border-gray-200 dark:border-gray-700 px-3 py-2 text-left">{translate("合规路径", locale)}</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="border border-gray-200 dark:border-gray-700 px-3 py-2">Neon PostgreSQL</td>
              <td className="border border-gray-200 dark:border-gray-700 px-3 py-2">{translate("新加坡", locale)}</td>
              <td className="border border-gray-200 dark:border-gray-700 px-3 py-2">{translate("用户注册信息、产品数据", locale)}</td>
              <td className="border border-gray-200 dark:border-gray-700 px-3 py-2">{translate("用户注册信息与产品数据的存储及管理", locale)}</td>
              <td className="border border-gray-200 dark:border-gray-700 px-3 py-2">{translate("标准合同（备案中）", locale)}</td>
            </tr>
            <tr>
              <td className="border border-gray-200 dark:border-gray-700 px-3 py-2">Vercel Inc.</td>
              <td className="border border-gray-200 dark:border-gray-700 px-3 py-2">{translate("美国（全球CDN节点）", locale)}</td>
              <td className="border border-gray-200 dark:border-gray-700 px-3 py-2">{translate("网页缓存数据（可能含IP地址等）", locale)}</td>
              <td className="border border-gray-200 dark:border-gray-700 px-3 py-2">{translate("网站部署与全球访问加速", locale)}</td>
              <td className="border border-gray-200 dark:border-gray-700 px-3 py-2">{translate("标准合同（备案中）", locale)}</td>
            </tr>
            <tr>
              <td className="border border-gray-200 dark:border-gray-700 px-3 py-2">Resend Inc.</td>
              <td className="border border-gray-200 dark:border-gray-700 px-3 py-2">{translate("美国", locale)}</td>
              <td className="border border-gray-200 dark:border-gray-700 px-3 py-2">{translate("用户邮箱地址（邮件发送）", locale)}</td>
              <td className="border border-gray-200 dark:border-gray-700 px-3 py-2">{translate("注册验证邮件、密码重置邮件发送", locale)}</td>
              <td className="border border-gray-200 dark:border-gray-700 px-3 py-2">{translate("标准合同（备案中）/ 计划替换为国内服务", locale)}</td>
            </tr>
            <tr>
              <td className="border border-gray-200 dark:border-gray-700 px-3 py-2">{translate("阿里云OSS（图片存储）", locale)}</td>
              <td className="border border-gray-200 dark:border-gray-700 px-3 py-2">{translate("中国（北京）", locale)}</td>
              <td className="border border-gray-200 dark:border-gray-700 px-3 py-2">{translate("用户上传的农机图片", locale)}</td>
              <td className="border border-gray-200 dark:border-gray-700 px-3 py-2">{translate("图片存储与CDN加速", locale)}</td>
              <td className="border border-gray-200 dark:border-gray-700 px-3 py-2">{translate("境内存储，不涉及出境", locale)}</td>
            </tr>
          </tbody>
        </table>

        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mt-5 mb-2">{translate("单独同意说明（依据个保法第三十九条）", locale)}</h3>
        <p>{translate("根据《中华人民共和国个人信息保护法》第三十九条规定，向中华人民共和国境外提供个人信息的， 应当向个人告知境外接收方的名称或者姓名、联系方式、处理目的、处理方式、个人信息的种类， 以及个人向境外接收方行使个人信息保护权利的方式和程序等事项，并取得个人的", locale)}<strong>{translate("单独同意", locale)}</strong>。
        </p>
        <p className="mt-2">{translate("为此，您在注册账号或补全资料（邮箱、公司、国家等）时，本平台会通过", locale)}<strong>{translate("独立的勾选项", locale)}</strong>{translate("， 就“个人信息出境”这一事项单独取得您的同意。未经您的单独同意，我们不会将您的个人信息传输至上述境外接收方。 您有权随时撤回该单独同意；撤回后我们将停止相关跨境传输（法律法规另有规定，或为履行您所要求的合同所必需的情形除外）。", locale)}</p>
        <p className="mt-2">{translate("我们正在依据个保法第三十八条至第四十条的规定，通过签订网信办标准合同并向省级网信部门备案的方式 完成跨境传输合规程序。在标准合同备案完成前，我们已要求各境外接收方采取必要的安全措施保护您的个人信息。", locale)}</p>
      </section>

      <section>
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">{translate("六、信息存储期限", locale)}</h2>
        <p>{translate("我们仅在为实现处理目的所必需的最短期限内存储您的个人信息：", locale)}</p>
        <ul className="list-disc pl-6 space-y-1 mt-2">
          <li><strong>{translate("注册账户信息：", locale)}</strong>{translate("账户存续期间。账户注销后15日内删除或匿名化处理。", locale)}</li>
          <li><strong>{translate("产品发布信息：", locale)}</strong>{translate("产品下架后保留90日（用于交易纠纷处理），之后删除。", locale)}</li>
          <li><strong>{translate("AI估值照片：", locale)}</strong>{translate("估值完成后30日内自动删除。", locale)}</li>
          <li><strong>{translate("行为日志：", locale)}</strong>{translate("保留12个月，到期后匿名化处理。", locale)}</li>
          <li><strong>{translate("询价/商务信息：", locale)}</strong>{translate("保留3年（合同法诉讼时效期间）。", locale)}</li>
          <li><strong>{translate("审计日志：", locale)}</strong>{translate("保留1年（安全保障目的）。", locale)}</li>
        </ul>
        <p className="mt-2">{translate("存储地点：用户个人信息主要存储在新加坡（Neon PostgreSQL）；图片数据存储在中国北京（阿里云OSS）。", locale)}</p>
      </section>

      <section>
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">{translate("七、您的个人信息主体权利", locale)}</h2>
        <p>{translate("根据PIPL第四十四条至第四十七条，您对您的个人信息享有以下权利：", locale)}</p>
        <table className="w-full text-sm border border-gray-200 dark:border-gray-700 mt-3">
          <thead className="bg-gray-50 dark:bg-gray-800">
            <tr>
              <th className="border border-gray-200 dark:border-gray-700 px-3 py-2 text-left">{translate("权利类型", locale)}</th>
              <th className="border border-gray-200 dark:border-gray-700 px-3 py-2 text-left">{translate("说明", locale)}</th>
              <th className="border border-gray-200 dark:border-gray-700 px-3 py-2 text-left">{translate("行使方式", locale)}</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="border border-gray-200 dark:border-gray-700 px-3 py-2">{translate("查阅权", locale)}</td>
              <td className="border border-gray-200 dark:border-gray-700 px-3 py-2">{translate("查阅我们处理的您的个人信息", locale)}</td>
              <td className="border border-gray-200 dark:border-gray-700 px-3 py-2">{translate("登录账户“个人中心”查看", locale)}</td>
            </tr>
            <tr>
              <td className="border border-gray-200 dark:border-gray-700 px-3 py-2">{translate("复制权", locale)}</td>
              <td className="border border-gray-200 dark:border-gray-700 px-3 py-2">{translate("获取个人信息副本", locale)}</td>
              <td className="border border-gray-200 dark:border-gray-700 px-3 py-2">{translate("发送邮件至DPO邮箱申请", locale)}</td>
            </tr>
            <tr>
              <td className="border border-gray-200 dark:border-gray-700 px-3 py-2">{translate("更正权", locale)}</td>
              <td className="border border-gray-200 dark:border-gray-700 px-3 py-2">{translate("更正不准确的个人信息", locale)}</td>
              <td className="border border-gray-200 dark:border-gray-700 px-3 py-2">{translate("在“个人中心”自行修改或联系DPO", locale)}</td>
            </tr>
            <tr>
              <td className="border border-gray-200 dark:border-gray-700 px-3 py-2">{translate("删除权", locale)}</td>
              <td className="border border-gray-200 dark:border-gray-700 px-3 py-2">{translate("要求删除个人信息", locale)}</td>
              <td className="border border-gray-200 dark:border-gray-700 px-3 py-2">{translate("联系DPO邮箱申请", locale)}</td>
            </tr>
            <tr>
              <td className="border border-gray-200 dark:border-gray-700 px-3 py-2">{translate("可携带权", locale)}</td>
              <td className="border border-gray-200 dark:border-gray-700 px-3 py-2">{translate("以结构化格式获取个人信息并转移", locale)}</td>
              <td className="border border-gray-200 dark:border-gray-700 px-3 py-2">{translate("发送邮件至DPO邮箱申请", locale)}</td>
            </tr>
            <tr>
              <td className="border border-gray-200 dark:border-gray-700 px-3 py-2">{translate("撤回同意权", locale)}</td>
              <td className="border border-gray-200 dark:border-gray-700 px-3 py-2">{translate("撤回此前给予的同意", locale)}</td>
              <td className="border border-gray-200 dark:border-gray-700 px-3 py-2">{translate("在“隐私设置”中撤回或联系DPO", locale)}</td>
            </tr>
            <tr>
              <td className="border border-gray-200 dark:border-gray-700 px-3 py-2">{translate("账号注销权", locale)}</td>
              <td className="border border-gray-200 dark:border-gray-700 px-3 py-2">{translate("注销用户账号", locale)}</td>
              <td className="border border-gray-200 dark:border-gray-700 px-3 py-2">{translate("在“个人中心”申请注销", locale)}</td>
            </tr>
          </tbody>
        </table>
        <p className="mt-2">{translate("我们将在收到您的申请后", locale)}<strong>{translate("15个工作日", locale)}</strong>{translate("内回复处理结果。 如您对我们的回复不满意，可向网信部门投诉举报。", locale)}</p>
      </section>

      <section>
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">{translate("八、敏感个人信息特殊保护", locale)}</h2>
        <p>{translate("我们在以下场景中可能处理您的敏感个人信息。根据PIPL第二十八条至第三十二条， 处理敏感个人信息需取得您的", locale)}<strong>{translate("单独同意", locale)}</strong>{translate("，并采取更严格的保护措施：", locale)}</p>
        <ul className="list-disc pl-6 space-y-2 mt-2">
          <li>
            <strong>{translate("人脸信息：", locale)}</strong>{translate("用户上传的农机照片中可能偶然包含人脸信息。 我们在AI识别处理中不会单独提取或存储人脸信息。 如您发现照片中包含人脸，建议上传前自行做模糊处理。", locale)}</li>
          <li>
            <strong>{translate("地理位置信息：", locale)}</strong>{translate("产品发布时可选填地理位置（省/市/经纬度）， 用于产品产地展示和筛选。该信息基于用户自愿提供，不会用于其他目的。", locale)}</li>
          <li>
            <strong>{translate("支付信息：", locale)}</strong>{translate("会员费通过对公转账方式收取， 我们不接触、不存储您的完整支付凭证（银行卡号、支付密码等）。", locale)}</li>
        </ul>
      </section>

      <section>
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">{translate("九、未成年人保护", locale)}</h2>
        <p>{translate("本平台为二手农机交易B2B平台，面向具有完全民事行为能力的自然人或法人。 我们不为未满14周岁的未成年人提供服务。如您是未成年人的监护人，发现被监护人 使用了本平台服务，请及时联系我们删除相关信息。", locale)}</p>
      </section>

      <section>
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">{translate("十、信息安全措施", locale)}</h2>
        <p>{translate("我们采取以下技术和管理措施保护您的个人信息安全：", locale)}</p>
        <ul className="list-disc pl-6 space-y-1 mt-2">
          <li>{translate("全链路HTTPS/TLS 1.3加密传输", locale)}</li>
          <li>{translate("用户密码使用bcrypt算法加密存储", locale)}</li>
          <li>{translate("API接口采用基于角色的访问控制（RBAC）", locale)}</li>
          <li>{translate("多租户数据隔离", locale)}</li>
          <li>{translate("操作审计日志（保留12个月）", locale)}</li>
          <li>{translate("定期安全漏洞扫描和风险评估", locale)}</li>
        </ul>
        <p className="mt-2">{translate("如发生个人信息安全事件，我们将依法在72小时内向网信部门报告， 并及时通知您事件情况、应对措施及您可采取的自我保护措施。", locale)}</p>
      </section>

      <section>
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">{translate("十一、Cookie与同类技术", locale)}</h2>
        <p>{translate("我们使用Cookie和同类技术（LocalStorage等）来记住您的登录状态、保存语言偏好、 改善网站性能。您可通过浏览器设置管理Cookie。请注意，禁用Cookie可能影响部分功能。", locale)}</p>
      </section>

      <section>
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">{translate("十二、自动化决策与算法推荐", locale)}</h2>
        <p>{translate("本平台使用AI算法提供估值服务和内容推荐。根据PIPL第二十四条， 您有权要求我们对自动化决策的结果进行说明，并有权拒绝仅通过自动化决策方式做出的决定。 如您希望行使该权利，请发送邮件至DPO邮箱。", locale)}</p>
        <p className="mt-2">
          <strong>{translate("AI估值免责声明：", locale)}</strong>{translate("AI估值结果基于公开数据和算法模型生成，仅供参考，不构成交易建议或价格承诺。 神雕农机不对估值结果的准确性、完整性承担法律责任。交易决策由用户自行做出并承担相应风险。", locale)}</p>
      </section>

      <section>
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">{translate("十三、本政策更新", locale)}</h2>
        <p>{translate("本政策可能不时更新。当本政策发生重大变更时，我们将通过平台公告或邮件方式通知您。 建议您定期查阅本政策以了解最新变更。", locale)}</p>
      </section>

      <section>
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">{translate("十四、联系我们", locale)}</h2>
        <p>{translate("如您对本隐私政策有任何疑问、意见或建议，或希望行使您的个人信息主体权利，请通过以下方式联系我们：", locale)}</p>
        <ul className="space-y-1 mt-2">
          <li><strong>{translate("邮箱：", locale)}</strong>{translate("jiusei0319@gmail.com（邮件标题请注明“个人信息保护咨询”）", locale)}</li>
          <li><strong>{translate("地址：", locale)}</strong>{translate("河北省石家庄市元氏县马村乡聊村", locale)}</li>
          <li><strong>{translate("回复时限：", locale)}</strong>{translate("15个工作日", locale)}</li>
        </ul>
      </section>

      <div className="mt-8 rounded-lg bg-gray-50 dark:bg-gray-800 p-4 text-xs text-gray-500 dark:text-gray-400">
        <p>{translate("本隐私政策由石家庄神雕农机科技有限公司制定，依据《中华人民共和国个人信息保护法》 《中华人民共和国数据安全法》《中华人民共和国网络安全法》等法律法规编制。 本政策应与《用户协议》配合阅读。本政策最终解释权归石家庄神雕农机科技有限公司所有。", locale)}</p>
      </div>
    </>);
}
function PrivacyContentEn() {
    return (<>
      <p className="text-gray-600 dark:text-gray-400">
        Shijiazhuang Shendiao Agricultural Machinery Technology Co., Ltd.
        (&ldquo;we&rdquo; or &ldquo;AgriTrade&rdquo;) operates the usedfarmmach.com website
        and the &ldquo;AgriTrade&rdquo; WeChat Mini Program (collectively, the &ldquo;Platform&rdquo;).
        We are committed to protecting your personal information in accordance with applicable laws and regulations.
      </p>

      <section>
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">Data Cross-Border Transfer</h2>
        <p>
          Because the Platform uses overseas cloud service providers, some of your personal information
          may be transferred outside the territory of the People&rsquo;s Republic of China for processing.
          In accordance with the Personal Information Protection Law (PIPL) of the PRC (Articles 38&ndash;40)
          and the Provisions on Promoting and Regulating the Cross-Border Data Flows, we fulfill our
          notification and separate-consent obligations. The cross-border transfers are as follows:
        </p>
        <table className="w-full text-sm border border-gray-200 dark:border-gray-700 mt-3">
          <thead className="bg-gray-50 dark:bg-gray-800">
            <tr>
              <th className="border border-gray-200 dark:border-gray-700 px-3 py-2 text-left">Overseas Recipient</th>
              <th className="border border-gray-200 dark:border-gray-700 px-3 py-2 text-left">Country/Region</th>
              <th className="border border-gray-200 dark:border-gray-700 px-3 py-2 text-left">Personal Information Transferred</th>
              <th className="border border-gray-200 dark:border-gray-700 px-3 py-2 text-left">Purpose of Processing</th>
              <th className="border border-gray-200 dark:border-gray-700 px-3 py-2 text-left">Compliance Path</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="border border-gray-200 dark:border-gray-700 px-3 py-2">Neon PostgreSQL</td>
              <td className="border border-gray-200 dark:border-gray-700 px-3 py-2">Singapore</td>
              <td className="border border-gray-200 dark:border-gray-700 px-3 py-2">User registration and product data</td>
              <td className="border border-gray-200 dark:border-gray-700 px-3 py-2">Storage and management of user and product data</td>
              <td className="border border-gray-200 dark:border-gray-700 px-3 py-2">Standard Contract (filing in progress)</td>
            </tr>
            <tr>
              <td className="border border-gray-200 dark:border-gray-700 px-3 py-2">Vercel Inc.</td>
              <td className="border border-gray-200 dark:border-gray-700 px-3 py-2">United States (global CDN)</td>
              <td className="border border-gray-200 dark:border-gray-700 px-3 py-2">Web cache data (may include IP addresses)</td>
              <td className="border border-gray-200 dark:border-gray-700 px-3 py-2">Website deployment and global access acceleration</td>
              <td className="border border-gray-200 dark:border-gray-700 px-3 py-2">Standard Contract (filing in progress)</td>
            </tr>
            <tr>
              <td className="border border-gray-200 dark:border-gray-700 px-3 py-2">Resend Inc.</td>
              <td className="border border-gray-200 dark:border-gray-700 px-3 py-2">United States</td>
              <td className="border border-gray-200 dark:border-gray-700 px-3 py-2">User email addresses (email sending)</td>
              <td className="border border-gray-200 dark:border-gray-700 px-3 py-2">Registration verification and password reset emails</td>
              <td className="border border-gray-200 dark:border-gray-700 px-3 py-2">Standard Contract (filing in progress) / planned migration to domestic service</td>
            </tr>
          </tbody>
        </table>

        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mt-5 mb-2">
          Separate Consent (pursuant to Article 39 of PIPL)
        </h3>
        <p>
          Under Article 39 of the Personal Information Protection Law, where personal information is
          provided to a recipient outside the PRC, the individual must be informed of the name/identity
          and contact details of the overseas recipient, the purpose and means of processing, the types
          of personal information, and the methods and procedures by which the individual may exercise
          their personal-information rights against the overseas recipient, and the individual&rsquo;s
          <strong>separate consent</strong> must be obtained.
        </p>
        <p className="mt-2">
          Accordingly, when you register or complete your profile (email, company, country, etc.),
          the Platform obtains your <strong>separate consent</strong> for the cross-border transfer of
          personal information through an <strong>independent checkbox</strong>. Without your separate
          consent, we will not transfer your personal information to the overseas recipients listed above.
          You may withdraw this separate consent at any time; upon withdrawal we will cease the relevant
          cross-border transfer (except where otherwise required by law or necessary to perform a contract
          you have requested).
        </p>
        <p className="mt-4 text-sm text-gray-500">
          This English text is a translation of the Chinese Privacy Policy for reference only.
          In case of any discrepancy, the Chinese version shall prevail.
        </p>
      </section>
    </>);
}
async function PrivacyContentCn() {
  const locale = await getLocale();
    return (<>
      <p className="text-gray-600 dark:text-gray-400">{translate("石家庄神雕农机科技有限公司（以下简称“我们”或“神雕农机”）运营 usedfarmmach.cn 网站及“神雕农机”微信小程序（以下简称“本平台”）。 我们深知个人信息对您的重要性，将严格按照《中华人民共和国个人信息保护法》 （以下简称“个保法”）、《中华人民共和国数据安全法》、《中华人民共和国网络安全法》 （以下合称“三法”）等法律法规，在中国境内收集、存储和处理您的个人信息，保护您的个人信息权益。", locale)}</p>

      <section>
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">{translate("一、信息处理者身份", locale)}</h2>
        <ul className="space-y-1">
          <li><strong>{translate("运营主体：", locale)}</strong>{translate("石家庄神雕农机科技有限公司", locale)}</li>
          <li><strong>{translate("注册地址：", locale)}</strong>{translate("河北省石家庄市元氏县马村乡聊村", locale)}</li>
          <li><strong>{translate("联系邮箱：", locale)}</strong>jiusei0319@gmail.com</li>
          <li><strong>{translate("个人信息保护负责人（DPO）：", locale)}</strong>{translate("您可通过上述邮箱联系我们，邮件标题请注明“个人信息保护咨询”。", locale)}</li>
        </ul>
      </section>

      <section>
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">{translate("二、我们收集的个人信息", locale)}</h2>
        <p>{translate("我们仅出于以下明确、合理的目的收集您的个人信息：", locale)}</p>
        <table className="w-full text-sm border border-gray-200 dark:border-gray-700 mt-3">
          <thead className="bg-gray-50 dark:bg-gray-800">
            <tr>
              <th className="border border-gray-200 dark:border-gray-700 px-3 py-2 text-left">{translate("信息类型", locale)}</th>
              <th className="border border-gray-200 dark:border-gray-700 px-3 py-2 text-left">{translate("具体内容", locale)}</th>
              <th className="border border-gray-200 dark:border-gray-700 px-3 py-2 text-left">{translate("收集目的", locale)}</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="border border-gray-200 dark:border-gray-700 px-3 py-2">{translate("注册登录信息", locale)}</td>
              <td className="border border-gray-200 dark:border-gray-700 px-3 py-2">{translate("手机号或电子邮箱、密码（加密存储）", locale)}</td>
              <td className="border border-gray-200 dark:border-gray-700 px-3 py-2">{translate("用户注册、登录、身份验证", locale)}</td>
            </tr>
            <tr>
              <td className="border border-gray-200 dark:border-gray-700 px-3 py-2">{translate("产品发布信息", locale)}</td>
              <td className="border border-gray-200 dark:border-gray-700 px-3 py-2">{translate("农机照片、参数信息、地理位置（省/市/经纬度）", locale)}</td>
              <td className="border border-gray-200 dark:border-gray-700 px-3 py-2">{translate("用户发布二手农机产品信息供买家浏览", locale)}</td>
            </tr>
            <tr>
              <td className="border border-gray-200 dark:border-gray-700 px-3 py-2">{translate("询价/商务信息", locale)}</td>
              <td className="border border-gray-200 dark:border-gray-700 px-3 py-2">{translate("企业名称、联系人姓名、联系电话", locale)}</td>
              <td className="border border-gray-200 dark:border-gray-700 px-3 py-2">{translate("展会询价、品牌认领、配件询价等业务处理", locale)}</td>
            </tr>
            <tr>
              <td className="border border-gray-200 dark:border-gray-700 px-3 py-2">{translate("AI估值数据", locale)}</td>
              <td className="border border-gray-200 dark:border-gray-700 px-3 py-2">{translate("用户上传的农机照片、品牌型号参数", locale)}</td>
              <td className="border border-gray-200 dark:border-gray-700 px-3 py-2">{translate("AI识别、分析及估值服务", locale)}</td>
            </tr>
            <tr>
              <td className="border border-gray-200 dark:border-gray-700 px-3 py-2">{translate("行为数据", locale)}</td>
              <td className="border border-gray-200 dark:border-gray-700 px-3 py-2">{translate("浏览记录、搜索记录、估值查询记录", locale)}</td>
              <td className="border border-gray-200 dark:border-gray-700 px-3 py-2">{translate("改善服务质量、个性化推荐（经匿名化处理后使用）", locale)}</td>
            </tr>
            <tr>
              <td className="border border-gray-200 dark:border-gray-700 px-3 py-2">{translate("微信小程序信息", locale)}</td>
              <td className="border border-gray-200 dark:border-gray-700 px-3 py-2">{translate("微信OpenID、UnionID（经微信授权获取）", locale)}</td>
              <td className="border border-gray-200 dark:border-gray-700 px-3 py-2">{translate("小程序用户身份识别与登录态维持", locale)}</td>
            </tr>
            <tr>
              <td className="border border-gray-200 dark:border-gray-700 px-3 py-2">{translate("会员支付信息", locale)}</td>
              <td className="border border-gray-200 dark:border-gray-700 px-3 py-2">{translate("会员等级、订单与充值记录（支付由微信支付/微信收付通处理，我们不存储完整支付凭证）", locale)}</td>
              <td className="border border-gray-200 dark:border-gray-700 px-3 py-2">{translate("会员服务管理与订单对账", locale)}</td>
            </tr>
            <tr>
              <td className="border border-gray-200 dark:border-gray-700 px-3 py-2">{translate("设备与技术信息", locale)}</td>
              <td className="border border-gray-200 dark:border-gray-700 px-3 py-2">{translate("IP地址、浏览器类型、操作系统、设备标识符", locale)}</td>
              <td className="border border-gray-200 dark:border-gray-700 px-3 py-2">{translate("安全保障、反欺诈、服务运行维护", locale)}</td>
            </tr>
          </tbody>
        </table>
      </section>

      <section>
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">{translate("三、信息使用规则", locale)}</h2>
        <p>{translate("我们将您的个人信息仅用于本政策第二条约定的收集目的。在以下情形中，我们可能会将您的信息用于其他目的：", locale)}</p>
        <ul className="list-disc pl-6 space-y-1 mt-2">
          <li>{translate("取得您的单独同意后；", locale)}</li>
          <li>{translate("为履行法定义务所必需；", locale)}</li>
          <li>{translate("为应对突发公共卫生事件或紧急情况保护自然人的生命健康和财产安全所必需；", locale)}</li>
          <li>{translate("为公共利益实施新闻报道、舆论监督等行为在合理范围内处理个人信息。", locale)}</li>
        </ul>
        <p className="mt-2">
          <strong>{translate("AI估值服务特别说明：", locale)}</strong>{translate("用户上传的农机照片仅供AI识别和估值分析使用。AI估值结果基于公开数据和算法模型生成， 仅供参考，不构成交易建议或价格承诺。", locale)}</p>
      </section>

      <section>
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">{translate("四、信息共享与委托处理（境内）", locale)}</h2>
        <p>{translate("我们不会向任何第三方", locale)}<strong>{translate("出售", locale)}</strong>{translate("您的个人信息。为实现本平台服务功能，我们会委托", locale)}<strong>{translate("位于中国境内的", locale)}</strong>{translate("受托方处理您的部分个人信息。我们与受托方签订严格的委托处理协议， 约定处理目的、期限、方式及保护措施，并要求受托方返回或删除个人信息。委托处理情况如下：", locale)}</p>
        <table className="w-full text-sm border border-gray-200 dark:border-gray-700 mt-3">
          <thead className="bg-gray-50 dark:bg-gray-800">
            <tr>
              <th className="border border-gray-200 dark:border-gray-700 px-3 py-2 text-left">{translate("境内受托方", locale)}</th>
              <th className="border border-gray-200 dark:border-gray-700 px-3 py-2 text-left">{translate("处理信息", locale)}</th>
              <th className="border border-gray-200 dark:border-gray-700 px-3 py-2 text-left">{translate("处理目的", locale)}</th>
              <th className="border border-gray-200 dark:border-gray-700 px-3 py-2 text-left">{translate("所在地域", locale)}</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="border border-gray-200 dark:border-gray-700 px-3 py-2">{translate("阿里云 ECS（云服务器）", locale)}</td>
              <td className="border border-gray-200 dark:border-gray-700 px-3 py-2">{translate("用户注册信息、产品数据（本地 PostgreSQL 数据库）", locale)}</td>
              <td className="border border-gray-200 dark:border-gray-700 px-3 py-2">{translate("用户与产品数据的存储及管理", locale)}</td>
              <td className="border border-gray-200 dark:border-gray-700 px-3 py-2">{translate("中国河北省 / 北京", locale)}</td>
            </tr>
            <tr>
              <td className="border border-gray-200 dark:border-gray-700 px-3 py-2">{translate("阿里云 OSS（对象存储）", locale)}</td>
              <td className="border border-gray-200 dark:border-gray-700 px-3 py-2">{translate("用户上传的农机图片", locale)}</td>
              <td className="border border-gray-200 dark:border-gray-700 px-3 py-2">{translate("图片存储与CDN加速", locale)}</td>
              <td className="border border-gray-200 dark:border-gray-700 px-3 py-2">{translate("中国北京", locale)}</td>
            </tr>
            <tr>
              <td className="border border-gray-200 dark:border-gray-700 px-3 py-2">{translate("微信支付 / 微信收付通", locale)}</td>
              <td className="border border-gray-200 dark:border-gray-700 px-3 py-2">{translate("会员订单与支付流水（由微信侧处理）", locale)}</td>
              <td className="border border-gray-200 dark:border-gray-700 px-3 py-2">{translate("会员订单收取与支付清算", locale)}</td>
              <td className="border border-gray-200 dark:border-gray-700 px-3 py-2">{translate("中国（微信支付境内主体）", locale)}</td>
            </tr>
          </tbody>
        </table>
        <p className="mt-2">{translate("除上述委托处理情形外，我们仅在以下情形共享您的个人信息：取得您的单独同意、为履行法定义务所必需、 为保护您或他人的重大合法权益所必需等法定情形。我们不会向境外接收方提供您的个人信息。", locale)}</p>
      </section>

      <section>
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">{translate("五、数据存储地点与跨境传输（境内存储专章）", locale)}</h2>
        <p>{translate("依据个保法、数据安全法、网络安全法的要求，自您开始使用本平台起，您的所有个人信息与产品数据", locale)}<strong>{translate("均存储于中华人民共和国境内", locale)}</strong>{translate("。具体如下：", locale)}</p>
        <ul className="list-disc pl-6 space-y-2 mt-2">
          <li><strong>{translate("用户个人信息与产品数据：", locale)}</strong>{translate("存储于阿里云 ECS 本地部署的 PostgreSQL 数据库，地域为河北省 / 北京。", locale)}</li>
          <li><strong>{translate("图片数据：", locale)}</strong>{translate("存储于阿里云 OSS，地域为北京。", locale)}</li>
          <li><strong>{translate("会员订单与支付流水：", locale)}</strong>{translate("由微信支付 / 微信收付通在中国境内处理。", locale)}</li>
        </ul>
        <p className="mt-2">
          <strong>{translate("不向境外传输：", locale)}</strong>{translate("我们", locale)}<strong>{translate("不向任何境外接收方传输", locale)}</strong>{translate("您的个人信息。 本平台不使用位于中国境外（含港澳台地区）的云数据库、邮件服务或托管服务处理您的个人信息。 因此，本政策", locale)}<strong>{translate("不涉及个人信息跨境传输", locale)}</strong>{translate("章节，亦无需就个人信息出境取得您的单独同意。", locale)}</p>
      </section>

      <section>
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">{translate("六、信息存储期限", locale)}</h2>
        <p>{translate("我们仅在为实现处理目的所必需的最短期限内存储您的个人信息：", locale)}</p>
        <ul className="list-disc pl-6 space-y-1 mt-2">
          <li><strong>{translate("注册账户信息：", locale)}</strong>{translate("账户存续期间。账户注销后15日内删除或匿名化处理。", locale)}</li>
          <li><strong>{translate("产品发布信息：", locale)}</strong>{translate("产品下架后保留90日（用于交易纠纷处理），之后删除。", locale)}</li>
          <li><strong>{translate("AI估值照片：", locale)}</strong>{translate("估值完成后30日内自动删除。", locale)}</li>
          <li><strong>{translate("行为日志：", locale)}</strong>{translate("保留12个月，到期后匿名化处理。", locale)}</li>
          <li><strong>{translate("询价/商务信息：", locale)}</strong>{translate("保留3年（合同法诉讼时效期间）。", locale)}</li>
          <li><strong>{translate("审计日志：", locale)}</strong>{translate("保留1年（安全保障目的）。", locale)}</li>
        </ul>
        <p className="mt-2">{translate("存储地点：全部用户个人信息与产品数据存储于中国境内（阿里云 ECS 本地 PostgreSQL，河北省 / 北京；图片存储于阿里云 OSS，北京）。", locale)}</p>
      </section>

      <section>
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">{translate("七、您的个人信息主体权利", locale)}</h2>
        <p>{translate("根据个保法第四十四条至第四十七条，您对您的个人信息享有以下权利：", locale)}</p>
        <table className="w-full text-sm border border-gray-200 dark:border-gray-700 mt-3">
          <thead className="bg-gray-50 dark:bg-gray-800">
            <tr>
              <th className="border border-gray-200 dark:border-gray-700 px-3 py-2 text-left">{translate("权利类型", locale)}</th>
              <th className="border border-gray-200 dark:border-gray-700 px-3 py-2 text-left">{translate("说明", locale)}</th>
              <th className="border border-gray-200 dark:border-gray-700 px-3 py-2 text-left">{translate("行使方式", locale)}</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="border border-gray-200 dark:border-gray-700 px-3 py-2">{translate("查阅权", locale)}</td>
              <td className="border border-gray-200 dark:border-gray-700 px-3 py-2">{translate("查阅我们处理的您的个人信息", locale)}</td>
              <td className="border border-gray-200 dark:border-gray-700 px-3 py-2">{translate("登录账户“个人中心”查看", locale)}</td>
            </tr>
            <tr>
              <td className="border border-gray-200 dark:border-gray-700 px-3 py-2">{translate("复制权", locale)}</td>
              <td className="border border-gray-200 dark:border-gray-700 px-3 py-2">{translate("获取个人信息副本", locale)}</td>
              <td className="border border-gray-200 dark:border-gray-700 px-3 py-2">{translate("发送邮件至DPO邮箱申请", locale)}</td>
            </tr>
            <tr>
              <td className="border border-gray-200 dark:border-gray-700 px-3 py-2">{translate("更正权", locale)}</td>
              <td className="border border-gray-200 dark:border-gray-700 px-3 py-2">{translate("更正不准确的个人信息", locale)}</td>
              <td className="border border-gray-200 dark:border-gray-700 px-3 py-2">{translate("在“个人中心”自行修改或联系DPO", locale)}</td>
            </tr>
            <tr>
              <td className="border border-gray-200 dark:border-gray-700 px-3 py-2">{translate("删除权", locale)}</td>
              <td className="border border-gray-200 dark:border-gray-700 px-3 py-2">{translate("要求删除个人信息", locale)}</td>
              <td className="border border-gray-200 dark:border-gray-700 px-3 py-2">{translate("联系DPO邮箱申请", locale)}</td>
            </tr>
            <tr>
              <td className="border border-gray-200 dark:border-gray-700 px-3 py-2">{translate("可携带权", locale)}</td>
              <td className="border border-gray-200 dark:border-gray-700 px-3 py-2">{translate("以结构化格式获取个人信息并转移", locale)}</td>
              <td className="border border-gray-200 dark:border-gray-700 px-3 py-2">{translate("发送邮件至DPO邮箱申请", locale)}</td>
            </tr>
            <tr>
              <td className="border border-gray-200 dark:border-gray-700 px-3 py-2">{translate("撤回同意权", locale)}</td>
              <td className="border border-gray-200 dark:border-gray-700 px-3 py-2">{translate("撤回此前给予的同意", locale)}</td>
              <td className="border border-gray-200 dark:border-gray-700 px-3 py-2">{translate("在“隐私设置”中撤回或联系DPO", locale)}</td>
            </tr>
            <tr>
              <td className="border border-gray-200 dark:border-gray-700 px-3 py-2">{translate("账号注销权", locale)}</td>
              <td className="border border-gray-200 dark:border-gray-700 px-3 py-2">{translate("注销用户账号", locale)}</td>
              <td className="border border-gray-200 dark:border-gray-700 px-3 py-2">{translate("在“个人中心”申请注销", locale)}</td>
            </tr>
          </tbody>
        </table>
        <p className="mt-2">{translate("我们将在收到您的申请后", locale)}<strong>{translate("15个工作日", locale)}</strong>{translate("内回复处理结果。 如您对我们的回复不满意，可向网信部门等主管部门投诉举报。", locale)}</p>
      </section>

      <section>
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">{translate("八、敏感个人信息特殊保护", locale)}</h2>
        <p>{translate("我们在以下场景中可能处理您的敏感个人信息。根据个保法第二十八条至第三十二条， 处理敏感个人信息需取得您的", locale)}<strong>{translate("单独同意", locale)}</strong>{translate("，并采取更严格的保护措施：", locale)}</p>
        <ul className="list-disc pl-6 space-y-2 mt-2">
          <li>
            <strong>{translate("人脸信息：", locale)}</strong>{translate("用户上传的农机照片中可能偶然包含人脸信息。 我们在AI识别处理中不会单独提取或存储人脸信息。 如您发现照片中包含人脸，建议上传前自行做模糊处理。", locale)}</li>
          <li>
            <strong>{translate("地理位置信息：", locale)}</strong>{translate("产品发布时可选填地理位置（省/市/经纬度）， 用于产品产地展示和筛选。该信息基于用户自愿提供，不会用于其他目的。", locale)}</li>
          <li>
            <strong>{translate("支付信息：", locale)}</strong>{translate("会员费通过微信支付 / 微信收付通收取， 我们不接触、不存储您的完整支付凭证（银行卡号、支付密码等）。", locale)}</li>
        </ul>
      </section>

      <section>
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">{translate("九、未成年人保护", locale)}</h2>
        <p>{translate("本平台为二手农机交易B2B平台，面向具有完全民事行为能力的自然人或法人。 我们不为未满14周岁的未成年人提供服务。如您是未成年人的监护人，发现被监护人 使用了本平台服务，请及时联系我们删除相关信息。", locale)}</p>
      </section>

      <section>
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">{translate("十、信息安全措施", locale)}</h2>
        <p>{translate("我们采取以下技术和管理措施保护您的个人信息安全：", locale)}</p>
        <ul className="list-disc pl-6 space-y-1 mt-2">
          <li>{translate("全链路HTTPS/TLS 1.3加密传输", locale)}</li>
          <li>{translate("用户密码使用bcrypt算法加密存储", locale)}</li>
          <li>{translate("API接口采用基于角色的访问控制（RBAC）", locale)}</li>
          <li>{translate("多租户数据隔离", locale)}</li>
          <li>{translate("操作审计日志（保留12个月）", locale)}</li>
          <li>{translate("定期安全漏洞扫描和风险评估", locale)}</li>
        </ul>
        <p className="mt-2">{translate("如发生个人信息安全事件，我们将依法在72小时内向网信部门报告， 并及时通知您事件情况、应对措施及您可采取的自我保护措施。", locale)}</p>
      </section>

      <section>
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">{translate("十一、Cookie与同类技术", locale)}</h2>
        <p>{translate("我们使用Cookie和同类技术（LocalStorage等）来记住您的登录状态、保存语言偏好、 改善网站性能。您可通过浏览器设置管理Cookie。请注意，禁用Cookie可能影响部分功能。", locale)}</p>
      </section>

      <section>
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">{translate("十二、自动化决策与算法推荐", locale)}</h2>
        <p>{translate("本平台使用AI算法提供估值服务和内容推荐。根据个保法第二十四条， 您有权要求我们对自动化决策的结果进行说明，并有权拒绝仅通过自动化决策方式做出的决定。 如您希望行使该权利，请发送邮件至DPO邮箱。", locale)}</p>
        <p className="mt-2">
          <strong>{translate("AI估值免责声明：", locale)}</strong>{translate("AI估值结果基于公开数据和算法模型生成，仅供参考，不构成交易建议或价格承诺。 神雕农机不对估值结果的准确性、完整性承担法律责任。交易决策由用户自行做出并承担相应风险。", locale)}</p>
      </section>

      <section>
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">{translate("十三、本政策更新", locale)}</h2>
        <p>{translate("本政策可能不时更新。当本政策发生重大变更时，我们将通过平台公告或邮件方式通知您。 建议您定期查阅本政策以了解最新变更。", locale)}</p>
      </section>

      <section>
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">{translate("十四、联系我们", locale)}</h2>
        <p>{translate("如您对本隐私政策有任何疑问、意见或建议，或希望行使您的个人信息主体权利，请通过以下方式联系我们：", locale)}</p>
        <ul className="space-y-1 mt-2">
          <li><strong>{translate("邮箱：", locale)}</strong>{translate("jiusei0319@gmail.com（邮件标题请注明“个人信息保护咨询”）", locale)}</li>
          <li><strong>{translate("地址：", locale)}</strong>{translate("河北省石家庄市元氏县马村乡聊村", locale)}</li>
          <li><strong>{translate("回复时限：", locale)}</strong>{translate("15个工作日", locale)}</li>
        </ul>
      </section>

      <div className="mt-8 rounded-lg bg-gray-50 dark:bg-gray-800 p-4 text-xs text-gray-500 dark:text-gray-400">
        <p>{translate("本隐私政策由石家庄神雕农机科技有限公司制定，依据《中华人民共和国个人信息保护法》 《中华人民共和国数据安全法》《中华人民共和国网络安全法》等法律法规编制。 本政策应与《用户协议》配合阅读。本平台所有个人信息与产品数据均存储于中国境内， 不向任何境外接收方传输。本政策最终解释权归石家庄神雕农机科技有限公司所有。", locale)}</p>
      </div>
    </>);
}
