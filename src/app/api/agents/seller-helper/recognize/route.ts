// ───────────────────────────────────────────────
// #8 卖家助手 Agent — 图片识别 API
// 多模态 LLM 识别农机图片 → 品牌/型号/年份/工时/状况
// POST /api/agents/seller-helper/recognize
// Body: { imageUrls?: string[], imageDataUris?: string[] }
//
// 🔧 Round6 更新（2026-07-06）：
//   1. 新增豆包（火山引擎ARK）为第一优先模型（免费+快速）
//   2. 支持 imageUrls（HTTP URL）输入格式（与 deep-analysis 一致）
//   3. Gemini 降为第二备用，OpenRouter 保持第三备选
//
// ⚠️ Round5 修复（2026-07-05）保留：
//   Gemini 模型名修正、OpenRouter 多模型备选链
// ───────────────────────────────────────────────

import { NextRequest, NextResponse } from "next/server";
import axios from "axios";

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || "";
const OPENROUTER_BASE = "https://openrouter.ai/api/v1";
const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY || "";
const GOOGLE_BASE = "https://generativelanguage.googleapis.com/v1beta/models";

// 豆包（火山引擎ARK）
const ARK_API_KEY = process.env.ARK_API_KEY || "";
const ARK_BASE_URL = process.env.ARK_BASE_URL || "https://ark.cn-beijing.volces.com/api/v3";
const ARK_MODEL_ID = process.env.ARK_MODEL_ID || "doubao-seed-evolving";

// 模型优先级链：豆包（免费主力）→ Gemini → OpenRouter 备选
const MODEL_CHAIN = [
  // ── 第一优先：豆包（火山引擎ARK，免费、快速） ──
  {
    provider: "ark" as const,
    label: `豆包 ${ARK_MODEL_ID}`,
  },
  // ── 第二优先：Google Gemini（免费、稳定） ──
  {
    provider: "google" as const,
    model: "gemini-2.5-flash",
    label: "Gemini 2.5 Flash（免费）",
  },
  // ── 第三优先：OpenRouter 备选模型链 ──
  {
    provider: "openrouter" as const,
    model: "google/gemini-2.0-flash-001:free",
    label: "Gemini Flash via OpenRouter（免费）",
  },
  {
    provider: "openrouter" as const,
    model: "openai/gpt-4o-mini",
    label: "GPT-4o-mini via OpenRouter",
  },
  {
    provider: "openrouter" as const,
    model: "anthropic/claude-haiku",
    label: "Claude Haiku via OpenRouter",
  },
];

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// ── 系统提示词（所有模型共用） ──
const SYSTEM_PROMPT = `你是一位资深二手农业机械专家，熟悉 CLAAS、John Deere, New Holland、Krone、Orkel 等主流品牌的收获机、割台、打捆机。
请根据提供的农机图片（整机全貌、铭牌、驾驶室、轮胎/底盘），识别以下信息，以 JSON 格式返回。

返回字段说明：
{
  "brand": "品牌英文名（如 CLAAS, John Deere, New Holland, Krone, Orkel）",
  "modelName": "型号（如 JAGUAR 970, FR9040, 5300RC）",
  "year": 年份数字（如 2018），无法识别则为 null,
  "enginePower": "发动机额定马力(HP)，数字字符串，如 \"480\"，无法识别则为 null",
  "engineType": "发动机类型（如 Diesel Engine, Gasoline, Other）",
  "driveSystem": "驱动方式（2WD / 4WD / Full Hydraulic）",
  "overallLength": "整机总长(mm)，数字字符串，如 \"8900\"，无法识别则为 null",
  "overallWidth": "整机总宽(mm)，数字字符串，如 \"2990\"，无法识别则为 null,
  "overallHeight": "整机总高(mm)，数字字符串，如 \"3490\"，无法识别则为 null,
  "netWeight": "整机净重(kg)，数字字符串，如 \"12500\"，无法识别则为 null,
  "mainConfig": "主要配置（如割台型号、导航系统、打捆机构型等）",
  "workingHours": "工作小时数，数字，无法识别则为 null,
  "condition": "成色（excellent / good / fair / poor 之一）",
  "priceMode": "价格模式（fob / por），无法识别则为 null,
  "tradeTerm": "贸易条款（FOB / CIF / CFR / EXW / 其他），无法识别则为 null,
  "tradePort": "发货港口（如 Qingdao, Shanghai），无法识别则为 null,
  "confidence": 0-1 之间的置信度分数
}

识别要点：
1. 铭牌照片可识别品牌、型号、年份、马力、发动机类型
2. 整机全貌照片可识别驱动方式（看轮胎/底盘）、尺寸估算
3. 割台/附件照片可识别 mainConfig
4. 成色通过漆面、磨损、锈蚀判断
5. 只返回 JSON，不要任何其他文字
6. 字段无法识别时设为 null，不要瞎编
7. 品牌名必须用英文标准名`;

