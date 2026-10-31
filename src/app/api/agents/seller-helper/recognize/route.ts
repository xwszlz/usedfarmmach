// ───────────────────────────────────────────────
// #8 卖家助手 Agent — 图片识别 API（统一豆包版）
// 多模态 LLM 识别农机图片 → 品牌/型号/年份/工时/状况
// POST /api/agents/seller-helper/recognize
// Body: { imageUrls?: string[], imageDataUris?: string[], isChineseBrand?: boolean }
//
// 🔧 V1.3 升级（统一豆包 - 火山方舟 ARK）：
//   全量统一到豆包多模态能力（.cn 直连 / .com 经 B 通道代理），不再使用 Gemini / OpenRouter。
//   自动检测isChineseBrand并返回，贯通到深度分析和估值系统
//
// 🔧 Round6 更新（2026-07-06）保留：
//   1. 豆包（火山引擎ARK）为唯一模型
//   2. 支持 imageUrls（HTTP URL）输入格式
// ───────────────────────────────────────────────

import { NextRequest, NextResponse } from "next/server";
// 图片下载统一走 @/lib/ai/multimodal（内部已接出网守卫），不再本地重复实现一份
import { downloadImageAsBase64 } from "@/lib/ai/multimodal";
import { parseLocationText, buildLocationText } from "@/lib/location-parser";
import { findCountryInText } from "@/lib/location-data";
import { resolveBrand } from "@/lib/agents/seller-helper/resolve-brand";
import { resolveCategory, getCategorySynonymPrompt } from "@/lib/agents/seller-helper/resolve-category";
import { prisma } from "@/lib/db";
import { getUserFromRequest } from "@/lib/auth";
import { computeAiCost, deductCredits, type AiCostBreakdown } from "@/lib/credits/spend";
import { recordUsage, drainUsage, ESTIMATED_TOKENS } from "@/lib/credits/usage-collector";
import { chatCompletionDoubao, getArkModelId } from "@/lib/ai/ark-client";
// 单张图片下载的既有超时（出网守卫内置，20s）。这里只读常量以便按总预算收窄，不改共享库。
import { IMAGE_FETCH_TIMEOUT_MS } from "@/lib/net/ssrf-guard";

/** 从 referer / 路径推断 locale（与 quota guard 的 rechargeUrl 保持一致） */
function getLocaleFromRequest(request: NextRequest): string {
  const referer = request.headers.get("referer") || "";
  const m = referer.match(/\/([a-z]{2})\b/) || referer.match(/\/([a-z]{2})$/);
  if (m && ["zh", "en", "ru", "es", "pt", "fr", "hi", "ar"].includes(m[1])) {
    return m[1];
  }
  return "zh";
}

export const dynamic = "force-dynamic";
export const maxDuration = 90;

/**
 * 本路由的**总预算**（自进入 handler 起算，覆盖 图片下载 + 模型调用 + 聚焦补识别 + 序列化）。
 *
 * 为什么是 75s：`maxDuration = 90` 是平台硬上限，超了就被直接 kill 成一段 504 HTML
 * —— 那一刻 token 已经烧掉，而 `deductCredits` 在成功分支里，永远执行不到，平台自担成本。
 * 留 15s 余量给「收尾 + NextResponse 序列化 + 回传」。
 */
const RECOGNIZE_TOTAL_BUDGET_MS = 75_000;

/**
 * 还愿意再发起一次模型调用（品牌型号聚焦补识别）的最小剩余预算。
 *
 * 低于这个值再开一次请求，几乎必然在返回前被 kill：豆包关掉思考链后首 token 约 2s，
 * 一次有意义的尝试至少要几十秒。宁可少补一次识别，也要保证「有结构化响应 + 能扣到积分」。
 */
const RECOGNIZE_CONTINUE_MIN_REMAINING_MS = 20_000;

/** 单张图片下载可用的最小超时：预算见底时也保底 3s，避免算出 0/负数导致必然失败 */
const RECOGNIZE_MIN_IMAGE_TIMEOUT_MS = 3_000;

/** 一次模型调用可用的最小超时：低于 5s 的调用没有意义，直接当超预算处理 */
const RECOGNIZE_MIN_LLM_TIMEOUT_MS = 5_000;

/** 单次豆包调用的基准超时（与 ark-client.chatCompletionDoubao 的默认 75s 对齐） */
const RECOGNIZE_LLM_TIMEOUT_MS = 75_000;

// 注：`.cn` 侧 nginx proxy_read_timeout 已放宽至 330s（2026-10-28，与 AI 路由 300s 预算对齐），
// 不会再在 180s 处掐断；本文件真正的墙钟约束是上面的平台 `maxDuration = 90`。
//
// ⚠️ 历史教训（本次修复针对的就是它）：原注释写着「90s 内靠 deadline 收敛」，但代码里
// 从来没有一处 `Date.now()` 预算判断，`chatCompletionDoubao` 也未收到 `deadlineMs`。
// 于是最坏墙钟 = 图片下载 20s + 75s + 自动重试 75s = 170s，平台直接 kill → 504 HTML。
// 现在预算闸是**代码里真的执行**的：见 `settleWithin` / `perImageTimeoutMs` / `callDoubao`。

// ── 国内农机品牌关键词（用于自动检测 isChineseBrand） ──
const CHINESE_BRAND_KEYWORDS = [
  "东方红", "一拖", "YT", "DONGFANGHONG",
  "雷沃", "谷神", "LOVOL",
  "沃得", "WODE",
  "福田", "FOTON",
  "久保田", "KUBOTA",  // 国产久保田 vs 进口久保田需结合铭牌语言判断
  "洋马", "YANMAR",
  "井关", "ISHIGAKI",
  "常州", "东风", "DF",
  "时风", "SHIFENG",
  "五征", "WUZHENG",
  "常发", "CHANGFA",
  "星光", "XINGGUANG",
  "中联", "ZOOMLION",
  "牧神", "MUSHEN",
  "春雨", "CHUNYU",
  "大疆", "DJI",
  "极飞", "XAIR",
  "丰疆", "FENGJIANG",
  "博创", "BOCHUANG",
  "华测", "HUACE",
  "拓普", "TUOPU",
];

