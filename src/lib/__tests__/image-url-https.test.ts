/**
 * `getOssUrl` 混合内容升级单测 —— 锁住「只升级自家 OSS 的 http 链接」
 *
 * 背景：库里有 5 个 active 产品的封面图存的是 `http://`（含首页 top5 的 MF 3404 前 3 张）。
 * https 页面加载 http 图片属于混合内容，部分浏览器/环境会直接拦截 ⇒ 首图 404 降级候选链
 * 3 张全挂 ⇒ 最终落占位块。修法是在 `getOssUrl` 里把**自家 OSS 域名**的 http 升级为 https。
 *
 * 两条底线必须同时成立，本文件各锁一半：
 *   1. 自家 OSS 的 http URL 必须升级（否则混合内容拦截照旧）；
 *   2. 第三方站点的 http URL 一个字都不许改（不擅自替别人决定协议）。
 *
 * 另外钉死「hostname 精确相等比较」：
 * `http://<own-oss>.evil.tld/x.jpg` 这类后缀域名劫持必须**不升级**。
 * 用 includes / startsWith 做域名判断会让它通过，这正是本项目踩过的 SSRF 坑
 * （见 src/lib/oss-upload.ts 的 isOwnOssUrl 及其单测）。
 */
import { describe, it, expect } from "vitest";

import { getImageUrl, getDetailImageUrl, pickThumbCandidates } from "../image-url";

/**
 * 与 src/lib/image-url.ts 顶部的默认值保持一致：
 * `NEXT_PUBLIC_OSS_BASE_URL || OSS_BASE_URL || "https://usedfarmmach-oss.oss-cn-beijing.aliyuncs.com"`
 * 测试环境通常没配 env，因此实际生效的就是这个默认地址。
 */
const OSS_HOST = "usedfarmmach-oss.oss-cn-beijing.aliyuncs.com";
const OSS_HTTPS_BASE = `https://${OSS_HOST}`;

/** 缩略图压缩参数（getImageUrl 会给自家 OSS 图片追加） */
const THUMB_SUFFIX = "?x-oss-process=image/format,webp/quality,q_75/resize,m_fixed,w_600";

/** 占位图路径（无图时的公共兜底） */
const PLACEHOLDER = "/images/placeholders/tractor.svg";

describe("getImageUrl：自家 OSS 的 http 链接必须升级为 https", () => {
  it("http 自有 OSS 图片 → 结果以 https:// 开头", () => {
    const out = getImageUrl(`http://${OSS_HOST}/products/x/1.jpg`);

    expect(out.startsWith("https://")).toBe(true);
    // 路径不能被改动
    expect(out).toContain(`/products/x/1.jpg`);
    // 升级后仍属自家 OSS ⇒ 压缩参数照旧追加（既有行为不许变）
    expect(out).toBe(`${OSS_HTTPS_BASE}/products/x/1.jpg${THUMB_SUFFIX}`);
  });

  it("getDetailImageUrl 同样升级，且仍追加详情大图参数", () => {
    const out = getDetailImageUrl(`http://${OSS_HOST}/products/x/1.jpg`);

    expect(out.startsWith("https://")).toBe(true);
    expect(out).toContain("x-oss-process=image");
    expect(out).toContain("w_1200");
  });

  it("升级后 hostname 不变（只是协议改了，不能顺手改域名）", () => {
    const out = getImageUrl(`http://${OSS_HOST}/products/x/1.jpg`);

    expect(new URL(out).hostname).toBe(OSS_HOST);
    expect(new URL(out).protocol).toBe("https:");
  });
});

describe("getImageUrl：第三方 http 链接原样保留", () => {
  it("第三方 http 图片 → 仍是 http://，不被升级", () => {
    const out = getImageUrl("http://example.com/x.jpg");

    expect(out).toBe("http://example.com/x.jpg");
    expect(out.startsWith("http://")).toBe(true);
  });

  it("第三方 http 图片也不追加 OSS 压缩参数", () => {
    const out = getImageUrl("http://example.com/x.jpg");

    expect(out.includes("x-oss-process")).toBe(false);
  });
});

