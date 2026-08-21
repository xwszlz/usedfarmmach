/**
 * convert-hardcoded-i18n.js — 将硬编码 i18n 模式统一改为 translate(中文源串, locale)
 *
 * 处理的模式（均为「isZh 时中文、否则英文」的 en-only 回退，非 zh 站当前显示英文，不泄漏中文）：
 *   模式A: isZh ? "中文" : "英文"        -> translate("中文", locale)
 *   t-helper: t("中文", "英文")          -> translate("中文", locale)   （仅当文件内定义了 t=(zh,en)=>isZh?zh:en）
 *
 * 不做（留给专用脚本）：{zh,en} 数据 map 的 .zh/.en 访问（需保留 map 结构）。
 *
 * 安全约束：
 *   - 仅替换「字面量」模式；变量/模板串不碰（保持原样，绝不破坏类型）。
 *   - 仅当文件作用域内存在 locale 变量时才转换（模式A 隐含 locale 存在）。
 *   - 替换后若 isZh 不再被引用，删除其定义行（避免 unused 警告）。
 *   - 需要时自动补 import { translate } from "@/lib/i18n-runtime"。
 * 收集所有 (中文, 英文) 对输出到 i18n-additions-hardcoded.json 供种子化字典。
 */
const fs = require("fs");
const path = require("path");

const ROOT = "D:/神雕农机/usedfarmmach/src";
const OUT = "D:/神雕农机/usedfarmmach/i18n-additions-hardcoded.json";

const CN = /[一-鿿]/;
const pairs = []; // {zh, en, file}

function walk(dir, cb) {
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
      walk(full, cb);
    } else if (/\.(tsx|ts)$/.test(e.name) && /(^|[\\/])(app|components)([\\/]|$)/.test(rel)) {
      cb(full);
    }
  }
}

let filesChanged = 0;

walk(ROOT, (file) => {
  let content = fs.readFileSync(file, "utf8");
  const rel = file.replace(/\\/g, "/").replace("D:/神雕农机/usedfarmmach/", "");
  let changed = false;

  // 是否存在本地 t=(zh,en)=>isZh?zh:en 助手
  const hasTHelper = /const\s+t\s*=\s*\([^)]*\)\s*=>\s*\(?\s*isZh/.test(content);

  // 作用域内是否有 locale 变量（模式A 隐含 locale 存在，这里额外校验 t-helper 场景）
  const hasLocale = /\blocale\b/.test(content);

  // 模式A: isZh ? "中文" : "英文"
  const aRe = /isZh\s*\?\s*("(?:[^"\\]|\\.)*")\s*:\s*("(?:[^"\\]|\\.)*")/g;
  content = content.replace(aRe, (m, zhLit, enLit) => {
    const zh = JSON.parse(zhLit);
    const en = JSON.parse(enLit);
    if (!CN.test(zh)) return m;
    pairs.push({ zh, en, file: rel });
    changed = true;
    return "translate(" + zhLit + ", locale)";
  });

  // t-helper 两参: t("中文", "英文")
  if (hasTHelper && hasLocale) {
    const tRe = /(?<![A-Za-z])t\(\s*("(?:[^"\\]|\\.)*")\s*,\s*("(?:[^"\\]|\\.)*")\s*\)/g;
    content = content.replace(tRe, (m, zhLit, enLit) => {
      const zh = JSON.parse(zhLit);
      const en = JSON.parse(enLit);
      if (!CN.test(zh)) return m;
      pairs.push({ zh, en, file: rel });
      changed = true;
      return "translate(" + zhLit + ", locale)";
    });
  }

  if (!changed) return;

  // 删除不再被引用的 isZh 定义行
  if (!/isZh/.test(content.replace(/const\s+isZh\s*=[^;]*;/g, ""))) {
    content = content.replace(/^[ \t]*const\s+isZh\s*=[^;]*;\s*\n/gm, "");
  }

  // 补 import translate（仅当未从 i18n-runtime 引入时；i18n-tr 不提供 translate）
  if (!/from\s+"@\/lib\/i18n-runtime"/.test(content)) {
    const useDir = content.match(/^("use (?:client|server)";\s*\n)/);
    if (useDir) {
      // 必须在 use 指令之后插入，否则指令失效
      content =
        content.slice(0, useDir[0].length) +
        'import { translate } from "@/lib/i18n-runtime";\n' +
        content.slice(useDir[0].length);
    } else {
      content = 'import { translate } from "@/lib/i18n-runtime";\n' + content;
    }
  }

  fs.writeFileSync(file, content, "utf8");
  filesChanged++;
  console.log("CHANGED: " + rel);
});

// 去重合并 (zh,en)；冲突时保留首个并警告
const map = new Map();
const collisions = [];
for (const p of pairs) {
  if (map.has(p.zh)) {
    if (map.get(p.zh) !== p.en) collisions.push(p);
  } else {
    map.set(p.zh, p.en);
  }
}

const out = {};
for (const [zh, en] of map) out[zh] = en;
fs.writeFileSync(OUT, JSON.stringify(out, null, 2), "utf8");

console.log("\n文件已改: " + filesChanged);
console.log("收集 (中文,英文) 对: " + Object.keys(out).length);
if (collisions.length) {
  console.log("⚠️ 冲突(同中文不同英文，已保留首个，需人工核对):");
  collisions.forEach((c) => console.log("   " + c.zh + " :: " + c.en + "  <-- " + c.file));
}
