/**
 * merge-i18n.js — 将 i18n-additions.json 中的新键深合并到 zh.json / en.json
 *
 * 策略（基于已确认的 next-intl fallback 机制）：
 *   - .com 站 defaultLocale = "en"，6 小语种缺键自动回退英文，已有真翻译保留。
 *   - 因此 P0 只需维护 zh.json + en.json 两份，无需手动填 6 小语种。
 *   - 本脚本只“添加缺失键”，绝不覆盖已有值，保护现有翻译。
 *
 * 用法:  node merge-i18n.js
 * 新增键定义文件:  i18n-additions.json
 *   格式: { "namespace.sub.key": { "zh": "中文", "en": "English" }, ... }
 */
const fs = require("fs");
const path = require("path");

const MESSAGES = path.join(__dirname, "messages");
const ADD_FILE = path.join(__dirname, "i18n-additions.json");

function deepSet(obj, parts, value) {
  let cur = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    const k = parts[i];
    if (cur[k] === undefined || cur[k] === null || typeof cur[k] !== "object") {
      cur[k] = {};
    }
    cur = cur[k];
  }
  const last = parts[parts.length - 1];
  if (cur[last] === undefined) cur[last] = value;
}

if (!fs.existsSync(ADD_FILE)) {
  console.error("[merge-i18n] 找不到 i18n-additions.json，跳过");
  process.exit(0);
}

const additions = JSON.parse(fs.readFileSync(ADD_FILE, "utf8"));
const zh = JSON.parse(fs.readFileSync(path.join(MESSAGES, "zh.json"), "utf8"));
const en = JSON.parse(fs.readFileSync(path.join(MESSAGES, "en.json"), "utf8"));

let addedZh = 0;
let addedEn = 0;
let skipped = 0;

for (const [fullPath, vals] of Object.entries(additions)) {
  const parts = fullPath.split(".");
  if (vals && vals.zh !== undefined) {
    const before = JSON.stringify(zh);
    deepSet(zh, parts, vals.zh);
    if (JSON.stringify(zh) !== before) addedZh++;
    else skipped++;
  }
  if (vals && vals.en !== undefined) {
    const before = JSON.stringify(en);
    deepSet(en, parts, vals.en);
    if (JSON.stringify(en) !== before) addedEn++;
  }
}

fs.writeFileSync(path.join(MESSAGES, "zh.json"), JSON.stringify(zh, null, 2) + "\n", "utf8");
fs.writeFileSync(path.join(MESSAGES, "en.json"), JSON.stringify(en, null, 2) + "\n", "utf8");

console.log(`[merge-i18n] 新增 zh 键 ${addedZh} 个, en 键 ${addedEn} 个, 已存在跳过 ${skipped} 个`);
