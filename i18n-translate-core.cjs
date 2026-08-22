// i18n-translate-core.cjs
// 翻译内核：基于 OpenRouter (默认 llama-3.3-70b-instruct) 的批量翻译
// 特性：N 条批量、JSON 数组返回、并发池、429/5xx 退避重试、占位符/HTML/品牌名保护
const KEY = process.env.OPENROUTER_API_KEY;
const MODEL = process.env.I18N_MODEL || "meta-llama/llama-3.3-70b-instruct";

if (!KEY) { console.error("[core] 缺少 OPENROUTER_API_KEY 环境变量"); process.exit(2); }

const BRANDS = "神雕农机, CLAAS, John Deere, New Holland, Fendt, Agriaffaires, usedfarmmach";

async function callOnce(sources, srcLang, tgtLang) {
  const n = sources.length;
  const sys = `You are a professional translator for an agricultural machinery trading platform (used farm equipment, cross-border trade). ` +
    `Translate each of the ${n} strings from ${srcLang} to ${tgtLang}. ` +
    `Return a JSON array of exactly ${n} strings, in the same order. ` +
    `Rules: 1) Output ONLY the JSON array, no markdown code fences, no commentary, no numbering. ` +
    `2) Preserve ALL placeholders EXACTLY: {count}, {price}, {name}, {{var}}, %s, \\n, and HTML tags like <b></b> <a></a> must remain unchanged. ` +
    `3) Keep brand names unchanged: ${BRANDS}. ` +
    `4) For RTL target languages (Arabic) output natural RTL text. ` +
    `5) UI text must be concise and natural in the target language.`;
  const user = JSON.stringify(sources);
  const r = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${KEY}`, "Content-Type": "application/json",
      "HTTP-Referer": "https://usedfarmmach.com", "X-Title": "usedfarmmach-i18n" },
    body: JSON.stringify({ model: MODEL, temperature: 0.1, max_tokens: 8000,
      messages: [{ role: "system", content: sys }, { role: "user", content: user }] }),
  });
  if (!r.ok) {
    const t = await r.text();
    const err = new Error(`HTTP ${r.status}: ${t.slice(0, 200)}`);
    err.status = r.status;
    throw err;
  }
  const j = await r.json();
  let txt = j.choices?.[0]?.message?.content?.trim() || "";
  // 容错：去掉可能的 ```json 围栏
  txt = txt.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "");
  let arr;
  try { arr = JSON.parse(txt); } catch { arr = null; }
  if (!Array.isArray(arr) || arr.length !== n) {
    throw new Error(`PARSE_FAIL len=${arr ? arr.length : "null"} expected=${n}`);
  }
  return arr.map(s => (typeof s === "string" ? s : String(s)));
}

async function translateBatch(sources, { srcLang, tgtLang }) {
  let lastErr;
  const isRetryable = (e) => e.status === 429 || e.status >= 500 || String(e.message).startsWith("PARSE_FAIL") || e.status === undefined;
  for (let attempt = 0; attempt < 3; attempt++) {
    try { return await callOnce(sources, srcLang, tgtLang); }
    catch (e) {
      lastErr = e;
      if (!isRetryable(e)) throw e; // 真正不可重试的错误（极少见）
      const backoff = Math.min(15000, 1000 * 2 ** attempt) + Math.random() * 500;
      process.stderr.write(`  [warn] ${String(e.message).slice(0, 60)} retry ${attempt + 1} after ${backoff | 0}ms\n`);
      await new Promise(r => setTimeout(r, backoff));
    }
  }
  // 3 次批量失败 → 降级逐条翻译（并发池，避免串行过慢）
  process.stderr.write(`  [fallback] 批量失败，逐条翻译 ${sources.length} 条\n`);
  const POOL = 8;
  const one = async (s) => {
    for (let a = 0; a < 3; a++) {
      try { const r = await callOnce([s], srcLang, tgtLang); return r[0]; }
      catch (e) { lastErr = e; if (a === 2) return s; await new Promise(r => setTimeout(r, 400)); }
    }
    return s;
  };
  const out = new Array(sources.length);
  let i = 0;
  async function nextOne() {
    while (i < sources.length) { const idx = i++; out[idx] = await one(sources[idx]); }
  }
  await Promise.all(Array.from({ length: Math.min(POOL, sources.length) }, nextOne));
  return out;
}

// 并发池
async function runPool(items, worker, concurrency = 8) {
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

module.exports = { translateBatch, runPool, MODEL };
