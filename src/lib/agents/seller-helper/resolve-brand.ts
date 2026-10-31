/**
 * 品牌智能匹配引擎
 *
 * 1. DB匹配：从 Brand 表的 nameZh/nameEn/nameRu 做模糊匹配
 * 2. 同义词映射：硬编码常见品牌别名
 * 3. 优先级：AI 原文 > DB 匹配 > 同义词
 */
import { prisma } from "@/lib/db";

// Brand type for select results
type BrandBrief = { id: string; nameZh: string };

// ── 品牌同义词映射 ──
const BRAND_SYNONYMS: Record<string, string> = {
  // 中文同义词 → 标准中文名
  "迪尔": "约翰迪尔",
  "janne deere": "约翰迪尔",
  "麦赛弗格森": "麦赛福格森",
  "massey ferguson": "麦赛福格森",
  "纽荷兰": "纽荷兰",
  "new holland": "纽荷兰",
  "凯斯": "凯斯",
  "case ih": "凯斯",
  "克拉斯": "克拉斯",
  "克罗尼": "科罗尼",
  "明斯克": "明斯克",
  "白俄罗斯": "明斯克",
  "久保田": "久保田",
  "麦克海尔": "麦克海尔",

  // 常见简写 → 英文全名
  "jd": "John Deere",
  "deere": "John Deere",
  "mf": "Massey Ferguson",
  "nh": "New Holland",
  "cih": "Case IH",
  "kr": "Krone",

  // 英文名 → 中文名
  "kubota": "久保田",
  "belarus": "明斯克",
  "krone": "科罗尼",
  "mchale": "麦克海尔",
};

export interface BrandMatchResult {
  brandId: string | null;
  /** 匹配到的标准品牌名（中文优先） */
  displayName: string | null;
  /** 是否匹配成功（可走 select 模式） */
  matched: boolean;
  /** AI 原始输入 */
  originalInput: string;
  /** 匹配方式 */
  matchMethod: "db_exact" | "db_fuzzy" | "synonym" | "none" | "ambiguous_multibrand";
}

// ── 第 4 步（同义词反向匹配）的门槛与工具 ──

/**
 * 反向匹配时同义词 key 的最小长度门槛。
 *
 * 为什么必须有门槛：`BRAND_SYNONYMS` 里既有 `jd` / `mf` / `nh` / `kr` 这类 1~2 字符缩写，
 * 也可能出现中文单字 key。允许它们参与「输入里含有该 key」这种反向匹配，会带来两类误绑：
 *   1. 短输入命中一切长 key（旧实现里 `synonym.includes(input)` 的方向反了）；
 *   2. 任意串里偶然出现的字母组合把品牌抢走。
 * 真实数据里 78 行 `brandName` 有 53 行是 `CLAAS/New Holland` 这种合并串，误绑会把 A 品牌
 * 机型挂到 B 品牌下，污染主数据与估值。价值取向已由老板定死：
 *   **宁可返回「没匹配上」，也绝不误绑到别的品牌。**
 *
 * 阈值定法：
 *   - 中日韩字符：≥ 2 个字符。中文没有空格分词，无法用词边界保护，单字（如 `凯` / `迪`）
 *     语义太宽；同时中文品牌名最短就是 2 字（`凯斯` / `迪尔`）。
 *   - 英文/数字等：≥ 3 个字符。`jd` / `mf` / `nh` / `kr` 这些 2 字符缩写由第 1 步
 *     「同义词直查」（整串精确命中）继续服务，反向匹配不需要它们。
 */
const MIN_SYNONYM_KEY_LEN_CJK = 2;
const MIN_SYNONYM_KEY_LEN_ASCII = 3;

/** CJK（中日韩）字符判定：中文、日文假名、韩文音节。 */
const CJK_CHAR_RE = /[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff\uff66-\uff9f\uac00-\ud7af]/;

/** 纯 ASCII 单词型 key（字母/数字/空格/连字符/点），可用「词边界」匹配。 */
const ASCII_WORD_KEY_RE = /^[a-z0-9][a-z0-9 .\-]*$/i;

/**
 * 多品牌合并串的分隔符。
 * 覆盖 `CLAAS/New Holland`、`迪尔、纽荷兰`、`A & B`、`A + B`、`A | B`、`A and B`。
 */
const BRAND_SEPARATOR_RE = /[/／,，、&+|]+|\band\b/gi;

/** 是否为 CJK 字符。 */
function isCjkChar(ch: string): boolean {
  return CJK_CHAR_RE.test(ch);
}

/** 转义正则元字符，用于把品牌 key 拼进 RegExp。 */
function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * 同义词 key（或品牌片段）是否达到反向匹配的最小长度门槛。
 *
 * @param key 待判定的 key / 片段
 * @returns 达到门槛返回 true
 */
function meetsMinKeyLength(key: string): boolean {
  const trimmed = (key || "").trim();
  if (!trimmed) return false;
  const chars = Array.from(trimmed);
  const hasCjk = chars.some(isCjkChar);
  const minLen = hasCjk ? MIN_SYNONYM_KEY_LEN_CJK : MIN_SYNONYM_KEY_LEN_ASCII;
  return chars.length >= minLen;
}

