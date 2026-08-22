"use client";
/**
 * InternalTestBanner — 仅管理员可见的「内部测试」横幅
 *
 * 目的：让管理员（admin / super_admin）在取证前能直观看到拍卖功能的
 * 当前占位状态，并明确标注「对外不可见、请勿宣传」，避免误以为已上线。
 *
 * 合规要点：
 * - 本组件只在 isAdmin 时由 AuctionsClient 渲染，普通访客（含 .com）永远看不到，
 *   不会向公开市场泄露「未取证即在测试拍卖」的信息。
 * - 真实拍卖入口本身仍由 isCn 开关控制；本 banner 只是说明性提示，不改变任何合规闸门。
 *
 * 交互：可「收起」，状态存 localStorage，避免反复打扰；清缓存即重新出现。
 */
import { useEffect, useState } from "react";
import Link from "next/link";
import { useTr } from "@/lib/i18n-tr";
interface InternalTestBannerProps {
    site: "com" | "cn";
}
const DISMISS_KEY = "sd_auction_internal_test_banner_dismissed";
export function InternalTestBanner({ site }: InternalTestBannerProps) {
    const tr = useTr();
    // 初始显示，挂载后若已收起则隐藏（避免 SSR/CSR 水合不一致）
    const [dismissed, setDismissed] = useState(false);
    useEffect(() => {
        try {
            if (localStorage.getItem(DISMISS_KEY) === "1")
                setDismissed(true);
        }
        catch {
            /* localStorage 不可用时忽略 */
        }
    }, []);
    if (dismissed)
        return null;
    const isCn = site === "cn";
    return (<div className="mx-auto max-w-7xl px-6 md:px-12 mt-4">
      <div className="rounded-lg border-l-4 border-amber-500 bg-amber-50 px-4 py-3 text-sm text-amber-900">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1.5">
            <p className="font-semibold text-amber-800">{tr("🔧 内部测试 · 拍卖功能（P1 占位）")}</p>
            <p>{tr("• 真实拍卖入口仅在本站（.cn）显示；当前为合规占位页，")}<b>{tr("尚未取得《拍卖经营批准证书》")}</b>{tr("，对外不可见、请勿宣传（合规红线）。")}</p>
            <p>{tr("• 取证后填入环境变量")}<code>CN_AUCTION_LICENSE_NO</code>{tr("，公示徽章（S4）自动上线、 真实竞价（P2 六路由）即可启用，无需改代码。")}</p>
            <p>{tr("• 后台拍卖师挂靠录入：")}<Link href="/zh/admin/auctioneers" className="underline hover:text-amber-700">
                /zh/admin/auctioneers
              </Link>
            </p>
            {!isCn && (<p className="rounded bg-amber-100 px-2 py-1 text-amber-800">{tr("⚠️ 你当前在 .com 国际站，拍卖功能为 .cn 专属。请切换到 .cn 站点查看「真实拍卖」入口。")}</p>)}
          </div>
          <button onClick={() => {
            try {
                localStorage.setItem(DISMISS_KEY, "1");
            }
            catch {
                /* ignore */
            }
            setDismissed(true);
        }} className="shrink-0 rounded-md border border-amber-300 px-2 py-1 text-xs text-amber-800 hover:bg-amber-100">{tr("收起")}</button>
        </div>
      </div>
    </div>);
}
export default InternalTestBanner;
