/**
 * AI估值引擎 V4 — 多模态图片分析模块
 * 
 * 使用多模态LLM分析产品图片，输出视觉成色评分
 * 支持多个API提供商：Google Gemini（免费）、OpenRouter（付费）
 */

import axios from "axios";

const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY || "";
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || "";
const OPENROUTER_BASE = "https://openrouter.ai/api/v1";

// 优先使用 Google Gemini（免费），其次使用 OpenRouter
const USE_GOOGLE_PRIMARY = GOOGLE_API_KEY !== "";

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
  console.log(`[ImageAnalyzer] ========== 开始分析图片 ==========`);
  console.log(`[ImageAnalyzer] 图片URL: ${imageUrl}`);
  console.log(`[ImageAnalyzer] API配置状态:`, {
    hasGoogleKey: !!GOOGLE_API_KEY,
    hasOpenRouterKey: !!OPENROUTER_API_KEY,
    useGooglePrimary: USE_GOOGLE_PRIMARY
  });

  // 优先使用 Google Gemini（免费）
  if (USE_GOOGLE_PRIMARY) {
    console.log(`[ImageAnalyzer] 使用 Google Gemini API（免费）`);
    try {
      const result = await analyzeWithGoogleGemini(imageUrl);
      console.log(`[ImageAnalyzer] ========== 图片分析完成（Gemini） ==========`);
      return result;
    } catch (error: any) {
      console.error(`[ImageAnalyzer] Google Gemini 调用失败:`, error?.message || String(error));
      console.log(`[ImageAnalyzer] 尝试降级到 OpenRouter...`);
      // 如果Google失败且有OpenRouter密钥，尝试降级
      if (OPENROUTER_API_KEY) {
        try {
          const result = await analyzeWithOpenRouter(imageUrl);
          return result;
        } catch (err) {
          console.error(`[ImageAnalyzer] OpenRouter 降级也失败，使用默认分析`);
          return getDefaultAnalysis();
        }
      }
      return getDefaultAnalysis();
    }
  }

  // 降级到 OpenRouter
  if (OPENROUTER_API_KEY) {
    console.log(`[ImageAnalyzer] 使用 OpenRouter API`);
    try {
      const result = await analyzeWithOpenRouter(imageUrl);
      console.log(`[ImageAnalyzer] ========== 图片分析完成（OpenRouter） ==========`);
      return result;
    } catch (error: any) {
      console.error(`[ImageAnalyzer] OpenRouter 调用失败:`, error?.message || String(error));
      return getDefaultAnalysis();
    }
  }

  console.warn("[ImageAnalyzer] 无可用API密钥，使用降级方案");
  return getDefaultAnalysis();
}

/**
 * 使用 Google Gemini API 分析图片
 */
async function analyzeWithGoogleGemini(imageUrl: string): Promise<ImageAnalysisResult> {
  console.log(`[ImageAnalyzer] 调用 Google Gemini API...`);
  
  const prompt = `你是一位资深二手农业机械评估专家，熟悉各类农机设备的成色评估标准。
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

  const requestBody = {
    contents: [{
      parts: [
        { text: prompt },
        {
          inline_data: {
            mime_type: "image/jpeg",
            data: await fetchImageAsBase64(imageUrl)
          }
        }
      ]
    }],
    generationConfig: {
      maxOutputTokens: 800,
      temperature: 0.4
    }
  };

  console.log(`[ImageAnalyzer] Gemini 请求体准备完成`);
  
  const response = await axios.post(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GOOGLE_API_KEY}`,
    requestBody,
    {
      headers: {
        'Content-Type': 'application/json'
      },
      timeout: 45000
    }
  );

  console.log(`[ImageAnalyzer] Gemini API 调用成功！`);
  console.log(`[ImageAnalyzer] 响应状态:`, response.status);

  const candidates = (response.data as any).candidates || [];
  if (candidates.length === 0) {
    throw new Error('Gemini API 返回空结果');
  }

  const aiText = candidates[0].content?.parts?.[0]?.text || '';
  console.log(`[ImageAnalyzer] AI 返回文本长度: ${aiText.length}`);
  console.log(`[ImageAnalyzer] AI 返回文本预览: ${aiText.substring(0, 200)}`);

  let result: Partial<ImageAnalysisResult> = {};
  try {
    console.log(`[ImageAnalyzer] 尝试解析 JSON...`);
    result = JSON.parse(aiText);
    console.log(`[ImageAnalyzer] JSON 解析成功:`, result);
  } catch (e) {
    console.error(`[ImageAnalyzer] JSON 解析失败:`, e);
    console.log(`[ImageAnalyzer] 尝试从文本中提取 JSON...`);
    const jsonMatch = aiText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      console.log(`[ImageAnalyzer] 找到 JSON 匹配，尝试解析...`);
      result = JSON.parse(jsonMatch[0]);
      console.log(`[ImageAnalyzer] 提取的 JSON 解析成功:`, result);
    } else {
      console.error(`[ImageAnalyzer] 未找到 JSON 匹配`);
      throw new Error('无法解析 AI 返回的 JSON');
    }
  }

  // 验证和规范化结果
  const finalResult = {
    conditionScore: Math.max(1, Math.min(10, Number(result.conditionScore) || 5)),
    conditionLabel: result.conditionLabel || "一般",
    analysis: result.analysis || "AI分析未完成",
    confidence: Math.max(0, Math.min(1, Number(result.confidence) || 0.5)),
  };
  console.log(`[ImageAnalyzer] 最终结果:`, finalResult);
  
  return finalResult;
}

