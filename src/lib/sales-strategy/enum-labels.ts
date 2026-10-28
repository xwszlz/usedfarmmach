/**
 * 销售策略 · 枚举显示层字典（前端 i18n 唯一入口）
 * ─────────────────────────────────────────────────────────
 * 为什么需要这个文件：
 *   AI 销售策略的 JSON 里有若干字段是**系统枚举**（市场轴位 `axis`、价格口径 `basisType`、
 *   紧迫度 `urgency`、准入灯色、渠道角色 `role`、否决分级 `level`）。这些字面量被
 *   `derive.ts` / `pdf-table.ts` / `export-excel.ts` 三处按**字面量精确匹配**消费，
 *   所以 System Prompt 明令禁止 LLM 翻译它们 —— 一律固定输出中文。
 *
 *   于是出现一个两难：8 语种用户在界面上会看到一列原始中文枚举值。
 *   解法是**只在前端显示层翻译**：后端契约一个字不动，界面按 `locale` 查表出词。
 *
 * 硬约束（改代码前先读）：
 *   ① 本文件是**纯字符串字典**，禁止 import 任何服务端模块。
 *      `import type { AiLocale }` 是 type-only（编译期擦除），不引入运行时依赖，安全；
 *      反面例子：`@/lib/i18n/ai-locale` 的**值**导入会连带 `@/lib/credits/fx`（含 prisma），
 *      一旦变成值导入就会把 prisma 拖进客户端 bundle ⇒ 构建失败。
 *   ② 未知值**原样返回输入**（绝返回空串 / undefined）：宁可显示原始中文，
 *      也不能让表格出现空白单元格（老板视角＝功能坏了）。
 *   ③ 缺语种回落英文；语种归一化接受 `ru-RU` / `zh_CN` 这类带地区后缀的写法。
 *
 * 枚举字面量核准依据（**以代码为准，勿凭记忆改**）：
 *   - `strategy-schema.ts` §2：`MarketAxis` / `PriceBasisType` / `Urgency` /
 *     `DealerRole` / `RejectLevel` / `ComplianceOwner` / `ComplianceStatus` …
 *   - `prompt.ts` 的 System Prompt JSON 样例 + 硬性红线 4（L1/L2/L3 措辞三档）
 *
 * ⚠️ 真实字段名/枚举值与「排查报告口述版」有几处出入，已按代码校正：
 *   - `tldr[]` 是 `{ equipment, bestChannel, expectedPriceCny, why }`
 *     （**不是** `{ model, bestDestination, priceText, reason }`）
 *   - `keyInsight` 是 `{ headline, body, contrastWithPrior? }`（**不是** `detail`）
 *   - `Urgency` 是三值 `立刻 | 本周 | 出口前`（**没有** `本月`；为兼容模型偶发写法仍保留词条）
 *   - `PriceBasisType` 五值，`未找到` 是"查了没有"的占位符（`NOT_FOUND` 常量），
 *     不是口径枚举，但模型偶尔会写进 `basisType`，故一并入表
 *   - 准入红绿灯是 `accessTrafficLight: { friendly, needPermit, forbidden }` 三个**键**，
 *     不是 `green/yellow/red` 三个值；两种写法都入表（兼容 + 供颜色映射复用）
 */
import type { AiLocale } from "@/lib/i18n/ai-locale";

// ═══════════════════════════════════════════════════════════
// 1. 枚举类型（与 strategy-schema.ts 逐字一致）
// ═══════════════════════════════════════════════════════════

/** 市场轴位：后端固定输出中文枚举，前端翻译显示 */
export type MarketAnchorAxisLabel = "国内" | "欧洲" | "中亚" | "非洲中东澳新" | "新机对标";

/**
 * 价格口径。
 *
 * `未找到` 严格来说不是口径（是 `NOT_FOUND` 占位符），但模型会写进 `basisType`，
 * 入表后至少能翻译，不会漏出一格生中文。
 */