/**
 * 检测识别结果是否为国内品牌
 * 基于品牌名关键词匹配
 */
function detectChineseBrand(brandName: string): boolean {
  if (!brandName) return false;
  const upper = brandName.toUpperCase();
  return CHINESE_BRAND_KEYWORDS.some((kw) => {
    const kwUpper = kw.toUpperCase();
    return upper.includes(kwUpper) || brandName.includes(kw);
  });
}

// ── 英文品牌名 → 中文品牌名映射（国内品牌识别为英文时自动转换） ──
const EN_TO_CN_BRAND: Record<string, string> = {
  "DONGFANGHONG": "东方红",
  "DONGFANG HONG": "东方红",
  "LOVOL": "雷沃",
  "FOTON": "福田",
  "WUZHENG": "五征",
  "CHANGFA": "常发",
  "CHANGDONG": "常州东风",
  "SHIFENG": "时风",
  "WODE": "沃得",
  "ZOOMLION": "中联重科",
  "YANMAR": "洋马",
  "KUBOTA": "久保田",
};

/**
 * 将国内品牌的英文名映射为中文名
 * 仅在 isChineseBrand === true 时调用
 * 支持精确匹配和包含匹配
 */
function mapEnBrandToCn(brand: string): string {
  if (!brand) return brand;
  const upper = brand.toUpperCase().trim();
  // 精确匹配
  if (EN_TO_CN_BRAND[upper]) return EN_TO_CN_BRAND[upper];
  // 包含匹配（如 "LOVOL Agricultural" → "雷沃"）
  for (const [en, cn] of Object.entries(EN_TO_CN_BRAND)) {
    if (upper.includes(en)) return cn;
  }
  return brand;
}

// ── 港口归一化：英文/中文 → 表单下拉标准中文港口 ──
// 表单发货港口下拉选项为中文（青岛/上海/天津/广州/连云港/宁波/其他），
// 而 AI 可能返回英文（Qingdao/Shanghai）或其他写法，这里统一归一化。
const PORT_ZH_MAP: Record<string, string> = {
  qingdao: "青岛",
  shanghai: "上海",
  tianjin: "天津",
  guangzhou: "广州",
  lianyungang: "连云港",
  ningbo: "宁波",
  dalian: "大连",
  xiamen: "厦门",
  shenzhen: "深圳",
  qinzhou: "钦州",
  zhoushan: "舟山",
  yantai: "烟台",
};
const STANDARD_PORT_ZH = new Set([
  "青岛", "上海", "天津", "广州", "连云港", "宁波", "其他",
]);

/**
 * 将 AI 返回的港口值归一化为表单下拉标准中文港口名
 * - 已是中文标准港口 → 原样返回
 * - 英文港口名 → 映射为中文
 * - 文本中包含中文港口名 → 提取
 * - 无法识别 → 返回默认 "天津"
 */
function normalizePort(raw: unknown): string {
  if (!raw) return "天津";
  const s = String(raw).trim();
  if (!s) return "天津";
  if (STANDARD_PORT_ZH.has(s)) return s;
  const mapped = PORT_ZH_MAP[s.toLowerCase()];
  if (mapped && STANDARD_PORT_ZH.has(mapped)) return mapped;
  for (const zh of STANDARD_PORT_ZH) {
    if (s.includes(zh)) return zh;
  }
  // 含英文港口名
  for (const [en, zh] of Object.entries(PORT_ZH_MAP)) {
    if (s.toLowerCase().includes(en)) return zh;
  }
  return "天津";
}

/**
 * 将 AI 返回的参考价格归一化为数字（人民币元）
 * - 去除货币符号、千分位、单位文字
 * - 无法解析返回 null
 */
function normalizeReferencePrice(raw: unknown): number | null {
  if (raw == null) return null;
  if (typeof raw === "number" && Number.isFinite(raw)) return raw;
  const s = String(raw).trim();
  if (!s) return null;
  // 去除非数字非小数点字符（保留数字和小数点）
  const cleaned = s.replace(/[^\d.]/g, "");
  if (!cleaned) return null;
  const num = Number(cleaned);
  return Number.isFinite(num) ? num : null;
}

/**
 * 将 AI 返回的 location（文本或对象）解析为结构化 country/province/city
 * - 文本：交给 parseLocationText（已内置中国省份/城市 + 国际国家匹配）
 * - 对象：直接取字段，并把国家名转换为 ISO code
 */
function parseAiLocation(raw: unknown): {
  country: string | null;
  province: string | null;
  city: string | null;
  text: string | null;
} {
  if (!raw) return { country: null, province: null, city: null, text: null };

  if (typeof raw === "string") {
    const trimmed = raw.trim();
    if (!trimmed) return { country: null, province: null, city: null, text: null };
    const parsed = parseLocationText(trimmed);
    return {
      country: parsed.country,
      province: parsed.province,
      city: parsed.city,
      text: trimmed,
    };
  }

  if (typeof raw === "object") {
    const obj = raw as Record<string, unknown>;
    let country = obj.country ? String(obj.country) : null;
    const province = obj.province ? String(obj.province) : null;
    const city = obj.city ? String(obj.city) : null;
    // 国家名 → ISO code
    if (country) {
      const c = findCountryInText(country);
      if (c) country = c.code;
    }
    const text = buildLocationText(country, province, city) || null;
    return { country, province, city, text };
  }

  return { country: null, province: null, city: null, text: null };
}

