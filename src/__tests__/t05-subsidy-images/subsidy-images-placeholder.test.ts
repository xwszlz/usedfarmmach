/**
 * T05 详情页无图态回归：无 approved 图时逐字显示「暂无实拍图 · 归档机型」，
 * 且绝不调用 getImageUrl/getDetailImageUrl（否则会命中 tractor.svg 占位图）。
 * 组件是 async Server Component，返回 React element，这里递归收集文本做断言。
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const h = vi.hoisted(() => ({
  findMany: vi.fn(),
  getImageUrl: vi.fn(),
  getDetailImageUrl: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  prisma: { subsidyModelImage: { findMany: h.findMany } },
}));

vi.mock("@/lib/image-url", () => ({
  getImageUrl: h.getImageUrl,
  getDetailImageUrl: h.getDetailImageUrl,
}));

import { SubsidyModelImages } from "@/components/subsidy/SubsidyModelImages";

/** 递归收集 React element 树中的文本（跳过组件 type，只看 children）。 */
function collectText(node: unknown): string {
  if (node == null || typeof node === "boolean") return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(collectText).join("");
  if (typeof node === "object") {
    const el = node as { props?: { children?: unknown } };
    return collectText(el.props?.children);
  }
  return "";
}

const PROPS = { brandName: "品牌", category: "品类", modelName: "型号", locale: "zh" };

beforeEach(() => {
  h.findMany.mockReset().mockResolvedValue([]);
  h.getImageUrl.mockReset().mockImplementation((u: string | null) =>
    u ? String(u) : "/images/placeholders/tractor.svg"
  );
  h.getDetailImageUrl.mockReset().mockImplementation((u: string | null) =>
    u ? String(u) : "/images/placeholders/tractor.svg"
  );
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("① 无 approved 图 ⇒ 逐字占位框 + tractor.svg 0 命中", () => {
  it("findMany 返回空表 → 逐字「暂无实拍图 · 归档机型」，image-url 零调用", async () => {
    const el = await SubsidyModelImages(PROPS);
    const text = collectText(el);

    expect(text).toContain("暂无实拍图 · 归档机型");
    expect(text).not.toContain("tractor.svg");
    expect(h.getImageUrl).not.toHaveBeenCalled();
    expect(h.getDetailImageUrl).not.toHaveBeenCalled();

    // 组件只查 approved
    const arg = h.findMany.mock.calls[0][0] as Record<string, unknown>;
    expect((arg.where as Record<string, unknown>).reviewStatus).toBe("approved");
  });

  it("查询失败（抛错）也 fail-closed 回退占位框，image-url 零调用", async () => {
    h.findMany.mockRejectedValue(new Error("db down"));
    const el = await SubsidyModelImages(PROPS);
    const text = collectText(el);
    expect(text).toContain("暂无实拍图 · 归档机型");
    expect(text).not.toContain("tractor.svg");
    expect(h.getImageUrl).not.toHaveBeenCalled();
    expect(h.getDetailImageUrl).not.toHaveBeenCalled();
  });

  it("ossUrl 为空串的 approved 行同样视为无图（不交给 getImageUrl）", async () => {
    h.findMany.mockResolvedValue([
      {
        id: "i1",
        ossUrl: "",
        sourceUrl: "https://example.com/a.jpg",
        sourceDomain: "example.com",
        reviewedAt: new Date(),
        isPrimary: true,
        sortOrder: 0,
      },
    ]);
    const el = await SubsidyModelImages(PROPS);
    const text = collectText(el);
    expect(text).toContain("暂无实拍图 · 归档机型");
    expect(h.getDetailImageUrl).not.toHaveBeenCalled();
    expect(h.getImageUrl).not.toHaveBeenCalled();
  });
});

describe("② 对照：确有 approved 图时才走 image-url 转换", () => {
  it("非空 ossUrl 的 approved 行 → 调用 getDetailImageUrl，不再显示占位框", async () => {
    h.findMany.mockResolvedValue([
      {
        id: "i1",
        ossUrl: "https://usedfarmmach-oss.oss-cn-beijing.aliyuncs.com/subsidy-images/x.jpg",
        sourceUrl: "https://example.com/a.jpg",
        sourceDomain: "example.com",
        reviewedAt: new Date(),
        isPrimary: true,
        sortOrder: 0,
      },
    ]);
    const el = await SubsidyModelImages(PROPS);
    const text = collectText(el);
    expect(text).not.toContain("暂无实拍图 · 归档机型");
    expect(h.getDetailImageUrl).toHaveBeenCalledWith(
      "https://usedfarmmach-oss.oss-cn-beijing.aliyuncs.com/subsidy-images/x.jpg"
    );
  });
});
