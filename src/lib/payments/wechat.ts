/**
 * 微信支付 · 电商收付通（担保交易）V3 集成（仅 .cn 国内站使用）
 *
 * 与 src/lib/wechat-pay.ts（普通商户 Native 支付）完全分离：
 *  - 本文件面向「电商收付通 / 担保交易」产品，资金在微信小程序闭环，网站侧不碰资金。
 *  - 仅负责：生成担保交易意图（下单拿 prepay_id）+ 回调验签/解密。
 *  - 不写资金流水、不做分账、不改动既有 wechat-pay 库。
 *
 * 环境变量（与既有 wechat-pay 的 WECHAT_* 区分，使用 WECHAT_PAY_* 前缀）：
 *   WECHAT_PAY_APP_ID          小程序 AppID（担保交易 JSAPI 用）
 *   WECHAT_PAY_MCH_ID          平台商户号（服务商/电商收付通商户号）
 *   WECHAT_PAY_API_V3_KEY      API V3 密钥（32 字节，解密回调用）
 *   WECHAT_PAY_SERIAL_NO       商户 API 证书序列号
 *   WECHAT_PAY_PRIVATE_KEY     商户私钥 PEM
 *   WECHAT_PAY_NOTIFY_URL      担保交易支付结果通知地址
 *   WECHAT_PAY_PLATFORM_CERT   （可选）微信平台证书公钥 PEM，用于严格验签
 *
 * 实现方式：手写 fetch + crypto（不依赖 wechatpay-node-v3，避免额外依赖；结构正确、可离线 tsc）。
 */

import crypto from "crypto";

const APP_ID = process.env.WECHAT_PAY_APP_ID || "";
const MCH_ID = process.env.WECHAT_PAY_MCH_ID || "";
const API_V3_KEY = process.env.WECHAT_PAY_API_V3_KEY || "";
const SERIAL_NO = process.env.WECHAT_PAY_SERIAL_NO || "";
const PRIVATE_KEY = process.env.WECHAT_PAY_PRIVATE_KEY || "";
const NOTIFY_URL = process.env.WECHAT_PAY_NOTIFY_URL || "";
const PLATFORM_CERT = process.env.WECHAT_PAY_PLATFORM_CERT || "";

const BASE_URL = "https://api.mch.weixin.qq.com";

/**
 * 规范化私钥（复用既有 wechat-pay 的还原逻辑，兼容粘贴时转义的换行）
 */
function normalizePrivateKey(raw: string): string {
  let key = raw.trim();
  key = key.replace(/\\n/g, "\n").replace(/\r\n/g, "\n").trim();
  if (key.includes("-----BEGIN") && key.includes("-----END")) return key;
  const base64Body = key.replace(/\s+/g, "");
  return `-----BEGIN PRIVATE KEY-----\n${base64Body}\n-----END PRIVATE KEY-----`;
}

const NORMALIZED_PRIVATE_KEY = normalizePrivateKey(PRIVATE_KEY);

/** 用商户私钥对消息做 SHA256withRSA 签名 */
function signWithPrivateKey(message: string): string {
  const sign = crypto.createSign("RSA-SHA256");
  sign.update(message, "utf8");
  return sign.sign(NORMALIZED_PRIVATE_KEY, "base64");
}

/** 构造 V3 Authorization 头 */
function buildAuthHeader(method: string, urlPath: string, body: string): string {
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const nonce = crypto.randomBytes(16).toString("hex");
  const message = `${method}\n${urlPath}\n${timestamp}\n${nonce}\n${body}\n`;
  const signature = signWithPrivateKey(message);
  return `WECHATPAY2-SHA256-RSA2048 mchid="${MCH_ID}",nonce_str="${nonce}",timestamp="${timestamp}",serial_no="${SERIAL_NO}",signature="${signature}"`;
}

/** AES-256-GCM 解密回调资源（APIv3 key） */
function decryptResource(
  ciphertext: string,
  associatedData: string,
  nonce: string
): Record<string, any> {
  const key = Buffer.from(API_V3_KEY, "utf8");
  const cipherBuf = Buffer.from(ciphertext, "base64");
  const authTag = cipherBuf.slice(cipherBuf.length - 16);
  const encrypted = cipherBuf.slice(0, cipherBuf.length - 16);
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, Buffer.from(nonce, "utf8"));
  decipher.setAuthTag(authTag);
  decipher.setAAD(Buffer.from(associatedData, "utf8"));
  const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]).toString("utf8");
  return JSON.parse(decrypted);
}

