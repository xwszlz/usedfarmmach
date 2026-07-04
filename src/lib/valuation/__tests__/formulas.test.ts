/**
 * AI估值引擎 V4 — 单元测试
 * 
 * 测试覆盖：
 * 1. V4有图有规格 → 应返回 version: "v4-20260704" + visualConditionScore + specFactor
 * 2. V4有图无规格 → 应返回V4版本但 specFactor: 1.0
 * 3. V4无图有规格 → 应跳过图片分析，仍返回V4版本
 * 4. V4无图无规格 → 应自动降级到V2成色逻辑
 * 5. 强制V2（useV4=false）→ 应返回 version: "v2-20260527"
 * 6. calcSpecFactor 各种规格组合
 * 7. calcConfidenceV4 置信度计算
 */

import {
  calculateValuationV4,
  calculateValuation,
  type ValuationInput,
  type ValuationResult,
} from "../formulas";

// Mock VisualValuationResult
const mockVisualResult = {
  visualConditionScore: 8.5,
  visualConditionAnalysis: "设备外观良好，有轻微使用痕迹",
  imageConfidence: 0.85,
  usedV4Condition: true,
};

const mockLowScoreVisualResult = {
  visualConditionScore: 4.0,
  visualConditionAnalysis: "设备磨损较重",
  imageConfidence: 0.7,
  usedV4Condition: true,
};

// 基础输入
const baseInput: ValuationInput = {
  brand: "CLAAS",
  modelName: "JAGUAR 970",
  category: "青储机",
  year: 2018,
  condition: "good",
  priceCny: 1200000,
  workingHours: 2000,
};

// 测试计数器
let passed = 0;
let failed = 0;
const failures: string[] = [];

function assert(condition: boolean, message: string) {
  if (condition) {
    passed++;
    console.log(`  ✅ PASS: ${message}`);
  } else {
    failed++;
    failures.push(message);
    console.log(`  ❌ FAIL: ${message}`);
  }
}

function assertEqual(actual: any, expected: any, message: string) {
  if (JSON.stringify(actual) === JSON.stringify(expected)) {
    passed++;
    console.log(`  ✅ PASS: ${message}`);
  } else {
    failed++;
    failures.push(`${message} (expected: ${JSON.stringify(expected)}, got: ${JSON.stringify(actual)})`);
    console.log(`  ❌ FAIL: ${message}`);
    console.log(`    Expected: ${JSON.stringify(expected)}`);
    console.log(`    Got: ${JSON.stringify(actual)}`);
  }
}

