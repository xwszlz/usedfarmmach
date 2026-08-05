/**
 * 邀请码生成：crypto.randomBytes base36，8 位，不引 nanoid（§1.2）。
 * 撞码由调用方捕获 P2002 后重试。
 */
import crypto from "crypto";

const BASE36_ALPHABET = "0123456789abcdefghijklmnopqrstuvwxyz";

export function generateInviteCode(length = 8): string {
  const bytes = crypto.randomBytes(length);
  let code = "";
  for (let i = 0; i < length; i++) {
    code += BASE36_ALPHABET[bytes[i] % 36];
  }
  return code;
}
