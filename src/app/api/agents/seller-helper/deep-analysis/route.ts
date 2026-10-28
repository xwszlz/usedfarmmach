/**
 * POST /api/agents/seller-helper/deep-analysis
 * AI深度分析 — 统一豆包版（火山方舟 ARK）
 *
 * V2.2（2026-09-26）：移除全部价格/估值内容，价格口径统一到 /api/valuation
 * V1.3 升级（2026-10）：全量统一到豆包多模态能力（.cn 直连 / .com 经 B 通道代理），不再使用 Gemini / OpenRouter。
 *   接受 isChineseBrand 参数，在 `.cn` 站自动切换分析 prompt。
 * V2.3（2026-11）AI 输出质量修复（老板 `.com` 实测反馈三连）：
 *   ① 语种：接入 `@/lib/i18n/ai-locale`，8 语种用户按 locale 拿到对应语言报告（初稿 + 续写指令都注入语言指令）；
 *   ② 去中国化：`.com` 是国际站，**一律走国际版 prompt**（此前按品牌国籍切，`.com` 卖中国农机时
 *      大量产品误走国内版 prompt，导致国际买家看到「国内就是中国」「补贴政策」这类中国市场视角内容）；
 *   ③ 空小节：prompt 不再要求 `## 结构化数据（JSON）` 小标题，同时服务端清洗加固，
 *      把模型残留的标题 / 引导语 / 多余空行全部剥掉（JSON 代码块本身仍保留给 `extractStructured()`）。
 *
 * Body: { imageUrls?: string[], imageDataUris?: string[], videoUrls?: string[], isChineseBrand?: boolean, locale?: string }
 * Response: { success: true, data: { analysis: "Markdown报告", structured: {...}, model: "..." } }
 */

import { NextRequest, NextResponse } from "next/server";

import { getTokenFromHeaders, verifyToken } from "@/lib/auth";
import { computeAiCost, deductCredits, type AiCostBreakdown } from "@/lib/credits/spend";
import { getBillingCountry } from "@/lib/credits/fx";
import { chatCompletionDoubao, getArkModelId } from "@/lib/ai/ark-client";
import { buildDoubaoContent } from "@/lib/ai/multimodal";
import { resolveAiLocale, withLanguage, type AiLocale } from "@/lib/i18n/ai-locale";
import { isCnSite } from "@/config/site";

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
  "④ 若报告正文已完结，只需补上结尾要求的那一个 ```json 代码块（不要加任何标题、小节名或说明文字）。";

export const maxDuration = 300; // 长报告（含续写轮次）需要更长时间；与 internal/products 的 300s 对齐

/**
 * 国际农机深度分析 Prompt — 全球市场
 *
 * ⚠️ 市场中立红线：本 prompt 只服务 `.com` 国际站，**通篇不得出现「中国 / 国内」视角**，
 * 一律以「买家所在目标市场」为参照。`.com` 上卖的是中国农机，但买家在海外，
 * 讲中国补贴政策对买家无意义，还会被误读为「国内就是中国」（老板实测投诉）。
 * 需要中国市场视角的内容一律放 `DOMESTIC_ANALYSIS_PROMPT`（仅 `.cn` 使用）。
 */
const INTERNATIONAL_ANALYSIS_PROMPT = `你是一位拥有20年经验的资深二手农业机械专家和评估师，精通 John Deere、CLAAS、New Holland、Kubota、Massey Ferguson、Case IH 等全球主流品牌的拖拉机、收获机、打捆机、播种机等各类农机设备。

请根据用户提供的农机照片和视频（可能包含整机全貌、铭牌、驾驶室、发动机、轮胎底盘、工作视频等），结合你的专业知识库，给出一份**详尽的深度分析报告**。

说明：本报告面向**国际买家**撰写，请始终站在买家所在的目标销售市场（销售目的地国家/地区）视角做分析与建议；不要默认设备已在该市场落地，也不要默认买家熟悉当地的政策与规则。

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
- 官方使用说明书获取途径（制造商官网链接或当地经销商联系方式）
- 零件目录/Parts Manual 查询地址
- 维修手册下载链接（如有）
- 技术培训视频或资料推荐
- 该机型在你目标销售市场（买家所在国家/地区）的授权经销与服务网络信息

正文全部写完后，**单独输出一个 \`\`\`json 代码块**，前后不要加任何标题、小节名、序号或说明文字（不要写「结构化数据」「最后附上」之类的话，程序会直接剥掉这个代码块）：
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
 *
 * ⚠️ 本 prompt 仅 `.cn` 国内站使用（见 `useDomesticPrompt` 的站点优先判定），
 * 其中的「中国 / 国内 / 农机购置补贴」措辞是**该站应有内容，不要删改**。
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

正文全部写完后，**单独输出一个 \`\`\`json 代码块**，前后不要加任何标题、小节名、序号或说明文字（不要写「结构化数据」「最后附上」之类的话，程序会直接剥掉这个代码块）：
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

// ── 报告尾部 JSON 小节清洗规则 ──
// 根因：prompt 曾要求模型写 `## 结构化数据（JSON）` 小标题 + 引导语 + ```json 代码块；
// 清洗只删代码块，标题与引导语原样留下 → 报告结尾残留一个只有标题、没有内容的小节。
// 现在 prompt 已不再要求标题，但模型不一定完全听话，故服务端再兜一道。

