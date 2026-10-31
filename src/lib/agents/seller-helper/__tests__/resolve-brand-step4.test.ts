/**
 * 品牌解析第 4 步（同义词反向匹配）回归测试
 *
 * 背景（老板已知的真实故障）：
 *   采集数据里大量 `brandName` 是 `"CLAAS/New Holland"` 这种**多品牌合并串**，
 *   旧实现第 4 步「首命中即 return」，把它误绑成了**纽荷兰（New Holland）**，
 *   于是克拉斯机型被挂到纽荷兰品牌下，污染主数据与估值。
 *
 * 价值取向（已由老板定死）：**宁可返回「没匹配上」，也绝不误绑到别的品牌。**
 *
 * 本测试覆盖四个缺陷：
 *   ① 反方向 `synonym.includes(input)` —— 短输入命中一切长 key；
 *   ② 无长度门槛 —— 单/双字符缩写乱命中；
 *   ③ 首命中即 return —— 顺序敏感，多品牌串随机挑第一个；
 *   ④ DB 无此品牌时用 `stdName` 冒充 `displayName`。
 *
 * DB 通过 mock 掉 `@/lib/db` 实现，不触碰真实数据库。
 * 注意：mock 的 `contains` 刻意实现为**大小写敏感**，与 Prisma 在 Postgres 上的默认行为一致
 * （`resolve-brand.ts` 的模糊匹配没有传 `mode: "insensitive"`），这样测试才与线上一致。
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

interface MockBrand {
  id: string;
  nameZh: string;
  nameEn: string | null;
  nameRu: string | null;
}

/**
 * 最小品牌表：只放「第 4 步回归」需要判别的两个品牌。
 * 刻意不含 nameEn 里带 t/k/s 的品牌，避免第 3 步（DB 模糊）抢在第 4 步之前命中，
 * 让单字符用例真正校验第 4 步的长度门槛。
 */
const BRANDS: MockBrand[] = [
  { id: "b-deere", nameZh: "约翰迪尔", nameEn: "John Deere", nameRu: null },
  { id: "b-nh", nameZh: "纽荷兰", nameEn: "New Holland", nameRu: null },
];

/** 模拟 Prisma `contains`（大小写敏感，同 Postgres 默认行为）。 */
function contains(haystack: string | null, needle: string): boolean {
  if (!haystack) return false;
  return haystack.includes(needle);
}

/** 模拟 Prisma `{ equals, mode: "insensitive" }`。 */
function equalsInsensitive(haystack: string | null, needle: string): boolean {
  if (!haystack) return false;
  return haystack.toLowerCase() === needle.toLowerCase();
}

type BrandWhere = {
  nameZh?: string | { contains: string };
  nameEn?: { equals: string; mode?: string } | { contains: string };
  nameRu?: { equals: string; mode?: string };
  OR?: BrandWhere[];
};

function matchesWhere(brand: MockBrand, where: BrandWhere): boolean {
  if (where.OR) {
    return where.OR.some((clause) => matchesWhere(brand, clause));
  }
  if (where.nameZh !== undefined) {
    const cond = where.nameZh;
    if (typeof cond === "string") {
      if (brand.nameZh !== cond) return false;
    } else if (!contains(brand.nameZh, cond.contains)) {
      return false;
    }
  }
  if (where.nameEn !== undefined) {
    const cond = where.nameEn;
    if ("equals" in cond) {
      if (!equalsInsensitive(brand.nameEn, cond.equals)) return false;
    } else if (!contains(brand.nameEn, cond.contains)) {
      return false;
    }
  }
  if (where.nameRu !== undefined) {
    const cond = where.nameRu;
    if (!equalsInsensitive(brand.nameRu, cond.equals)) return false;
  }
  return true;
}

const brandFindFirst = vi.fn(async (args: { where: BrandWhere }) => {
  const hit = BRANDS.find((brand) => matchesWhere(brand, args.where));
  if (!hit) return null;
  return { id: hit.id, nameZh: hit.nameZh };
});

const brandFindMany = vi.fn(async (args: { where: BrandWhere; take?: number }) => {
  const hits = BRANDS.filter((brand) => matchesWhere(brand, args.where))
    .slice(0, args.take ?? BRANDS.length)
    .map((brand) => ({ id: brand.id, nameZh: brand.nameZh }));
  return hits;
});

vi.mock("@/lib/db", () => ({
  prisma: {
    brand: {
      findFirst: (...args: unknown[]) => brandFindFirst(...(args as [{ where: BrandWhere }])),
      findMany: (...args: unknown[]) => brandFindMany(...(args as [{ where: BrandWhere; take?: number }])),
    },
  },
}));

import { resolveBrand } from "@/lib/agents/seller-helper/resolve-brand";

beforeEach(() => {
  brandFindFirst.mockClear();
  brandFindMany.mockClear();
});

