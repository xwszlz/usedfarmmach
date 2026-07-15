// ───────────────────────────────────────────────
// 微信客服「接收消息」回调
//  GET  : 验证回调 URL（解密 echostr 返回明文）
//  POST : 接收用户消息 → 先回 success（5秒内）→ 异步调 AI 大脑 → 发客服消息 + 推监控群
// ───────────────────────────────────────────────
import { WXBizMsgCrypt } from "@/lib/wecom/crypto";
import { sendKfTextMessage } from "@/lib/wecom/kf";
import { pushToGroup } from "@/lib/wecom/group-webhook";
import { buyerChatAgent } from "@/lib/agents/buyer-chat/agent";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TOKEN = process.env.WECOM_KF_TOKEN || "";
const AES_KEY = process.env.WECOM_KF_AES_KEY || "";
const CORP_ID = process.env.WECOM_CORP_ID || "";

function getCrypt(): WXBizMsgCrypt {
  return new WXBizMsgCrypt(TOKEN, AES_KEY, CORP_ID);
}

// 从加密 XML 信封提取 <Encrypt> 内容
function extractEncrypt(xml: string): string | null {
  const m =
    xml.match(/<Encrypt><!\[CDATA\[([\s\S]*?)\]\]><\/Encrypt>/) ||
    xml.match(/<Encrypt>([\s\S]*?)<\/Encrypt>/);
  return m ? m[1] : null;
}

// 从明文 XML 提取字段（兼容 CDATA 与普通文本）
function extractField(xml: string, tag: string): string | null {
  const m =
    xml.match(new RegExp(`<${tag}><!\\[CDATA\\[([\s\S]*?)\\]\\]><\\/${tag}>`)) ||
    xml.match(new RegExp(`<${tag}>([\s\S]*?)<\\/${tag}>`));
  return m ? m[1] : null;
}

// ── GET: 验证回调 URL ──────────────────────────
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const msgSignature = searchParams.get("msg_signature") || "";
  const timestamp = searchParams.get("timestamp") || "";
  const nonce = searchParams.get("nonce") || "";
  const echostr = searchParams.get("echostr") || "";

  try {
    const crypt = getCrypt();
    if (!crypt.verifySignature(msgSignature, timestamp, nonce, echostr)) {
      return new Response("invalid signature", { status: 403 });
    }
    const { message } = crypt.decrypt(echostr);
    return new Response(message, { status: 200 });
  } catch (e) {
    console.error("[kf-callback] GET verify error:", e);
    return new Response("error", { status: 500 });
  }
}

// ── POST: 接收消息 ─────────────────────────────
export async function POST(request: Request) {
  const { searchParams } = new URL(request.url);
  const msgSignature = searchParams.get("msg_signature") || "";
  const timestamp = searchParams.get("timestamp") || "";
  const nonce = searchParams.get("nonce") || "";

  try {
    const body = await request.text();
    const encrypt = extractEncrypt(body);
    if (!encrypt) return new Response("success", { status: 200 });

    const crypt = getCrypt();
    if (!crypt.verifySignature(msgSignature, timestamp, nonce, encrypt)) {
      // 签名不符仍回 success，避免微信反复重试轰炸
      return new Response("success", { status: 200 });
    }
    const { message } = crypt.decrypt(encrypt);

    // 先回 success（满足 5 秒限制），再异步处理
    void handleKfMessage(message);
    return new Response("success", { status: 200 });
  } catch (e) {
    console.error("[kf-callback] POST error:", e);
    return new Response("success", { status: 200 });
  }
}

// ── 异步处理一条用户消息 ──────────────────────
async function handleKfMessage(plainXml: string) {
  try {
    const msgType = extractField(plainXml, "MsgType");
    if (msgType !== "text") {
      // 事件类（如 kf_enter_session）暂不处理
      return;
    }
    const fromUser =
      extractField(plainXml, "FromUserName") || extractField(plainXml, "ExternalUserId");
    const content = extractField(plainXml, "Content");
    if (!fromUser || !content) return;

    const visitorId = `kf_${fromUser}`;
    // 复用最近会话，保持多轮上下文
    let sessionId: string | undefined;
    try {
      const sessions = await buyerChatAgent.listSessions(visitorId);
      sessionId = sessions?.[0]?.id;
    } catch {
      /* ignore */
    }

    const result = await buyerChatAgent.run({
      sessionId,
      visitorId,
      productId: undefined,
      locale: "zh",
      content,
    });

    if (!result.success) {
      await pushToGroup({
        title: "⚠️ 客服 AI 异常",
        lines: [`**访客**: ${fromUser}`, `**问题**: ${content}`, `**错误**: ${result.error || "未知"}`],
        level: "warn",
      });
      return;
    }

    const reply = result.message.content;
    // 发回微信客服
    await sendKfTextMessage(fromUser, reply.length > 2000 ? reply.slice(0, 2000) + "…" : reply);

    // 推监控群
    await pushToGroup({
      title: "💬 微信客服对话",
      lines: [
        `**访客**: ${fromUser}`,
        `**问**: ${content}`,
        `**AI答**: ${reply.slice(0, 600)}`,
        reply.length > 600 ? "_（回复较长，已截断）_" : "",
      ].filter(Boolean),
      level: result.message.intent === "hand_over" ? "warn" : "info",
    });
  } catch (e) {
    console.error("[kf-callback] handle error:", e);
  }
}
