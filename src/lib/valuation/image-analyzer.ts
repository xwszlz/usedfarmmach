/**
 * AI估值引擎 V4 — 多模态图片分析模块
 * 
 * 使用多模态LLM（GPT-4o/Claude Opus）分析产品图片，
 * 输出视觉成色评分，替代V2的conditionFactor固定表。
 */

import axios from "axios";

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || "";
const OPENROUTER_BASE = "https://openrouter.ai/api/v1";
const MODEL = "meta-llama/llama-3.2-11b-vision-instruct"; // 免费多模态模型（OpenRouter）

export interface ImageAnalysisResult {
  conditionScore: number;      // 成色评分 1-10
  conditionLabel: string;       // 成色标签：优秀/良好/一般/较差
  analysis: string;             // 评估依据
  confidence: number;           // 置信度 0-1
  isDefault?: boolean;          // 是否为默认分析结果（未调用LLM）
}

export interface VisualValuationResult {
  visualConditionScore: number;    // 视觉成色评分 1-10
  visualConditionAnalysis: string;  // 视觉评估依据
  imageConfidence: number;         // 图片分析置信度
  usedV4Condition: boolean;       // 是否使用了V4视觉成色
}

/**
 * 分析产品图片，评估设备成色
 * 
 * @param imageUrl 产品图片URL（OSS URL）
 * @returns ImageAnalysisResult 图片分析结果
 */
export async function analyzeProductImage(
  imageUrl: string
): Promise<ImageAnalysisResult> {
  if (!OPENROUTER_API_KEY) {
    console.warn("[ImageAnalyzer] OPENROUTER_API_KEY 未配置，使用降级方案");
    return getDefaultAnalysis();
  }

  try {
    const response = await axios.post(
      `${OPENROUTER_BASE}/chat/completions`,
      {
        model: MODEL,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: `你是一位资深二手农业机械评估专家，熟悉各类农机设备的成色评估标准。
请仔细分析这张农机设备图片，评估设备的成色状态。

重要要求：
1. 必须以纯JSON格式返回结果，不要有任何其他文字、说明或markdown标记
2. 返回格式必须是有效的JSON，可以被JSON.parse()解析
3. 不要使用\`\`\`json\`\`\`包装，直接返回JSON对象

JSON字段说明：
{
  "conditionScore": 成色评分（1-10分，10分为全新状态）,
  "conditionLabel": "成色标签（优秀/良好/一般/较差）",
  "analysis": "详细的评估依据，描述设备外观、磨损、锈蚀等情况",
  "confidence": 置信度（0-1之间的小数）
}

评估标准：
- 9-10分：设备外观接近全新，无明显磨损、锈蚀或损伤
- 7-8分：设备保养良好，有轻微使用痕迹，无结构性损伤
- 5-6分：设备有明显使用痕迹，可能有轻度锈蚀或磨损，但不影响使用
- 3-4分：设备磨损较重，可能有明显锈蚀或需要维修的部分
- 1-2分：设备状况很差，可能需要大修或已接近报废

示例输出：
{"conditionScore": 7, "conditionLabel": "良好", "analysis": "设备整体状况良好，有轻微使用痕迹，油漆完整，无重大锈蚀", "confidence": 0.85}

注意：评估要客观公正，基于图片实际状况，confidence取决于图片清晰度和可见范围`,
              },
              {
                type: "image_url",
                image_url: { url: imageUrl },
              },
            ],
          },
        ],
        max_tokens: 800,
      },
      {
        headers: {
          Authorization: `Bearer ${OPENROUTER_API_KEY}`,
          "Content-Type": "application/json",
          "HTTP-Referer": "https://usedfarmmach.com",
          "X-Title": "Valuation Engine V4",
        },
        timeout: 45000,
      }
    );

    const aiText = (response.data as any).choices?.[0]?.message?.content || "";

    let result: Partial<ImageAnalysisResult> = {};
    try {
      result = JSON.parse(aiText);
    } catch (e) {
      // 尝试从文本中提取 JSON
      const jsonMatch = aiText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        result = JSON.parse(jsonMatch[0]);
      }
    }

    // 验证和规范化结果
    return {
      conditionScore: Math.max(1, Math.min(10, Number(result.conditionScore) || 5)),
      conditionLabel: result.conditionLabel || "一般",
      analysis: result.analysis || "AI分析未完成",
      confidence: Math.max(0, Math.min(1, Number(result.confidence) || 0.5)),
    };
  } catch (error: any) {
    console.error("[ImageAnalyzer] 图片分析失败:", error?.message || String(error));
    // 降级方案：返回默认分析结果
    return getDefaultAnalysis();
  }
}

