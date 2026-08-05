/**
 * 品类同义词匹配
 *
 * 将 AI 识别到的品类名（如"联合收割机""combine"）映射到
 * Category 表的 nameZh（如"收割机"）
 */
import { prisma } from "@/lib/db";

// ── 品类同义词映射（50+ 条） ──
// key = 同义词（AI可能输出的各种写法）
// value = 标准品类名（Category 表 nameZh）
const CATEGORY_SYNONYMS: Record<string, string> = {
  // 收割机
  "联合收割机": "收割机",
  "combine": "收割机",
  "combine harvester": "收割机",
  "收割机": "收割机",
  "小麦收割机": "收割机",
  "玉米收割机": "收割机",
  "水稻收割机": "收割机",
  "谷物收割机": "收割机",
  "harvester": "收割机",
  "harvesting machine": "收割机",

  // 拖拉机
  "拖拉机": "拖拉机",
  "tractor": "拖拉机",
  "轮式拖拉机": "拖拉机",
  "履带拖拉机": "拖拉机",
  "手扶拖拉机": "微耕机",
  "四轮拖拉机": "拖拉机",

  // 打捆机
  "打捆机": "打捆机",
  "压捆机": "打捆机",
  "baler": "打捆机",
  "捡拾压捆机": "打捆机",
  "方捆机": "打捆机",
  "圆捆机": "打捆机",
  "打包机": "打捆机",
  "秸秆打捆机": "打捆机",
  "草捆机": "打捆机",

  // 青贮机
  "青贮机": "青贮机",
  "青储机": "青贮机",
  "silage harvester": "青贮机",
  "forage harvester": "青贮机",
  "forage chopper": "青贮机",
  "chopper": "青贮机",

  // 收割/青贮两用
  "玉米青贮机": "青贮机",
  "秸秆收获机": "青贮机",

  // 旋耕机
  "旋耕机": "旋耕机",
  "rotary tiller": "旋耕机",
  "tiller": "旋耕机",
  "耕耘机": "旋耕机",
  "耕地机": "旋耕机",

  // 插秧机
  "插秧机": "插秧机",
  "rice transplanter": "插秧机",
  "transplanter": "插秧机",

  // 播种机
  "播种机": "播种机",
  "seeder": "播种机",
  "planter": "播种机",
  "种植机": "播种机",
  "条播机": "播种机",
  "穴播机": "播种机",

  // 植保机
  "植保机": "植保机",
  "sprayer": "植保机",
  "喷雾机": "植保机",
  "喷药机": "植保机",
  "农药喷洒机": "植保机",
  "无人机植保": "植保机",

  // 微耕机
  "微耕机": "微耕机",
  "mini tiller": "微耕机",
  "手扶耕机": "微耕机",

  // 搂草机
  "搂草机": "搂草机",
  "rake": "搂草机",
  "hay rake": "搂草机",

  // 割草机
  "割草机": "割草机",
  "mower": "割草机",
  "割晒机": "割草机",

  // 烘干机
  "烘干机": "烘干机",
  "dryer": "烘干机",
  "粮食烘干机": "烘干机",
  "grain dryer": "烘干机",

  // 清选机
  "清选机": "清选机",
  "cleaner": "清选机",
  "筛选机": "清选机",
  "粮食清选机": "清选机",

  // 脱粒机
  "脱粒机": "脱粒机",
  "thresher": "脱粒机",
  "打谷机": "脱粒机",

  // 装载机
  "装载机": "装载机",
  "loader": "装载机",
  "铲车": "装载机",

  // 叉车
  "叉车": "叉车",
  "forklift": "叉车",

  // 挖掘机
  "挖掘机": "挖掘机",
  "excavator": "挖掘机",
  "挖机": "挖掘机",

  // 推土机
  "推土机": "推土机",
  "bulldozer": "推土机",

  // 平地机
  "平地机": "平地机",
  "grader": "平地机",

  // 综合（难以分类）
  "农机": "农机配件",
  "农具": "农机配件",
  "农业机械": "农机配件",
  "配件": "农机配件",
  "parts": "农机配件",
  "spare parts": "农机配件",
  "farm equipment": "农机配件",
  "agricultural machinery": "农机配件",
};