export type AnchorBasisLabel =
  | "新机对标"
  | "欧洲二手净价"
  | "FOB建议"
  | "国内二手估"
  | "推算"
  | "未找到";

/**
 * 紧迫度。
 *
 * 契约是三值 `立刻 | 本周 | 出口前`；`本月` 为历史/模型偶发写法，保留词条兜底
 * （未知值本来也会原样返回，这里额外给译名，体验更好）。
 */
export type UrgencyLabel = "立刻" | "本周" | "出口前" | "本月";

/** 准入灯色：既接受 schema 的键名，也接受颜色别名 */
export type TrafficLight = "friendly" | "needPermit" | "forbidden" | "green" | "yellow" | "red";

/** 渠道角色（`DealerRole`，8 值） */
export type DealerRoleLabel =
  | "原厂"
  | "进口商"
  | "授权经销"
  | "二手商"
  | "拍卖行"
  | "物流"
  | "政府"
  | "终端";

/** 否决措辞强度（`RejectLevel`，3 值） */
export type RejectLevelLabel = "L1" | "L2" | "L3";

// ═══════════════════════════════════════════════════════════
// 2. 语种归一化（不依赖任何服务端模块，本地白名单）
// ═══════════════════════════════════════════════════════════

/** 受支持的 AI 输出语种（与 `siteConfigMap.com.locales` 一致） */
const AI_LOCALE_LIST: readonly string[] = ["zh", "en", "ru", "es", "pt", "ar", "fr", "hi"];

/** 兜底语种：字典缺失时一律回落英文（英文词条是全表最完整的一列） */
const FALLBACK_LOCALE: AiLocale = "en";

/**
 * 把任意 locale 字符串归一化为 `AiLocale`。
 *
 * 接受 `zh-CN` / `en_US` / ` RU ` 这类带地区后缀或空白的写法；不合法值回落 `en`。
 */
function normalizeLocale(locale: AiLocale | string | null | undefined): AiLocale {
  if (typeof locale !== "string") return FALLBACK_LOCALE;
  const primary = locale.trim().toLowerCase().split(/[-_]/)[0];
  if (!primary) return FALLBACK_LOCALE;
  return AI_LOCALE_LIST.indexOf(primary) >= 0 ? (primary as AiLocale) : FALLBACK_LOCALE;
}

/**
 * 查表：`table[locale][value]`。
 *
 * 未命中时**原样返回 `value`**（见文件头硬约束 ②）：显示原始中文 >>> 显示空白。
 * 同时把命中结果做一次去空白校验，防止字典里误写空串导致整格空白。
 */
function lookupLabel<K extends string>(
  table: Readonly<Record<AiLocale, Readonly<Record<K, string>>>>,
  value: string,
  locale: AiLocale | string | null | undefined
): string {
  const raw = typeof value === "string" ? value : "";
  const key = raw.trim();
  if (!key) return raw;
  // 双转型：`Record<K, string>`（K 为具体字面量联合）没有字符串索引签名，
  // 但这里要按运行时任意值查表，且已确认 key 来自字节串，安全。
  const row = table[normalizeLocale(locale)] as unknown as Record<string, string | undefined>;
  const hit = row[key];
  return typeof hit === "string" && hit.trim().length > 0 ? hit : raw;
}

// ═══════════════════════════════════════════════════════════
// 3. 字典本体（8 语种 × 6 张表；Record<AiLocale, …> 强制编译期补齐语种）
// ═══════════════════════════════════════════════════════════