// ── 国内农机识别 Prompt（中文铭牌、中文品牌名、补贴参考价） ──
const DOMESTIC_PROMPT = `你是一位资深中国农业机械专家，熟悉东方红、雷沃、沃得、福田、久保田（国产）、洋马、井关、时风、五征、常发、星光、中联重科、牧神、春雨、大疆农业、极飞等国内主流品牌的拖拉机、收割机、插秧机、播种机、植保机等各类农机设备。

请根据提供的农机图片（整机全貌、铭牌、驾驶室、轮胎/底盘），**仔细识别每一个字段**，以 JSON 格式返回。

⚠️ 重要要求：
- 品牌名可以返回中文或拼音（如"东方红"、"雷沃"、"沃得"），系统会自动匹配
- 型号字段保留铭牌上的原始写法（如"LX1504"、"M1804"、"4LZ-8"）
- 必须尝试识别并填写 ALL 以下 21 个字段，不要遗漏
- 即使某个字段在图片上不完全清晰，也要根据可见线索给出最可能的推断值
- 只有在完全没有任何线索时才设为 null

返回字段说明：
{
  "brand": "品牌名（中文优先，如 东方红、雷沃、沃得、福田）— 这是最关键字段，必须从铭牌或整机外观识别并填写，不允许为空",
  "modelName": "型号（如 LX1504, M1804, 4LZ-8, 2Z-6）— 这是最关键字段，必须从铭牌读取并填写；如果铭牌不清晰，根据品牌和外观推断最可能型号，不允许为空",
  "year": 年份数字（如 2020, 2018）— 铭牌或注册信息",
  "enginePower": "发动机额定马力(HP)，如 \"150\" — 铭牌常见字段",
  "engineType": "发动机类型（Diesel Engine / Gasoline / Other）",
  "driveSystem": "驱动方式（2WD / 4WD / Full Hydraulic）— 从轮胎布局判断",
  "overallLength": "整机总长(mm)",
  "overallWidth": "整机总宽(mm)",
  "overallHeight": "整机总高(mm)",
  "netWeight": "整机净重(kg)",
  "mainConfig": "主要配置（如 割幅宽度、旋耕幅宽、插秧行数、药箱容量等）",
  "workingHours": "工作小时数 — 仪表盘或卖家描述",
  "condition": "成色（excellent / good / fair / poor）",
  "priceMode": "价格模式（fob / por）— 默认 por",
  "tradeTerm": "贸易条款（FOB / CIF / CFR / EXW）— 默认 EXW",
  "tradePort": "发货港口（青岛/上海/天津/广州/连云港/宁波）— 根据产地省份推断最近港口，默认 天津",
  "category": "农机品类名称（如 拖拉机/收割机/打捆机/插秧机/播种机/植保机/青储机/旋耕机/微耕机）— 从整机外观判断，中文",
  "location": "产地位置文本（国内格式：省份+城市，如 \"山东潍坊\"、\"河北石家庄\"、\"河南洛阳\"、\"黑龙江佳木斯\"）— 从铭牌注册地或卖家信息判断",
  "referencePrice": "参考价格（人民币元，纯数字，如 158000）— 根据品牌/型号/年份/成色估算的二手市场参考价，仅作参考用",
  "isChineseBrand": true,  // 国内农机固定为true
  "confidence": 0-1 之间的置信度分数
}

识别要点（按优先级排序）：
1. 🔍 铭牌照片是金标准 → 品牌/型号/年份/马力几乎都在铭牌上
2. 📐 整机全貌 → 驱动方式(看轮胎数量)、尺寸估算
3. ⚙️ 发动机舱 → 发动机类型、马力标签
4. 🛞 轮胎/底盘 → 驱动方式确认
5. 🎛️ 仪表盘 → 工作小时数
6. 📎 附件照片 → 主要配置
7. 🎨 漆面+锈蚀+轮胎磨损 → 成色判断
8. 只返回 JSON，不要任何其他文字`;

