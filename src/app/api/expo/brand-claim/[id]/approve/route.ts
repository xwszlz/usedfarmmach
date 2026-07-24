import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { hashPassword, signToken, setTokenCookie } from "@/lib/auth";
import { sendEmail } from "@/lib/email";
import { nanoid } from "nanoid";

/**
 * 品牌认领审核 API
 * POST /api/expo/brand-claim/{id}/approve
 *
 * 将 pending 的 brand_claim 转为：
 *   1. User（merchant 角色，自动生成账号密码）
 *   2. Booth（关联到用户，关联到始终展 Expo）
 *   3. 发送入驻成功邮件（含登录凭证）
 */

const EXPO_SLUG = "always-on-expo";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // 1. 获取认领申请
    const claim = await prisma.expoRegistration.findUnique({ where: { id } });
    if (!claim) {
      return NextResponse.json({ success: false, error: "Claim not found" }, { status: 404 });
    }
    if (claim.status !== "pending") {
      return NextResponse.json({ success: false, error: `Claim already ${claim.status}` }, { status: 400 });
    }

    // 2. 解析品牌信息（从 message 字段中提取）
    // message 格式: "品牌认领申请\n品牌名称: xxx\n品牌Slug: xxx\n..."
    const msgLines = claim.message?.split("\n") || [];
    const extractValue = (prefix: string): string => {
      const line = msgLines.find((l) => l.startsWith(prefix));
      return line?.replace(prefix, "").trim() || "";
    };
    const brandName = extractValue("品牌名称:");
    const brandSlug = extractValue("品牌Slug:");

    // 3. 查找始终展 Expo
    let expo = await prisma.expo.findFirst({ where: { slug: EXPO_SLUG } });
    if (!expo) {
      // 自动创建
      expo = await prisma.expo.create({
        data: {
          name: "永不落幕的农机世界展会",
          slug: EXPO_SLUG,
          type: "virtual",
          status: "active",
          startDate: new Date("2026-01-01"),
          description: "神雕农机·始终展——品牌自发布平台",
        },
      });
    }

    // 4. 创建 User（merchant 角色）
    const username = `booth_${(claim.company || brandName).replace(/[^a-zA-Z0-9]/g, '_')}_${nanoid(6)}`;
    const rawPassword = nanoid(10); // 自动生成密码
    const hashedPwd = await hashPassword(rawPassword);

    const user = await prisma.user.create({
      data: {
        username,
        passwordHash: hashedPwd,
        email: claim.email || `${nanoid(8)}@booth-temp.shendiao.com`,
        phone: claim.phone,
        companyName: claim.company || brandName,
        country: claim.country || "中国",
        role: "seller", // seller = merchant
        isActive: true,
      },
    });

    // 5. 创建 Booth
    const booth = await prisma.booth.create({
      data: {
        expoId: expo.id,
        merchantId: user.id,
        name: brandName || claim.company || claim.name,
        hall: "virtual",
        template: "standard",
        status: "published",
        sortIndex: 0,
        pavilion: "china",
        tier: "free",
        intro: `${brandName} 已入驻神雕农机·永不落幕的农机世界展会。`,
      },
    });

    // 6. 更新申请状态
    await prisma.expoRegistration.update({
      where: { id },
      data: { status: "approved" },
    });

    // 7. 发送入驻通知邮件
    try {
      await sendEmail({
        to: claim.email || claim.phone + "@unknown.com",
        subject: `🎉 ${brandName} 已成功入驻神雕农机·始终展`,
        html: `
          <h2>祝贺您，${claim.name}！</h2>
          <p><strong>${brandName}</strong> 已成功入驻 <strong>神雕农机·永不落幕的农机世界展会</strong>。</p>
          <h3>您的自助展台信息</h3>
          <ul>
            <li>品牌名称：${brandName}</li>
            <li>登录账号：${username}</li>
            <li>登录密码：${rawPassword}</li>
          </ul>
          <p>登录后即可管理您的展品、查看询盘。</p>
          <p><a href="https://usedfarmmach.com/zh/expo/booth/${booth.id}" style="background:#16a34a;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;display:inline-block;margin-top:16px;">进入我的展台 →</a></p>
          <p style="margin-top:24px;color:#666;font-size:12px;">建议首次登录后立即修改密码。</p>
        `,
        text: `祝贺您！${brandName} 已成功入驻神雕农机始终展。\n登录账号：${username}\n登录密码：${rawPassword}\n\n登录后管理展品：https://usedfarmmach.com/zh/expo/booth/manage`,
      });
    } catch (emailErr) {
      console.error("Approval email failed:", emailErr);
    }

    return NextResponse.json({
      success: true,
      data: {
        boothId: booth.id,
        userId: user.id,
        username,
        rawPassword,
        url: `/expo/booth/${booth.id}`,
      },
      message: `Brand approved. Booth created. Login credentials emailed to ${claim.email || "N/A"}.`,
    });
  } catch (error) {
    console.error("Approve error:", error);
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
  }
}
