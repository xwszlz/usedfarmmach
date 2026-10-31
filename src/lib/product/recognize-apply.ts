/**
 * AI 视觉识别 → 产品参数回填（纯函数，无副作用，可单独单测）
 * ---------------------------------------------------------------------------
 * 背景：卖家发布产品时往往不专业，型号/功率/尺寸等参数填得随意。产品详情页
 * 「AI 设备中心 → AI 视觉识别」调用 `POST /api/agents/seller-helper/recognize`
 * 让大模型看图给出一套规范参数，再由卖家逐字段勾选，写回自己的产品记录
 * （`PUT /api/seller/products/[id]`）。
 *
 * 为什么单独抽成纯函数：
 *   1. 对比逻辑（归一化 / 白名单 / 组合字段）是纯数据变换，放在组件里无法单测；
 *   2. 「哪些字段能写、哪些绝对不能写」是安全边界，必须是可被测试锁死的常量，
 *      而不是散落在 JSX 里的 if。
 *
 * 🔴 一条硬禁令（永不可破）：
 *   `referencePrice`（AI 估算的「市场行情参考价」）**绝对不能**映射到 `priceCny`。
 *   `priceCny` 是卖家自己挂的售价，`referencePrice` 是本平台按品牌/年份/成色估的
 *   市场行情价。两者语义完全不同，一旦混淆就会**静默改掉卖家挂的售价**，属于
 *   资金级事故。因此：
 *     - `APPLYABLE_PAYLOAD_SOURCES` 里没有 `priceCny` 这一项；
 *     - `FORBIDDEN_PAYLOAD_KEYS` 显式列出 `priceCny`，命中即跳过；
 *     - 返回值最后再做一次 `delete payload.priceCny` 兜底；
 *     - `__tests__/recognize-apply.test.ts` 用一条专门的用例锁死该不变量
 *       （即使 recognized.referencePrice 有值、即使 selectedKeys 混入任意 key，
 *        输出都不得含 priceCny）。
 */

/** 可回填字段（与 `PUT /api/seller/products/[id]` 白名单的交集）。 */
export type ApplyableFieldKey =
  | "brandName"
  | "modelName"
  | "year"
  | "engineType"
  | "enginePower"
  | "driveSystem"
  | "mainConfig"
  | "overallLength"
  | "overallWidth"
  | "overallHeight"
  | "netWeight"
  | "workingHours"
  | "condition"
  | "category"
  | "country"
  | "province"
  | "city"
  | "location";

/** recognize 结果里可能出现的标量值类型（后端大多返回 string | number | null）。 */
export type Scalar = string | number | null | undefined;

/**
 * `POST /api/agents/seller-helper/recognize` 成功时 `data` 的形状（字段全 optional，
 * 因为后端对识别不到的值一律返回 null，且未来可能增删字段，前端不应因此崩）。
 *
 * 注意：`brand` / `category` 已被后端替换为 DB 标准名（resolveBrand / resolveCategory
 * 的 displayName），所以可以直接拿来和产品的 `brand.nameZh` / `category.nameZh` 比对。
 */
export interface RecognizedData {
  brand?: Scalar;
  brandId?: Scalar;
  modelName?: Scalar;
  year?: Scalar;
  enginePower?: Scalar;
  engineType?: Scalar;
  driveSystem?: Scalar;
  overallLength?: Scalar;
  overallWidth?: Scalar;
  overallHeight?: Scalar;
  netWeight?: Scalar;
  mainConfig?: Scalar;
  workingHours?: Scalar;
  condition?: Scalar;
  priceMode?: Scalar;
  tradeTerm?: Scalar;
  tradePort?: Scalar;
  category?: Scalar;
  categoryId?: Scalar;
  location?: Scalar;
  country?: Scalar;
  province?: Scalar;
  city?: Scalar;
  /** AI 估算的二手市场参考价（人民币元）。⚠️ 只展示，永不回填 priceCny。 */
  referencePrice?: Scalar;
  isChineseBrand?: boolean | null;
  confidence?: number | null;
}

