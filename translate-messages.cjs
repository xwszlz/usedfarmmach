// translate-messages.cjs — 补齐 messages/*.json 的缺键 + 英文泄漏值
// 源语言：英语（en.json 为基线）
// 用法试点： ONLY_LANG=ru LIMIT=15 node translate-messages.cjs
const fs = require("fs");
const path = require("path");
const { translateBatch, runPool } = require("./i18n-translate-core.cjs");

const MSG_DIR = path.resolve("messages");
const BASELINE = "en";
const TARGETS = ["ru", "es", "pt", "ar", "fr", "hi", "zh"];
const LANG_NAME = { en: "English", ru: "Russian", es: "Spanish", pt: "Portuguese", ar: "Arabic", fr: "French", hi: "Hindi", zh: "Chinese" };
const BATCH = 30;
const ONLY_LANG = process.env.ONLY_LANG;
const LIMIT = process.env.LIMIT ? parseInt(process.env.LIMIT, 10) : null;

function walk(enNode, tgNode, path, jobs) {
  if (typeof enNode === "string") {
    if (tgNode === undefined || tgNode === null || tgNode === enNode) jobs.push({ path, src: enNode });
    return;
  }
  if (Array.isArray(enNode)) {
    enNode.forEach((el, i) => walk(el, Array.isArray(tgNode) ? tgNode[i] : undefined, path + "." + i, jobs));
    return;
  }
  if (enNode && typeof enNode === "object") {
    for (const k of Object.keys(enNode)) {
      const child = tgNode && typeof tgNode === "object" && !Array.isArray(tgNode) ? tgNode[k] : undefined;
      walk(enNode[k], child, path ? path + "." + k : k, jobs);
    }
  }
}
function setByPath(root, p, value) {
  const segs = p.split(".");
  let cur = root;
  for (let i = 0; i < segs.length; i++) {
    const seg = segs[i];
    if (i === segs.length - 1) { cur[seg] = value; return; }
    if (cur[seg] === undefined || cur[seg] === null) cur[seg] = /^\d+$/.test(segs[i + 1]) ? [] : {};
    cur = cur[seg];
  }
}

(async () => {
  const base = JSON.parse(fs.readFileSync(path.join(MSG_DIR, BASELINE + ".json"), "utf8"));
  const langs = ONLY_LANG ? [ONLY_LANG] : TARGETS;
  for (const lang of langs) {
    const fp = path.join(MSG_DIR, lang + ".json");
    const tg = JSON.parse(fs.readFileSync(fp, "utf8"));
    const jobs = [];
    walk(base, tg, "", jobs);
    if (LIMIT) jobs.length = Math.min(jobs.length, LIMIT);
    console.log(`[msg ${lang}] 待处理 ${jobs.length} 条（缺键/英文泄漏）`);
    if (!jobs.length) continue;
    const batches = [];
    for (let i = 0; i < jobs.length; i += BATCH) batches.push(jobs.slice(i, i + BATCH));
    const outs = await runPool(
      batches.map((b, bi) => ({ b, bi })),
      async ({ b }) => translateBatch(b.map(j => j.src), { srcLang: "English", tgtLang: LANG_NAME[lang] }),
      8
    );
    batches.forEach((b, bi) => { const trs = outs[bi]; b.forEach((j, i) => setByPath(tg, j.path, trs[i])); });
    fs.writeFileSync(fp, JSON.stringify(tg, null, 2) + "\n");
    console.log(`[msg ${lang}] 已写回 ${fp}`);
  }
})().catch(e => { console.error("FATAL", e); process.exit(1); });
