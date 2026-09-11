/**
 * AuctionLicenseBadge — 拍卖经营批准证书公示组件（S4 占位 / 上线组件）
 *
 * 安全设计（关键）：
 * - licenseNo 为空（未取证）时一律 return null，绝不渲染任何"拍卖许可"字样，
 *   避免"有照无证"反向违规。2024-50号文要求「持证公示」，但无照时不得虚假公示。
 * - 取证后只需在 Vercel .cn 环境变量填入 CN_AUCTION_LICENSE_NO，无需改代码即上线。
 *
 * ⚠️ 口径铁律（合规红线 #3）：本组件渲染的证书编号属于**合作持牌拍卖机构**，
 *    不是平台自有资质。平台注册地在元氏县（县级），依冀商规字〔2020〕2号
 *    无法取得《拍卖经营批准证书》。因此文案必须是「本平台拍卖业务由合作持牌机构…依法开展」，
 *    绝不可写成「本公司已取得《拍卖经营批准证书》」——那是虚假公示。
 *
 * 适配两端复用：
 * - 服务端（CnFooter）直接读取 siteConfig.compliance.auctionLicenseNo 后传入。
 * - 客户端（AuctionsClient）由服务端 page.tsx 将 licenseNo 作为 props 注入。
 * 本组件为纯展示、无 "use client"，可在 Server / Client 组件中安全 import。
 *
 * variant：
 * - "footer"：全局页脚精简条（融入 CnFooter）。
 * - "channel"：拍卖频道页突出公示块（满足50号文「拍卖频道公示」）。
 */

import Link from "next/link";

interface AuctionLicenseBadgeProps {
  licenseNo: string | null;
  variant?: "footer" | "channel";
}

/** 公司法定全称与统一社会信用代码（公示固定信息） */
const COMPANY_NAME = "石家庄神雕农机科技有限公司";
const UNIFIED_SOCIAL_CREDIT_CODE = "91130132072058877W";

export function AuctionLicenseBadge({
  licenseNo,
  variant = "footer",
}: AuctionLicenseBadgeProps) {
  // 安全闸门：未取证不渲染任何字样
  if (!licenseNo) return null;

  const isChannel = variant === "channel";

  return (
    <div className={isChannel ? "mx-auto max-w-7xl px-6 md:px-12 mt-4" : "mt-3"}>
      <div
        className={
          "rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-xs leading-relaxed text-amber-900 " +
          (isChannel ? "text-left" : "text-center")
        }
      >
        <p className="font-semibold text-amber-800">
          {isChannel ? "合作拍卖机构资质公示" : "合作拍卖机构资质公示"}
        </p>
        <p className="mt-1">
          本平台拍卖业务由合作持牌拍卖机构依法开展并持有《拍卖经营批准证书》（证书编号：{licenseNo}）。
本平台为网络竞价技术服务与信息服务提供者，非拍卖活动的举办主体，亦非拍卖合同当事人或交易任何一方的代理人。
        </p>
        <p className="mt-1">
          {COMPANY_NAME} · 统一社会信用代码：{UNIFIED_SOCIAL_CREDIT_CODE}
        </p>
        <p className="mt-1">
          <Link
            href="https://beian.miit.gov.cn"
            target="_blank"
            rel="noopener noreferrer"
            className="underline hover:text-amber-700"
          >
            冀ICP备2024053719号-4
          </Link>
        </p>
      </div>
    </div>
  );
}

export default AuctionLicenseBadge;
