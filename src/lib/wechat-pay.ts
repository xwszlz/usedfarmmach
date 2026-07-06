/**
 * 微信支付 V3 — 纯 crypto 实现（无文件依赖，适配 Vercel Serverless）
 *
 * 环境变量：
 *   WECHAT_APP_ID        - 微信应用ID（公众号/小程序 AppID）
 *   WECHAT_MCH_ID        - 商户号
 *   WECHAT_API_V3_KEY    - API V3 密钥（32字节）
 *   WECHAT_SERIAL_NO     - 商户证书序列号
 *   WECHAT_PRIVATE_KEY   - 商户私钥 PEM（PEM格式字符串）
 *   WECHAT_NOTIFY_URL    - 回调通知URL
 */

import crypto from "crypto";

const APP_ID = process.env.WECHAT_APP_ID || "";
const MCH_ID = process.env.WECHAT_MCH_ID || "";
const API_V3_KEY = process.env.WECHAT_API_V3_KEY || "";
const SERIAL_NO = process.env.WECHAT_SERIAL_NO || "";
const PRIVATE_KEY = process.env.WECHAT_PRIVATE_KEY || "";
const NOTIFY_URL = process.env.WECHAT_NOTIFY_URL || "";

const BASE_URL = "https://api.mch.weixin.qq.com";

/**
 * 用商户私钥对消息做 SHA256withRSA 签名
 */
function signWithPrivateKey(message: string): string {
  const sign = crypto.createSign("RSA-SHA256");
  sign.update(message, "utf8");
  return sign.sign(PRIVATE_KEY, "base64");
}

/**
 * 构造 Authorization 头（V3 标准）
 */
function buildAuthHeader(method: string, url: string, body: string): string {
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const nonce = crypto.randomBytes(16).toString("hex");
  const message = `${method}\n${url}\n${timestamp}\n${nonce}\n${body}\n`;
  const signature = signWithPrivateKey(message);
  return `WECHATPAY2-SHA256-RSA2048 mchid="${MCH_ID}",nonce_str="${nonce}",timestamp="${timestamp}",serial_no="${SERIAL_NO}",signature="${signature}"`;
}

/**
 * 创建 Native 支付订单（扫码支付）
 * @param orderNo  商户订单号
 * @param amount   金额（分）
 * @param description 描述
 * @returns { code_url, prepay_id }
 */
export async function createNativeOrder(
  orderNo: string,
  amountInCents: number,
  description: string
): Promise<{ code_url: string; prepay_id?: string }> {
  const urlPath = "/v3/pay/transactions/native";
  const body = JSON.stringify({
    appid: APP_ID,
    mchid: MCH_ID,
    out_trade_no: orderNo,
    description,
    amount: { total: amountInCents, currency: "CNY" },
    notify_url: NOTIFY_URL,
  });

  const authHeader = buildAuthHeader("POST", urlPath, body);

  const response = await fetch(`${BASE_URL}${urlPath}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      Authorization: authHeader,
    },
    body,
  });

  const result = await response.json();

  if (!response.ok) {
    console.error("[WechatPay] 创建订单失败:", response.status, result);
    throw new Error(`微信支付下单失败: ${result.message || response.statusText}`);
  }

  return { code_url: result.code_url };
}

/**
 * 验证微信支付回调签名
 * 微信回调 Headers:
 *   Wechatpay-Timestamp, Wechatpay-Nonce, Wechatpay-Signature, Wechatpay-Serial
 *
 * ⚠️ 生产环境应获取微信平台证书验签，此处用 API V3 Key 解密资源
 */
export function decryptCallbackResource(
  ciphertext: string,
  associatedData: string,
  nonce: string
): Record<string, any> {
  const key = Buffer.from(API_V3_KEY, "utf8");
  const cipherTextBuf = Buffer.from(ciphertext, "base64");
  const authTag = cipherTextBuf.slice(cipherTextBuf.length - 16);
  const encryptedData = cipherTextBuf.slice(0, cipherTextBuf.length - 16);

  const decipher = crypto.createDecipheriv("aes-256-gcm", key, Buffer.from(nonce, "utf8"));
  decipher.setAuthTag(authTag);
  decipher.setAAD(Buffer.from(associatedData, "utf8"));

  const decrypted = Buffer.concat([decipher.update(encryptedData), decipher.final()]).toString("utf8");
  return JSON.parse(decrypted);
}

/**
 * 查询订单状态
 */
export async function queryOrder(orderNo: string): Promise<Record<string, any>> {
  const urlPath = `/v3/pay/transactions/out-trade-no/${orderNo}?mchid=${MCH_ID}`;
  const authHeader = buildAuthHeader("GET", urlPath, "");

  const response = await fetch(`${BASE_URL}${urlPath}`, {
    method: "GET",
    headers: {
      Accept: "application/json",
      Authorization: authHeader,
    },
  });

  const result = await response.json();

  if (!response.ok) {
    console.error("[WechatPay] 查询订单失败:", response.status, result);
    throw new Error(`查询订单失败: ${result.message || response.statusText}`);
  }

  return result;
}

/**
 * 申请退款
 */
export async function refundOrder(
  orderNo: string,
  refundNo: string,
  refundAmountCents: number,
  totalAmountCents: number,
  reason: string
): Promise<Record<string, any>> {
  const urlPath = "/v3/refund/domestic/refunds";
  const body = JSON.stringify({
    out_trade_no: orderNo,
    out_refund_no: refundNo,
    reason,
    amount: {
      refund: refundAmountCents,
      total: totalAmountCents,
      currency: "CNY",
    },
  });

  const authHeader = buildAuthHeader("POST", urlPath, body);

  const response = await fetch(`${BASE_URL}${urlPath}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      Authorization: authHeader,
    },
    body,
  });

  const result = await response.json();

  if (!response.ok) {
    console.error("[WechatPay] 退款失败:", response.status, result);
    throw new Error(`退款失败: ${result.message || response.statusText}`);
  }

  return result;
}

/**
 * 检查配置是否就绪
 */
export function isConfigured(): boolean {
  return !!(APP_ID && MCH_ID && API_V3_KEY && SERIAL_NO && PRIVATE_KEY);
}

export { APP_ID, MCH_ID };
