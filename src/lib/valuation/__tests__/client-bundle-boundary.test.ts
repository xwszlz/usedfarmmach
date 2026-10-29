/**
 * 客户端 bundle 边界 —— 静态守卫（替代不可用的 `server-only`）
 *
 * 背景（2026-11 构建事故，Vercel cle1 实测）：
 *   `formulas.ts` 被多个 `"use client"` 组件直接 import；它曾经同时从 `./image-analyzer`
 *   取**运行时**函数 `visualScoreToConditionFactor`，而 `image-analyzer` 因为要走 SSRF 守卫
 *   顶层依赖 `node:dns/promises` / `node:net`。于是 webpack 在为浏览器编译这条链时扑街：
 *   `UnhandledSchemeError: Reading from "node:dns/promises" is not handled by plugins`。
 *
 *   `tsc` 和 `vitest` **都发现不了这个问题**（一个只看类型、一个跑在 Node 环境下），
 *   只有真实的 `next build` 会报 —— 那次正是"本地以为没问题，构建才炸"。
 *
 * 防御思路：`server-only` 包（官方推荐做法）本仓库未安装，也不应为它新增依赖，
 * 于是用这份**源码静态检查**兜住同样的边界：从每个 `"use client"` 入口出发做一次
 * 运行时 import 图 DFS，任何一条路径抵达 Node-only 模块就立刻变红，
 * 报错直接说人话（指出该改到哪去），而不是等到 `next build` 甩一个 `UnhandledSchemeError`。
 */
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import path from "node:path";

const SRC = path.resolve(__dirname, "../../.."); // → src/

/** 被点名的 Node-only 模块：它们顶层依赖 Node 内置模块，必须断在客户端 bundle 之外 */
const NODE_ONLY_FILES = [
  "lib/net/ssrf-guard.ts",
  "lib/net/download-image.ts",
  "lib/valuation/image-analyzer.ts",
];

function readSource(absPath: string): string {
  return readFileSync(absPath, "utf8");
}

/** 递归列出 `src` 下的源文件（跳过 __tests__ 与 node_modules —— 它们不进客户端 bundle） */
function listSources(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) {
      if (entry === "__tests__" || entry === "node_modules") continue;
      out.push(...listSources(full));
    } else if (/\.tsx?$/.test(entry)) {
      out.push(full);
    }
  }
  return out;
}

/** 相对 src 的 POSIX 路径，用于稳定比较（Windows 下 path.resolve 给反斜杠） */
function relFromSrc(absPath: string): string {
  return path.relative(SRC, absPath).replace(/\\/g, "/");
}

/**
 * 抽取 import / export-from 语句的模块说明符，并判断是否 type-only
 * （`import type {...}` 与 `export { type X } from ...` 在编译期被擦除，不进 runtime graph）。
 */
function importsOf(source: string): Array<{ specifier: string; typeOnly: boolean }> {
  const re = /(?:^|\n)[ \t]*(?:import|export)\s[\s\S]*?from\s*["']([^"']+)["']/g;
  const out: Array<{ specifier: string; typeOnly: boolean }> = [];
  let match: RegExpExecArray | null;
  while ((match = re.exec(source))) {
    const stmt = match[0];
    const typeOnly = /\bimport\s+type\b/.test(stmt) || /\bexport\s+type\b/.test(stmt);
    out.push({ specifier: match[1], typeOnly });
  }
  return out;
}

/** 把一个 import 说明符解析成本仓库里的源文件绝对路径；外部包/ Node 内置返回 null */
function resolveToSource(fromFile: string, specifier: string): string | null {
  let base: string;
  if (specifier.startsWith("@/")) {
    base = path.join(SRC, specifier.slice(2));
  } else if (specifier.startsWith("./") || specifier.startsWith("../")) {
    base = path.resolve(path.dirname(fromFile), specifier);
  } else {
    return null; // 外部依赖 / Node 内置模块
  }
  const candidates = [base, `${base}.ts`, `${base}.tsx`, path.join(base, "index.ts"), path.join(base, "index.tsx")];
  for (const candidate of candidates) {
    if (existsSync(candidate) && statSync(candidate).isFile()) return candidate;
  }
  return null;
}

