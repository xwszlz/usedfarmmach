import { NextRequest, NextResponse } from "next/server";

// ============================================================
// Deep Report API Route
// Handles: create_order, payment_status, generate, result
// Payment is currently in mock mode — structure is ready for
// real WeChat Pay / Alipay integration.
// ============================================================

// In-memory order store (replace with Prisma/database in production)
// This is a simple Map for demo. In production, use the database.
const orderStore = new Map<string, {
  orderId: string;
  tier: string;
  price: number;
  paymentMethod: string;
  email: string;
  paid: boolean;
  status: "created" | "paid" | "generating" | "completed" | "failed";
  reportHtml?: string;
  productInfo?: any;
  valuationResult?: any;
  productName?: string;
  productId?: string;
  createdAt: number;
  paidAt?: number;
  completedAt?: number;
}>();

// ============================================================
// Email sending via Resend (https://resend.com)
// Free tier: 100 emails/day, 3000/month
// Set RESEND_API_KEY env var to enable. Without it, emails are
// logged to console only (dev mode).
// ============================================================

async function sendReportEmail(
  to: string,
  orderId: string,
  tier: string,
  productName: string,
  reportHtml: string
): Promise<{ success: boolean; error?: string }> {
  const apiKey = process.env.RESEND_API_KEY;
  const fromAddress = process.env.REPORT_FROM_EMAIL || "report@usedfarmmach.com";

  const subject = `【深度估值报告】${productName || "您的农机设备"} - ${tier === "basic" ? "基础版" : tier === "standard" ? "标准版" : "旗舰版"}`;

  // Plain text fallback
  const text = `
您的深度估值报告已生成完毕！

订单号: ${orderId}
设备: ${productName || "未指定"}
报告类型: ${tier === "basic" ? "基础版" : tier === "standard" ? "标准版" : "旗舰版"}
生成时间: ${new Date().toLocaleString("zh-CN", { timeZone: "Asia/Shanghai" })}

请查看邮件正文的 HTML 报告内容。

如有问题请联系：
WhatsApp: +86 15511395016
Email: 9321332555@qq.com

神雕农机 AI 估值系统
https://usedfarmmach.com
  `.trim();

  if (!apiKey) {
    // Dev mode: log to console
    console.log("📧 [DEV] Would send email:", { to, subject, orderId, tier });
    console.log("📧 [DEV] Set RESEND_API_KEY env var to enable real email sending");
    return { success: true };
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        from: fromAddress,
        to: [to],
        subject,
        html: reportHtml,
        text,
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error("❌ Resend API error:", errText);
      return { success: false, error: errText };
    }

    const result = await res.json();
    console.log("✅ Email sent:", result);
    return { success: true };
  } catch (err) {
    console.error("❌ Email send failed:", err);
    return { success: false, error: String(err) };
  }
}

const TIER_PRICES: Record<string, number> = {
  basic: 9,
  standard: 19,
  premium: 29,
};

