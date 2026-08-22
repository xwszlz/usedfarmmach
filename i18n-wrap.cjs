// 基于 TypeScript 编译器 API 的安全自动包裹器（已修复多行 import 插入 bug）
// 把 .tsx 里未走翻译通道的硬编码 CJK：
//   1) JSX 文本节点  -> {wrap("key")}
//   2) 可见 JSX 属性字面量(placeholder/title/alt/aria-label...) -> attr={wrap("key")}
//   3) 选项标签对象属性(label/text/title/...) 字面量 -> label: wrap("key")
// 包裹函数按文件机制选择：
//   - 客户端组件(有 tr / useTr 或 "use client") -> tr("key")（缺 useTr 则注入，并将已有 translate() 转为 tr()）
//   - 服务端组件(有 locale 且无 use client) -> translate("key", locale)（缺导入则注入，并将已有 tr() 转为 translate()）
// 修复点：
//   * 多行 import 语句：插入点取「最后一条 import 语句的结束行」，而非起始行
//   * 注入 useTr 时移除冗余的 translate 导入
const ts = require("typescript");
const fs = require("fs");
const path = require("path");

const ATTR_WHITELIST = new Set(["placeholder", "title", "alt", "aria-label", "aria-placeholder", "aria-valuetext"]);
const PROP_WHITELIST = new Set(["label", "text", "title", "placeholder", "description", "name", "ariaLabel", "alt", "hint", "tooltip", "message", "content", "caption"]);
const CJK = /[一-鿿]/;
const dictKeysOut = new Set();

