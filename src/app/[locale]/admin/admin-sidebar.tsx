"use client";

import { useTranslations } from "next-intl";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Users, Package, Settings, FileText, Tent, Boxes } from "lucide-react";

export function AdminSidebar({ role }: { role: string }) {
  const t = useTranslations("nav");
  const pathname = usePathname();
  const locale = pathname.split("/")[1] || "zh";

  const isEditor = role === "editor";

  const links = [
    { href: `/${locale}/admin`, label: "控制台", icon: LayoutDashboard, hideForEditor: true },
    { href: `/${locale}/admin/users`, label: "用户管理", icon: Users, hideForEditor: true },
    { href: `/${locale}/admin/products`, label: "产品管理", icon: Package, hideForEditor: false },
    { href: `/${locale}/seller/products`, label: "卖家产品", icon: FileText, hideForEditor: true },
    { href: `/${locale}/admin/expo`, label: "博览会管理", icon: Tent, hideForEditor: false },
    { href: `/${locale}/admin/expo/manage`, label: "展会内容管理", icon: Boxes, hideForEditor: false },
  ];

  const visibleLinks = links.filter((l) => !(isEditor && l.hideForEditor));

  return (
    <aside className="w-60 border-r bg-gray-50 p-4">
      <h2 className="mb-4 text-sm font-semibold text-gray-400 uppercase">
        {isEditor ? "编辑面板" : "管理后台"}
      </h2>
      <nav className="space-y-1">
        {visibleLinks.map((link) => {
          const Icon = link.icon;
          const active = pathname === link.href;
          return (
            <Link
              key={link.href}
              href={link.href}
              className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                active ? "bg-primary-100 text-primary-700" : "text-gray-700 hover:bg-gray-100"
              }`}
            >
              <Icon className="h-4 w-4" />
              {link.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