/**
 * `GET /api/seller/products/[id]` 返回的 `data` 的子集（该接口直接返回 Prisma Product，
 * 并 include 了 brand / category 关系对象）。
 *
 * `brandName` / `categoryName` 是给调用方与单测用的扁平别名：若存在则优先于嵌套对象，
 * 这样既能吃真实接口返回，也能被测试用小对象直接构造。
 */
export interface CurrentProduct {
  brand?: { nameZh?: string | null; nameEn?: string | null } | null;
  category?: { nameZh?: string | null; nameEn?: string | null } | null;
  brandName?: Scalar;
  categoryName?: Scalar;
  modelName?: Scalar;
  year?: Scalar;
  enginePower?: Scalar;
  engineType?: Scalar;
  driveSystem?: Scalar;
  overallLength?: Scalar;
  overallWidth?: Scalar;
  overallHeight?: Scalar;
  netWeight?: Scalar;
  mainConfig?: Scalar;
  workingHours?: Scalar;
  condition?: Scalar;
  location?: Scalar;
  country?: Scalar;
  province?: Scalar;
  city?: Scalar;
}

/** 单个字段的对比结果（供 UI 渲染「现有值 → AI 识别值」）。 */
export interface FieldDiff {
  key: ApplyableFieldKey;
  labelZh: string;
  labelEn: string;
  /** 归一化后的现值可读字符串；无值为 null（UI 显示 ——）。 */
  current: string | null;
  /** 归一化后的识别值可读字符串；无值为 null。 */
  recognized: string | null;
  /** 归一化后比较不等 → true。 */
  changed: boolean;
}

/** 数值型字段：回填时转成 number（后端会 Number() 一次，传数字更干净）。 */
const NUMERIC_KEYS: ReadonlySet<ApplyableFieldKey> = new Set<ApplyableFieldKey>([
  "year",
  "enginePower",
  "workingHours",
  "overallLength",
  "overallWidth",
  "overallHeight",
  "netWeight",
]);

/**
 * 🔴 绝对禁止写回的请求体字段。
 * `priceCny` 是卖家报价；`recognized.referencePrice` 是 AI 估的市场行情价。
 * 把参考价写进 priceCny = 静默改卖家售价，属于资金级事故，永久禁止。
 */
const FORBIDDEN_PAYLOAD_KEYS: readonly string[] = ["priceCny"];

interface FieldSpec {
  key: ApplyableFieldKey;
  labelZh: string;
  labelEn: string;
  /** 从 GET 返回的 data 里读现值 */
  readCurrent: (product: CurrentProduct) => Scalar;
  /** 从 recognize 返回的 data 里读识别值 */
  readRecognized: (recognized: RecognizedData) => Scalar;
}

const EMPTY_PRODUCT: CurrentProduct = {};

/** 品牌：优先扁平别名 → brand.nameZh → brand.nameEn。 */
function readCurrentBrand(product: CurrentProduct): Scalar {
  if (product.brandName !== undefined && product.brandName !== null) {
    return product.brandName;
  }
  return product.brand?.nameZh ?? product.brand?.nameEn ?? null;
}

/** 品类：优先扁平别名 categoryName → category.nameZh → category.nameEn。 */
function readCurrentCategory(product: CurrentProduct): Scalar {
  if (product.categoryName !== undefined && product.categoryName !== null) {
    return product.categoryName;
  }
  return product.category?.nameZh ?? product.category?.nameEn ?? null;
}

