// 试点探针 v2：验证 gemini-2.5-flash-lite 翻译 + 占位符保留 + 阿/印/法
const KEY = process.env.OPENROUTER_API_KEY;
if (!KEY) { console.error("NO_KEY"); process.exit(2); }
const MODEL = process.env.TEST_MODEL || "google/gemini-2.5-flash-lite";

const samples = [
  { zh: "提交", target: "Russian (ru)" },
  { zh: "共 {count} 件商品", target: "Spanish (es)" },
  { zh: "您的订单 <b>已发货</b>", target: "Portuguese (pt)" },
  { zh: "欢迎使用神雕农机跨境交易平台", target: "Arabic (ar)" },
  { zh: "价格 {price} 元，库存 {stock} 台", target: "Hindi (hi)" },
  { zh: "联系卖家", target: "French (fr)" },
];

async function tr(zh, target) {
  const sys = `You are a professional translator for an agricultural machinery trading platform (used farm equipment). Translate the user's text from Chinese to ${target}. Rules: 1) Output ONLY the translation, no quotes, no explanations. 2) Preserve ALL placeholders exactly: {count}, {price}, {stock}, {name}, {{var}}, %s, and HTML tags like <b></b> must remain unchanged. 3) Keep brand names unchanged: 神雕农机, CLAAS, John Deere, New Holland, Fendt, Agriaffaires. 4) For RTL languages (Arabic) output natural RTL text.`;
  const r = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${KEY}`, "Content-Type": "application/json",
      "HTTP-Referer": "https://usedfarmmach.com", "X-Title": "usedfarmmach-i18n" },
    body: JSON.stringify({ model: MODEL, temperature: 0.1, max_tokens: 300,
      messages: [{ role: "system", content: sys }, { role: "user", content: zh }] }),
  });
  if (!r.ok) { const t = await r.text(); throw new Error(`HTTP ${r.status}: ${t.slice(0,300)}`); }
  const j = await r.json();
  return { text: j.choices?.[0]?.message?.content?.trim(), usage: j.usage };
}

(async () => {
  console.log("MODEL:", MODEL);
  const t0 = Date.now();
  for (const s of samples) {
    const t0i = Date.now();
    const out = await tr(s.zh, s.target);
    console.log(`\n[${s.target}] "${s.zh}"\n  -> ${out.text}\n  (${Date.now()-t0i}ms)`);
  }
  console.log(`\nTOTAL ${Date.now()-t0}ms for ${samples.length} calls`);
})().catch(e => { console.error("ERR:", e.message); process.exit(1); });
