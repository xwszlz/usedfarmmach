/**
 * 专家校准校验（可重复执行）
 * 运行：npx tsx src/lib/valuation/__tests__/expert-calibration.check.ts
 *
 * 输出三部分：
 *  1. 系数偏差表（渠道 / 补贴到手 / 发动机溢价 / 品牌折价）
 *  2. 工时-残值锚点对比（我们的 HOURS_DEPRECIATION_CURVE vs 专家隐含残值）
 *  3. 端到端对比（引擎 calculateValuation vs 专家基准零售价）
 *
 * 注意：本文件是「报告型校验」，不是断言型单测——用于人工评审系数是否需要重标定。
 */

import {
  loadExpertSamples,
  getSampleSetMeta,
  buildCalibrationReport,
  toEngineInput,
} from "../expert-calibration";
import { calculateValuation } from "../formulas";

const n3 = (v: number | null | undefined): string =>
  v == null || !isFinite(v) ? "—" : v.toFixed(3);
const n1 = (v: number | null | undefined): string =>
  v == null || !isFinite(v) ? "—" : `${(v as number) > 0 ? "+" : ""}${(v as number).toFixed(1)}%`;
const wan = (v: number | null | undefined): string =>
  v == null || !isFinite(v) ? "—" : `${(v / 10000).toFixed(2)}万`;

function main(): void {
  const meta = getSampleSetMeta();
  console.log("=".repeat(78));
  console.log(
    `专家校准样本库  schema=v${meta.schemaVersion}  更新=${meta.updatedAt}  样本数=${meta.count}`
  );
  console.log("=".repeat(78));

  const samples = loadExpertSamples();
  if (!samples.length) {
    console.log("样本库为空，退出。");
    return;
  }

  for (const s of samples) {
    console.log(`\n\n########## 样本 ${s.id} ##########`);
    console.log(`来源：${s.sourceRef}`);
    console.log(
      `标的：${s.asset.brand} ${s.asset.model} · ${s.asset.powerHp}HP · ${s.asset.drive} · ` +
        `${s.asset.engine} · ${s.asset.prodYear}年 · ${s.asset.region} · ${s.asset.emission}`
    );

    const rep = buildCalibrationReport(s);

    console.log("\n【1】系数偏差（当前 vs 专家隐含，容差 ±5%）");
    console.log("-".repeat(78));
    console.log("维度".padEnd(22) + "当前".padEnd(10) + "专家".padEnd(10) + "偏差".padEnd(11) + "判定");
    console.log("-".repeat(78));
    for (const f of rep.findings) {
      console.log(
        f.label.padEnd(20) + n3(f.current).padEnd(10) + n3(f.expert).padEnd(10) + n1(f.deviationPct).padEnd(11) + f.verdict
      );
      console.log(`   └ ${f.suggestion}`);
    }
    console.log(`\n   超出容差维度数：${rep.misalignedCount}`);

    console.log("\n【2】工时-残值锚点（专家隐含残值 vs 我们 HOURS_DEPRECIATION_CURVE）");
    console.log("-".repeat(78));
    console.log(
      "工况".padEnd(8) + "工时".padEnd(10) + "零售中位".padEnd(12) + "毛残值".padEnd(10) + "剥发动机".padEnd(11) + "我们曲线".padEnd(11) + "偏差".padEnd(11) + "判定"
    );
    console.log("-".repeat(78));
    for (const a of rep.hourAnchors) {
      console.log(
        `工况${a.tier}`.padEnd(8) +
          `${a.hours ?? "—"}h`.padEnd(10) +
          wan(a.retailMid).padEnd(12) +
          n3(a.grossResidual).padEnd(10) +
          n3(a.residualExEngine).padEnd(11) +
          n3(a.ourResidual).padEnd(11) +
          n1(a.deviationPct).padEnd(11) +
          a.verdict +
          (a.note ? `  (${a.note})` : "")
      );
    }

    console.log("\n【3】端到端对比（引擎 calculateValuation vs 专家基准零售价）");
    console.log("-".repeat(78));
    const input = toEngineInput(s);
    const r = calculateValuation(input);
    const expert = s.benchmark?.retailMid;
    const dev = expert ? ((r.estimatedValue - expert) / expert) * 100 : null;
    console.log("引擎输入：", JSON.stringify(input));
    console.log(
      `引擎估值 ${wan(r.estimatedValue)} (${r.estimatedValue})  |  专家基准 ${wan(expert)}  |  偏差 ${n1(dev)}`
    );
    console.log(`专家区间 ${wan(s.benchmark?.retailRange?.[0])} ~ ${wan(s.benchmark?.retailRange?.[1])}`);
    if (r.channelPrices) {
      const cp = r.channelPrices as Record<string, number>;
      console.log(
        "渠道矩阵：" +
          Object.entries(cp)
            .map(([k, v]) => `${k}=${wan(v)}`)
            .join("  ")
      );
      console.log(`专家口径：商贩收购 ${wan(s.channels?.dealerBuyMid)} ；FOB ${wan(s.exportFob?.fobMid)}`);
    }
    console.log(`\n待补采项：${(s.missingVerification ?? []).join("、")}`);
  }

  console.log("\n" + "=".repeat(78));
  console.log("说明：专家样本通常未给出真实工时，【3】按专家假想工况(hoursMid)代理，结论标注“按专家假想工况”。");
  console.log("=".repeat(78));
}

main();
