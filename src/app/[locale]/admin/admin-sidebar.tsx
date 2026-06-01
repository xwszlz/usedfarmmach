"use client";

import { useTranslations } from "next-intl";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Users, Package, Settings, FileText } from "lucide-react";

export function AdminSidebar() {
  const t = useTranslations("nav");
  const pathname = usePathname();
  const locale = pathname.split("/")[1] || "zh";

  const links = [
    { href: `/${locale}/admin`, label: "控制台", icon: LayoutDashboard },
    { href: `/${locale}/admin/users`, label: "用户管理", icon: Users },
    { href: `/${locale}/admin/products`, label: "产品管理", icon: Package },
    { href: `/${locale}/seller/products`, label: "卖家产品", icon: FileText },
  ];

  return (
    <aside className="w-60 border-r bg-gray-50 p-4">
      <h2 className="mb-4 text-sm font-semibold text-gray-400 uppercase">管理后台</h2>
      <nav className="space-y-1">
        {links.map((link) => {
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