// ── 国际农机识别 Prompt（英文铭牌、国际品牌名、FOB定价） ──
const INTERNATIONAL_PROMPT = `你是一位资深二手农业机械专家，熟悉 CLAAS、John Deere, New Holland、Krone、Orkel、Case IH、Massey Ferguson、Kubota 等主流国际品牌的收获机、割台、打捆机。
请根据提供的农机图片（整机全貌、铭牌、驾驶室、轮胎/底盘），**仔细识别每一个字段**，以 JSON 格式返回。

⚠️ 重要要求：
- 必须尝试识别并填写 ALL 以下 20+1 个字段，不要遗漏任何一个！
- 即使某个字段在图片上不完全清晰，也要根据可见线索给出最可能的推断值
- 只有在完全没有任何线索时才设为 null
- 图片中通常包含的信息：铭牌（品牌/型号/年份/马力）、外观（成色/尺寸/重量）、配置（驱动方式/发动机类型/主要配置）

返回字段说明：
{
  "brand": "品牌英文名（如 John Deere, CLAAS, New Holland, Krone）— 这是最关键字段，必须从铭牌或整机外观识别并填写，不允许为空",
  "modelName": "型号（如 6603, JAGUAR 970, FR9040, 5300RC）— 这是最关键字段，必须从铭牌读取并填写；如果铭牌不清晰，根据品牌和外观推断最可能型号，不允许为空",
  "year": 年份数字（如 2018, 2014）— 铭牌或注册信息，必填",
  "enginePower": "发动机额定马力(HP)，如 \"480\" — 铭牌常见字段",
  "engineType": "发动机类型（Diesel Engine / Gasoline / Other）— 根据机型推断",
  "driveSystem": "驱动方式（2WD / 4WD / Full Hydraulic）— 从轮胎布局判断",
  "overallLength": "整机总长(mm)，如 \"8900\" — 从整机全貌估算",
  "overallWidth": "整机总宽(mm)，如 \"2990\" — 从整机全貌估算",
  "overallHeight": "整机总高(mm)，如 \"3490\" — 从整车高度估算",
  "netWeight": "整机净重(kg)，如 \"12500\" — 该级别农机的典型重量",
  "mainConfig": "主要配置（如 割台型号、导航系统、打捆机构型、轮胎规格等）— 从附件照片识别",
  "workingHours": "工作小时数 — 仪表盘或卖家描述中可能提到",
  "condition": "成色（excellent / good / fair / poor）— 从漆面磨损/锈蚀/轮胎状态综合判断",
  "priceMode": "价格模式（fob / por）— 默认 fob",
  "tradeTerm": "贸易条款（FOB / CIF / CFR / EXW）— 默认 FOB",
  "tradePort": "发货港口（青岛/上海/天津/广州/连云港/宁波）— 默认 天津",
  "category": "农机品类名称（如 收割机/割草机/打捆机/搂草机/拖拉机/青储机/播种机）— 从整机外观判断，用中文",
  "location": "产地位置文本（国际格式：国家名，如 \"德国\"、\"Germany\"、\"美国\"、\"USA\"、\"日本\"；如能从铭牌识别到原产国）",
  "referencePrice": "参考价格（人民币元，纯数字，如 880000）— 国际二手农机到中国市场的参考价，仅作参考用",
  "confidence": 0-1 之间的置信度分数（基于图片质量和识别确定性）
}

识别要点（按优先级排序）：
1. 🔍 铭牌照片是金标准 → 品牌/型号/年份/马力几乎都在铭牌上
2. 📐 整机全貌 → 驱动方式(看轮胎数量)、尺寸估算(长宽高)、大致重量级
3. ⚙️ 发动机舱 → 发动机类型(Diesel居多)、马力标签
4. 🛞 轮胎/底盘 → 驱动方式确认(2WD=两轮/4WD=四轮)
5. 🎛️ 仪表盘 → 工作小时数有时会显示
6. 📎 附件照片(割台/打捆机) → 主要配置
7. 🎨 漆面+锈蚀+轮胎磨损 → 成色判断
8. 只返回 JSON，不要任何其他文字
9. 品牌名用英文标准名，如果看到中文品牌名则翻译为英文
10. isChineseBrand 固定为 false`;

/** `settleWithin` 的返回联合类型：值 / 异常 / 到点放弃，三态显式化，调用方不会误吞错误 */
type Settled<T> =
  | { kind: "value"; value: T }
  | { kind: "error"; error: unknown }
  | { kind: "timeout" };

/**
 * 在 `timeoutMs` 内等待 `task`；到点就返回 `{ kind: "timeout" }`，不再等它。
 *
 * 为什么不直接给 fetch 传 signal：单跳超时控制在出网守卫
 * （`@/lib/net/ssrf-guard` 的 `IMAGE_FETCH_TIMEOUT_MS = 20s`）里，本路由**不改共享库**，
 * 只保证本请求的墙钟不被下载阶段拖过总预算。
 * 放弃等待后底层请求仍会按自己的 20s 超时收尾，它的失败已被这里的 `then(onRejected)`
 * 接住 ⇒ 不产生 unhandled rejection。
 */
function settleWithin<T>(task: Promise<T>, timeoutMs: number): Promise<Settled<T>> {
  return new Promise<Settled<T>>((resolve) => {
    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      resolve({ kind: "timeout" });
    }, Math.max(0, timeoutMs));
    task.then(
      (value) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve({ kind: "value", value });
      },
      (error) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve({ kind: "error", error });
      }
    );
  });
}

/**
 * 统一「无法识别，请手动填写」出口（503）。
 * 结构与既有前端契约完全一致：success/code="MANUAL_FALLBACK"/retryable/debug 都不变，
 * 只是把原先内联的同一段 JSON 抽出来，让「超预算」与「全模型失败」走同一个出口。
 */
function manualFallbackResponse(errors: string[]): NextResponse {
  return NextResponse.json(
    {
      success: false,
      error: "AI识别服务暂时不可用，请直接在下方填写产品参数后发布（不影响使用）",
      code: "MANUAL_FALLBACK",
      retryable: true,
      debug: errors.length > 0 ? errors : ["未知错误"],
    },
    { status: 503 }
  );
}