/**
 * ① 残留中文小标题：行首可选 `#`+空白 + `结构化数据`，整行删除。
 * 例：`## 结构化数据（JSON）` / `**结构化数据（JSON）**` / `结构化数据`
 */
const JSON_SECTION_HEADING_CN = /^[ \t]*#{0,6}[ \t]*\**结构化数据[^\n]*$/gim;

/**
 * ② 残留外语小标题（模型按 locale 换语种后标题名会变，抓不住中文）：
 * 以 `#` 开头的 Markdown 标题行，只要该行出现 JSON 字样即视为结构化数据小节标题。
 * 例：`## Structured Data (JSON)` / `## Données structurées (JSON)`
 */
const JSON_SECTION_HEADING_MD = /^[ \t]*#{1,6}[^\n]*\bJSON\b[^\n]*$/gim;

/**
 * ③ 残留引导语行（「最后附上一个JSON代码块，包含…」这类纯说明行），整行删除。
 * 中文：最后附上 / 最后附加 / 附上一个 / 以下为结构化数据
 * 英文：Finally, append… / Lastly, output…
 */
const JSON_SECTION_LEAD_CN =
  /^[ \t]*(?:最后附上|最后附加|附上一个|以下为结构化数据|下面是结构化数据)[^\n]*$/gim;
const JSON_SECTION_LEAD_EN =
  /^[ \t]*(?:finally|lastly)[,]?[ \t]+(?:append|output|provide|attach|here\s+is)[^\n]*$/gim;

/** ④ 连续 3 个以上空行（含只含空格的行）→ 压成最多 2 个空行 */
const EXCESS_BLANK_LINES = /\n(?:[ \t]*\n){2,}/g;

/**
 * ⑤ 末尾孤立的分隔线（`---` / `***` / `___`，允许尾部空白与换行）。
 * 模型写完 JSON 后常补一条分隔线，代码块被剥掉后它就是报告的最后一行，必须一起删。
 */
const TRAILING_HR = /\n[ \t]*(?:-{3,}|\*{3,}|_{3,})[ \t]*\n*$/;

/**
 * 清理报告正文：剥掉 ```json 代码块及其残留标题/引导语，供前端直接渲染 Markdown。
 *
 * ⚠️ 代码块本身必须在 `extractStructured()` **之后**才删（结构化字段走 `data.structured`），
 * 顺序颠倒会导致六维度评分、技术参数表全部解析失败。
 */