function normKey(s) { return decodeEntities(s).replace(/\s+/g, " ").trim(); }
function hasCJK(s) { return CJK.test(s); }
const ENTITIES = { ldquo:"“", rdquo:"”", lsquo:"‘", rsquo:"’", amp:"&", lt:"<", gt:">", nbsp:" ", middot:"·", hellip:"…", mdash:"—", ndash:"–", times:"×", divide:"÷", copy:"©", reg:"®", trade:"™", bull:"•", deg:"°", plusmn:"±", laquo:"«", raquo:"»", sect:"§", para:"¶", emsp:" ", thinsp:" " };
function decodeEntities(s) {
  return s.replace(/&([a-z]+);/gi, (m, n) => (ENTITIES[n.toLowerCase()] !== undefined ? ENTITIES[n.toLowerCase()] : m))
          .replace(/&#(\d+);/g, (m, n) => String.fromCharCode(parseInt(n, 10)))
          .replace(/&#x([0-9a-f]+);/gi, (m, n) => String.fromCharCode(parseInt(n, 16)));
}

function analyze(src) {
  const isClient = /"use client"/.test(src);
  const hasTr = /\btr\s*\(/.test(src) || /useTr/.test(src);
  const hasTranslateImport = /import\s*\{[^}]*translate[^}]*\}\s*from\s*"@\/lib\/i18n-runtime"/.test(src);
  const hasLocale = /\blocale\b/.test(src);
  if (hasTr) return { mode: "tr", inject: {} };
  if (isClient) return { mode: "tr", inject: { useTr: true } };
  if (hasLocale) return { mode: "translate", inject: hasTranslateImport ? {} : { translate: true } };
  // 兜底：含 CJK 但未识别到任何机制的文件，按「服务端组件」处理（translate 模式），
  // 由 i18n-fix-scope 注入 const locale = await getLocale(); 解决作用域。
  // （布局/页面 metadata 导出中的 title/description 会被 fixer 的 moduleMeta 规则还原为字面量，保持一致）
  if (/[一-鿿]/.test(src)) return { mode: "translate", inject: hasTranslateImport ? {} : { translate: true } };
  return null;
}

// 找到最后一条 import 语句的「结束行」下标（多行 import 取其闭合行）
function lastImportEndLine(lines) {
  let end = -1;
  for (let i = 0; i < lines.length; i++) {
    if (/^\s*import\s/.test(lines[i])) {
      let j = i;
      while (j < lines.length && !/;\s*$/.test(lines[j])) j++; // 跨行直到遇到分号
      end = j;
      i = j;
    }
  }
  return end;
}

function injectImports(src, inject) {
  let lines = src.split("\n");
  let out = lines.join("\n");
  // 注入 useTr 时，移除冗余的 translate 导入（避免未使用 / 机制混用）
  if (inject.useTr) {
    out = out.replace(/^\s*import\s*\{\s*translate\s*\}\s*from\s*"@\/lib\/i18n-runtime";\s*\n/m, "");
  }
  if (inject.translate) {
    out = out.replace(/^\s*import\s*\{\s*useTr\s*\}\s*from\s*"@\/lib\/i18n-tr";\s*\n/m, "");
  }
  lines = out.split("\n");
  const end = lastImportEndLine(lines);
  if (inject.useTr && end >= 0) lines.splice(end + 1, 0, 'import { useTr } from "@/lib/i18n-tr";');
  if (inject.translate && end >= 0) lines.splice(end + 1, 0, 'import { translate } from "@/lib/i18n-runtime";');
  out = lines.join("\n");
  if (inject.useTr) {
    const pats = [
      /(export default function \w+\s*\([^)]*\)\s*\{)/,
      /(export function \w+\s*\([^)]*\)\s*\{)/,
      /(function \w*\s*\([^)]*\)\s*\{)/,
      /(const \w+\s*=\s*\([^)]*\)\s*=>\s*\{)/,
    ];
    for (const p of pats) { if (p.test(out)) { out = out.replace(p, "$1\n  const { tr } = useTr();"); break; } }
  }
  // 服务端 translate 直接作为函数调用 translate("x", locale)，无需注入 const；locale 来自参数
  return out;
}

function makeWrapCall(mode, key) {
  const str = ts.factory.createStringLiteral(key);
  if (mode === "tr") return ts.factory.createCallExpression(ts.factory.createIdentifier("tr"), undefined, [str]);
  return ts.factory.createCallExpression(ts.factory.createIdentifier("translate"), undefined, [str, ts.factory.createIdentifier("locale")]);
}

function transformFile(file) {
  let src = fs.readFileSync(file, "utf8");
  const info = analyze(src);
  if (!info) { console.log("  [跳过] 无可用翻译机制: " + file); return false; }
  if (info.inject.useTr || info.inject.translate) src = injectImports(src, info.inject);
  const mode = info.mode;
  const sf = ts.createSourceFile(file, src, ts.ScriptTarget.Latest, false, ts.ScriptKind.TSX);
  let changed = false;

  const result = ts.transform(sf, [ (ctx) => (root) => {
    const visit = (node) => {
      if (!node) return node;
      if (ts.isCallExpression(node)) {
        const callee = node.expression;
        const name = ts.isIdentifier(callee) ? callee.text : (ts.isPropertyAccessExpression(callee) ? callee.name.text : "");
        if (name === "translate" && mode === "tr") {
          // 客户端：把已有 translate("x", locale) 转成 tr("x")
          const arg0 = node.arguments[0];
          if (arg0 && (ts.isStringLiteral(arg0))) { changed = true; return ts.factory.createCallExpression(ts.factory.createIdentifier("tr"), undefined, [arg0]); }
          return node;
        }
        if (name === "tr" && mode === "translate") {
          // 服务端：把已有 tr("x") 转成 translate("x", locale)
          const arg0 = node.arguments[0];
          if (arg0 && ts.isStringLiteral(arg0)) { changed = true; return ts.factory.createCallExpression(ts.factory.createIdentifier("translate"), undefined, [arg0, ts.factory.createIdentifier("locale")]); }
          return node;
        }
        if (["tr", "t", "translate"].includes(name)) return node;
      }
      if (ts.isJsxText(node)) {
        const k = normKey(node.text);
        if (k && hasCJK(k)) { dictKeysOut.add(k); changed = true; return ts.factory.createJsxExpression(undefined, makeWrapCall(mode, k)); }
        return node;
      }
      if (ts.isJsxAttribute(node) && node.initializer && ts.isStringLiteral(node.initializer)) {
        const attrName = ts.isIdentifier(node.name) ? node.name.text : ts.idText(node.name);
        if (ATTR_WHITELIST.has(attrName)) {
          const k = normKey(node.initializer.text);
          if (k && hasCJK(k)) { dictKeysOut.add(k); changed = true; return ts.factory.createJsxAttribute(node.name, ts.factory.createJsxExpression(undefined, makeWrapCall(mode, k))); }
        }
        return node;
      }
      if (ts.isPropertyAssignment(node) && ts.isStringLiteral(node.initializer) && ts.isIdentifier(node.name)) {
        if (PROP_WHITELIST.has(node.name.text)) {
          const k = normKey(node.initializer.text);
          if (k && hasCJK(k)) { dictKeysOut.add(k); changed = true; return ts.factory.updatePropertyAssignment(node, node.name, makeWrapCall(mode, k)); }
        }
        return node;
      }
      return ts.visitEachChild(node, visit, ctx);
    };
    return ts.visitNode(root, visit);
  } ]);

  if (!changed) return false;
  const printer = ts.createPrinter({ newLine: ts.NewLineKind.LineFeed });
  let out = printer.printFile(result.transformed[0]);
  out = out.replace(/(translate|tr|t)\(\s*"(?:[^"\\]|\\.)*"/g, (m) =>
    m.replace(/\\u([0-9a-fA-F]{4})/g, (_, c) => String.fromCharCode(parseInt(c, 16)))
  );
  fs.writeFileSync(file, out);
  console.log("  [已改] " + path.relative(process.cwd(), file) + " (mode=" + mode + (info.inject.useTr ? ",+useTr" : info.inject.translate ? ",+translate" : "") + ")");
  return true;
}

const targets = process.argv.slice(2);
const filesToProcess = [];
if (targets.length === 0) {
  filesToProcess.push(path.resolve("src/app/[locale]/privacy/page.tsx"));
} else {
  for (const t of targets) {
    const p = path.resolve(t);
    if (fs.statSync(p).isDirectory()) {
      (function walk(d){for(const e of fs.readdirSync(d,{withFileTypes:true})){const c=path.join(d,e.name);if(e.isDirectory()){if(["node_modules",".next",".git"].includes(e.name)||e.name.startsWith("."))continue;walk(c);}else if(e.name.endsWith(".tsx"))filesToProcess.push(c);}})(p);
    } else filesToProcess.push(p);
  }
}

let cnt = 0;
for (const f of filesToProcess) {
  try { if (transformFile(f)) cnt++; } catch (e) { console.error("  [错误] " + f + " : " + e.message); }
}
fs.writeFileSync(".i18n-wrap-keys.json", JSON.stringify([...dictKeysOut], null, 2));
console.log("\n处理文件数: " + cnt + "  新增 dict 源串: " + dictKeysOut.size);
