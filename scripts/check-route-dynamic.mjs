#!/usr/bin/env node
/**
 * 守门：拦截「构建期静态固化」的 GET 路由
 *
 * 背景
 * ----
 * 本仓库同一份代码跑两个环境：.com（Vercel，构建期连生产库）与 .cn
 * （阿里云 ECS，CI 内 `next build` 时连的是**空库** —— 数据不出境，构建期不接生产库）。
 *
 * Next.js 14 会把「GET Route Handler 且执行路径上不触碰 cookies()/headers()/
 * searchParams、又没有 `export const dynamic`」的路由在 `next build` 阶段
 * **静态预渲染并把结果固化进镜像**。在 .cn 上这等于把"空库快照"永久烧进镜像。
 *
 * 注意 `export const revalidate = N` **不能**阻止构建期预渲染 —— 它只在预渲染
 * 结果之上叠加 ISR，所以部署后仍有一个窗口返回空快照。唯一可靠解是
 * `export const dynamic = "force-dynamic"`。
 *
 * 历史事故（本脚本要防的正是这一类）
 * ----------------------------------
 *   /api/brands-categories            .cn 恒返回 44 字节空数组
 *   /api/products/filters             .cn 恒返回 119 字节全空（带 revalidate=3600 也没救）
 *   /api/parts/catalog                .cn 恒返回 26 字节空导航树
 *   /api/miniapp/brands-categories    .cn 恒返回 53 字节空体，且无 revalidate → 永久固化
 *
 * 判定规则
 * --------
 * 一个路由**报错**，当且仅当同时满足：
 *   1. 路径不含动态段 `[xxx]` —— 动态段无 generateStaticParams 时按需渲染，不会被烤；
 *   2. 导出了 GET；
 *   3. 没有 `export const dynamic`；
 *   4. 读库（文件内出现 `prisma.xxx`，或 import 的 `@/lib/*` 里出现 `prisma.xxx`，
 *      向下解析一层）；
 *   5. 不在 ALLOWLIST 里。
 *
 * 另外给一条**警告**（不阻断）：`dynamic` 与 `revalidate` 并存 —— 后者是无效配置。
 *
 * 用法
 * ----
 *   node scripts/check-route-dynamic.mjs            # 在仓库根目录跑
 *   node scripts/check-route-dynamic.mjs --root .   # 显式指定根目录
 */

import fs from "node:fs";
import path from "node:path";

const argv = process.argv.slice(2);
const rootIdx = argv.indexOf("--root");
const ROOT = path.resolve(
  rootIdx >= 0 && argv[rootIdx + 1] ? argv[rootIdx + 1] : process.cwd()
);
const API_DIR = path.join(ROOT, "src", "app", "api");

/**
 * 允许清单。
 *
 * 准入条件（必须逐条确认，不能只看"文件里出现过 request"）：
 *   构建期的实际执行路径上**一定会**执行到读取 request / searchParams 的代码。
 * 因为一旦读到，Next 就判定为动态、不会静态化。
 *
 * ⚠️ 反面教材：`/api/miniapp/brands-categories` 形参是 `request: NextRequest`，
 * 文件里也有 `req.headers`，看起来"读了 request"。但 `.cn` 的构建环境没有
 * `MINIAPP_API_KEY`，`requireAuth()` 在读到 headers **之前**就 `return true`
 * —— 构建期根本没碰到 headers，于是照样被烤成空体。
 * **所以"文件里出现 request"不等于安全，必须保证那段代码在构建期会执行到。**
 *
 * 每条都必须写明依据；新增条目请在 PR 描述里解释你为什么确信它是动态的。
 */
const ALLOWLIST = {};

const RE_GET = /export\s+(?:async\s+)?function\s+GET\b|export\s+const\s+GET\s*=/;
const RE_DYNAMIC = /export\s+const\s+dynamic\s*=/;
const RE_REVALIDATE = /export\s+const\s+revalidate\s*=/;
const RE_PRISMA = /\bprisma\s*\.\s*[A-Za-z_$]/;
const RE_LIB_IMPORT = /from\s+["']@\/lib\/([^"']+)["']/g;

const EXT = ["", ".ts", ".tsx", ".js", ".jsx", "/index.ts", "/index.tsx"];

function read(p) {
  try {
    return fs.readFileSync(p, "utf8");
  } catch {
    return null;
  }
}