export interface CategoryMatchResult {
  categoryId: string | null;
  displayName: string | null;
  matched: boolean;
  matchMethod: "db_exact" | "db_fuzzy" | "synonym" | "none";
  originalInput: string;
}

/**
 * 品类匹配主函数
 * 策略：
 *   1. AI原文 → Category 表 nameZh 精确匹配
 *   2. 同义词映射 → 标准名 → DB 匹配
 *   3. 模糊匹配（包含关系）
 *   4. 按 parentId 层级回溯（子品类匹配父品类）
 */
export async function resolveCategory(aiCategory: string | null): Promise<CategoryMatchResult> {
  const originalInput = (aiCategory || "").trim();
  if (!originalInput) {
    return { categoryId: null, displayName: null, matched: false, matchMethod: "none", originalInput };
  }

  const inputLower = originalInput.toLowerCase();

  // 1. DB nameZh 精确匹配
  let cat = await prisma.category.findFirst({
    where: { nameZh: originalInput },
    select: { id: true, nameZh: true },
  });
  if (cat) return { categoryId: cat.id, displayName: cat.nameZh, matched: true, matchMethod: "db_exact", originalInput };

  // 2. 同义词映射
  const synTarget = CATEGORY_SYNONYMS[originalInput] || CATEGORY_SYNONYMS[inputLower];
  if (synTarget) {
    cat = await prisma.category.findFirst({
      where: { nameZh: synTarget },
      select: { id: true, nameZh: true },
    });
    if (cat) return { categoryId: cat.id, displayName: cat.nameZh, matched: true, matchMethod: "synonym", originalInput };
  }

  // 3. 模糊匹配（nameZh 包含关系）
  const cats = await prisma.category.findMany({
    where: { nameZh: { contains: inputLower } },
    select: { id: true, nameZh: true },
    take: 5,
  });
  if (cats.length > 0) {
    // 取最匹配的（长度最小的，通常是实际品类名）
    cats.sort((a, b) => a.nameZh.length - b.nameZh.length);
    return { categoryId: cats[0].id, displayName: cats[0].nameZh, matched: true, matchMethod: "db_fuzzy", originalInput };
  }

  // 4. 反向模糊匹配（DB 名称包含输入）
  const reverseCats = await prisma.category.findMany({
    where: { nameZh: { contains: originalInput } },
    select: { id: true, nameZh: true, parentId: true },
    take: 5,
  });
  if (reverseCats.length > 0) {
    reverseCats.sort((a, b) => a.nameZh.length - b.nameZh.length);
    return { categoryId: reverseCats[0].id, displayName: reverseCats[0].nameZh, matched: true, matchMethod: "db_fuzzy", originalInput };
  }

  // 5. 同义词反向匹配
  for (const [synonym, stdName] of Object.entries(CATEGORY_SYNONYMS)) {
    if (inputLower.includes(synonym.toLowerCase()) || synonym.toLowerCase().includes(inputLower)) {
      cat = await prisma.category.findFirst({
        where: { nameZh: stdName },
        select: { id: true, nameZh: true },
      });
      if (cat) return { categoryId: cat.id, displayName: cat.nameZh, matched: true, matchMethod: "synonym", originalInput };
    }
  }

  // 全失败 → 返回 input 作为自定义名
  return { categoryId: null, displayName: originalInput, matched: false, matchMethod: "none", originalInput };
}

/** 品类同义词全表（供 Prompt 注入用） */
export function getCategorySynonymPrompt(): string {
  const d: Record<string, string> = {};
  for (const [syn, std] of Object.entries(CATEGORY_SYNONYMS)) {
    if (!d[std]) d[std] = syn;
    else d[std] += `/${syn}`;
  }
  return Object.entries(d)
    .map(([std, syns]) => `"${syns}" → 标准名: "${std}"`)
    .join("\n");
}