/**
 * 判断输入中是否**以完整词**的形式出现了同义词 key。
 *
 * 只允许 `input.includes(key)` 这个方向，并额外要求 key 前后是「非字母数字」边界，
 * 避免裸 `includes` 造成的子串误命中（如 key `cih` 命中 `classicih`）。
 * 中文等无词边界语言退化为包含匹配。
 *
 * @param inputLower 已小写化的输入
 * @param key 同义词 key
 * @returns 命中返回 true
 */
function containsSynonymToken(inputLower: string, key: string): boolean {
  const k = (key || "").trim().toLowerCase();
  if (!k) return false;
  if (ASCII_WORD_KEY_RE.test(k)) {
    const pattern = new RegExp(`(?:^|[^a-z0-9])${escapeRegExp(k)}(?:$|[^a-z0-9])`);
    return pattern.test(inputLower);
  }
  return inputLower.includes(k);
}

/**
 * 收集输入中命中的全部同义词目标名（stdName）。
 *
 * 与旧实现的区别：
 *   - 不再「首命中即 return」，而是扫描完整张表后去重；
 *   - 跳过长度不足门槛的 key；
 *   - 只保留 `input.includes(key)` 这个正确方向 + 完整词边界。
 *
 * @param inputLower 已小写化的输入（片段或整串）
 * @returns 去重后的标准品牌名列表（保持 BRAND_SYNONYMS 的书写顺序）
 */
function collectSynonymCandidates(inputLower: string): string[] {
  const stdNames: string[] = [];
  for (const [synonym, stdName] of Object.entries(BRAND_SYNONYMS)) {
    if (!meetsMinKeyLength(synonym)) continue;
    if (!containsSynonymToken(inputLower, synonym)) continue;
    if (!stdNames.includes(stdName)) stdNames.push(stdName);
  }
  return stdNames;
}

/**
 * 把多品牌合并串拆成「品牌片段」。
 *
 * 长度不足门槛的片段会被丢弃：`Deere & Co` 里的 `Co` 只有 2 个字符，不算一个品牌片段，
 * 这样既不会误判为多品牌串，也不会把真正的品牌吞掉。
 *
 * @param input 原始输入
 * @returns 品牌片段列表（可能为空）
 */
function splitBrandFragments(input: string): string[] {
  return input
    .split(BRAND_SEPARATOR_RE)
    .map((fragment) => fragment.trim())
    .filter((fragment) => fragment.length > 0 && meetsMinKeyLength(fragment));
}

/**
 * 把若干候选标准名解析为**唯一** DB 品牌。
 *
 * 只有满足下面两点才返回品牌，否则返回 null（= 无法唯一判定，宁可不匹配）：
 *   1. 每个候选标准名都能在 DB 找到品牌；
 *   2. 它们指向的是同一个品牌（`迪尔` 与 `John Deere` 是同一品牌的不同称呼）。
 *
 * @param stdNames 候选标准品牌名
 */
async function pickUniqueBrand(
  stdNames: string[]
): Promise<{ brandId: string; displayName: string; matched: true } | null> {
  const distinctNames = stdNames.filter((name, index, arr) => {
    const trimmed = (name || "").trim();
    return trimmed.length > 0 && arr.indexOf(name) === index;
  });
  if (distinctNames.length === 0) return null;

  const resolved: Array<{ brandId: string; displayName: string; matched: true }> = [];
  for (const name of distinctNames) {
    const dbMatch = await findBrandInDB(name);
    if (!dbMatch) return null; // DB 里没有该品牌 → 不猜
    resolved.push(dbMatch);
  }

  const brandIds = new Set(resolved.map((item) => item.brandId));
  if (brandIds.size !== 1) return null; // 命中多个不同品牌 → 不猜
  return resolved[0];
}

/**
 * 品牌匹配主函数
 * 策略：
 *   1. AI原文 → Brand 表 nameZh/nameEn/nameRu 精确匹配
 *   2. 同义词映射
 *   3. 模糊匹配（包含关系）
 */
