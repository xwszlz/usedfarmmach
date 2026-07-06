/**
 * POST /api/agents/seller-helper/deep-analysis
 * AI深度分析 — 接入字节跳动豆包大模型
 *
 * 与 recognize/route.ts 的区别：
 * 1. 使用豆包（火山引擎ARK）模型，支持图片+视频
 * 2. 放开prompt限制：允许AI调用训练知识，不限于照片信息
 * 3. max_tokens = 4096（vs 旧版 800）
 * 4. 输出详细Markdown分析报告（不限于JSON）
 * 5. 覆盖：品牌型号识别、技术参数解读、操作维修要点、市场参考价、购买建议
 *
 * 环境变量：
 *   ARK_API_KEY     - 火山引擎ARK API Key
 *   ARK_MODEL_ID    - 模型ID（默认 doubao-1-5-vision-pro-32k）
 *   ARK_BASE_URL    - API地址（默认 https://ark.cn-beijing.volces.com/api/v3）
 *
 * Body: { imageUrls?: string[], imageDataUris?: string[], videoUrls?: string[] }
 * Response: { success: true, data: { analysis: "Markdown报告", structured: {...}, model: "..." } }
 */

import { NextRequest, NextResponse } from "next/server";
import axios from "axios";

export const dynamic = "force-dynamic";
export const maxDuration = 120; // 豆包深度分析需要更长时间

const ARK_API_KEY = process.env.ARK_API_KEY || "";
const ARK_BASE_URL = process.env.ARK_BASE_URL || "https://ark.cn-beijing.volces.com/api/v3";
const ARK_MODEL_ID = process.env.ARK_MODEL_ID || "doubao-1-5-vision-pro-32k";

// 备用：Gemini 和 OpenRouter（与 recognize 路由共享配置）
const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY || "";
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || "";

/**
 * 深度分析系统提示词 — 放开限制，允许AI调用训练知识
 */
const DEEP_ANALYSIS_PROMPT = `你是一位拥有20年经验的资深二手农业机械专家和评估师，精通 John Deere、CLAAS、New Holland、Kubota、Massey Ferguson、Case IH 等全球主流品牌的拖拉机、收获机、打捆机、播种机等各类农机设备。

请根据用户提供的农机照片和视频（可能包含整机全貌、铭牌、驾驶室、发动机、轮胎底盘、工作视频等），结合你的专业知识库，给出一份**详尽的深度分析报告**。

报告必须包含以下部分（用 Markdown 格式输出）：

## 一、设备识别
- 品牌（英文标准名）
- 具体型号
- 生产年份（或年份范围）
- 识别依据（从哪张照片/视频的什么特征判断的）

## 二、技术参数解读
基于你对该型号的专业知识，列出关键技术参数：
- 发动机：型号、额定马力(HP)、排量、缸数
- 传动系统：驱动方式(2WD/4WD)、变速箱档位数
- 液压系统：提升力、输出流量
- 尺寸重量：长×宽×高(mm)、整机重量(kg)
- 燃油箱容量、PTO功率等
- 如果照片中有铭牌信息，以铭牌为准；否则根据你的专业知识补充

## 三、操作与维修要点
基于你的专业知识，给出该型号农机的：
- 日常操作注意事项
- 定期保养项目及周期（工作小时数）
- 常见故障及排除方法
- 易损件清单
- 关键操作技巧

## 四、市场参考价格
- 国内二手市场参考价（人民币）
- 国际二手市场参考价（美元）
- 影响价格的关键因素分析
- 该型号在当前市场的供需情况

## 五、购买建议
- 该设备的优缺点总结
- 适合的作业场景
- 选购时需要重点检查的部位
- 议价空间分析

## 六、结构化数据（JSON）
最后附上一个JSON代码块，包含可被程序解析的结构化数据：
\`\`\`json
{
  "brand": "品牌",
  "modelName": "型号",
  "year": 年份,
  "enginePower": "马力",
  "engineType": "发动机类型",
  "driveSystem": "驱动方式",
  "overallLength": "长mm",
  "overallWidth": "宽mm",
  "overallHeight": "高mm",
  "netWeight": "重量kg",
  "mainConfig": "主要配置",
  "condition": "excellent|good|fair|poor",
  "estimatedPriceCny": 估值人民币,
  "estimatedPriceUsd": 估值美元,
  "confidence": 0.0-1.0
}
\`\`\`

重要提示：
1. **请充分利用你的专业知识**，不要仅依赖照片信息。对于照片中无法直接看到但属于该型号标准配置的参数，请根据你的知识库补充
2. 报告内容要详实、专业、有深度，至少2000字
3. 如果无法确定具体型号，请给出最可能的2-3个候选型号并分析
4. 对于操作维修要点，请给出实用的、可操作的建议
5. 市场价格请基于你的知识给出合理区间，并说明影响因素`;

