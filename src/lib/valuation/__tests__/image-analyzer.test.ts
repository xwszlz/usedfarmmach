/**
 * image-analyzer.ts 单元测试
 * 
 * 测试图片分析模块的逻辑
 * 注意：需要mock axios以避免实际LLM调用
 */

// 注意：由于image-analyzer依赖外部环境（OpenRouter API），
// 我们需要测试其降级逻辑和结果处理

import {
  analyzeProductImages,
  visualScoreToConditionFactor,
  type ImageAnalysisResult,
} from "../image-analyzer";

// 保存原始的axios
let originalAxios: any;

// Mock axios
function mockAxios() {
  const mockPost = async (url: string, data: any, config: any) => {
    // 模拟成功响应
    return {
      data: {
        choices: [
          {
            message: {
              content: JSON.stringify({
                conditionScore: 8,
                conditionLabel: "良好",
                analysis: "设备外观良好，有轻微使用痕迹",
                confidence: 0.85,
              }),
            },
          },
        ],
      },
    };
  };

  // 动态mock
  const axios = require("axios");
  originalAxios = { ...axios };
  axios.default = mockPost;
  axios.post = mockPost;
  
  return mockPost;
}

function restoreAxios() {
  if (originalAxios) {
    const axios = require("axios");
    Object.assign(axios, originalAxios);
  }
}

async function runImageAnalyzerTests() {
  console.log("\n=== image-analyzer.ts 单元测试 ===\n");

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

  // -------------------------------------------------------
  // 测试1: visualScoreToConditionFactor 映射
  // -------------------------------------------------------
  console.log("\n📊 测试: visualScoreToConditionFactor 映射");
  {
    // 9-10分 → 1.05
    assert(Math.abs(visualScoreToConditionFactor(9) - 1.05) < 0.001, "9分 → 1.05");
    assert(Math.abs(visualScoreToConditionFactor(10) - 1.05) < 0.001, "10分 → 1.05");

    // 8分 → 1.0
    assert(Math.abs(visualScoreToConditionFactor(8) - 1.0) < 0.001, "8分 → 1.0");

    // 7分 → 0.98
    assert(Math.abs(visualScoreToConditionFactor(7) - 0.98) < 0.001, "7分 → 0.98");

    // 6分 → 0.95
    assert(Math.abs(visualScoreToConditionFactor(6) - 0.95) < 0.001, "6分 → 0.95");

    // 5分 → 0.90
    assert(Math.abs(visualScoreToConditionFactor(5) - 0.90) < 0.001, "5分 → 0.90");

    // 4分 → 0.85
    assert(Math.abs(visualScoreToConditionFactor(4) - 0.85) < 0.001, "4分 → 0.85");

    // 3分 → 0.78
    assert(Math.abs(visualScoreToConditionFactor(3) - 0.78) < 0.001, "3分 → 0.78");

    // 1-2分 → 0.70
    assert(Math.abs(visualScoreToConditionFactor(1) - 0.70) < 0.001, "1分 → 0.70");
    assert(Math.abs(visualScoreToConditionFactor(2) - 0.70) < 0.001, "2分 → 0.70");

    // 边界测试
    assert(Math.abs(visualScoreToConditionFactor(0) - 0.70) < 0.001, "0分 → 0.70 (边界)");
    assert(Math.abs(visualScoreToConditionFactor(11) - 1.05) < 0.001, "11分 → 1.05 (边界)");
  }

  // -------------------------------------------------------
  // 测试2: 无图片输入
  // -------------------------------------------------------
  console.log("\n📊 测试: 无图片输入");
  {
    const result = await analyzeProductImages([]);
    
    assert(result.visualConditionScore === 0, "无图片时 visualConditionScore 应为 0");
    assert(result.usedV4Condition === false, "无图片时 usedV4Condition 应为 false");
    assert(result.imageConfidence === 0, "无图片时 imageConfidence 应为 0");
  }

  // -------------------------------------------------------
  // 测试3: 降级逻辑（当没有API key时）
  // -------------------------------------------------------
  console.log("\n📊 测试: 降级逻辑");
  {
    // 保存原始环境变量
    const originalKey = process.env.OPENROUTER_API_KEY;
    
    // 模拟无API key
    process.env.OPENROUTER_API_KEY = "";
    
    // 注意：这里会调用真实的axios，但因为没配置key会失败并降级
    // 由于我们无法轻松mock，这个测试主要是检查降级是否工作
    const result = await analyzeProductImages(["https://example.com/test.jpg"]);
    
    // 降级时应该返回默认分析
    assert(result.visualConditionScore === 5, "降级时默认评分为 5");
    assert(result.usedV4Condition === false, "降级时 usedV4Condition 应为 false");
    
    // 恢复环境变量
    process.env.OPENROUTER_API_KEY = originalKey;
  }

  // -------------------------------------------------------
  // 打印总结
  // -------------------------------------------------------
  console.log("\n" + "=".repeat(60));
  console.log(`image-analyzer 测试结果: ${passed} 通过, ${failed} 失败`);
  console.log("=".repeat(60));

  if (failures.length > 0) {
    console.log("\n失败用例:");
    failures.forEach((f, i) => console.log(`  ${i + 1}. ${f}`));
  }

  return { passed, failed, failures };
}

// 运行测试
runImageAnalyzerTests().catch(console.error);
