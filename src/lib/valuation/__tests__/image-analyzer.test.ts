/**
 * image-analyzer.ts 单元测试
 *
 * 测试图片分析模块的逻辑（统一豆包视觉能力入口）。
 * 注意：需 mock axios（豆包 chat/completions 内部走 axios.post）与全局 fetch（图片下载），
 * 以避免实际 LLM / 网络调用。
 */

// 注意：image-analyzer 统一走 chatCompletionDoubao（火山方舟 ARK），
// 其内部通过 axios.post 调用，本测试 mock axios 即可拦截，无需真实 key。

import {
  analyzeProductImages,
  visualScoreToConditionFactor,
  type ImageAnalysisResult,
} from "../image-analyzer";

// 保存原始 axios / fetch
let originalAxios: any;
let originalFetch: any;

// Mock axios（拦截 ark-client 的 chat/completions 调用）
function mockAxios() {
  const mockPost = async (_url: string, _data: any, _config: any) => {
    // 模拟豆包成功响应（OpenAI 兼容结构 + usage 供计费归集）
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
        usage: { prompt_tokens: 100, completion_tokens: 20 },
      },
    };
  };

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

// Mock 全局 fetch（模拟图片下载返回字节，避免真实网络）
function mockFetch() {
  originalFetch = global.fetch;
  global.fetch = (async (_url: string) => ({
    ok: true,
    arrayBuffer: async () => Buffer.from("fake-image-bytes"),
  })) as any;
}

function restoreFetch() {
  if (originalFetch) global.fetch = originalFetch;
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
    assert(Math.abs(visualScoreToConditionFactor(9) - 1.05) < 0.001, "9分 → 1.05");
    assert(Math.abs(visualScoreToConditionFactor(10) - 1.05) < 0.001, "10分 → 1.05");
    assert(Math.abs(visualScoreToConditionFactor(8) - 1.0) < 0.001, "8分 → 1.0");
    assert(Math.abs(visualScoreToConditionFactor(7) - 0.98) < 0.001, "7分 → 0.98");
    assert(Math.abs(visualScoreToConditionFactor(6) - 0.95) < 0.001, "6分 → 0.95");
    assert(Math.abs(visualScoreToConditionFactor(5) - 0.90) < 0.001, "5分 → 0.90");
    assert(Math.abs(visualScoreToConditionFactor(4) - 0.85) < 0.001, "4分 → 0.85");
    assert(Math.abs(visualScoreToConditionFactor(3) - 0.78) < 0.001, "3分 → 0.78");
    assert(Math.abs(visualScoreToConditionFactor(1) - 0.70) < 0.001, "1分 → 0.70");
    assert(Math.abs(visualScoreToConditionFactor(2) - 0.70) < 0.001, "2分 → 0.70");
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
  // 测试3: 正常路径（mock 豆包返回结构化 JSON）
  // -------------------------------------------------------
  console.log("\n📊 测试: 正常路径（豆包视觉返回）");
  {
    mockFetch();
    mockAxios();
    try {
      const result = await analyzeProductImages(["https://example.com/test.jpg"]);
      assert(result.visualConditionScore === 8, "正常路径 visualConditionScore 应为 8");
      assert(result.usedV4Condition === true, "正常路径 usedV4Condition 应为 true");
      assert(Math.abs(result.imageConfidence - 0.85) < 0.001, "正常路径 imageConfidence 应为 0.85");
    } finally {
      restoreAxios();
      restoreFetch();
    }
  }

  // -------------------------------------------------------
  // 测试4: 降级逻辑（豆包不可用时返回默认分析）
  // -------------------------------------------------------
  console.log("\n📊 测试: 降级逻辑");
  {
    mockFetch();
    // 不 mock axios → 真实 axios.post 离线会失败并被 image-analyzer 捕获降级
    try {
      const result = await analyzeProductImages(["https://example.com/test.jpg"]);
      assert(result.visualConditionScore === 5, "降级时默认评分为 5");
      assert(result.usedV4Condition === false, "降级时 usedV4Condition 应为 false");
    } finally {
      restoreFetch();
    }
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
