// ───────────────────────────────────────────────
// 微信客服 API 封装: access_token 缓存 + 发送消息
// 文档: https://developer.work.weixin.qq.com/document/path/94670
// ───────────────────────────────────────────────
import axios from "axios";

const CORP_ID = process.env.WECOM_CORP_ID || "";
const KF_SECRET = process.env.WECOM_KF_SECRET || "";

// 模块级缓存（Vercel 冷启动会失效，但 token 有效期 7200s，可接受）
let cachedToken = "";
let tokenExpireAt = 0;

export async function getAccessToken(): Promise<string> {
  const now = Date.now();
  if (cachedToken && now < tokenExpireAt) return cachedToken;

  const res = await axios.get("https://qyapi.weixin.qq.com/cgi-bin/gettoken", {
    params: { corpid: CORP_ID, corpsecret: KF_SECRET },
    timeout: 8000,
  });
  const data = res.data as { errcode: number; errmsg: string; access_token?: string; expires_in?: number };
  if (data.errcode !== 0 || !data.access_token) {
    throw new Error(`WeCom gettoken failed: ${data.errcode} ${data.errmsg}`);
  }
  cachedToken = data.access_token;
  // 提前 5 分钟过期，避免边缘失效
  tokenExpireAt = now + ((data.expires_in || 7200) - 300) * 1000;
  return cachedToken;
}

// 发送微信客服文本消息（touser = 用户 external_userid）
export async function sendKfTextMessage(touser: string, content: string): Promise<void> {
  const token = await getAccessToken();
  // 微信客服文本消息限制 2048 字节，超长截断
  const safeContent = content.length > 2000 ? content.slice(0, 2000) + "…" : content;
  await axios.post(
    `https://qyapi.weixin.qq.com/cgi-bin/kf/send_msg?access_token=${token}`,
    {
      touser,
      msgtype: "text",
      text: { content: safeContent },
    },
    { timeout: 8000 }
  );
}
