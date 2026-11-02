/**
 * 产品图片类别与排序权重 —— 单元测试
 * 覆盖：优先级映射、categoryPriority 兜底、PHOTO_SUGGESTION_CATEGORIES 顺序、
 * prioritizeKeyImages 排序与稳定/不变量、KEY_RECOGNITION_CATEGORIES、toImageCategory。
 */
import { describe, it, expect } from "vitest";
import {
  ImageCategory,
  IMAGE_CATEGORY_PRIORITY,
  PHOTO_SUGGESTION_CATEGORIES,
  KEY_RECOGNITION_CATEGORIES,
  categoryPriority,
  prioritizeKeyImages,
  toImageCategory,
} from "@/lib/products/image-category";

describe("IMAGE_CATEGORY_PRIORITY 映射", () => {
  it("关键类别权重符合预期（OVERALL=1 … DASHBOARD=3 … DAMAGE=12）", () => {
    expect(IMAGE_CATEGORY_PRIORITY[ImageCategory.OVERALL]).toBe(1);
    expect(IMAGE_CATEGORY_PRIORITY[ImageCategory.NAMEPLATE]).toBe(2);
    expect(IMAGE_CATEGORY_PRIORITY[ImageCategory.DASHBOARD]).toBe(3);
    expect(IMAGE_CATEGORY_PRIORITY[ImageCategory.CAB]).toBe(4);
    expect(IMAGE_CATEGORY_PRIORITY[ImageCategory.ENGINE]).toBe(5);
    expect(IMAGE_CATEGORY_PRIORITY[ImageCategory.WORKING_MECHANISM]).toBe(6);
    expect(IMAGE_CATEGORY_PRIORITY[ImageCategory.CHASSIS]).toBe(7);
    expect(IMAGE_CATEGORY_PRIORITY[ImageCategory.REAR]).toBe(8);
    expect(IMAGE_CATEGORY_PRIORITY[ImageCategory.FRONT_ATTACHMENT]).toBe(9);
    expect(IMAGE_CATEGORY_PRIORITY[ImageCategory.SIDE]).toBe(10);
    expect(IMAGE_CATEGORY_PRIORITY[ImageCategory.DETAIL]).toBe(11);
    expect(IMAGE_CATEGORY_PRIORITY[ImageCategory.DAMAGE]).toBe(12);
  });

  it("仪表盘(3)紧跟铭牌(2)之后、整机全貌(1)最前（老板诉求）", () => {
    expect(IMAGE_CATEGORY_PRIORITY[ImageCategory.OVERALL]).toBeLessThan(
      IMAGE_CATEGORY_PRIORITY[ImageCategory.NAMEPLATE]
    );
    expect(IMAGE_CATEGORY_PRIORITY[ImageCategory.NAMEPLATE]).toBeLessThan(
      IMAGE_CATEGORY_PRIORITY[ImageCategory.DASHBOARD]
    );
  });
});

describe("categoryPriority", () => {
  it("无类别（undefined/null）返回兜底权重 999（排最后）", () => {
    expect(categoryPriority(undefined)).toBe(999);
    expect(categoryPriority(null)).toBe(999);
  });
  it("有类别返回映射权重", () => {
    expect(categoryPriority(ImageCategory.NAMEPLATE)).toBe(2);
    expect(categoryPriority(ImageCategory.DASHBOARD)).toBe(3);
  });
});

describe("PHOTO_SUGGESTION_CATEGORIES 顺序", () => {
  it("仪表盘排在第 3 位（紧挨型号铭牌之后）", () => {
    expect(PHOTO_SUGGESTION_CATEGORIES[0].category).toBe(ImageCategory.OVERALL);
    expect(PHOTO_SUGGESTION_CATEGORIES[1].category).toBe(ImageCategory.NAMEPLATE);
    expect(PHOTO_SUGGESTION_CATEGORIES[2].category).toBe(ImageCategory.DASHBOARD);
    expect(PHOTO_SUGGESTION_CATEGORIES).toHaveLength(12);
  });
});

