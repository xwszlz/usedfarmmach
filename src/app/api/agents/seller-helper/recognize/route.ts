// ───────────────────────────────────────────────
// #8 卖家助手 Agent — 图片识别 API
// 多模态 LLM 识别农机图片 → 品牌/型号/年份/工时/状况
// POST /api/agents/seller-helper/recognize
// Body: { imageUrls?: string[], imageDataUris?: string[] }
//
// 🔧 Round4 修复（2026-07-05）：
//   1. 新增 fallback 模型链：gpt-4o-mini → gemini-2.0-flash（免费多模态）
//   2. OpenRouter 403/401 时自动降级到 Google Gemini
//   3. 支持 GOOGLE_API_KEY 作为第二 AI 提供商
//   4. 所有错误统一引导手动填写（code=MANUAL_FALLBACK）
//
// ⚠️ Round3 修复（2026-01-25）保留：
//   maxDuration=60、精细化错误分类、axios 超时45s
// ───────────────────────────────────────────────

import { NextRequest, NextResponse } from "next/server";
import axios from "axios";

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || "";
const OPENROUTER_BASE = "https://openrouter.ai/api/v1";
const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY || "";
const GOOGLE_BASE = "https://generativelanguage.googleapis.com/v1beta/models";

// 模型优先级链：主模型 → 备选模型（免费）
const MODEL_CHAIN = [
  {
    provider: "openrouter" as const,
    model: "openai/gpt-4o-mini",
    label: "GPT-4o-mini",
  },
  {
    provider: "google" as const,
    model: "gemini-2.0-flash-exp",
    label: "Gemini 2.0 Flash（免费）",
  },
];

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// ── 系统提示词（所有模型共用） ──
const SYSTEM_PROMPT = `你是一位资深二手农业机械专家，熟悉 CLAAS、John Deere、New Holland、Krone、Orkel 等主流品牌的收获机、割台、打捆机。
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
  "overallWidth": "整机总宽(mm)，数字字符串，如 \"2990\"，无法识别则为 null",
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
    // data URI → base64 data
    if (url.startsWith("data:")) {
      const [mimeInfo, base64Data] = url.split(",");
      const mimeType = mimeInfo.replace("data:", "").split(";")[0] || "image/jpeg";
      parts.push({
        inline_data: { mime_type: mimeType, data: base64Data },
      });
    } else {
      // URL → fetch as image
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
  return (response.data as any).choices?.[0]?.message?.content || "";
}

// ── 调用 Gemini API ──
async function callGemini(
  model: string,
  parts: Array<Record<string, unknown>>
): Promise<string> {
  const response = await axios.post(
    `${GOOGLE_BASE}/${model}:generateContent?key=${GOOGLE_API_KEY}`,
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
  return (
    (response.data as any).candidates?.[0]?.content?.parts?.[0]?.text || ""
  );
}

// ── 解析 AI 响应为结构化数据 ──
function parseAIResponse(aiText: string): Record<string, any> {
  let recognized: Record<string, any> = {};
  try {
    recognized = JSON.parse(aiText);
  } catch (e) {
    // 尝试从文本中提取 JSON
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
    const images = [...imageUrls, ...imageDataUris];

    if (!images || !Array.isArray(images) || images.length === 0) {
      return NextResponse.json(
        { success: false, error: "需要至少一张图片", code: "NO_IMAGES" },
        { status: 400 }
      );
    }

    // 尝试模型链中的每个模型
    let lastError: Error | null = null;

    for (const entry of MODEL_CHAIN) {
      // 检查该模型的 API Key 是否可用
      if (entry.provider === "openrouter" && !OPENROUTER_API_KEY) continue;
      if (entry.provider === "google" && !GOOGLE_API_KEY) continue;

      console.log(`[SellerHelper] 尝试模型: ${entry.label}`);

      try {
        let aiText: string;

        if (entry.provider === "openrouter") {
          const content = buildOpenRouterContent(images);
          aiText = await callOpenRouter(entry.model, content);
        } else {
          const parts = buildGeminiContent(images);
          aiText = await callGemini(entry.model, parts);
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

        // 401/403/402 是认证/权限问题，换下一个模型试试
        if (statusCode === 401 || statusCode === 403 || statusCode === 402) {
          console.log(`[SellerHelper] ${entry.label} 权限不足(HTTP ${statusCode})，自动降级...`);
          continue;
        }

        // 429 限流 → 等一下再试或换模型
        if (statusCode === 429) {
          continue;
        }

        // 其他错误（网络超时等）也尝试下一个
        continue;
      }
    }

    // 所有模型都失败了
    console.error("[SellerHelper] 所有模型均失败，最后一个错误:", lastError?.message);

    return NextResponse.json({
      success: false,
      error: "AI识别服务暂时不可用，请直接在下方填写产品参数后发布（不影响使用）",
      code: "MANUAL_FALLBACK",
      retryable: true,
    }, { status: 503 });

  } catch (error: any) {
    // 非预期错误（请求体解析失败等）
    console.error("[SellerHelper] 未处理异常:", error?.message);

    return NextResponse.json({
      success: false,
      error: "AI识别暂时不可用，请手动填写产品信息后发布",
      code: "MANUAL_FALLBACK",
    }, { status: 500 });
  }
}