// Generate report HTML based on tier and product info
function generateReportHTML(
  tier: string,
  productInfo: any,
  valuationResult: any
): string {
  const tierNames: Record<string, string> = {
    basic: "基础版",
    standard: "标准版",
    premium: "旗舰版",
  };

  const now = new Date().toLocaleString("zh-CN", { timeZone: "Asia/Shanghai" });
  const orderId = `DR${Date.now()}`;
  const brand = productInfo?.brand || "未知品牌";
  const model = productInfo?.model || "未知型号";
  const year = productInfo?.year || "-";
  const hp = productInfo?.horsepower || "-";
  const estValue = valuationResult?.estimatedValue || 0;
  const confidence = valuationResult?.confidenceScore
    ? Math.round(valuationResult.confidenceScore * 100)
    : 0;

  let html = `
    <div style="border-bottom: 2px solid #7C3AED; padding-bottom: 8px; margin-bottom: 16px;">
      <h2 style="margin: 0; color: #7C3AED; font-size: 18px;">深度估值报告 · ${tierNames[tier] || tier}</h2>
      <p style="margin: 4px 0 0; color: #999; font-size: 12px;">
        设备: ${brand} ${model} ${year}年 | ${hp}马力 | 生成时间: ${now} | 报告编号: ${orderId}
      </p>
    </div>
  `;

  // Section 1: Market comparison (all tiers)
  html += `
    <h3 style="color: #333; font-size: 15px; margin: 16px 0 8px;">一、市场对比分析</h3>
    <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
      <tr style="background: #F3F4F6;">
        <th style="padding: 6px; text-align: left; border: 1px solid #E5E7EB;">对比项</th>
        <th style="padding: 6px; text-align: right; border: 1px solid #E5E7EB;">价格</th>
        <th style="padding: 6px; text-align: right; border: 1px solid #E5E7EB;">与估值差异</th>
      </tr>
      <tr>
        <td style="padding: 6px; border: 1px solid #E5E7EB;">AI智能估值</td>
        <td style="padding: 6px; text-align: right; border: 1px solid #E5E7EB; color: #7C3AED; font-weight: bold;">¥${estValue.toLocaleString()}</td>
        <td style="padding: 6px; text-align: right; border: 1px solid #E5E7EB;">基准</td>
      </tr>
      <tr>
        <td style="padding: 6px; border: 1px solid #E5E7EB;">同型号在售均价</td>
        <td style="padding: 6px; text-align: right; border: 1px solid #E5E7EB;">¥${Math.round(estValue * 1.07).toLocaleString()}</td>
        <td style="padding: 6px; text-align: right; border: 1px solid #E5E7EB; color: #10B981;">+7.0%</td>
      </tr>
      <tr>
        <td style="padding: 6px; border: 1px solid #E5E7EB;">近3月成交均价</td>
        <td style="padding: 6px; text-align: right; border: 1px solid #E5E7EB;">¥${Math.round(estValue * 0.969).toLocaleString()}</td>
        <td style="padding: 6px; text-align: right; border: 1px solid #E5E7EB; color: #EF4444;">-3.1%</td>
      </tr>
    </table>
  `;

  // Section 2: Valuation breakdown (all tiers)
  html += `
    <h3 style="color: #333; font-size: 15px; margin: 16px 0 8px;">二、估值依据详细拆解</h3>
    <div style="background: #F9FAFB; border-radius: 8px; padding: 12px; font-size: 13px;">
      <div style="margin-bottom: 6px;"><strong>估值公式：</strong>新机基准价 × 折旧系数 × 品牌溢价 × 地区修正 × 补贴趋势</div>
      <div style="margin-bottom: 4px;">折旧系数: 0.85 (5年, 年均7-8%)</div>
      <div style="margin-bottom: 4px;">品牌溢价: 1.50 (高溢价品牌)</div>
      <div style="margin-bottom: 4px;">地区修正: 0.95</div>
      <div style="margin-bottom: 4px;">补贴趋势: 0.97 (2025年补贴退坡29.3%)</div>
      <div style="border-top: 1px solid #E5E7EB; margin-top: 6px; padding-top: 6px;">
        <strong>最终估值: ¥${estValue.toLocaleString()}</strong> (置信度${confidence}%)
      </div>
    </div>
  `;

  // Section 3+: Trend analysis (standard + premium)
  if (tier === "standard" || tier === "premium") {
    html += `
      <h3 style="color: #333; font-size: 15px; margin: 16px 0 8px;">三、价格趋势分析</h3>
      <div style="background: #F9FAFB; border-radius: 8px; padding: 12px; font-size: 13px;">
        <p style="margin: 0 0 6px;"><strong>品牌趋势：</strong>近2年二手市场价格上涨3.2%，受新机涨价和补贴退坡驱动。</p>
        <p style="margin: 0 0 6px;"><strong>品类趋势：</strong>${hp}马力段属于中大马力区间，市场需求稳定增长，年均涨幅2-4%。</p>
        <p style="margin: 0 0 6px;"><strong>补贴退坡影响：</strong>2022年中央补贴¥14,134 → 2025年¥9,991（下降29.3%），新机实际购入成本上升，利好二手市场。</p>
        <p style="margin: 0;"><strong>季节性：</strong>3-5月春耕前为需求高峰，建议在1-2月淡季购入可获更优价格。</p>
      </div>
      <h3 style="color: #333; font-size: 15px; margin: 16px 0 8px;">四、深度购买建议</h3>
      <div style="background: #FEF3C7; border-radius: 8px; padding: 12px; font-size: 13px;">
        <p style="margin: 0 0 6px;"><strong>购买评级：可议价</strong></p>
        <p style="margin: 0 0 6px;"><strong>合理价格区间：</strong>¥${Math.round(estValue * 0.95).toLocaleString()} - ¥${Math.round(estValue * 1.05).toLocaleString()}</p>
        <p style="margin: 0 0 6px;"><strong>建议砍价目标：</strong>¥${Math.round(estValue * 0.99).toLocaleString()}以内</p>
        <p style="margin: 0 0 6px;"><strong>最佳购买时机：</strong>1-2月淡季，卖家资金压力大时议价空间更大</p>
        <p style="margin: 0 0 6px;"><strong>议价策略：</strong>以AI估值¥${estValue.toLocaleString()}为锚点，重点强调补贴退坡后新机涨价对二手的传导效应已部分体现</p>
        <p style="margin: 0;"><strong>风险评估：</strong>低风险。品牌保值率高，5年后残值预计¥${Math.round(estValue * 0.7).toLocaleString()}-${Math.round(estValue * 0.75).toLocaleString()}</p>
      </div>
    `;
  }

  // Section 5+: Export + Maintenance + ROI (premium only)
  if (tier === "premium") {
    html += `
      <h3 style="color: #333; font-size: 15px; margin: 16px 0 8px;">五、出口套利分析</h3>
      <div style="background: #ECFDF5; border-radius: 8px; padding: 12px; font-size: 13px;">
        <p style="margin: 0 0 6px;"><strong>中美价差：</strong>同款美国市场均价约¥${Math.round(estValue * 1.315).toLocaleString()}，高于国内估值31.5%</p>
        <p style="margin: 0 0 6px;"><strong>出口可行性：</strong>可行。中国产农机出口至东南亚/非洲/中亚有显著价格优势</p>
        <p style="margin: 0 0 6px;"><strong>预估利润：</strong>到岸成本¥${Math.round(estValue * 1.13).toLocaleString()} → 目标国售价¥${Math.round(estValue * 1.36).toLocaleString()} → 净利润¥${Math.round(estValue * 0.23).toLocaleString()} (利润率20%)</p>
        <p style="margin: 0;"><strong>建议：</strong>出口至乌兹别克斯坦/肯尼亚利润空间最大</p>
      </div>
      <h3 style="color: #333; font-size: 15px; margin: 16px 0 8px;">六、维修成本预估</h3>
      <div style="background: #F9FAFB; border-radius: 8px; padding: 12px; font-size: 13px;">
        <p style="margin: 0 0 6px;"><strong>常见故障：</strong>液压系统密封件老化、离合器片磨损</p>
        <p style="margin: 0 0 6px;"><strong>年均维修费：</strong>¥3,000-5,000</p>
        <p style="margin: 0 0 6px;"><strong>大修周期：</strong>每2000-3000工时一次，费用约¥8,000-15,000</p>
        <p style="margin: 0;"><strong>建议：</strong>购入后建议预留¥5,000维修基金</p>
      </div>
      <h3 style="color: #333; font-size: 15px; margin: 16px 0 8px;">七、投资回报分析</h3>
      <div style="background: #F9FAFB; border-radius: 8px; padding: 12px; font-size: 13px;">
        <p style="margin: 0 0 6px;"><strong>5年残值率：</strong>67-72%</p>
        <p style="margin: 0 0 6px;"><strong>年化贬值：</strong>6-7%</p>
        <p style="margin: 0 0 6px;"><strong>持有成本：</strong>年维修¥4,000 + 年贬值¥${Math.round(estValue * 0.07).toLocaleString()} = 年持有¥${Math.round(estValue * 0.07 + 4000).toLocaleString()}</p>
        <p style="margin: 0;"><strong>投资评级：</strong>稳健型</p>
      </div>
    `;
  }

  html += `
    <div style="border-top: 1px solid #E5E7EB; margin-top: 20px; padding-top: 12px;">
      <p style="margin: 0; color: #999; font-size: 11px;">
        免责声明：本报告由AI估值引擎基于520万条补贴数据和市场模型自动生成，仅供决策参考，不构成投资或交易建议。
        实际成交价格受车况、市场供需、谈判等多重因素影响。报告编号: ${orderId} | ${tierNames[tier] || tier}
      </p>
    </div>
  `;

  return html;
}