describe("getImageUrl：https 与 /uploads/ 分支的既有行为不变", () => {
  it("https 自有 OSS 图片 → 协议不变，仍追加 ?x-oss-process", () => {
    const src = `${OSS_HTTPS_BASE}/products/x/1.jpg`;
    const out = getImageUrl(src);

    expect(out).toBe(`${src}${THUMB_SUFFIX}`);
  });

  it("https 自有 OSS 图片已带 x-oss-process → 不重复追加", () => {
    const src = `${OSS_HTTPS_BASE}/products/x/1.jpg?x-oss-process=image/resize,w_300`;
    const out = getImageUrl(src);

    expect(out).toBe(src);
  });

  it("/uploads/ 相对路径 → 拼成 https 完整地址", () => {
    const out = getImageUrl("/uploads/products/x/1.jpg");

    expect(out.startsWith(OSS_HTTPS_BASE)).toBe(true);
    expect(out).toBe(`${OSS_HTTPS_BASE}/uploads/products/x/1.jpg${THUMB_SUFFIX}`);
  });
});

describe("getImageUrl：空值兜底", () => {
  it("null → 占位图", () => {
    expect(getImageUrl(null)).toBe(PLACEHOLDER);
  });

  it("undefined → 占位图", () => {
    expect(getImageUrl(undefined)).toBe(PLACEHOLDER);
  });

  it('空字符串 → 占位图', () => {
    expect(getImageUrl("")).toBe(PLACEHOLDER);
  });

  it("getDetailImageUrl 空值 → 同一个占位图", () => {
    expect(getDetailImageUrl(null)).toBe(PLACEHOLDER);
    expect(getDetailImageUrl("")).toBe(PLACEHOLDER);
  });
});

describe("getImageUrl：hostname 必须是精确相等比较（防后缀域名劫持）", () => {
  it.each([
    ["后缀域名劫持", `http://${OSS_HOST}.evil.tld/x.jpg`],
    ["子域名伪装", `http://sub.${OSS_HOST}/x.jpg`],
    ["hostname 出现在 path 里", `http://evil.tld/${OSS_HOST}/x.jpg`],
    ["hostname 出现在 query 里", `http://evil.tld/?u=http://${OSS_HOST}/x.jpg`],
    ["userinfo 伪装", `http://${OSS_HOST}@evil.tld/x.jpg`],
  ])("%s → 不升级，仍是 http://", (_label, url) => {
    const out = getImageUrl(url);

    expect(out.startsWith("http://")).toBe(true);
  });
});

/**
 * 与 #370「Fix/home top4 dynamic and image fallback」的联动锁。
 *
 * product-card 的首图降级链是：
 *   pickThumbCandidates(images) → getImageUrl() → getOssUrl()（本文件加固的那一层）
 * 两件事必须同时在链路上：只做候选链，那 5 个 http 首图产品 3 张候选全被混合内容拦截；
 * 只做 https 升级，那 9 个首图 404 产品仍然没有备用图。
 * 这里断言「喂给候选链的 http 自有 OSS 地址，出来就是 https」，不靠人脑推。
 */
describe("pickThumbCandidates：候选链必须吃到 http→https 升级", () => {
  it("唯一候选是 http 自有 OSS → 返回值以 https:// 开头", () => {
    const out = pickThumbCandidates(
      [{ url: `http://${OSS_HOST}/products/x/1.jpg` }],
      1
    );

    expect(out).toHaveLength(1);
    expect(out[0].startsWith("https://")).toBe(true);
    expect(out[0]).toBe(`${OSS_HTTPS_BASE}/products/x/1.jpg${THUMB_SUFFIX}`);
  });

  it("候选混合（自有 http + 第三方 http + 自有 https）→ 只升级自家那张", () => {
    const out = pickThumbCandidates(
      [
        { url: `http://${OSS_HOST}/products/x/1.jpg` },
        { url: "http://example.com/y.jpg" },
        { url: `${OSS_HTTPS_BASE}/products/x/2.jpg` },
      ],
      3
    );

    expect(out).toHaveLength(3);
    expect(out[0].startsWith("https://")).toBe(true);
    expect(out[1]).toBe("http://example.com/y.jpg");
    expect(out[2].startsWith("https://")).toBe(true);
  });

  it("列表页 take: 5 喂进来 → 默认只取 3 张候选（max 默认 3）", () => {
    const images = [1, 2, 3, 4, 5].map((i) => ({ url: `/uploads/products/x/${i}.jpg` }));
    const out = pickThumbCandidates(images);

    expect(out).toHaveLength(3);
    expect(out.every((u) => u.startsWith("https://"))).toBe(true);
  });

  it("空 url / null 被过滤，不会把占位图当候选", () => {
    const out = pickThumbCandidates([{ url: null }, { url: "" }], 3);

    expect(out).toEqual([]);
  });
});
