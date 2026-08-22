// 严格检查 usedfarmmach 国际站 8 语言一致性
const esbuild = require("esbuild");
const fs = require("fs");
const path = require("path");

const ROOT = __dirname;
const SMALL = ["ru", "es", "pt", "ar", "fr", "hi"];
const ALL = ["zh", "en", "ru", "es", "pt", "ar", "fr", "hi"];

function flatten(o, p) {
  const r = {};
  p = p || "";
  for (const k of Object.keys(o || {})) {
    const v = o[k];
    if (v && typeof v === "object" && !Array.isArray(v)) {
      const sub = flatten(v, p ? p + "." + k : k);
      for (const kk of Object.keys(sub)) r[kk] = sub[kk];
    } else {
      r[p ? p + "." + k : k] = v;
    }
  }
  return r;
}

function q(s) {
  return "`" + s + "`";
}

(async () => {
  const result = await esbuild.build({
    entryPoints: [path.join(ROOT, "src/lib/i18n-dictionary.ts")],
    bundle: true,
    format: "cjs",
    write: false,
    platform: "node",
  });
  const code = result.outputFiles[0].text;
  const mod = { exports: {} };
  new Function("module", "exports", "require", code)(mod, mod.exports, require);
  const DICT = mod.exports.I18N_DICT || {};
  const keys = Object.keys(DICT);
  console.error("DICT extracted, size =", keys.length);

  let full8 = 0, onlyEn = 0, partial = 0, noEn = 0;
  const onlyEnKeys = [];
  const partialList = [];
  const noEnKeys = [];
  for (const k of keys) {
    const e = DICT[k] || {};
    const hasEn = !!e.en;
    const smalls = SMALL.filter((s) => !!e[s]);
    if (!hasEn) { noEn++; noEnKeys.push(k); }
    if (smalls.length === 6) full8++;
    else if (smalls.length === 0) { onlyEn++; onlyEnKeys.push(k); }
    else { partial++; partialList.push({ k: k, miss: SMALL.filter((s) => !e[s]) }); }
  }

  const msgs = {};
  for (const l of ALL) msgs[l] = JSON.parse(fs.readFileSync(path.join(ROOT, "messages", l + ".json"), "utf8"));
  const enKeys = Object.keys(flatten(msgs.en));
  const msgReport = {};
  for (const l of ALL) {
    if (l === "en") continue;
    const f = flatten(msgs[l]);
    msgReport[l] = enKeys.filter((k) => !(k in f));
  }

  const L = [];
  L.push("# usedfarmmach 国际站 8 语言一致性检查报告");
  L.push("");
  L.push("## 一、主线字典（tr() 走 i18n-dictionary.ts）语言覆盖");
  L.push("");
  L.push("- 字典总键数：" + keys.length);
  L.push("- 8 语言全齐（含 6 小语种）：" + full8 + " 个");
  L.push("- 仅 en、6 小语种全缺（小语种页回退英文）：" + onlyEn + " 个");
  L.push("- 部分小语种缺失：" + partial + " 个");
  L.push("- 连 en 都没有（异常，非 zh 页回退中文）：" + noEn + " 个");
  L.push("");
  L.push("### 仅 en 的键样例（最多 60 个）—— 这些键在 ru/es/pt/ar/fr/hi 页会显示英文");
  L.push("");
  onlyEnKeys.slice(0, 60).forEach((k) => L.push("- " + q(k)));
  L.push("");
  L.push("### 部分小语种缺失样例（最多 25 个）");
  L.push("");
  partialList.slice(0, 25).forEach((x) => L.push("- " + q(x.k) + " -> 缺: " + x.miss.join(", ")));
  L.push("");
  if (noEnKeys.length) {
    L.push("### 连 en 都缺失的键（异常）");
    L.push("");
    noEnKeys.slice(0, 20).forEach((k) => L.push("- " + q(k)));
    L.push("");
  }

  L.push("## 二、next-intl messages 键覆盖（以 en 为基线）");
  L.push("");
  L.push("- en 基线键数：" + enKeys.length);
  for (const l of ALL) {
    if (l === "en") continue;
    const miss = msgReport[l];
    L.push("- " + l + "：缺 " + miss.length + "/" + enKeys.length + " 个键" + (miss.length ? " | 样例: " + miss.slice(0, 8).join(", ") : ""));
  }
  L.push("");
  L.push("> 说明：next-intl 缺键时默认返回 key 字符串或报错（取决于 onError 配置）；");
  L.push("> 主线字典缺小语种条目时 translate() 回退英文。两者都会导致“点某语言却看到英文/中文/键名”。");

  const out = L.join("\n");
  fs.writeFileSync(path.join(ROOT, "lang-coverage-report.md"), out, "utf8");

  console.log("=== 字典 ===");
  console.log("总键:", keys.length, "| 8全:", full8, "| 仅en:", onlyEn, "| 部分:", partial, "| 无en:", noEn);
  console.log("=== messages(相对en基线的缺键) ===");
  for (const l of ALL) { if (l === "en") continue; console.log(l, "缺", msgReport[l].length); }
  console.log("\n报告已写入 lang-coverage-report.md");
})().catch((e) => { console.error("ERR", e); process.exit(1); });
