/**
 * Resend 收信转发执行体 —— 含 Resend 端点与出网代码
 *
 * ⚠️ 数据不出境（D3）：本文件在 `.cn` 构建时被 next.config.js 的
 * `NormalModuleReplacementPlugin` **结构性替换**为 `inbound-forwarder.disabled.ts`，
 * 使 `.cn` 产物里物理上不存在 api.resend.com 与任何出网代码。
 * 这与既有 `provider-resend` 的处理方式一致 —— 不依赖 Terser 死代码消除，
 * 因为 webpack 在优化前就建好 async chunk 图（2026-11-20 实测踩过）。
 *
 * 链路与取舍见 src/lib/email/inbound.ts 头注释。
 */
import {
  buildForwardBanner,
  buildForwardSubject,
  buildPlainFallback,
  buildRoutingMap,
  buildWecomNotice,
  escapeHtml,
  extractAddress,
  isOwnAddress,
  isSelfDelivery,
  pickReplyTo,
  resolveGroupTarget,
  verifySvixSignature,
  type InboundResult,
} from "@/lib/email/inbound";
import { pushToGroup } from "@/lib/wecom/group-webhook";

const RESEND_API = "https://api.resend.com";
const TAG = "[resend-inbound]";

/** 附件总量预算：Vercel 函数内存与响应耗时都要留余量，超出的附件跳过并在横幅里说明 */
const MAX_SINGLE_ATTACHMENT_BYTES = 10 * 1024 * 1024;
const MAX_TOTAL_ATTACHMENT_BYTES = 18 * 1024 * 1024;

interface ReceivedEmailContent {
  subject?: string | null;
  html?: string | null;
  text?: string | null;
  from?: string;
  /**
   * 原始邮件头（Resend `GET /emails/receiving/{id}` 返回，键名大小写不统一）。
   * 只用来取 `Reply-To`，其余一概不用。
   */
  headers?: Record<string, string> | null;
  attachments?: Array<{
    id?: string;
    filename?: string | null;
    content_type?: string | null;
    size?: number;
  }> | null;
}

/** Resend 对非 2xx 会重投，正常跳过路径必须也返回 200 */
function ok(body: Record<string, unknown>): InboundResult {
  return { status: 200, body: { received: true, ...body } };
}

function fail(status: number, body: Record<string, unknown>): InboundResult {
  return { status, body: { received: false, ...body } };
}

function authHeaders(apiKey: string): Record<string, string> {
  return {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
  };
}

async function resendGet(
  apiKey: string,
  path: string
): Promise<Record<string, any> | null> {
  const res = await fetch(`${RESEND_API}${path}`, {
    headers: authHeaders(apiKey),
    cache: "no-store",
  });
  if (!res.ok) {
    // eslint-disable-next-line no-console
    console.error(`${TAG} GET ${path} failed:`, res.status, await res.text());
    return null;
  }
  return (await res.json()) as Record<string, any>;
}

async function collectAttachments(
  apiKey: string,
  emailId: string,
  list: ReceivedEmailContent["attachments"]
): Promise<{ files: Array<Record<string, unknown>>; skipped: string[] }> {
  const files: Array<Record<string, unknown>> = [];
  const skipped: string[] = [];
  let total = 0;

  for (const att of list ?? []) {
    if (!att?.id) continue;
    const name = att.filename || "attachment";
    const size = typeof att.size === "number" ? att.size : 0;

    if (size > MAX_SINGLE_ATTACHMENT_BYTES) {
      skipped.push(`${name}（超过 10MB）`);
      continue;
    }

    const meta = await resendGet(
      apiKey,
      `/emails/receiving/${emailId}/attachments/${att.id}`
    );
    const downloadUrl = meta?.download_url as string | undefined;
    if (!downloadUrl) {
      skipped.push(`${name}（取下载地址失败）`);
      continue;
    }

    try {
      const res = await fetch(downloadUrl, { cache: "no-store" });
      if (!res.ok) {
        skipped.push(`${name}（下载失败 ${res.status}）`);
        continue;
      }
      const buf = Buffer.from(await res.arrayBuffer());
      if (buf.byteLength > MAX_SINGLE_ATTACHMENT_BYTES) {
        skipped.push(`${name}（超过 10MB）`);
        continue;
      }
      if (total + buf.byteLength > MAX_TOTAL_ATTACHMENT_BYTES) {
        skipped.push(`${name}（附件总量超 18MB）`);
        continue;
      }
      total += buf.byteLength;
      files.push({
        filename: name,
        content: buf.toString("base64"),
        content_type: att.content_type || undefined,
      });
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error(`${TAG} attachment ${name} failed:`, err);
      skipped.push(`${name}（下载异常）`);
    }
  }

  return { files, skipped };
}

/**
 * 处理一次 Resend 收信 webhook。
 * 返回结构化结果，HTTP 状态由 route.ts 施加（便于 .cn 用 disabled 实现替换）。
 */
