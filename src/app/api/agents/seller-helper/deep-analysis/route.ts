/**
 * POST /api/agents/seller-helper/deep-analysis
 * AI深度分析 — 统一豆包版（火山方舟 ARK）
 *
 * V2.2（2026-09-26）：移除全部价格/估值内容，价格口径统一到 /api/valuation
 * V1.3 升级（2026-10）：全量统一到豆包多模态能力（.cn 直连 / .com 经 B 通道代理），不再使用 Gemini / OpenRouter。
 *   接受 isChineseBrand 参数，自动切换分析prompt
 *
 * Body: { imageUrls?: string[], imageDataUris?: string[], videoUrls?: string[], isChineseBrand?: boolean }
 * Response: { success: true, data: { analysis: "Markdown报告", structured: {...}, model: "..." } }
 */

import { NextRequest, NextResponse } from "next/server";
import axios from "axios";

import { getTokenFromHeaders, verifyToken } from "@/lib/auth";
import { computeAiCost, deductCredits, type AiCostBreakdown } from "@/lib/credits/spend";
import { getBillingCountry } from "@/lib/credits/fx";
import { chatCompletionDoubao, getArkModelId } from "@/lib/ai/ark-client";

export const dynamic = "force-dynamic";

/** LLM 调用结果：文本 + token 用量（用于积分计费） */
interface LlmCallResult {
  text: string;
  usage: { inputTokens: number; outputTokens: number };
  /** 豆包停止原因：length = 触及 max_tokens 被截断（长报告需续写） */
  finishReason?: string;
}

/**
 * 深度分析单次生成的 max_tokens。
 * 模型（doubao-seed-2-1-pro）官方上限 256k，但单次调用受路由 maxDuration 约束：
 * 16384 tokens 在 300s 预算内可稳定生成完，超出部分走续写轮次拼接（见下方续写逻辑）。
 */
const DEEP_ANALYSIS_MAX_TOKENS = 16384;
/** 单次调用超时：必须小于路由 maxDuration(300s)，否则路由先被平台杀掉、自身超时永远等不到 */
const DEEP_ANALYSIS_TIMEOUT_MS = 280_000;
/** 续写轮次上限：1 次初稿 + 2 次续写，理论可覆盖约 48k tokens 的报告 */
const DEEP_ANALYSIS_MAX_CONTINUE_ROUNDS = 2;
/** 续写指令：明确要求只写剩余部分，避免 LLM 从头重复整篇报告 */
const DEEP_ANALYSIS_CONTINUE_PROMPT =
  "上面的内容是你正在撰写的深度分析报告，因单次输出长度上限被截断。" +
  "请紧接着截断处继续输出剩余部分，严格要求：" +
  "① 严禁重复任何已写内容；② 不要输出报告摘要或开头语；" +
  "③ 保持原有章节编号与格式继续往下写；" +
  "④ 若报告正文已完结，只需补上结尾要求的 ```json 结构化数据块。";

/** 从 referer / 路径推断 locale（与 quota guard 的 rechargeUrl 保持一致） */
function getLocaleFromRequest(request: NextRequest): string {
  const referer = request.headers.get("referer") || "";
  const m = referer.match(/\/([a-z]{2})\b/) || referer.match(/\/([a-z]{2})$/);
  if (m && ["zh", "en", "ru", "es", "pt", "fr", "hi", "ar"].includes(m[1])) {
    return m[1];
  }
  return "zh";
}
export const maxDuration = 300; // 长报告（含续写轮次）需要更长时间；与 internal/products 的 300s 对齐

/**
 * 国际农机深度分析 Prompt — 全球市场
 */
