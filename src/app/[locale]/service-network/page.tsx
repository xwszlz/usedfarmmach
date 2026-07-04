import type { Metadata } from "next";
import { prisma } from "@/lib/db";
import { setRequestLocale } from "next-intl/server";
import { getTranslations } from "next-intl/server";
import ServiceNetworkClient from "./service-network-client";

export const metadata: Metadata = {
  title: "线下服务网络 — 神雕农机",
  description: "全国省级服务中心+县域服务网点目录，提供设备检测、维修、评估、交易等线下服务",
};

export default async function ServiceNetworkPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  // 查询所有活跃的服务网点
  const centers = await prisma.serviceCenter.findMany({
    where: { isActive: true },
    orderBy: [{ sortOrder: "asc" }, { province: "asc" }, { level: "asc" }],
  });

  // 如果没有数据，提供默认种子数据用于展示
  const seedCenters = centers.length > 0 ? centers : [];

  // 按省份分组
  const grouped: Record<string, any[]> = {};
  for (const c of seedCenters) {
    if (!grouped[c.province]) grouped[c.province] = [];
    const services = c.services ? JSON.parse(c.services as string) : [];
    grouped[c.province].push({ ...c, services });
  }

  const summary = {
    total: seedCenters.length,
    provinceCount: Object.keys(grouped).length,
    provinceLevel: seedCenters.filter((c) => c.level === "province").length,
    cityLevel: seedCenters.filter((c) => c.level === "city").length,
    countyLevel: seedCenters.filter((c) => c.level === "county").length,
  };

  return <ServiceNetworkClient grouped={grouped} summary={summary} locale={locale} />;
}
