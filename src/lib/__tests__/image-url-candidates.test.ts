/**
 * `pickThumbCandidates` 单测 —— 首图 404 的前端降级候选链。
 *
 * 背景：生产实测 133 个 active 产品里 9 个首图指向 OSS 上不存在的文件
 * （如 `cmpdknix7002h11kwupfm486g/1.jpg` 返回 404），但它们在库里都有 10~40 张
 * 备用图。这里锁住候选链的构造规则：去占位图、按 sortOrder 顺序、去重、限量。
 */
import { describe, it, expect } from "vitest";

import { pickThumbCandidates } from "../image-url";

const OSS_HOST = "https://usedfarmmach-oss.oss-cn-beijing.aliyuncs.com";

/** 构造一张库内真实形态的图片（相对路径 + 绝对 URL 两种） */
function abs(key: string): { url: string } {
  return { url: `${OSS_HOST}/products/cmpdknix7002h11kwupfm486g/${key}` };
}

describe("pickThumbCandidates：空值兜底", () => {
  it("null → []", () => {
    expect(pickThumbCandidates(null)).toEqual([]);
  });

  it("undefined → []", () => {
    expect(pickThumbCandidates(undefined)).toEqual([]);
  });

  it("[] → []", () => {
    expect(pickThumbCandidates([])).toEqual([]);
  });

  it("候选为空时前端直接渲染占位块（调用方用长度 0 判断）", () => {
    expect(pickThumbCandidates([])).toHaveLength(0);
  });
});

describe("pickThumbCandidates：正常候选链", () => {
  it("3 张正常图 → 3 个完整 OSS URL（含缩略图处理参数）", () => {
    const out = pickThumbCandidates([abs("1.jpg"), abs("2.jpg"), abs("3.jpg")]);

    expect(out).toHaveLength(3);
    for (const [i, url] of out.entries()) {
      expect(url.startsWith(`${OSS_HOST}/products/cmpdknix7002h11kwupfm486g/`)).toBe(true);
      expect(url).toContain(`${i + 1}.jpg`);
      expect(url).toContain("?x-oss-process=image");
      expect(url).toContain("/format,webp/quality,q_75/resize,m_fixed,w_600");
    }
  });

  it("5 张图 + max = 3 → 只返回前 3 个（顺序即 sortOrder）", () => {
    const out = pickThumbCandidates(
      [abs("1.jpg"), abs("2.jpg"), abs("3.jpg"), abs("4.jpg"), abs("5.jpg")],
      3
    );

    expect(out).toHaveLength(3);
    expect(out[0]).toContain("1.jpg");
    expect(out[2]).toContain("3.jpg");
  });

  it("默认 max = 3", () => {
    const out = pickThumbCandidates([
      abs("1.jpg"),
      abs("2.jpg"),
      abs("3.jpg"),
      abs("4.jpg"),
    ]);

    expect(out).toHaveLength(3);
  });

  it("max = 1 时只返回首图", () => {
    const out = pickThumbCandidates([abs("1.jpg"), abs("2.jpg")], 1);

    expect(out).toHaveLength(1);
    expect(out[0]).toContain("1.jpg");
  });
});

describe("pickThumbCandidates：去重与过滤", () => {
  it("同一 URL 出现两次 → 去重后不重复", () => {
    const out = pickThumbCandidates([abs("fm.jpg"), abs("fm.jpg"), abs("2.jpg")]);

    expect(out).toHaveLength(2);
    expect(new Set(out).size).toBe(out.length);
    expect(out[1]).toContain("2.jpg");
  });

  it("去重后名额顺延补位（重复项不占 max 名额）", () => {
    const out = pickThumbCandidates(
      [abs("1.jpg"), abs("1.jpg"), abs("2.jpg"), abs("3.jpg")],
      3
    );

    expect(out).toHaveLength(3);
    expect(out[0]).toContain("1.jpg");
    expect(out[1]).toContain("2.jpg");
    expect(out[2]).toContain("3.jpg");
  });

  it("{ url: null } → 被跳过，不产生 placeholder 路径", () => {
    const out = pickThumbCandidates([{ url: null }, abs("2.jpg"), { url: undefined }]);

    expect(out).toHaveLength(1);
    expect(out[0]).toContain("2.jpg");
    for (const url of out) {
      expect(url).not.toContain("/images/placeholders/");
    }
  });

  it("全部为 null → []，绝不返回占位图", () => {
    const out = pickThumbCandidates([{ url: null }, { url: null }]);

    expect(out).toEqual([]);
  });
});

describe("pickThumbCandidates：相对路径补全", () => {
  it("/uploads/products/xxx.jpg → 补成 OSS 完整地址（生产已验证返回 200）", () => {
    const out = pickThumbCandidates([{ url: "/uploads/products/xxx.jpg" }]);

    expect(out).toHaveLength(1);
    expect(out[0].startsWith("https://")).toBe(true);
    expect(out[0]).toContain("/uploads/products/xxx.jpg");
    expect(out[0]).toContain("?x-oss-process=image");
  });

  it("相对路径与绝对 URL 混排时都保留", () => {
    const out = pickThumbCandidates([{ url: "/uploads/products/a.jpg" }, abs("2.jpg")], 2);

    expect(out).toHaveLength(2);
    expect(out[0]).toContain("/uploads/products/a.jpg");
    expect(out[1]).toContain("2.jpg");
  });
});
