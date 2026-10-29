/**
 * `isOwnOssUrl` 单测 —— 锁住「前缀比较」这个具体绕过
 *
 * 背景：`internal/products` 原来用 `src.startsWith(OSS_HOST)` 判断"是不是小程序直传的自有 OSS 地址"，
 * 命中就跳过"下载 → 重传 OSS"这一步，直接把 URL 写进 productImage。
 * 前缀比较对 `https://<host>.evil.tld/x` 同样成立 ⇒ 任意外部地址都能冒充直传产物，
 * 绕过了这一步（而这一步正是 SSRF 守卫的唯一入口），恶意 URL 就此长期留在库里
 * （之后 valuation GET 会拿它去代取，形成二阶 SSRF）。
 *
 * 这里把那个 bypass 字符串原样钉死；同时也钉住"合法 OSS URL 必须仍然为真"，
 * 免得改成精确比较后把正常直传链路弄坏。
 */
import { describe, it, expect } from "vitest";

import { isOwnOssUrl, OSS_BUCKET_HOSTNAME } from "../oss-upload";

const LEGIT = `https://${OSS_BUCKET_HOSTNAME}/uploads/2026/01/a.jpg`;

describe("isOwnOssUrl：合法自有 OSS 地址", () => {
  it("标准直传 URL → true", () => {
    expect(isOwnOssUrl(LEGIT)).toBe(true);
  });

  it("带查询参数/签名 → true（hostname 精确即可）", () => {
    expect(isOwnOssUrl(`${LEGIT}?Expires=1&Signature=abc`)).toBe(true);
  });

  it("主机名大小写不同 → true（URL 解析器会把 hostname 规范成小写）", () => {
    expect(isOwnOssUrl(`https://${OSS_BUCKET_HOSTNAME.toUpperCase()}/a.jpg`)).toBe(true);
  });
});

describe("isOwnOssUrl：前缀比较时代的绕过必须为 false", () => {
  it.each([
    ["后缀域名劫持（真正的 bypass）", `https://${OSS_BUCKET_HOSTNAME}.evil.tld/x`],
    ["主机名出现在 path 里", `https://evil.tld/${OSS_BUCKET_HOSTNAME}/x`],
    ["主机名出现在 query 里", `https://evil.tld/?u=https://${OSS_BUCKET_HOSTNAME}/a.jpg`],
    ["userinfo 伪装", `https://${OSS_BUCKET_HOSTNAME}@evil.tld/x`],
    ["子域名伪装", `https://evil.${OSS_BUCKET_HOSTNAME}.x/a.jpg`],
    ["http 弱协议", `http://${OSS_BUCKET_HOSTNAME}/a.jpg`],
    ["同前缀不同桶", `https://${OSS_BUCKET_HOSTNAME}-test.oss-cn-beijing.aliyuncs.com/a.jpg`],
  ])("%s → false", (_label, url) => {
    expect(isOwnOssUrl(url)).toBe(false);
  });

  it("data URI / 裸路径 / 空串 / 非法 URL → false（不抛错）", () => {
    expect(isOwnOssUrl("data:image/jpeg;base64,AAAA")).toBe(false);
    expect(isOwnOssUrl("/uploads/a.jpg")).toBe(false);
    expect(isOwnOssUrl("")).toBe(false);
    expect(isOwnOssUrl("not a url")).toBe(false);
  });
});
