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
  deriveAgeAnchors,
} from "../expert-calibration";
import { calculateValuation, calcCombinedDepreciation } from "../formulas";

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
    const sampleType = s.sampleType ?? "expert-machine";
    const confidence = s.confidence ?? "—";
    console.log(`\n\n########## 样本 ${s.id} ##########`);
    console.log(`类型：${sampleType}    置信度：${confidence}`);
    console.log(`来源：${s.sourceRef}`);
    console.log(
      sampleType === "market-curve"
        ? `标的：品类=${s.asset?.category ?? "—"} · 年均工时=${s.asset?.annualHours ?? "—"} h/yr · ${s.asset?.region ?? "—"}`
        : `标的：${s.asset?.brand ?? "—"} ${s.asset?.model ?? "—"} · ${s.asset?.powerHp ?? "—"}HP · ${s.asset?.drive ?? "—"} · ` +
            `${s.asset?.engine ?? "—"} · ${s.asset?.prodYear ?? "—"}年 · ${s.asset?.region ?? "—"} · ${s.asset?.emission ?? "—"}`
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
    if (!rep.hourAnchors.length) {
      console.log("（本样本无成色档/单机价格数据，跳过）");
    } else {
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
    }

    // 【3】机龄-残值锚点：只输出带 ageResidualAnchors 的样本
    const ageAnchors = deriveAgeAnchors(s);
    if (ageAnchors.length) {
      console.log("\n【3】机龄残值锚点（我们 min(工时曲线,机龄表) vs 样本锚点 vs ASABE 参考）");
      console.log("-".repeat(78));
      console.log(
        "机龄".padEnd(6) +
          "合成工时".padEnd(10) +
          "我们(工时曲线)".padEnd(16) +
          "我们(机龄表)".padEnd(14) +
          "我们(min)".padEnd(12) +
          "样本锚点".padEnd(11) +
          "偏差".padEnd(11) +
          "ASABE参考".padEnd(12) +
          "ASABE偏差".padEnd(12) +
          "判定"
      );
      console.log("-".repeat(78));
      let sumAbs = 0;
      let sumSigned = 0;
      let sumAsabeAbs = 0;
      let n = 0;
      for (const a of ageAnchors) {
        const dev = a.deviationPct;
        const adev = a.asabeDeviationPct;
        if (dev != null && isFinite(dev)) {
          sumAbs += Math.abs(dev);
          sumSigned += dev;
          n++;
        }
        if (adev != null && isFinite(adev)) sumAsabeAbs += Math.abs(adev);
        console.log(
          `${a.ageYears}y`.padEnd(6) +
            `${a.synthHours == null ? "—" : `${a.synthHours}h`}`.padEnd(10) +
            n3(a.hoursCurveResidual).padEnd(16) +
            n3(a.ageTableResidual).padEnd(14) +
            n3(a.ourResidual).padEnd(12) +
            n3(a.anchorResidual).padEnd(11) +
            n1(dev).padEnd(11) +
            n3(a.asabeResidual).padEnd(12) +
            n1(adev).padEnd(12) +
            a.verdict +
            (a.note ? `  (${a.note})` : "")
        );
      }
      console.log("-".repeat(78));
      console.log(
        `我们：总绝对偏差 ${sumAbs.toFixed(1)}pp  平均绝对偏差 ${n ? (sumAbs / n).toFixed(1) : "—"}pp  ` +
          `平均有符号偏差 ${n ? (sumSigned / n).toFixed(1) : "—"}pp（正=我们高估）`
      );
      console.log(
        `ASABE 参考列（未接入主链路，仅供对照）：总绝对偏差 ${sumAsabeAbs.toFixed(1)}pp  ` +
          `平均绝对偏差 ${n ? (sumAsabeAbs / n).toFixed(1) : "—"}pp`
      );
    }

    console.log("\n【4】端到端对比（引擎 calculateValuation vs 专家基准零售价）");
    console.log("-".repeat(78));
    const expert = s.benchmark?.retailMid;
    if (!expert) {
      console.log("（本样本无单机基准价（market-curve / 缺 benchmark），跳过端到端对比）");
    } else {
      const input = toEngineInput(s);
      const r = calculateValuation(input);
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
    }
    console.log(`\n待补采项：${(s.missingVerification ?? []).join("、")}`);
  }

  // ===== 回归自检：无工时表品类必须回退机龄法，有工时表品类必须走工时法 =====
  console.log("\n" + "=".repeat(78));
  console.log("【回归自检】品类工时开关（calcCombinedDepreciation 第 4 参数）");
  console.log("-".repeat(78));
  const baler = calcCombinedDepreciation(5000, 2015, 2026, "打捆机");
  const tractor = calcCombinedDepreciation(5000, 2015, 2026, "轮式拖拉机");
  const noCat = calcCombinedDepreciation(5000, 2015, 2026);
  console.log(
    `打捆机(无工时表)  usedHours=${baler.usedHours}  折旧=${baler.depreciationFactor.toFixed(3)}  (期望 usedHours=false)`
  );
  console.log(
    `轮式拖拉机       usedHours=${tractor.usedHours}  折旧=${tractor.depreciationFactor.toFixed(3)}  (期望 usedHours=true)`
  );
  console.log(
    `未传品类(兜底)    usedHours=${noCat.usedHours}  折旧=${noCat.depreciationFactor.toFixed(3)}`
  );
  // 再看一个「工时曲线与机龄表结论不同」的机龄点，确认开关真的改变了折旧值
  const baler6 = calcCombinedDepreciation(5000, 2020, 2026, "打捆机");
  const tractor6 = calcCombinedDepreciation(5000, 2020, 2026, "轮式拖拉机");
  console.log(
    `6年机(无工时表)   折旧=${baler6.depreciationFactor.toFixed(3)}（=机龄法 ${baler6.ageFactor.toFixed(3)}）  ` +
      `| 6年机(轮拖) 折旧=${tractor6.depreciationFactor.toFixed(3)}（=工时法 ${tractor6.hoursFactor.toFixed(3)}）`
  );
  const ok =
    baler.usedHours === false &&
    tractor.usedHours === true &&
    baler6.depreciationFactor === baler6.ageFactor &&
    tractor6.depreciationFactor === tractor6.hoursFactor;
  console.log(ok ? "✅ 回归自检通过" : "❌ 回归自检失败");

  console.log("\n" + "=".repeat(78));
  console.log("说明：专家样本通常未给出真实工时，【4】按专家假想工况(hoursMid)代理，结论标注“按专家假想工况”。");
  console.log("=".repeat(78));
}

main();
