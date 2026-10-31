/**
 * 编辑页保存载荷：`workingHours` 不能再被客户端"真值判断"吃掉 0（源码守卫）
 *
 * 为什么要用"读源码"这种手段锁，而不是直接调用：
 *   - `[id]/edit/page.tsx` 是 App Router 的 page 文件，Next 只接受它规定的少数导出
 *     （default / metadata / dynamic / revalidate…），导出测试辅助函数属于自找麻烦；
 *   - `handleSave` 是组件内部闭包，node 环境里没有 React 渲染就不可达。
 * 所以这里守住的是**那几行代码本身**：旧的危险写法不许回来，新的"只把空当空"必须在。
 * （匹配前会剥掉注释，否则注释里为说明问题而引用的旧写法会误判。）
 *
 * 被锁死的 Bug（2026-10-31 之前）：
 *
 *   workingHours: form.workingHours ? Number(form.workingHours) : null,
 *
 * `0` 是合法业务值（全新机 / 刚试机），而数字 0 是 falsy ⇒ 被写成 null。
 * 这是工时 0 链路上的**第三道** falsy 闸（第一道在 recognize API、第二道在 AI 回填）。
 *
 * 修法（本文件所守卫的实现）：客户端不再自己 Number 转换，只把「空」归一成 null，
 * 其余原样透传，把「空 vs 零」的判定收敛到后端 PUT 一处。
 * 那条判定本身有真实的运行时覆盖：见
 * `src/app/api/seller/products/[id]/__tests__/put-working-hours.test.ts`
 * （0 → 0、"" → null、"abc" → null 均已实测）。
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
// 本文件位于 src/components/seller/__tests__/，向上三层到 src/，再拼编辑页路径
const pagePath = resolve(here, "../../../app/[locale]/seller/products/[id]/edit/page.tsx");

/** 去掉 // 行注释与 /* *\/ 块注释，并把所有空白压成单空格 —— 只留"会真的执行的代码" */
function readPageCode(): string {
  const raw = readFileSync(pagePath, "utf8");
  return raw
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/(^|[^:])\/\/[^\n]*/g, "$1 ")
    .replace(/\s+/g, " ");
}

describe("编辑页保存载荷：workingHours 的 0 不能被吃掉", () => {
  it("旧的危险写法 `workingHours: form.workingHours ? ... : null` 必须已消失", () => {
    const code = readPageCode();
    // 任何以 `form.workingHours ?` 开头的三元都属于真值判断，一律不许
    expect(code).not.toMatch(/form\.workingHours \?/);
    expect(code).not.toMatch(/workingHours: form\.workingHours \?/);
  });

  it("必须保留「空 → null，其余原样透传」的写法（三处空判 + 透传）", () => {
    const code = readPageCode();
    expect(code).toContain("form.workingHours === null");
    expect(code).toContain("form.workingHours === undefined");
    expect(code).toContain('form.workingHours === ""');
    // 透传分支：把表单值原样交给后端，而不是在客户端 Number(...)
    expect(code).toMatch(
      /workingHours: form\.workingHours === null \|\| form\.workingHours === undefined \|\| form\.workingHours === "" \? null : form\.workingHours/
    );
  });

  it("其余 5 个数值字段仍保持原有 Number 转换（本轮刻意不动，避免改变既有语义）", () => {
    const code = readPageCode();
    for (const field of ["enginePower", "overallLength", "overallWidth", "overallHeight", "netWeight"]) {
      expect(code).toContain(`${field}: form.${field} ? Number(form.${field}) : null`);
    }
  });
});