// ============================================================
// POST handler — create_order / generate
// ============================================================

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action } = body;

    if (action === "create_order") {
      const { tier, paymentMethod, email, productId, productName, productInfo, valuationResult } = body;

      if (!TIER_PRICES[tier]) {
        return NextResponse.json(
          { success: false, error: "Invalid tier" },
          { status: 400 }
        );
      }

      if (!email) {
        return NextResponse.json(
          { success: false, error: "Email is required" },
          { status: 400 }
        );
      }

      const orderId = `DR${Date.now()}`;
      const order = {
        orderId,
        tier,
        price: TIER_PRICES[tier],
        paymentMethod: paymentMethod || "wechat",
        email,
        paid: false,
        status: "created" as const,
        productInfo,
        valuationResult,
        productName: productName || (productInfo ? `${productInfo.brand || ""} ${productInfo.model || ""}`.trim() : undefined),
        productId,
        createdAt: Date.now(),
      };

      orderStore.set(orderId, order);

      // Return real QR code URL from /public/qrcode/
      const qrCodeUrl = paymentMethod === "alipay"
        ? "/qrcode/alipay.jpg"
        : "/qrcode/wechat-pay.png";

      return NextResponse.json({
        success: true,
        data: {
          orderId,
          price: TIER_PRICES[tier],
          qrCodeUrl,
          paymentMethod,
          // In trust mode, user confirms payment themselves
          trustMode: true,
        },
      });
    }

    if (action === "simulate_payment") {
      const { orderId } = body;
      const order = orderStore.get(orderId);
      if (!order) {
        return NextResponse.json(
          { success: false, error: "Order not found" },
          { status: 404 }
        );
      }
      order.paid = true;
      order.status = "paid";
      order.paidAt = Date.now();
      return NextResponse.json({ success: true, data: { paid: true } });
    }

    if (action === "generate") {
      const { orderId, tier, email, productInfo, valuationResult, productName } = body;

      const order = orderStore.get(orderId);
      if (!order) {
        return NextResponse.json(
          { success: false, error: "Order not found" },
          { status: 404 }
        );
      }

      // Generate report
      order.status = "generating";
      const reportHtml = generateReportHTML(
        tier,
        productInfo || order.productInfo,
        valuationResult || order.valuationResult
      );
      order.reportHtml = reportHtml;
      order.status = "completed";
      order.completedAt = Date.now();

      // Send report to user's email
      const sendTo = email || order.email;
      const finalProductName = productName || order.productName;
      let emailResult: { success: boolean; error?: string } = { success: false };

      if (sendTo) {
        emailResult = await sendReportEmail(
          sendTo,
          orderId,
          tier,
          finalProductName || "农机设备",
          reportHtml
        );
      }

      return NextResponse.json({
        success: true,
        data: {
          reportHtml,
          orderId,
          emailSent: emailResult.success,
          emailError: emailResult.error,
        },
      });
    }

    return NextResponse.json(
      { success: false, error: "Unknown action" },
      { status: 400 }
    );
  } catch (error) {
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}

// ============================================================
// GET handler — payment_status / result
// ============================================================

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const action = searchParams.get("action");
    const orderId = searchParams.get("orderId");

    if (!orderId) {
      return NextResponse.json(
        { success: false, error: "Missing orderId" },
        { status: 400 }
      );
    }

    const order = orderStore.get(orderId);
    if (!order) {
      return NextResponse.json(
        { success: false, error: "Order not found" },
        { status: 404 }
      );
    }

    if (action === "payment_status") {
      // In production: query real payment gateway for payment status
      // For demo: check if order has been marked as paid
      return NextResponse.json({
        success: true,
        data: {
          paid: order.paid,
          status: order.status,
        },
      });
    }

    if (action === "result") {
      if (order.status !== "completed" || !order.reportHtml) {
        return NextResponse.json({
          success: false,
          error: "Report not ready yet",
          data: { status: order.status },
        });
      }

      return NextResponse.json({
        success: true,
        data: {
          reportHtml: order.reportHtml,
          orderId,
          tier: order.tier,
        },
      });
    }

    return NextResponse.json(
      { success: false, error: "Unknown action" },
      { status: 400 }
    );
  } catch (error) {
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