/** 市场轴位（`MarketAxis`，5 值） */
const AXIS_LABELS: Readonly<Record<AiLocale, Readonly<Record<MarketAnchorAxisLabel, string>>>> = {
  zh: {
    国内: "国内",
    欧洲: "欧洲",
    中亚: "中亚",
    非洲中东澳新: "非洲/中东/澳新",
    新机对标: "新机对标",
  },
  en: {
    国内: "Domestic (China)",
    欧洲: "Europe",
    中亚: "Central Asia",
    非洲中东澳新: "Africa / Middle East / Oceania",
    新机对标: "New-machine benchmark",
  },
  ru: {
    国内: "Внутренний рынок (Китай)",
    欧洲: "Европа",
    中亚: "Центральная Азия",
    非洲中东澳新: "Африка / Ближний Восток / Океания",
    新机对标: "Ориентир по новой технике",
  },
  es: {
    国内: "Mercado nacional (China)",
    欧洲: "Europa",
    中亚: "Asia Central",
    非洲中东澳新: "África / Oriente Medio / Oceanía",
    新机对标: "Referencia de máquina nueva",
  },
  pt: {
    国内: "Mercado interno (China)",
    欧洲: "Europa",
    中亚: "Ásia Central",
    非洲中东澳新: "África / Oriente Médio / Oceania",
    新机对标: "Referência de máquina nova",
  },
  ar: {
    国内: "السوق المحلي (الصين)",
    欧洲: "أوروبا",
    中亚: "آسيا الوسطى",
    非洲中东澳新: "أفريقيا / الشرق الأوسط / أوقيانوسيا",
    新机对标: "مرجع الماكينة الجديدة",
  },
  fr: {
    国内: "Marché intérieur (Chine)",
    欧洲: "Europe",
    中亚: "Asie centrale",
    非洲中东澳新: "Afrique / Moyen-Orient / Océanie",
    新机对标: "Référence machine neuve",
  },
  hi: {
    国内: "घरेलू बाज़ार (चीन)",
    欧洲: "यूरोप",
    中亚: "मध्य एशिया",
    非洲中东澳新: "अफ़्रीका / मध्य-पूर्व / ओशिनिया",
    新机对标: "नई मशीन बेंचमार्क",
  },
};

/** 价格口径（`PriceBasisType` 5 值 + `未找到` 占位符） */
const BASIS_LABELS: Readonly<Record<AiLocale, Readonly<Record<AnchorBasisLabel, string>>>> = {
  zh: {
    新机对标: "新机对标",
    欧洲二手净价: "欧洲二手净价",
    FOB建议: "FOB 建议价",
    国内二手估: "国内二手估价",
    推算: "推算",
    未找到: "未找到",
  },
  en: {
    新机对标: "New-machine benchmark",
    欧洲二手净价: "Europe used net price",
    FOB建议: "FOB suggested",
    国内二手估: "Domestic used estimate",
    推算: "Derived (calculated)",
    未找到: "Not found",
  },
  ru: {
    新机对标: "Ориентир по новой технике",
    欧洲二手净价: "Цена нетто б/у в Европе",
    FOB建议: "Рекомендованная цена FOB",
    国内二手估: "Оценка б/у внутри страны",
    推算: "Расчётная величина",
    未找到: "Не найдено",
  },
  es: {
    新机对标: "Referencia de máquina nueva",
    欧洲二手净价: "Precio neto de usado en Europa",
    FOB建议: "FOB sugerido",
    国内二手估: "Estimación de usado nacional",
    推算: "Estimado por cálculo",
    未找到: "No encontrado",
  },
  pt: {
    新机对标: "Referência de máquina nova",
    欧洲二手净价: "Preço líquido de usada na Europa",
    FOB建议: "FOB sugerido",
    国内二手估: "Estimativa de usada doméstica",
    推算: "Estimado por cálculo",
    未找到: "Não encontrado",
  },
  ar: {
    新机对标: "مرجع الماكينة الجديدة",
    欧洲二手净价: "سعر المستعملة الأوروبية الصافي",
    FOB建议: "سعر FOB المقترح",
    国内二手估: "تقدير المستعملة المحلي",
    推算: "قيمة محسوبة",
    未找到: "غير موجود",
  },
  fr: {
    新机对标: "Référence machine neuve",
    欧洲二手净价: "Prix net occasion Europe",
    FOB建议: "FOB conseillé",
    国内二手估: "Estimation occasion domestique",
    推算: "Valeur calculée",
    未找到: "Non trouvé",
  },
  hi: {
    新机对标: "नई मशीन बेंचमार्क",
    欧洲二手净价: "यूरोप में प्रयुक्त नेट मूल्य",
    FOB建议: "सुझाया गया FOB",
    国内二手估: "घरेलू प्रयुक्त अनुमान",
    推算: "गणना से अनुमानित",
    未找到: "नहीं मिला",
  },
};

