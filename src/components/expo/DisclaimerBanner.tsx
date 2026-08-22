"use client";
import { useState } from "react";
import { ShieldAlert, ChevronDown, ChevronUp } from "lucide-react";
import { useTr } from "@/lib/i18n-tr";
interface DisclaimerBannerProps {
    locale?: string;
    variant?: "full" | "compact" | "badge";
}
/**
 * Disclaimer banner component for the virtual expo.
 * - "full": Expandable disclaimer section (for footer or dedicated page)
 * - "compact": Single-line notice with tooltip
 * - "badge": Small "AI Generated" badge for product/brand pages
 */
export function DisclaimerBanner({ locale = "zh", variant = "full" }: DisclaimerBannerProps) {
    const tr = useTr();
    const [expanded, setExpanded] = useState(false);
    const isZh = locale === "zh";
    if (variant === "badge") {
        return (<span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-500">
        <ShieldAlert className="h-3 w-3"/>
        {tr("AI生成内容")}
      </span>);
    }
    if (variant === "compact") {
        return (<div className="flex items-center gap-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">
        <ShieldAlert className="h-4 w-4 shrink-0"/>
        <span>
          {tr("本页图片及信息均为AI生成/基于公开资料整理，不代表品牌官方立场。")}
        </span>
      </div>);
    }
    // Full variant - expandable
    return (<div className="rounded-xl border border-gray-200 bg-gray-50">
      <button onClick={() => setExpanded(!expanded)} className="flex w-full items-center justify-between px-5 py-4 text-left">
        <div className="flex items-center gap-2">
          <ShieldAlert className="h-5 w-5 text-amber-600"/>
          <span className="text-sm font-semibold text-gray-700">
            {tr("免责声明")}
          </span>
        </div>
        {expanded ? (<ChevronUp className="h-4 w-4 text-gray-400"/>) : (<ChevronDown className="h-4 w-4 text-gray-400"/>)}
      </button>
      {expanded && (<div className="border-t border-gray-200 px-5 py-4">
          <p className="text-xs leading-relaxed text-gray-500">
            {isZh
                ? "\u672C\u7F51\u7AD9\"\u4E16\u754C\u519C\u673A\u6570\u5B57\u5C55\u4F1A\"\u4E3A\u4FE1\u606F\u5C55\u793A\u5E73\u53F0\uFF0C\u6240\u5C55\u793A\u7684\u54C1\u724C\u540D\u79F0\u3001\u4EA7\u54C1\u4FE1\u606F\u53CA\u56FE\u7247\u5747\u4E3A\u57FA\u4E8E\u516C\u5F00\u8D44\u6599\u7684AI\u751F\u6210\u5185\u5BB9\uFF0C\u4E0D\u4EE3\u8868\u54C1\u724C\u5B98\u65B9\u7ACB\u573A\uFF0C\u4E0D\u6784\u6210\u4EFB\u4F55\u5546\u4E1A\u6388\u6743\u6216\u4EE3\u7406\u5173\u7CFB\u3002\u6240\u6709\u4EA7\u54C1\u56FE\u7247\u5747\u4E3AAI\u751F\u6210\u7684\u827A\u672F\u6E32\u67D3\u56FE\uFF0C\u975E\u771F\u5B9E\u4EA7\u54C1\u7167\u7247\u3002\u54C1\u724CLogo\u4E3A\u793A\u610F\u6027\u6807\u8BC6\uFF0C\u975E\u5B98\u65B9\u6CE8\u518C\u5546\u6807\u3002\u5982\u54C1\u724C\u65B9\u5BF9\u672C\u5E73\u53F0\u5C55\u793A\u5185\u5BB9\u6709\u5F02\u8BAE\uFF0C\u6216\u5E0C\u671B\u8BA4\u9886\u5E76\u66F4\u65B0\u5C55\u793A\u4FE1\u606F\uFF0C\u8BF7\u8054\u7CFB\uFF1Ajiusei0319@gmail.com\u3002\u672C\u5E73\u53F0\u5C06\u5728\u6536\u5230\u901A\u77E5\u540E48\u5C0F\u65F6\u5185\u5904\u7406\u76F8\u5173\u8BF7\u6C42\u3002"
                : "This website \"World Agricultural Machinery Digital Expo\" is an information display platform. Brand names, product information, and images displayed are AI-generated content based on public sources and do not represent official brand positions, nor constitute any commercial authorization or agency relationship. All product images are AI-generated artistic renderings, not real product photos. Brand logos are indicative marks, not official registered trademarks. If a brand has objections to the displayed content or wishes to claim and update its information, please contact: jiusei0319@gmail.com. We will process relevant requests within 48 hours of receipt."}
          </p>
          <a href={`/${locale}/expo/brand-claim`} className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:underline">
            {tr("品牌方认领入口 →")}
          </a>
        </div>)}
    </div>);
}
