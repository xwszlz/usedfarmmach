"use client";

import { translate } from "@/lib/i18n-runtime";
import Link from "next/link";
import { ChevronRight, Home } from "lucide-react";

interface PartsBreadcrumbProps {
  locale: string;
  machineTypeName?: string;
  subSystemName?: string;
  componentGroupName?: string;
}

export default function PartsBreadcrumb({
  locale,
  machineTypeName,
  subSystemName,
  componentGroupName,
}: PartsBreadcrumbProps) {
  const items: { label: string; href: string | null }[] = [
    { label: translate("首页", locale), href: `/${locale}` },
    { label: translate("配件专区", locale), href: `/${locale}/parts` },
  ];

  if (machineTypeName) {
    items.push({ label: machineTypeName, href: null });
  }
  if (subSystemName) {
    items.push({ label: subSystemName, href: null });
  }
  if (componentGroupName) {
    items.push({ label: componentGroupName, href: null });
  }

  return (
    <nav className="flex items-center gap-1.5 text-sm text-gray-500 mb-4 flex-wrap">
      {items.map((item, index) => (
        <div key={index} className="flex items-center gap-1.5">
          {index === 0 && <Home className="h-3.5 w-3.5" />}
          {item.href ? (
            <Link
              href={item.href}
              className="hover:text-orange-600 transition-colors"
            >
              {item.label}
            </Link>
          ) : (
            <span
              className={
                index === items.length - 1
                  ? "text-gray-800 font-medium"
                  : "text-gray-500"
              }
            >
              {item.label}
            </span>
          )}
          {index < items.length - 1 && (
            <ChevronRight className="h-3.5 w-3.5 text-gray-300" />
          )}
        </div>
      ))}
    </nav>
  );
}