/** 紧迫度（`Urgency` 3 值 + `本月` 兼容词条） */
const URGENCY_LABELS: Readonly<Record<AiLocale, Readonly<Record<UrgencyLabel, string>>>> = {
  zh: { 立刻: "立刻", 本周: "本周", 出口前: "出口前", 本月: "本月" },
  en: {
    立刻: "Immediately",
    本周: "This week",
    出口前: "Before shipping",
    本月: "This month",
  },
  ru: {
    立刻: "Немедленно",
    本周: "На этой неделе",
    出口前: "До отгрузки",
    本月: "В этом месяце",
  },
  es: {
    立刻: "Inmediato",
    本周: "Esta semana",
    出口前: "Antes del envío",
    本月: "Este mes",
  },
  pt: {
    立刻: "Imediato",
    本周: "Esta semana",
    出口前: "Antes do embarque",
    本月: "Este mês",
  },
  ar: {
    立刻: "فورًا",
    本周: "هذا الأسبوع",
    出口前: "قبل الشحن",
    本月: "هذا الشهر",
  },
  fr: {
    立刻: "Immédiatement",
    本周: "Cette semaine",
    出口前: "Avant expédition",
    本月: "Ce mois-ci",
  },
  hi: {
    立刻: "तुरंत",
    本周: "इस सप्ताह",
    出口前: "शिपिंग से पहले",
    本月: "इस माह",
  },
};

/** 准入灯色（schema 键名 + 颜色别名，两套写法都入表） */
const TRAFFIC_LIGHT_LABELS: Readonly<Record<AiLocale, Readonly<Record<TrafficLight, string>>>> = {
  zh: {
    friendly: "可出口（免许可）",
    needPermit: "需许可/认证",
    forbidden: "禁入",
    green: "绿灯 · 可出口",
    yellow: "黄灯 · 需许可",
    red: "红灯 · 禁入",
  },
  en: {
    friendly: "Open (no permit)",
    needPermit: "Permit / certification required",
    forbidden: "Forbidden",
    green: "Green · open",
    yellow: "Yellow · permit required",
    red: "Red · forbidden",
  },
  ru: {
    friendly: "Открыт (без разрешения)",
    needPermit: "Требуется разрешение или сертификат",
    forbidden: "Запрещено",
    green: "Зелёный · открыт",
    yellow: "Жёлтый · нужно разрешение",
    red: "Красный · запрещено",
  },
  es: {
    friendly: "Abierto (sin permiso)",
    needPermit: "Requiere permiso o certificación",
    forbidden: "Prohibido",
    green: "Verde · abierto",
    yellow: "Amarillo · requiere permiso",
    red: "Rojo · prohibido",
  },
  pt: {
    friendly: "Aberto (sem licença)",
    needPermit: "Requer licença ou certificação",
    forbidden: "Proibido",
    green: "Verde · aberto",
    yellow: "Amarelo · requer licença",
    red: "Vermelho · proibido",
  },
  ar: {
    friendly: "مفتوح (بدون تصريح)",
    needPermit: "يتطلب تصريحًا أو شهادة",
    forbidden: "محظور",
    green: "أخضر · مفتوح",
    yellow: "أصفر · يتطلب تصريحًا",
    red: "أحمر · محظور",
  },
  fr: {
    friendly: "Ouvert (sans permis)",
    needPermit: "Permis ou certification requis",
    forbidden: "Interdit",
    green: "Vert · ouvert",
    yellow: "Jaune · permis requis",
    red: "Rouge · interdit",
  },
  hi: {
    friendly: "खुला (परमिट नहीं)",
    needPermit: "परमिट / प्रमाणन आवश्यक",
    forbidden: "प्रतिबंधित",
    green: "हरा · खुला",
    yellow: "पीला · परमिट आवश्यक",
    red: "लाल · प्रतिबंधित",
  },
};

