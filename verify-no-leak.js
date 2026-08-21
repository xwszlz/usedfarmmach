/**
 * verify-no-leak.js — 校验：所有字面量 translate("中文")/tr("中文") 源串都在字典中
 * 若缺失，该串在非 zh 站点会回退显示中文（泄漏）。返回非 0 表示有泄漏。
 */
const fs = require("fs");
const path = require("path");
const ROOT = "D:/神雕农机/usedfarmmach/src";
const DICT = path.join(ROOT, "lib/i18n-dictionary.ts");
const text = fs.readFileSync(DICT, "utf8");
const dict = new Set();
const keyRe = /"((?:[^"\\]|\\.)*)"\s*:\s*\{/g;
let m; while ((m = keyRe.exec(text))) dict.add(m[1]);

function walk(dir, cb) {
  let e;
  try { e = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
  for (const x of e) {
    const full = path.join(dir, x.name);
    const rel = full.replace(/\\/g, "/");
    if (x.isDirectory()) {
      if (/(^|[\\/])(node_modules|\.next|\.git|\.workbuddy)([\\/]|$)/.test(rel)) continue;
      if (/(^|[\\/])api([\\/]|$)/.test(rel)) continue;
      if (/(^|[\\/])(admin|seller)([\\/]|$)/.test(rel)) continue;
      walk(full, cb);
    } else if (/\.(tsx|ts)$/.test(x.name) && /(^|[\\/])(app|components)([\\/]|$)/.test(rel)) cb(full);
  }
}

const CN = /[一-鿿]/;
const missing = [];
const re = /(?<![A-Za-z])(?:tr|translate)\(\s*("(?:[^"\\]|\\.)*?")\s*[,)]/g;
walk(ROOT, (file) => {
  const content = fs.readFileSync(file, "utf8");
  let mm;
  while ((mm = re.exec(content))) {
    const s = JSON.parse(mm[1]);
    if (CN.test(s) && !dict.has(s)) missing.push(s);
  }
});

if (missing.length === 0) {
  console.log("✅ 无泄漏：所有字面量 tr/translate 中文源串均在字典中（非 zh 站不会显示中文）。");
  process.exit(0);
} else {
  console.log("❌ 仍有 " + missing.length + " 个源串缺失（会泄漏中文）：");
  missing.slice(0, 50).forEach((s) => console.log("   " + s));
  process.exit(1);
}