/** 字段顺序 = UI 里勾选列表的顺序，按「越关键越靠前」排列。 */
const FIELD_SPECS: readonly FieldSpec[] = [
  {
    key: "brandName",
    labelZh: "品牌",
    labelEn: "Brand",
    readCurrent: readCurrentBrand,
    readRecognized: (r) => r.brand,
  },
  {
    key: "modelName",
    labelZh: "型号",
    labelEn: "Model",
    readCurrent: (p) => p.modelName,
    readRecognized: (r) => r.modelName,
  },
  {
    key: "year",
    labelZh: "年份",
    labelEn: "Year",
    readCurrent: (p) => p.year,
    readRecognized: (r) => r.year,
  },
  {
    key: "engineType",
    labelZh: "发动机类型",
    labelEn: "Engine Type",
    readCurrent: (p) => p.engineType,
    readRecognized: (r) => r.engineType,
  },
  {
    key: "enginePower",
    labelZh: "发动机功率",
    labelEn: "Engine Power",
    readCurrent: (p) => p.enginePower,
    readRecognized: (r) => r.enginePower,
  },
  {
    key: "driveSystem",
    labelZh: "驱动方式",
    labelEn: "Drive System",
    readCurrent: (p) => p.driveSystem,
    readRecognized: (r) => r.driveSystem,
  },
  {
    key: "mainConfig",
    labelZh: "主要配置",
    labelEn: "Main Config",
    readCurrent: (p) => p.mainConfig,
    readRecognized: (r) => r.mainConfig,
  },
  {
    key: "overallLength",
    labelZh: "长度",
    labelEn: "Length",
    readCurrent: (p) => p.overallLength,
    readRecognized: (r) => r.overallLength,
  },
  {
    key: "overallWidth",
    labelZh: "宽度",
    labelEn: "Width",
    readCurrent: (p) => p.overallWidth,
    readRecognized: (r) => r.overallWidth,
  },
  {
    key: "overallHeight",
    labelZh: "高度",
    labelEn: "Height",
    readCurrent: (p) => p.overallHeight,
    readRecognized: (r) => r.overallHeight,
  },
  {
    key: "netWeight",
    labelZh: "整机重量",
    labelEn: "Net Weight",
    readCurrent: (p) => p.netWeight,
    readRecognized: (r) => r.netWeight,
  },
  {
    key: "workingHours",
    labelZh: "工作时长",
    labelEn: "Working Hours",
    readCurrent: (p) => p.workingHours,
    readRecognized: (r) => r.workingHours,
  },
  {
    key: "condition",
    labelZh: "成色",
    labelEn: "Condition",
    readCurrent: (p) => p.condition,
    readRecognized: (r) => r.condition,
  },
  {
    key: "category",
    labelZh: "品类",
    labelEn: "Category",
    readCurrent: readCurrentCategory,
    readRecognized: (r) => r.category,
  },
  {
    key: "country",
    labelZh: "国家",
    labelEn: "Country",
    readCurrent: (p) => p.country,
    readRecognized: (r) => r.country,
  },
  {
    key: "province",
    labelZh: "省份/州",
    labelEn: "Province / State",
    readCurrent: (p) => p.province,
    readRecognized: (r) => r.province,
  },
  {
    key: "city",
    labelZh: "城市",
    labelEn: "City",
    readCurrent: (p) => p.city,
    readRecognized: (r) => r.city,
  },
  {
    key: "location",
    labelZh: "产地",
    labelEn: "Location",
    readCurrent: (p) => p.location,
    readRecognized: (r) => r.location,
  },
];

/**
 * 归一化为「可读字符串」：null / undefined / 空串 / 纯空白 → null。
 * 数字统一转字符串（`3.2` → "3.2"），布尔也转字符串（仅用于极端脏数据兜底）。
 */
function normalizeScalar(value: Scalar | boolean): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "number") {
    return Number.isFinite(value) ? String(value) : null;
  }
  if (typeof value === "boolean") return String(value);
  const text = String(value).trim();
  return text === "" ? null : text;
}

/** 全角→半角、统一小写、压缩空白。用于忽略排版差异。 */
function foldText(text: string): string {
  return text.normalize("NFKC").toLowerCase().replace(/\s+/g, " ").trim();
}

/**
 * 严格数字解析：只接受十进制数字字面量（含小数/科学计数法/正负号），
 * 避免 `Number("")`、`Number(" ")`、`Number("0x10")`、`Number("1,000")` 这类
 * JS 宽松转换带来的误判。解析失败返回 null。
 */