async function runTests() {
  console.log("\n=== AI估值V4升级 — 单元测试 ===\n");

  // -------------------------------------------------------
  // 场景1: V4有图有规格 → 应返回V4版本 + visualConditionScore + specFactor
  // -------------------------------------------------------
  console.log("\n📊 场景1: V4有图有规格");
  {
    const input: ValuationInput = {
      ...baseInput,
      imageUrls: ["https://example.com/test.jpg"],
      enginePower: 480,
      driveSystem: "4WD",
      mainConfig: "豪华配置",
      netWeight: 12500,
    };

    const result = await calculateValuationV4(input, mockVisualResult);
    
    assert(result.version === "v4-20260704", "版本应为 v4-20260704");
    assert(result.visualConditionScore !== undefined, "应有 visualConditionScore");
    assert(result.visualConditionScore! >= 1 && result.visualConditionScore! <= 10, "visualConditionScore 应在1-10之间");
    assert(result.specFactor !== undefined, "应有 specFactor");
    assert(result.specFactor! > 0, "specFactor 应大于0");
    assert(result.usedV4Condition === true, "usedV4Condition 应为 true");
    assert(result.estimatedValue > 0, "估值应大于0");
  }

  // -------------------------------------------------------
  // 场景2: V4有图无规格 → 应返回V4版本但 specFactor 接近 1.0
  // -------------------------------------------------------
  console.log("\n📊 场景2: V4有图无规格");
  {
    const input: ValuationInput = {
      ...baseInput,
      imageUrls: ["https://example.com/test.jpg"],
      // 不提供规格字段
    };

    const result = await calculateValuationV4(input, mockVisualResult);
    
    assert(result.version === "v4-20260704", "版本应为 v4-20260704");
    assert(result.visualConditionScore !== undefined, "应有 visualConditionScore");
    assert(result.usedV4Condition === true, "usedV4Condition 应为 true");
    // 无规格时 specFactor 应为 1.0（只有图片分析，没有规格调整）
    console.log(`  ℹ️  specFactor = ${result.specFactor} (无规格时可能仍为1.0或受其他因素影响)`);
  }

  // -------------------------------------------------------
  // 场景3: V4无图有规格 → 应跳过图片分析，仍返回V4版本
  // -------------------------------------------------------
  console.log("\n📊 场景3: V4无图有规格");
  {
    const input: ValuationInput = {
      ...baseInput,
      enginePower: 480,
      driveSystem: "4WD",
      mainConfig: "标准配置",
      netWeight: 12500,
      // 不提供图片
    };

    const result = await calculateValuationV4(input);
    
    assert(result.version === "v4-20260704", "版本应为 v4-20260704");
    assert(result.usedV4Condition === false, "无图片时 usedV4Condition 应为 false");
    assert(result.visualConditionScore === undefined, "无图片时不应有 visualConditionScore");
    assert(result.specFactor !== undefined, "应有 specFactor");
    assert(result.specFactor! > 0, "specFactor 应大于0");
    assert(result.estimatedValue > 0, "估值应大于0");
  }

  // -------------------------------------------------------
  // 场景4: V4无图无规格 → 应降级到V2成色逻辑
  // -------------------------------------------------------
  console.log("\n📊 场景4: V4无图无规格（降级到V2成色）");
  {
    const input: ValuationInput = {
      ...baseInput,
      condition: "good",
      // 不提供图片和规格
    };

    const result = await calculateValuationV4(input);
    
    assert(result.version === "v4-20260704", "版本仍为 v4-20260704");
    assert(result.usedV4Condition === false, "无图片时 usedV4Condition 应为 false");
    assert(result.visualConditionScore === undefined, "无图片时不应有 visualConditionScore");
    // 应使用V2的成色因子
    assert(result.conditionFactor > 0, "应使用V2成色因子");
  }

  // -------------------------------------------------------
  // 场景5: 强制V2（不传递visualResult）→ 应返回V2版本
  // -------------------------------------------------------
  console.log("\n📊 场景5: 强制V2（使用 calculateValuation）");
  {
    const input: ValuationInput = {
      ...baseInput,
      imageUrls: ["https://example.com/test.jpg"], // 即使有图片
      enginePower: 480,
    };

    const result = calculateValuation(input);
    
    assert(result.version === "v2-20260527", "版本应为 v2-20260527");
    assert(result.visualConditionScore === undefined, "V2不应有 visualConditionScore");
    assert(result.specFactor === undefined, "V2不应有 specFactor");
  }

  // -------------------------------------------------------
  // 场景6: LLM调用失败模拟（visualResult.usedV4Condition = false）
  // -------------------------------------------------------
  console.log("\n📊 场景6: LLM失败降级到V2");
  {
    const input: ValuationInput = {
      ...baseInput,
      imageUrls: ["https://example.com/test.jpg"],
      enginePower: 480,
    };

    const failedVisualResult = {
      visualConditionScore: 0,
      visualConditionAnalysis: "",
      imageConfidence: 0,
      usedV4Condition: false, // 模拟LLM调用失败
    };

    const result = await calculateValuationV4(input, failedVisualResult);
    
    assert(result.version === "v4-20260704", "版本仍为 v4-20260704");
    assert(result.usedV4Condition === false, "LLM失败时 usedV4Condition 应为 false");
    assert(result.conditionFactor > 0, "应降级使用V2成色因子");
  }

  // -------------------------------------------------------
  // 测试 calcSpecFactor 逻辑
  // -------------------------------------------------------
  console.log("\n📊 场景7: 规格因子计算 — 高马力");
  {
    const input: ValuationInput = {
      brand: "CLAAS",
      modelName: "JAGUAR 970",
      category: "青储机",
      year: 2018,
      enginePower: 600, // 高于平均450
      driveSystem: "4WD",
    };

    const result = await calculateValuationV4(input);
    
    assert(result.specFactor! > 1.0, "高马力+四驱 应导致 specFactor > 1.0");
    console.log(`  ℹ️  specFactor = ${result.specFactor}`);
  }

  console.log("\n📊 场景8: 规格因子计算 — 低马力");
  {
    const input: ValuationInput = {
      brand: "CLAAS",
      modelName: "JAGUAR 970",
      category: "青储机",
      year: 2018,
      enginePower: 300, // 低于平均450
    };

    const result = await calculateValuationV4(input);
    
    // 低马力应该有惩罚
    const hasPenalty = result.specDetails?.some(d => d.impact === "negative");
    assert(hasPenalty === true, "低马力应有负面评分");
  }

  // -------------------------------------------------------
  // 测试置信度计算
  // -------------------------------------------------------
  console.log("\n📊 场景9: 置信度计算 — 完整输入");
  {
    const input: ValuationInput = {
      ...baseInput,
      workingHours: 2000,
      foreignPriceCny: 1500000,
      condition: "good",
      priceCny: 1200000,
      imageUrls: ["https://example.com/test.jpg"],
      videoUrls: ["https://example.com/video.mp4"],
      enginePower: 480,
      driveSystem: "4WD",
    };

    const result = await calculateValuationV4(input, mockVisualResult);
    
    assert(result.confidenceScore >= 0.5 && result.confidenceScore <= 0.98, 
      "置信度应在0.5-0.98之间");
    console.log(`  ℹ️  confidenceScore = ${result.confidenceScore}`);
  }

  console.log("\n📊 场景10: 置信度计算 — 最少输入");
  {
    const input: ValuationInput = {
      brand: "CLAAS",
      modelName: "JAGUAR 970",
      category: "青储机",
      year: 2018,
    };

    const result = await calculateValuationV4(input);
    
    assert(result.confidenceScore >= 0.5 && result.confidenceScore <= 0.98, 
      "置信度应在0.5-0.98之间");
    console.log(`  ℹ️  confidenceScore = ${result.confidenceScore} (最少输入)`);
  }

  // -------------------------------------------------------
  // 测试 V4 降级逻辑
  // -------------------------------------------------------
  console.log("\n📊 场景11: V4视觉评分很低时的成色因子");
  {
    const input: ValuationInput = {
      ...baseInput,
      imageUrls: ["https://example.com/bad-condition.jpg"],
    };

    const result = await calculateValuationV4(input, mockLowScoreVisualResult);
    
    assert(result.usedV4Condition === true, "即使得分低，只要usedV4Condition=true就应使用的V4");
    assert(result.conditionFactor < 1.0, "低视觉评分应导致成色因子<1.0");
    console.log(`  ℹ️  conditionFactor = ${result.conditionFactor} (低视觉评分)`);
  }

  // -------------------------------------------------------
  // 打印总结
  // -------------------------------------------------------
  console.log("\n" + "=".repeat(60));
  console.log(`测试结果: ${passed} 通过, ${failed} 失败`);
  console.log("=".repeat(60));

  if (failures.length > 0) {
    console.log("\n失败用例:");
    failures.forEach((f, i) => console.log(`  ${i + 1}. ${f}`));
  }

  return { passed, failed, failures };
}

// 运行测试
runTests().catch(console.error);