/** 建图：源文件 → 它**运行时**依赖的其它源文件（type-only 边不入图） */
function buildGraph(): Map<string, string[]> {
  const graph = new Map<string, string[]>();
  for (const file of listSources(SRC)) {
    const deps: string[] = [];
    for (const item of importsOf(readSource(file))) {
      if (item.typeOnly) continue;
      const target = resolveToSource(file, item.specifier);
      if (target) deps.push(relFromSrc(target));
    }
    graph.set(relFromSrc(file), deps);
  }
  return graph;
}

/**
 * 判断一个文件是不是 `"use client"` 入口。**必须是首行的 directive**，不能在注释里出现就算 ——
 * 否则 `image-analyzer.ts` 里那句"不能被任何 `use client` 组件引用"的注释
 * 会把 Node-only 模块自己变成"客户端入口"（第一版实现就是这么把自己绕进去的）。
 */
function isUseClientEntry(source: string): boolean {
  let text = source.replace(/^\uFEFF/, "");
  // directive 之前允许有注释（很多 CMS 生成的文件都这样），逐个剥掉
  for (;;) {
    const before = text;
    text = text
      .replace(/^\s*\/\*[\s\S]*?\*\/\s*/, "")
      .replace(/^\s*\/\/[^\n]*\n\s*/, "")
      .replace(/^\s*\n\s*/, "");
    if (text === before) break;
  }
  return /^["']use client["']\s*;?/.test(text);
}

/** 从 `entry` 出发做 DFS，返回抵达 `target` 的一条路径（到不了返回 null） */
function findPath(graph: Map<string, string[]>, entry: string, target: string): string[] | null {
  const stack: Array<{ node: string; trail: string[] }> = [{ node: entry, trail: [entry] }];
  const seen = new Set<string>([entry]);
  while (stack.length > 0) {
    const { node, trail } = stack.pop() as { node: string; trail: string[] };
    for (const dep of graph.get(node) || []) {
      if (dep === target) return [...trail, dep];
      if (seen.has(dep)) continue;
      seen.add(dep);
      stack.push({ node: dep, trail: [...trail, dep] });
    }
  }
  return null;
}

describe("客户端 bundle 不能牵到 Node-only 模块", () => {
  it("每个 \"use client\" 入口都到不了 ssrf-guard / download-image / image-analyzer", () => {
    const graph = buildGraph();
    const offenders: string[] = [];
    let entryCount = 0;
    for (const file of graph.keys()) {
      if (!isUseClientEntry(readSource(path.join(SRC, file)))) continue;
      entryCount += 1;
      for (const forbidden of NODE_ONLY_FILES) {
        const trail = findPath(graph, file, forbidden);
        if (trail) offenders.push(trail.join(" → "));
      }
    }
    // 保证这条守卫不是"因为压根没找到客户端入口"而变成恒真
    expect(entryCount, "src 下应当有一定数量的 \"use client\" 入口").toBeGreaterThan(20);
    expect(
      offenders,
      "客户端组件把 Node-only 链（node:dns/net，经 ssrf-guard）拖进了浏览器 bundle ⇒ next build 会以 UnhandledSchemeError 失败；请把需要的纯函数挪到 @/lib/valuation/condition 并从那里取"
    ).toEqual([]);
  });

  it("formulas.ts 对 ./image-analyzer 只能有 import type", () => {
    const bad = importsOf(readSource(path.join(SRC, "lib/valuation/formulas.ts"))).filter(
      (item) => item.specifier === "./image-analyzer" && !item.typeOnly
    );
    expect(
      bad,
      "formulas.ts 从 ./image-analyzer 取了运行时符号 ⇒ Node 内置模块会进浏览器 bundle ⇒ next build 必挂；请改从 ./condition 取"
    ).toEqual([]);
  });

  it("condition.ts 必须保持零运行时依赖（只允许 import type）", () => {
    const all = importsOf(readSource(path.join(SRC, "lib/valuation/condition.ts")));
    expect(all.length, "condition.ts 至少要 import type { AiLocale }").toBeGreaterThan(0);
    expect(
      all.filter((item) => !item.typeOnly),
      "condition.ts 处在客户端 bundle 里，任何运行时 import 都可能把 Node-only 链重新拖回去"
    ).toEqual([]);
  });
});
