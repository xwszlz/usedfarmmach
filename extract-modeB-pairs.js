/**
 * extract-modeB-pairs.js — 提取所有 {zh:"中文", en:"English"} 数据 map 条目
 * 收集 (中文,英文) 对输出到 i18n-additions-modeB.json，供种子化字典。
 */
const fs = require("fs");
const path = require("path");
const ROOT = "D:/神雕农机/usedfarmmach/src";
const OUT = "D:/神雕农机/usedfarmmach/i18n-additions-modeB.json";
const CN = /[一-鿿]/;
const map = new Map();

function walk(dir) {
  let entries;
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); }
  catch { return; }
  for (const e of entries) {
    const full = path.join(dir, e.name);
    const rel = full.replace(/\\/g, "/");
    if (e.isDirectory()) {
      if (/(^|[\\/])(node_modules|\.next|\.git|\.workbuddy)([\\/]|$)/.test(rel)) continue;
      if (/(^|[\\/])api([\\/]|$)/.test(rel)) continue;
      if (/(^|[\\/])(admin|seller)([\\/]|$)/.test(rel)) continue;
      walk(full);
    } else if (/\.(tsx|ts)$/.test(e.name) && /(^|[\\/])(app|components)([\\/]|$)/.test(rel)) {
      const content = fs.readFileSync(full, "utf8");
      const re = /\{\s*zh\s*:\s*"((?:[^"\\]|\\.)*)"\s*,\s*en\s*:\s*"((?:[^"\\]|\\.)*)"\s*\}/g;
      let m;
      while ((m = re.exec(content))) {
        const zh = m[1], en = m[2];
        if (!CN.test(zh)) continue;
        if (!map.has(zh)) map.set(zh, en);
      }
    }
  }
}
walk(ROOT);
const out = {};
for (const [zh, en] of map) out[zh] = en;
fs.writeFileSync(OUT, JSON.stringify(out, null, 2), "utf8");
console.log("提取 {zh,en} 数据 map 对: " + Object.keys(out).length);
console.log("写入 " + OUT);