export async function handleInboundEmail(req: Request): Promise<InboundResult> {
  const apiKey = process.env.RESEND_API_KEY;
  const webhookSecret = process.env.RESEND_WEBHOOK_SECRET;

  // 本地：缺配置时安全跳过，返回 200 避免 Resend 反复重投
  if (!apiKey || !webhookSecret) {
    // eslint-disable-next-line no-console
    console.warn(
      `${TAG} skipped: RESEND_API_KEY=${apiKey ? "set" : "missing"}, RESEND_WEBHOOK_SECRET=${webhookSecret ? "set" : "missing"}`
    );
    return ok({ skipped: "not-configured" });
  }

  const payload = await req.text();

  const verdict = verifySvixSignature({
    payload,
    headers: {
      id: req.headers.get("svix-id"),
      timestamp: req.headers.get("svix-timestamp"),
      signature: req.headers.get("svix-signature"),
    },
    secret: webhookSecret,
  });
  if (!verdict.ok) {
    // eslint-disable-next-line no-console
    console.warn(`${TAG} signature rejected:`, verdict.reason);
    return fail(400, { error: "invalid signature" });
  }

  let event: any;
  try {
    event = JSON.parse(payload);
  } catch {
    return fail(400, { error: "invalid json" });
  }

  if (event?.type !== "email.received") {
    return ok({ ignored: event?.type ?? "unknown" });
  }

  const data = event.data ?? {};
  const emailId = typeof data.email_id === "string" ? data.email_id : "";
  const toList: string[] = Array.isArray(data.to) ? data.to : [];
  const originalFrom = data.from ?? null;

  if (!emailId) return ok({ skipped: "no-email-id" });

  const target = resolveGroupTarget(toList, buildRoutingMap());
  if (!target) return ok({ skipped: "no-route", to: toList });

  // 回路保险：发件人是自有域名 → 多半是我们自己人回复/系统信，转了会自激
  // ⚠️ 但「自投递」（From == To）必须放行：网站联系表单通知就是这种形态
  //    （From=To=support@usedfarmmach.com），一律按自有域拦掉会让客户询价
  //    永远到不了团队邮箱 —— 2026-11-21 实测踩过，勿简化回单条件。
  const senderAddr = extractAddress(originalFrom);
  if (isOwnAddress(senderAddr) && !isSelfDelivery(senderAddr, toList)) {
    return ok({ skipped: "own-domain", from: senderAddr });
  }

  const email = (await resendGet(
    apiKey,
    `/emails/receiving/${emailId}`
  )) as ReceivedEmailContent | null;
  if (!email) {
    // 取不到正文：返回 500 让 Resend 重投（丢客户来信比重复更糟）
    return fail(500, { error: "fetch-content-failed" });
  }

  const { files, skipped } = await collectAttachments(
    apiKey,
    emailId,
    email.attachments
  );

  const subject = buildForwardSubject(
    email.subject ?? data.subject,
    target.inboxAddress
  );
  const attachmentNote =
    files.length > 0
      ? `${files.length} 个已随信附上${skipped.length ? `，另有 ${skipped.length} 个未能转发：${skipped.join("、")}` : ""}`
      : skipped.length > 0
        ? `全部未能转发：${skipped.join("、")}`
        : "";

  const banner = buildForwardBanner({
    originalFrom,
    originalTo: toList,
    receivedAt: new Date().toISOString().replace("T", " ").slice(0, 19) + " UTC",
    attachmentNote,
  });

  const html =
    banner + (email.html || `<pre>${escapeHtml(email.text || "")}</pre>`);
  const text = buildPlainFallback({
    originalFrom,
    originalTo: toList,
    text: email.text ?? null,
  });

  // Reply-To 优先用原信的 Reply-To（表单通知里是访客邮箱），退化才用发件人。
  const replyToAddr = pickReplyTo(email.headers) ?? senderAddr ?? undefined;

  const sendRes = await fetch(`${RESEND_API}/emails`, {
    method: "POST",
    headers: authHeaders(apiKey),
    body: JSON.stringify({
      from: `神雕农机 <${target.inboxAddress}>`,
      to: [target.groupAddress],
      reply_to: replyToAddr,
      subject,
      html,
      text,
      attachments: files.length > 0 ? files : undefined,
    }),
  });

  if (!sendRes.ok) {
    const body = await sendRes.text();
    // eslint-disable-next-line no-console
    console.error(`${TAG} forward failed:`, sendRes.status, body);
    // 500 让 Resend 重投
    return fail(500, { error: "forward-failed", status: sendRes.status });
  }

  const sent = (await sendRes.json()) as { id?: string };

  // 群通知失败不影响邮件转发主链路（pushToGroup 内部已 try/catch）
  await pushToGroup(
    buildWecomNotice({
      inboxAddress: target.inboxAddress,
      groupAddress: target.groupAddress,
      originalFrom: senderAddr ?? originalFrom,
      subject: email.subject ?? data.subject ?? null,
      attachmentCount: files.length,
    })
  );

  // eslint-disable-next-line no-console
  console.log(
    `${TAG} forwarded ${emailId} ${target.inboxAddress} -> ${target.groupAddress} (resend id ${sent.id ?? "?"}, attachments ${files.length}, skipped ${skipped.length})`
  );

  return ok({
    forwarded: true,
    from: target.inboxAddress,
    to: target.groupAddress,
    attachments: files.length,
    skippedAttachments: skipped.length,
  });
}
