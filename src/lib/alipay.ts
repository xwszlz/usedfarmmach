/**
 * 支付宝支付 — 纯 crypto 实现（无文件依赖，适配 Vercel Serverless）
 *
 * 环境变量：
 *   ALIPAY_APP_ID       - 支付宝应用ID
 *   ALIPAY_PRIVATE_KEY  - 应用私钥（PEM 或 base64 字符串）
 *   ALIPAY_PUBLIC_KEY   - 支付宝公钥（PEM 或 base64 字符串）
 *   ALIPAY_NOTIFY_URL   - 异步回调通知URL
 *   ALIPAY_GATEWAY      - 网关地址（默认 https://openapi.alipay.com/gateway.do）
 */

import crypto from "crypto";

const APP_ID = process.env.ALIPAY_APP_ID || "";
const PRIVATE_KEY_RAW = process.env.ALIPAY_PRIVATE_KEY || "";
const PUBLIC_KEY_RAW = process.env.ALIPAY_PUBLIC_KEY || "";
const NOTIFY_URL = process.env.ALIPAY_NOTIFY_URL || "";
const GATEWAY = process.env.ALIPAY_GATEWAY || "https://openapi.alipay.com/gateway.do";

/**
 * 将裸 base64 密钥转换为 PEM 格式
 */
function toPemKey(rawKey: string, isPrivate: boolean): string {
  const trimmed = rawKey.trim();
  if (trimmed.includes("-----BEGIN")) return trimmed;

  // 纯 base64 → 补全 PEM 头尾
  const header = isPrivate
    ? "-----BEGIN RSA PRIVATE KEY-----"
    : "-----BEGIN PUBLIC KEY-----";
  const footer = isPrivate
    ? "-----END RSA PRIVATE KEY-----"
    : "-----END PUBLIC KEY-----";

  // 每 64 字符换行
  const lines = trimmed.match(/.{1,64}/g) || [];
  return `${header}\n${lines.join("\n")}\n${footer}`;
}

function getPrivateKey(): string {
  return toPemKey(PRIVATE_KEY_RAW, true);
}

function getPublicKey(): string {
  return toPemKey(PUBLIC_KEY_RAW, false);
}

/**
 * RSA2 (SHA256withRSA) 签名
 */
function sign(data: string): string {
  const sign = crypto.createSign("RSA-SHA256");
  sign.update(data, "utf8");
  return sign.sign(getPrivateKey(), "base64");
}

/**
 * 验证支付宝回调签名
 */
export function verifyCallback(params: Record<string, string>): boolean {
  const signValue = params.sign;
  if (!signValue) return false;

  // 按 key 排序，拼接 key=value&，排除 sign 和 sign_type
  const sortedKeys = Object.keys(params)
    .filter((k) => k !== "sign" && k !== "sign_type" && params[k] !== "")
    .sort();

  const signData = sortedKeys.map((k) => `${k}=${params[k]}`).join("&");

  const verify = crypto.createVerify("RSA-SHA256");
  verify.update(signData, "utf8");
  return verify.verify(getPublicKey(), signValue, "base64");
}

/**
 * 构造支付宝请求（带签名）
 */
function buildSignedParams(bizContent: Record<string, any>, method: string): Record<string, string> {
  const params: Record<string, string> = {
    app_id: APP_ID,
    method,
    format: "JSON",
    charset: "utf-8",
    sign_type: "RSA2",
    timestamp: new Date().toLocaleString("zh-CN", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    }),
    version: "1.0",
    notify_url: NOTIFY_URL,
    biz_content: JSON.stringify(bizContent),
  };

  // 排序并拼接
  const sortedKeys = Object.keys(params).sort();
  const signData = sortedKeys.map((k) => `${k}=${params[k]}`).join("&");
  params.sign = sign(signData);

  return params;
}

/**
 * 创建电脑网站支付订单 (alipay.trade.page.pay)
 * 返回支付页面URL（用户跳转到此URL完成支付）
 */
export function createPagePayUrl(
  orderNo: string,
  amount: number,
  subject: string,
  returnUrl?: string
): string {
  const bizContent: Record<string, any> = {
    out_trade_no: orderNo,
    total_amount: amount.toFixed(2),
    subject,
    product_code: "FAST_INSTANT_TRADE_PAY",
  };

  if (returnUrl) {
    bizContent.return_url = returnUrl;
  }

  const params = buildSignedParams(bizContent, "alipay.trade.page.pay");

  // 构造 GET URL
  const query = Object.entries(params)
    .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
    .join("&");

  return `${GATEWAY}?${query}`;
}

/**
 * 创建当面付订单 (alipay.trade.precreate) — 扫码支付
 */
export async function createPrecreateOrder(
  orderNo: string,
  amount: number,
  subject: string
): Promise<{ qr_code: string; out_trade_no: string }> {
  const bizContent = {
    out_trade_no: orderNo,
    total_amount: amount.toFixed(2),
    subject,
  };

  const params = buildSignedParams(bizContent, "alipay.trade.precreate");

  const query = Object.entries(params)
    .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
    .join("&");

  const response = await fetch(`${GATEWAY}?${query}`);
  const text = await response.text();

  let result: any;
  try {
    result = JSON.parse(text);
  } catch {
    // 支付宝有时返回非标准JSON
    const match = text.match(/\{[\s\S]*\}/);
    result = match ? JSON.parse(match[0]) : {};
  }

  const respKey = "alipay_trade_precreate_response";
  if (!result[respKey] || result[respKey].code !== "10000") {
    console.error("[Alipay] 创建订单失败:", result[respKey] || result);
    throw new Error(
      `支付宝下单失败: ${result[respKey]?.sub_msg || result[respKey]?.msg || "未知错误"}`
    );
  }

  return {
    qr_code: result[respKey].qr_code,
    out_trade_no: result[respKey].out_trade_no,
  };
}

/**
 * 查询交易状态 (alipay.trade.query)
 */
export async function queryTrade(orderNo: string): Promise<Record<string, any>> {
  const bizContent = { out_trade_no: orderNo };
  const params = buildSignedParams(bizContent, "alipay.trade.query");

  const query = Object.entries(params)
    .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
    .join("&");

  const response = await fetch(`${GATEWAY}?${query}`);
  const text = await response.text();

  let result: any;
  try {
    result = JSON.parse(text);
  } catch {
    const match = text.match(/\{[\s\S]*\}/);
    result = match ? JSON.parse(match[0]) : {};
  }

  const respKey = "alipay_trade_query_response";
  return result[respKey] || result;
}

/**
 * 申请退款 (alipay.trade.refund)
 */
export async function refundTrade(
  orderNo: string,
  refundAmount: number,
  refundReason: string
): Promise<Record<string, any>> {
  const bizContent = {
    out_trade_no: orderNo,
    refund_amount: refundAmount.toFixed(2),
    refund_reason: refundReason,
  };

  const params = buildSignedParams(bizContent, "alipay.trade.refund");

  const query = Object.entries(params)
    .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
    .join("&");

  const response = await fetch(`${GATEWAY}?${query}`);
  const text = await response.text();

  let result: any;
  try {
    result = JSON.parse(text);
  } catch {
    const match = text.match(/\{[\s\S]*\}/);
    result = match ? JSON.parse(match[0]) : {};
  }

  const respKey = "alipay_trade_refund_response";
  return result[respKey] || result;
}

/**
 * 检查配置是否就绪
 */
export function isConfigured(): boolean {
  return !!(APP_ID && PRIVATE_KEY_RAW && PUBLIC_KEY_RAW);
}

export { APP_ID };
