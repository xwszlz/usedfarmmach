/**
 * AI估值引擎 V4 — 多模态图片分析模块
 *
 * 使用统一豆包（火山方舟 ARK）视觉能力分析产品图片，输出视觉成色评分。
 * 全站 AI 统一出口：src/lib/ai/ark-client.ts#chatCompletionDoubao
 *   - .cn 直连国行 ARK（数据不出境红线不动）
 *   - .com 经 HK/SG 代理节点（B 通道）代调国行（详见 ark-client.ts / 设计稿 §3.6 E-1）
 *
 * 模型：ARK_VISION_MODEL_ID（默认回退 ARK_MODEL_ID），部署侧按方舟视觉能力模型填。
 *
 * 2026-11 变更（AI 输出质量专项）：
 *   1. prompt 增加 `conditionCode`（英文枚举 excellent|good|fair|poor），供下游按字面量匹配；
 *      原有 `conditionLabel`（优秀/良好/一般/较差）保留不动 —— 既有消费方与既有测试仍在用。
 *   2. 逐图结果不再被压成「一个平均分 + 一段散文」：聚合后额外产出 `perImage`，
 *      按传入顺序保留每张图的 score/label/analysis/confidence（前端报告要逐图展示）。
 *   3. prompt 追加语言指令（`buildLanguageDirective`），支持 8 语种输出；
 *      枚举字段（conditionCode / label）永不翻译。
 */

import { chatCompletionDoubao, getArkVisionModelId } from "@/lib/ai/ark-client";
import { recordUsage, ESTIMATED_TOKENS } from "@/lib/credits/usage-collector";
import { withLanguage, type AiLocale } from "@/lib/i18n/ai-locale";

/** 成色代码：英文枚举，**不翻译**（下游按字面量匹配） */
export type ConditionCode = "excellent" | "good" | "fair" | "poor";

/** 全部合法成色代码（顺序：由好到差） */
export const CONDITION_CODES: readonly ConditionCode[] = ["excellent", "good", "fair", "poor"];

/**
 * 一次估值最多送进视觉模型的图片张数。
 *
 * 为什么是 5（而不是原来写死的 3）：
 *   1. 前端估值页 `page.tsx` 的 `MAX_IMAGES = 5` —— 用户能传 5 张（整机外观 / 发动机舱 /
 *      驾驶室 / 铭牌 / 轮胎磨损），后端只吃前 3 张等于**静默丢弃**第 4、5 张；而聚合口径是
 *      `avgScore = 所有结果的平均`、`bestScore` 取加权最高，样本少 ⇒ 置信度低 ⇒ 结论保守，
 *      老板看到的「报告比较单薄」有这一份贡献。
 *   2. `api/agents/seller-helper/recognize` 路由对图片数量**不设上限**（`images.map` 全量送豆包）：
 *      同一批图「识别品牌型号」看 5 张、「估值视觉分析」只看 3 张，两个模块口径不一致。
 *   3. 为什么不是无限：每张图都是一次独立计费的视觉调用（`maxTokens: 800`）。上限必须显式存在，
 *      否则用户传 18 张就会烧 18 次；5 张是「够覆盖验机所需角度」与「成本可控」的交点。
 *
 * ⚠️ 前端与后端两处上限必须同步（本常量 export 出来就是为了让前端/测试引用同一个数）。
 */
export const MAX_ANALYZE_IMAGES = 5;