describe("resolveBrand 第 4 步：绝不误绑（多品牌合并串）", () => {
  it('"CLAAS/New Holland" ⇒ matched:false，不得解析成纽荷兰（老板已知的实际故障）', async () => {
    const r = await resolveBrand("CLAAS/New Holland");

    expect(r.matched).toBe(false);
    expect(r.brandId).toBeNull();
    // 关键回归：绝不能是「纽荷兰」
    expect(r.displayName).not.toBe("纽荷兰");
    expect(r.displayName).toBe("CLAAS/New Holland");
    expect(r.originalInput).toBe("CLAAS/New Holland");
    expect(r.matchMethod).toBe("ambiguous_multibrand");
  });

  it('"John Deere / CLAAS" ⇒ matched:false（含无法识别的品牌片段，也不许挑一个返回）', async () => {
    const r = await resolveBrand("John Deere / CLAAS");

    expect(r.matched).toBe(false);
    expect(r.brandId).toBeNull();
    expect(r.displayName).toBe("John Deere / CLAAS");
  });

  it('"迪尔、纽荷兰" ⇒ matched:false（两个不同标准品牌）', async () => {
    const r = await resolveBrand("迪尔、纽荷兰");

    expect(r.matched).toBe(false);
    expect(r.brandId).toBeNull();
    expect(r.displayName).toBe("迪尔、纽荷兰");
    expect(r.matchMethod).toBe("ambiguous_multibrand");
  });

  it('"迪尔 & 纽荷兰" ⇒ matched:false', async () => {
    const r = await resolveBrand("迪尔 & 纽荷兰");

    expect(r.matched).toBe(false);
    expect(r.brandId).toBeNull();
  });

  it('"John Deere / 迪尔" ⇒ 命中同一品牌（合并串但品牌唯一，不许误判为模糊）', async () => {
    const r = await resolveBrand("John Deere / 迪尔");

    expect(r.matched).toBe(true);
    expect(r.brandId).toBe("b-deere");
    expect(r.displayName).toBe("约翰迪尔");
  });
});

describe("resolveBrand 第 4 步：合法场景不能被修坏", () => {
  it('"John Deere" ⇒ 正常命中约翰迪尔', async () => {
    const r = await resolveBrand("John Deere");

    expect(r.matched).toBe(true);
    expect(r.brandId).toBe("b-deere");
    expect(r.displayName).toBe("约翰迪尔");
  });

  it('"Deere" ⇒ 命中约翰迪尔（第 4 步原本要服务的场景）', async () => {
    const r = await resolveBrand("Deere");

    expect(r.matched).toBe(true);
    expect(r.brandId).toBe("b-deere");
    expect(r.displayName).toBe("约翰迪尔");
  });

  it('"John Deere 6M"（品牌 + 机型）⇒ 走第 4 步命中约翰迪尔', async () => {
    const r = await resolveBrand("John Deere 6M");

    expect(r.matched).toBe(true);
    expect(r.brandId).toBe("b-deere");
    expect(r.displayName).toBe("约翰迪尔");
    expect(r.matchMethod).toBe("synonym");
  });

  it('"纽荷兰" ⇒ 正常命中纽荷兰', async () => {
    const r = await resolveBrand("纽荷兰");

    expect(r.matched).toBe(true);
    expect(r.brandId).toBe("b-nh");
    expect(r.displayName).toBe("纽荷兰");
  });

  it('"NH"（2 字符缩写）⇒ 仍由第 1 步同义词直查命中纽荷兰', async () => {
    const r = await resolveBrand("NH");

    expect(r.matched).toBe(true);
    expect(r.brandId).toBe("b-nh");
    expect(r.displayName).toBe("纽荷兰");
  });
});

describe("resolveBrand 第 4 步：长度门槛（单/双字符 key 不得乱命中）", () => {
  it.each(["t", "k", "s"])('单字符输入 "%s" ⇒ matched:false，不得命中任何品牌', async (input) => {
    const r = await resolveBrand(input);

    expect(r.matched).toBe(false);
    expect(r.brandId).toBeNull();
    expect(r.displayName).toBe(input);
    expect(r.matchMethod).toBe("none");
  });

  it('"jd"（2 字符缩写，同义词表精确 key）⇒ 仍由第 1 步命中 John Deere', async () => {
    const r = await resolveBrand("jd");

    expect(r.matched).toBe(true);
    expect(r.brandId).toBe("b-deere");
  });

  it('"New Holland T7" ⇒ 以完整词命中纽荷兰（词边界匹配不破坏正常输入）', async () => {
    const r = await resolveBrand("T7 New Holland");

    expect(r.matched).toBe(true);
    expect(r.brandId).toBe("b-nh");
  });
});

describe("resolveBrand 第 4 步：词边界，禁止子串误命中", () => {
  it('"classicih 9000" ⇒ 不得因裸 includes 命中 "cih"', async () => {
    const r = await resolveBrand("classicih 9000");

    expect(r.matched).toBe(false);
    expect(r.brandId).toBeNull();
    expect(r.displayName).toBe("classicih 9000");
  });

  it('"kubotax 100" ⇒ 不得因裸 includes 命中 "kubota"', async () => {
    const r = await resolveBrand("kubotax 100");

    expect(r.matched).toBe(false);
    expect(r.brandId).toBeNull();
  });
});

describe("resolveBrand 第 4 步：DB 无此品牌时不得用同义词名冒充 displayName", () => {
  it('"Krone Big X"（同义词命中「科罗尼」但 DB 无此品牌）⇒ matched:false 且 displayName === originalInput', async () => {
    const r = await resolveBrand("Krone Big X");

    expect(r.matched).toBe(false);
    expect(r.brandId).toBeNull();
    expect(r.displayName).toBe("Krone Big X");
    expect(r.displayName).not.toBe("科罗尼");
    expect(r.matchMethod).toBe("none");
  });

  it("同义词表里不存在的东西 ⇒ matched:false 且 displayName === originalInput", async () => {
    const r = await resolveBrand("Fendt 936 Vario");

    expect(r.matched).toBe(false);
    expect(r.brandId).toBeNull();
    expect(r.displayName).toBe("Fendt 936 Vario");
    expect(r.matchMethod).toBe("none");
  });

  it("空输入 ⇒ matched:false，displayName 为 null", async () => {
    const r = await resolveBrand("   ");

    expect(r.matched).toBe(false);
    expect(r.brandId).toBeNull();
    expect(r.displayName).toBeNull();
    expect(r.matchMethod).toBe("none");
  });
});