// ── 构建豆包(ARK)格式的消息内容（OpenAI兼容）──
// 注意：豆包服务端下载公开图片 URL 会超时失败
// （InvalidParameter: Timeout while downloading url），
// 因此公开 URL 一律在服务端先下载并转成 base64 data URI 再传入。
// 豆包支持 base64 data URI 传图（已实测可用），data: 输入原样透传。
//
// @param deadlineMs 本次请求的总预算截止时刻（毫秒时间戳）。不传则保持原有行为
//   （每张图固定 20s 超时），其他调用方与单测不受影响。
async function buildDoubaoContent(
  images: string[],
  videoUrls: string[] = [],
  prompt: string,
  deadlineMs?: number
): Promise<Array<Record<string, unknown>>> {
  const content: Array<Record<string, unknown>> = [
    { type: "text", text: prompt },
  ];

  /**
   * 单张图本次可用超时：`min(守卫的 20s, max(3s, 剩余预算))`。
   * 预算充足 ⇒ 与原来完全一致（20s）；预算见底 ⇒ 保底 3s，
   * 而不是 0/负数（`AbortSignal.timeout(0)` 级别的值会让所有图"必然失败"）。
   */
  const perImageTimeoutMs = (): number => {
    if (typeof deadlineMs !== "number" || !Number.isFinite(deadlineMs)) {
      return IMAGE_FETCH_TIMEOUT_MS;
    }
    return Math.min(
      IMAGE_FETCH_TIMEOUT_MS,
      Math.max(RECOGNIZE_MIN_IMAGE_TIMEOUT_MS, deadlineMs - Date.now())
    );
  };

  // 并行下载全部图片（原为 for...of 逐张串行 await，3 张图最坏 3x20s=60s，
  // 会把模型的时间预算全部吃光；并行后最坏 20s）。
  // 注意：必须【保持原有顺序】，否则图片次序变化可能影响模型对多图的判断。
  // 单张失败 / 超预算只丢那一张，其余照常送模型（既有降级语义不变）。
  const downloaded = await Promise.all(
    images.map(async (url, idx) => {
      if (url.startsWith("data:")) {
        // data: 本身就是 base64，原样透传
        return { idx, ok: true as const, url };
      }
      // HTTP URL -> 服务端下载转 base64（豆包服务端自行下载会超时）
      const budgetMs = perImageTimeoutMs();
      const outcome = await settleWithin(downloadImageAsBase64(url), budgetMs);
      if (outcome.kind === "value") {
        const { mimeType, data } = outcome.value;
        return { idx, ok: true as const, url: `data:${mimeType};base64,${data}` };
      }
      if (outcome.kind === "timeout") {
        const left = typeof deadlineMs === "number" ? deadlineMs - Date.now() : NaN;
        console.warn(
          `[SellerHelper] 下载图片超预算，跳过 ${url}（已等 ${budgetMs}ms，剩余预算 ${
            Number.isFinite(left) ? left : "?"
          }ms）`
        );
        return { idx, ok: false as const, url };
      }
      const err = outcome.error as { message?: string } | undefined;
      console.warn(`[SellerHelper] 下载图片失败 ${url}:`, err?.message?.substring(0, 80));
      return { idx, ok: false as const, url };
    })
  );
  // 按原顺序回填，只保留成功的
  for (const item of downloaded.sort((a, b) => a.idx - b.idx)) {
    if (item.ok) {
      content.push({
        type: "image_url",
        image_url: { url: item.url },
      });
    }
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

// ── 调用豆包 API（统一出口 chatCompletionDoubao，OpenAI 兼容格式）──
//
// @param deadlineMs 本次请求的总预算截止时刻。传了才能同时做到两件事：
//   ① 单次调用超时收敛到剩余预算内（否则固定 75s 起步）；
//   ② 把 deadline 交给 ark-client，让它在第 2 次尝试前自行判断
//      「剩余 < 15s 就不重试」（否则最坏 75s + 75s = 150s，必被平台 kill）。
async function callDoubao(
  content: Array<Record<string, unknown>>,
  deadlineMs?: number
): Promise<string> {
  const model = getArkModelId();
  const hasDeadline = typeof deadlineMs === "number" && Number.isFinite(deadlineMs);
  const timeoutMs = hasDeadline
    ? Math.min(
        RECOGNIZE_LLM_TIMEOUT_MS,
        Math.max(RECOGNIZE_MIN_LLM_TIMEOUT_MS, (deadlineMs as number) - Date.now())
      )
    : RECOGNIZE_LLM_TIMEOUT_MS;
  console.log(
    `[SellerHelper] 豆包调用: ${model}，图片数: ${content.length - 1}，本次超时: ${timeoutMs}ms`
  );

  const result = await chatCompletionDoubao({
    model,
    maxTokens: 2048, // 21个字段完整JSON需要更大输出空间
    messages: [{ role: "user", content }],
    timeoutMs,
    ...(hasDeadline ? { deadlineMs: deadlineMs as number } : {}),
  });

  // ── 计费归集：HTTP 一成功就记账（token 已被消耗，与后续解析是否成功无关）──
  const doubaoUsage = result?.usage;
  recordUsage(
    model,
    doubaoUsage?.prompt_tokens ?? ESTIMATED_TOKENS.input,
    doubaoUsage?.completion_tokens ?? ESTIMATED_TOKENS.output,
    { estimated: !doubaoUsage }
  );

  return result.text || "";
}

// ── 解析 AI 响应为结构化数据 ──
function parseAIResponse(aiText: string): Record<string, any> {
  let recognized: Record<string, any> = {};
  try {
    recognized = JSON.parse(aiText);
  } catch (e) {
    const jsonMatch = aiText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        recognized = JSON.parse(jsonMatch[0]);
      } catch {
        recognized = { error: "无法解析 AI 响应" };
      }
    } else {
      recognized = { error: "无法解析 AI 响应" };
    }
  }
  // 中文字段名 → 英文字段名映射（兼容多模态模型返回中文键的情况）
  const fieldMap: Record<string, string> = {
    "品牌": "brand",
    "型号": "modelName",
    "生产年份": "year",
    "年份": "year",
    "额定马力": "enginePower",
    "马力": "enginePower",
    "发动机功率": "enginePower",
    "功率": "enginePower",
    "发动机类型": "engineType",
    "驱动方式": "driveSystem",
    "驱动": "driveSystem",
    "整机总长": "overallLength",
    "总长": "overallLength",
    "长度": "overallLength",
    "长": "overallLength",
    "整机总宽": "overallWidth",
    "总宽": "overallWidth",
    "宽度": "overallWidth",
    "宽": "overallWidth",
    "整机总高": "overallHeight",
    "总高": "overallHeight",
    "高度": "overallHeight",
    "高": "overallHeight",
    "整机净重": "netWeight",
    "净重": "netWeight",
    "重量": "netWeight",
    "主要配置": "mainConfig",
    "配置": "mainConfig",
    "工作小时": "workingHours",
    "工时": "workingHours",
    "小时数": "workingHours",
    "成色": "condition",
    "状态": "condition",
    "价格模式": "priceMode",
    "贸易条款": "tradeTerm",
    "发货港口": "tradePort",
    "港口": "tradePort",
    "港口城市": "tradePort",
    "品类": "category",
    "类别": "category",
    "机型类别": "category",
    "机器类型": "category",
    "位置": "location",
    "产地": "location",
    "所在地": "location",
    "产地位置": "location",
    "参考价格": "referencePrice",
    "估价": "referencePrice",
    "参考价": "referencePrice",
    "预计价格": "referencePrice",
    "model": "modelName",
    "是否国内品牌": "isChineseBrand",
    "国内品牌": "isChineseBrand",
    "置信度": "confidence",
  };
  const mapped: Record<string, any> = {};
  for (const [key, value] of Object.entries(recognized)) {
    const mappedKey = fieldMap[key] || key;
    mapped[mappedKey] = value;
  }
  return mapped;
}

