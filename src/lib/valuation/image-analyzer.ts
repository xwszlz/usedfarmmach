/**
 * AI估值引擎 V4 — 多模态图片分析模块
 *
 * 使用统一豆包（火山方舟 ARK）视觉能力分析产品图片，输出视觉成色评分。
 * 全站 AI 统一出口：src/lib/ai/ark-client.ts#chatCompletionDoubao
 *   - .cn 直连国行 ARK（数据不出境红线不动）
 *   - .com 经 HK/SG 代理节点（B 通道）代调国行（详见 ark-client.ts / 设计稿 §3.6 E-1）
 *
 * 模型：ARK_VISION_MODEL_ID（默认回退 ARK_MODEL_ID），部署侧按方舟视觉能力模型填。
 */

import { chatCompletionDoubao, getArkVisionModelId } from "@/lib/ai/ark-client";
import { recordUsage, ESTIMATED_TOKENS } from "@/lib/credits/usage-collector";

const IMAGE_PROMPT = `你是一位资深二手农业机械评估专家，熟悉各类农机设备的成色评估标准。
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

注意：评估要客观公正，基于图片实际状况，confidence取决于图片清晰度和可见范围`;

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
 * 获取图片并转换为 base64（豆包视觉以 image_url/data 传入）
 */
async function fetchImageAsBase64(imageUrl: string): Promise<string> {
  const resp = await fetch(imageUrl);
  if (!resp.ok) throw new Error(`图片下载失败: ${resp.status}`);
  const buf = Buffer.from(await resp.arrayBuffer());
  return buf.toString("base64");
}

/**
 * 分析产品图片，评估设备成色。统一经豆包视觉能力。
 */
export async function analyzeProductImage(
  imageUrl: string
): Promise<ImageAnalysisResult> {
  try {
    const base64Image = await fetchImageAsBase64(imageUrl);
    const model = getArkVisionModelId();

    const result = await chatCompletionDoubao({
      model,
      maxTokens: 800,
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: IMAGE_PROMPT },
            { type: "image_url", image_url: { url: `data:image/jpeg;base64,${base64Image}` } },
          ],
        },
      ],
    });

    // ── 计费归集：HTTP 一成功就记账（token 已被消耗，与后续 JSON 解析是否成功无关）──
    recordUsage(
      model,
      result.usage?.prompt_tokens ?? ESTIMATED_TOKENS.input,
      result.usage?.completion_tokens ?? ESTIMATED_TOKENS.output,
      { estimated: !result.usage }
    );

    const aiText = result.text || "";
    let parsed: Partial<ImageAnalysisResult> = {};
    try {
      parsed = JSON.parse(aiText);
    } catch {
      const jsonMatch = aiText.match(/\{[\s\S]*\}/);
      if (jsonMatch) parsed = JSON.parse(jsonMatch[0]);
      else throw new Error("无法解析 AI 返回的 JSON");
    }

    return {
      conditionScore: Math.max(1, Math.min(10, Number(parsed.conditionScore) || 5)),
      conditionLabel: parsed.conditionLabel || "一般",
      analysis: parsed.analysis || "AI分析未完成",
      confidence: Math.max(0, Math.min(1, Number(parsed.confidence) || 0.5)),
    };
  } catch (error: any) {
    console.error(`[ImageAnalyzer] 豆包视觉调用失败:`, error?.message || String(error));
    return getDefaultAnalysis();
  }
}

/**
 * 批量分析多张产品图片（并行处理）
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
    const results = await Promise.all(urlsToAnalyze.map((url) => analyzeProductImage(url)));
    const hasRealAnalysis = results.some((r) => !r.isDefault);

    let bestScore = 0;
    let bestAnalysis = "";
    let totalConfidence = 0;
    results.forEach((result) => {
      const weightedScore = result.conditionScore * result.confidence;
      if (weightedScore > bestScore) {
        bestScore = weightedScore;
        bestAnalysis = result.analysis;
      }
      totalConfidence += result.confidence;
    });

    const avgScore = results.reduce((sum, r) => sum + r.conditionScore, 0) / results.length;
    const avgConfidence = totalConfidence / results.length;

    return {
      visualConditionScore: Math.round(avgScore * 10) / 10,
      visualConditionAnalysis: bestAnalysis,
      imageConfidence: avgConfidence,
      usedV4Condition: hasRealAnalysis,
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
 */
export function visualScoreToConditionFactor(visualScore: number): number {
  if (visualScore >= 9) return 1.05;
  if (visualScore >= 8) return 1.0;
  if (visualScore >= 7) return 0.98;
  if (visualScore >= 6) return 0.95;
  if (visualScore >= 5) return 0.90;
  if (visualScore >= 4) return 0.85;
  if (visualScore >= 3) return 0.78;
  return 0.70;
}