/**
 * 构建豆包API的多模态消息内容
 */
function buildDoubaoContent(
  images: string[],
  videos: string[]
): Array<Record<string, unknown>> {
  const content: Array<Record<string, unknown>> = [
    { type: "text", text: DEEP_ANALYSIS_PROMPT },
  ];

  // 图片
  for (const url of images) {
    content.push({
      type: "image_url",
      image_url: { url },
    });
  }

  // 视频（豆包支持 video_url 类型）
  for (const url of videos) {
    content.push({
      type: "video_url",
      video_url: { url },
    });
  }

  return content;
}

/**
 * 调用豆包 API
 */
async function callDoubao(
  content: Array<Record<string, unknown>>
): Promise<string> {
  console.log(
    `[DeepAnalysis] 豆包调用: model=${ARK_MODEL_ID}, ` +
    `图片数=${content.filter((c) => c.type === "image_url").length}, ` +
    `视频数=${content.filter((c) => c.type === "video_url").length}`
  );

  const response = await axios.post(
    `${ARK_BASE_URL}/chat/completions`,
    {
      model: ARK_MODEL_ID,
      messages: [{ role: "user", content }],
      max_tokens: 4096,
      temperature: 0.7,
      top_p: 0.9,
    },
    {
      headers: {
        Authorization: `Bearer ${ARK_API_KEY}`,
        "Content-Type": "application/json",
      },
      timeout: 90000, // 90秒超时
    }
  );

  const result = response.data as any;
  const text = result.choices?.[0]?.message?.content || "";

  if (!text || text.trim().length < 50) {
    throw new Error("豆包返回空响应或响应过短");
  }

  return text;
}

/**
 * 备用：调用 Gemini API（用于深度分析）
 */
