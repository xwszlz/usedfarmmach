/**
 * CnFooter — .cn 站全局备案页脚
 *
 * 仅当 isCnSite() 时渲染备案号，并链往 https://beian.miit.gov.cn。
 * 值来自 src/config/site.ts 的 siteConfig.compliance.icpNo（← 环境变量 CN_ICP_NO）。
 *
 * 服务端组件：直接读取 siteConfig（构建/运行时由 SITE 决定），无需 "use client"。
 * 样式采用 Tailwind（浅底、居中、小字、可点链接），与 publish/page.tsx 现有写法保持一致。
 */

import { isCnSite, siteConfig } from "@/config/site";

export function CnFooter() {
  // 仅 .cn 站显示备案号
  if (!isCnSite()) {
    return null;
  }

  const icpNo = siteConfig.compliance.icpNo;
  if (!icpNo) {
    return null;
  }

  return (
    <footer className="mt-12 border-t border-gray-200 bg-gray-50 py-4">
      <div className="container mx-auto px-4 text-center text-xs text-gray-500">
        <a
          href="https://beian.miit.gov.cn"
          target="_blank"
          rel="noopener noreferrer"
          className="text-gray-500 underline hover:text-gray-700"
        >
          {icpNo}
        </a>
      </div>
    </footer>
  );
}

export default CnFooter;
