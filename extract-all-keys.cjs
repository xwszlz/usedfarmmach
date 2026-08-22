// 从全部已包裹的 .tsx 提取 tr("源串") / translate("源串", locale) 的字面量参数
// 输出完整去重源串集合到 .i18n-all-keys.json（含已进字典的，供 add-dict-keys 去重）
const fs = require("fs");
const path = require("path");
function walk(d, a) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) { if (["node_modules", ".next", ".git"].includes(e.name) || e.name.startsWith(".")) continue; walk(p, a); }
    else if (e.name.endsWith(".tsx")) a.push(p);
  }
  return a;
}
const files = walk(path.resolve("src"), []);
const keys = new Set();
const re = /\b(?:tr|translate)\(\s*("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|`(?:[^`\\]|\\.)*`)\s*(?:,\s*\w+)?\s*\)/g;
for (const f of files) {
  const code = fs.readFileSync(f, "utf8");
  let m;
  while ((m = re.exec(code))) {
    let s = m[1];
    // 去引号
    s = s.slice(1, -1).replace(/\\"/g, '"').replace(/\\'/g, "'").replace(/\\\\/g, "\\");
    if (s && /[一-鿿]/.test(s)) keys.add(s);
  }
}
fs.writeFileSync(".i18n-all-keys.json", JSON.stringify([...keys], null, 2));
console.log("从源码提取的唯一中文源串总数:", keys.size);
