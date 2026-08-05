/**
 * AI估值引擎 V4 — 视频分析模块
 *
 * 使用多模态LLM（GPT-4o）分析农机运转视频，
 * 评估发动机状态、作业机构流畅度、视频质量等维度。
 *
 * 视频因子取值范围：0.92 ~ 1.08
 * 设计原则：有视频只加分不扣分（除非发现明显缺陷）
 */

import axios from "axios";

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || "";
const OPENROUTER_BASE = "https://openrouter.ai/api/v1";
const MODEL = "openai/gpt-4o"; // 支持视频/多帧分析的高质量模型

export interface VideoAnalysisResult {
  hasVideo: boolean;
  qualityScore: number; // 0~1 (清晰度+稳定性+完整度)
  engineSoundStatus: "normal" | "abnormal_noise" | "abnormal_smoke" | "no_sound";
  mechanismSmoothness: "smooth" | "sluggish" | "jammed";
  overallImpression: "excellent" | "good" | "fair" | "poor";
  analysis: string; // 详细分析文本
  confidence: number; // 置信度 0-1
}

/**
 * 分析农机运转视频
 *
 * @param videoUrl 视频URL（OSS HTTPS URL）
 * @returns VideoAnalysisResult 视频分析结果
 */
export async function analyzeVideo(
  videoUrl: string
): Promise<VideoAnalysisResult> {
  if (!OPENROUTER_API_KEY) {
    console.warn("[VideoAnalyzer] OPENROUTER_API_KEY 未配置，使用降级方案");
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
                text: `你是一位资深二手农业机械评估专家，熟悉各类农机设备的运转状态评估。
请分析这台农机的运转视频，评估以下维度，以 JSON 格式返回。

返回字段说明：
{
  "qualityScore": 视频质量评分(0-1, 考虑清晰度/稳定性/完整度),
  "engineSoundStatus": "发动机状态(normal/abnormal_noise/abnormal_smoke/no_sound)",
  "mechanismSmoothness": "作业机构流畅度(smooth/sluggish/jammed)",
  "overallImpression": "整体印象(excellent/good/fair/poor)",
  "analysis": "详细分析文本，描述观察到的关键信息",
  "confidence": 置信度(0-1)
}

评估标准：
- engineSoundStatus:
  normal = 启动顺畅，运转平稳，无异响
  abnormal_noise = 有明显金属敲击声/摩擦声/啸叫
  abnormal_smoke = 冒黑烟/蓝烟/白烟（燃烧室/涡轮问题）
  no_sound = 无音频或听不清

- mechanismSmoothness:
  smooth = 割台/打捆/收获机构动作流畅到位
  sluggish = 动作迟缓，可能液压老化
  jammed = 卡顿或无法完成动作

- overallImpression:
  excellent = 整机状态接近新机
  good = 正常使用状态，保养良好
  fair = 有磨损但可正常使用
  poor = 明显问题，需维修

注意：
1. 只返回 JSON，不要任何其他文字说明
2. 如果视频质量太差无法判断，qualityScore 设为 0.3 以下
3. confidence 取决于视频清晰度和内容完整度`,
              },
              {
                type: "video_url",
                video_url: { url: videoUrl },
              },
            ],
          },
        ],
        response_format: { type: "json_object" },
        max_tokens: 1000,
      },
      {
        headers: {
          Authorization: `Bearer ${OPENROUTER_API_KEY}`,
          "Content-Type": "application/json",
          "HTTP-Referer": "https://usedfarmmach.com",
          "X-Title": "Valuation Engine V4 - Video Analyzer",
        },
        timeout: 60000, // 视频分析可能需要更长时间
      }
    );

    const aiText = (response.data as any).choices?.[0]?.message?.content || "";

    let result: Partial<VideoAnalysisResult> = {};
    try {
      result = JSON.parse(aiText);
    } catch {
      // 尝试从文本中提取 JSON
      const jsonMatch = aiText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        result = JSON.parse(jsonMatch[0]);
      }
    }

    return {
      hasVideo: true,
      qualityScore: Math.max(0, Math.min(1, Number(result.qualityScore) || 0.5)),
      engineSoundStatus: (result.engineSoundStatus as VideoAnalysisResult["engineSoundStatus"]) || "no_sound",
      mechanismSmoothness: (result.mechanismSmoothness as VideoAnalysisResult["mechanismSmoothness"]) || "smooth",
      overallImpression: (result.overallImpression as VideoAnalysisResult["overallImpression"]) || "good",
      analysis: result.analysis || "视频分析未完成",
      confidence: Math.max(0, Math.min(1, Number(result.confidence) || 0.5)),
    };
  } catch (error: any) {
    console.error("[VideoAnalyzer] 视频分析失败:", error?.message || String(error));
    return getDefaultAnalysis();
  }
}

/**
 * 计算视频因子（videoFactor）
 *
 * 取值范围：0.92 ~ 1.08
 * - 无视频：1.0（基准，不扣不加）
 * - 有高质量视频+运转正常：1.05~1.08
 * - 有视频+发现异常：0.92~0.96
 *
 * @param video 视频分析结果
 * @returns videoFactor 数值因子
 */
export function calculateVideoFactor(video: VideoAnalysisResult): number {
  if (!video.hasVideo) return 1.0; // 无视频 = 基准，不扣分

  let factor = 1.0;

  // 1. 基础奖励：有合格视频就加分
  if (video.qualityScore >= 0.6) {
    factor += 0.02; // +2% 基础奖励
  }
  if (video.qualityScore >= 0.85) {
    factor += 0.01; // 高质量额外+1%
  }

  // 2. 发动机状态（基于声音分析）
  switch (video.engineSoundStatus) {
    case "normal":
      factor += 0.03; // 运转正常 +3%
      break;
    case "abnormal_noise":
      factor -= 0.06; // 异响 -6%（可能轴承/活塞问题）
      break;
    case "abnormal_smoke":
      factor -= 0.08; // 冒烟 -8%（燃烧室/涡轮问题）
      break;
    case "no_sound":
      break; // 无音频，不做判断
  }

  // 3. 作业机构流畅度
  switch (video.mechanismSmoothness) {
    case "smooth":
      factor += 0.02; // 动作流畅 +2%
      break;
    case "sluggish":
      factor -= 0.02; // 迟缓 -2%（液压可能老化）
      break;
    case "jammed":
      factor -= 0.06; // 卡顿 -6%（严重机械问题）
      break;
  }

  // 4. 总体印象微调
  switch (video.overallImpression) {
    case "excellent":
      factor += 0.02;
      break;
    case "poor":
      factor -= 0.04;
      break;
  }

  // 限制范围：视频因子不超过 ±8% 浮动
  return Math.max(0.92, Math.min(1.08, Math.round(factor * 100) / 100));
}

/**
 * 获取默认分析结果（降级方案）
 */
function getDefaultAnalysis(): VideoAnalysisResult {
  return {
    hasVideo: true,
    qualityScore: 0.3,
    engineSoundStatus: "no_sound",
    mechanismSmoothness: "smooth",
    overallImpression: "good",
    analysis: "视频分析服务暂不可用，使用基准估值",
    confidence: 0.2,
  };
}