/**
 * 构建品牌型号聚焦补识别 Prompt
 * 当主识别结果中 brand 或 modelName 缺失时，用此精简 Prompt 再调一次豆包（聚焦补识别）
 * 只要求返回 brand 和 modelName 两个字段，提高聚焦识别成功率
 */
function buildBrandModelFallbackPrompt(isDomestic: boolean): string {
  return isDomestic
    ? `请只识别图片中的两个字段，以 JSON 返回，不要任何其他文字：\n{\n  "brand": "品牌中文名（东方红/雷沃/沃得/福田等）— 必填，从铭牌或外观推断",\n  "modelName": "型号（如 LX1504, M1804, 4LZ-8）— 必填，从铭牌读取或推断"\n}`
    : `Please identify only two fields from the image and return as JSON, no other text:\n{\n  "brand": "Brand English name (John Deere, CLAAS, New Holland, etc.) — required",\n  "modelName": "Model name/number (e.g. 6603, JAGUAR 970, FR9040) — required"\n}`;
}

// ── 构建成功响应 ──
async function buildSuccessResponse(recognized: Record<string, any>) {
  // 自动检测 isChineseBrand：优先用AI返回值，否则用关键词检测
  const detectedChinese = recognized.isChineseBrand !== undefined
    ? Boolean(recognized.isChineseBrand)
    : detectChineseBrand(recognized.brand || "");

  // 品牌名英文→中文映射（仅国内品牌）
  let brand = recognized.brand || null;
  if (brand && detectedChinese) {
    brand = mapEnBrandToCn(brand);
  }

  // ── 品牌智能匹配 ──
  let brandId: string | null = null;
  try {
    const brandMatch = await resolveBrand(brand);
    if (brandMatch.matched && brandMatch.brandId) {
      brandId = brandMatch.brandId;
      brand = brandMatch.displayName; // 使用 DB 标准名
    }
  } catch (e) {
    console.warn("[SellerHelper] 品牌匹配失败:", e instanceof Error ? e.message : String(e));
  }

  // ── 品类智能匹配 ──
  let categoryId: string | null = null;
  let category = recognized.category || null;
  try {
    const catMatch = await resolveCategory(category);
    if (catMatch.matched && catMatch.categoryId) {
      categoryId = catMatch.categoryId;
      category = catMatch.displayName; // 使用 DB 标准名
    }
  } catch (e) {
    console.warn("[SellerHelper] 品类匹配失败:", e instanceof Error ? e.message : String(e));
  }

  // 港口归一化（英文 → 中文标准港口），识别不到默认"天津"
  const normalizedPort = normalizePort(recognized.tradePort);

  // 产地解析：文本/对象 → 结构化 country/province/city
  const parsedLoc = parseAiLocation(recognized.location);

  // 参考价格归一化（人民币元数字）
  const refPrice = normalizeReferencePrice(recognized.referencePrice);

  return NextResponse.json({
    success: true,
    data: {
      brand,
      brandId, // 品牌 DB ID（匹配成功 → 前端可直接 select）
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
      tradePort: normalizedPort,
      // ── 新增字段 ──
      category: category, // 用品牌匹配后的标准名
      categoryId, // 品类 DB ID（匹配成功 → 前端可直接 select）
      location: parsedLoc.text,
      country: parsedLoc.country,
      province: parsedLoc.province,
      city: parsedLoc.city,
      referencePrice: refPrice,
      // ── 既有字段 ──
      isChineseBrand: detectedChinese,
      confidence: recognized.confidence || 0.5,
    },
  });
}

// ── 从DB加载品牌/品类引用列表，注入Prompt ──
let cachedBrandPrompt: string | null = null;
let cachedCategoryPrompt: string | null = null;
let lastBrandRefresh = 0;

async function getBrandPromptFragment(): Promise<string> {
  if (cachedBrandPrompt && Date.now() - lastBrandRefresh < 300000) return cachedBrandPrompt;
  try {
    const brands = await prisma.brand.findMany({
      select: { nameZh: true, nameEn: true },
      take: 50,
    });
    cachedBrandPrompt = brands.map((b) => `"${b.nameZh}" / "${b.nameEn}"`).join("、");
    lastBrandRefresh = Date.now();
  } catch {
    cachedBrandPrompt = cachedBrandPrompt || "";
  }
  return cachedBrandPrompt ? `\n\n📋 本站已知品牌列表（请优先输出以下标准品牌名）：\n${cachedBrandPrompt}\n` : "";
}

async function getCategoryPromptFragment(): Promise<string> {
  if (cachedCategoryPrompt && Date.now() - lastBrandRefresh < 300000) return cachedCategoryPrompt;
  try {
    const cats = await prisma.category.findMany({
      select: { nameZh: true },
      take: 50,
    });
    cachedCategoryPrompt = cats.map((c) => `"${c.nameZh}"`).join("、");
  } catch {
    cachedCategoryPrompt = cachedCategoryPrompt || "";
  }
  return cachedCategoryPrompt ? `\n\n📋 本站已知品类列表（请优先输出以下标准品类名）：\n${cachedCategoryPrompt}\n` : "";
}

