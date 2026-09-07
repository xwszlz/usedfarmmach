/**
 * ModelAlias —— 国际挂牌型号 ↔ 站内库存型号的别名归一化解算器
 *
 * 【为什么需要它 / 2026-09-07 开发】
 * 现状：国际价配对覆盖率长期只有 ~10%（101 台在库仅 10 台有国际比价）。
 * 根因（代码级实测）：
 *   - 库存 Product.modelName 是**裸型号**：`970` / `980` / `1290XC` / `FR450` / `5300RC`
 *   - 国际平台抓取到的型号是**带系列名的全称**：`Jaguar 970` / `BiG Pack 1290` / `Quadrant 5300`
 *   - 旧匹配逻辑是 `product.modelName contains <抓取型号>`，
 *     即 "970".contains("Jaguar 970") = false → **永远配不上**。
 *   ⇒ Agroline 真实在售 240 台，一台都转化不成配对，全部浪费。
 *
 * 本模块做三件事：
 *   1. 精确别名表：品牌 × 别名(规范化后) → 标准型号（如 claas:jaguar970 → 970）
 *   2. 系列前缀剥离：未知型号按品牌系列前缀剥离（jaguar/lexion/xerion/quadrant/bigpack…）
 *   3. 生成候选集：返回按优先级排序的候选，交由调用方依次尝试匹配
 *
 * 设计原则：
 *   - 纯函数、零 DB 依赖、零迁移风险（不新增表，随代码一起部署即可生效）
 *   - 全部 additive：调用方拿不到结果时保持原有行为不变
 */

/** 品牌标识（BrandBenchmark.brand / Product.brandId）→ 中文品牌名（反向映射用） */
export const BRAND_SLUG_TO_ZH: Record<string, string> = {
  claas: "克拉斯",
  krone: "科罗尼",
  "new-holland": "纽荷兰",
  "john-deere": "约翰迪尔",
  kuhn: "库恩",
  "case-ih": "凯斯",
  "massey-ferguson": "麦赛福格森",
  orke: "奥库",
  "arcusin": "arcusin",
  grimme: "格立莫",
  fendt: "芬特",
  "deutz-fahr": "道依茨法尔",
  valtra: "维美德",
  "case": "凯斯",
};

/**
 * 精确别名表：brandSlug → { 规范化别名: 标准型号 }
 * 键为 normalize() 后的形式（小写、去所有非字母数字）。
 * 值应为库存 Product.modelName 中**出现的子串**（用于 contains 匹配）。
 */
