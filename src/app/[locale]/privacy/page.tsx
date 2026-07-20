import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const title = locale === "zh" ? "隐私政策 - 神雕农机" : "Privacy Policy - AgriTrade";
  const description = locale === "zh"
    ? "神雕农机隐私政策：说明我们如何收集、使用、存储、保护和处理您的个人信息，以及您享有的个人信息主体权利。"
    : "AgriTrade Privacy Policy: How we collect, use, store, protect and process your personal information, and your rights.";
  return {
    title,
    description,
    robots: { index: true, follow: true },
  };
}

export default async function PrivacyPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const isZh = locale === "zh";

  return (
    <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:px-8">
      <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
        {isZh ? "隐私政策" : "Privacy Policy"}
      </h1>
      <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
        {isZh
          ? "最近更新日期：2026年7月17日 | 生效日期：2026年7月17日"
          : "Last updated: July 17, 2026 | Effective date: July 17, 2026"}
      </p>

      <div className="prose prose-sm dark:prose-invert mt-8 max-w-none text-gray-700 dark:text-gray-300 leading-relaxed space-y-6">
        {isZh ? <PrivacyContentZh /> : <PrivacyContentEn />}
      </div>
    </div>
  );
}

function PrivacyContentZh() {
  return (
    <>
      <p className="text-gray-600 dark:text-gray-400">
        石家庄神雕农机科技有限公司（以下简称&ldquo;我们&rdquo;或&ldquo;神雕农机&rdquo;）运营
        usedfarmmach.com 网站及&ldquo;神雕农机&rdquo;微信小程序（以下简称&ldquo;本平台&rdquo;）。
        我们深知个人信息对您的重要性，将严格按照《中华人民共和国个人信息保护法》
        （以下简称&ldquo;PIPL&rdquo;）、《中华人民共和国数据安全法》、《中华人民共和国网络安全法》
        等法律法规，保护您的个人信息。
      </p>

      <section>
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">一、信息处理者身份</h2>
        <ul className="space-y-1">
          <li><strong>运营主体：</strong>石家庄神雕农机科技有限公司</li>
          <li><strong>注册地址：</strong>河北省石家庄市元氏县马村乡聊村</li>
          <li><strong>联系邮箱：</strong>jiusei0319@gmail.com</li>
          <li><strong>个人信息保护负责人（DPO）：</strong>您可通过上述邮箱联系我们，邮件标题请注明&ldquo;个人信息保护咨询&rdquo;。</li>
        </ul>
      </section>

      <section>
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">二、我们收集的个人信息</h2>
        <p>我们仅出于以下明确、合理的目的收集您的个人信息：</p>
        <table className="w-full text-sm border border-gray-200 dark:border-gray-700 mt-3">
          <thead className="bg-gray-50 dark:bg-gray-800">
            <tr>
              <th className="border border-gray-200 dark:border-gray-700 px-3 py-2 text-left">信息类型</th>
              <th className="border border-gray-200 dark:border-gray-700 px-3 py-2 text-left">具体内容</th>
              <th className="border border-gray-200 dark:border-gray-700 px-3 py-2 text-left">收集目的</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="border border-gray-200 dark:border-gray-700 px-3 py-2">注册登录信息</td>
              <td className="border border-gray-200 dark:border-gray-700 px-3 py-2">手机号或电子邮箱、密码（加密存储）</td>
              <td className="border border-gray-200 dark:border-gray-700 px-3 py-2">用户注册、登录、身份验证</td>
            </tr>
            <tr>
              <td className="border border-gray-200 dark:border-gray-700 px-3 py-2">产品发布信息</td>
              <td className="border border-gray-200 dark:border-gray-700 px-3 py-2">农机照片、参数信息、地理位置（省/市/经纬度）</td>
              <td className="border border-gray-200 dark:border-gray-700 px-3 py-2">用户发布二手农机产品信息供买家浏览</td>
            </tr>
            <tr>
              <td className="border border-gray-200 dark:border-gray-700 px-3 py-2">询价/商务信息</td>
              <td className="border border-gray-200 dark:border-gray-700 px-3 py-2">企业名称、联系人姓名、联系电话</td>
              <td className="border border-gray-200 dark:border-gray-700 px-3 py-2">展会询价、品牌认领、配件询价等业务处理</td>
            </tr>
            <tr>
              <td className="border border-gray-200 dark:border-gray-700 px-3 py-2">AI估值数据</td>
              <td className="border border-gray-200 dark:border-gray-700 px-3 py-2">用户上传的农机照片、品牌型号参数</td>
              <td className="border border-gray-200 dark:border-gray-700 px-3 py-2">AI识别、分析及估值服务</td>
            </tr>
            <tr>
              <td className="border border-gray-200 dark:border-gray-700 px-3 py-2">行为数据</td>
              <td className="border border-gray-200 dark:border-gray-700 px-3 py-2">浏览记录、搜索记录、估值查询记录</td>
              <td className="border border-gray-200 dark:border-gray-700 px-3 py-2">改善服务质量、个性化推荐（经匿名化处理后使用）</td>
            </tr>
            <tr>
              <td className="border border-gray-200 dark:border-gray-700 px-3 py-2">微信小程序信息</td>
              <td className="border border-gray-200 dark:border-gray-700 px-3 py-2">微信OpenID、UnionID（经微信授权获取）</td>
              <td className="border border-gray-200 dark:border-gray-700 px-3 py-2">小程序用户身份识别</td>
            </tr>
            <tr>
              <td className="border border-gray-200 dark:border-gray-700 px-3 py-2">会员支付信息</td>
              <td className="border border-gray-200 dark:border-gray-700 px-3 py-2">会员等级、充值记录（支付由持牌支付机构处理，我们不存储完整支付凭证）</td>
              <td className="border border-gray-200 dark:border-gray-700 px-3 py-2">会员服务管理</td>
            </tr>
            <tr>
              <td className="border border-gray-200 dark:border-gray-700 px-3 py-2">设备与技术信息</td>
              <td className="border border-gray-200 dark:border-gray-700 px-3 py-2">IP地址、浏览器类型、操作系统、设备标识符</td>
              <td className="border border-gray-200 dark:border-gray-700 px-3 py-2">安全保障、反欺诈、服务运行维护</td>
            </tr>
          </tbody>
        </table>
      </section>

      <section>
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">三、信息使用规则</h2>
        <p>我们将您的个人信息仅用于本政策第二条约定的收集目的。在以下情形中，我们可能会将您的信息用于其他目的：</p>
        <ul className="list-disc pl-6 space-y-1 mt-2">
          <li>取得您的单独同意后；</li>
          <li>为履行法定义务所必需；</li>
          <li>为应对突发公共卫生事件或紧急情况保护自然人的生命健康和财产安全所必需；</li>
          <li>为公共利益实施新闻报道、舆论监督等行为在合理范围内处理个人信息。</li>
        </ul>
        <p className="mt-2">
          <strong>AI估值服务特别说明：</strong>
          用户上传的农机照片仅供AI识别和估值分析使用。AI估值结果基于公开数据和算法模型生成，
          仅供参考，不构成交易建议或价格承诺。
        </p>
      </section>

      <section>
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">四、信息共享、转让与公开</h2>
        <p>我们不会向第三方出售您的个人信息。在以下情形中，我们可能共享您的个人信息：</p>
        <table className="w-full text-sm border border-gray-200 dark:border-gray-200 mt-3">
          <thead className="bg-gray-50 dark:bg-gray-800">
            <tr>
              <th className="border border-gray-200 dark:border-gray-700 px-3 py-2 text-left">接收方</th>
              <th className="border border-gray-200 dark:border-gray-700 px-3 py-2 text-left">共享信息</th>
              <th className="border border-gray-200 dark:border-gray-700 px-3 py-2 text-left">共享目的</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="border border-gray-200 dark:border-gray-700 px-3 py-2">阿里云OSS（图片存储）</td>
              <td className="border border-gray-200 dark:border-gray-700 px-3 py-2">用户上传的农机图片</td>
              <td className="border border-gray-200 dark:border-gray-700 px-3 py-2">图片存储和CDN加速</td>
            </tr>
            <tr>
              <td className="border border-gray-200 dark:border-gray-700 px-3 py-2">Vercel（网站托管）</td>
              <td className="border border-gray-200 dark:border-gray-700 px-3 py-2">网站运行所需的技术数据</td>
              <td className="border border-gray-200 dark:border-gray-700 px-3 py-2">网站部署和全球访问加速</td>
            </tr>
            <tr>
              <td className="border border-gray-200 dark:border-gray-700 px-3 py-2">Neon（数据库服务）</td>
              <td className="border border-gray-200 dark:border-gray-700 px-3 py-2">用户注册信息和产品数据</td>
              <td className="border border-gray-200 dark:border-gray-700 px-3 py-2">数据存储和管理</td>
            </tr>
            <tr>
              <td className="border border-gray-200 dark:border-gray-700 px-3 py-2">Resend（邮件服务）</td>
              <td className="border border-gray-200 dark:border-gray-700 px-3 py-2">用户邮箱地址</td>
              <td className="border border-gray-200 dark:border-gray-700 px-3 py-2">注册验证邮件、密码重置邮件</td>
            </tr>
            <tr>
              <td className="border border-gray-200 dark:border-gray-700 px-3 py-2">银行对公转账</td>
              <td className="border border-gray-200 dark:border-gray-700 px-3 py-2">汇款备注信息（由银行直接处理）</td>
              <td className="border border-gray-200 dark:border-gray-700 px-3 py-2">会员费收取</td>
            </tr>
          </tbody>
        </table>
        <p className="mt-2">
          我们要求所有第三方服务提供商遵守适用的数据保护法律，并采取合理的安全措施保护您的个人信息。
        </p>
      </section>

      <section>
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">五、个人信息跨境传输声明</h2>
        <p>
          由于本平台使用海外云服务提供商，您的部分个人信息可能被传输至中华人民共和国境外进行处理。
          具体跨境传输情况如下：
        </p>
        <table className="w-full text-sm border border-gray-200 dark:border-gray-700 mt-3">
          <thead className="bg-gray-50 dark:bg-gray-800">
            <tr>
              <th className="border border-gray-200 dark:border-gray-700 px-3 py-2 text-left">境外接收方</th>
              <th className="border border-gray-200 dark:border-gray-700 px-3 py-2 text-left">所在国家/地区</th>
              <th className="border border-gray-200 dark:border-gray-700 px-3 py-2 text-left">传输数据</th>
              <th className="border border-gray-200 dark:border-gray-700 px-3 py-2 text-left">合规路径</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="border border-gray-200 dark:border-gray-700 px-3 py-2">Neon PostgreSQL</td>
              <td className="border border-gray-200 dark:border-gray-700 px-3 py-2">新加坡</td>
              <td className="border border-gray-200 dark:border-gray-700 px-3 py-2">用户注册信息、产品数据</td>
              <td className="border border-gray-200 dark:border-gray-700 px-3 py-2">标准合同（备案中）</td>
            </tr>
            <tr>
              <td className="border border-gray-200 dark:border-gray-700 px-3 py-2">Vercel Inc.</td>
              <td className="border border-gray-200 dark:border-gray-700 px-3 py-2">美国（全球CDN节点）</td>
              <td className="border border-gray-200 dark:border-gray-700 px-3 py-2">网页缓存数据（可能含IP地址等）</td>
              <td className="border border-gray-200 dark:border-gray-700 px-3 py-2">标准合同（备案中）</td>
            </tr>
            <tr>
              <td className="border border-gray-200 dark:border-gray-700 px-3 py-2">Resend Inc.</td>
              <td className="border border-gray-200 dark:border-gray-700 px-3 py-2">美国</td>
              <td className="border border-gray-200 dark:border-gray-700 px-3 py-2">用户邮箱地址（邮件发送）</td>
              <td className="border border-gray-200 dark:border-gray-700 px-3 py-2">标准合同（备案中）/ 计划替换为国内服务</td>
            </tr>
          </tbody>
        </table>
        <p className="mt-2">
          我们正在依据PIPL第三十八条至第四十条的规定，通过签订网信办标准合同并向省级网信部门备案的方式
          完成跨境传输合规程序。在标准合同备案完成前，我们已要求各境外接收方采取必要的安全措施保护您的个人信息。
        </p>
      </section>

      <section>
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">六、信息存储期限</h2>
        <p>我们仅在为实现处理目的所必需的最短期限内存储您的个人信息：</p>
        <ul className="list-disc pl-6 space-y-1 mt-2">
          <li><strong>注册账户信息：</strong>账户存续期间。账户注销后15日内删除或匿名化处理。</li>
          <li><strong>产品发布信息：</strong>产品下架后保留90日（用于交易纠纷处理），之后删除。</li>
          <li><strong>AI估值照片：</strong>估值完成后30日内自动删除。</li>
          <li><strong>行为日志：</strong>保留12个月，到期后匿名化处理。</li>
          <li><strong>询价/商务信息：</strong>保留3年（合同法诉讼时效期间）。</li>
          <li><strong>审计日志：</strong>保留1年（安全保障目的）。</li>
        </ul>
        <p className="mt-2">
          存储地点：用户个人信息主要存储在新加坡（Neon PostgreSQL）；图片数据存储在中国北京（阿里云OSS）。
        </p>
      </section>

      <section>
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">七、您的个人信息主体权利</h2>
        <p>根据PIPL第四十四条至第四十七条，您对您的个人信息享有以下权利：</p>
        <table className="w-full text-sm border border-gray-200 dark:border-gray-700 mt-3">
          <thead className="bg-gray-50 dark:bg-gray-800">
            <tr>
              <th className="border border-gray-200 dark:border-gray-700 px-3 py-2 text-left">权利类型</th>
              <th className="border border-gray-200 dark:border-gray-700 px-3 py-2 text-left">说明</th>
              <th className="border border-gray-200 dark:border-gray-700 px-3 py-2 text-left">行使方式</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="border border-gray-200 dark:border-gray-700 px-3 py-2">查阅权</td>
              <td className="border border-gray-200 dark:border-gray-700 px-3 py-2">查阅我们处理的您的个人信息</td>
              <td className="border border-gray-200 dark:border-gray-700 px-3 py-2">登录账户&ldquo;个人中心&rdquo;查看</td>
            </tr>
            <tr>
              <td className="border border-gray-200 dark:border-gray-700 px-3 py-2">复制权</td>
              <td className="border border-gray-200 dark:border-gray-700 px-3 py-2">获取个人信息副本</td>
              <td className="border border-gray-200 dark:border-gray-700 px-3 py-2">发送邮件至DPO邮箱申请</td>
            </tr>
            <tr>
              <td className="border border-gray-200 dark:border-gray-700 px-3 py-2">更正权</td>
              <td className="border border-gray-200 dark:border-gray-700 px-3 py-2">更正不准确的个人信息</td>
              <td className="border border-gray-200 dark:border-gray-700 px-3 py-2">在&ldquo;个人中心&rdquo;自行修改或联系DPO</td>
            </tr>
            <tr>
              <td className="border border-gray-200 dark:border-gray-700 px-3 py-2">删除权</td>
              <td className="border border-gray-200 dark:border-gray-700 px-3 py-2">要求删除个人信息</td>
              <td className="border border-gray-200 dark:border-gray-700 px-3 py-2">联系DPO邮箱申请</td>
            </tr>
            <tr>
              <td className="border border-gray-200 dark:border-gray-700 px-3 py-2">可携带权</td>
              <td className="border border-gray-200 dark:border-gray-700 px-3 py-2">以结构化格式获取个人信息并转移</td>
              <td className="border border-gray-200 dark:border-gray-700 px-3 py-2">发送邮件至DPO邮箱申请</td>
            </tr>
            <tr>
              <td className="border border-gray-200 dark:border-gray-700 px-3 py-2">撤回同意权</td>
              <td className="border border-gray-200 dark:border-gray-700 px-3 py-2">撤回此前给予的同意</td>
              <td className="border border-gray-200 dark:border-gray-700 px-3 py-2">在&ldquo;隐私设置&rdquo;中撤回或联系DPO</td>
            </tr>
            <tr>
              <td className="border border-gray-200 dark:border-gray-700 px-3 py-2">账号注销权</td>
              <td className="border border-gray-200 dark:border-gray-700 px-3 py-2">注销用户账号</td>
              <td className="border border-gray-200 dark:border-gray-700 px-3 py-2">在&ldquo;个人中心&rdquo;申请注销</td>
            </tr>
          </tbody>
        </table>
        <p className="mt-2">
          我们将在收到您的申请后<strong>15个工作日</strong>内回复处理结果。
          如您对我们的回复不满意，可向网信部门投诉举报。
        </p>
      </section>

      <section>
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">八、敏感个人信息特殊保护</h2>
        <p>
          我们在以下场景中可能处理您的敏感个人信息。根据PIPL第二十八条至第三十二条，
          处理敏感个人信息需取得您的<strong>单独同意</strong>，并采取更严格的保护措施：
        </p>
        <ul className="list-disc pl-6 space-y-2 mt-2">
          <li>
            <strong>人脸信息：</strong>用户上传的农机照片中可能偶然包含人脸信息。
            我们在AI识别处理中不会单独提取或存储人脸信息。
            如您发现照片中包含人脸，建议上传前自行做模糊处理。
          </li>
          <li>
            <strong>地理位置信息：</strong>产品发布时可选填地理位置（省/市/经纬度），
            用于产品产地展示和筛选。该信息基于用户自愿提供，不会用于其他目的。
          </li>
          <li>
            <strong>支付信息：</strong>会员费通过对公转账方式收取，
            我们不接触、不存储您的完整支付凭证（银行卡号、支付密码等）。
          </li>
        </ul>
      </section>

      <section>
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">九、未成年人保护</h2>
        <p>
          本平台为二手农机交易B2B平台，面向具有完全民事行为能力的自然人或法人。
          我们不为未满14周岁的未成年人提供服务。如您是未成年人的监护人，发现被监护人
          使用了本平台服务，请及时联系我们删除相关信息。
        </p>
      </section>

      <section>
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">十、信息安全措施</h2>
        <p>我们采取以下技术和管理措施保护您的个人信息安全：</p>
        <ul className="list-disc pl-6 space-y-1 mt-2">
          <li>全链路HTTPS/TLS 1.3加密传输</li>
          <li>用户密码使用bcrypt算法加密存储</li>
          <li>API接口采用基于角色的访问控制（RBAC）</li>
          <li>多租户数据隔离</li>
          <li>操作审计日志（保留12个月）</li>
          <li>定期安全漏洞扫描和风险评估</li>
        </ul>
        <p className="mt-2">
          如发生个人信息安全事件，我们将依法在72小时内向网信部门报告，
          并及时通知您事件情况、应对措施及您可采取的自我保护措施。
        </p>
      </section>

      <section>
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">十一、Cookie与同类技术</h2>
        <p>
          我们使用Cookie和同类技术（LocalStorage等）来记住您的登录状态、保存语言偏好、
          改善网站性能。您可通过浏览器设置管理Cookie。请注意，禁用Cookie可能影响部分功能。
        </p>
      </section>

      <section>
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">十二、自动化决策与算法推荐</h2>
        <p>
          本平台使用AI算法提供估值服务和内容推荐。根据PIPL第二十四条，
          您有权要求我们对自动化决策的结果进行说明，并有权拒绝仅通过自动化决策方式做出的决定。
          如您希望行使该权利，请发送邮件至DPO邮箱。
        </p>
        <p className="mt-2">
          <strong>AI估值免责声明：</strong>
          AI估值结果基于公开数据和算法模型生成，仅供参考，不构成交易建议或价格承诺。
          神雕农机不对估值结果的准确性、完整性承担法律责任。交易决策由用户自行做出并承担相应风险。
        </p>
      </section>

      <section>
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">十三、本政策更新</h2>
        <p>
          本政策可能不时更新。当本政策发生重大变更时，我们将通过平台公告或邮件方式通知您。
          建议您定期查阅本政策以了解最新变更。
        </p>
      </section>

      <section>
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">十四、联系我们</h2>
        <p>如您对本隐私政策有任何疑问、意见或建议，或希望行使您的个人信息主体权利，请通过以下方式联系我们：</p>
        <ul className="space-y-1 mt-2">
          <li><strong>邮箱：</strong>jiusei0319@gmail.com（邮件标题请注明&ldquo;个人信息保护咨询&rdquo;）</li>
          <li><strong>地址：</strong>河北省石家庄市元氏县马村乡聊村</li>
          <li><strong>回复时限：</strong>15个工作日</li>
        </ul>
      </section>

      <div className="mt-8 rounded-lg bg-gray-50 dark:bg-gray-800 p-4 text-xs text-gray-500 dark:text-gray-400">
        <p>
          本隐私政策由石家庄神雕农机科技有限公司制定，依据《中华人民共和国个人信息保护法》
          《中华人民共和国数据安全法》《中华人民共和国网络安全法》等法律法规编制。
          本政策应与《用户协议》配合阅读。本政策最终解释权归石家庄神雕农机科技有限公司所有。
        </p>
      </div>
    </>
  );
}

function PrivacyContentEn() {
  return (
    <>
      <p className="text-gray-600 dark:text-gray-400">
        Shijiazhuang Shendiao Agricultural Machinery Technology Co., Ltd.
        (&ldquo;we&rdquo; or &ldquo;AgriTrade&rdquo;) operates the usedfarmmach.com website
        and the &ldquo;AgriTrade&rdquo; WeChat Mini Program (collectively, the &ldquo;Platform&rdquo;).
        We are committed to protecting your personal information in accordance with applicable laws and regulations.
      </p>
      <p className="mt-4 text-sm text-gray-500">
        The English version is a translation of the Chinese Privacy Policy for reference only.
        In case of any discrepancy, the Chinese version shall prevail.
        The full English version will be available soon. For now, please refer to the Chinese version.
      </p>
    </>
  );
}
