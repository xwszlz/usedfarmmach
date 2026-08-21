/**
 * fix-missing-dict.js — 种子化 13 个「包了 tr() 但字典缺失」的中文源串
 *
 * 这些源串当前在非 zh 站点（含英文站）会回退显示中文，属 P0 真实缺陷。
 * 本脚本向 src/lib/i18n-dictionary.ts 追加 { en } 条目（仅加缺失键，幂等）。
 */
const fs = require("fs");
const path = require("path");

const DICT = path.join("D:/神雕农机/usedfarmmach/src/lib/i18n-dictionary.ts");

// 13 个缺失源串 -> 英文（按出现上下文人工拟定）
const MAP = {
  "想知道顶尖品牌与行业腰部品牌的差距？进入新锐专业馆，横向参数对比，理性决策。":
    "Want to see the gap between top brands and mid-tier brands? Enter the Emerging Brands Hall to compare specs side-by-side and decide with confidence.",
  "正式开拍后，拍品将在此列出；当前仅作合规公示与内部预览":
    "Once the auction goes live, lots will be listed here. For now this is shown for compliance disclosure and internal preview only.",
  "真实拍卖需持《拍卖经营批准证书》依法开展，通道筹备中":
    "Live auctions must be conducted lawfully with an Auction Operation Permit. This channel is in preparation.",
  "以下差异化能力将在取得资质后陆续开放（内部预览）":
    "The differentiated capabilities below will be rolled out progressively after licensing is obtained (internal preview).",
  "扫码上传您的现场作业视频，即刻展示在大屏上":
    "Scan to upload your field-operation video and showcase it on the big screen instantly.",
  "依法公开拍卖，持牌拍卖师主持，价高者得":
    "Public auction by law, hosted by a licensed auctioneer — highest bid wins.",
  "暂无现场视频，期待您的上传":
    "No field videos yet — we look forward to your uploads.",
  "现场作业视频集锦": "Field Operation Video Highlights",
  "真实拍卖通道": "Live Auction Channel",
  "上传作业视频": "Upload Operation Video",
  "中国品牌解决": "China Brand Solutions",
  "上线后将有": "Coming after launch",
  "真实拍卖": "Live Auction",
};

const text = fs.readFileSync(DICT, "utf8");
const existing = new Set();
const keyRe = /"((?:[^"\\]|\\.)*)"\s*:\s*\{/g;
let m;
while ((m = keyRe.exec(text))) existing.add(m[1]);

const toAdd = [];
for (const [zh, en] of Object.entries(MAP)) {
  if (existing.has(zh)) {
    console.log("SKIP (已存在): " + zh);
    continue;
  }
  toAdd.push('  "' + zh + '": {\n    "en": ' + JSON.stringify(en) + "\n  },");
}

if (toAdd.length === 0) {
  console.log("全部已存在，无需添加。");
  process.exit(0);
}

const idx = text.lastIndexOf("};");
if (idx === -1) {
  console.error("未找到字典结尾 };，中止。");
  process.exit(1);
}
// 在最后一个条目的 } 后补逗号（若已有逗号则跳过），再插入新条目，最后恢复 };
let head = text.slice(0, idx);
if (!/},\s*$/.test(head)) {
  head = head.replace(/}\s*$/, "},\n");
}
const newText = head + toAdd.join("\n") + "\n};\n";

fs.writeFileSync(DICT, newText, "utf8");
console.log("已追加 " + toAdd.length + " 个缺失条目到 i18n-dictionary.ts：");
toAdd.forEach((e) => console.log("  + " + e.split("\n")[0].slice(0, 40) + " ..."));
