/**
 * 农机一机一码 — 扫码落地页（移动端）
 *
 * 买家/验机员扫QR码后看到：
 * 1. 机器基本信息
 * 2. 验证状态
 * 3. 生命周期时间线（检测记录含照片视频优先展示）
 * 4. 验机入口（添加检测记录）
 */

import { prisma } from "@/lib/db";
import { getImageUrl } from "@/lib/image-url";
import { notFound } from "next/navigation";
import QRCodePageClient from "./client";

interface PageProps {
  params: Promise<{ locale: string; qrCode: string }>;
}

export default async function QRCodePage({ params }: PageProps) {
  const { locale, qrCode } = await params;
  const isZh = locale === "zh";

  const identity = await prisma.machineryIdentity.findUnique({
    where: { qrCode },
    include: {
      events: { orderBy: { eventDate: "desc" } },
      product: {
        select: {
          id: true,
          modelName: true,
          year: true,
          workingHours: true,
          condition: true,
          priceCny: true,
          location: true,
          status: true,
          brand: { select: { nameZh: true, nameEn: true } },
          category: { select: { nameZh: true, nameEn: true } },
          images: { orderBy: { sortOrder: "asc" }, take: 5 },
          seller: { select: { companyName: true, country: true } },
        },
      },
    },
  });

  if (!identity) {
    notFound();
  }

  // 解析events中的evidence JSON
  const events = identity.events.map((e) => {
    let evidence: any = null;
    if (e.evidence) {
      try {
        evidence = JSON.parse(e.evidence);
      } catch {}
    }
    return {
      id: e.id,
      eventType: e.eventType,
      title: e.title,
      description: e.description,
      operator: e.operator,
      location: e.location,
      eventDate: e.eventDate.toISOString(),
      evidence,
    };
  });

  const product = identity.product
    ? {
        id: identity.product.id,
        modelName: identity.product.modelName,
        year: identity.product.year,
        workingHours: identity.product.workingHours,
        condition: identity.product.condition,
        priceCny: identity.product.priceCny,
        location: identity.product.location,
        status: identity.product.status,
        brandName: identity.product.brand?.nameZh || identity.product.brand?.nameEn || "",
        categoryName: identity.product.category?.nameZh || identity.product.category?.nameEn || "",
        imageUrl: identity.product.images?.[0]
          ? getImageUrl(identity.product.images[0].url)
          : null,
        images:
          identity.product.images?.map((img) => getImageUrl(img.url)) || [],
        sellerName: identity.product.seller?.companyName || "",
      }
    : null;

  // 收集所有检测事件中的照片
  const allInspectionPhotos: string[] = [];
  events.forEach((e) => {
    if (e.eventType === "inspected" && e.evidence?.photos) {
      allInspectionPhotos.push(...e.evidence.photos);
    }
  });

  const profile = {
    qrCode: identity.qrCode,
    isVerified: identity.isVerified,
    verifyHash: identity.verifyHash,
    serialNo: identity.serialNo,
    manufactureDate: identity.manufactureDate,
    factoryName: identity.factoryName,
    factoryLocation: identity.factoryLocation,
    createdAt: identity.createdAt.toISOString(),
  };

  return (
    <QRCodePageClient
      locale={locale}
      profile={profile}
      product={product}
      events={events}
      allInspectionPhotos={allInspectionPhotos}
    />
  );
}

// 生成metadata
export async function generateMetadata({ params }: PageProps) {
  const { qrCode } = await params;
  const identity = await prisma.machineryIdentity.findUnique({
    where: { qrCode },
    select: {
      product: {
        select: {
          modelName: true,
          brand: { select: { nameZh: true } },
        },
      },
    },
  });

  const brand = identity?.product?.brand?.nameZh || "";
  const model = identity?.product?.modelName || qrCode;
  const title = `${brand}${model} - 农机档案 | ${qrCode}`;

  return {
    title,
    description: `扫码查看${brand}${model}的全生命周期档案与验机记录`,
    robots: "noindex",
  };
}