describe("KEY_RECOGNITION_CATEGORIES", () => {
  it("仅含铭牌与仪表盘（识别缺图提醒用）", () => {
    expect(KEY_RECOGNITION_CATEGORIES).toEqual([
      ImageCategory.NAMEPLATE,
      ImageCategory.DASHBOARD,
    ]);
  });
});

describe("prioritizeKeyImages", () => {
  it("按优先级升序：OVERALL(1) > NAMEPLATE(2) > DASHBOARD(3) > CAB(4) > 无类别(999)", () => {
    const images = [
      { url: "a", imageCategory: ImageCategory.CAB },
      { url: "b", imageCategory: ImageCategory.OVERALL },
      { url: "c", imageCategory: ImageCategory.DASHBOARD },
      { url: "d", imageCategory: ImageCategory.NAMEPLATE },
      { url: "e", imageCategory: undefined },
    ];
    const ordered = prioritizeKeyImages(images);
    expect(ordered.map((i) => i.url)).toEqual(["b", "d", "c", "a", "e"]);
  });

  it("无 OVERALL 时，铭牌/仪表盘排在最前两位（乱序输入也稳定）", () => {
    const images = [
      { url: "a", imageCategory: ImageCategory.CAB },
      { url: "c", imageCategory: ImageCategory.DASHBOARD },
      { url: "d", imageCategory: ImageCategory.NAMEPLATE },
      { url: "e", imageCategory: undefined },
      { url: "x", imageCategory: ImageCategory.REAR },
    ];
    const ordered = prioritizeKeyImages(images);
    expect(ordered[0].url).toBe("d"); // NAMEPLATE (2) 第 1
    expect(ordered[1].url).toBe("c"); // DASHBOARD (3) 第 2
    // 铭牌/仪表盘均排在 CAB/REAR/无类别之前
    const urls = ordered.map((i) => i.url);
    expect(urls.indexOf("d")).toBeLessThan(urls.indexOf("a"));
    expect(urls.indexOf("d")).toBeLessThan(urls.indexOf("x"));
    expect(urls.indexOf("c")).toBeLessThan(urls.indexOf("a"));
    expect(urls.indexOf("c")).toBeLessThan(urls.indexOf("e"));
    expect(ordered[ordered.length - 1].url).toBe("e"); // 无类别排最后
  });

  it("不修改入参（返回新数组）", () => {
    const images = [
      { url: "x", imageCategory: ImageCategory.REAR },
      { url: "y", imageCategory: ImageCategory.NAMEPLATE },
    ];
    const snapshot = JSON.stringify(images);
    const out = prioritizeKeyImages(images);
    expect(out).not.toBe(images); // 不同引用
    expect(JSON.stringify(images)).toBe(snapshot); // 入参未变
  });

  it("同权重保持原相对顺序（稳定排序，不依赖引擎实现）", () => {
    const images = [
      { url: "p1", imageCategory: ImageCategory.DETAIL },
      { url: "p2", imageCategory: ImageCategory.DETAIL },
      { url: "p3", imageCategory: ImageCategory.DETAIL },
    ];
    const ordered = prioritizeKeyImages(images);
    expect(ordered.map((i) => i.url)).toEqual(["p1", "p2", "p3"]);
  });

  it("全部无类别时保持原序（兼容老图）", () => {
    const images = [
      { url: "o1", imageCategory: undefined },
      { url: "o2", imageCategory: null },
      { url: "o3", imageCategory: undefined },
    ];
    expect(prioritizeKeyImages(images).map((i) => i.url)).toEqual(["o1", "o2", "o3"]);
  });
});

describe("toImageCategory", () => {
  it("合法字符串归一化，非法/空返回 null", () => {
    expect(toImageCategory("DASHBOARD")).toBe(ImageCategory.DASHBOARD);
    expect(toImageCategory("NAMEPLATE")).toBe(ImageCategory.NAMEPLATE);
    expect(toImageCategory("nope")).toBeNull();
    expect(toImageCategory(undefined)).toBeNull();
    expect(toImageCategory(null)).toBeNull();
  });
});