export async function resolveBrand(aiBrand: string | null): Promise<BrandMatchResult> {
  const originalInput = (aiBrand || "").trim();
  if (!originalInput) {
    return { brandId: null, displayName: null, matched: false, originalInput, matchMethod: "none" };
  }

  const inputLower = originalInput.toLowerCase();

  // 1. 同义词映射：先走同义词表
  const synonymTarget = BRAND_SYNONYMS[originalInput] || BRAND_SYNONYMS[inputLower];
  if (synonymTarget) {
    // 尝试用同义词目标名匹配 DB
    const dbMatch = await findBrandInDB(synonymTarget);
    if (dbMatch) return { ...dbMatch, matchMethod: "synonym", originalInput };
  }

  // 2. DB 精确匹配
  const exactMatch = await findBrandInDB(originalInput);
  if (exactMatch) return { ...exactMatch, matchMethod: "db_exact", originalInput };

  // 3. DB 模糊匹配（包含关系）
  const fuzzyMatch = await findBrandFuzzy(inputLower);
  if (fuzzyMatch) return { ...fuzzyMatch, matchMethod: "db_fuzzy", originalInput };

  // 4. 同义词反向匹配（输入="Deere" 同义词→"John Deere" 再 DB 匹配）
  //    原则：先收集全部命中，再判定能否唯一归一；不能唯一归一就不匹配（绝不误绑）。
  if (!synonymTarget) {
    // 4a. 多品牌合并串（真实数据里的主流形态：`CLAAS/New Holland`）
    //     按分隔符拆片段，逐个片段找同义词；只有「每个片段都归到同一个 DB 品牌」才放行。
    const fragments = splitBrandFragments(originalInput);
    if (fragments.length >= 2) {
      const perFragment = fragments.map((fragment) => collectSynonymCandidates(fragment.toLowerCase()));
      const flatStdNames: string[] = [];
      for (const list of perFragment) {
        for (const stdName of list) {
          if (!flatStdNames.includes(stdName)) flatStdNames.push(stdName);
        }
      }
      const unresolvedFragments = perFragment.filter((list) => list.length === 0).length;

      if (flatStdNames.length > 0) {
        if (unresolvedFragments === 0) {
          const unique = await pickUniqueBrand(flatStdNames);
          if (unique) return { ...unique, matchMethod: "synonym", originalInput };
        }
        // 串里含多个品牌，或含无法识别的品牌片段（`CLAAS` 不在同义词表里）
        // ⇒ 无法唯一判定，绝不挑第一个返回
        return {
          brandId: null,
          displayName: originalInput,
          matched: false,
          originalInput,
          matchMethod: "ambiguous_multibrand",
        };
      }
      // 所有片段都没命中同义词 → 继续走 4b（结果会落到全失败出口）
    }

    // 4b. 单品牌输入：扫描全部同义词，只有唯一候选才回查 DB
    const stdNames = collectSynonymCandidates(inputLower);
    if (stdNames.length === 1) {
      const dbMatch = await findBrandInDB(stdNames[0]);
      if (dbMatch) return { ...dbMatch, matchMethod: "synonym", originalInput };
      // DB 里没有该标准品牌 → 不得用 stdName 冒充品牌显示名，落到全失败出口
    } else if (stdNames.length > 1) {
      const unique = await pickUniqueBrand(stdNames);
      if (unique) return { ...unique, matchMethod: "synonym", originalInput };
      // 命中多个不同品牌（或部分品牌 DB 里没有）→ 不猜
      return {
        brandId: null,
        displayName: originalInput,
        matched: false,
        originalInput,
        matchMethod: "ambiguous_multibrand",
      };
    }
  }

  // 全失败
  return { brandId: null, displayName: originalInput, matched: false, originalInput, matchMethod: "none" };
}

/**
 * 在 Brand 表中按 nameZh/nameEn/nameRu 精确匹配
 */
async function findBrandInDB(name: string): Promise<{ brandId: string; displayName: string; matched: true } | null> {
  const trimmed = name.trim();
  if (!trimmed) return null;

  // 精确匹配 nameZh
  let brand = await prisma.brand.findFirst({
    where: { nameZh: trimmed },
    select: { id: true, nameZh: true },
  });
  if (brand) return { brandId: brand.id, displayName: brand.nameZh, matched: true };

  // 精确匹配 nameEn（忽略大小写）
  brand = await prisma.brand.findFirst({
    where: { nameEn: { equals: trimmed, mode: "insensitive" } },
    select: { id: true, nameZh: true },
  });
  if (brand) return { brandId: brand.id, displayName: brand.nameZh, matched: true };

  // 精确匹配 nameRu
  brand = await prisma.brand.findFirst({
    where: { nameRu: { equals: trimmed, mode: "insensitive" } },
    select: { id: true, nameZh: true },
  });
  if (brand) return { brandId: brand.id, displayName: brand.nameZh, matched: true };

  return null;
}

/**
 * 模糊匹配：包含关系
 */
async function findBrandFuzzy(inputLower: string): Promise<{ brandId: string; displayName: string; matched: true } | null> {
  // nameZh 包含
  const byNameZh = await prisma.brand.findMany({
    where: { nameZh: { contains: inputLower } },
    select: { id: true, nameZh: true },
    take: 1,
  }) as BrandBrief[];
  if (byNameZh.length > 0) return { brandId: byNameZh[0].id, displayName: byNameZh[0].nameZh, matched: true };

  // nameEn 包含
  const byNameEn = await prisma.brand.findMany({
    where: { nameEn: { contains: inputLower } },
    select: { id: true, nameZh: true },
    take: 1,
  }) as BrandBrief[];
  if (byNameEn.length > 0) return { brandId: byNameEn[0].id, displayName: byNameEn[0].nameZh, matched: true };

  // OR 模糊
  const orMatch = await prisma.brand.findMany({
    where: {
      OR: [
        { nameZh: { contains: inputLower } },
        { nameEn: { contains: inputLower } },
      ],
    },
    select: { id: true, nameZh: true },
    take: 1,
  }) as BrandBrief[];
  if (orMatch.length > 0) return { brandId: orMatch[0].id, displayName: orMatch[0].nameZh, matched: true };

  return null;
}
