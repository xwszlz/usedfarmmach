/**
 * AI估值引擎 V4 — 视频分析模块
 *
 * 使用统一豆包（火山方舟 ARK）多模态能力分析农机运转视频，
 * 评估发动机状态、作业机构流畅度、视频质量等维度。全站统一出口：
 *   src/lib/ai/ark-client.ts#chatCompletionDoubao
 *   - .cn 直连国行 ARK；.com 经 HK/SG 代理节点（B 通道）。
 *
 * ⚠️ E-2（待决策）：方舟视频理解能力模型待选，ARK_VIDEO_MODEL_ID 由部署侧填。
 *   当前调用链路已接好（video_url 内容块）；若所选模型暂不支持视频，调用将失败并降级，
 *   不影响估值主链路。计费仍按豆包模型归集。
 *
 * 视频因子取值范围：0.92 ~ 1.08
 * 设计原则：有视频只加分不扣分（除非发现明显缺陷）
 */

import { chatCompletionDoubao, getArkVideoModelId } from "@/lib/ai/ark-client";
import { recordUsage, ESTIMATED_TOKENS } from "@/lib/credits/usage-collector";
import { withLanguage, type AiLocale } from "@/lib/i18n/ai-locale";

const VIDEO_PROMPT = `你是一位资深二手农业机械评估专家，熟悉各类农机设备的运转状态评估。
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
3. confidence 取决于视频清晰度和内容完整度`;

export interface VideoAnalysisResult {
  hasVideo: boolean;
  qualityScore: number; // 0~1 (清晰度+稳定性+完整度)
  engineSoundStatus: "normal" | "abnormal_noise" | "abnormal_smoke" | "no_sound";
  mechanismSmoothness: "smooth" | "sluggish" | "jammed";
  overallImpression: "excellent" | "good" | "fair" | "poor";
  analysis: string; // 详细分析文本
  confidence: number; // 置信度 0-1
  /**
   * 本次结果是否为**降级结果**（分析调用失败、或模型返回了无法解析出任何有效维度的响应）。
   *
   * 为什么要显式标出来而不是"让默认值算出来刚好等于 1.0"：
   * 因子表（{@link calculateVideoFactor} 里的加减分）会随业务调整变动，
   * 靠"默认字段拼出来正好 1.00"是**隐式耦合**——任何人给 smooth / good 调一下分值，
   * 降级路径就会重新开始偷偷加价，而且没有任何一处代码会因此报错。
   * 显式标记后，「降级必须中性」这条规则由 `calculateVideoFactor` 第一行强制保证。
   *
   * 说明性字段（analysis / confidence）在降级时仍会被展示，因此保留默认文案。
   */
  degraded?: boolean;
}

/**
 * 分析农机运转视频（统一豆包）。失败/模型不支持时降级。
 *
 * @param videoUrl 视频公网地址
 * @param locale   输出语种（只影响 analysis 等说明性文字；
 *                 engineSoundStatus / mechanismSmoothness / overallImpression 三个枚举永远英文）
 */
export async function analyzeVideo(
  videoUrl: string,
  locale: AiLocale = "zh"
): Promise<VideoAnalysisResult> {
  try {
    const model = getArkVideoModelId();
    const result = await chatCompletionDoubao({
      model,
      maxTokens: 1000,
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: withLanguage(VIDEO_PROMPT, locale) },
            { type: "video_url", video_url: { url: videoUrl } },
          ],
        },
      ],
    });

    // ── 计费归集（豆包视频模型）──
    recordUsage(
      model,
      result.usage?.prompt_tokens ?? ESTIMATED_TOKENS.input,
      result.usage?.completion_tokens ?? ESTIMATED_TOKENS.output,
      { estimated: !result.usage }
    );

    const aiText = result.text || "";
    let parsed: Partial<VideoAnalysisResult> = {};
    try {
      parsed = JSON.parse(aiText);
    } catch {
      const jsonMatch = aiText.match(/\{[\s\S]*\}/);
      if (jsonMatch) parsed = JSON.parse(jsonMatch[0]);
    }

    // HTTP 200 但解析不出任何有效维度（模型只回了说明性文字、回了 "{}"、或 JSON 结构不对）：
    // 业务上与"调用失败"完全等价 —— 没有任何证据支持加减价。
    // 必须走中性降级，否则下面的字段兜底值（smooth + good）会凭空拼出 +2% 的加价。
    if (!hasUsableSignal(parsed)) {
      console.warn("[VideoAnalyzer] 模型返回无可解析的有效维度（降级，中性因子）");
      return getDefaultAnalysis();
    }

    // 注：单个字段缺失时仍沿用既有兜底值（缺 engineSoundStatus → no_sound 不加减价；
    // 缺 mechanismSmoothness → smooth 会 +0.02；缺 overallImpression → good 不加减价）。
    // 这是本次之前就有的字段级语义，未纳入本次"降级必须中性"的修复范围。
    return {
      hasVideo: true,
      qualityScore: Math.max(0, Math.min(1, Number(parsed.qualityScore) || 0.5)),
      engineSoundStatus: (parsed.engineSoundStatus as VideoAnalysisResult["engineSoundStatus"]) || "no_sound",
      mechanismSmoothness: (parsed.mechanismSmoothness as VideoAnalysisResult["mechanismSmoothness"]) || "smooth",
      overallImpression: (parsed.overallImpression as VideoAnalysisResult["overallImpression"]) || "good",
      analysis: parsed.analysis || "视频分析未完成",
      confidence: Math.max(0, Math.min(1, Number(parsed.confidence) || 0.5)),
    };
  } catch (error: any) {
    console.error("[VideoAnalyzer] 豆包视频分析失败（降级）:", error?.message || String(error));
    return getDefaultAnalysis();
  }
}

