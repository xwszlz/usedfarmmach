// 扫描所有 tr("源串") / translate("源串") 调用，提取字面量参数，对照 I18N_DICT 键集合
// 找出不在字典里的源串 = 真实泄漏（会回退中文/英文）
const fs = require("fs");
const path = require("path");

const SRC = path.resolve("src/lib/i18n-dictionary.ts");
const js = fs.readFileSync(SRC, "utf8")
  .split("\n").filter(l => !/^\s*import\s/.test(l)).join("\n");
const evalBody = js.replace(/export const I18N_DICT\b[\s\S]*?=\s*/, "return ");
const I18N_DICT = new Function(evalBody)();
const dictKeys = new Set(Object.keys(I18N_DICT));

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

// 匹配 tr( / translate( 后的字面量字符串或模板串（不带插值）
const missed = [];
const hit = [];
let nonLiteral = 0;
const funcs = ["tr", "translate"];
for (const f of files) {
  const code = fs.readFileSync(f, "utf8");
  for (const fn of funcs) {
    const re = new RegExp("\\b" + fn + "\\(\\s*(\"((?:[^\"\\\\]|\\\\.)*)\"|'((?:[^'\\\\]|\\\\.)*)'|`([^`]*)`)\\s*\\)", "g");
    let m;
    while ((m = re.exec(code))) {
      const arg = m[2] !== undefined ? m[2] : (m[3] !== undefined ? m[3] : m[4]);
      if (arg.includes("${")) { nonLiteral++; continue; }
      if (!arg) { nonLiteral++; continue; }
      if (dictKeys.has(arg)) hit.push(arg);
      else missed.push({ f: path.relative(process.cwd(), f), arg });
    }
  }
}

const uniqMissed = [...new Set(missed.map(x => x.arg))];
console.log("=== tr()/translate() 调用扫描 ===");
console.log("在字典中的源串:", hit.length);
console.log("【泄漏】源串不在字典:", missed.length, " (唯一 " + uniqMissed.length + " 个)");
console.log("非字面量(变量/插值/空)调用(跳过):", nonLiteral);
console.log("");
console.log("--- 泄漏唯一源串清单(前200) ---");
uniqMissed.slice(0, 200).forEach(s => console.log("  " + JSON.stringify(s)));
if (uniqMissed.length > 200) console.log("  ... 还有 " + (uniqMissed.length - 200) + " 个");
fs.writeFileSync(".scan-tr-missing.json", JSON.stringify({ missed, uniq: uniqMissed }, null, 2));