export async function POST(request: NextRequest) {
  // ── 总预算起点与截止时刻 ──
  // 从 handler 入口就开始计时（含 request.json()、图片下载、模型调用、聚焦补识别），
  // 而不是只给模型调用单独计时 —— 因为把请求推到平台 maxDuration 之上的是**总和**。
  const requestStartedAt = Date.now();
  const requestDeadline = requestStartedAt + RECOGNIZE_TOTAL_BUDGET_MS;
  /** 剩余预算（毫秒，可能为负） */
  const remainingBudgetMs = (): number => requestDeadline - Date.now();

  // ── 计费归集收口标志：本请求的 usage 是否已被「计费点」消费（drain）过 ──
  // 详见文件末尾 finally 里的论证。
  let usageConsumed = false;
  try {
    // ── 登录校验（强制）：AI 智能识别按真实 token 计费，必须知道扣谁的积分 ──
    // 游客没有 userId → 无法扣费 → 直接 401，由前端（公开估值页等）引导登录。
    // 注：本 return 位于 try 内，退出前必经 finally 的 drainUsage() 兜底，
    // 因此 401 分支不会把 usage 残留串到下一个请求。
    const locale = getLocaleFromRequest(request);
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json(
        {
          success: false,
          error: "请先登录后再使用 AI 智能识别",
          code: "LOGIN_REQUIRED",
          loginUrl: `/${locale}/auth/login`,
        },
        { status: 401 }
      );
    }

    const body = await request.json();
    const imageUrls: string[] = body.imageUrls || [];
    const imageDataUris: string[] = body.imageDataUris || [];
    const videoUrls: string[] = body.videoUrls || [];
    const forceChineseBrand = body.isChineseBrand as boolean | undefined;
    const images = [...imageUrls, ...imageDataUris];

    if (!images || !Array.isArray(images) || images.length === 0) {
      return NextResponse.json(
        { success: false, error: "需要至少一张图片", code: "NO_IMAGES" },
        { status: 400 }
      );
    }

    // 双引擎Prompt选择：前端可强制指定，否则使用默认（先走国际，识别后自动检测）
    const useDomestic = forceChineseBrand === true;
    const basePrompt = useDomestic ? DOMESTIC_PROMPT : INTERNATIONAL_PROMPT;
    const [brandRef, catRef] = await Promise.all([
      getBrandPromptFragment(),
      getCategoryPromptFragment(),
    ]);
    const activePrompt = basePrompt + brandRef + catRef;
    console.log(`[SellerHelper] 引擎模式: ${useDomestic ? "国内(DOMESTIC)" : "国际(INTERNATIONAL)"}, Prompt长度(含参考): ${activePrompt.length}`);

    let lastError: Error | null = null;
    const errors: string[] = [];
    let finalRecognized: Record<string, any> | null = null;

    // ── 预算闸①：进模型调用前先看还剩多少 ──
    // 正常情况这里剩余接近 75s（只是读 body + 查品牌/品类片段）。真的不够 5s 说明前面
    // 已经花了 70s+（例如 DB 抖动），此时再发模型请求必然被 kill ⇒ 直接走结构化 503。
    if (remainingBudgetMs() < RECOGNIZE_MIN_LLM_TIMEOUT_MS) {
      const left = remainingBudgetMs();
      console.warn(`[SellerHelper] 剩余预算 ${left}ms 不足一次模型调用，提前返回 MANUAL_FALLBACK`);
      errors.push(
        `[预算] 剩余预算 ${left}ms < ${RECOGNIZE_MIN_LLM_TIMEOUT_MS}ms，未发起模型调用（总预算 ${RECOGNIZE_TOTAL_BUDGET_MS}ms）`
      );
      return manualFallbackResponse(errors);
    }

    // 全站统一豆包（火山方舟 ARK）：.cn 直连国行、.com 经 B 通道代理（见 ark-client.ts）。
    // 数据不出境红线：豆包为境内服务，.cn 数据不经境外。
    try {
      // 图片下载阶段纳入总预算：每张图超时 = min(20s, max(3s, 剩余预算))
      const content = await buildDoubaoContent(images, videoUrls, activePrompt, requestDeadline);
      const imageParts = content.filter((c) => c.type === "image_url").length;
      if (imageParts === 0) {
        lastError = new Error("豆包无有效图片输入");
        errors.push("[豆包] 无有效图片输入");
      } else {
        console.log(`[SellerHelper] 调用豆包识别（统一出口）`);
        // 模型调用同样纳入总预算：超时 = min(75s, max(5s, 剩余预算))，
        // 并把 deadline 传下去让 ark-client 自己放弃「剩余不足 15s 的重试」。
        const aiText = await callDoubao(content, requestDeadline);
        if (!aiText || aiText.trim().length < 10) {
          lastError = new Error("豆包 返回空响应");
          errors.push("[豆包] 返回空响应");
        } else {
          finalRecognized = parseAIResponse(aiText);
          console.log(`[SellerHelper] 豆包识别成功，置信度: ${finalRecognized.confidence}`);
        }
      }
    } catch (error: any) {
      const statusCode = error?.response?.status;
      const msg = `[豆包] ${error.message || ""}`.substring(0, 120);
      console.warn(`[SellerHelper] ${msg} (HTTP ${statusCode})`);
      lastError = error;
      errors.push(msg);
    }

    // 所有模型均失败
    if (!finalRecognized) {
      console.error("[SellerHelper] 所有模型均失败，最后一个错误:", lastError?.message);
      // 预算耗尽是这条路径上最常见的诱因（超时/放弃重试都表现为「全模型失败」），
      // 单独记一条，便于线上区分「模型真挂了」和「我们没时间了」。
      const elapsed = Date.now() - requestStartedAt;
      if (elapsed >= RECOGNIZE_TOTAL_BUDGET_MS - RECOGNIZE_MIN_LLM_TIMEOUT_MS) {
        errors.push(
          `[预算] 本次识别已耗时 ${elapsed}ms（总预算 ${RECOGNIZE_TOTAL_BUDGET_MS}ms），主动收敛以免被平台 kill 成 504`
        );
      }
      return manualFallbackResponse(errors);
    }

    // 关键字段（brand/modelName）缺失时，用豆包做一次聚焦补识别（仍是同一境内模型，无出境风险）
    // 预算闸②：剩余预算不足 RECOGNIZE_CONTINUE_MIN_REMAINING_MS(20s) 就**不**再开第二次调用
    // —— 开了也是 token 已烧、响应没有、积分扣不到，比少补一次识别糟糕得多。
    if (!finalRecognized.brand || !finalRecognized.modelName) {
      const leftBeforeFallback = remainingBudgetMs();
      if (leftBeforeFallback < RECOGNIZE_CONTINUE_MIN_REMAINING_MS) {
        console.warn(
          `[SellerHelper] 剩余预算 ${leftBeforeFallback}ms < ${RECOGNIZE_CONTINUE_MIN_REMAINING_MS}ms，跳过品牌型号补识别`
        );
      } else {
        try {
          console.log("[SellerHelper] 关键字段缺失，启动豆包聚焦补识别...");
          const fallbackPrompt = buildBrandModelFallbackPrompt(useDomestic);
          const fallbackContent = await buildDoubaoContent(images, [], fallbackPrompt, requestDeadline);
          const fallbackText = await callDoubao(fallbackContent, requestDeadline);
          const fallback = parseAIResponse(fallbackText);
          if (!finalRecognized.brand && fallback.brand) {
            finalRecognized.brand = fallback.brand;
            console.log("[SellerHelper] 补识别 brand 成功:", finalRecognized.brand);
          }
          if (!finalRecognized.modelName && fallback.modelName) {
            finalRecognized.modelName = fallback.modelName;
            console.log("[SellerHelper] 补识别 modelName 成功:", finalRecognized.modelName);
          }
        } catch (e: any) {
          console.warn("[SellerHelper] 品牌型号补识别失败:", e?.message?.substring(0, 100));
        }
      }
    }

    // ── 积分扣减（按 LLM token 实际消耗成本乘以运营定价倍率，反算积分）──
    // 用量由豆包（唯一 provider）在拿到 HTTP 响应后经 usage-collector 归集。
    // 只扣一次：把本请求全部记录按模型算成本后求和，再一次 deductCredits。
    // 多图是「一次请求」（buildDoubaoContent 把 N 张图塞进同一个 content 数组），
    // 所以主识别最多 1 份 usage，**绝不按图片数重复计费**；
    // 若走了豆包聚焦补识别，会多 1 份 usage —— 那是同一次请求的第二次真实 LLM 调用，应计。
    const usage = drainUsage();
    usageConsumed = true; // 已消费：finally 不再重复处理
    const perModel: AiCostBreakdown[] = usage.map((u) =>
      computeAiCost({
        model: u.model,
        inputTokens: u.inputTokens,
        outputTokens: u.outputTokens,
        billingCountry: user.country ?? undefined,
      })
    );
    const totalPoints = perModel.reduce((sum, c) => sum + c.points, 0);

    // 前置登录校验（POST 入口）已保证 user 非空；此处再判一次用于类型收窄与纵深防御 ——
    // 正常路径不可达，万一可达也只是退回 401，绝不会出现「user 为 null 还继续扣费」的路径。
    if (!user) {
      return NextResponse.json(
        {
          success: false,
          error: "请先登录后再使用 AI 智能识别",
          code: "LOGIN_REQUIRED",
          loginUrl: `/${locale}/auth/login`,
        },
        { status: 401 }
      );
    }
    const deduction = await deductCredits(
      user.id,
      totalPoints,
      "AI智能识别",
      { models: perModel, totalPoints, usageCount: usage.length } as unknown as Record<string, unknown>
    );
    if (!deduction.ok) {
      return NextResponse.json({
        success: false,
        error: "积分不足，请先充值后再使用 AI 智能识别",
        code: "INSUFFICIENT_CREDITS",
        rechargeUrl: `/${locale}/credits`,
        required: deduction.required,
        balance: deduction.credits,
      }, { status: 402 });
    }

    return await buildSuccessResponse(finalRecognized);

  } catch (error: any) {
    console.error("[SellerHelper] 未处理异常:", error?.message);

    return NextResponse.json({
      success: false,
      error: "AI识别暂时不可用，请手动填写产品信息后发布",
      code: "MANUAL_FALLBACK",
    }, { status: 500 });
  } finally {
    // ── 防串账兜底：usage-collector 是「模块级数组」，不 drain 会串到下一个请求 ──
    // 后果很严重：本请求记录的 usage 会被下一个任意请求（recognize / valuation ...）drain 走，
    // 等于 A 用户消耗的 token 算到 B 用户头上（跨请求串账）。
    //
    // 两条不变量：
    //   ① 不重复扣费：全函数只有上面「计费点」一处 drain 用于计费，且 drain 后立刻置
    //      usageConsumed = true，因此这里不会二次处理它；即便二次调用 drainUsage()，
    //      它「取出即清空」，只会拿到空数组，天然幂等 —— 不存在扣两次的可能。
    //   ② 不漏 drain：所有提前 return（400 无图 / 503 全模型失败）与所有抛异常路径
    //      （模型链内异常、聚焦补识别异常、buildSuccessResponse 异常…）都会经过 finally，
    //      只要 usage 还没被消费，这里一律清掉。
    if (!usageConsumed) {
      drainUsage();
    }
  }
}
