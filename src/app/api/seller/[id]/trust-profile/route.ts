/**
 * 卖家信任档案 API
 *
 * GET /api/seller/[id]/trust-profile
 *   聚合卖家认证信息 + 评分统计 + 产品数量 + 交易记录摘要
 *   公开接口，无需认证
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: sellerId } = await params;

    const seller = await prisma.user.findUnique({
      where: { id: sellerId },
      select: {
        id: true,
        companyName: true,
        country: true,
        role: true,
        membershipTier: true,
        createdAt: true,
      },
    });

    if (!seller) {
      return NextResponse.json({ error: "Seller not found" }, { status: 404 });
    }

    // 并行查询
    const [certifications, ratings, productCount, activeProductCount, activeProducts] = await Promise.all([
      // 认证信息
      prisma.certification.findMany({
        where: { userId: sellerId, status: "approved" },
        select: {
          certType: true,
          applicantName: true,
          validUntil: true,
          businessLicenseNo: true,
          personnelLevel: true,
          inspectionGrade: true,
        },
      }),
      // 评分
      prisma.sellerRating.findMany({
        where: { sellerId },
        select: {
          score: true,
          comment: true,
          itemMatchScore: true,
          serviceScore: true,
          logisticsScore: true,
          createdAt: true,
          rater: { select: { companyName: true, username: true } },
        },
        orderBy: { createdAt: "desc" },
        take: 10,
      }),
      // 产品总数
      prisma.product.count({ where: { sellerId } }),
      // 在售产品数
      prisma.product.count({ where: { sellerId, status: "active" } }),
      // 在售产品列表
      prisma.product.findMany({
        where: { sellerId, status: "active" },
        select: {
          id: true,
          modelName: true,
          year: true,
          priceCny: true,
          condition: true,
          brand: { select: { nameZh: true, nameEn: true } },
          images: { select: { url: true }, orderBy: { sortOrder: "asc" }, take: 1 },
        },
        orderBy: { createdAt: "desc" },
        take: 12,
      }),
    ]);

    // 计算评分统计
    const ratingCount = ratings.length;
    const avgScore = ratingCount > 0
      ? Math.round((ratings.reduce((sum, r) => sum + r.score, 0) / ratingCount) * 10) / 10
      : 0;
    const avgItemMatch = ratingCount > 0
      ? Math.round((ratings.filter(r => r.itemMatchScore).reduce((sum, r) => sum + (r.itemMatchScore || 0), 0) / ratingCount) * 10) / 10
      : 0;
    const avgService = ratingCount > 0
      ? Math.round((ratings.filter(r => r.serviceScore).reduce((sum, r) => sum + (r.serviceScore || 0), 0) / ratingCount) * 10) / 10
      : 0;
    const avgLogistics = ratingCount > 0
      ? Math.round((ratings.filter(r => r.logisticsScore).reduce((sum, r) => sum + (r.logisticsScore || 0), 0) / ratingCount) * 10) / 10
      : 0;

    // 评分分布
    const ratingDistribution = [5, 4, 3, 2, 1].map((star) => ({
      star,
      count: ratings.filter((r) => r.score === star).length,
    }));

    // 认证标识
    const certBadges = certifications.map((c) => ({
      type: c.certType,
      label: c.certType === "institution" ? "机构认证" : c.certType === "personnel" ? "人员认证" : "车辆认证",
      validUntil: c.validUntil,
    }));

    // 信任等级
    let trustLevel = "basic";
    if (certifications.length >= 3 && avgScore >= 4.5 && productCount >= 10) {
      trustLevel = "gold";
    } else if (certifications.length >= 2 && avgScore >= 4.0) {
      trustLevel = "verified";
    } else if (certifications.length >= 1) {
      trustLevel = "certified";
    }

    return NextResponse.json({
      seller,
      trustProfile: {
        trustLevel,
        certBadges,
        certifications,
        ratingStats: {
          avgScore,
          ratingCount,
          avgItemMatch,
          avgService,
          avgLogistics,
          ratingDistribution,
        },
        recentRatings: ratings,
        productCount,
        activeProductCount,
        activeProducts,
        memberSince: seller.createdAt,
      },
    });
  } catch (error) {
    console.error("Failed to fetch seller trust profile:", error);
    return NextResponse.json({ error: "Failed to fetch seller trust profile" }, { status: 500 });
  }
}
