import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function BargainRedirect({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;

  // 尝试查找关联产品，成功则重定向到产品页#bargain，失败则回退到议价列表
  try {
    const { prisma } = await import("@/lib/db");
    const auction = await prisma.auction.findUnique({
      where: { id },
      select: { productId: true },
    });

    if (auction?.productId) {
      redirect(`/${locale}/products/${auction.productId}#bargain`);
    }
  } catch {
    // 数据库不可用时静默回退
  }

  redirect(`/${locale}/auctions`);
}