function toFiniteNumber(text: string): number | null {
  const folded = text.normalize("NFKC").trim();
  if (folded === "") return null;
  if (!/^[+-]?(?:\d+(?:\.\d+)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(folded)) return null;
  const parsed = Number(folded);
  return Number.isFinite(parsed) ? parsed : null;
}

/**
 * 判断两个归一化字符串是否「语义相等」。
 *
 * 规则（顺序很重要）：
 *   1. 两边都 null → 相等；只有一边 null → 不等（有值 vs 无值 是真差异）；
 *   2. 两边都能解析成数字 → 按数字比：`"3.2"` vs `"3.20"` / `"3.2"` vs `3.2` 判为相等；
 *   3. 否则按折叠文本比：trim + 全角半角归一 + 忽略大小写，`" CLAAS "` vs `"claas"` 判为相等。
 */
function valuesEqual(current: string | null, recognized: string | null): boolean {
  if (current === null && recognized === null) return true;
  if (current === null || recognized === null) return false;
  const currentNum = toFiniteNumber(current);
  const recognizedNum = toFiniteNumber(recognized);
  if (currentNum !== null && recognizedNum !== null) return currentNum === recognizedNum;
  return foldText(current) === foldText(recognized);
}

/**
 * `location` 是组合字段（后端 `buildLocationText(country, province, city)` 拼出来的）。
 * 判定规则：只要 AI 给了 country / province / city 中任意一个，就只按三者比对；
 * 三者都没变 → `changed: false`（不因为拼接串的细微格式差异而误报）。
 * 若三者 AI 全没给（无法比对），退回比对 location 文本本身，避免漏报。
 */
function isLocationChanged(
  current: CurrentProduct,
  recognized: RecognizedData,
  currentText: string | null,
  recognizedText: string | null
): boolean {
  const components: Array<{ current: Scalar; recognized: Scalar }> = [
    { current: current.country, recognized: recognized.country },
    { current: current.province, recognized: recognized.province },
    { current: current.city, recognized: recognized.city },
  ];
  const comparable = components.filter(
    (item) => normalizeScalar(item.recognized) !== null
  );
  if (comparable.length > 0) {
    return comparable.some(
      (item) =>
        !valuesEqual(normalizeScalar(item.current), normalizeScalar(item.recognized))
    );
  }
  return !valuesEqual(currentText, recognizedText);
}

/**
 * 生成逐字段对比。
 *
 * 只包含「AI 识别值非空」且「key 在可回填白名单里」的字段——识别不到的值不该
 * 出现在勾选列表里（否则卖家会把一串 `null → ——` 当成待修项）。
 *
 * @param current    `GET /api/seller/products/[id]` 返回的 data；无权限/未请求时传 null
 *                   （此时所有字段的 current 均为 null，changed 逻辑仍成立）。
 * @param recognized recognize 接口返回的 data。
 * @returns          按关键度排序的字段差异列表；无差异时返回空数组。
 */
export function buildFieldDiff(
  current: CurrentProduct | null,
  recognized: RecognizedData
): FieldDiff[] {
  if (!recognized) return [];
  const product = current ?? EMPTY_PRODUCT;
  const diffs: FieldDiff[] = [];

  for (const spec of FIELD_SPECS) {
    const recognizedText = normalizeScalar(spec.readRecognized(recognized));
    // 识别值为空的字段直接不出现
    if (recognizedText === null) continue;

    const currentText = normalizeScalar(spec.readCurrent(product));
    const changed =
      spec.key === "location"
        ? isLocationChanged(product, recognized, currentText, recognizedText)
        : !valuesEqual(currentText, recognizedText);

    diffs.push({
      key: spec.key,
      labelZh: spec.labelZh,
      labelEn: spec.labelEn,
      current: currentText,
      recognized: recognizedText,
      changed,
    });
  }

  return diffs;
}

/**
 * key → 识别结果读取器。**只含可回填白名单**。
 *
 * 注意这里刻意缺少（= 永不回填）：
 *   - `priceCny`      ← 卖家报价，禁止被 AI 参考价覆盖（见文件头硬禁令）
 *   - `referencePrice` / `confidence` / `isChineseBrand`  ← 元信息，不是产品参数
 *   - `tradePort` / `priceMode` / `tradeTerm`            ← PUT 白名单里根本没有这些字段
 *   - `brandId` / `categoryId`                            ← PUT 只接受字符串名，内部自己解析
 */
const APPLYABLE_PAYLOAD_SOURCES: Readonly<
  Record<ApplyableFieldKey, (recognized: RecognizedData) => Scalar>
> = {
  brandName: (r) => r.brand,
  modelName: (r) => r.modelName,
  year: (r) => r.year,
  engineType: (r) => r.engineType,
  enginePower: (r) => r.enginePower,
  driveSystem: (r) => r.driveSystem,
  mainConfig: (r) => r.mainConfig,
  overallLength: (r) => r.overallLength,
  overallWidth: (r) => r.overallWidth,
  overallHeight: (r) => r.overallHeight,
  netWeight: (r) => r.netWeight,
  workingHours: (r) => r.workingHours,
  condition: (r) => r.condition,
  category: (r) => r.category,
  country: (r) => r.country,
  province: (r) => r.province,
  city: (r) => r.city,
  location: (r) => r.location,
};

/**
 * 按用户勾选的 key 列表，组装成 `PUT /api/seller/products/[id]` 的请求体。
 *
 * 约束：
 *   1. 只输出白名单内的 key（`selectedKeys` 里混进任何非法 key 都被丢弃）；
 *   2. 识别值为 null / 空串的字段**不传**——PUT 是「传了才覆盖」，传 null 会把卖家
 *      已有值清空（这是数据丢失级别的问题）；
 *   3. 数值字段转 number，其余转去空白后的字符串；
 *   4. 🔴 输出**永不包含** `priceCny`（即使 recognized.referencePrice 有值）。
 *
 * @param recognized   recognize 接口返回的 data
 * @param selectedKeys 用户在 UI 上勾选的字段
 * @returns            可直接作为 `JSON.stringify` 入参的请求体；无有效字段时为空对象
 */
export function buildApplyPayload(
  recognized: RecognizedData,
  selectedKeys: ApplyableFieldKey[]
): Record<string, unknown> {
  const payload: Record<string, unknown> = {};
  if (!recognized || !Array.isArray(selectedKeys)) return payload;

  for (const rawKey of selectedKeys) {
    const key = rawKey as ApplyableFieldKey;

    // 白名单闸门 1：不是可回填字段 → 丢弃
    if (!Object.prototype.hasOwnProperty.call(APPLYABLE_PAYLOAD_SOURCES, key)) continue;
    // 白名单闸门 2：显式禁令命中 → 丢弃（priceCny 永远进不来）
    if (FORBIDDEN_PAYLOAD_KEYS.includes(key)) continue;

    const normalized = normalizeScalar(APPLYABLE_PAYLOAD_SOURCES[key](recognized));
    // 空值不写入，避免把卖家已有值清空
    if (normalized === null) continue;

    if (NUMERIC_KEYS.has(key)) {
      const parsed = toFiniteNumber(normalized);
      payload[key] = parsed === null ? normalized : parsed;
    } else {
      payload[key] = normalized;
    }
  }

  // 最后一道兜底：任何路径都不得让 priceCny 出现在请求体里。
  delete payload.priceCny;

  return payload;
}

/** 供 UI 展示的成色枚举 → 可读文案（后端 condition 取值为 excellent/good/fair/poor）。 */
const CONDITION_LABELS: Readonly<Record<string, { zh: string; en: string }>> = {
  excellent: { zh: "优秀/全新", en: "Excellent" },
  good: { zh: "良好/正常使用", en: "Good" },
  fair: { zh: "一般/有磨损", en: "Fair" },
  poor: { zh: "较差/需维修", en: "Poor" },
};

/**
 * 把字段值渲染成 UI 可读文本：空值 → "—"，成色枚举 → 中英文案，其余原样。
 * 放在本模块而不是组件里，方便单测锁定「空值不显示 null」这条渲染约定。
 */
export function formatFieldValue(
  key: ApplyableFieldKey,
  value: string | null,
  locale: string
): string {
  const zh = locale === "zh";
  if (value === null || value === "") return "—";
  if (key === "condition") {
    const label = CONDITION_LABELS[foldText(value)];
    if (label) return zh ? label.zh : label.en;
  }
  if (NUMERIC_KEYS.has(key)) {
    const parsed = toFiniteNumber(value);
    if (parsed !== null) return String(parsed);
  }
  return value;
}