/**
 * 模型返回里是否含有**至少一个**可用于打分的有效维度。
 *
 * 只认三个判断类枚举与 qualityScore 本身 —— `analysis` / `confidence` 是说明性字段，
 * 单独出现（"视频看不清" 之类）不构成打分依据，不能拿来当"分析成功"。
 */
function hasUsableSignal(parsed: Partial<VideoAnalysisResult>): boolean {
  const sound = parsed.engineSoundStatus;
  if (sound === "normal" || sound === "abnormal_noise" || sound === "abnormal_smoke" || sound === "no_sound") {
    return true;
  }
  const smoothness = parsed.mechanismSmoothness;
  if (smoothness === "smooth" || smoothness === "sluggish" || smoothness === "jammed") {
    return true;
  }
  const impression = parsed.overallImpression;
  if (impression === "excellent" || impression === "good" || impression === "fair" || impression === "poor") {
    return true;
  }
  const quality = Number(parsed.qualityScore);
  return Number.isFinite(quality) && quality > 0;
}

/**
 * 计算视频因子（videoFactor）。
 *
 * ⚠️ 铁律：**降级必须中性**（恒返回 1.0，不加价也不减价）。
 *
 * 被锁死的 Bug（本函数第一行守的就是它）：降级默认值是
 * `qualityScore 0.3 / no_sound / smooth / good`，代入打分表后
 * `smooth` 给 +0.02、其余均 0 ⇒ **视频分析失败反而给估值加价 2%**。
 * 这不是"偏差不大可以接受"，而是赔率方向错了：越没看清，车越贵。
 * 所以降级判定放在最前面短路，且依赖显式的 `degraded` 标记，
 * 而不是"希望字段默认值拼出来正好等于 1.0"（因子表一调就会重新开始偷偷加价）。
 *
 * @param video 视频分析结果（可能来自降级路径）
 * @returns 视频因子，取值 [0.92, 1.08]；降级 / 无视频恒为 1.0
 */
export function calculateVideoFactor(video: VideoAnalysisResult): number {
  // 降级结果：没有任何画面证据 ⇒ 中性，不得参与加减价
  if (video.degraded === true) return 1.0;
  if (!video.hasVideo) return 1.0; // 无视频 = 基准，不扣分

  let factor = 1.0;

  // 1. 基础奖励：有合格视频就加分
  if (video.qualityScore >= 0.6) factor += 0.02;
  if (video.qualityScore >= 0.85) factor += 0.01;

  // 2. 发动机状态（基于声音分析）
  switch (video.engineSoundStatus) {
    case "normal": factor += 0.03; break;
    case "abnormal_noise": factor -= 0.06; break;
    case "abnormal_smoke": factor -= 0.08; break;
    case "no_sound": break;
  }

  // 3. 作业机构流畅度
  switch (video.mechanismSmoothness) {
    case "smooth": factor += 0.02; break;
    case "sluggish": factor -= 0.02; break;
    case "jammed": factor -= 0.06; break;
  }

  // 4. 总体印象微调
  switch (video.overallImpression) {
    case "excellent": factor += 0.02; break;
    case "poor": factor -= 0.04; break;
  }

  // 限制范围：视频因子不超过 ±8% 浮动
  return Math.max(0.92, Math.min(1.08, Math.round(factor * 100) / 100));
}

/**
 * 获取默认分析结果（降级方案）。
 *
 * ⚠️ `degraded: true` 是**必须**的：它是 `calculateVideoFactor` 判定"中性"的唯一依据。
 * 曾经没有这个标记，靠下面这组字段的取值"凑"出因子 —— 结果凑出了 1.02（smooth +0.02），
 * 变成"分析失败反而加价"。改动本函数的任何字段前，先确认 `calculateVideoFactor`
 * 是否仍会把该组合识别为中性（现在由 `degraded` 短路，不再依赖字段取值）。
 */
function getDefaultAnalysis(): VideoAnalysisResult {
  return {
    hasVideo: true,
    degraded: true,
    qualityScore: 0.3,
    engineSoundStatus: "no_sound",
    mechanismSmoothness: "smooth",
    overallImpression: "good",
    analysis: "视频分析服务暂不可用，使用基准估值",
    confidence: 0.2,
  };
}
