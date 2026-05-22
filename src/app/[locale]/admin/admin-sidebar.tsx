"use client";

import { useTranslations } from "next-intl";

export function AdminSidebar() {
  const t = useTranslations("nav");

  return (
    <aside className="w-60 border-r bg-gray-50 p-4">
      <h2 className="mb-4 text-sm font-semibold text-gray-400 uppercase">
        {t("dashboard")}
      </h2>
      <nav className="space-y-1">
        <a
          href="#"
          className="block rounded-lg px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100"
        >
          {t("myProducts")}
        </a>
        <a
          href="#"
          className="block rounded-lg px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100"
        >
          {t("myInquiries")}
        </a>
      </nav>
    </aside>
  );
}
