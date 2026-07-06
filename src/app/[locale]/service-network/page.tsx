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

  // 查询所有活跃的服务网点（包裹 try-catch 防止数据库异常导致 500）
  let centers: any[] = [];
  let queryError = false;
  try {
    centers = await prisma.serviceCenter.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: "asc" }, { province: "asc" }, { level: "asc" }],
    });
  } catch (err) {
    console.error("ServiceNetworkPage: 查询服务网点失败:", err);
    queryError = true;
  }

  // 按省份分组
  const grouped: Record<string, any[]> = {};
  for (const c of centers) {
    if (!grouped[c.province]) grouped[c.province] = [];
    let services: string[] = [];
    try {
      services = c.services ? JSON.parse(c.services as string) : [];
    } catch {
      services = [];
    }
    grouped[c.province].push({ ...c, services });
  }

  const summary = {
    total: centers.length,
    provinceCount: Object.keys(grouped).length,
    provinceLevel: centers.filter((c) => c.level === "province").length,
    cityLevel: centers.filter((c) => c.level === "city").length,
    countyLevel: centers.filter((c) => c.level === "county").length,
  };

  return <ServiceNetworkClient grouped={grouped} summary={summary} locale={locale} error={queryError} />;
}
