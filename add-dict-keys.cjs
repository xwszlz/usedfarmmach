// 把 .i18n-wrap-keys.json 收集到的新源串加入 I18N_DICT
// 新键以 { "zh": 源串 } 写入（zh=源串本身，符合 translate() 回退；且避免"全空丢键"）
// 保留已有条目及其翻译不变，仅追加新键。
const fs = require("fs");
const path = require("path");
const DICT = path.resolve("src/lib/i18n-dictionary.ts");
const js = fs.readFileSync(DICT, "utf8").split("\n").filter(l => !/^\s*import\s/.test(l)).join("\n");
const obj = new Function(js.replace(/export const I18N_DICT\b[\s\S]*?=\s/, "return "))();

const newKeys = JSON.parse(fs.readFileSync(".i18n-all-keys.json", "utf8"));
let added = 0, skipped = 0;
for (const k of newKeys) {
  if (obj[k] && Object.keys(obj[k]).length) { skipped++; continue; }
  obj[k] = { zh: k };
  added++;
}

// 重新生成文件（保留 import 头与类型注解）
const lines = ['import type { I18nEntry } from "./i18n-types";', "", 'export const I18N_DICT: Record<string, I18nEntry> = {'];
for (const k of Object.keys(obj)) {
  const e = obj[k];
  const parts = Object.keys(e).map(l => `    "${l}": ${JSON.stringify(e[l])}`);
  lines.push(`  ${JSON.stringify(k)}: {` + (parts.length ? "\n" + parts.join(",\n") + "\n  " : "") + `},`);
}
lines.push("};");
lines.push("");
fs.writeFileSync(DICT, lines.join("\n"));
console.log("字典更新完成: 新增 " + added + " 键, 跳过已存在 " + skipped + " 键, 现有总计 " + Object.keys(obj).length + " 键");
