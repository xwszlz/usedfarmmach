// ───────────────────────────────────────────────
// #8 卖家助手 Agent — 图片识别 API（双引擎版）
// 多模态 LLM 识别农机图片 → 品牌/型号/年份/工时/状况
// POST /api/agents/seller-helper/recognize
// Body: { imageUrls?: string[], imageDataUris?: string[], isChineseBrand?: boolean }
//
// 🔧 V2.1 升级（2026-07-12）：
//   双引擎架构 — 国内农机用豆包(中文铭牌强) / 国际农机用Gemini(英文铭牌强)
//   自动检测isChineseBrand并返回，贯通到深度分析和估值系统
//
// 🔧 Round6 更新（2026-07-06）保留：
//   1. 豆包（火山引擎ARK）为第一优先模型（免费+快速）
//   2. 支持 imageUrls（HTTP URL）输入格式
//   3. Gemini 降为第二备用，OpenRouter 保持第三备选
// ───────────────────────────────────────────────

import { NextRequest, NextResponse } from "next/server";
import axios from "axios";
import { parseLocationText, buildLocationText } from "@/lib/location-parser";
import { findCountryInText } from "@/lib/location-data";

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
export const maxDuration = 90; // Vercel PRO 最大 120s，90s 确保 3 张图片下载+识别不超时

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
 * - 无法识别 → 返回默认 "青岛"
 */