// ── 构建豆包(ARK)格式的消息内容（OpenAI兼容）──
function buildDoubaoContent(images: string[], videoUrls: string[] = []) {
  const content: Array<Record<string, unknown>> = [
    { type: "text", text: SYSTEM_PROMPT },
  ];
  for (const url of images) {
    if (url.startsWith("data:")) {
      // base64 → 豆包不支持，跳过（会降级到Gemini）
      console.warn("[SellerHelper] 豆包不支持base64图片，该图片将被跳过");
      continue;
    }
    // HTTP URL → image_url 格式
    content.push({
      type: "image_url",
      image_url: { url },
    });
  }
  // 视频URL作为文本描述传入（多模态模型可参考）
  for (const vUrl of videoUrls) {
    content.push({
      type: "text",
      text: `[视频] ${vUrl}`,
    });
  }
  return content;
}

// ── 调用豆包 API（OpenAI 兼容格式）──
async function callDoubao(content: Array<Record<string, unknown>>): Promise<string> {
  const url = `${ARK_BASE_URL}/chat/completions`;
  console.log(`[SellerHelper] 豆包调用: ${ARK_MODEL_ID}，图片数: ${content.length - 1}`);

  const response = await axios.post(
    url,
    {
      model: ARK_MODEL_ID,
      messages: [{ role: "user", content }],
      response_format: { type: "json_object" },
      max_tokens: 800,
    },
    {
      headers: {
        Authorization: `Bearer ${ARK_API_KEY}`,
        "Content-Type": "application/json",
      },
      timeout: 30000, // 豆包通常很快
    }
  );

  const result = response.data as any;
  const text = result.choices?.[0]?.message?.content || "";

  if (result.error) {
    throw new Error(`豆包API错误: ${result.error.message || JSON.stringify(result.error)}`);
  }

  return text;
}

// ── 构建 OpenRouter 格式的消息内容 ──
function buildOpenRouterContent(images: string[]) {
  return [
    { type: "text" as const, text: SYSTEM_PROMPT },
    ...images.map((url: string) => ({
      type: "image_url" as const,
      image_url: { url },
    })),
  ];
}

// ── 构建 Gemini 格式的消息内容 ──
function buildGeminiContent(images: string[]) {
  const parts: Array<Record<string, unknown>> = [
    { text: SYSTEM_PROMPT },
  ];
  for (const url of images) {
    if (url.startsWith("data:")) {
      const [mimeInfo, base64Data] = url.split(",");
      const mimeType = mimeInfo.replace("data:", "").split(";")[0] || "image/jpeg";
      parts.push({
        inline_data: { mime_type: mimeType, data: base64Data },
      });
    } else {
      parts.push({ file_data: { file_url: url, mime_type: "image/jpeg" } });
    }
  }
  return parts;
}

