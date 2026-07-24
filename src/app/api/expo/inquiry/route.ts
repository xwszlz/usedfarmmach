import { NextRequest, NextResponse } from "next/server";
import { sendEmail } from "@/lib/email";
import { prisma } from "@/lib/db";

/**
 * 农机博览会 — 招商意向表提交 API
 * POST /api/expo/inquiry
 *
 * 接收表单数据：
 * 1. 写入 ExpoRegistration 表（Phase 1 升级）
 * 2. 发送邮件通知管理员
 */

const ADMIN_EMAIL = "932133255@qq.com";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const { type, company, contact, phone, email, country, category, boothType, message, locale } = body;

    // === 展位询盘（来自展位详情页）===
    if (type === "booth_inquiry") {
      const { boothId, merchantId, showcaseItemId, buyerName, buyerPhone, buyerEmail, buyerWechat, buyerCountry, message, intent } = body;
      if (!buyerName || !buyerPhone) {
        return NextResponse.json(
          { success: false, error: "Missing required fields: buyerName, buyerPhone" },
          { status: 400 }
        );
      }

      // Get booth info for email
      let boothName = "";
      try {
        const booth = await prisma.booth.findUnique({
          where: { id: boothId },
          include: { merchant: { select: { username: true, companyName: true, email: true, phone: true } } },
        });
        if (booth) {
          boothName = booth.name;
          // If showcaseItemId provided, increment inquiry count
          if (showcaseItemId) {
            await prisma.showcaseItem.update({
              where: { id: showcaseItemId },
              data: { inquiryCount: { increment: 1 } },
            });
          }
        }
      } catch (e) {
        console.error("[Expo BoothInquiry] Failed to lookup booth:", e);
      }

      // Write to ExpoInquiry table
      let inquiryRecord = null;
      try {
        inquiryRecord = await prisma.expoInquiry.create({
          data: {
            showcaseItemId: showcaseItemId || null,
            boothId: boothId || null,
            merchantId: merchantId || null,
            buyerId: null,
            buyerName,
            buyerPhone,
            buyerEmail: buyerEmail || null,
            buyerWechat: buyerWechat || null,
            buyerCountry: buyerCountry || null,
            message: message || `Inquiry about booth: ${boothName}`,
            intent: intent || "inquiry",
            status: "new",
          },
        });
      } catch (dbErr) {
        console.error("[Expo BoothInquiry DB Error]", dbErr);
      }

      // Send email
      const subject = `[展位询盘] ${buyerName} - ${boothName}`;
      const html = `
        <h2>农机博览会 - 展位询盘</h2>
        <table style="border-collapse:collapse;width:100%;font-size:14px;">
          <tr><td style="padding:8px;border:1px solid #ddd;font-weight:bold;">展位</td><td style="padding:8px;border:1px solid #ddd;">${boothName}</td></tr>
          <tr><td style="padding:8px;border:1px solid #ddd;font-weight:bold;">买家姓名</td><td style="padding:8px;border:1px solid #ddd;">${buyerName}</td></tr>
          <tr><td style="padding:8px;border:1px solid #ddd;font-weight:bold;">电话/WhatsApp</td><td style="padding:8px;border:1px solid #ddd;">${buyerPhone}</td></tr>
          <tr><td style="padding:8px;border:1px solid #ddd;font-weight:bold;">邮箱</td><td style="padding:8px;border:1px solid #ddd;">${buyerEmail || "-"}</td></tr>
          <tr><td style="padding:8px;border:1px solid #ddd;font-weight:bold;">微信</td><td style="padding:8px;border:1px solid #ddd;">${buyerWechat || "-"}</td></tr>
          <tr><td style="padding:8px;border:1px solid #ddd;font-weight:bold;">国家</td><td style="padding:8px;border:1px solid #ddd;">${buyerCountry || "-"}</td></tr>
          <tr><td style="padding:8px;border:1px solid #ddd;font-weight:bold;">意向</td><td style="padding:8px;border:1px solid #ddd;">${intent || "inquiry"}</td></tr>
          <tr><td style="padding:8px;border:1px solid #ddd;font-weight:bold;">留言</td><td style="padding:8px;border:1px solid #ddd;">${message || "-"}</td></tr>
          <tr><td style="padding:8px;border:1px solid #ddd;font-weight:bold;">数据库ID</td><td style="padding:8px;border:1px solid #ddd;">${inquiryRecord?.id || "未写入"}</td></tr>
        </table>
      `;
      try {
        await sendEmail({ to: ADMIN_EMAIL, subject, html, text: subject });
      } catch (e) {
        console.error("[Expo BoothInquiry Email Error]", e);
      }

      return NextResponse.json({ success: true, id: inquiryRecord?.id });
    }

    // === 展品询盘（来自展厅详情页）===
    if (type === "item_inquiry") {
      const { showcaseItemId, buyerName, buyerPhone, buyerEmail, country: buyerCountry, message: buyerMessage } = body;
      if (!buyerName || !buyerPhone) {
        return NextResponse.json(
          { success: false, error: "Missing required fields: buyerName, buyerPhone" },
          { status: 400 }
        );
      }

      // 获取展品和展位信息
      let boothId: string | null = null;
      let merchantId: string | null = null;
      let itemInfo = "";
      try {
        const item = await prisma.showcaseItem.findUnique({
          where: { id: showcaseItemId },
          include: { booth: true },
        });
        if (item) {
          boothId = item.boothId;
          merchantId = item.booth?.merchantId || null;
          itemInfo = `${item.brand || ""} ${item.model || ""}`.trim() || item.deviceType;
          // Increment inquiry count
          await prisma.showcaseItem.update({
            where: { id: showcaseItemId },
            data: { inquiryCount: { increment: 1 } },
          });
        }
      } catch (e) {
        console.error("[Expo ItemInquiry] Failed to lookup item:", e);
      }

      // 写入 ExpoInquiry 表
      let inquiryRecord = null;
      try {
        inquiryRecord = await prisma.expoInquiry.create({
          data: {
            showcaseItemId: showcaseItemId || null,
            boothId,
            merchantId,
            buyerId: null,
            buyerName,
            buyerPhone,
            buyerEmail: buyerEmail || null,
            buyerCountry: buyerCountry || null,
            message: buyerMessage || `Inquiry about ${itemInfo}`,
            intent: "inquiry",
            status: "new",
          },
        });
      } catch (dbErr) {
        console.error("[Expo ItemInquiry DB Error]", dbErr);
      }

      // 发邮件
      const subject = `[展会询盘] ${buyerName} - ${itemInfo}`;
      const html = `
        <h2>农机博览会 - 展品询盘</h2>
        <table style="border-collapse:collapse;width:100%;font-size:14px;">
          <tr><td style="padding:8px;border:1px solid #ddd;font-weight:bold;">展品</td><td style="padding:8px;border:1px solid #ddd;">${itemInfo}</td></tr>
          <tr><td style="padding:8px;border:1px solid #ddd;font-weight:bold;">买家姓名</td><td style="padding:8px;border:1px solid #ddd;">${buyerName}</td></tr>
          <tr><td style="padding:8px;border:1px solid #ddd;font-weight:bold;">电话/WhatsApp</td><td style="padding:8px;border:1px solid #ddd;">${buyerPhone}</td></tr>
          <tr><td style="padding:8px;border:1px solid #ddd;font-weight:bold;">邮箱</td><td style="padding:8px;border:1px solid #ddd;">${buyerEmail || "-"}</td></tr>
          <tr><td style="padding:8px;border:1px solid #ddd;font-weight:bold;">国家</td><td style="padding:8px;border:1px solid #ddd;">${buyerCountry || "-"}</td></tr>
          <tr><td style="padding:8px;border:1px solid #ddd;font-weight:bold;">留言</td><td style="padding:8px;border:1px solid #ddd;">${buyerMessage || "-"}</td></tr>
          <tr><td style="padding:8px;border:1px solid #ddd;font-weight:bold;">数据库ID</td><td style="padding:8px;border:1px solid #ddd;">${inquiryRecord?.id || "未写入"}</td></tr>
        </table>
      `;
      try {
        await sendEmail({ to: ADMIN_EMAIL, subject, html, text: subject });
      } catch (e) {
        console.error("[Expo ItemInquiry Email Error]", e);
      }

      return NextResponse.json({ success: true, id: inquiryRecord?.id });
    }

    // === 招商意向（来自落地页表单）===
    if (!contact || !phone || !country) {
      return NextResponse.json(
        { success: false, error: "Missing required fields: contact, phone, country" },
        { status: 400 }
      );
    }

    // 1. 写入数据库
    let dbRecord = null;
    try {
      dbRecord = await prisma.expoRegistration.create({
        data: {
          name: contact,
          phone: phone,
          email: email || null,
          company: company || null,
          country: country,
          category: category || null,
          boothType: boothType || null,
          message: message || null,
          source: "website",
          expoType: "virtual",
          locale: locale || null,
          status: "pending",
        },
      });
    } catch (dbError) {
      console.error("[Expo Inquiry DB Error]", dbError);
      // DB 写入失败不阻断流程，继续发邮件
    }

    // 2. 构建邮件内容
    const subject = `[农机博览会招商] ${company || contact} - ${contact}`;
    const html = `
      <h2>农机博览会招商意向表</h2>
      <table style="border-collapse:collapse;width:100%;font-size:14px;">
        <tr><td style="padding:8px;border:1px solid #ddd;font-weight:bold;">公司名称</td><td style="padding:8px;border:1px solid #ddd;">${company || "-"}</td></tr>
        <tr><td style="padding:8px;border:1px solid #ddd;font-weight:bold;">联系人</td><td style="padding:8px;border:1px solid #ddd;">${contact}</td></tr>
        <tr><td style="padding:8px;border:1px solid #ddd;font-weight:bold;">手机号</td><td style="padding:8px;border:1px solid #ddd;">${phone}</td></tr>
        <tr><td style="padding:8px;border:1px solid #ddd;font-weight:bold;">邮箱</td><td style="padding:8px;border:1px solid #ddd;">${email || "-"}</td></tr>
        <tr><td style="padding:8px;border:1px solid #ddd;font-weight:bold;">国家/地区</td><td style="padding:8px;border:1px solid #ddd;">${country}</td></tr>
        <tr><td style="padding:8px;border:1px solid #ddd;font-weight:bold;">主营品类</td><td style="padding:8px;border:1px solid #ddd;">${category || "-"}</td></tr>
        <tr><td style="padding:8px;border:1px solid #ddd;font-weight:bold;">意向展位</td><td style="padding:8px;border:1px solid #ddd;">${boothType || "-"}</td></tr>
        <tr><td style="padding:8px;border:1px solid #ddd;font-weight:bold;">留言</td><td style="padding:8px;border:1px solid #ddd;">${message || "-"}</td></tr>
        <tr><td style="padding:8px;border:1px solid #ddd;font-weight:bold;">语言</td><td style="padding:8px;border:1px solid #ddd;">${locale || "-"}</td></tr>
        <tr><td style="padding:8px;border:1px solid #ddd;font-weight:bold;">数据库ID</td><td style="padding:8px;border:1px solid #ddd;">${dbRecord?.id || "未写入"}</td></tr>
        <tr><td style="padding:8px;border:1px solid #ddd;font-weight:bold;">提交时间</td><td style="padding:8px;border:1px solid #ddd;">${new Date().toISOString()}</td></tr>
      </table>
      <p style="margin-top:16px;color:#666;font-size:12px;">此邮件由 usedfarmmach.com 农机博览会页面自动发送</p>
    `;
    const text = `农机博览会招商意向\n公司: ${company || "-"}\n联系人: ${contact}\n电话: ${phone}\n邮箱: ${email || "-"}\n国家: ${country}\n品类: ${category || "-"}\n展位: ${boothType || "-"}\n留言: ${message || "-"}\nDB ID: ${dbRecord?.id || "N/A"}`;

    // 发送邮件
    await sendEmail({ to: ADMIN_EMAIL, subject, html, text });

    // 日志
    console.log("[Expo Inquiry]", JSON.stringify({ dbId: dbRecord?.id, company, contact, phone, country, time: new Date().toISOString() }));

    return NextResponse.json({ success: true, id: dbRecord?.id });
  } catch (error) {
    console.error("[Expo Inquiry Error]", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/expo/inquiry
 * 管理员查看所有招商意向（需admin权限）
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");
    const limit = parseInt(searchParams.get("limit") || "50");
    const offset = parseInt(searchParams.get("offset") || "0");

    const where = status ? { status } : {};
    const records = await prisma.expoRegistration.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: limit,
      skip: offset,
    });

    const total = await prisma.expoRegistration.count({ where });

    return NextResponse.json({ success: true, data: records, total });
  } catch (error) {
    console.error("[Expo Inquiry GET Error]", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
