/**
 * `parseMarkdownSections` 回归守卫 · 报告尾部「结构化数据（JSON）」空小节
 * ─────────────────────────────────────────────────────────
 * 真实故障（老板实测）：深度分析报告结尾多出一个「§7 结构化数据（JSON）」小节，
 * 只有标题、没有内容。
 *
 * 根因：清洗只删了 ```json 代码块，模型写的 `## 结构化数据（JSON）` 标题
 * 与「最后附上一个JSON代码块…」引导语原样留下，被 `split(/^## /)` 切成最后一节。
 *
 * 本文件锁死三件事：
 *   ① 含残留标题的输入，产出**不含**该 section（网页版与「下载 HTML」共用本函数）；
 *   ② 清洗不得误伤正常小节，也不得把整份报告洗成空白页；
 *   ③ 正文为空的小节一律不渲染（空标题就是这次事故的观感问题）。
 *
 * 运行：`npx vitest run src/components`
 */
import { describe, expect, it } from "vitest";
import { parseMarkdownSections } from "@/components/valuation/analysis-report-view";

/** 至少含一个 ```json 围栏块的最小报告（用于拼装各种残留形态） */
const JSON_FENCE = "```json\n{\"brand\":\"CLAAS\",\"confidence\":0.9}\n```";

describe("parseMarkdownSections · 剥离尾部 JSON 小节", () => {
  it("残留 `## 结构化数据（JSON）` 标题 + 引导语 + 围栏块 → 该 section 整段消失", () => {
    const md = [
      "## 设备概况",
      "这是一台 2016 年的克拉斯方捆机，工时 4200 小时。",
      "",
      "## 车况评估",
      "外观漆面良好，液压无渗漏。",
      "",
      "## 结构化数据（JSON）",
      "最后附上一个JSON代码块，包含上述所有字段：",
      JSON_FENCE,
      "",
    ].join("\n");

    const sections = parseMarkdownSections(md);

    expect(sections.map((s) => s.title)).toEqual(["设备概况", "车况评估"]);
    // 标题、引导语、裸 JSON 一个都不能漏到正文里
    for (const section of sections) {
      expect(section.title).not.toContain("结构化数据");
      expect(section.content).not.toContain("最后附上");
      expect(section.content).not.toContain("```");
      expect(section.content).not.toContain("\"brand\"");
    }
  });

  it("只有标题、连引导语都没有（最典型的残留形态）→ 整段消失", () => {
    const md = "## 结论\n优先出口中亚。\n\n## 结构化数据（JSON）\n";
    const sections = parseMarkdownSections(md);
    expect(sections).toHaveLength(1);
    expect(sections[0].title).toBe("结论");
  });

  it("只有一行 `## 结构化数据（JSON）` 的报告 → 不产出任何 section（不白屏成空标题）", () => {
    expect(parseMarkdownSections("## 结构化数据（JSON）")).toEqual([]);
    expect(parseMarkdownSections("## 结构化数据")).toEqual([]);
  });

  it("模型按语种换掉标题名（外语标题 + JSON 字样）→ 同样剥离", () => {
    const md = "## Overview\nGood condition.\n\n## Structured Data (JSON)\n" + JSON_FENCE;
    const sections = parseMarkdownSections(md);
    expect(sections.map((s) => s.title)).toEqual(["Overview"]);
  });

  it("被 max_tokens 截断、缺闭合围栏的尾部 JSON → 剥掉", () => {
    const md = "## 结论\n优先中亚。\n\n## 结构化数据（JSON）\n```json\n{\"brand\":\"CLAAS\",\"confid";
    const sections = parseMarkdownSections(md);
    expect(sections.map((s) => s.title)).toEqual(["结论"]);
    expect(sections[0].content).not.toContain("{");
  });

  it("独占一行的空围栏 ``` 也被清掉", () => {
    const sections = parseMarkdownSections("## 结论\n优先中亚。\n```\n");
    expect(sections).toHaveLength(1);
    expect(sections[0].content).not.toContain("```");
  });
});

describe("parseMarkdownSections · 正文为空的小节不渲染", () => {
  it("清洗后正文为空的小节被丢弃（空标题就是这次投诉的观感问题）", () => {
    const md = "## 一、设备概况\n\n## 二、车况评估\n外观良好。";
    const sections = parseMarkdownSections(md);
    expect(sections.map((s) => s.title)).toEqual(["二、车况评估"]);
  });
});

describe("parseMarkdownSections · 不误伤正常报告", () => {
  it("三个正常小节全部保留，顺序与内容不变", () => {
    const md = [
      "## 一、设备概况",
      "**品牌**：CLAAS",
      "",
      "## 二、技术参数",
      "- 发动机：Deutz TCD 6.1",
      "- 整机重量：6200 kg",
      "",
      "## 三、购买建议",
      "建议核实工时真伪后再议价。",
    ].join("\n");
    const sections = parseMarkdownSections(md);
    expect(sections.map((s) => s.title)).toEqual(["一、设备概况", "二、技术参数", "三、购买建议"]);
    expect(sections[1].content).toContain("Deutz TCD 6.1");
    expect(sections[2].content).toContain("议价");
  });

  it("段落间的空行保留（mdToHtml 靠 `\\n\\n` 切段，压成单换行会毁掉段落结构）", () => {
    const md = "## 结论\n第一段。\n\n\n\n第二段。";
    const sections = parseMarkdownSections(md);
    expect(sections).toHaveLength(1);
    expect(sections[0].content).toContain("第一段。\n\n第二段。");
  });

  it("兜底：通篇没有 `## ` 标题的单段报告不被洗成空白页", () => {
    const sections = parseMarkdownSections("这台机器状态良好，建议按 52 万挂牌。");
    expect(sections).toHaveLength(1);
    expect(sections[0].title).toContain("这台机器状态良好");
  });

  it("空输入不抛错", () => {
    expect(parseMarkdownSections("")).toEqual([]);
    expect(parseMarkdownSections(undefined as unknown as string)).toEqual([]);
  });
});
