/**
 * 阿里云短信发送客户端（Dysmsapi 2017-05-25）
 *
 * 使用原生 fetch 调用阿里云短信 REST API，不引入任何额外 npm 依赖。
 * 未配置 AccessKey / 签名 / 模板时降级为 console.warn 并返回 { success: false }，
 * 绝不阻塞主业务流程（审批流是主流程，发信只是通知手段）。
 *
 * 模板变量名约定（需与阿里云控制台模板一一对应）：
 *   ${brand}    品牌名称
 *   ${account}  登录账号
 *   ${password} 登录密码
 */
import { createHmac } from "crypto";

/** 阿里云短信 API 端点 */
const SMS_ENDPOINT = "https://dysmsapi.aliyuncs.com/";
/** API 版本 */
const SMS_VERSION = "2017-05-25";
/** 接口名 */
const SMS_ACTION = "SendSms";
/** 区域（国内短信默认 cn-hangzhou） */
const SMS_REGION_ID = "cn-hangzhou";

/** 发送短信入参 */
export interface SendSmsParams {
  /** 接收手机号（11 位） */
  phone: string;
  /** 短信模板变量，键名需与阿里云控制台模板变量一致，例如 { brand, account, password } */
  templateParams: Record<string, string>;
  /** 可选：覆盖默认签名（默认读取 env ALIYUN_SMS_SIGN_NAME） */
  signName?: string;
  /** 可选：覆盖默认模板 CODE（默认读取 env ALIYUN_SMS_TEMPLATE_CODE） */
  templateCode?: string;
}

/** 发送结果（与邮件门面保持一致的轻量结构） */
export interface SendSmsResult {
  /** 是否发送成功 */
  success: boolean;
  /** 失败时的错误描述 */
  error?: string;
  /** 阿里云返回的请求 ID，便于排查 */
  requestId?: string;
}

/**
 * 阿里云签名所需的百分号编码。
 * 与标准 encodeURIComponent 的区别：空格→%20、星号→%2A、波浪号→~（阿里云规定）。
 */
function percentEncode(value: string): string {
  return encodeURIComponent(value)
    .replace(/\+/g, "%20")
    .replace(/\*/g, "%2A")
    .replace(/%7E/g, "~");
}

/**
 * 生成随机 SignatureNonce。
 * 无需依赖 uuid 库：以随机数 + 时间戳拼接，保证单次请求唯一即可。
 */
function randomNonce(): string {
  return (
    Math.random().toString(36).slice(2) +
    Date.now().toString(36) +
    Math.random().toString(36).slice(2)
  );
}

/**
 * 计算 HMAC-SHA1 签名并 Base64 编码。
 * 阿里云规定签名密钥为 `accessKeySecret + "&"`。
 */
function computeSignature(accessKeySecret: string, stringToSign: string): string {
  const hmac = createHmac("sha1", `${accessKeySecret}&`);
  hmac.update(stringToSign, "utf8");
  return hmac.digest("base64");
}

/**
 * 发送短信（阿里云 Dysmsapi 2017-05-25）。
 *
 * 降级策略：缺少 AccessKey / 签名 / 模板时，打印 console.warn 并返回
 * { success: false }，不抛异常、不阻塞调用方。
 */
export async function sendSms(params: SendSmsParams): Promise<SendSmsResult> {
  const accessKeyId = process.env.ALIYUN_SMS_ACCESS_KEY_ID;
  const accessKeySecret = process.env.ALIYUN_SMS_ACCESS_KEY_SECRET;
  const signName = params.signName ?? process.env.ALIYUN_SMS_SIGN_NAME;
  const templateCode = params.templateCode ?? process.env.ALIYUN_SMS_TEMPLATE_CODE;

  // 降级：未配置凭据或模板时不真正发信，避免阻塞业务流程
  if (!accessKeyId || !accessKeySecret || !signName || !templateCode) {
    // eslint-disable-next-line no-console
    console.warn(
      "[sms] 未配置阿里云短信凭据或签名/模板，跳过发送。请设置 " +
        "ALIYUN_SMS_ACCESS_KEY_ID / ALIYUN_SMS_ACCESS_KEY_SECRET / " +
        "ALIYUN_SMS_SIGN_NAME / ALIYUN_SMS_TEMPLATE_CODE 环境变量。"
    );
    return { success: false };
  }

  try {
    // 公共参数
    const publicParams: Record<string, string> = {
      Format: "JSON",
      Version: SMS_VERSION,
      AccessKeyId: accessKeyId,
      SignatureMethod: "HMAC-SHA1",
      SignatureNonce: randomNonce(),
      Timestamp: new Date().toISOString(),
      Action: SMS_ACTION,
      RegionId: SMS_REGION_ID,
    };

    // 业务参数
    const apiParams: Record<string, string> = {
      PhoneNumbers: params.phone,
      SignName: signName,
      TemplateCode: templateCode,
      TemplateParam: JSON.stringify(params.templateParams),
    };

    // 合并并按 ASCII 升序排序（阿里云签名要求）
    const allParams: Record<string, string> = { ...publicParams, ...apiParams };
    const sortedKeys = Object.keys(allParams).sort();

    // 构造规范查询串
    const canonicalizedQueryString = sortedKeys
      .map((key) => `${percentEncode(key)}=${percentEncode(allParams[key])}`)
      .join("&");

    // 构造待签名串：POST&%2F&<编码后的规范查询串>
    const stringToSign = `POST&${percentEncode("/")}&${percentEncode(
      canonicalizedQueryString
    )}`;

    const signature = computeSignature(accessKeySecret, stringToSign);

    // 最终请求体（form-urlencoded）
    const finalBody = `${canonicalizedQueryString}&Signature=${percentEncode(signature)}`;

    const response = await fetch(SMS_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: finalBody,
    });

    const data = (await response.json()) as {
      Code?: string;
      Message?: string;
      RequestId?: string;
      BizId?: string;
    };

    if (data.Code === "OK") {
      return { success: true, requestId: data.RequestId };
    }

    const errMsg = `Aliyun SMS error: Code=${data.Code}, Message=${data.Message}`;
    // eslint-disable-next-line no-console
    console.error("[sms]", errMsg);
    return { success: false, error: errMsg, requestId: data.RequestId };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "unknown sms error";
    // eslint-disable-next-line no-console
    console.error("[sms] 发送失败:", message);
    return { success: false, error: message };
  }
}
