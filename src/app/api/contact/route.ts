/**
 * 「联系我们」通用表单 API
 *
 * POST /api/contact
 *
 * 为什么单独开一条，不复用 `/api/inquiries`：
 * 那条是**产品询盘**专用 —— 入参必须带 `productId`，还要校验产品存在、扣用户积分。
 * 联系表单没有产品锚点，走那条会把「没登录 / 没积分」的访客挡在门外，正好丢了最该接的线索。
 *
 * 背景（2026-11-21）：站内原先根本没有联系页（`/en/contact` 一直 404），访客想找人
 * 只能点邮箱；而邮箱依赖访客本机装了邮件客户端，实测大量 Windows 用户没有（本机
 * `mailto` 关联甚至指向一个已卸载的 AppX 应用）。所以补一条不依赖任何客户端的通路。
 *
 * 落点按主题分流，`.cn` 未开通的地址由 getter 自动回退 `support@usedfarmmach.cn`，
 * 绝不产生「发出去没人收」的死信箱。
 */

import { NextRequest, NextResponse } from "next/server";
import { sendEmail } from "@/lib/email";
import { rateLimit } from "@/lib/rate-limit";
import {
  getMarketingEmail,
  getSalesEmail,
  getSupportEmail,
} from "@/config/support-email";

// .cn 走 standalone 构建：不写这条，POST 路由不会被当成动态路由之外的静态产物无关，
// 但保留此声明与既有 API 路由保持一致，避免构建期静态固化的心智负担。
export const dynamic = "force-dynamic";

const TOPICS = ["sales", "support", "partner", "other"] as const;
type Topic = (typeof TOPICS)[number];

const TOPIC_LABEL: Record<Topic, string> = {
  sales: "购机 / 配件询价",
  support: "售后 / 账号支持",
  partner: "商务合作 / 媒体",
  other: "其他",
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const MAX_MESSAGE = 4000;

/** HTML 转义 —— 表单内容是陌生人输入，直接拼进正文邮件等于把 XSS 递到团队邮箱里。 */
function esc(v: unknown, max = 200): string {
  return String(v ?? "")
    .slice(0, max)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * 主题 → 收件人。
 *
 * `other` 走 `support@` 兜底（2026-11-21 老板拍板改）：它原先和 `sales` 同落销售箱，
 * 对内部零分流价值，等于一个没人认领的垃圾桶；改投售后以后，客服是唯一「什么都接」
 * 的岗位，看不属于自己的一律转出去，比躺在销售箱里没人管强。
 */
function recipientFor(topic: Topic): string {
  if (topic === "support" || topic === "other") return getSupportEmail();
  if (topic === "partner") return getMarketingEmail();
  return getSalesEmail();
}

export async function POST(request: NextRequest) {
  try {
    const raw = (await request.json().catch(() => null)) as Record<string, unknown> | null;
    if (!raw || typeof raw !== "object") {
      return NextResponse.json({ success: false, error: "Invalid body" }, { status: 400 });
    }

    // 蜜罐字段：真人看不见，填了就是机器人。静默返回成功，不给爬虫试错信号。
    if (typeof raw.website === "string" && raw.website.trim() !== "") {
      return NextResponse.json({ success: true });
    }

    const name = String(raw.name ?? "").trim();
    const email = String(raw.email ?? "").trim();
    const phone = String(raw.phone ?? "").trim();
    const company = String(raw.company ?? "").trim();
    const message = String(raw.message ?? "").trim();
    const topicRaw = String(raw.topic ?? "");
    const topic: Topic = (TOPICS as readonly string[]).includes(topicRaw)
      ? (topicRaw as Topic)
      : "other";

    if (!name || !email || !message) {
      return NextResponse.json(
        { success: false, error: "Name, email and message are required" },
        { status: 400 }
      );
    }
    if (!EMAIL_RE.test(email)) {
      return NextResponse.json({ success: false, error: "Invalid email" }, { status: 400 });
    }
    if (message.length > MAX_MESSAGE) {
      return NextResponse.json({ success: false, error: "Message too long" }, { status: 400 });
    }

    // 限流：同 IP 每小时 5 次。联系表单是最容易被拿来灌垃圾邮件的入口，
    // 而 Resend 免费档只有 100 封/天，一封垃圾就吃掉 1% 额度。
    const ip =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      request.headers.get("x-real-ip") ||
      "unknown";
    const rl = await rateLimit({ key: `rl:contact:ip:${ip}`, windowSec: 3600, max: 5 });
    if (!rl.allowed) {
      return NextResponse.json(
        { success: false, error: "Too many requests", retryAfterSec: rl.retryAfterSec },
        { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } }
      );
    }

    const to = recipientFor(topic);

    const rows: Array<[string, string]> = [
      ["主题", TOPIC_LABEL[topic]],
      ["姓名", esc(name)],
      ["邮箱", esc(email)],
      ["电话", esc(phone) || "—"],
      ["公司", esc(company) || "—"],
      ["来源页", esc(request.headers.get("referer") || "—", 300)],
    ];

    const html = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 620px; margin: 0 auto;">
        <h2 style="color: #1d4ed8; margin: 0 0 4px;">收到一条网站联系表单</h2>
        <p style="color: #6b7280; font-size: 13px; margin: 0 0 18px;">
          直接点「回复」即可回到访客邮箱 ${esc(email)}。
        </p>
        <table style="width: 100%; border-collapse: collapse;">
          ${rows
            .map(
              ([k, v]) =>
                `<tr><td style="padding: 8px; background: #eff6ff; font-weight: 600; width: 110px; border: 1px solid #dbeafe;">${k}</td>` +
                `<td style="padding: 8px; border: 1px solid #dbeafe;">${v}</td></tr>`
            )
            .join("")}
        </table>
        <h3 style="margin: 20px 0 8px; font-size: 15px;">留言内容</h3>
        <div style="padding: 12px; background: #f9fafb; border-left: 3px solid #1d4ed8; white-space: pre-wrap; line-height: 1.7;">${esc(
          message,
          MAX_MESSAGE
        )}</div>
        <p style="color: #9ca3af; font-size: 12px; margin-top: 22px;">
          UsedFarmMach · ${esc(to)}
        </p>
      </div>
    `.trim();

    const text = [
      `主题: ${TOPIC_LABEL[topic]}`,
      `姓名: ${name}`,
      `邮箱: ${email}`,
      phone ? `电话: ${phone}` : null,
      company ? `公司: ${company}` : null,
      "",
      "留言内容:",
      message,
    ]
      .filter((x) => x !== null)
      .join("\n");

    const sent = await sendEmail({
      to,
      subject: `[网站联系表单·${TOPIC_LABEL[topic]}] ${name}`,
      html,
      text,
      // 关键：回复直接落到访客，团队不用手工复制地址
      replyTo: email,
    });

    if (!sent) {
      return NextResponse.json(
        { success: false, error: "Failed to send" },
        { status: 502 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[contact] API error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to submit" },
      { status: 500 }
    );
  }
}
