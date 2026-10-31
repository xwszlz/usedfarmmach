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
// 视频 URL 白名单（自有域名）：视频以 `video_url` 送进方舟后是**方舟服务端**去抓地址，
// 不过白名单就等于把我们变成"让第三方模型访问任意地址"的跳板。
// 判定逻辑刻意放在 `net/oss-host`（零依赖纯函数）而不是本文件 —— 与 multimodal 共用同一份实现。
import { filterOwnMediaUrls, isOwnMediaUrl } from "@/lib/net/oss-host";

/**
 * 日志用：尽力取出 hostname（永不抛错）。
 *
 * 为什么只打 host 不打完整 URL：视频地址常带签名参数（`?Expires=...&Signature=...`），
 * 日志一旦被转存/外发就等于泄露可访问凭证（与 `ssrf-guard` 的 `redirect-limit` 同口径）。
 */
function hostForLog(url: string): string {
  try {
    return new URL(url).hostname || "-";
  } catch {
    return "-";
  }
}

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
  // 非自有域名：直接中性降级，**一次网络请求都不发**。
  // 为什么在这里也拦一道（`analyzeVideos` 已经先过滤过）：`analyzeVideo` 是导出函数，
  // `internal/products` 等调用方可能绕过聚合直调；而"把任意 URL 交给方舟去抓"
  // 这条风险必须由**库**兜住，不能依赖每个调用方都记得先过滤。
  if (!isOwnMediaUrl(videoUrl)) {
    console.warn(`[VideoAnalyzer] 跳过非自有域名视频（不交第三方模型抓取，降级为中性）: host=${hostForLog(videoUrl)}`);
    return getDefaultAnalysis();
  }
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
 * 单次估值最多分析几条视频。
 *
 * 为什么是 3：`MAX_VIDEOS_PER_PRODUCT`（`src/lib/content-moderation.ts`）就是产品视频的
 * 业务上限，正常数据不可能超过；这里再夹一次是为了防「请求体塞几十条 URL」这类异常调用
 * 把单次估值的墙钟直接拖穿 —— 每条视频都是一次完整的模型调用（实测单条 40~61s）。
 *
 * 为什么不从 content-moderation 直接 import：那是内容审核业务模块（带 Prisma 等依赖），
 * 估值库只是「算法 + 模型调用」，不该为了一个数字把整条业务依赖链拉进来。
 */
export const MAX_ANALYZE_VIDEOS = 3;

/** 多视频拼接时单条 `analysis` 的截断长度（拼接后仍要能塞进估值报告正文） */
const ANALYSIS_PER_VIDEO_MAX_CHARS = 200;

/**
 * 三个枚举维度的「取值优先级」——**靠前的更坏、更该被采信**。
 *
 * 与 {@link analyzeVideos} 的聚合方向严格对应：取优先级最高（最坏）的那一个。
 */
const ENGINE_SOUND_PRIORITY = ["abnormal_smoke", "abnormal_noise", "normal", "no_sound"] as const;
const SMOOTHNESS_PRIORITY = ["jammed", "sluggish", "smooth"] as const;
const IMPRESSION_PRIORITY = ["poor", "fair", "good", "excellent"] as const;

/** 按优先级表挑出「最坏」的那个取值；候选里一个都匹配不上时返回 undefined 由调用方兜底 */
function pickWorst<T extends string>(candidates: readonly T[], priority: readonly T[]): T | undefined {
  for (const value of priority) {
    if (candidates.includes(value)) return value;
  }
  return undefined;
}

/** 截断单条分析文本，避免 3 条各几百字把估值报告正文挤爆 */
function truncateAnalysis(text: string): string {
  const raw = typeof text === "string" ? text.trim() : "";
  if (raw.length <= ANALYSIS_PER_VIDEO_MAX_CHARS) return raw;
  return `${raw.slice(0, ANALYSIS_PER_VIDEO_MAX_CHARS)}…`;
}

/**
 * 分析一台机器的**全部**视频并聚合成一个结果（供估值使用）。
 *
 * ## 为什么要并行
 *
 * `.cn` 生产容器实测（北京 → ark.cn-beijing 真实路径）：
 *   - 视觉 5 图：110.2s
 *   - 视频 ×1：61.6s（冷启动；后续 40~55s）
 *   - 视频 ×3 **并行**：总墙钟 54.5s（并行有效，不是线性叠加）
 *
 * 估值总预算 `VALUATION_TOTAL_BUDGET_MS` 只有 200s，其中结论叙述要 90s、保底线 25s。
 * 串行账（图 110.2s → 视频 61.6s）= 171.8s，只剩 28.2s，已经低到要走「跳过结论叙述」；
 * 若是 3 条视频串行则必然被砍。并行后视频段 ≈ 54.5s，与图片段重叠，总墙钟 ≈ max(110.2, 54.5)。
 *
 * 注意：视频**之间**并行，图片与视频的并行由调用方（`valuation/route.ts`）用 `Promise.all` 编排。
 *
 * ## 为什么聚合「异常优先」（保守）
 *
 * 二手车估值宁可低估、不可高估：3 条视频里有 1 条拍了冒黑烟/割台卡滞，另外 2 条一切正常，
 * 正确的结论是「这台机器存在该问题」，而不是「3 条里 2 条正常所以按正常算」。
 * 因此三个判断维度一律取**最坏**的取值；只有 `qualityScore` / `confidence` 取最大值 ——
 * 它们衡量的是「画面看得清不清、判断有多确定」，不是机器好坏，取最好的那条才有信息量。
 *
 * @param videoUrls 视频公网地址（调用方负责先用 `getVideoUrl()` 转成可访问地址）
 * @param locale    输出语种，透传给每条视频的 `analyzeVideo`
 * @returns 聚合结果；**没有任何一条成功**时返回中性降级结果（`degraded: true` ⇒ 因子 1.0）
 */
