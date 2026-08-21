/**
 * seed-hardcoded-dict.js — 将 convert-hardcoded-i18n.js 收集的 (中文,英文) 对种子化进字典
 * 仅添加字典中缺失的键，绝不覆盖已有条目（tr() 既有翻译优先）。
 */
const fs = require("fs");
const path = require("path");

const DICT = path.join("D:/神雕农机/usedfarmmach/src/lib/i18n-dictionary.ts");
const ADD = path.join("D:/神雕农机/usedfarmmach/i18n-additions-hardcoded.json");

const text = fs.readFileSync(DICT, "utf8");
const additions = JSON.parse(fs.readFileSync(ADD, "utf8"));

const existing = new Set();
const keyRe = /"((?:[^"\\]|\\.)*)"\s*:\s*\{/g;
let m;
while ((m = keyRe.exec(text))) existing.add(m[1]);

const toAdd = [];
let skipped = 0;
for (const [zh, en] of Object.entries(additions)) {
  if (existing.has(zh)) { skipped++; continue; }
  toAdd.push('  "' + zh + '": {\n    "en": ' + JSON.stringify(en) + "\n  },");
}

if (toAdd.length === 0) {
  console.log("无新增条目（全部已存在）。skipped=" + skipped);
  process.exit(0);
}

const idx = text.lastIndexOf("};");
if (idx === -1) { console.error("未找到字典结尾 };"); process.exit(1); }
let head = text.slice(0, idx);
if (!/},\s*$/.test(head)) head = head.replace(/}\s*$/, "},\n");
const newText = head + toAdd.join("\n") + "\n};\n";

fs.writeFileSync(DICT, newText, "utf8");
console.log("已追加 " + toAdd.length + " 条；跳过(已存在) " + skipped + " 条。");
