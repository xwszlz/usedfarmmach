import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { sendEmail } from "@/lib/email";

/**
 * 品牌认领 API
 * POST /api/expo/brand-claim
 *
 * 品牌方提交认领申请，写入 ExpoRegistration 表（source=brand_claim）
 * 同时发送邮件通知管理员
 */
const ADMIN_EMAIL = "jiusei0319@gmail.com";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const {
      brandName,
      brandSlug,
      contactName,
      phone,
      email,
      company,
      country,
      businessLicense,
      position,
      message,
      locale,
    } = body;

    // Validate required fields
    if (!contactName || !phone || !brandName) {
      return NextResponse.json(
        { success: false, error: "Missing required fields: brandName, contactName, phone" },
        { status: 400 }
      );
    }

    // Save to database
    const registration = await prisma.expoRegistration.create({
      data: {
        name: contactName,
        phone,
        email: email || null,
        company: company || null,
        country: country || null,
        category: "brand_claim",
        boothType: null,
        message: `品牌认领申请\n品牌名称: ${brandName}\n品牌Slug: ${brandSlug || "N/A"}\n联系人职位: ${position || "N/A"}\n营业执照编号: ${businessLicense || "N/A"}\n留言: ${message || "N/A"}`,
        source: "brand_claim",
        expoType: "virtual",
        locale: locale || "zh",
        status: "pending",
      },
    });

    // Send email notification
    try {
      const emailText = `
品牌认领申请

品牌名称: ${brandName}
品牌页面: ${brandSlug || "N/A"}
联系人: ${contactName}
职位: ${position || "N/A"}
电话: ${phone}
邮箱: ${email || "N/A"}
公司: ${company || "N/A"}
国家/地区: ${country || "N/A"}
营业执照编号: ${businessLicense || "N/A"}

留言:
${message || "无"}

---
申请ID: ${registration.id}
请登录管理后台审核处理。
      `;
      await sendEmail({
        to: ADMIN_EMAIL,
        subject: `[品牌认领] ${brandName} - ${contactName}`,
        html: emailText.replace(/\n/g, "<br>"),
        text: emailText,
      });
    } catch (emailErr) {
      console.error("Email notification failed:", emailErr);
      // Don't fail the request if email fails
    }

    return NextResponse.json({
      success: true,
      id: registration.id,
      message: "Brand claim submitted successfully",
    });
  } catch (error) {
    console.error("Brand claim error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
