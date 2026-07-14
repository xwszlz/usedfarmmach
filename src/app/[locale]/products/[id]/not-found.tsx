import Link from "next/link";
import { getLocale } from "next-intl/server";
import { PackageSearch } from "lucide-react";

export default async function ProductNotFound() {
  const locale = await getLocale();

  const text = {
    zh: { title: "产品未找到", desc: "该产品可能已下架或被移除，请浏览其他可用设备。", btn: "浏览全部设备" },
    en: { title: "Product Not Found", desc: "This product may have been delisted or removed. Browse other available equipment.", btn: "Browse All Equipment" },
    ru: { title: "Товар не найден", desc: "Этот товар мог быть снят с продажи. Просмотрите другие доступные товары.", btn: "Просмотреть все товары" },
  };
  const t = text[locale as keyof typeof text] || text.en;

  return (
    <div className="mx-auto flex min-h-[50vh] max-w-2xl flex-col items-center justify-center px-4 py-16 text-center">
      <PackageSearch className="mb-4 h-16 w-16 text-gray-300" />
      <h1 className="mb-2 text-2xl font-bold text-gray-900">{t.title}</h1>
      <p className="mb-6 text-sm text-gray-500">{t.desc}</p>
      <Link
        href={`/${locale}/products`}
        className="rounded-lg bg-primary-600 px-6 py-3 text-sm font-medium text-white hover:bg-primary-700"
      >
        {t.btn}
      </Link>
    </div>
  );
}