// ── 调用 OpenRouter API ──
async function callOpenRouter(
  model: string,
  content: Array<Record<string, unknown>>
): Promise<string> {
  console.log(`[SellerHelper] OpenRouter 调用: ${model}，图片数: ${content.length - 1}`);

  const response = await axios.post(
    `${OPENROUTER_BASE}/chat/completions`,
    {
      model,
      messages: [{ role: "user", content }],
      response_format: { type: "json_object" },
      max_tokens: 800,
    },
    {
      headers: {
        Authorization: `Bearer ${OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://usedfarmmach.com",
        "X-Title": "Seller Helper Agent",
      },
      timeout: 45000,
    }
  );

  const result = response.data as any;
  const text = result.choices?.[0]?.message?.content || "";

  if (result.error) {
    throw new Error(`OpenRouter API 错误: ${result.error.message || JSON.stringify(result.error)}`);
  }

  return text;
}

// ── 调用 Gemini API ──
async function callGemini(
  model: string,
  parts: Array<Record<string, unknown>>
): Promise<string> {
  const url = `${GOOGLE_BASE}/${model}:generateContent?key=${GOOGLE_API_KEY}`;
  console.log(`[SellerHelper] Gemini 调用: ${url.substring(0, 60)}...，图片数: ${parts.length - 1}`);

  const response = await axios.post(
    url,
    {
      contents: [{ role: "user", parts }],
      generationConfig: {
        response_mime_type: "application/json",
        max_output_tokens: 800,
      },
    },
    {
      headers: { "Content-Type": "application/json" },
      timeout: 45000,
    }
  );

  const result = response.data as any;
  if (result.promptFeedback?.blockReason) {
    throw new Error(`Gemini 安全过滤: ${result.promptFeedback.blockReason}`);
  }

  const candidate = result.candidates?.[0];
  if (!candidate) {
    throw new Error("Gemini 无候选结果");
  }

  if (candidate.finishReason === "SAFETY") {
    throw new Error("Gemini 安全拦截响应内容");
  }

  return candidate.content?.parts?.[0]?.text || "";
}

// ── 解析 AI 响应为结构化数据 ──
function parseAIResponse(aiText: string): Record<string, any> {
  let recognized: Record<string, any> = {};
  try {
    recognized = JSON.parse(aiText);
  } catch (e) {
    const jsonMatch = aiText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      recognized = JSON.parse(jsonMatch[0]);
    } else {
      recognized = { error: "无法解析 AI 响应" };
    }
  }
  return recognized;
}

// ── 构建成功响应 ──
function buildSuccessResponse(recognized: Record<string, any>) {
  return NextResponse.json({
    success: true,
    data: {
      brand: recognized.brand || null,
      modelName: recognized.modelName || null,
      year: recognized.year || null,
      enginePower: recognized.enginePower || null,
      engineType: recognized.engineType || null,
      driveSystem: recognized.driveSystem || null,
      overallLength: recognized.overallLength || null,
      overallWidth: recognized.overallWidth || null,
      overallHeight: recognized.overallHeight || null,
      netWeight: recognized.netWeight || null,
      mainConfig: recognized.mainConfig || null,
      workingHours: recognized.workingHours || null,
      condition: recognized.condition || null,
      priceMode: recognized.priceMode || null,
      tradeTerm: recognized.tradeTerm || null,
      tradePort: recognized.tradePort || null,
      confidence: recognized.confidence || 0.5,
    },
  });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const imageUrls: string[] = body.imageUrls || [];
    const imageDataUris: string[] = body.imageDataUris || [];
    const videoUrls: string[] = body.videoUrls || [];
    const images = [...imageUrls, ...imageDataUris];
    const hasBase64Images = imageDataUris.some((u) => u.startsWith("data:"));

    if (!images || !Array.isArray(images) || images.length === 0) {
      return NextResponse.json(
        { success: false, error: "需要至少一张图片", code: "NO_IMAGES" },
        { status: 400 }
      );
    }

    let lastError: Error | null = null;

    for (const entry of MODEL_CHAIN) {
      // 检查 API Key 是否可用
      if (entry.provider === "ark" && !ARK_API_KEY) continue;
      if (entry.provider === "openrouter" && !OPENROUTER_API_KEY) continue;
      if (entry.provider === "google" && !GOOGLE_API_KEY) continue;

      // 豆包不支持 base64 图片 → 如果只有base64则跳过豆包
      if (entry.provider === "ark" && hasBase64Images) {
        console.log("[SellerHelper] 有base64图片，跳过豆包（不支持base64）");
        continue;
      }

      console.log(`[SellerHelper] 尝试模型: ${entry.label}`);

      try {
        let aiText: string;

        if (entry.provider === "ark") {
          // 豆包：使用 OpenAI 兼容格式
          const content = buildDoubaoContent(imageUrls, videoUrls);
          if (content.length <= 1) {
            // 只有文字没有有效图片
            lastError = new Error("豆包无有效图片输入");
            continue;
          }
          aiText = await callDoubao(content);
        } else if (entry.provider === "openrouter") {
          const content = buildOpenRouterContent(images);
          aiText = await callOpenRouter(entry.model!, content);
        } else {
          const parts = buildGeminiContent(images);
          aiText = await callGemini(entry.model!, parts);
        }

        if (!aiText || aiText.trim().length < 10) {
          console.warn(`[SellerHelper] ${entry.label} 返回空响应，尝试下一个`);
          lastError = new Error(`${entry.label} 返回空响应`);
          continue;
        }

        const recognized = parseAIResponse(aiText);
        console.log(`[SellerHelper] ${entry.label} 识别成功，置信度: ${recognized.confidence}`);
        return buildSuccessResponse(recognized);

      } catch (error: any) {
        const statusCode = error?.response?.status;
        console.warn(`[SellerHelper] ${entry.label} 失败 (HTTP ${statusCode}):`, error.message?.substring(0, 100));
        lastError = error;

        if (statusCode === 401 || statusCode === 403 || statusCode === 402) {
          console.log(`[SellerHelper] ${entry.label} 权限不足(HTTP ${statusCode})，自动降级...`);
          continue;
        }
        if (statusCode === 429) {
          continue;
        }
        continue;
      }
    }

    console.error("[SellerHelper] 所有模型均失败，最后一个错误:", lastError?.message);

    return NextResponse.json({
      success: false,
      error: "AI识别服务暂时不可用，请直接在下方填写产品参数后发布（不影响使用）",
      code: "MANUAL_FALLBACK",
      retryable: true,
    }, { status: 503 });

  } catch (error: any) {
    console.error("[SellerHelper] 未处理异常:", error?.message);

    return NextResponse.json({
      success: false,
      error: "AI识别暂时不可用，请手动填写产品信息后发布",
      code: "MANUAL_FALLBACK",
    }, { status: 500 });
  }
}