/** 渠道角色（`DealerRole`，8 值） */
const DEALER_ROLE_LABELS: Readonly<Record<AiLocale, Readonly<Record<DealerRoleLabel, string>>>> = {
  zh: {
    原厂: "原厂",
    进口商: "进口商",
    授权经销: "授权经销",
    二手商: "二手商",
    拍卖行: "拍卖行",
    物流: "物流",
    政府: "政府",
    终端: "终端",
  },
  en: {
    原厂: "OEM / factory",
    进口商: "Importer",
    授权经销: "Authorized dealer",
    二手商: "Used-equipment trader",
    拍卖行: "Auction house",
    物流: "Logistics",
    政府: "Government",
    终端: "End user",
  },
  ru: {
    原厂: "Завод-изготовитель",
    进口商: "Импортёр",
    授权经销: "Официальный дилер",
    二手商: "Дилер б/у техники",
    拍卖行: "Аукционный дом",
    物流: "Логистика",
    政府: "Госорган",
    终端: "Конечный пользователь",
  },
  es: {
    原厂: "Fabricante (OEM)",
    进口商: "Importador",
    授权经销: "Concesionario autorizado",
    二手商: "Comerciante de usados",
    拍卖行: "Casa de subastas",
    物流: "Logística",
    政府: "Gobierno",
    终端: "Usuario final",
  },
  pt: {
    原厂: "Fabricante (OEM)",
    进口商: "Importador",
    授权经销: "Revendedor autorizado",
    二手商: "Comerciante de usados",
    拍卖行: "Leiloeira",
    物流: "Logística",
    政府: "Governo",
    终端: "Usuário final",
  },
  ar: {
    原厂: "المصنّع الأصلي",
    进口商: "مستورد",
    授权经销: "وكيل معتمد",
    二手商: "تاجر معدات مستعملة",
    拍卖行: "دار مزادات",
    物流: "الخدمات اللوجستية",
    政府: "جهة حكومية",
    终端: "المستخدم النهائي",
  },
  fr: {
    原厂: "Constructeur (OEM)",
    进口商: "Importateur",
    授权经销: "Concessionnaire agréé",
    二手商: "Marchand d'occasion",
    拍卖行: "Maison de ventes aux enchères",
    物流: "Logistique",
    政府: "Administration",
    终端: "Utilisateur final",
  },
  hi: {
    原厂: "मूल निर्माता (OEM)",
    进口商: "आयातक",
    授权经销: "अधिकृत डीलर",
    二手商: "पुरानी मशीन का व्यापारी",
    拍卖行: "नीलामी घर",
    物流: "लॉजिस्टिक्स",
    政府: "सरकारी निकाय",
    终端: "अंतिम उपयोगकर्ता",
  },
};

/**
 * 否决分级（`RejectLevel`，3 值）。
 *
 * 保留 `L1/L2/L3` 前缀不翻译 —— 档位编号是跨端（PDF / Excel / 界面）对齐的标识，
 * 后面跟的才是给人看的措辞（措辞口径见 prompt.ts 硬性红线 4）。
 */
const REJECT_LEVEL_LABELS: Readonly<Record<AiLocale, Readonly<Record<RejectLevelLabel, string>>>> = {
  zh: { L1: "L1 · 不建议", L2: "L2 · 千万别", L3: "L3 · 禁入" },
  en: { L1: "L1 · Not recommended", L2: "L2 · Do not touch", L3: "L3 · Forbidden by law" },
  ru: { L1: "L1 · Не рекомендуется", L2: "L2 · Не связываться", L3: "L3 · Запрещено законом" },
  es: { L1: "L1 · No recomendado", L2: "L2 · No lo toque", L3: "L3 · Prohibido por ley" },
  pt: { L1: "L1 · Não recomendado", L2: "L2 · Não faça", L3: "L3 · Proibido por lei" },
  ar: { L1: "L1 · غير مُوصى به", L2: "L2 · لا تقترب", L3: "L3 · محظور قانونًا" },
  fr: { L1: "L1 · Non recommandé", L2: "L2 · À éviter absolument", L3: "L3 · Interdit par la loi" },
  hi: { L1: "L1 · अनुशंसित नहीं", L2: "L2 · बिल्कुल न करें", L3: "L3 · कानूनन प्रतिबंधित" },
};

