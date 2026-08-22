// 扫描 src 中「仍裸露」的用户可见中文（未走翻译通道）：
//  1) JSX 文本节点含 CJK 且非 JsxExpression 包裹
//  2) JSX 属性字符串字面量含 CJK（白名单属性）
//  3) 对象属性赋值字符串字面量含 CJK（白名单属性名）
// 输出 .i18n-remaining.json（去重后的源串 + 出现文件）
const ts = require("typescript");
const fs = require("fs");
const path = require("path");

const ATTR = new Set(["placeholder", "title", "alt", "aria-label", "aria-placeholder", "aria-valuetext"]);
const PROP = new Set(["label", "text", "title", "placeholder", "description", "name", "ariaLabel", "alt", "hint", "tooltip", "message", "content", "caption"]);
const CJK = /[一-鿿]/;

function walk(d, a) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) { if (["node_modules", ".next", ".git"].includes(e.name) || e.name.startsWith(".")) continue; walk(p, a); }
    else if (e.name.endsWith(".tsx")) a.push(p);
  }
  return a;
}
const files = walk(path.resolve("src"), []);
const remaining = []; // {file, line, kind, text}

for (const f of files) {
  const src = fs.readFileSync(f, "utf8");
  const sf = ts.createSourceFile(f, src, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  function v(n) {
    // 跳过已包裹：tr(...) / translate(...) 调用体内的中文参数由调用本身处理
    if (ts.isCallExpression(n)) {
      const callee = n.expression;
      const name = ts.isIdentifier(callee) ? callee.text : (ts.isPropertyAccessExpression(callee) ? callee.name.text : "");
      if (name === "tr" || name === "translate" || name === "t") {
        // 不深入其字符串参数（已包裹）
        n.arguments.forEach((a) => { if (ts.isStringLiteral(a)) {/*skip*/} });
        // 仍要深入其它参数（如 translate 的第二参数 locale 等无关），但中文串参数已处理
        // 直接返回，不递归其字符串字面量参数
        // 但仍需递归其它子节点（比如 translate 里嵌套的 JSX？少见）
      }
    }
    // 1) JSX 文本
    if (ts.isJsxText(n)) {
      const t = n.text.replace(/\s+/g, " ").trim();
      if (t && CJK.test(t)) {
        const pos = n.getStart(sf);
        const line = sf.getLineAndCharacterOfPosition(pos).line + 1;
        remaining.push({ file: path.relative(process.cwd(), f), line, kind: "jsx-text", text: t });
      }
    }
    // 2) JSX 属性字符串
    if (ts.isJsxAttribute(n) && n.initializer && ts.isStringLiteral(n.initializer)) {
      const an = ts.isIdentifier(n.name) ? n.name.text : ts.idText(n.name);
      if (ATTR.has(an) && CJK.test(n.initializer.text)) {
        const pos = n.getStart(sf);
        const line = sf.getLineAndCharacterOfPosition(pos).line + 1;
        remaining.push({ file: path.relative(process.cwd(), f), line, kind: "jsx-attr:" + an, text: n.initializer.text });
      }
    }
    // 3) 对象属性赋值字符串
    if (ts.isPropertyAssignment(n) && ts.isStringLiteral(n.initializer) && ts.isIdentifier(n.name) && PROP.has(n.name.text)) {
      if (CJK.test(n.initializer.text)) {
        // 排除已在 tr/translate 调用内（父链向上找）
        let p = n; let wrapped = false;
        while (p) { if (ts.isCallExpression(p) && (p.expression.text === "tr" || p.expression.text === "translate")) { wrapped = true; break; } p = p.parent; }
        if (!wrapped) {
          const pos = n.getStart(sf);
          const line = sf.getLineAndCharacterOfPosition(pos).line + 1;
          remaining.push({ file: path.relative(process.cwd(), f), line, kind: "prop:" + n.name.text, text: n.initializer.text });
        }
      }
    }
    ts.forEachChild(n, v);
  }
  v(sf);
}

// 去重（按 text）
const seen = new Set();
const uniq = [];
for (const r of remaining) {
  if (seen.has(r.text)) continue;
  seen.add(r.text);
  uniq.push(r);
}
const byFile = {};
for (const r of remaining) byFile[r.file] = (byFile[r.file] || 0) + 1;
fs.writeFileSync(".i18n-remaining.json", JSON.stringify({ total: remaining.length, unique: uniq.length, byFile, samples: uniq.slice(0, 200) }, null, 2));
console.log("裸露用户可见中文出现次数:", remaining.length, "| 去重唯一串:", uniq.length);
console.log("涉及文件数:", Object.keys(byFile).length);
const top = Object.entries(byFile).sort((a, b) => b[1] - a[1]).slice(0, 15);
top.forEach(([f, c]) => console.log("  " + c + "  " + f));
