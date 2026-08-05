// ───────────────────────────────────────────────
// 微信客服 / 企业微信 消息加解密 (WXBizMsgCrypt)
// 算法: SHA1 签名校验 + AES-256-CBC (PKCS7) 解密
// ───────────────────────────────────────────────
import * as crypto from "crypto";

export class WXBizMsgCrypt {
  private token: string;
  private aesKey: Buffer;
  private receiveId: string;

  constructor(token: string, encodingAESKey: string, receiveId: string) {
    this.token = token;
    // 微信 EncodingAESKey 是 43 位 Base64（不含等号），补一个 "=" 凑成 44 位标准 Base64
    this.aesKey = Buffer.from(encodingAESKey + "=", "base64");
    if (this.aesKey.length !== 32) {
      throw new Error(`Invalid EncodingAESKey length: expected 32 bytes, got ${this.aesKey.length}`);
    }
    this.receiveId = receiveId;
  }

  // 验证签名: SHA1( sorted(token, timestamp, nonce, encrypt) ) === signature
  verifySignature(signature: string, timestamp: string, nonce: string, encrypt: string): boolean {
    const arr = [this.token, timestamp, nonce, encrypt].sort();
    const sha = crypto.createHash("sha1").update(arr.join("")).digest("hex");
    return sha === signature;
  }

  // 解密: 返回明文消息与 receiveId（应为 corpId）
  decrypt(encrypt: string): { message: string; receiveId: string } {
    const decipher = crypto.createDecipheriv("aes-256-cbc", this.aesKey, this.aesKey.slice(0, 16));
    decipher.setAutoPadding(false);
    const decrypted = Buffer.concat([
      decipher.update(Buffer.from(encrypt, "base64")),
      decipher.final(),
    ]);
    // 去掉 PKCS7 padding
    const padLen = decrypted[decrypted.length - 1];
    const unpadded =
      padLen > 0 && padLen <= 32 ? decrypted.slice(0, decrypted.length - padLen) : decrypted;
    const contentLen = unpadded.readUInt32BE(16);
    const message = unpadded.slice(20, 20 + contentLen).toString("utf8");
    const receiveId = unpadded.slice(20 + contentLen).toString("utf8");
    return { message, receiveId };
  }

  // 加密（被动回复用，微信客服异步发消息通常不需要，保留备用）
  encrypt(message: string): string {
    const random16 = crypto.randomBytes(16);
    const msgBuf = Buffer.from(message, "utf8");
    const lenBuf = Buffer.alloc(4);
    lenBuf.writeUInt32BE(msgBuf.length, 0);
    const idBuf = Buffer.from(this.receiveId, "utf8");
    const raw = Buffer.concat([random16, lenBuf, msgBuf, idBuf]);
    const cipher = crypto.createCipheriv("aes-256-cbc", this.aesKey, this.aesKey.slice(0, 16));
    cipher.setAutoPadding(true);
    return Buffer.concat([cipher.update(raw), cipher.final()]).toString("base64");
  }

  generateSignature(timestamp: string, nonce: string, encrypt: string): string {
    const arr = [this.token, timestamp, nonce, encrypt].sort();
    return crypto.createHash("sha1").update(arr.join("")).digest("hex");
  }
}
