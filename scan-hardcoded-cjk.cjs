// 扫描组件里"未走 tr()/t() 翻译通道"的硬编码 CJK 字面量
// 排除：注释、tr("...")/t("...")/translate("...") 参数、字典文件、import
const fs = require("fs");
const path = require("path");

function walk(dir, acc) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (["node_modules", ".next", ".git"].includes(e.name) || e.name.startsWith(".")) continue;
      walk(p, acc);
    } else if (/\.(tsx?|jsx?)$/.test(e.name)) acc.push(p);
  }
  return acc;
}
const files = walk(path.resolve("src"), []);

// 去掉 tr("X") / t("X") / translate("X") 的字面量参数（这些已走翻译通道）
function stripTranslated(code) {
  return code
    .replace(/\b(?:tr|t|translate)\(\s*"[^"]*"\s*\)/g, "«T»")
    .replace(/\b(?:tr|t|translate)\(\s*'[^']*'\s*\)/g, "«T»")
    .replace(/\b(?:tr|t|translate)\(\s*`[^`]*`\s*\)/g, "«T»");
}

const CJK = /[一-鿿]/;
const results = [];
for (const f of files) {
  if (f.endsWith("i18n-dictionary.ts") || f.endsWith("i18n-types.ts")) continue;
  const rel = path.relative(process.cwd(), f);
  const lines = fs.readFileSync(f, "utf8").split("\n");
  lines.forEach((raw, i) => {
    let line = raw;
    // 去掉整行注释
    line = line.replace(/\/\/.*$/, "");
    // 去掉块注释片段（简单处理）
    line = line.replace(/\/\*[\s\S]*?\*\//g, "");
    // 去掉已走翻译通道的字符串
    line = stripTranslated(line);
    // 找 CJK 连续串
    const matches = line.match(/[一-鿿][一-鿿，。、！？：；""''（）\s·—–0-9A-Za-z%¥$]*[一-鿿]/g);
    if (matches) {
      matches.forEach(m => {
        const t = m.trim();
        if (t.length >= 1) results.push({ file: rel, line: i + 1, text: t });
      });
    }
  });
}

// 按文件聚合
const byFile = {};
for (const r of results) byFile[r.file] = (byFile[r.file] || 0) + 1;
const sorted = Object.entries(byFile).sort((a, b) => b[1] - a[1]);
console.log("=== 硬编码 CJK（未走翻译通道）扫描 ===");
console.log("命中文件数:", sorted.length, " 命中处:", results.length);
console.log("");
console.log("--- 按文件(前50) ---");
sorted.slice(0, 50).forEach(([f, n]) => console.log("  " + String(n).padStart(4) + "  " + f));
console.log("");
console.log("--- 样例(前60处) ---");
results.slice(0, 60).forEach(r => console.log("  " + r.file + ":" + r.line + "  " + JSON.stringify(r.text)));
fs.writeFileSync(".scan-hardcoded-cjk.json", JSON.stringify(results, null, 2));
