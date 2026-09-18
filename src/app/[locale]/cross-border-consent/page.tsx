import { translate } from "@/lib/i18n-runtime";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { isCnSite } from "@/config/site";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  // .cn 站数据不出境，本页在 .cn 不可达（见下方 notFound 门禁）→ 不索引
  if (isCnSite()) {
    return { robots: { index: false, follow: false } };
  }
  const title =
    locale === "zh"
      ? "《数据出境》单独同意条款 - 神雕农机"
      : "Separate Consent for Cross-Border Data Transfer - AgriTrade";
  const description =
    locale === "zh"
      ? "数据出境（跨境传输）单独同意条款：告知境外接收方、传输的个人信息种类、处理目的、合规路径及单独同意说明（依据个保法第三十九条）。"
      : "Separate consent for cross-border data transfer: overseas recipients, categories of personal information transferred, purposes of processing, compliance path and separate consent (pursuant to Article 39 of PIPL).";
  return {
    title,
    description,
    robots: { index: true, follow: true },
  };
}

export default async function CrossBorderConsentPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  // 站点门禁（合规）：.cn 站数据境内存储、不涉及出境，
  // 故不存在「数据出境单独同意」这件事 → 该页在 .cn 一律 404。
  // 参照 src/app/[locale]/escrow/layout.tsx 的站点头模式（方向相反）。
  if (isCnSite()) {
    notFound();
  }

  const isZh = locale === "zh";
  const isCn = isCnSite();

  return (
    <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:px-8">
      <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
        {isZh ? "《数据出境》单独同意条款" : "Separate Consent for Cross-Border Data Transfer"}
      </h1>
      <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
        {translate("最近更新日期：2026年7月17日 | 生效日期：2026年7月17日", locale)}
      </p>

      <div className="prose prose-sm dark:prose-invert mt-8 max-w-none text-gray-700 dark:text-gray-300 leading-relaxed space-y-6">
        {isCn ? <CrossBorderContentCn /> : isZh ? <CrossBorderContentZh /> : <CrossBorderContentEn />}
      </div>

      <div className="mt-8 border-t border-gray-200 dark:border-gray-700 pt-6">
        <Link
          href={`/${locale}/auth/register`}
          className="font-medium text-primary-600 hover:underline"
        >
          {isZh ? "返回注册" : "Back to sign up"}
        </Link>
      </div>
    </div>
  );
}

