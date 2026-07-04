// ───────────────────────────────────────────────
// #8 卖家助手 Agent — 图片识别 API
// 多模态 LLM (GPT-4o-mini) 识别农机图片 → 品牌/型号/年份/工时/状况
// POST /api/agents/seller-helper/recognize
// Body: { imageUrls?: string[], imageDataUris?: string[] }
//
// ⚠️ Round3 修复（2026-01-25）：
//   1. 新增 maxDuration=60（Vercel 默认10s不够用，AI调用常需15-30s）
//   2. 区分错误类型：配置缺失(501)/服务不可用(503)/请求错误(400)
//   3. 增强日志：记录完整错误上下文便于排查
//   4. axios 超时从 30s 提升到 45s（配合 maxDuration）
// ───────────────────────────────────────────────

import { NextRequest, NextResponse } from "next/server";
import axios from "axios";

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || "";
const OPENROUTER_BASE = "https://openrouter.ai/api/v1";
const MODEL = "openai/gpt-4o-mini"; // 支持多模态的最便宜模型

export const dynamic = "force-dynamic";

// ✅ Round3 修复: Vercel Serverless 超时延长到60秒
// 原因: AI 多模态调用(图片+文本)通常需要 10-30s，Vercel 默认 10s 会直接杀进程导致 500
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const imageUrls: string[] = body.imageUrls || [];
    const imageDataUris: string[] = body.imageDataUris || [];

    const images = [...imageUrls, ...imageDataUris];

    if (!images || !Array.isArray(images) || images.length === 0) {
      return NextResponse.json(
        { success: false, error: "需要至少一张图片 URL 或图片 Base64 数据", code: "NO_IMAGES" },
        { status: 400 }
      );
    }

    // ✅ Round3 修复: 配置缺失返回 501 Not Implemented（而非 500）
    // 让调用方能明确区分"功能未启用"和"服务暂时故障"
    if (!OPENROUTER_API_KEY) {
      console.warn("[SellerHelper] OPENROUTER_API_KEY 未配置，AI识别功能不可用");
      return NextResponse.json(
        {
          success: false,
          error: "AI识别功能暂未启用，请手动填写产品信息",
          code: "SERVICE_NOT_CONFIGURED",
        },
        { status: 501 }
      );
    }

    // 构建多模态消息内容
    const content = [
      {
        type: "text",
        text: `你是一位资深二手农业机械专家，熟悉 CLAAS、John Deere、New Holland、Krone、Orkel 等主流品牌的收获机、割台、打捆机。
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
  "overallHeight": "整机总高(mm)，数字字符串，如 \"3490\"，无法识别则为 null",
  "netWeight": "整机净重(kg)，数字字符串，如 \"12500\"，无法识别则为 null",
  "mainConfig": "主要配置（如割台型号、导航系统、打捆机构型等）",
  "workingHours": "工作小时数，数字，无法识别则为 null",
  "condition": "成色（excellent / good / fair / poor 之一）",
  "priceMode": "价格模式（fob / por），无法识别则为 null",
  "tradeTerm": "贸易条款（FOB / CIF / CFR / EXW / 其他），无法识别则为 null",
  "tradePort": "发货港口（如 Qingdao, Shanghai），无法识别则为 null",
  "confidence": 0-1 之间的置信度分数
}

识别要点：
1. 铭牌照片可识别品牌、型号、年份、马力、发动机类型
2. 整机全貌照片可识别驱动方式（看轮胎/底盘）、尺寸估算
3. 割台/附件照片可识别 mainConfig
4. 成色通过漆面、磨损、锈蚀判断
5. 只返回 JSON，不要任何其他文字
6. 字段无法识别时设为 null，不要瞎编
7. 品牌名必须用英文标准名`,
      },
      ...images.map((url: string) => ({
        type: "image_url" as const,
        image_url: { url },
      })),
    ];

    // ✅ Round3 修复: axios 超时从 30s → 45s（给 AI 模型更多响应时间）
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
        timeout: 45000, // 45秒超时（在 maxDuration=60 的保护范围内）
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
  } catch (error: any) {
    // ✅ Round3 修复: 精细化错误分类 + 详细日志
    const errMsg = error?.message || String(error);
    const errorCode = error?.code;
    const statusCode = error?.response?.status;
    const responseData = error?.response?.data;

    console.error("[SellerHelper] recognize 失败:", {
      message: errMsg,
      code: errorCode,
      httpStatus: statusCode,
      responseData: JSON.stringify(responseData)?.substring(0, 500),
      stack: error?.stack?.substring(0, 300),
    });

    // 网络超时 / 连接拒绝 / DNS 失败 → 503 服务暂不可用（可重试）
    if (
      errMsg?.includes("timeout") ||
      errMsg?.includes("ETIMEDOUT") ||
      errMsg?.includes("ECONNREFUSED") ||
      errMsg?.includes("ENOTFOUND") ||
      errorCode === "ECONNABORTED" ||
      errorCode === "ETIMEDOUT"
    ) {
      return NextResponse.json(
        {
          success: false,
          error: "AI服务响应超时，请稍后重试或手动填写信息",
          code: "AI_SERVICE_TIMEOUT",
        },
        { status: 503 }
      );
    }

    // HTTP 402 — OpenRouter 余额不足（特有错误码）
    if (statusCode === 402) {
      console.warn("[SellerHelper] OpenRouter API 余额不足 (HTTP 402)");
      return NextResponse.json(
        {
          success: false,
          error: "AI识别功能余额不足，请手动填写产品信息",
          code: "AI_INSUFFICIENT_CREDITS",
        },
        { status: 503 } // 服务暂时不可用，客户端应降级为手动填写
      );
    }

    // HTTP 4xx 错误（API Key 无效、配额超限等）→ 返回具体原因
    if (statusCode && statusCode >= 400 && statusCode < 500) {
      const msg = statusCode === 401
        ? "AI服务认证失败，请联系管理员检查 API Key"
        : statusCode === 429
        ? "AI服务请求过于频繁，请稍后重试"
        : `AI服务请求失败(HTTP ${statusCode})`;
      return NextResponse.json(
        { success: false, error: msg, code: `AI_HTTP_${statusCode}` },
        { status: 502 } // 网关级别问题，不是客户端的问题
      );
    }

    // HTTP 5xx 错误（OpenRouter 内部故障）→ 503
    if (statusCode && statusCode >= 500) {
      return NextResponse.json(
        {
          success: false,
          error: "AI服务暂时不可用，请稍后重试或手动填写信息",
          code: "AI_SERVICE_DOWN",
        },
        { status: 503 }
      );
    }

    // 其他未知错误
    return NextResponse.json(
      {
        success: false,
        error: "识别失败，请稍后重试或手动填写产品信息",
        code: "RECOGNIZE_FAILED",
      },
      { status: 500 }
    );
  }
}