export interface CreateGuaranteeIntentInput {
  /** 我方担保意图单号（作为 out_trade_no 回传，便于回调幂等定位） */
  outTradeNo: string;
  productId: string;
  buyerUserId: string;
  sellerUserId: string;
  amountCny: number;
  /** 卖家子商户号（电商收付通 sub_mchid） */
  wechatSubMerchantId: string;
  /** 关联询价 id（可选） */
  inquiryId?: string;
  /** 商品描述 */
  description?: string;
}

export interface CreateGuaranteeIntentResult {
  /** 微信 prepay_id（小程序跳转用） */
  prepayId: string;
  /** 我方担保意图单号（= outTradeNo） */
  intentId: string;
  /** 小程序跳转所需参数（wx.requestOrderPayment 风格） */
  miniProgramParams: {
    appId: string;
    timeStamp: string;
    nonceStr: string;
    package: string;
    signType: string;
    paySign: string;
    prepayId: string;
  };
}

/** 是否已配置收付通（5 项必填） */
export function isConfigured(): boolean {
  return !!(
    APP_ID &&
    MCH_ID &&
    API_V3_KEY &&
    SERIAL_NO &&
    PRIVATE_KEY
  );
}

/**
 * 创建担保交易意图（电商收付通下单）。
 * 调用微信「担保交易」订单接口，返回 prepay_id 与小程序跳转参数。
 * 网站侧不触碰资金，仅生成意图，真实收单在小程序闭环。
 */
export async function createGuaranteeIntent(
  input: CreateGuaranteeIntentInput
): Promise<CreateGuaranteeIntentResult> {
  if (!isConfigured()) {
    throw new Error("微信收付通未配置");
  }

  const urlPath = "/v3/ecommerce/orders";
  const amountInCents = Math.round(input.amountCny * 100);
  const description = input.description || "神雕农机 · 二手农机担保交易";

  const body = JSON.stringify({
    appid: APP_ID,
    mchid: MCH_ID,
    sub_mchid: input.wechatSubMerchantId,
    out_trade_no: input.outTradeNo,
    description,
    notify_url: NOTIFY_URL,
    amount: { total: amountInCents, currency: "CNY" },
    // 担保交易：资金先冻结，确认收货后解冻给卖家（网站不碰资金流）
    settle_info: { profit_sharing: false },
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
    console.error("[WechatPay-Ecommerce] 担保交易下单失败:", response.status, result);
    throw new Error(`微信收付通下单失败: ${result?.message || response.statusText}`);
  }

  const prepayId: string = result.prepay_id;
  const timeStamp = Math.floor(Date.now() / 1000).toString();
  const nonceStr = crypto.randomBytes(16).toString("hex");
  const pkg = `prepay_id=${prepayId}`;
  // 担保交易 JSAPI 签名（与标准 JSAPI 同构）
  const paySignMessage = `${APP_ID}\n${timeStamp}\n${nonceStr}\n${pkg}\n`;
  const paySign = signWithPrivateKey(paySignMessage);

  return {
    prepayId,
    intentId: input.outTradeNo,
    miniProgramParams: {
      appId: APP_ID,
      timeStamp,
      nonceStr,
      package: pkg,
      signType: "RSA",
      paySign,
      prepayId,
    },
  };
}

/**
 * 验签并解密微信担保交易回调。
 * 步骤：
 *  1) （可选）若配置了平台证书，用平台公钥验签 ${timestamp}\n${nonce}\n${rawBody}\n
 *  2) 用 APIv3 key 解密 resource，得到真实通知体
 * 返回解析后的通知体；失败返回 null。
 *
 * 注意：微信 V3 标准验签需平台证书公钥，本实现在缺证书时降级为「仅解密」，
 * 与既有 wechat-pay.ts 的风险姿态一致（结构正确，生产建议补全平台证书）。
 */
export function verifyCallback(
  rawBody: string,
  signature: string,
  timestamp: string,
  nonce: string
): Record<string, any> | null {
  try {
    // 1) 可选：平台证书严格验签
    if (PLATFORM_CERT) {
      const message = `${timestamp}\n${nonce}\n${rawBody}\n`;
      const verify = crypto.createVerify("RSA-SHA256");
      verify.update(message, "utf8");
      const ok = verify.verify(PLATFORM_CERT, signature, "base64");
      if (!ok) {
        console.warn("[WechatPay-Ecommerce] 回调签名校验失败");
        return null;
      }
    }

    // 2) 解密 resource
    const payload = JSON.parse(rawBody);
    const resource = payload?.resource;
    if (!resource || !resource.ciphertext) {
      return null;
    }
    return decryptResource(
      resource.ciphertext,
      resource.associated_data || "",
      resource.nonce
    );
  } catch (err) {
    console.error("[WechatPay-Ecommerce] 回调解析失败:", err);
    return null;
  }
}