const INTERNATIONAL_ANALYSIS_PROMPT = `你是一位拥有20年经验的资深二手农业机械专家和评估师，精通 John Deere、CLAAS、New Holland、Kubota、Massey Ferguson、Case IH 等全球主流品牌的拖拉机、收获机、打捆机、播种机等各类农机设备。

请根据用户提供的农机照片和视频（可能包含整机全貌、铭牌、驾驶室、发动机、轮胎底盘、工作视频等），结合你的专业知识库，给出一份**详尽的深度分析报告**。

报告必须包含以下部分（用 Markdown 格式输出）：

## 设备识别
- 品牌（英文标准名）
- 具体型号
- 生产年份（或年份范围）
- 识别依据（从哪张照片/视频的什么特征判断的）

## 技术参数解读
基于你对该型号的专业知识，列出关键技术参数：
- 发动机：型号、额定马力(HP)、排量、缸数
- 传动系统：驱动方式(2WD/4WD)、变速箱档位数
- 液压系统：提升力、输出流量
- 尺寸重量：长×宽×高(mm)、整机重量(kg)
- 燃油箱容量、PTO功率等
- 如果照片中有铭牌信息，以铭牌为准；否则根据你的专业知识补充

## 设备现状评估（六维度评分）
从以下6个维度评估设备现状，每个维度打分（1-10分，10分为最佳）：
- 外观漆面（喷漆完整性、褪色程度）— 评分及说明
- 锈蚀程度（车身、底盘、关键部件锈蚀情况）— 评分及说明
- 轮胎/履带（磨损程度、花纹深度、是否需要更换）— 评分及说明
- 驾驶室/操作台（整洁度、仪表功能、座椅状况）— 评分及说明
- 液压渗漏（管路、接头、油缸是否有渗漏）— 评分及说明
- 整体印象（保养水平、使用痕迹、维保记录）— 评分及说明
最后给出综合评价和总体评分。

## 操作与维修要点
基于你的专业知识，给出该型号农机的：
- 日常操作注意事项
- 定期保养项目及周期（工作小时数）
- 常见故障及排除方法
- 易损件清单
- 关键操作技巧

## 购买建议
- 该设备的优缺点总结
- 适合的作业场景
- 选购时需要重点检查的部位
- 询价空间分析

## 资源与文档
- 官方使用说明书获取途径（官网链接或经销商联系方式）
- 零件目录/Parts Manual 查询地址
- 维修手册下载链接（如有）
- 技术培训视频或资料推荐
- 该品牌在中国的授权服务商信息（如有）

## 结构化数据（JSON）
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
  "conditionScores": {
    "exterior": 1-10,
    "rust": 1-10,
    "tires": 1-10,
    "cabin": 1-10,
    "hydraulic": 1-10,
    "overall": 1-10
  },
  "isChineseBrand": false,
  "confidence": 0.0-1.0
}
\`\`\`

重要提示：
1. **请充分利用你的专业知识**，不要仅依赖照片信息
2. 报告内容要详实、专业、有深度，至少2000字`;

/**
 * 国内农机深度分析 Prompt — 车况评估、操作维修、国内市场
 */
