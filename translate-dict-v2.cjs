// translate-dict-v2.cjs — 健壮版字典翻译补齐（按串长分档 + 增量落盘 + 失败续传）
// 分档：
//   短串 (<=50字): BATCH=30, max_tokens=8000,  并发6
//   中串 (50~200): BATCH=4,  max_tokens=14000, 并发4
//   长串 (>200) :  BATCH=1,  max_tokens=16000, 并发2
// 特性：合并 7 语言单调用 / 全错误重试 / 每批增量落盘 / 单批失败跳过不崩 / 断点续传
const fs = require("fs");
const path = require("path");

const KEY = process.env.OPENROUTER_API_KEY;
const MODEL = process.env.I18N_MODEL || "meta-llama/llama-3.3-70b-instruct";
if (!KEY) { console.error("[v2] 缺少 OPENROUTER_API_KEY"); process.exit(2); }

const SRC = path.resolve("src/lib/i18n-dictionary.ts");
const LANGS = ["en", "ru", "es", "pt", "ar", "fr", "hi"];
const LIMIT = process.env.LIMIT ? parseInt(process.env.LIMIT, 10) : null;
const BRANDS = "神雕农机, CLAAS, John Deere, New Holland, Fendt, Agriaffaires, usedfarmmach";

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

async function callCombined(sources, maxTokens) {
  const n = sources.length;
  const sys = `You are a professional translator for an agricultural machinery trading platform (used farm equipment, cross-border trade). ` +
    `Translate each of the ${n} Chinese strings into SEVEN languages: English(en), Russian(ru), Spanish(es), Portuguese(pt), Arabic(ar), French(fr), Hindi(hi). ` +
    `Return a JSON array of exactly ${n} objects, in the same order. Each object MUST have exactly these 7 string keys: "en","ru","es","pt","ar","fr","hi". ` +
    `Example: {"en":"...","ru":"...","es":"...","pt":"...","ar":"...","fr":"...","hi":"..."}. ` +
    `Rules: 1) Output ONLY the JSON array, no markdown code fences, no commentary. ` +
    `2) Preserve ALL placeholders EXACTLY: {count}, {price}, {name}, {{var}}, %s, \\n, and HTML tags like <b></b> <a></a> unchanged. ` +
    `3) Keep brand names unchanged: ${BRANDS}. ` +
    `4) Arabic/Hindi natural RTL. 5) UI text concise and natural.`;
  const user = JSON.stringify(sources);
  const r = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${KEY}`, "Content-Type": "application/json", "HTTP-Referer": "https://usedfarmmach.com", "X-Title": "usedfarmmach-i18n" },
    body: JSON.stringify({ model: MODEL, temperature: 0.1, max_tokens: maxTokens, messages: [{ role: "system", content: sys }, { role: "user", content: user }] }),
  });
  if (!r.ok) { const t = await r.text(); const err = new Error(`HTTP ${r.status}: ${t.slice(0, 200)}`); err.status = r.status; throw err; }
  const j = await r.json();
  let txt = j.choices?.[0]?.message?.content?.trim() || "";
  txt = txt.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "");
  let arr;
  try { arr = JSON.parse(txt); } catch { arr = null; }
  if (!Array.isArray(arr) || arr.length !== n) throw new Error(`PARSE_FAIL len=${arr ? arr.length : "null"} expected=${n}`);
  return arr.map(el => {
    const out = {};
    for (const l of LANGS) out[l] = (el && typeof el[l] === "string") ? el[l] : (typeof el === "string" ? el : "");
    return out;
  });
}

async function translateBatchRobust(sources, maxTokens, attempt = 0) {
  try {
    return await callCombined(sources, maxTokens);
  } catch (e) {
    const isNet = e.status === undefined;
    const isRetryable = isNet || e.status === 429 || e.status >= 500 || String(e.message).startsWith("PARSE_FAIL");
    if (!isRetryable) { process.stderr.write(`  [fatal-type] ${e.message.slice(0, 80)}\n`); return null; }
    if (attempt >= 4) { process.stderr.write(`  [giveup] ${e.message.slice(0, 60)}\n`); return null; }
    const backoff = Math.min(15000, 1000 * 2 ** attempt) + Math.random() * 500;
    process.stderr.write(`  [retry] ${e.message.slice(0, 50)} attempt ${attempt + 1} after ${backoff | 0}ms\n`);
    await new Promise(r => setTimeout(r, backoff));
    return translateBatchRobust(sources, maxTokens, attempt + 1);
  }
}

async function runPool(items, worker, concurrency) {
  let i = 0;
  const results = new Array(items.length);
  async function next() {
    while (i < items.length) {
      const idx = i++;
      results[idx] = await worker(items[idx], idx);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, next));
  return results;
}

(async () => {
  const t0 = Date.now();
  const { dict, header } = loadDict();
  const allKeys = Object.keys(dict);
  console.log(`[v2] 字典共 ${allKeys.length} 键`);

  const pendingKeys = allKeys.filter(k => LANGS.some(l => { const v = dict[k] && dict[k][l]; return v === undefined || v === null || v === ""; }));
  console.log(`[v2] 待翻译 ${pendingKeys.length} 键`);
  const work = LIMIT ? pendingKeys.slice(0, LIMIT) : pendingKeys;

  const tiers = [
    { name: "短", filter: k => k.length <= 50, size: 30, max: 8000, conc: 6 },
    { name: "中", filter: k => k.length > 50 && k.length <= 200, size: 4, max: 14000, conc: 4 },
    { name: "长", filter: k => k.length > 200, size: 1, max: 16000, conc: 2 },
  ];
  let done = 0, totalBatches = 0;
  const batchesByTier = [];
  for (const t of tiers) {
    const keys = work.filter(t.filter);
    const batches = [];
    for (let i = 0; i < keys.length; i += t.size) batches.push(keys.slice(i, i + t.size));
    batchesByTier.push({ ...t, batches });
    totalBatches += batches.length;
    console.log(`[v2] ${t.name}串 ${keys.length} 键 → ${batches.length} 批`);
  }
  console.log(`[v2] 总批数 ${totalBatches}`);

  async function processBatch(batch, maxTokens) {
    const trs = await translateBatchRobust(batch, maxTokens);
    if (!trs) { process.stderr.write(`  [skip] 整批失败，留待续传 (${batch.length} 键)\n`); return; }
    let applied = 0;
    for (let i = 0; i < batch.length; i++) {
      const k = batch[i];
      const e = dict[k] || (dict[k] = {});
      let ok = true;
      for (const l of LANGS) if (trs[i] && trs[i][l]) e[l] = trs[i][l]; else ok = false;
      if (ok) { delete e.zh; applied++; }
    }
    done++;
    serialize(dict, header, allKeys);
    const sec = ((Date.now() - t0) / 1000) | 0;
    process.stdout.write(`[v2] 批 ${done}/${totalBatches} 完成 +${applied} (${sec}s)\n`);
  }

  for (const tb of batchesByTier) {
    if (!tb.batches.length) continue;
    await runPool(tb.batches, b => processBatch(b, tb.max), tb.conc);
  }

  for (const k of allKeys) if (dict[k] && LANGS.every(l => dict[k][l])) delete dict[k].zh;
  serialize(dict, header, allKeys);

  let full = 0, partial = 0, zh = 0;
  for (const k of allKeys) {
    const c = LANGS.filter(l => dict[k] && dict[k][l]).length;
    if (c === 7) full++; else if (c > 0) partial++; else if (dict[k] && dict[k].zh) zh++;
  }
  console.log(`[v2] 完成! 全语言 ${full} | 部分 ${partial} | 仅zh ${zh} | 总 ${allKeys.length} | 用时 ${((Date.now() - t0) / 1000) | 0}s`);
})().catch(e => { console.error("FATAL", e); process.exit(1); });
