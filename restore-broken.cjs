// restore-broken.cjs — 把 9 个被旧版 i18n-wrap 损坏的文件从备份恢复为「包裹前」干净版本
const fs = require("fs");
const path = require("path");

const BROKEN = [
  "src/app/[locale]/admin/analytics/views/ViewsAnalyticsClient.tsx",
  "src/app/[locale]/admin/expo/manage/ManageClient.tsx",
  "src/app/[locale]/admin/export-compliance/page.tsx",
  "src/app/[locale]/benchmark/BenchmarkClient.tsx",
  "src/app/[locale]/m/qr/[qrCode]/client.tsx",
  "src/app/[locale]/seller/booth/page.tsx",
  "src/components/cn/CnPriceIndexChart.tsx",
  "src/components/orchestrator/dashboard.tsx",
  "src/components/valuation/deep-report-section.tsx",
];

let ok = 0, miss = 0;
for (const f of BROKEN) {
  // app 文件: 去 src/app/ 前缀, 加 .i18n-pilot-bak/applocale/ 前缀
  // comp 文件: 去 src/ 前缀, 加 .i18n-pilot-bak/components/ 前缀
  let bak;
  if (f.startsWith("src/app/")) bak = path.join(".i18n-pilot-bak/applocale", f.slice("src/app/".length));
  else bak = path.join(".i18n-pilot-bak/components", f.slice("src/".length));
  if (!fs.existsSync(bak)) { console.log("  [缺失备份] " + f + " -> " + bak); miss++; continue; }
  fs.copyFileSync(bak, f);
  console.log("  [已恢复] " + f);
  ok++;
}
console.log(`\n恢复完成: ${ok} 个, 缺失备份 ${miss} 个`);