const DOMESTIC_ANALYSIS_PROMPT = `你是一位拥有20年经验的中国资深农业机械专家和评估师，精通东方红、雷沃、沃得、福田、久保田（国产）、洋马、井关、时风、五征、常发、星光、中联重科等国内主流品牌的拖拉机、收割机、插秧机、播种机、植保机、打捆机等各类农机设备。你对中国农机购置补贴政策、各省补贴额度、二手农机交易市场行情有深入了解。

请根据用户提供的农机照片和视频（可能包含整机全貌、铭牌、驾驶室、发动机、轮胎底盘、工作视频等），结合你的专业知识库，给出一份**详尽的深度分析报告**。

报告必须包含以下部分（用 Markdown 格式输出）：

## 设备识别
- 品牌（中文标准名）
- 具体型号
- 生产年份（或年份范围）
- 识别依据（从哪张照片/视频的什么特征判断的）

## 技术参数解读
基于你对该型号的专业知识，列出关键技术参数：
- 发动机：型号、额定马力(HP)、排量、缸数
- 传动系统：驱动方式(两驱/四驱)、变速箱档位数
- 液压系统：提升力、输出流量
- 尺寸重量：长×宽×高(mm)、整机重量(kg)
- 燃油箱容量、PTO功率等
- 如果照片中有铭牌信息，以铭牌为准；否则根据你的专业知识补充

## 设备现状评估（六维度评分）
从以下6个维度评估设备现状，每个维度打分（1-10分，10分为最佳）：
- 外观漆面（喷漆完整性、褪色程度）— 评分及说明
- 锈蚀程度（车身、底盘、关键部件锈蚀情况）— 评分及说明
- 轮胎/履带（磨损程度、花纹深度、是否需要更换）— 评分及说明
- 驾驶室/操作台（整洁度、仪表功能、座椅状况）— 评分及说明
- 液压渗漏（管路、接头、油缸是否有渗漏）— 评分及说明
- 整体印象（保养水平、使用痕迹、维保记录）— 评分及说明
最后给出综合评价和总体评分。

## 操作与维修要点
- 日常操作注意事项
- 定期保养项目及周期（工作小时数）
- 常见故障及排除方法
- 易损件清单及参考价格
- 关键操作技巧

## 购买建议
- 该设备的优缺点总结
- 适合的作业场景和地块规模
- 选购时需要重点检查的部位
- 询价空间分析
- 售后服务与配件供应情况

## 资源与文档
- 官方使用说明书获取途径（官网链接或经销商联系方式）
- 零件目录/配件手册查询地址
- 维修手册下载链接（如有）
- 技术培训视频或资料推荐
- 该品牌在中国的授权服务商信息

## 结构化数据（JSON）
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
  "conditionScores": {
    "exterior": 1-10,
    "rust": 1-10,
    "tires": 1-10,
    "cabin": 1-10,
    "hydraulic": 1-10,
    "overall": 1-10
  },
  "isChineseBrand": true,
  "confidence": 0.0-1.0
}
\`\`\`

重要提示：
1. **请充分利用你的专业知识**，不要仅依赖照片信息
2. 报告内容要详实、专业、有深度，至少2000字`;

/**
 * 构建豆包API的多模态消息内容
 *
 * 注意 1（图片）：豆包服务端下载公开图片 URL 会超时失败
 * （InvalidParameter: Timeout while downloading url），
 * 因此这里统一在服务端先下载并转成 base64 data URI 再传入。
 * data: 开头的输入本身就是 base64，直接透传。
 *
 * 注意 2（视频）：视频仍以 video_url 形式透传，该格式未在 .cn 生产环境验证过，
 * 若豆包侧不支持或抓取失败，会抛错并被上层 catch 记入 errors 后降级到备用模型，
 * 不会阻断整条链路。视频支持保留。
 */