export async function analyzeVideos(
  videoUrls: string[],
  locale: AiLocale = "zh"
): Promise<VideoAnalysisResult> {
  // ① 先过「自有媒体」白名单（**唯一实现**在 `net/oss-host.filterOwnMediaUrls`）：
  //    非自有域名的视频会被丢弃 + warn，不抛错。这一步必须在下面的并发**之前**做 ——
  //    否则会为一个注定被拒的 URL 白起一次并发（每条都是一次完整模型调用）。
  const ownUrls = filterOwnMediaUrls(Array.isArray(videoUrls) ? videoUrls : [], "视频");
  // ② 再按条数上限裁剪（`MAX_ANALYZE_VIDEOS`，对齐产品视频业务上限 3）
  const urls = ownUrls.slice(0, MAX_ANALYZE_VIDEOS);
  if (urls.length < ownUrls.length) {
    console.warn(
      `[VideoAnalyzer] 视频数 ${ownUrls.length} 超过上限 ${MAX_ANALYZE_VIDEOS}，只分析前 ${urls.length} 条`
    );
  }
  // 没有可分析的视频：返回中性降级（与"有视频但没分析成功"出口一致，因子恒 1.0）
  if (urls.length === 0) return getDefaultAnalysis();

  // 并行发起：单条失败/降级都不能拖垮整体（`analyzeVideo` 内部已 try/catch，
  // 这里再用 allSettled 兜一层，保证"它哪天改成会抛"时聚合逻辑也不会连带炸掉整条估值链路）
  const settled = await Promise.allSettled(urls.map((url) => analyzeVideo(url, locale)));

  const succeeded: VideoAnalysisResult[] = [];
  settled.forEach((outcome, index) => {
    const label = `视频${index + 1}`;
    if (outcome.status === "rejected") {
      const reason = outcome.reason;
      console.warn(
        `[VideoAnalyzer] ${label}分析抛错（已跳过，不参与聚合）:`,
        reason instanceof Error ? reason.message : String(reason)
      );
      return;
    }
    // 降级结果的字段是兜底值（smooth / good / 0.3），拿它参与"最坏优先"聚合会污染结论：
    // 既可能凭空制造最坏值，也可能（qualityScore 取最大时）盖掉真实成功的那条。
    if (outcome.value.degraded === true) {
      console.warn(`[VideoAnalyzer] ${label}分析降级，不参与聚合`);
      return;
    }
    succeeded.push(outcome.value);
  });

  // 全部失败/全部降级 ⇒ 中性。这里必须走 getDefaultAnalysis() 而不是拼一个"看起来中性"的对象：
  // 降级标记 + 因子中性由 getDefaultAnalysis / calculateVideoFactor 这一对保证，只有一处口径。
  if (succeeded.length === 0) {
    console.warn(`[VideoAnalyzer] ${urls.length} 条视频全部未取得有效分析（聚合降级，因子中性）`);
    return getDefaultAnalysis();
  }

  const engineSoundStatus =
    pickWorst(
      succeeded.map((item) => item.engineSoundStatus),
      ENGINE_SOUND_PRIORITY
    ) ?? "no_sound";
  const mechanismSmoothness =
    pickWorst(
      succeeded.map((item) => item.mechanismSmoothness),
      SMOOTHNESS_PRIORITY
    ) ?? "smooth";
  const overallImpression =
    pickWorst(
      succeeded.map((item) => item.overallImpression),
      IMPRESSION_PRIORITY
    ) ?? "good";

  console.log(
    `[VideoAnalyzer] 多视频聚合完成: 成功 ${succeeded.length}/${urls.length}，` +
      `engineSound=${engineSoundStatus}，smoothness=${mechanismSmoothness}，impression=${overallImpression}`
  );

  return {
    hasVideo: true,
    degraded: false,
    // 画面质量/置信度取最大值：衡量的是"看得清不清 / 判断有多确定"，不是机器好坏
    qualityScore: Math.max(...succeeded.map((item) => item.qualityScore)),
    engineSoundStatus,
    mechanismSmoothness,
    overallImpression,
    // 逐条编号拼接，方便卖家/复核人对着具体那条视频读结论
    analysis: succeeded
      .map((item, index) => `视频${index + 1}：${truncateAnalysis(item.analysis)}`)
      .join("\n"),
    confidence: Math.max(...succeeded.map((item) => item.confidence)),
  };
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
