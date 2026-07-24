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
  matchMethod: "db_exact" | "db_fuzzy" | "synonym" | "none";
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
  if (!synonymTarget) {
    for (const [synonym, stdName] of Object.entries(BRAND_SYNONYMS)) {
      if (inputLower.includes(synonym.toLowerCase()) || synonym.toLowerCase().includes(inputLower)) {
        const dbMatch = await findBrandInDB(stdName);
        if (dbMatch) return { ...dbMatch, matchMethod: "synonym", originalInput };
        // DB 没有则用同义词名作为自定义名
        return { brandId: null, displayName: stdName, matched: false, originalInput, matchMethod: "synonym" };
      }
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