const ALIAS_MAP: Record<string, Record<string, string>> = {
  claas: {
    jaguar970: "970",
    jaguar980: "980",
    jaguar960: "960",
    jaguar950: "950",
    jaguar940: "940",
    jaguar930: "930",
    jaguar900: "900",
    jaguar870: "870",
    jaguar860: "860",
    jaguar850: "850",
    jaguar840: "840",
    jaguar830: "830",
    jaguar810: "810",
    jaguar800: "800",
    jaguar780: "780",
    jaguar770: "770",
    jaguar760: "760",
    jaguar750: "750",
    jaguar700: "700",
    jaguar690: "690",
    jaguar680: "680",
    jaguar675: "675",
    jaguar660: "660",
    jaguar650: "650",
    jaguar640: "640",
    jaguar630: "630",
    jaguar620: "620",
    jaguar610: "610",
    jaguar600: "600",
    jaguar590: "590",
    jaguar580: "580",
    jaguar570: "570",
    jaguar560: "560",
    jaguar550: "550",
    jaguar540: "540",
    jaguar530: "530",
    jaguar520: "520",
    jaguar510: "510",
    jaguar500: "500",
    jaguar495: "495",
    jaguar490: "490",
    jaguar480: "480",
    jaguar470: "470",
    jaguar460: "460",
    jaguar450: "450",
    jaguar440: "440",
    jaguar430: "430",
    jaguar420: "420",
    jaguar410: "410",
    jaguar400: "400",
    jaguar390: "390",
    jaguar380: "380",
    jaguar370: "370",
    jaguar360: "360",
    jaguar350: "350",
    jaguar340: "340",
    jaguar330: "330",
    jaguar320: "320",
    jaguar310: "310",
    jaguar300: "300",
    jaguar290: "290",
    jaguar280: "280",
    jaguar270: "270",
    jaguar260: "260",
    jaguar250: "250",
    jaguar240: "240",
    jaguar230: "230",
    jaguar220: "220",
    jaguar210: "210",
    jaguar200: "200",
    jaguar190: "190",
    jaguar180: "180",
    jaguar170: "170",
    jaguar160: "160",
    jaguar150: "150",
    jaguar140: "140",
    jaguar130: "130",
    jaguar120: "120",
    jaguar110: "110",
    jaguar100: "100",
    jaguar90: "90",
    jaguar80: "80",
    jaguar70: "70",
    jaguar60: "60",
    jaguar50: "50",
    jaguar40: "40",
    jaguar35: "35",
    jaguar30: "30",
    jaguar25: "25",
    jaguar20: "20",
    jaguar15: "15",
    jaguar10: "10",
    jaguar: "", // 裸系列名不产生有效候选
    lexion8600: "8600",
    lexion7700: "7700",
    lexion7600: "7600",
    lexion7500: "7500",
    lexion7400: "7400",
    lexion7300: "7300",
    lexion7200: "7200",
    lexion6700: "6700",
    lexion6600: "6600",
    lexion6500: "6500",
    lexion6300: "6300",
    lexion6200: "6200",
    lexion6000: "6000",
    lexion5800: "5800",
    lexion5700: "5700",
    lexion5600: "5600",
    lexion5500: "5500",
    lexion5400: "5400",
    lexion5300: "5300",
    lexion4800: "4800",
    lexion4700: "4700",
    lexion4600: "4600",
    lexion4500: "4500",
    lexion4400: "4400",
    lexion4300: "4300",
    lexion4200: "4200",
    lexion4100: "4100",
    lexion4000: "4000",
    lexion: "",
    xerion5000: "5000",
    xerion4500: "4500",
    xerion4200: "4200",
    xerion4000: "4000",
    xerion3800: "3800",
    xerion3500: "3500",
    xerion3300: "3300",
    xerion3000: "3000",
    xerion: "",
    quadrant5300: "5300",
    quadrant4200: "4200",
    quadrant4000: "4000",
    quadrant3300: "3300",
    quadrant2200: "2200",
    quadrant2100: "2100",
    quadrant1200: "1200",
    quadrant1150: "1150",
    quadrant1100: "1100",
    quadrant: "",
    rollant: "",
    pu300: "PU300",
    pu400: "PU400",
  },
  krone: {
    bigpack1290: "1290",
    bigpack1290xc: "1290XC",
    bigpack1290hdp: "1290",
    bigpack1290hdpvc: "1290",
    bigpack1270: "1270",
    bigpack1270xc: "1270",
    bigpack1190: "1190",
    bigpack890: "890",
    bigpack870: "870",
    bigpack1250: "1250",
    bigx1180: "1180",
    bigx1100: "1100",
    bigx1000: "1000",
    bigx900: "900",
    bigx800: "800",
    bigx770: "770",
    bigx700: "700",
    bigx680: "680",
    bigx600: "600",
    bigx580: "580",
    bigx550: "550",
    bigx530: "530",
    bigx500: "500",
    bigx480: "480",
    bigx450: "450",
    bigx420: "420",
    bigx400: "400",
    bigm450: "450",
    bigm420: "420",
    bigm400: "400",
    cf155xc: "CF155XC",
    cf155: "CF155XC",
    f125xc: "F125XC",
    f125: "F125XC",
    bigpack: "",
    comprima: "",
    easycut: "",
    swadro: "",
    zx: "",
    kw: "",
  },
  "new-holland": {
    fr450: "FR450",
    fr480: "FR480",
    fr500: "FR500",
    fr550: "FR550",
    fr600: "FR600",
    fr650: "FR650",
    fr700: "FR700",
    fr780: "FR780",
    fr850: "FR850",
    fr900: "FR900",
    fr9040: "FR9040",
    fr9060: "FR9060",
    fr9080: "FR9080",
    fr9090: "FR9090",
    fr920: "FR920",
    br7060: "7060",
    br7070: "7070",
    br7090: "7090",
    bb9040: "9040",
    bb9050: "9050",
    bb9060: "9060",
    bb9080: "9080",
    bb9090: "9090",
    "9080": "9080",
    "5070": "5070",
    "5080": "5080",
    "5090": "5090",
    "6090": "6090",
    "1270": "1270",
    "1290": "1290",
    "375": "375",
    t7: "",
    t8: "",
    t9: "",
  },
  "john-deere": {
    "8400": "8400",
    "8400r": "8400",
    "7250": "7250",
    "7250r": "7250",
    "7660": "7660",
    "6950": "6950",
    "6603": "6603",
    "9996": "9996",
    l340: "L340",
    "6r250": "6R 250",
    "8r410": "8R 410",
    "7r350": "7R 350",
    "9r640": "9R 640",
    "6m185": "6M 185",
    "6r": "",
    "7r": "",
    "8r": "",
    "9r": "",
  },
  kuhn: {
    "890": "890",
    lsb1290: "LSB1290",
    vb3160: "VB3160",
    vbp3165: "VbP3165",
    vb3190: "VB3190",
    fc313: "FC313",
    gf: "",
  },
  "case-ih": {
    "420": "420",
    magnum380: "Magnum 380",
    magnum: "",
    puma: "",
    optum: "",
    maxxum: "",
    farmall: "",
  },
  "massey-ferguson": {
    "3404": "3404",
    "1840p": "1840P",
    "1840s": "1840S",
    "8s305": "8S.305",
    "5s145": "5S.145",
  },
  orke: {
    densx: "DENS-X",
    dens: "DENS-X",
    "2000": "2000",
  },
};