/**
 * 使用 OpenRouter API 分析图片（降级方案）
 */
async function analyzeWithOpenRouter(imageUrl: string): Promise<ImageAnalysisResult> {
  console.log(`[ImageAnalyzer] 调用 OpenRouter API...`);
  console.log(`[ImageAnalyzer] API Endpoint: ${OPENROUTER_BASE}/chat/completions`);
  
  // 下载图片并转为 base64（provider 可能无法直接访问 OSS URL）
  console.log(`[ImageAnalyzer] 下载图片并转为 base64...`);
  const base64Image = await fetchImageAsBase64(imageUrl);
  console.log(`[ImageAnalyzer] 图片 base64 长度: ${base64Image.length}`);
  
  const requestBody = {
    model: "meta-llama/llama-3.2-11b-vision-instruct",
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
            image_url: { url: `data:image/jpeg;base64,${base64Image}` },
          },
        ],
      },
    ],
    max_tokens: 800,
  };
  
  console.log(`[ImageAnalyzer] 请求体预览:`, JSON.stringify(requestBody, null, 2).substring(0, 500) + '...');
  
  const response = await axios.post(
    `${OPENROUTER_BASE}/chat/completions`,
    requestBody,
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

  console.log(`[ImageAnalyzer] API 调用成功！`);
  console.log(`[ImageAnalyzer] 响应状态:`, response.status);

  const aiText = (response.data as any).choices?.[0]?.message?.content || "";
  console.log(`[ImageAnalyzer] AI 返回文本长度: ${aiText.length}`);
  console.log(`[ImageAnalyzer] AI 返回文本预览: ${aiText.substring(0, 200)}`);

  let result: Partial<ImageAnalysisResult> = {};
  try {
    console.log(`[ImageAnalyzer] 尝试解析 JSON...`);
    result = JSON.parse(aiText);
    console.log(`[ImageAnalyzer] JSON 解析成功:`, result);
  } catch (e) {
    console.error(`[ImageAnalyzer] JSON 解析失败:`, e);
    console.log(`[ImageAnalyzer] 尝试从文本中提取 JSON...`);
    const jsonMatch = aiText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      console.log(`[ImageAnalyzer] 找到 JSON 匹配，尝试解析...`);
      result = JSON.parse(jsonMatch[0]);
      console.log(`[ImageAnalyzer] 提取的 JSON 解析成功:`, result);
    } else {
      console.error(`[ImageAnalyzer] 未找到 JSON 匹配`);
    }
  }

  // 验证和规范化结果
  const finalResult = {
    conditionScore: Math.max(1, Math.min(10, Number(result.conditionScore) || 5)),
    conditionLabel: result.conditionLabel || "一般",
    analysis: result.analysis || "AI分析未完成",
    confidence: Math.max(0, Math.min(1, Number(result.confidence) || 0.5)),
  };
  console.log(`[ImageAnalyzer] 最终结果:`, finalResult);
  
  return finalResult;
}

/**
 * 获取图片并转换为 base64（用于 Gemini API）
 */
async function fetchImageAsBase64(imageUrl: string): Promise<string> {
  console.log(`[ImageAnalyzer] 下载图片并转换为 base64...`);
  const response = await axios.get(imageUrl, {
    responseType: 'arraybuffer',
    timeout: 30000
  });
  
  const base64 = Buffer.from(response.data as ArrayBuffer).toString('base64');
  console.log(`[ImageAnalyzer] 图片转换完成，base64 长度: ${base64.length}`);
  return base64;
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
  console.log(`[ImageAnalyzer] ========== 批量分析开始 ==========`);
  console.log(`[ImageAnalyzer] 传入图片数量: ${imageUrls?.length || 0}`);
  
  if (!imageUrls || imageUrls.length === 0) {
    console.log(`[ImageAnalyzer] 无图片，返回空结果`);
    return {
      visualConditionScore: 0,
      visualConditionAnalysis: "",
      imageConfidence: 0,
      usedV4Condition: false,
    };
  }

  // 最多分析3张图片（避免过多API调用）
  const urlsToAnalyze = imageUrls.slice(0, 3);
  console.log(`[ImageAnalyzer] 准备分析 ${urlsToAnalyze.length} 张图片:`, urlsToAnalyze);

  try {
    // 并行分析多张图片
    const analysisPromises = urlsToAnalyze.map((url) => analyzeProductImage(url));
    console.log(`[ImageAnalyzer] 开始并行调用 analyzeProductImage...`);
    const results = await Promise.all(analysisPromises);
    console.log(`[ImageAnalyzer] 所有图片分析完成，结果:`, results);

    // 检查是否有任何真实LLM分析结果（非默认）
    const hasRealAnalysis = results.some((r) => !r.isDefault);
    console.log(`[ImageAnalyzer] 是否有真实分析: ${hasRealAnalysis}`);
    console.log(`[ImageAnalyzer] 各图片结果:`, results.map((r, i) => ({ 
      index: i, 
      isDefault: r.isDefault, 
      conditionScore: r.conditionScore,
      confidence: r.confidence 
    })));

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

    const finalResult = {
      visualConditionScore: Math.round(avgScore * 10) / 10, // 保留1位小数
      visualConditionAnalysis: bestAnalysis,
      imageConfidence: avgConfidence,
      usedV4Condition: hasRealAnalysis, // 只有真实LLM分析才标记为V4
    };
    
    console.log(`[ImageAnalyzer] 批量分析最终结果:`, finalResult);
    console.log(`[ImageAnalyzer] ========== 批量分析完成 ==========`);
    
    return finalResult;
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