function CrossBorderContentZh() {
  return (
    <>
      <section>
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">五、数据出境（跨境传输）专章</h2>
        <p>
          由于本平台使用海外云服务提供商，您的部分个人信息可能被传输至中华人民共和国境外进行处理。
          我们依据《中华人民共和国个人信息保护法》（以下简称&ldquo;个保法&rdquo;）第三十八条至第四十条、
          以及《促进和规范数据跨境流动规定》的要求履行告知与单独同意义务。具体跨境传输情况如下：
        </p>
        <table className="w-full text-sm border border-gray-200 dark:border-gray-700 mt-3">
          <thead className="bg-gray-50 dark:bg-gray-800">
            <tr>
              <th className="border border-gray-200 dark:border-gray-700 px-3 py-2 text-left">境外接收方</th>
              <th className="border border-gray-200 dark:border-gray-700 px-3 py-2 text-left">所在国家/地区</th>
              <th className="border border-gray-200 dark:border-gray-700 px-3 py-2 text-left">传输的个人信息</th>
              <th className="border border-gray-200 dark:border-gray-700 px-3 py-2 text-left">处理目的</th>
              <th className="border border-gray-200 dark:border-gray-700 px-3 py-2 text-left">合规路径</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="border border-gray-200 dark:border-gray-700 px-3 py-2">Neon PostgreSQL</td>
              <td className="border border-gray-200 dark:border-gray-700 px-3 py-2">新加坡</td>
              <td className="border border-gray-200 dark:border-gray-700 px-3 py-2">用户注册信息、产品数据</td>
              <td className="border border-gray-200 dark:border-gray-700 px-3 py-2">用户注册信息与产品数据的存储及管理</td>
              <td className="border border-gray-200 dark:border-gray-700 px-3 py-2">标准合同（备案中）</td>
            </tr>
            <tr>
              <td className="border border-gray-200 dark:border-gray-700 px-3 py-2">Vercel Inc.</td>
              <td className="border border-gray-200 dark:border-gray-700 px-3 py-2">美国（全球CDN节点）</td>
              <td className="border border-gray-200 dark:border-gray-700 px-3 py-2">网页缓存数据（可能含IP地址等）</td>
              <td className="border border-gray-200 dark:border-gray-700 px-3 py-2">网站部署与全球访问加速</td>
              <td className="border border-gray-200 dark:border-gray-700 px-3 py-2">标准合同（备案中）</td>
            </tr>
            <tr>
              <td className="border border-gray-200 dark:border-gray-700 px-3 py-2">Resend Inc.</td>
              <td className="border border-gray-200 dark:border-gray-700 px-3 py-2">美国</td>
              <td className="border border-gray-200 dark:border-gray-700 px-3 py-2">用户邮箱地址（邮件发送）</td>
              <td className="border border-gray-200 dark:border-gray-700 px-3 py-2">注册验证邮件、密码重置邮件发送</td>
              <td className="border border-gray-200 dark:border-gray-700 px-3 py-2">标准合同（备案中）/ 计划替换为国内服务</td>
            </tr>
            <tr>
              <td className="border border-gray-200 dark:border-gray-700 px-3 py-2">阿里云OSS（图片存储）</td>
              <td className="border border-gray-200 dark:border-gray-700 px-3 py-2">中国（北京）</td>
              <td className="border border-gray-200 dark:border-gray-700 px-3 py-2">用户上传的农机图片</td>
              <td className="border border-gray-200 dark:border-gray-700 px-3 py-2">图片存储与CDN加速</td>
              <td className="border border-gray-200 dark:border-gray-700 px-3 py-2">境内存储，不涉及出境</td>
            </tr>
          </tbody>
        </table>

        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mt-5 mb-2">单独同意说明（依据个保法第三十九条）</h3>
        <p>
          根据《中华人民共和国个人信息保护法》第三十九条规定，向中华人民共和国境外提供个人信息的，
          应当向个人告知境外接收方的名称或者姓名、联系方式、处理目的、处理方式、个人信息的种类，
          以及个人向境外接收方行使个人信息保护权利的方式和程序等事项，并取得个人的<strong>单独同意</strong>。
        </p>
        <p className="mt-2">
          为此，您在注册账号或补全资料（邮箱、公司、国家等）时，本平台会通过<strong>独立的勾选项</strong>，
          就&ldquo;个人信息出境&rdquo;这一事项单独取得您的同意。未经您的单独同意，我们不会将您的个人信息传输至上述境外接收方。
          您有权随时撤回该单独同意；撤回后我们将停止相关跨境传输（法律法规另有规定，或为履行您所要求的合同所必需的情形除外）。
        </p>
        <p className="mt-2">
          我们正在依据个保法第三十八条至第四十条的规定，通过签订网信办标准合同并向省级网信部门备案的方式
          完成跨境传输合规程序。在标准合同备案完成前，我们已要求各境外接收方采取必要的安全措施保护您的个人信息。
        </p>
      </section>

      <div className="mt-8 rounded-lg bg-gray-50 dark:bg-gray-800 p-4 text-xs text-gray-500 dark:text-gray-400">
        <p>
          本条款摘自《隐私政策》第五章&ldquo;数据出境（跨境传输）专章&rdquo;，应与《隐私政策》正文配合阅读。
          本条款最终解释权归石家庄神雕农机科技有限公司所有。
        </p>
      </div>
    </>
  );
}

function CrossBorderContentEn() {
  return (
    <>
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
      </section>

      <div className="mt-8 rounded-lg bg-gray-50 dark:bg-gray-800 p-4 text-xs text-gray-500 dark:text-gray-400">
        <p>
          This clause is excerpted from Chapter 5 (&ldquo;Data Cross-Border Transfer&rdquo;) of the Privacy Policy
          and should be read together with the full Privacy Policy.
        </p>
      </div>
    </>
  );
}

function CrossBorderContentCn() {
  return (
    <>
      <section>
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">五、数据存储地点与跨境传输（境内存储专章）</h2>
        <p>
          依据个保法、数据安全法、网络安全法的要求，自您开始使用本平台起，您的所有个人信息与产品数据
          <strong>均存储于中华人民共和国境内</strong>。具体如下：
        </p>
        <ul className="list-disc pl-6 space-y-2 mt-2">
          <li><strong>用户个人信息与产品数据：</strong>存储于阿里云 ECS 本地部署的 PostgreSQL 数据库，地域为河北省 / 北京。</li>
          <li><strong>图片数据：</strong>存储于阿里云 OSS，地域为北京。</li>
          <li><strong>会员订单与支付流水：</strong>由微信支付 / 微信收付通在中国境内处理。</li>
        </ul>
        <p className="mt-2">
          <strong>不向境外传输：</strong>我们<strong>不向任何境外接收方传输</strong>您的个人信息。
          本平台不使用位于中国境外（含港澳台地区）的云数据库、邮件服务或托管服务处理您的个人信息。
          因此，本平台<strong>不涉及个人信息跨境传输</strong>，亦无需就个人信息出境取得您的单独同意。
        </p>
      </section>

      <div className="mt-8 rounded-lg bg-gray-50 dark:bg-gray-800 p-4 text-xs text-gray-500 dark:text-gray-400">
        <p>
          本页面说明摘自《隐私政策》相关章节，应与《隐私政策》正文配合阅读。
          本说明最终解释权归石家庄神雕农机科技有限公司所有。
        </p>
      </div>
    </>
  );
}
