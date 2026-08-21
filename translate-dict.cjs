// translate-dict.cjs — 补齐 I18N_DICT 的缺失语言（en/ru/es/pt/ar/fr/hi）
// 源语言：中文（字典键即中文源串）
// 用法试点： ONLY_LANG=ru LIMIT=15 node translate-dict.cjs
const fs = require("fs");
const path = require("path");
const { translateBatch, runPool } = require("./i18n-translate-core.cjs");

const SRC = path.resolve("src/lib/i18n-dictionary.ts");
const LANGS = ["en", "ru", "es", "pt", "ar", "fr", "hi"];
const LANG_NAME = { en: "English", ru: "Russian", es: "Spanish", pt: "Portuguese", ar: "Arabic", fr: "French", hi: "Hindi" };
const BATCH = 30;
const ONLY_LANG = process.env.ONLY_LANG;
const LIMIT = process.env.LIMIT ? parseInt(process.env.LIMIT, 10) : null;

(async () => {
  // 1) 提取 I18N_DICT（去掉 TS 类型语法后动态 import）
  let raw = fs.readFileSync(SRC, "utf8");
  const headerEnd = raw.indexOf("export const I18N_DICT");
  const header = raw.slice(0, headerEnd);
  let js = raw
    .replace(/import type .*?;\n/, "")
    .replace(/: Record<string, I18nEntry>/, "");
  const evalBody = js.replace(/export const I18N_DICT\s*=\s*/, "return ");
  const I18N_DICT = new Function(evalBody)();
  if (!I18N_DICT || typeof I18N_DICT !== "object") throw new Error("I18N_DICT 提取失败");

  const keys = Object.keys(I18N_DICT);
  console.log(`[dict] 共 ${keys.length} 条`);

  // 2) 收集缺失翻译任务，按语言分组
  const byLang = {}; // lang -> [{key, src}]
  for (const lang of LANGS) {
    if (ONLY_LANG && lang !== ONLY_LANG) continue;
    byLang[lang] = [];
  }
  let processed = 0;
  for (const key of keys) {
    if (LIMIT && processed >= LIMIT) break;
    const entry = I18N_DICT[key] || {};
    for (const lang of Object.keys(byLang)) {
      if (entry[lang] === undefined || entry[lang] === null || entry[lang] === "") {
        byLang[lang].push({ key, src: key });
      }
    }
    processed++;
  }
  const totalJobs = Object.values(byLang).reduce((a, b) => a + b.length, 0);
  console.log(`[dict] 待翻译 ${totalJobs} 条`, Object.fromEntries(Object.entries(byLang).map(([k, v]) => [k, v.length])));

  // 3) 每语言批量并发翻译
  const results = {}; // lang -> Map(key->translation)
  for (const lang of Object.keys(byLang)) {
    const jobs = byLang[lang];
    if (!jobs.length) continue;
    const batches = [];
    for (let i = 0; i < jobs.length; i += BATCH) batches.push(jobs.slice(i, i + BATCH));
    results[lang] = new Map();
    const t0 = Date.now();
    const outs = await runPool(
      batches.map((b, bi) => ({ b, bi })),
      async ({ b }) => translateBatch(b.map(j => j.src), { srcLang: "Chinese", tgtLang: LANG_NAME[lang] }),
      8
    );
    batches.forEach((b, bi) => {
      const trs = outs[bi];
      b.forEach((j, i) => results[lang].set(j.key, trs[i]));
    });
    console.log(`[dict] ${lang} 完成 ${jobs.length} 条, ${((Date.now() - t0) / 1000) | 0}s`);
  }

  // 4) 回填（仅补缺失，不改已有）
  for (const key of keys) {
    const entry = I18N_DICT[key] || (I18N_DICT[key] = {});
    for (const lang of Object.keys(results)) {
      if (entry[lang] === undefined || entry[lang] === null || entry[lang] === "") {
        const t = results[lang].get(key);
        if (t !== undefined) entry[lang] = t;
      }
    }
  }

  // 5) 重写 .ts（保留头部）
  const ordered = LANGS;
  let body = "export const I18N_DICT: Record<string, I18nEntry> = {\n";
  for (const key of keys) {
    const entry = I18N_DICT[key] || {};
    const langs = ordered.filter(l => entry[l] !== undefined && entry[l] !== null && entry[l] !== "");
    if (!langs.length) continue;
    body += "  " + JSON.stringify(key) + ": {\n";
    for (const l of langs) {
      body += "    " + JSON.stringify(l) + ": " + JSON.stringify(entry[l]) + ",\n";
    }
    body += "  },\n";
  }
  body += "};\n";
  fs.writeFileSync(SRC, header + body);
  console.log(`[dict] 已写回 ${SRC}`);
})().catch(e => { console.error("FATAL", e); process.exit(1); });