function resolveLib(spec) {
  const base = path.join(ROOT, "src", "lib", spec);
  for (const e of EXT) {
    const p = base + e;
    if (fs.existsSync(p) && fs.statSync(p).isFile()) return p;
  }
  return null;
}

/** 文件自身是否读库（含向下解析一层的 @/lib/*） */
function libReadsDb(src, depth = 1) {
  if (RE_PRISMA.test(src)) return true;
  if (depth <= 0) return false;
  for (const m of src.matchAll(RE_LIB_IMPORT)) {
    const p = resolveLib(m[1]);
    if (!p) continue;
    const s = read(p);
    if (s && libReadsDb(s, depth - 1)) return true;
  }
  return false;
}

function walk(dir, out = []) {
  let items;
  try {
    items = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const it of items) {
    const p = path.join(dir, it.name);
    if (it.isDirectory()) walk(p, out);
    else if (it.name === "route.ts" || it.name === "route.js") out.push(p);
  }
  return out;
}

if (!fs.existsSync(API_DIR)) {
  console.error(`找不到 ${API_DIR} —— 请从仓库根目录运行，或用 --root 指定。`);
  process.exit(2);
}

const files = walk(API_DIR).sort();
const errors = [];
const warnings = [];
const allowed = [];
let checked = 0;
let skippedDynamic = 0;
let skippedNonDb = 0;

for (const abs of files) {
  const rel = path.relative(ROOT, abs).split(path.sep).join("/");
  const src = read(abs);
  if (src == null) continue;

  if (!RE_GET.test(src)) continue;
  checked++;

  if (rel.includes("[")) {
    skippedDynamic++;
    continue;
  }

  const hasDynamic = RE_DYNAMIC.test(src);
  const hasRevalidate = RE_REVALIDATE.test(src);

  if (hasDynamic && hasRevalidate) {
    const dLine = src.slice(0, src.search(RE_DYNAMIC)).split("\n").length;
    const rLine = src.slice(0, src.search(RE_REVALIDATE)).split("\n").length;
    warnings.push(
      `${rel}  L${dLine} 与 L${rLine}：dynamic 与 revalidate 并存 —— ` +
        `force-dynamic 优先级更高，revalidate 是无效配置，应删除`
    );
  }

  if (hasDynamic) continue;

  if (!libReadsDb(src)) {
    skippedNonDb++;
    continue;
  }

  if (Object.prototype.hasOwnProperty.call(ALLOWLIST, rel)) {
    allowed.push(`${rel}  ← ${ALLOWLIST[rel]}`);
    continue;
  }

  errors.push(
    `${rel}\n` +
      `        读库的 GET 路由，却没有 \`export const dynamic\`。\n` +
      `        .cn 的 CI 构建连的是空库，该路由会被 next build 静态预渲染并把空结果\n` +
      `        固化进镜像，线上恒返回空数据（且 revalidate 救不了）。\n` +
      `        修法：在该文件里加一行  export const dynamic = "force-dynamic";\n` +
      `        若确信它不会被静态化（构建期执行路径一定会读到 request/searchParams），\n` +
      `        请把它加入本脚本的 ALLOWLIST 并写明依据。`
  );
}

const bar = "─".repeat(74);
console.log(bar);
console.log("构建期静态固化守门  (scripts/check-route-dynamic.mjs)");
console.log(bar);
console.log(`扫描根目录      : ${ROOT}`);
console.log(`route.ts 文件   : ${files.length}`);
console.log(`其中导出 GET    : ${checked}`);
console.log(`  动态段跳过    : ${skippedDynamic}`);
console.log(`  不读库跳过    : ${skippedNonDb}`);
console.log(`  白名单放行    : ${allowed.length}`);
console.log("");

if (allowed.length) {
  console.log("白名单放行：");
  for (const a of allowed) console.log("  · " + a);
  console.log("");
}

if (warnings.length) {
  console.log(`⚠️  警告 ${warnings.length} 条（不阻断）：`);
  for (const w of warnings) console.log("  ! " + w);
  console.log("");
}

if (errors.length) {
  console.log(`❌ 违规 ${errors.length} 处：`);
  for (const e of errors) console.log("  × " + e);
  console.log("");
  console.log(bar);
  console.log(`失败：${errors.length} 个读库 GET 路由缺少 \`export const dynamic\`。`);
  console.log(bar);
  process.exit(1);
}

console.log(bar);
console.log("✅ 通过：没有会被构建期静态固化的读库 GET 路由。");
console.log(bar);
