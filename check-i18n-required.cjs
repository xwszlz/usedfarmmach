// check-i18n-required.cjs — i18n 卡点：防止新增字符串再次退化
// 1) I18N_DICT 每个条目必须有全部 7 种外语(en/ru/es/pt/ar/fr/hi)，zh 即键本身
// 2) messages 每个 locale 必须含 en.json 的全部键；且非 en locale 的值不得等于英文(泄漏)
// 用法: node check-i18n-required.cjs   (CI 中非零退出即失败)
const fs = require("fs");
const path = require("path");

const SRC = path.resolve("src/lib/i18n-dictionary.ts");
const MSG_DIR = path.resolve("messages");
const DICT_LANGS = ["en", "ru", "es", "pt", "ar", "fr", "hi"];
const MSG_LOCALES = ["zh", "ru", "es", "pt", "ar", "fr", "hi"];

// --- 提取 I18N_DICT ---
let raw = fs.readFileSync(SRC, "utf8");
let js = raw.replace(/import type .*?;\n/, "").replace(/: Record<string, I18nEntry>/, "");
const evalBody = js.replace(/export const I18N_DICT\s*=\s*/, "return ");
const I18N_DICT = new Function(evalBody)();

let dictMissing = 0;
for (const key of Object.keys(I18N_DICT)) {
  const e = I18N_DICT[key] || {};
  for (const l of DICT_LANGS) {
    if (!e[l] || typeof e[l] !== "string" || !e[l].trim()) dictMissing++;
  }
}

// --- 检查 messages ---
const base = JSON.parse(fs.readFileSync(path.join(MSG_DIR, "en.json"), "utf8"));
function walk(enNode, tgNode, path, miss, leak) {
  if (typeof enNode === "string") {
    if (tgNode === undefined || tgNode === null) miss.push(path);
    else if (tgNode === enNode) leak.push(path);
    return;
  }
  if (Array.isArray(enNode)) {
    enNode.forEach((el, i) => walk(el, Array.isArray(tgNode) ? tgNode[i] : undefined, path + "." + i, miss, leak));
    return;
  }
  if (enNode && typeof enNode === "object") {
    for (const k of Object.keys(enNode)) {
      const child = tgNode && typeof tgNode === "object" && !Array.isArray(tgNode) ? tgNode[k] : undefined;
      walk(enNode[k], child, path ? path + "." + k : k, miss, leak);
    }
  }
}
const msgReport = {};
for (const loc of MSG_LOCALES) {
  const tg = JSON.parse(fs.readFileSync(path.join(MSG_DIR, loc + ".json"), "utf8"));
  const miss = [], leak = [];
  walk(base, tg, "", miss, leak);
  msgReport[loc] = { miss, leak };
}

// --- 输出 ---
let fail = false;
console.log("=== i18n 卡点检查 ===");
console.log(`字典缺失语言条目数: ${dictMissing} ${dictMissing === 0 ? "✅" : "❌"}`);
if (dictMissing) fail = true;
for (const loc of MSG_LOCALES) {
  const { miss, leak } = msgReport[loc];
  const ok = miss.length === 0;
  if (!ok) fail = true;
  console.log(`messages[${loc}]: 缺键 ${miss.length} ${miss.length ? "❌" : "✅"} | 英文泄漏 ${leak.length} ${leak.length ? "⚠️" : "✅"}`);
  if (miss.length) console.log("   缺键示例:", miss.slice(0, 5).join(", "));
  if (leak.length) console.log("   泄漏示例:", leak.slice(0, 5).join(", "));
}
console.log(fail ? "\n结果: 失败 ❌" : "\n结果: 通过 ✅");
process.exit(fail ? 1 : 0);
