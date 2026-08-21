/**
 * analyze-i18n-coverage.js — 精确测算 P0 真实缺口
 *
 * 项目已有成熟机制：tr(中文源串) / translate(中文源串, locale) -> i18n-dictionary 查表
 *   - zh 回源串，en 回 dict[key].en，其余 6 语言回各自条目否则英文否则源串
 * classify-i18n.js 的"模式C 纯中文"把已包裹 tr() 的中文也计入，严重高估。
 *
 * 本脚本精确统计（仅扫描 src/app 与 src/components）：
 *   1) i18n-dictionary 已有键数
 *   2) 代码中 tr("中文") / translate("中文") 源串数（去重）—— 这些才"需字典覆盖"
 *   3) 字典缺失的 tr 源串数（真实代码侧缺口：包了 tr 但字典没翻）
 *   4) 模式A 裸 isZh?中:英 三元 / 模式B {zh,en} 对象（未包 tr，需改 tr()）
 */
const fs = require("fs");
const path = require("path");

const ROOT = "D:/神雕农机/usedfarmmach/src";
const DICT = path.join(ROOT, "lib", "i18n-dictionary.ts");

// 1) 字典已有键（顶层 "中文": { 结构）
const dictText = fs.readFileSync(DICT, "utf8");
const dictKeys = new Set();
const keyRe = /"((?:[^"\\]|\\.)*)"\s*:\s*\{/g;
let m;
while ((m = keyRe.exec(dictText))) dictKeys.add(m[1]);

// 2) 遍历 src/app 与 src/components（支持 (route) 分组、子目录）
function walk(dir, cb) {
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const e of entries) {
    const full = path.join(dir, e.name);
    const rel = full.replace(/\\/g, "/");
    if (e.isDirectory()) {
      // 跳过噪声目录（按完整路径段匹配，避免误伤如 someapp / rapid）
      if (/(^|[\\/])(node_modules|\.next|\.git|\.workbuddy)([\\/]|$)/.test(rel)) continue;
      if (/(^|[\\/])api([\\/]|$)/.test(rel)) continue; // route handlers 返回 JSON，非用户文案
      if (/(^|[\\/])(admin|seller)([\\/]|$)/.test(rel)) continue;
      walk(full, cb);
    } else if (/\.(tsx|ts)$/.test(e.name)) {
      // 仅处理 app / components 下的文件
      if (/(^|[\\/])(app|components)([\\/]|$)/.test(rel)) cb(full);
    }
  }
}

const trSet = new Set();
const modeA = [];
const modeB = [];
const CN = /[一-鿿]/;
// 捕获 tr("中文") 与 translate("中文", locale)；避免误吞 attr( 等
const trRe = /(?<![A-Za-z])(?:tr|translate)\(\s*["']((?:[^"']|\\.)*?)["']/g;

walk(ROOT, (file) => {
  const content = fs.readFileSync(file, "utf8");
  const rel = file.replace(/\\/g, "/").replace("D:/神雕农机/usedfarmmach/", "");

  let tm;
  while ((tm = trRe.exec(content))) {
    if (CN.test(tm[1])) trSet.add(tm[1]);
  }

  // 模式A: isZh ? "中" : "英"
  const aRe = /isZh\s*\?\s*"([^"]*)"\s*:\s*"[^"]*"/g;
  while ((tm = aRe.exec(content))) {
    if (CN.test(tm[1])) modeA.push(rel + " :: " + tm[1]);
  }

  // 模式B: { zh: "中", en: "英" }
  const bRe = /\{\s*zh\s*:\s*"([^"]*)"\s*,\s*en\s*:\s*"[^"]*"\s*\}/g;
  while ((tm = bRe.exec(content))) {
    if (CN.test(tm[1])) modeB.push(rel + " :: " + tm[1]);
  }
});

// 3) 字典缺失的 tr 源串
const missing = [...trSet].filter((s) => !dictKeys.has(s));
// 进一步区分：字典里有键但只有 en（缺 ru/es/pt/ar/fr/hi）
const partialSmall = [...trSet].filter((s) => {
  if (!dictKeys.has(s)) return false;
  const blk = dictText.match(
    new RegExp('"' + s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + '"\\s*:\\s*\\{([\\s\\S]*?)\\n\\s*\\}', "")
  );
  if (!blk) return false;
  const langs = ["ru", "es", "pt", "ar", "fr", "hi"].filter((l) => new RegExp('"' + l + '"\\s*:').test(blk[1]));
  return langs.length < 6;
});

console.log("=== P0 真实缺口评估（仅 app/components）===");
console.log("i18n-dictionary 已有键数(顶层) :", dictKeys.size);
console.log("代码中 tr/translate 源串(去重) :", trSet.size);
console.log(">>> 字典【完全缺失】的 tr 源串 :", missing.length, "  <-- 真实『包了tr但没翻』，非zh站会显示中文");
console.log(">>> 字典【缺6小语种】的 tr 源串 :", partialSmall.length, "  <-- 有en，但ru/es/pt/ar/fr/hi不全");
console.log("");
console.log("模式A 裸 isZh?中:英 三元数    :", modeA.length, "  <-- 需改 tr(中文)");
console.log("模式B 裸 {zh,en} 对象数        :", modeB.length, "  <-- 需改 tr(中文)");
console.log("");
console.log("--- 字典缺失 tr 源串（全部，按长度）---");
missing
  .sort((a, b) => b.length - a.length)
  .forEach((s) => console.log("  [" + s.length + "] " + s));
console.log("");
console.log("--- 模式A 裸三元（前 40）---");
modeA.slice(0, 40).forEach((s) => console.log("  " + s));
console.log("");
console.log("--- 模式B 裸对象（前 40）---");
modeB.slice(0, 40).forEach((s) => console.log("  " + s));