async function callGeminiDeep(
  images: string[],
  videos: string[]
): Promise<string> {
  const parts: Array<Record<string, unknown>> = [
    { text: DEEP_ANALYSIS_PROMPT },
  ];

  for (const url of images) {
    if (url.startsWith("data:")) {
      const [mimeInfo, base64Data] = url.split(",");
      const mimeType = mimeInfo.replace("data:", "").split(";")[0] || "image/jpeg";
      parts.push({ inline_data: { mime_type: mimeType, data: base64Data } });
    } else {
      parts.push({ file_data: { file_url: url, mime_type: "image/jpeg" } });
    }
  }

  // Gemini 不直接支持视频，但可以通过 file_data 传视频URL
  for (const url of videos) {
    parts.push({ file_data: { file_url: url, mime_type: "video/mp4" } });
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GOOGLE_API_KEY}`;
  console.log(`[DeepAnalysis] Gemini 备用调用，图片数=${images.length}, 视频数=${videos.length}`);

  const response = await axios.post(
    url,
    {
      contents: [{ role: "user", parts }],
      generationConfig: {
        max_output_tokens: 8192,
        temperature: 0.7,
        top_p: 0.9,
      },
    },
    {
      headers: { "Content-Type": "application/json" },
      timeout: 90000,
    }
  );

  const result = response.data as any;
  if (result.promptFeedback?.blockReason) {
    throw new Error(`Gemini 安全过滤: ${result.promptFeedback.blockReason}`);
  }

  const candidate = result.candidates?.[0];
  if (!candidate) throw new Error("Gemini 无候选结果");
  if (candidate.finishReason === "SAFETY") throw new Error("Gemini 安全拦截");

  const text = candidate.content?.parts?.[0]?.text || "";
  if (!text || text.trim().length < 50) throw new Error("Gemini 返回空响应");

  return text;
}

/**
 * 从Markdown报告中提取JSON结构化数据
 */
function extractStructured(analysisText: string): Record<string, any> | null {
  // 找 ```json ... ``` 代码块
  const jsonMatch = analysisText.match(/```json\s*([\s\S]*?)```/);
  if (jsonMatch) {
    try {
      return JSON.parse(jsonMatch[1].trim());
    } catch {
      // 尝试提取花括号内容
      const braceMatch = jsonMatch[1].match(/\{[\s\S]*\}/);
      if (braceMatch) {
        try {
          return JSON.parse(braceMatch[0]);
        } catch {
          // ignore
        }
      }
    }
  }

  // 尝试从全文提取 JSON
  const fullJsonMatch = analysisText.match(/\{[\s\S]*"brand"[\s\S]*\}/);
  if (fullJsonMatch) {
    try {
      return JSON.parse(fullJsonMatch[0]);
    } catch {
      // ignore
    }
  }

  return null;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const imageUrls: string[] = body.imageUrls || [];
    const imageDataUris: string[] = body.imageDataUris || [];
    const videoUrls: string[] = body.videoUrls || [];

    const images = [...imageUrls, ...imageDataUris];

    if (images.length === 0 && videoUrls.length === 0) {
      return NextResponse.json(
        { success: false, error: "需要至少一张图片或一段视频", code: "NO_MEDIA" },
        { status: 400 }
      );
    }

    let analysisText = "";
    let modelUsed = "";

    // 优先使用豆包
    if (ARK_API_KEY) {
      try {
        console.log("[DeepAnalysis] 尝试豆包模型:", ARK_MODEL_ID);
        const content = buildDoubaoContent(images, videoUrls);
        analysisText = await callDoubao(content);
        modelUsed = `豆包 ${ARK_MODEL_ID}`;
      } catch (error: any) {
        console.warn("[DeepAnalysis] 豆包失败:", error.message?.substring(0, 150));
        // 降级到 Gemini
      }
    }

    // 备用：Gemini
    if (!analysisText && GOOGLE_API_KEY) {
      try {
        console.log("[DeepAnalysis] 降级到 Gemini");
        analysisText = await callGeminiDeep(images, videoUrls);
        modelUsed = "Gemini 2.5 Flash（备用）";
      } catch (error: any) {
        console.warn("[DeepAnalysis] Gemini 失败:", error.message?.substring(0, 150));
      }
    }

    // 备用：OpenRouter
    if (!analysisText && OPENROUTER_API_KEY) {
      try {
        console.log("[DeepAnalysis] 降级到 OpenRouter");
        const content = buildDoubaoContent(images, []); // OpenRouter 不支持 video_url
        const response = await axios.post(
          "https://openrouter.ai/api/v1/chat/completions",
          {
            model: "google/gemini-2.0-flash-001:free",
            messages: [{ role: "user", content }],
            max_tokens: 4096,
          },
          {
            headers: {
              Authorization: `Bearer ${OPENROUTER_API_KEY}`,
              "Content-Type": "application/json",
              "HTTP-Referer": "https://usedfarmmach.com",
              "X-Title": "Seller Helper Deep Analysis",
            },
            timeout: 90000,
          }
        );
        analysisText = (response.data as any)?.choices?.[0]?.message?.content || "";
        modelUsed = "OpenRouter Gemini Flash（备用）";
      } catch (error: any) {
        console.warn("[DeepAnalysis] OpenRouter 失败:", error.message?.substring(0, 150));
      }
    }

    if (!analysisText || analysisText.trim().length < 50) {
      return NextResponse.json({
        success: false,
        error: "AI深度分析服务暂时不可用，请稍后重试或使用快速识别功能",
        code: "ALL_MODELS_FAILED",
        retryable: true,
      }, { status: 503 });
    }

    // 提取结构化数据
    const structured = extractStructured(analysisText);

    return NextResponse.json({
      success: true,
      data: {
        analysis: analysisText,
        structured: structured || {},
        model: modelUsed,
        mediaCount: { images: images.length, videos: videoUrls.length },
      },
    });

  } catch (error: any) {
    console.error("[DeepAnalysis] 未处理异常:", error);
    return NextResponse.json({
      success: false,
      error: "AI深度分析暂时不可用，请稍后重试",
      code: "MANUAL_FALLBACK",
    }, { status: 500 });
  }
}
