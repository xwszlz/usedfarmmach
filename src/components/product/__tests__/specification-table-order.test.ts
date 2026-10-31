/**
 * 产品详情页「规格表」行顺序：品牌 → 品类 → 型号
 * ─────────────────────────────────────────────
 * 老板原话：「链接这里边有品牌，因为第二个就应该是品类，第三个才是型号」。
 * 即 13 行规格表的前三行必须固定为 **品牌 / 品类 / 型号**。
 *
 * 为什么不用 @testing-library/react：
 *   仓库只装了 vitest（`vitest.config.ts` 里 `environment: "node"`），
 *   既没有 jsdom 也没有 @testing-library/react，而本次任务要求「不新增 npm 依赖」。
 *   因此这里用 `react-dom/server` 的 `renderToStaticMarkup` 把组件直接渲染成
 *   HTML 字符串再断言 —— 纯 node 环境可用、零新增依赖，而且断言的是**真实渲染结果**，
 *   不是被抽取出来的中间结构，所以组件内部的渲染代码一行都不用改
 *   （满足「不许改变任何现有渲染行为」的硬约束）。
 *
 * 运行：npx vitest run src/components/product/__tests__/specification-table-order.test.ts
 */
import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { SpecificationTable } from "@/components/product/specification-table";

type SpecificationTableProps = Parameters<typeof SpecificationTable>[0];

/** 一行规格表拆出来的「标签 + 值」 */
interface RenderedRow {
  label: string;
  value: string;
}

const BRAND_NAME = "CLAAS";
const MODEL_NAME = "JAGUAR 980";
const CATEGORY_NAME = "青储机";
const OFFICIAL_WEBSITE = "https://www.claas.com";

/**
 * 造一份「所有字段都有值」的 props，这样任何一行都不会退化成「暂无」，
 * 断言时不会因为 fallback 文案而产生歧义。
 */
function makeProps(locale: string): SpecificationTableProps {
  return {
    brandName: BRAND_NAME,
    brandOfficialWebsite: OFFICIAL_WEBSITE,
    modelName: MODEL_NAME,
    year: 2016,
    workingHours: 3200,
    engineType: "柴油",
    enginePower: 530,
    driveSystem: "液压",
    mainConfig: "标准配置",
    overallLength: 6800,
    overallWidth: 3000,
    overallHeight: 3900,
    netWeight: 12800,
    conditionLabel: "9成新",
    categoryName: CATEGORY_NAME,
    brandOriginCountry: "DE",
    locale,
  };
}

/** 去掉 HTML 标签与 React 在相邻文本节点之间插入的 `<!-- -->` 注释 */
function stripTags(html: string): string {
  return html
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<[^>]*>/g, "")
    .trim();
}

/**
 * 渲染组件并按行拆出「标签 / 值」。
 *
 * 组件渲染出的结构固定为 `<tr><td>图标 + 标签</td><td>值</td></tr>`，
 * 所以按 `<tr>` 切片、再按 `</td>` 切单元格即可稳定拿到顺序。
 */
function renderRows(locale: string): RenderedRow[] {
  const html = renderToStaticMarkup(createElement(SpecificationTable, makeProps(locale)));
  return html
    .split(/<tr[\s>]/)
    .slice(1)
    .map((chunk) => {
      // split 时吃掉了 `<tr ` 里的 `<tr`，这里再把该标签的剩余部分（`class="..." >`）跳掉
      const rowBody = chunk.slice(chunk.indexOf(">") + 1);
      const cells = rowBody.split("</td>");
      return {
        label: stripTags(cells[0] ?? ""),
        value: stripTags(cells[1] ?? ""),
      };
    });
}

describe("SpecificationTable 行顺序：品牌 → 品类 → 型号", () => {
  it("中文站（zh）前三行是 品牌 / 品类 / 型号", () => {
    const rows = renderRows("zh");
    expect(rows.map((r) => r.label).slice(0, 3)).toEqual(["品牌", "品类", "型号"]);
  });

  it("英文站（en）前三行是 Brand / Category / Model", () => {
    const rows = renderRows("en");
    expect(rows.map((r) => r.label).slice(0, 3)).toEqual(["Brand", "Category", "Model"]);
  });

  it("俄文站（ru）前三行是 Бренд / Категория / Модель", () => {
    const rows = renderRows("ru");
    expect(rows.map((r) => r.label).slice(0, 3)).toEqual(["Бренд", "Категория", "Модель"]);
  });

  it("未收录的语种回退到英文标签，顺序不变（9 个语种全部覆盖）", () => {
    for (const locale of ["es", "pt", "fr", "ar", "hi", "de", "ja", "ko", "vi"]) {
      const rows = renderRows(locale);
      expect(rows.map((r) => r.label).slice(0, 3), `locale=${locale}`).toEqual([
        "Brand",
        "Category",
        "Model",
      ]);
    }
  });

  it("第 2 行（品类）的值是品类名，第 3 行（型号）的值是型号名 —— 防「只换了标签没换值」", () => {
    const rows = renderRows("zh");
    expect(rows[1].value).toBe(CATEGORY_NAME);
    expect(rows[2].value).toBe(MODEL_NAME);
  });

  it("第 1 行（品牌）仍是特殊行：品牌名 + 品牌官网外链，且链接没被挪到别的行", () => {
    const rows = renderRows("zh");
    expect(rows[0].value).toContain(BRAND_NAME);
    expect(rows[0].value).toContain("品牌官网");
    // 官网链接只应出现在第一行
    expect(rows.slice(1).some((r) => r.value.includes("品牌官网"))).toBe(false);
  });

  it("13 行规格表一行都没少（换序不能丢行）", () => {
    expect(renderRows("zh")).toHaveLength(13);
    expect(renderRows("en")).toHaveLength(13);
  });

  it("第 4 行起保持原有顺序（年份 → 工作小时 → 发动机类型 → …）", () => {
    const labels = renderRows("zh").map((r) => r.label);
    expect(labels).toEqual([
      "品牌",
      "品类",
      "型号",
      "年份",
      "工作小时",
      "发动机类型",
      "额定功率(HP)",
      "传动方式",
      "主要配置",
      "外形尺寸(长×宽×高 mm)",
      "整机重量(KG)",
      "产地",
      "设备状况",
    ]);
  });
});
