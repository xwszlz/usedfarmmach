// finalize-dict.cjs — 全量翻译收尾：合并备份键全集 + 补齐所有缺失语言，绝不丢键
// 修复：原重写逻辑会跳过"所有语言值为空"的条目（如 "共": {en:""}），导致丢键。
const fs = require("fs");
const path = require("path");
const { translateBatch, runPool } = require("./i18n-translate-core.cjs");

const SRC = path.resolve("src/lib/i18n-dictionary.ts");
const BACKUP = path.resolve(".i18n-pilot-bak/i18n-dictionary.ts.bak");
const LANGS = ["en", "ru", "es", "pt", "ar", "fr", "hi"];
const LANG_NAME = { en: "English", ru: "Russian", es: "Spanish", pt: "Portuguese", ar: "Arabic", fr: "French", hi: "Hindi" };
const BATCH = 30;

function extract(file) {
  let raw = fs.readFileSync(file, "utf8");
  let js = raw.replace(/import type .*?;\n/, "").replace(/: Record<string, I18nEntry>/, "");
  const body = js.replace(/export const I18N_DICT\s*=\s*/, "return ");
  return new Function(body)();
}

(async () => {
  const cur = extract(SRC);
  const orig = extract(BACKUP);
  const keys = [...new Set([...Object.keys(orig), ...Object.keys(cur)])];
  console.log(`[finalize] 原始键 ${Object.keys(orig).length} + 当前键 ${Object.keys(cur).length} = 合并 ${keys.length}`);

  // 合并：当前译文优先，回退原始（含空 en）
  const merged = {};
  for (const k of keys) merged[k] = { ...(orig[k] || {}), ...(cur[k] || {}) };

  // 收集缺失语言（含空串）
  const byLang = {};
  for (const l of LANGS) byLang[l] = [];
  let droppedRecovered = 0;
  for (const k of keys) {
    if (!(cur[k])) droppedRecovered++; // 当前缺失的键（被旧逻辑丢掉）
    for (const l of LANGS) {
      const v = merged[k][l];
      if (v === undefined || v === null || v === "") byLang[l].push({ key: k, src: k });
    }
  }
  const total = Object.values(byLang).reduce((a, b) => a + b.length, 0);
  console.log(`[finalize] 恢复被丢键 ${droppedRecovered} 条; 待补齐 ${total} 条`, Object.fromEntries(Object.entries(byLang).map(([k, v]) => [k, v.length])));

  const results = {};
  for (const l of Object.keys(byLang)) {
    const jobs = byLang[l];
    if (!jobs.length) continue;
    const batches = [];
    for (let i = 0; i < jobs.length; i += BATCH) batches.push(jobs.slice(i, i + BATCH));
    const outs = await runPool(batches.map((b, bi) => ({ b, bi })), async ({ b }) => translateBatch(b.map(j => j.src), { srcLang: "Chinese", tgtLang: LANG_NAME[l] }), 8);
    results[l] = new Map();
    batches.forEach((b, bi) => { const trs = outs[bi]; b.forEach((j, i) => results[l].set(j.key, trs[i])); });
    console.log(`[finalize] ${l} 补齐 ${jobs.length} 条`);
  }

  // 回填
  for (const k of keys) {
    const e = merged[k];
    for (const l of Object.keys(results)) {
      const t = results[l].get(k);
      if (t !== undefined && t !== "") e[l] = t;
    }
  }

  // 重写（保留头部 + 所有键，绝不跳过）
  const raw = fs.readFileSync(SRC, "utf8");
  const headerEnd = raw.indexOf("export const I18N_DICT");
  const header = raw.slice(0, headerEnd);
  let body = "export const I18N_DICT: Record<string, I18nEntry> = {\n";
  for (const k of keys) {
    const e = merged[k] || {};
    const langs = LANGS.filter(l => e[l] !== undefined && e[l] !== null && e[l] !== "");
    body += "  " + JSON.stringify(k) + ": {\n";
    for (const l of langs) body += "    " + JSON.stringify(l) + ": " + JSON.stringify(e[l]) + ",\n";
    body += "  },\n";
  }
  body += "};\n";
  fs.writeFileSync(SRC, header + body);
  console.log(`[finalize] 已写回 ${SRC}，共 ${keys.length} 条`);
})().catch(e => { console.error("FATAL", e); process.exit(1); });
