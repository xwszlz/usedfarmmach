"use client";
/**
 * AuctionLicenseBadge — 拍卖经营批准证书公示组件（S4 占位 / 上线组件）
 *
 * 安全设计（关键）：
 * - licenseNo 为空（未取证）时一律 return null，绝不渲染任何"拍卖许可"字样，
 *   避免"有照无证"反向违规。2024-50号文要求「持证公示」，但无照时不得虚假公示。
 * - 取证后只需在 Vercel .cn 环境变量填入 CN_AUCTION_LICENSE_NO，无需改代码即上线。
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
import { useTr } from "@/lib/i18n-tr";
interface AuctionLicenseBadgeProps {
    licenseNo: string | null;
    variant?: "footer" | "channel";
}
/** 公司法定全称与统一社会信用代码（公示固定信息） */
const COMPANY_NAME = "\u77F3\u5BB6\u5E84\u795E\u96D5\u519C\u673A\u79D1\u6280\u6709\u9650\u516C\u53F8";
const UNIFIED_SOCIAL_CREDIT_CODE = "91130132072058877W";
export function AuctionLicenseBadge({ licenseNo, variant = "footer", }: AuctionLicenseBadgeProps) {
    const tr = useTr();
    // 安全闸门：未取证不渲染任何字样
    if (!licenseNo)
        return null;
    const isChannel = variant === "channel";
    return (<div className={isChannel ? "mx-auto max-w-7xl px-6 md:px-12 mt-4" : "mt-3"}>
      <div className={"rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-xs leading-relaxed text-amber-900 " +
            (isChannel ? "text-left" : "text-center")}>
        <p className="font-semibold text-amber-800">
          {isChannel ? "\u62CD\u5356\u7ECF\u8425\u8D44\u8D28\u516C\u793A" : "\u62CD\u5356\u7ECF\u8425\u6279\u51C6\u8BC1\u4E66\u516C\u793A"}
        </p>
        <p className="mt-1">{tr("本公司已取得《拍卖经营批准证书》（编号：")}{licenseNo}{tr("），依法开展网络拍卖业务。")}</p>
        <p className="mt-1">
          {COMPANY_NAME}{tr("· 统一社会信用代码：")}{UNIFIED_SOCIAL_CREDIT_CODE}
        </p>
        <p className="mt-1">
          <Link href="https://beian.miit.gov.cn" target="_blank" rel="noopener noreferrer" className="underline hover:text-amber-700">{tr("冀ICP备2024053719号-4")}</Link>
        </p>
      </div>
    </div>);
}
export default AuctionLicenseBadge;