const IMAGE_PROMPT = `你是一位资深二手农业机械评估专家，熟悉各类农机设备的成色评估标准。
请仔细分析这张农机设备图片，评估设备的成色状态。

重要要求：
1. 必须以纯JSON格式返回结果，不要有任何其他文字、说明或markdown标记
2. 返回格式必须是有效的JSON，可以被JSON.parse()解析
3. 不要使用\`\`\`json\`\`\`包装，直接返回JSON对象

JSON字段说明：
{
  "conditionScore": 成色评分（1-10分，10分为全新状态）,
  "conditionCode": "成色代码，必须是 excellent / good / fair / poor 四个英文单词之一，禁止翻译成其他语言",
  "conditionLabel": "成色标签（优秀/良好/一般/较差）",
  "analysis": "详细的评估依据，描述设备外观、磨损、锈蚀等情况",
  "confidence": 置信度（0-1之间的小数）
}

评估标准（conditionCode 必须与 conditionScore 一致）：
- 9-10分 → excellent：设备外观接近全新，无明显磨损、锈蚀或损伤
- 7-8分 → good：设备保养良好，有轻微使用痕迹，无结构性损伤
- 5-6分 → fair：设备有明显使用痕迹，可能有轻度锈蚀或磨损，但不影响使用
- 3-4分 → poor：设备磨损较重，可能有明显锈蚀或需要维修的部分
- 1-2分 → poor：设备状况很差，可能需要大修或已接近报废

示例输出：
{"conditionScore": 7, "conditionCode": "good", "conditionLabel": "良好", "analysis": "设备整体状况良好，有轻微使用痕迹，油漆完整，无重大锈蚀", "confidence": 0.85}

注意：评估要客观公正，基于图片实际状况，confidence取决于图片清晰度和可见范围。
conditionCode 只能取 excellent / good / fair / poor 这四个英文值，不得输出其它取值或本地化写法。`;

export interface ImageAnalysisResult {
  conditionScore: number;      // 成色评分 1-10
  conditionCode: ConditionCode; // 成色代码（英文枚举，不翻译）
  conditionLabel: string;       // 成色标签：优秀/良好/一般/较差（向后兼容，保持不变）
  analysis: string;             // 评估依据
  confidence: number;           // 置信度 0-1
  isDefault?: boolean;          // 是否为默认分析结果（未调用LLM）
}

/** 单张图片的成色结论（逐图明细，供报告渲染） */
export interface PerImageAnalysis {
  /** 成色评分 1-10 */
  score: number;
  /** 成色代码（英文枚举，不翻译） */
  label: ConditionCode;
  /** 评估依据 */
  analysis: string;
  /** 置信度 0-1 */
  confidence: number;
}

export interface VisualValuationResult {
  visualConditionScore: number;    // 视觉成色评分 1-10
  visualConditionAnalysis: string;  // 视觉评估依据
  imageConfidence: number;         // 图片分析置信度
  usedV4Condition: boolean;       // 是否使用了V4视觉成色
  /** 逐图明细（按传入顺序；无图片 / 全失败时为空数组）。
   *  设为可选是为了不破坏既有构造点，但 analyzeProductImages 恒会产出。 */
  perImage?: PerImageAnalysis[];
  /** 聚合成色代码（由聚合评分换算，英文枚举，不翻译） */
  conditionCode?: ConditionCode;
}

/** data URI 前缀（`data:image/jpeg;base64,`）—— 命中即为前端已压缩好的 base64 载荷 */
const DATA_URI_RE = /^data:(image\/[a-z0-9.+-]+);base64,/i;

/**
 * 把评分换算成成色代码（分段与 prompt 里的评估标准严格一致）。
 * 非法输入兜底为 fair（既不过度乐观也不过度悲观）。
 */
export function scoreToConditionCode(score: number): ConditionCode {
  const n = Number(score);
  if (!Number.isFinite(n)) return "fair";
  if (n >= 9) return "excellent";
  if (n >= 7) return "good";
  if (n >= 5) return "fair";
  return "poor";
}

/**
 * 把任意模型输出归一化成合法 `ConditionCode`。
 *
 * 容错范围：大小写、空白、以及模型自作主张给出的中文标签/近义词。
 * 仍然识别不了 ⇒ 用 `fallbackScore` 换算（评分总是有的，代码必须有值）。
 */