async function buildDoubaoContent(
  images: string[],
  videos: string[],
  prompt: string
): Promise<Array<Record<string, unknown>>> {
  const content: Array<Record<string, unknown>> = [
    { type: "text", text: prompt },
  ];

  // 图片：公开 URL 需服务端下载转 base64，下载失败则跳过该图不中断
  for (const url of images) {
    if (url.startsWith("data:")) {
      content.push({
        type: "image_url",
        image_url: { url },
      });
      continue;
    }
    try {
      const { mimeType, data } = await downloadImageAsBase64(url);
      content.push({
        type: "image_url",
        image_url: { url: `data:${mimeType};base64,${data}` },
      });
    } catch (err: any) {
      console.warn(`[DeepAnalysis] 下载图片失败 ${url}:`, err.message?.substring(0, 80));
    }
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
 * 调用豆包 API（统一出口 chatCompletionDoubao）
 */
async function callDoubao(
  content: Array<Record<string, unknown>>,
  /** 续写时追加的历史消息（assistant 已写内容 + user 续写指令） */
  extraMessages: Array<{ role: string; content: string }> = []
): Promise<LlmCallResult> {
  const model = getArkModelId();
  console.log(
    `[DeepAnalysis] 豆包调用: model=${model}, ` +
    `图片数=${content.filter((c) => c.type === "image_url").length}, ` +
    `视频数=${content.filter((c) => c.type === "video_url").length}`
  );

  const result = await chatCompletionDoubao({
    model,
    maxTokens: DEEP_ANALYSIS_MAX_TOKENS,
    timeoutMs: DEEP_ANALYSIS_TIMEOUT_MS,
    messages: [{ role: "user", content }, ...extraMessages],
  });

  const text = result.text || "";

  if (!text || text.trim().length < 50) {
    throw new Error("豆包返回空响应或响应过短");
  }

  const usage = {
    inputTokens: result.usage?.prompt_tokens ?? 0,
    outputTokens: result.usage?.completion_tokens ?? 0,
  };

  return { text, usage, finishReason: result.finishReason };
}

// ── 下载图片并转为 base64 ──
async function downloadImageAsBase64(url: string): Promise<{ mimeType: string; data: string }> {
  const response = await axios.get(url, {
    responseType: "arraybuffer",
    timeout: 20000,
  });
  const contentType = response.headers["content-type"] || "image/jpeg";
  const base64 = Buffer.from(new Uint8Array(response.data as ArrayBuffer)).toString("base64");
  return { mimeType: contentType.split(";")[0], data: base64 };
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
    // ── 登录校验：AI 深度分析需登录并按积分计费（游客不可用）──
    const locale = getLocaleFromRequest(request);
    const token = getTokenFromHeaders(request.headers);
    const payload = token ? verifyToken(token) : null;
    if (!payload) {
      return NextResponse.json(
        {
          success: false,
          error: "请登录后使用 AI 深度分析",
          code: "AUTH_REQUIRED",
          rechargeUrl: `/${locale}/credits`,
        },
        { status: 401 }
      );
    }

    const body = await request.json();
    console.log(`[DeepAnalysis] 收到请求: ${JSON.stringify({
      imageUrls: (body.imageUrls || []).length,
      imageDataUris: (body.imageDataUris || []).length,
      videoUrls: (body.videoUrls || []).length,
      isChineseBrand: body.isChineseBrand,
      productName: body.productName,
      brandName: body.brandName,
      year: body.year,
      enginePower: body.enginePower,
    })}`);
    const imageUrls: string[] = body.imageUrls || [];
    const imageDataUris: string[] = body.imageDataUris || [];
    const videoUrls: string[] = body.videoUrls || [];
    const isChineseBrand = body.isChineseBrand as boolean | undefined;
    const productName = body.productName as string | undefined;
    const categoryName = body.category as string | undefined;
    const brandName = body.brandName as string | undefined;
    const year = body.year as number | undefined;
    const enginePower = body.enginePower as string | undefined;

    const images = [...imageUrls, ...imageDataUris];

    if (images.length === 0 && videoUrls.length === 0) {
      return NextResponse.json(
        { success: false, error: "需要至少一张图片或一段视频", code: "NO_MEDIA" },
        { status: 400 }
      );
    }

    // 双引擎Prompt选择
    let activePrompt = isChineseBrand ? DOMESTIC_ANALYSIS_PROMPT : INTERNATIONAL_ANALYSIS_PROMPT;

    // 注入已知参数作为上下文（让AI以已知信息为准，照片作为辅助验证）
    const knownParams: string[] = [];
    if (brandName) knownParams.push(`- 品牌：${brandName}`);
    if (productName) knownParams.push(`- 型号：${productName}`);
    if (year) knownParams.push(`- 年份：${year}`);
    if (enginePower) knownParams.push(`- 马力：${enginePower} HP`);
    if (knownParams.length > 0) {
      activePrompt += `\n\n⚠️ 已知信息（请以此为准，照片作为辅助验证）：\n${knownParams.join("\n")}`;
    }

    const engineLabel = isChineseBrand ? "国内(DOMESTIC)" : "国际(INTERNATIONAL)";

    let analysisText = "";
    let modelUsed = "";
    let billingModel = "";
    let lastUsage = { inputTokens: 0, outputTokens: 0 };
    let truncated = false;
    let continueRounds = 0;
    const errors: string[] = [];

    // 全站统一豆包（火山方舟 ARK）：.cn 直连国行、.com 经 B 通道代理（见 ark-client.ts）。
    // 数据不出境红线：豆包为境内服务，.cn 数据不经境外。
    try {
      const model = getArkModelId();
      console.log(`[DeepAnalysis] 首选豆包: ${model}, 引擎: ${engineLabel}, 图片数: ${images.length}, 视频数: ${videoUrls.length}`);
      const content = await buildDoubaoContent(images, videoUrls, activePrompt);
      const res = await callDoubao(content);
      analysisText = res.text;
      lastUsage = res.usage;
      billingModel = model;
      modelUsed = `豆包 ${model} [${engineLabel}]`;

      // 长报告续写：finishReason === "length" 表示输出触及 max_tokens 被截断
      // （历史上这正是「报告下面没出全」的静默根因——截断信号此前被 ark-client 丢弃）。
      // 按火山官方推荐做法：把已生成内容作为上下文继续写；轮次用尽仍截断则置 truncated。
      let finishReason = res.finishReason;
      while (finishReason === "length" && continueRounds < DEEP_ANALYSIS_MAX_CONTINUE_ROUNDS) {
        continueRounds += 1;
        console.warn(
          `[DeepAnalysis] 输出被 max_tokens 截断(finish_reason=length)，第 ${continueRounds}/${DEEP_ANALYSIS_MAX_CONTINUE_ROUNDS} 次续写`
        );
        const cont = await callDoubao(content, [
          { role: "assistant", content: analysisText },
          { role: "user", content: DEEP_ANALYSIS_CONTINUE_PROMPT },
        ]);
        analysisText += cont.text;
        lastUsage = {
          inputTokens: lastUsage.inputTokens + cont.usage.inputTokens,
          outputTokens: lastUsage.outputTokens + cont.usage.outputTokens,
        };
        finishReason = cont.finishReason;
      }
      if (finishReason === "length") {
        truncated = true;
        console.error("[DeepAnalysis] 已达最大续写轮次，报告仍不完整，已标记 truncated");
      }
    } catch (error: any) {
      const msg = `[豆包] ${error.message || ""}`.substring(0, 150);
      console.warn("[DeepAnalysis] 豆包失败:", msg);
      errors.push(msg);
      // 初稿失败 → analysisText 为空，走下方 ALL_MODELS_FAILED；
      // 续写失败 → 保留已生成内容并标记 truncated，避免静默缺尾。
      if (analysisText) truncated = true;
    }

    if (!analysisText || analysisText.trim().length < 50) {
      return NextResponse.json({
        success: false,
        error: "AI深度分析服务暂时不可用，请稍后重试或使用快速识别功能",
        code: "ALL_MODELS_FAILED",
        retryable: true,
        debug: errors.length > 0 ? errors.map(e => e.substring(0, 120)) : ["未捕获到模型错误"],
      }, { status: 503 });
    }

    // 提取结构化数据
    const structured = extractStructured(analysisText);

    // 剥离报告尾部的 ```json 块后再返回正文：结构化字段已单独走 data.structured，
    // 正文不应露出裸 JSON（含模型输出被 max_tokens 截断、缺闭合围栏的情形）。
    const analysisClean = analysisText
      .replace(/```json[\s\S]*?```/gi, "")
      .replace(/```json[\s\S]*$/i, "")
      .replace(/^```+$/gm, "")
      .trim();

    // ── 积分扣减（按 LLM token 实际消耗成本 × 2，反算积分）──
    const billingCountry = await getBillingCountry(payload.userId);
    const cost: AiCostBreakdown = computeAiCost({
      model: billingModel || getArkModelId(),
      inputTokens: lastUsage.inputTokens,
      outputTokens: lastUsage.outputTokens,
      billingCountry,
    });
    const deduction = await deductCredits(
      payload.userId,
      cost.points,
      "AI深度分析",
      cost as unknown as Record<string, unknown>
    );
    if (!deduction.ok) {
      return NextResponse.json(
        {
          success: false,
          error: "积分不足，请先充值后再使用 AI 深度分析",
          code: "INSUFFICIENT_CREDITS",
          rechargeUrl: `/${locale}/credits`,
          required: deduction.required,
          balance: deduction.credits,
        },
        { status: 402 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        analysis: analysisClean,
        structured: structured || {},
        model: modelUsed,
        mediaCount: { images: images.length, videos: videoUrls.length },
        pointsCharged: cost.points,
        creditsBalance: deduction.credits,
        // true = 续写轮次用尽仍未收尾，前端应提示「报告未完整生成」
        truncated,
        continueRounds,
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
