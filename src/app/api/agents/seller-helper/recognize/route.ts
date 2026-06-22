// ───────────────────────────────────────────────
// #8 卖家助手 Agent — 图片识别 API
// 多模态 LLM (GPT-4o) 识别农机图片 → 品牌/型号/年份/工时/状况
// POST /api/agents/seller-helper/recognize
// Body: { imageUrls: string[] }
// ───────────────────────────────────────────────

import { NextRequest, NextResponse } from "next/server";
import axios from "axios";

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || "";
const OPENROUTER_BASE = "https://openrouter.ai/api/v1";
const MODEL = "openai/gpt-4o-mini"; // 支持多模态的最便宜模型

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const imageUrls: string[] = body.imageUrls || [];
    const imageDataUris: string[] = body.imageDataUris || [];

    const images = [...imageUrls, ...imageDataUris];

    if (!images || !Array.isArray(images) || images.length === 0) {
      return NextResponse.json(
        { success: false, error: "需要至少一张图片 URL 或图片 Base64 数据" },
        { status: 400 }
      );
    }

    if (!OPENROUTER_API_KEY) {
      return NextResponse.json(
        { success: false, error: "API Key 未配置" },
        { status: 500 }
      );
    }

    // 构建多模态消息内容
    const content = [
      {
        type: "text",
        text: `你是一位二手农业机械专家。请根据提供的图片，识别以下信息并以 JSON 格式返回：
{
  "brand": "品牌名称（如 CLAAS, John Deere, Krone 等）",
  "modelName": "型号（如 JAGUAR 970, 5300RC 等）",
  "year": 年份数字（如 2018），如果无法识别则为 null,
  "workingHours": 工作小时数（如 3500），如果无法识别则为 null,
  "condition": "状况描述（excellent/good/fair/poor 之一）",
  "features": "其他可识别特征（如四轮驱动、割台类型等）",
  "confidence": 0-1 之间的置信度分数
}

注意事项：
1. 只返回 JSON，不要任何其他文字
2. 品牌名用英文标准名
3. 型号尽可能精确
4. 如果图片质量差或无法识别，confidence 设为 0.3 以下`,
      },
      ...images.map((url: string) => ({
        type: "image_url" as const,
        image_url: { url },
      })),
    ];

    const response = await axios.post(
      `${OPENROUTER_BASE}/chat/completions`,
      {
        model: MODEL,
        messages: [
          {
            role: "user",
            content,
          },
        ],
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
        timeout: 30000,
      }
    );

    const aiText = (response.data as any).choices?.[0]?.message?.content || "";

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

    return NextResponse.json({
      success: true,
      data: {
        brand: recognized.brand || null,
        modelName: recognized.modelName || null,
        year: recognized.year || null,
        workingHours: recognized.workingHours || null,
        condition: recognized.condition || null,
        features: recognized.features || null,
        confidence: recognized.confidence || 0.5,
      },
    });
  } catch (error: any) {
    console.error("Seller helper recognize error:", error.message);
    return NextResponse.json(
      { success: false, error: "识别失败，请稍后重试" },
      { status: 500 }
    );
  }
}