export function normalizeConditionCode(value: unknown, fallbackScore: number): ConditionCode {
  if (typeof value === "string") {
    const raw = value.trim().toLowerCase();
    const exact = CONDITION_CODES.find((code) => code === raw);
    if (exact) return exact;
    // 模型偶发的中文/近义写法（旧 prompt 只给了中文标签，兼容一下）
    if (raw.includes("优秀") || raw.includes("极好") || raw.includes("excellent")) return "excellent";
    if (raw.includes("良好") || raw.includes("good")) return "good";
    if (raw.includes("一般") || raw.includes("fair")) return "fair";
    if (raw.includes("较差") || raw.includes("差") || raw.includes("poor")) return "poor";
  }
  return scoreToConditionCode(fallbackScore);
}

/** 成色代码 → 各语种可读文案（前端 `visual.labelText` 直接渲染） */
const CONDITION_LABEL_TEXT: Record<AiLocale, Record<ConditionCode, string>> = {
  zh: { excellent: "优秀", good: "良好", fair: "一般", poor: "较差" },
  en: { excellent: "Excellent", good: "Good", fair: "Fair", poor: "Poor" },
  ru: { excellent: "Отличное", good: "Хорошее", fair: "Среднее", poor: "Плохое" },
  es: { excellent: "Excelente", good: "Bueno", fair: "Regular", poor: "Malo" },
  pt: { excellent: "Excelente", good: "Bom", fair: "Razoável", poor: "Ruim" },
  ar: { excellent: "ممتاز", good: "جيد", fair: "مقبول", poor: "ضعيف" },
  fr: { excellent: "Excellent", good: "Bon", fair: "Moyen", poor: "Mauvais" },
  hi: { excellent: "उत्कृष्ट", good: "अच्छा", fair: "सामान्य", poor: "खराब" },
};

/**
 * 取某语种的成色可读文案。
 * 未知语种回落英文，非法代码回落 fair —— 绝不返回 undefined（前端不做空值判断）。
 */
export function conditionCodeLabelText(code: ConditionCode | null | undefined, locale: AiLocale): string {
  const table = CONDITION_LABEL_TEXT[locale] ?? CONDITION_LABEL_TEXT.en;
  const safeCode: ConditionCode = code && CONDITION_CODES.includes(code) ? code : "fair";
  return table[safeCode];
}

/**
 * 把「图片 URL / data URI」统一转成可直接喂给豆包视觉的 data URL。
 *
 * - data URI：**原样透传**。前端 `canvas.toDataURL("image/jpeg", 0.82)` 已给出压缩后的 base64，
 *   再 `fetch()` 一次纯属浪费；且超长 data URI 在部分 runtime 下 fetch 行为不确定。
 * - http(s) URL：下载后 base64，mime 取响应 `content-type`（非 image/* 一律按 jpeg 兜底）。
 *
 * 为什么必须支持 data URI：估值页 / 深度分析上传的都是本地压缩图（不上传到 CDN），
 * 只传 data URI；若此处不支持，国产渠道（.cn）估值的图片分析会被静默跳过 ⇒ 零 token ⇒ 零收费。
 */
async function fetchImageAsBase64(imageUrl: string): Promise<string> {
  const raw = typeof imageUrl === "string" ? imageUrl.trim() : "";
  if (DATA_URI_RE.test(raw)) return raw;

  const resp = await fetch(raw);
  if (!resp.ok) throw new Error(`图片下载失败: ${resp.status}`);
  const buf = Buffer.from(await resp.arrayBuffer());
  // 用可选链读 content-type：部分运行环境/测试桩的 Response 没有 headers，
  // 这里绝不能因此抛错（否则整条视觉分析会被降级成默认分，估值失真）。
  const header = (resp.headers?.get?.("content-type") || "").split(";")[0].trim().toLowerCase();
  const mime = header.startsWith("image/") ? header : "image/jpeg";
  return `data:${mime};base64,${buf.toString("base64")}`;
}

