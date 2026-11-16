/**
 * CnFooter — .cn 站全局合规备案页脚（醒目备案栏）
 *
 * 仅当 isCnSite() 时渲染，统一展示两类备案信息：
 *  - 工信部 ICP 备案号：链接 https://beian.miit.gov.cn
 *  - 公安联网备案号：盾牌图标 + 链接 beian.gov.cn（公安部联网备案查询）
 *
 * 两者居中并列，小屏（< sm）自动换行堆叠，并以竖线分隔。
 * 值来自 src/config/site.ts 的 siteConfig.compliance.icpNo / beianNo
 * （分别由环境变量 CN_ICP_NO / CN_BEIAN_NO 注入，带默认值）。
 *
 * 服务端组件：直接读取 siteConfig（构建/运行时由 SITE 决定），无需 "use client"。
 * 样式采用 Tailwind，与全站 footer 风格协调但更醒目、易读。
 */

import { ShieldCheck } from "lucide-react";
import { isCnSite, siteConfig } from "@/config/site";

/** 公安联网备案查询地址（recordcode 取备案号中的数字部分） */
const PUBLIC_SECURITY_BEIAN_URL =
  "http://www.beian.gov.cn/portal/registerSystemInfo?recordcode=13013202000274";

const ICP_BEIAN_URL = "https://beian.miit.gov.cn";

export function CnFooter() {
  // 仅 .cn 站显示备案栏
  if (!isCnSite()) {
    return null;
  }

  const { icpNo, beianNo } = siteConfig.compliance;
  // 两项皆无则不渲染
  if (!icpNo && !beianNo) {
    return null;
  }

  return (
    <footer className="mt-12 border-t border-slate-200 bg-slate-50">
      <div className="mx-auto flex max-w-5xl flex-col items-center gap-2 px-4 py-5 text-center sm:flex-row sm:justify-center sm:gap-5">
        {icpNo && (
          <a
            href={ICP_BEIAN_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm font-medium text-slate-600 underline-offset-2 transition-colors hover:text-blue-700 hover:underline"
          >
            {icpNo}
          </a>
        )}

        {icpNo && beianNo && (
          <span
            aria-hidden="true"
            className="hidden h-4 w-px bg-slate-300 sm:block"
          />
        )}

        {beianNo && (
          <a
            href={PUBLIC_SECURITY_BEIAN_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-700 underline-offset-2 transition-colors hover:text-blue-700 hover:underline"
          >
            <ShieldCheck
              className="h-4 w-4 text-blue-600"
              aria-hidden="true"
            />
            <span>{beianNo}</span>
          </a>
        )}
      </div>

      <div className="mt-2 px-4 pb-5 text-center text-sm text-slate-500">
        © 2026 石家庄神雕农机科技有限公司. 保留所有权利。
      </div>
    </footer>
  );
}

export default CnFooter;
