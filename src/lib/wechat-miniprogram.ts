/**
 * 微信小程序基础能力封装（手机号获取等）
 *
 * 环境变量：
 *   WECHAT_MINI_APPID   - 小程序 AppID（默认使用项目已知值）
 *   WECHAT_MINI_SECRET  - 小程序 AppSecret（务必配置，不可写死）
 *
 * 注意：access_token 有调用频率限制（2000 次/天），此处用 module 级内存缓存，
 * 在 Vercel Serverless 单实例运行期内有效。后续如需跨实例共享可改 Redis 缓存。
 */

const APP_ID = process.env.WECHAT_MINI_APPID || "wx8ac59ab483285cb4";
const SECRET = process.env.WECHAT_MINI_SECRET || "";

const TOKEN_URL = "https://api.weixin.qq.com/cgi-bin/stable_token";
const PHONE_URL = "https://api.weixin.qq.com/wxa/business/getuserphonenumber";

// 内存缓存（非持久化，Serverless 冷启动会重置）
let tokenCache: { token: string; expireAt: number } | null = null;

/**
 * 获取小程序 access_token（带缓存）
 */
export async function getAccessToken(): Promise<string> {
  if (!SECRET) {
    throw new Error("WECHAT_MINI_SECRET 未配置，无法获取 access_token");
  }

  // 命中有效缓存（提前 5 分钟过期，避免临界点失效）
  const now = Date.now();
  if (tokenCache && tokenCache.expireAt > now + 5 * 60 * 1000) {
    return tokenCache.token;
  }

  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      grant_type: "client_credential",
      appid: APP_ID,
      secret: SECRET,
    }),
  });

  const data = await res.json();
  if (data.errcode) {
    throw new Error(`获取 access_token 失败: ${data.errcode} ${data.errmsg}`);
  }

  tokenCache = {
    token: data.access_token,
    expireAt: now + (data.expires_in || 7200) * 1000,
  };

  return data.access_token;
}

/**
 * 用 getPhoneNumber 返回的 code 换取用户手机号
 * @param code 前端 wx.getPhoneNumber 返回的 e.detail.code
 * @returns { phoneNumber, purePhoneNumber, countryCode }
 */
export async function getPhoneNumber(code: string): Promise<{
  phoneNumber: string;
  purePhoneNumber: string;
  countryCode: string;
}> {
  if (!code) {
    throw new Error("缺少 code 参数");
  }

  const accessToken = await getAccessToken();

  const res = await fetch(`${PHONE_URL}?access_token=${accessToken}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code }),
  });

  const data = await res.json();
  if (data.errcode !== 0) {
    throw new Error(`换取手机号失败: ${data.errcode} ${data.errmsg}`);
  }

  const info = data.phone_info || {};
  return {
    phoneNumber: info.phoneNumber || "",
    purePhoneNumber: info.purePhoneNumber || "",
    countryCode: info.countryCode || "",
  };
}

export { APP_ID };