/**
 * 分析产品图片，评估设备成色。统一经豆包视觉能力。
 *
 * @param imageUrl 图片 URL 或 `data:image/...;base64,...`
 * @param locale   输出语种（只影响 analysis 等说明性文字；conditionCode 永远英文枚举）
 */
export async function analyzeProductImage(
  imageUrl: string,
  locale: AiLocale = "zh"
): Promise<ImageAnalysisResult> {
  try {
    const imageDataUrl = await fetchImageAsBase64(imageUrl);
    const model = getArkVisionModelId();

    const result = await chatCompletionDoubao({
      model,
      maxTokens: 800,
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: withLanguage(IMAGE_PROMPT, locale) },
            { type: "image_url", image_url: { url: imageDataUrl } },
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

    const conditionScore = Math.max(1, Math.min(10, Number(parsed.conditionScore) || 5));

    return {
      conditionScore,
      // conditionCode 是下游按字面量匹配的枚举：非法值一律按评分兜底，绝不放行未知字符串
      conditionCode: normalizeConditionCode(parsed.conditionCode, conditionScore),
      // conditionLabel 保持原语义（向后兼容），仅在模型没给时用中文兜底
      conditionLabel: parsed.conditionLabel || fallbackConditionLabel(conditionScore),
      analysis: parsed.analysis || "AI分析未完成",
      confidence: Math.max(0, Math.min(1, Number(parsed.confidence) || 0.5)),
    };
  } catch (error: any) {
    console.error(`[ImageAnalyzer] 豆包视觉调用失败:`, error?.message || String(error));
    return getDefaultAnalysis();
  }
}

/** 模型没给 conditionLabel 时的中文兜底（与 conditionCode 分段一致） */
function fallbackConditionLabel(score: number): string {
  return CONDITION_LABEL_TEXT.zh[scoreToConditionCode(score)];
}

/**
 * 批量分析多张产品图片（并行处理）。
 *
 * @param imageUrls 图片 URL / data URI 列表（最多分析前 MAX_ANALYZE_IMAGES=5 张，控制成本）
 * @param locale    输出语种
 */
export async function analyzeProductImages(
  imageUrls: string[],
  locale: AiLocale = "zh"
): Promise<VisualValuationResult> {
  if (!imageUrls || imageUrls.length === 0) {
    return {
      visualConditionScore: 0,
      visualConditionAnalysis: "",
      imageConfidence: 0,
      usedV4Condition: false,
      perImage: [],
    };
  }

  // 最多分析 MAX_ANALYZE_IMAGES 张图片（成本保护上限，与前端上传上限对齐）
  const urlsToAnalyze = imageUrls.slice(0, MAX_ANALYZE_IMAGES);

  try {
    const results = await Promise.all(urlsToAnalyze.map((url) => analyzeProductImage(url, locale)));
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
    const visualConditionScore = Math.round(avgScore * 10) / 10;

    // 逐图明细按传入顺序保留（过去这里只留「加权最高那张的 analysis」，其余全丢）
    const perImage: PerImageAnalysis[] = results.map((result) => ({
      score: result.conditionScore,
      label: result.conditionCode,
      analysis: result.analysis,
      confidence: result.confidence,
    }));

    return {
      visualConditionScore,
      visualConditionAnalysis: bestAnalysis,
      imageConfidence: avgConfidence,
      usedV4Condition: hasRealAnalysis,
      perImage,
      conditionCode: scoreToConditionCode(visualConditionScore),
    };
  } catch (error) {
    console.error("[ImageAnalyzer] 批量图片分析失败:", error);
    return {
      visualConditionScore: 0,
      visualConditionAnalysis: "",
      imageConfidence: 0,
      usedV4Condition: false,
      perImage: [],
    };
  }
}

/**
 * 获取默认分析结果（降级方案）
 */
function getDefaultAnalysis(): ImageAnalysisResult {
  return {
    conditionScore: 5, // 默认中等成色
    conditionCode: "fair",
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
