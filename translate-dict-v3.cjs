// translate-dict-v3.cjs — 按语言逐批翻译（flat JSON 数组，已验证可靠）
// 复用 i18n-translate-core.cjs 的 translateBatch（已含 429/5xx/网络/socket 重试 + 逐条降级）
// 特性：每批增量落盘 / 断点续传 / 单批失败不崩（留待续传）
// 用法：node translate-dict-v3.cjs
//       ONLY_LANG=ru node translate-dict-v3.cjs   （只翻俄语，调试）
const fs = require("fs");
const path = require("path");
const { translateBatch, runPool } = require("./i18n-translate-core.cjs");

const SRC = path.resolve("src/lib/i18n-dictionary.ts");
const LANGS = ["en", "ru", "es", "pt", "ar", "fr", "hi"];
const LANG_NAME = { en: "English", ru: "Russian", es: "Spanish", pt: "Portuguese", ar: "Arabic", fr: "French", hi: "Hindi" };
const BATCH = 12;
const CONC = 6;
const ONLY_LANG = process.env.ONLY_LANG;

function loadDict() {
  const raw = fs.readFileSync(SRC, "utf8");
  const headerEnd = raw.indexOf("export const I18N_DICT");
  const header = raw.slice(0, headerEnd);
  const js = raw.replace(/import type .*?;\n/, "").replace(/: Record<string, I18nEntry>/, "");
  const evalBody = js.replace(/export const I18N_DICT\s*=\s*/, "return ");
  const dict = new Function(evalBody)();
  if (!dict || typeof dict !== "object") throw new Error("I18N_DICT 提取失败");
  return { dict, header };
}

function serialize(dict, header, keys) {
  let body = "export const I18N_DICT: Record<string, I18nEntry> = {\n";
  for (const key of keys) {
    const e = dict[key] || {};
    const present = LANGS.filter(l => e[l] !== undefined && e[l] !== null && e[l] !== "");
    if (!present.length) {
      if (e.zh !== undefined) body += "  " + JSON.stringify(key) + ": {\n    \"zh\": " + JSON.stringify(e.zh) + "\n  },\n";
      continue;
    }
    body += "  " + JSON.stringify(key) + ": {\n";
    for (const l of present) body += "    " + JSON.stringify(l) + ": " + JSON.stringify(e[l]) + ",\n";
    body += "  },\n";
  }
  body += "};\n";
  fs.writeFileSync(SRC, header + body);
}

(async () => {
  const t0 = Date.now();
  const { dict, header } = loadDict();
  const allKeys = Object.keys(dict);
  const langs = ONLY_LANG ? [ONLY_LANG] : LANGS;
  console.log(`[v3] 字典 ${allKeys.length} 键, 翻译语言: ${langs.join(",")}`);

  for (const lang of langs) {
    const t1 = Date.now();
    // 该语言缺失的键
    const missing = allKeys.filter(k => { const v = dict[k] && dict[k][lang]; return v === undefined || v === null || v === ""; });
    if (!missing.length) { console.log(`[v3] ${lang} 已全翻，跳过`); continue; }
    console.log(`[v3] ${lang}: 待翻 ${missing.length} 键`);
    const batches = [];
    for (let i = 0; i < missing.length; i += BATCH) batches.push(missing.slice(i, i + BATCH));
    let doneBatches = 0;
    await runPool(batches, async (batch) => {
      const srcs = batch.map(k => k);
      const trs = await translateBatch(srcs, { srcLang: "Chinese", tgtLang: LANG_NAME[lang] });
      let applied = 0;
      for (let i = 0; i < batch.length; i++) {
        const t = trs && trs[i];
        if (t && typeof t === "string" && t.trim()) {
          const e = dict[batch[i]] || (dict[batch[i]] = {});
          e[lang] = t;
          if (LANGS.every(l => e[l])) delete e.zh;
          applied++;
        }
      }
      doneBatches++;
      serialize(dict, header, allKeys);
      const sec = ((Date.now() - t0) / 1000) | 0;
      process.stdout.write(`[v3] ${lang} 批 ${doneBatches}/${batches.length} +${applied} (${sec}s)\n`);
    }, CONC);
    console.log(`[v3] ${lang} 完成, 用时 ${((Date.now() - t1) / 1000) | 0}s`);
  }

  for (const k of allKeys) if (dict[k] && LANGS.every(l => dict[k][l])) delete dict[k].zh;
  serialize(dict, header, allKeys);

  let full = 0, zh = 0, partial = 0;
  for (const k of allKeys) {
    const c = LANGS.filter(l => dict[k] && dict[k][l]).length;
    if (c === 7) full++; else if (c > 0) partial++; else if (dict[k] && dict[k].zh) zh++;
  }
  console.log(`[v3] 完成! 全语言 ${full} | 部分 ${partial} | 仅zh ${zh} | 总 ${allKeys.length} | 用时 ${((Date.now() - t0) / 1000) | 0}s`);
})().catch(e => { console.error("FATAL", e); process.exit(1); });