// ═══════════════════════════════════════════════════════════
// 4. 对外翻译函数（未知值原样返回，绝不返回空串）
// ═══════════════════════════════════════════════════════════

/**
 * 市场轴位 → 显示文案。
 *
 * @param axis 后端枚举原文（`国内` / `欧洲` / `中亚` / `非洲中东澳新` / `新机对标`）
 * @param locale 目标语种；未知值回落英文
 * @returns 译名；枚举未知时原样返回 `axis`
 */
export function translateAxis(axis: string, locale: AiLocale | string): string {
  return lookupLabel(AXIS_LABELS, axis, locale);
}

/**
 * 价格口径 → 显示文案。
 *
 * @param basis 后端枚举原文（`新机对标` / `欧洲二手净价` / `FOB建议` / `国内二手估` / `推算` / `未找到`）
 * @param locale 目标语种；未知值回落英文
 * @returns 译名；枚举未知时原样返回 `basis`
 */
export function translateBasis(basis: string, locale: AiLocale | string): string {
  return lookupLabel(BASIS_LABELS, basis, locale);
}

/**
 * 紧迫度 → 显示文案。
 *
 * @param urgency 后端枚举原文（`立刻` / `本周` / `出口前`；兼容 `本月`）
 * @param locale 目标语种；未知值回落英文
 * @returns 译名；枚举未知时原样返回 `urgency`
 */
export function translateUrgency(urgency: string, locale: AiLocale | string): string {
  return lookupLabel(URGENCY_LABELS, urgency, locale);
}

/**
 * 准入灯色 → 显示文案。
 *
 * @param light `friendly` / `needPermit` / `forbidden`，或颜色别名 `green` / `yellow` / `red`
 * @param locale 目标语种；未知值回落英文
 * @returns 译名；取值未知时原样返回 `light`
 */
export function translateTrafficLight(light: string, locale: AiLocale | string): string {
  return lookupLabel(TRAFFIC_LIGHT_LABELS, light, locale);
}

/**
 * 渠道角色 → 显示文案（`todayCalls[].role` 直接消费）。
 *
 * @param role 后端枚举原文（`原厂` / `进口商` / `授权经销` / `二手商` / `拍卖行` / `物流` / `政府` / `终端`）
 * @param locale 目标语种；未知值回落英文
 * @returns 译名；枚举未知时原样返回 `role`
 */
export function translateDealerRole(role: string, locale: AiLocale | string): string {
  return lookupLabel(DEALER_ROLE_LABELS, role, locale);
}

/**
 * 否决分级 → 显示文案（`bestDestinations[].rejected[].level` 直接消费）。
 *
 * @param level 后端枚举原文（`L1` / `L2` / `L3`）
 * @param locale 目标语种；未知值回落英文
 * @returns 形如 `L2 · 千万别` 的文案；取值未知时原样返回 `level`
 */
export function translateRejectLevel(level: string, locale: AiLocale | string): string {
  return lookupLabel(REJECT_LEVEL_LABELS, level, locale);
}

/**
 * 该 locale 是否是中文（供调用方决定是否额外保留中文原文）。
 *
 * 只做语种归一化，不读任何站点配置 —— 客户端组件的 props 里拿到的是裸字符串。
 */
export function isChineseLocale(locale: AiLocale | string | null | undefined): boolean {
  return normalizeLocale(locale) === "zh";
}
