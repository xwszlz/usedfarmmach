/**
 * QA i18n 一致性检查（P1 新增 quota / adminSystem 命名空间）
 * 运行：node scripts/qa-i18n-check.mjs
 * 不依赖构建/prisma generate；纯 JSON 解析 + 键集比对（以 zh 为主键基准）。
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const MESSAGES_DIR = join(root, "messages");

const LANGS = ["zh", "en", "es", "fr", "hi", "pt", "ru", "ar"];
const NAMESPACES = ["quota", "adminSystem"];

let failures = 0;
const log = (...a) => console.log(...a);

// 1) 加载所有语言文件
const data = {};
for (const lang of LANGS) {
  const p = join(MESSAGES_DIR, `${lang}.json`);
  try {
    data[lang] = JSON.parse(readFileSync(p, "utf8"));
  } catch (e) {
    failures++;
    log(`[FAIL] ${lang}.json 无法解析: ${e.message}`);
  }
}

// 2) 检查顶层命名空间存在性
log("\n=== 顶层命名空间存在性（quota / adminSystem）===");
for (const lang of LANGS) {
  for (const ns of NAMESPACES) {
    const ok = data[lang] && typeof data[lang][ns] === "object" && data[lang][ns] !== null;
    if (!ok) {
      failures++;
      log(`[FAIL] ${lang}.json 缺失顶层命名空间 "${ns}"`);
    } else {
      log(`[PASS] ${lang}.json 含顶层 "${ns}"`);
    }
  }
}

// 3) 键集一致性（以 zh 为基准，逐语言比对 quota/adminSystem 的扁平键集合）
log("\n=== 键集一致性（基准 = zh，扁平键递归展开）===");
function flatten(obj, prefix = "") {
  const out = new Set();
  // 收集【所有键路径】，含叶子字符串键（而非仅嵌套对象节点）
  if (obj && typeof obj === "object" && !Array.isArray(obj)) {
    for (const [k, v] of Object.entries(obj)) {
      const key = prefix ? `${prefix}.${k}` : k;
      out.add(key);
      for (const sub of flatten(v, key)) out.add(sub);
    }
  }
  return out;
}

const ref = data["zh"];
for (const ns of NAMESPACES) {
  const refKeys = ref && ref[ns] ? flatten(ref[ns]) : new Set();
  for (const lang of LANGS) {
    if (lang === "zh") continue;
    const target = data[lang] && data[lang][ns] ? flatten(data[lang][ns]) : new Set();
    const missing = [...refKeys].filter((k) => !target.has(k));
    const extra = [...target].filter((k) => !refKeys.has(k));
    if (missing.length || extra.length) {
      failures++;
      log(`[FAIL] ${lang}.json "${ns}" 键集不一致:`);
      if (missing.length) log(`        缺失键: ${missing.join(", ")}`);
      if (extra.length) log(`        多余键: ${extra.join(", ")}`);
    } else {
      log(`[PASS] ${lang}.json "${ns}" 与 zh 键集一致（共 ${refKeys.size} 键）`);
    }
  }
}

log(`\n=== 结论: ${failures === 0 ? "全部通过" : failures + " 处失败"} ===`);
process.exit(failures === 0 ? 0 : 1);