function cleanAnalysisText(analysisText: string): string {
  const cleaned = analysisText
    // 完整代码块 + 被 max_tokens 截断、缺闭合围栏的代码块，一并剥掉
    .replace(/```json[\s\S]*?```/gi, "")
    .replace(/```json[\s\S]*$/i, "")
    // 只剩围栏的空行（``` 单独成行）
    .replace(/^```+$/gm, "")
    // 残留标题 / 引导语（模型不听话时的兜底）
    .replace(JSON_SECTION_HEADING_CN, "")
    .replace(JSON_SECTION_HEADING_MD, "")
    .replace(JSON_SECTION_LEAD_CN, "")
    .replace(JSON_SECTION_LEAD_EN, "")
    // 删行后留下的空洞：连续空行压成最多 2 个
    .replace(EXCESS_BLANK_LINES, "\n\n")
    // 末尾孤立的 `---` 分隔线
    .replace(TRAILING_HR, "")
    .replace(EXCESS_BLANK_LINES, "\n\n")
    .trim();

  // 极端情形：正文剥完只剩一条分隔线 / 空串 → 返回空串，别给前端一个空的 `---`
  return /^(?:-{3,}|\*{3,}|_{3,})$/.test(cleaned) ? "" : cleaned;
}

export async function POST(request: NextRequest) {
  try {
    // ── 登录校验：AI 深度分析需登录并按积分计费（游客不可用）──
    // 401 分支也要拼 /{locale}/credits，此时 body 还没读 → 先用请求头解析一次；
    // body 解析后再带 body.locale 复核（前端显式 locale 优先级最高），得到最终 locale。
    const headerLocale: AiLocale = resolveAiLocale({ request }).locale;
    const token = getTokenFromHeaders(request.headers);
    const payload = token ? verifyToken(token) : null;
    if (!payload) {
      return NextResponse.json(
        {
          success: false,
          error: "请登录后使用 AI 深度分析",
          code: "AUTH_REQUIRED",
          rechargeUrl: `/${headerLocale}/credits`,
        },
        { status: 401 }
      );
    }

    const body = await request.json();

    // ── 输出语种：全站唯一决策入口（见 src/lib/i18n/ai-locale.ts）──
    // 优先级 body.locale → 用户偏好（默认关）→ x-vercel-ip-country → accept-language
    //        → referer → 站点默认；`.cn` 最终收敛到 zh/en。
    const { locale, source } = resolveAiLocale({ bodyLocale: body?.locale, request });
    console.log(`[DeepAnalysis] locale=${locale} source=${source}`);

    console.log(`[DeepAnalysis] 收到请求: ${JSON.stringify({
      imageUrls: (body.imageUrls || []).length,
      imageDataUris: (body.imageDataUris || []).length,
      videoUrls: (body.videoUrls || []).length,
      isChineseBrand: body.isChineseBrand,
      productName: body.productName,
      brandName: body.brandName,
      year: body.year,
      enginePower: body.enginePower,
      locale,
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
    // 双引擎Prompt选择（站点优先）：
    // `.cn` 是国内站，按品牌国籍切双引擎；`.com` 是国际站，一律走国际版
    // （国际站讲中国市场补贴政策对国际买家没有意义，且会被误读为「国内=中国」）。
    const useDomesticPrompt = isCnSite() && isChineseBrand === true;
    let activePrompt = useDomesticPrompt ? DOMESTIC_ANALYSIS_PROMPT : INTERNATIONAL_ANALYSIS_PROMPT;

    // 注入已知参数作为上下文（让AI以已知信息为准，照片作为辅助验证）。
    // 标签用**英文**：这是输入侧元数据，中文标签会把输出语言往中文带偏；
    // 最终输出语言由下方 `withLanguage` 的语言指令决定。
    const knownParams: string[] = [];
    if (brandName) knownParams.push(`- Brand: ${brandName}`);
    if (productName) knownParams.push(`- Model: ${productName}`);
    if (year) knownParams.push(`- Year: ${year}`);
    if (enginePower) knownParams.push(`- Power: ${enginePower} HP`);
    if (knownParams.length > 0) {
      activePrompt += `\n\n⚠️ Known facts (treat as authoritative; photos are for verification):\n${knownParams.join("\n")}`;
    }

    // 语言指令永远追加到最末（离模型最近，遵从度最高），不改动 prompt 一个字
    activePrompt = withLanguage(activePrompt, locale);
    // 续写轮次同样要带语言指令，否则被截断后补写的那几段会退回中文
    const continuePrompt = withLanguage(DEEP_ANALYSIS_CONTINUE_PROMPT, locale);

    // 引擎标识只用于内部日志排查，不进 modelUsed（`.com` 用户不该看到「国内(DOMESTIC)」徽章）
    const engineLabel = useDomesticPrompt ? "国内(DOMESTIC)" : "国际(INTERNATIONAL)";

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
      console.log(`[DeepAnalysis] 首选豆包: ${model}, 引擎: ${engineLabel}, 语种: ${locale}, 图片数: ${images.length}, 视频数: ${videoUrls.length}`);
      const content = await buildDoubaoContent(images, videoUrls, activePrompt);
      const res = await callDoubao(content);
      analysisText = res.text;
      lastUsage = res.usage;
      billingModel = model;
      // 只回模型名：engineLabel 属于内部实现细节
      modelUsed = `豆包 ${model}`;

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
          { role: "user", content: continuePrompt },
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

    // 提取结构化数据（必须在清洗之前：清洗会把 ```json 代码块整块删掉）
    const structured = extractStructured(analysisText);

    // 剥离报告尾部的 ```json 块及残留标题/引导语后再返回正文：结构化字段已单独走 data.structured，
    // 正文不应露出裸 JSON，也不该留一个只有标题、没有内容的「结构化数据」空小节。
    const analysisClean = cleanAnalysisText(analysisText);

    // ── 积分扣减（按 LLM token 实际消耗成本乘以运营定价倍率，反算积分）──
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
