// 合并门禁：校验 8 语 messages 中 credits 命名空间键集合一致
// 运行：node scripts/check-credits-i18n-keys.mjs  (在 usedfarmmach 根目录)
import fs from "node:fs";
import path from "node:path";

const MSG_DIR = path.resolve("messages");
const LANGS = ["zh", "en", "ar", "es", "fr", "hi", "pt", "ru"];

function getCredits(obj) {
  const credits = obj?.credits;
  if (typeof credits === "string") return { type: "string", keys: null, tt: null };
  if (!credits || typeof credits !== "object")
    return { type: "missing", keys: null, tt: null };
  const keys = Object.keys(credits).filter((k) => k !== "transactionTypes");
  const tt = credits.transactionTypes;
  const ttKeys = tt && typeof tt === "object" ? Object.keys(tt) : null;
  return { type: "object", keys, tt: ttKeys };
}

let ok = true;
const report = {};

for (const lang of LANGS) {
  const file = path.join(MSG_DIR, `${lang}.json`);
  if (!fs.existsSync(file)) {
    console.log(`❌ ${lang}.json 缺失`);
    ok = false;
    continue;
  }
  let data;
  try {
    data = JSON.parse(fs.readFileSync(file, "utf8"));
  } catch (e) {
    console.log(`❌ ${lang}.json 解析失败: ${e.message}`);
    ok = false;
    continue;
  }
  const info = getCredits(data);
  report[lang] = info;
  if (info.type !== "object") {
    console.log(`❌ ${lang}: credits 为 ${info.type}（应为对象）`);
    ok = false;
  }
}

// 顶层 credits 键集对比
const sets = Object.entries(report).map(([l, i]) => [l, i.keys ? new Set(i.keys) : null]);
const ref = sets.find(([, s]) => s);
if (ref) {
  const [refLang, refSet] = ref;
  for (const [lang, set] of sets) {
    if (!set) continue;
    const missing = [...refSet].filter((k) => !set.has(k));
    const extra = [...set].filter((k) => !refSet.has(k));
    if (missing.length || extra.length) {
      ok = false;
      console.log(`❌ ${lang} credits 键集 vs ${refLang} → 缺[${missing}] 多[${extra}]`);
    } else {
      console.log(`✅ ${lang} credits 顶层键集一致 (${set.size} 键)`);
    }
  }
}

// transactionTypes 子键对比
const ttSets = Object.entries(report).map(([l, i]) => [l, i.tt ? new Set(i.tt) : null]);
const ttRef = ttSets.find(([, s]) => s);
if (ttRef) {
  const [refLang, refSet] = ttRef;
  for (const [lang, set] of ttSets) {
    if (!set) continue;
    const missing = [...refSet].filter((k) => !set.has(k));
    const extra = [...set].filter((k) => !refSet.has(k));
    if (missing.length || extra.length) {
      ok = false;
      console.log(`❌ ${lang}.transactionTypes vs ${refLang} → 缺[${missing}] 多[${extra}]`);
    } else {
      console.log(`✅ ${lang}.transactionTypes 键集一致 (${set.size} 键)`);
    }
  }
}

console.log(ok ? "\n✅ PASS: 8 语 credits 命名空间键集完全一致" : "\n❌ FAIL: 存在不一致");
process.exit(ok ? 0 : 1);
