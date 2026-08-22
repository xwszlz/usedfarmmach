import { prisma } from "@/lib/db";
import { notFound } from "next/navigation";
import { ProductEditForm } from "./edit-form";
import { translate } from "@/lib/i18n-runtime";
import { getLocale } from "next-intl/server";
export const dynamic = "force-dynamic";
export default async function ProductEditPage({ params, }: {
    params: Promise<{
        id: string;
    }>;
}) {
  const locale = await getLocale();
    const { id } = await params;
    const [product, brands, categories] = await Promise.all([
        prisma.product.findUnique({
            where: { id },
            include: {
                brand: true,
                category: true,
                images: { orderBy: { sortOrder: "asc" } },
                videos: true,
                seller: { select: { id: true, email: true, companyName: true } },
            },
        }),
        prisma.brand.findMany({ orderBy: { nameZh: "asc" } }),
        prisma.category.findMany({ orderBy: { nameZh: "asc" } }),
    ]);
    if (!product) {
        notFound();
    }
    return (<div>
      <h1 className="mb-6 text-2xl font-bold text-gray-900">{translate("编辑产品", locale)}</h1>

      <div className="mb-4 flex items-center gap-4 text-sm text-gray-500">
        <span>ID: {product.id}</span>
        <span>{translate("卖家:", locale)}{product.seller.companyName || product.seller.email}</span>
        <span>{translate("创建:", locale)}{new Date(product.createdAt).toLocaleDateString("zh-CN")}</span>
      </div>

      <ProductEditForm product={{
            id: product.id,
            modelName: product.modelName,
            year: product.year,
            workingHours: product.workingHours,
            condition: product.condition,
            priceCny: product.priceCny,
            priceUsd: product.priceUsd,
            location: product.location,
            descriptionZh: product.descriptionZh,
            brandId: product.brandId,
            categoryId: product.categoryId,
            status: product.status,
            brand: product.brand,
            category: product.category,
            images: product.images.map((img) => ({ id: img.id, url: img.url, isPrimary: img.isPrimary })),
            videos: product.videos.map((v) => ({ id: v.id, url: v.url, sortOrder: v.sortOrder })),
            enginePower: product.enginePower,
            engineType: product.engineType,
            driveSystem: product.driveSystem,
            overallLength: product.overallLength,
            overallWidth: product.overallWidth,
            overallHeight: product.overallHeight,
            netWeight: product.netWeight,
            mainConfig: product.mainConfig,
            priceMode: product.priceMode,
            tradeTerm: product.tradeTerm,
            tradePort: product.tradePort,
        }} brands={brands.map((b) => ({ id: b.id, nameZh: b.nameZh, nameEn: b.nameEn }))} categories={categories.map((c) => ({ id: c.id, nameZh: c.nameZh, nameEn: c.nameEn }))}/>
    </div>);
}