/**
 * 通用系列前缀（用于未知型号的兜底剥离）。
 * 顺序不重要，取最长匹配。
 */
const SERIES_PREFIXES: string[] = [
  "jaguar", "lexion", "xerion", "quadrant", "rollant", "volto", "liner", "cargos", "disco", "arios", "arion", "axion", "scorpion", "torion",
  "bigpack", "bigx", "bigm", "comprima", "easycut", "swadro", "vendro", "kw", "zx",
  "magnum", "puma", "optum", "maxxum", "farmall", "steiger", "quadtrac",
  "vario", "favorit", "farmer", "katana",
  "t7", "t8", "t9", "t6", "t5", "t4",
  "6r", "7r", "8r", "9r", "5r", "6m", "6d", "5m", "5e", "6e", "7m", "8rt",
  "fr", "br", "bb", "cr", "cx", "cs", "fr", "tv", "tm", "td", "tl",
];

/** 规范化：小写 + 去掉所有非字母数字字符（空格、连字符、点、斜杠） */
export function normalizeModel(raw: string | null | undefined): string {
  if (!raw) return "";
  return String(raw)
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fa5]/g, "")
    .trim();
}

/** 取精确别名表中的标准型号；没有则返回 null */
export function lookupExactAlias(
  brandSlug: string | null | undefined,
  rawModel: string | null | undefined
): string | null {
  const norm = normalizeModel(rawModel);
  if (!norm) return null;
  const table = (brandSlug && ALIAS_MAP[brandSlug]) || {};
  const hit = table[norm];
  if (hit === undefined) return null;
  return hit === "" ? null : hit; // "" 表示"已知但无有效候选"（如裸系列名）
}

/** 剥离系列前缀：jaguar970 → 970；无前缀可剥则返回 null */
export function stripSeriesPrefix(norm: string): string | null {
  if (!norm) return null;
  // 取最长匹配前缀
  let best: string | null = null;
  for (const p of SERIES_PREFIXES) {
    if (norm.startsWith(p) && norm.length > p.length) {
      const rest = norm.slice(p.length);
      if (!best || rest.length > best.length) best = rest;
    }
  }
  return best;
}

/**
 * 生成匹配候选（按优先级从高到低，已去重）
 * 调用方应依次尝试 `product.modelName contains <candidate>`
 */
export function resolveModelCandidates(
  brandSlug: string | null | undefined,
  rawModel: string | null | undefined
): string[] {
  const norm = normalizeModel(rawModel);
  if (!norm) return [];
  const out: string[] = [];
  const push = (v: string | null | undefined) => {
    if (!v) return;
    const n = normalizeModel(v);
    if (n && !out.includes(n)) out.push(n);
  };

  // 1) 精确别名
  const exact = lookupExactAlias(brandSlug, rawModel);
  if (exact) push(exact);

  // 2) 原始型号整体（应对库存也为全称的情况）
  push(norm);

  // 3) 剥离系列前缀后的型号
  const stripped = stripSeriesPrefix(norm);
  if (stripped) push(stripped);

  // 4) 再对剥离结果查一次别名表（如 "bigpack1290xc" 剥成 "1290xc" 后命中 1290XC）
  if (stripped) {
    const strippedAlias = lookupExactAlias(brandSlug, stripped);
    if (strippedAlias) push(strippedAlias);
  }

  return out;
}

/**
 * 判断某条国际挂牌型号是否能匹配到某个库存型号（纯 JS 判定，供测试/兜底用）
 *
 * ⚠️ 匹配方向**必须是「库存型号 startsWith 候选」**，不能双向 contains：
 *   - 反例（已实测踩坑）：抓取 "6R 250" 剥离前缀得候选 "250"，
 *     库存 "7250" contains "250" → 误判成配对。
 *   - 正例：候选 "1290" → 库存 "1290" / "1290XC" / "1290xchdp" 均以 1290 开头 → 正确命中同系列。
 *   - 反向（候选 contains 库存）同样危险："Xerion 5000" 的候选 "5000" 会误吃库存 "500"。
 *
 * 因此规则收敛为：库存型号 === 候选，或 库存型号 以候选开头（忽略大小写与符号）。
 */
export function isModelMatch(
  brandSlug: string | null | undefined,
  rawListingModel: string,
  productModelName: string
): boolean {
  const productNorm = normalizeModel(productModelName);
  if (!productNorm) return false;
  const candidates = resolveModelCandidates(brandSlug, rawListingModel);
  for (const c of candidates) {
    if (productNorm === c || productNorm.startsWith(c)) return true;
  }
  return false;
}
