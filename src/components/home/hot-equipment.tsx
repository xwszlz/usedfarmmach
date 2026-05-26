import Link from "next/link";
import { useTranslations } from "next-intl";
import { ArrowRight } from "lucide-react";
import { ProductCard } from "@/components/product/product-card";
import { Button } from "@/components/ui/button";
import type { Product } from "@/types";

interface HotEquipmentProps {
  products: Product[];
  locale: string;
}

export function HotEquipment({ products, locale }: HotEquipmentProps) {
  const t = useTranslations("home");

  return (
    <section className="bg-white py-16">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mb-8 flex items-end justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 sm:text-3xl">
              {t("hotEquipment")}
            </h2>
            <p className="mt-1 text-gray-500">{t("hotEquipmentDesc")}</p>
          </div>
          <Link href={`/${locale}/products`}>
            <Button variant="ghost">
              {t("viewAll")}
              <ArrowRight className="ml-1 h-4 w-4" />
            </Button>
          </Link>
        </div>
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {products.map((product) => (
            <ProductCard key={product.id} product={product} locale={locale} />
          ))}
        </div>
      </div>
    </section>
  );
}