/**
 * 批量分析多张产品图片（并行处理）
 * 
 * @param imageUrls 产品图片URL列表
 * @returns VisualValuationResult 综合视觉评估结果
 */
export async function analyzeProductImages(
  imageUrls: string[]
): Promise<VisualValuationResult> {
  if (!imageUrls || imageUrls.length === 0) {
    return {
      visualConditionScore: 0,
      visualConditionAnalysis: "",
      imageConfidence: 0,
      usedV4Condition: false,
    };
  }

  // 最多分析3张图片（避免过多API调用）
  const urlsToAnalyze = imageUrls.slice(0, 3);

  try {
    // 并行分析多张图片
    const analysisPromises = urlsToAnalyze.map((url) => analyzeProductImage(url));
    const results = await Promise.all(analysisPromises);

    // 检查是否有任何真实LLM分析结果（非默认）
    const hasRealAnalysis = results.some((r) => !r.isDefault);

    // 综合多张图片的分析结果
    // 取最高分（最乐观评估）作为参考，但考虑置信度
    let bestScore = 0;
    let bestAnalysis = "";
    let totalConfidence = 0;

    results.forEach((result) => {
      // 加权评分：置信度高的权重更大
      const weightedScore = result.conditionScore * result.confidence;
      if (weightedScore > bestScore) {
        bestScore = weightedScore;
        bestAnalysis = result.analysis;
      }
      totalConfidence += result.confidence;
    });

    // 取平均分并归一化
    const avgScore = results.reduce((sum, r) => sum + r.conditionScore, 0) / results.length;
    const avgConfidence = totalConfidence / results.length;

    return {
      visualConditionScore: Math.round(avgScore * 10) / 10, // 保留1位小数
      visualConditionAnalysis: bestAnalysis,
      imageConfidence: avgConfidence,
      usedV4Condition: hasRealAnalysis, // 只有真实LLM分析才标记为V4
    };
  } catch (error) {
    console.error("[ImageAnalyzer] 批量图片分析失败:", error);
    return {
      visualConditionScore: 0,
      visualConditionAnalysis: "",
      imageConfidence: 0,
      usedV4Condition: false,
    };
  }
}

/**
 * 获取默认分析结果（降级方案）
 */
function getDefaultAnalysis(): ImageAnalysisResult {
  return {
    conditionScore: 5, // 默认中等成色
    conditionLabel: "一般",
    analysis: "未提供图片，无法视觉评估，使用默认成色",
    confidence: 0.3,
    isDefault: true, // 标记为默认分析结果
  };
}

/**
 * 将视觉成色评分转换为成色因子
 * 
 * @param visualScore 视觉成色评分 1-10
 * @returns 成色因子 0-1.x（用于乘以基准价）
 */
export function visualScoreToConditionFactor(visualScore: number): number {
  // 将 1-10 分映射到成色因子
  // 10分 → 1.0 (标准成色)
  // 8-9分 → 1.0-1.05 (良好，轻微加分)
  // 6-7分 → 0.95-1.0 (一般，轻微扣分)
  // 4-5分 → 0.85-0.95 (较差，明显扣分)
  // 1-3分 → 0.7-0.85 (很差，严重扣分)

  if (visualScore >= 9) return 1.05;
  if (visualScore >= 8) return 1.0;
  if (visualScore >= 7) return 0.98;
  if (visualScore >= 6) return 0.95;
  if (visualScore >= 5) return 0.90;
  if (visualScore >= 4) return 0.85;
  if (visualScore >= 3) return 0.78;
  return 0.70;
}