function normalizePort(raw: unknown): string {
  if (!raw) return "青岛";
  const s = String(raw).trim();
  if (!s) return "青岛";
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
  return "青岛";
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
  "brand": "品牌名（中文或英文均可，如 东方红/雷沃/沃得/福田）— 从铭牌或外观判断，必填",
  "modelName": "型号（如 LX1504, M1804, 4LZ-8, 2Z-6）— 从铭牌读取，必填",
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
  "tradePort": "发货港口（青岛/上海/天津/广州/连云港/宁波）— 根据产地省份推断最近港口，默认 青岛",
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
  "brand": "品牌英文名（如 CLAAS, John Deere, New Holland, Krone, Orkel, 克罗尼）— 从铭牌或外观判断，必填",
  "modelName": "型号（如 JAGUAR 970, FR9040, 5300RC, 600）— 从铭牌读取，必填",
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
  "tradePort": "发货港口（青岛/上海/天津/广州/连云港/宁波）— 默认 青岛",
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

// ── 构建豆包(ARK)格式的消息内容（OpenAI兼容）──
function buildDoubaoContent(images: string[], videoUrls: string[] = [], prompt: string) {
  const content: Array<Record<string, unknown>> = [
    { type: "text", text: prompt },
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
      max_tokens: 2048, // 21个字段完整JSON需要更大输出空间
    },
    {
      headers: {
        Authorization: `Bearer ${ARK_API_KEY}`,
        "Content-Type": "application/json",
      },
      timeout: 60000, // 60秒（图片下载~20s + 8张图片处理 + 17字段JSON生成）
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
function buildOpenRouterContent(images: string[], prompt: string) {
  return [
    { type: "text" as const, text: prompt },
    ...images.map((url: string) => ({
      type: "image_url" as const,
      image_url: { url },
    })),
  ];
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

// ── 构建 Gemini 格式的消息内容 ──
async function buildGeminiContent(images: string[], prompt: string) {
  const parts: Array<Record<string, unknown>> = [{ text: prompt }];
  for (const url of images) {
    if (url.startsWith("data:")) {
      const [mimeInfo, base64Data] = url.split(",");
      const mimeType = mimeInfo.replace("data:", "").split(";")[0] || "image/jpeg";
      parts.push({ inline_data: { mime_type: mimeType, data: base64Data } });
    } else {
      // 公开 URL → 下载后转 base64 inline_data（Gemini 不支持 file_url）
      try {
        const { mimeType, data } = await downloadImageAsBase64(url);
        parts.push({ inline_data: { mime_type: mimeType, data } });
      } catch (err: any) {
        console.warn(`[SellerHelper] 下载图片失败 ${url}:`, err.message?.substring(0, 80));
      }
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
      max_tokens: 2048,
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
        max_output_tokens: 2048,
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
      try {
        recognized = JSON.parse(jsonMatch[0]);
      } catch {
        recognized = { error: "无法解析 AI 响应" };
      }
    } else {
      recognized = { error: "无法解析 AI 响应" };
    }
  }
  // 中文字段名 → 英文字段名映射（兼容 Gemini 等模型返回中文键的情况）
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

// ── 构建成功响应 ──
function buildSuccessResponse(recognized: Record<string, any>) {
  // 自动检测 isChineseBrand：优先用AI返回值，否则用关键词检测
  const detectedChinese = recognized.isChineseBrand !== undefined
    ? Boolean(recognized.isChineseBrand)
    : detectChineseBrand(recognized.brand || "");

  // 港口归一化（英文 → 中文标准港口），识别不到默认"青岛"
  const normalizedPort = normalizePort(recognized.tradePort);

  // 产地解析：文本/对象 → 结构化 country/province/city
  const parsedLoc = parseAiLocation(recognized.location);

  // 参考价格归一化（人民币元数字）
  const refPrice = normalizeReferencePrice(recognized.referencePrice);

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
      tradePort: normalizedPort,
      // ── 新增字段 ──
      category: recognized.category || null,
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

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const imageUrls: string[] = body.imageUrls || [];
    const imageDataUris: string[] = body.imageDataUris || [];
    const videoUrls: string[] = body.videoUrls || [];
    const forceChineseBrand = body.isChineseBrand as boolean | undefined;
    const images = [...imageUrls, ...imageDataUris];
    const hasBase64Images = imageDataUris.some((u) => u.startsWith("data:"));

    if (!images || !Array.isArray(images) || images.length === 0) {
      return NextResponse.json(
        { success: false, error: "需要至少一张图片", code: "NO_IMAGES" },
        { status: 400 }
      );
    }

    // 双引擎Prompt选择：前端可强制指定，否则使用默认（先走国际，识别后自动检测）
    const useDomestic = forceChineseBrand === true;
    const activePrompt = useDomestic ? DOMESTIC_PROMPT : INTERNATIONAL_PROMPT;
    console.log(`[SellerHelper] 引擎模式: ${useDomestic ? "国内(DOMESTIC)" : "国际(INTERNATIONAL)"}, Prompt长度: ${activePrompt.length}`);

    let lastError: Error | null = null;
    const errors: string[] = [];

    for (const entry of MODEL_CHAIN) {
      // 检查 API Key 是否可用
      if (entry.provider === "ark" && !ARK_API_KEY) {
        errors.push("[豆包] ARK_API_KEY未配置");
        continue;
      }
      if (entry.provider === "openrouter" && !OPENROUTER_API_KEY) {
        errors.push("[OpenRouter] OPENROUTER_API_KEY未配置");
        continue;
      }
      if (entry.provider === "google" && !GOOGLE_API_KEY) {
        errors.push("[Gemini] GOOGLE_API_KEY未配置");
        continue;
      }

      // 豆包不支持 base64 图片 → 如果只有base64则跳过豆包
      if (entry.provider === "ark" && hasBase64Images) {
        console.log("[SellerHelper] 有base64图片，跳过豆包（不支持base64）");
        errors.push("[豆包] 跳过base64图片");
        continue;
      }

      console.log(`[SellerHelper] 尝试模型: ${entry.label}`);

      try {
        let aiText: string;

        if (entry.provider === "ark") {
          // 豆包：使用 OpenAI 兼容格式
          const content = buildDoubaoContent(imageUrls, videoUrls, activePrompt);
          if (content.length <= 1) {
            // 只有文字没有有效图片
            lastError = new Error("豆包无有效图片输入");
            errors.push("[豆包] 无有效图片输入");
            continue;
          }
          aiText = await callDoubao(content);
        } else if (entry.provider === "openrouter") {
          const content = buildOpenRouterContent(images, activePrompt);
          aiText = await callOpenRouter(entry.model!, content);
        } else {
          const parts = await buildGeminiContent(images, activePrompt);
          aiText = await callGemini(entry.model!, parts);
        }

        if (!aiText || aiText.trim().length < 10) {
          console.warn(`[SellerHelper] ${entry.label} 返回空响应，尝试下一个`);
          lastError = new Error(`${entry.label} 返回空响应`);
          errors.push(`[${entry.label}] 返回空响应`);
          continue;
        }

        const recognized = parseAIResponse(aiText);
        console.log(`[SellerHelper] ${entry.label} 识别成功，置信度: ${recognized.confidence}`);
        return buildSuccessResponse(recognized);

      } catch (error: any) {
        const statusCode = error?.response?.status;
        const msg = `[${entry.label}] ${error.message || ""}`.substring(0, 120);
        console.warn(`[SellerHelper] ${msg} (HTTP ${statusCode})`);
        lastError = error;
        errors.push(msg);

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
      debug: errors.length > 0 ? errors : ["未知错误"],
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
