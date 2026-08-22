"use client";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Users, Package, Settings, FileText, Tent, Boxes, Shield, Bot, Gavel, FileSignature, ShieldCheck, ScrollText, SlidersHorizontal, Activity, BarChart3, BadgeCheck } from "lucide-react";
import { useTr } from "@/lib/i18n-tr";
export function AdminSidebar({ role }: {
    role: string;
}) {
  const tr = useTr();
    const t = useTranslations("nav");
    const pathname = usePathname();
    const locale = pathname.split("/")[1] || "zh";
    const isEditor = role === "editor";
    const isSuperAdmin = role === "super_admin";
    const tg = useTranslations("adminSystem");
    const governanceLinks = [
        { href: `/${locale}/admin/system/roles`, label: tg("roles"), icon: ShieldCheck },
        { href: `/${locale}/admin/system/audit`, label: tg("audit"), icon: ScrollText },
        { href: `/${locale}/admin/system/config`, label: tg("config"), icon: SlidersHorizontal },
        { href: `/${locale}/admin/system/compliance`, label: tg("compliance"), icon: Activity },
    ];
    const links = [
        { href: `/${locale}/admin`, label: tr("控制台"), icon: LayoutDashboard, hideForEditor: true },
        { href: `/${locale}/admin/users`, label: tr("用户管理"), icon: Users, hideForEditor: true },
        { href: `/${locale}/admin/products`, label: tr("产品管理"), icon: Package, hideForEditor: false },
        { href: `/${locale}/admin/auction-bookings`, label: tr("询价报名管理"), icon: Gavel, hideForEditor: false },
        { href: `/${locale}/admin/auctioneers`, label: tr("拍卖师挂靠"), icon: BadgeCheck, hideForEditor: true },
        { href: `/${locale}/admin/contract-templates`, label: tr("合同模板管理"), icon: FileSignature, hideForEditor: false },
        { href: `/${locale}/seller/products`, label: tr("卖家产品"), icon: FileText, hideForEditor: true },
        { href: `/${locale}/admin/expo`, label: tr("博览会管理"), icon: Tent, hideForEditor: false },
        { href: `/${locale}/admin/expo/manage`, label: tr("展会内容管理"), icon: Boxes, hideForEditor: false },
        { href: `/${locale}/admin/orchestrator`, label: tr("智能体调度"), icon: Bot, hideForEditor: true },
        { href: `/${locale}/admin/export-compliance`, label: tr("出口合规"), icon: Shield, hideForEditor: false },
        { href: `/${locale}/admin/analytics/views`, label: tr("浏览量看板"), icon: BarChart3, hideForEditor: true },
    ];
    const visibleLinks = links.filter((l) => !(isEditor && l.hideForEditor));
    return (<aside className="w-60 border-r bg-gray-50 p-4">
      <h2 className="mb-4 text-sm font-semibold text-gray-400 uppercase">
        {isEditor ? "\u7F16\u8F91\u9762\u677F" : "\u7BA1\u7406\u540E\u53F0"}
      </h2>
      <nav className="space-y-1">
        {visibleLinks.map((link) => {
            const Icon = link.icon;
            const active = pathname === link.href;
            return (<Link key={link.href} href={link.href} className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${active ? "bg-primary-100 text-primary-700" : "text-gray-700 hover:bg-gray-100"}`}>
              <Icon className="h-4 w-4"/>
              {link.label}
            </Link>);
        })}
      </nav>

      {isSuperAdmin && (<div className="mt-6 border-t border-gray-200 pt-4">
          <h3 className="mb-2 text-xs font-semibold text-gray-400 uppercase">
            {tg("systemGovernance")}
          </h3>
          <nav className="space-y-1">
            {governanceLinks.map((link) => {
                const Icon = link.icon;
                const active = pathname === link.href;
                return (<Link key={link.href} href={link.href} className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${active ? "bg-primary-100 text-primary-700" : "text-gray-700 hover:bg-gray-100"}`}>
                  <Icon className="h-4 w-4"/>
                  {link.label}
                </Link>);
            })}
          </nav>
        </div>)}
    </aside>);
}
