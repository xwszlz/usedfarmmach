/**
 * mascus 线索池查询层单测（2026-11）
 *
 * 全量 mock 掉 `@/lib/db`（不连库、不依赖 DATABASE_URL），只验业务口径。
 *
 * 核心回归点：
 *   1. `normalizePhoneKey`：同一卖家的多种电话写法必须归一成同一个 key
 *      （mascus 对不同品类页会给出 `+1 419-529-6160` / `+14195296160` / `1 (419) 529-6160`）；
 *   2. 🔴 `priceEuro` 排序必须 **null-last** —— Postgres `ORDER BY col DESC` 默认
 *      **NULLS FIRST**，而本表 43% 的行无价，一旦退回默认排序，第一页会被无价行占满。
 *      本文件用一个**忠实模拟 Postgres 排序语义**的内存执行器来验证：
 *      默认 `{priceEuro:"desc"}` 会把 null 排最前（证明模拟可信），
 *      而 lib 产出的 `{priceEuro:{sort:"desc",nulls:"last"}}` 会把 null 排最后；
 *   3. `pageSize` 上限 100、`page` 下限 1（钳制口径与 raw-listing/review.ts 一致）；
 *   4. `orderBy` 非法值回落 `listedAt desc`；
 *   5. `aggregateBySeller`：多种电话写法归 1 组、`sellerPhone` 为 null 的行不出现；
 *   6. `updateMascusListing`：非法 `followStatus` 抛 `MascusQueryError` 且不落库；
 *   7. `updateMascusListing`：**绝不写 `lastSeenAt`**（该列是 `@updatedAt`，手工写会污染
 *      「还在挂」判据，所以走定向 SQL 而非 ORM update）；
 *   8. 🔴 `aggregateBySeller` 是**列表性质**视图：序列化结果不得含任何可拨号明文电话
 *      （归一 key / 各原始写法一律经 `maskPhone` 掩码后下发，明文只走 `[id]` 详情接口）。
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const h = vi.hoisted(() => ({
  findMany: vi.fn(),
  count: vi.fn(),
  groupBy: vi.fn(),
  findUnique: vi.fn(),
  userFindMany: vi.fn(),
  userFindUnique: vi.fn(),
  executeRaw: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    mascusListing: {
      findMany: h.findMany,
      count: h.count,
      groupBy: h.groupBy,
      findUnique: h.findUnique,
    },
    user: { findMany: h.userFindMany, findUnique: h.userFindUnique },
    $executeRaw: h.executeRaw,
  },
}));

import { describePhoneVariants, normalizePhoneKey } from "@/lib/mascus-leads/phone";
import {
  MASCUS_FOLLOW_STATUSES,
  MascusQueryError,
  aggregateByBrand,
  aggregateBySeller,
  buildMascusOrderBy,
  listMascusListings,
  mapMascusError,
  updateMascusListing,
} from "@/lib/mascus-leads/query";

// ───────────────────────────────────────────────
// 内存行工厂
// ───────────────────────────────────────────────

interface TestRow {
  id: string;
  productId: string;
  brandName: string | null;
  modelName: string | null;
  year: number | null;
  priceEuro: number | null;
  priceOriginal: number | null;
  priceCurrency: string | null;
  sellerPhone: string | null;
  companyName: string | null;
  locationCity: string | null;
  locationCountry: string | null;
  scanSegment: string | null;
  assetUrl: string | null;
  imageUrl: string | null;
  listedAt: Date | null;
  lastSeenAt: Date;
  followStatus: string;
  assignedTo: string | null;
  note: string | null;
}

function mkRow(overrides: Partial<TestRow> = {}): TestRow {
  return {
    id: overrides.id ?? "row-1",
    productId: overrides.productId ?? "{GUID-1}",
    brandName: "John Deere",
    modelName: "450M",
    year: 2018,
    priceEuro: 1000,
    priceOriginal: 1100,
    priceCurrency: "USD",
    sellerPhone: "+1 419-529-6160",
    companyName: "Agri Co",
    locationCity: "Mansfield",
    locationCountry: "US",
    scanSegment: "tractors",
    assetUrl: "https://www.mascus.com/a/1",
    imageUrl: "https://cdn.mascus.com/1.jpg",
    listedAt: new Date("2024-01-01T00:00:00Z"),
    lastSeenAt: new Date("2024-06-01T00:00:00Z"),
    followStatus: MASCUS_FOLLOW_STATUSES[0],
    assignedTo: null,
    note: null,
    ...overrides,
  };
}

/**
 * 忠实模拟 Postgres 的 `ORDER BY` 语义（含 null 排序默认值）：
 *   - `ORDER BY col DESC` 默认 NULLS FIRST
 *   - `ORDER BY col ASC`  默认 NULLS LAST
 *   - 显式 `nulls: "last" | "first"` 覆盖默认
 *
 * 用它来证明「lib 产出的 orderBy 确实让无价行排在后面」，
 * 同时证明「朴素写法的确会把无价行顶到最前」——否则这条测试没有区分力。
 */
function applyPgOrder(rows: TestRow[], orderBy: unknown): TestRow[] {
  const specs: Record<string, unknown>[] = Array.isArray(orderBy)
    ? (orderBy as Record<string, unknown>[])
    : orderBy
      ? [orderBy as Record<string, unknown>]
      : [];
  const out = [...rows];
  out.sort((a, b) => {
    for (const spec of specs) {
      const entry = Object.entries(spec)[0];
      if (!entry) continue;
      const field = entry[0] as keyof TestRow;
      const raw = entry[1];
      const dir = typeof raw === "string" ? raw : ((raw as { sort: string }).sort as "asc" | "desc");
      const explicitNulls =
        typeof raw === "string" ? undefined : ((raw as { nulls?: "first" | "last" }).nulls);
      const nulls = explicitNulls ?? (dir === "desc" ? "first" : "last");

      const av = a[field];
      const bv = b[field];
      const aNull = av === null || av === undefined;
      const bNull = bv === null || bv === undefined;
      if (aNull || bNull) {
        if (aNull && bNull) continue;
        if (aNull) return nulls === "first" ? -1 : 1;
        return nulls === "first" ? 1 : -1;
      }
      const cmp =
        typeof av === "number" && typeof bv === "number"
          ? av - bv
          : String(av).localeCompare(String(bv));
      if (cmp !== 0) return dir === "asc" ? cmp : -cmp;
    }
    return 0;
  });
  return out;
}

/** 默认 mock：把一个内存表当作数据库执行 findMany/count/groupBy */
function useInMemoryTable(rows: TestRow[]): void {
  h.findMany.mockImplementation(async (args: Record<string, unknown>) => {
    const ordered = applyPgOrder(rows, args?.orderBy);
    const skip = typeof args?.skip === "number" ? args.skip : 0;
    const take = typeof args?.take === "number" ? args.take : ordered.length;
    return ordered.slice(skip, skip + take);
  });
  h.count.mockResolvedValue(rows.length);
}

beforeEach(() => {
  h.findMany.mockReset();
  h.count.mockReset();
  h.groupBy.mockReset();
  h.findUnique.mockReset();
  h.userFindMany.mockReset();
  h.userFindUnique.mockReset();
  h.executeRaw.mockReset();

  useInMemoryTable([]);

  // Tab 计数（by followStatus）/ 国家下拉（by companyCountry）
  h.groupBy.mockImplementation(async (args: Record<string, unknown>) => {
    const by = (args?.by as string[] | undefined)?.[0];
    if (by === "followStatus") {
      return [
        { followStatus: "未联系", _count: { _all: 3 } },
        { followStatus: "已联系", _count: { _all: 1 } },
      ];
    }
    if (by === "companyCountry") {
      return [
        { companyCountry: "US", _count: { _all: 3 } },
        { companyCountry: null, _count: { _all: 1 } },
        { companyCountry: "DE", _count: { _all: 1 } },
      ];
    }
    return [];
  });

  h.userFindMany.mockResolvedValue([{ id: "u1", username: "alice", email: "alice@example.com" }]);
  h.userFindUnique.mockResolvedValue({ id: "u1", role: "admin", isActive: true });
});

// ───────────────────────────────────────────────
// 1. 电话归一
// ───────────────────────────────────────────────

describe("normalizePhoneKey：同一卖家的多种写法必须归一", () => {
  it("三种美式写法归一成同一个 key", () => {
    const variants = ["+1 419-529-6160", "+14195296160", "1 (419) 529-6160"];
    const keys = variants.map((v) => normalizePhoneKey(v));
    expect(keys).toEqual(["4195296160", "4195296160", "4195296160"]);
    expect(new Set(keys).size).toBe(1);
  });

  it("`00` 国际码前缀与 `+` 写法归一（德国号）", () => {
    expect(normalizePhoneKey("0049 4441 123")).toBe("494441123");
    expect(normalizePhoneKey("+49 4441 123")).toBe("494441123");
  });

  it("null / undefined / 空串 / 无数字 → null", () => {
    expect(normalizePhoneKey(null)).toBeNull();
    expect(normalizePhoneKey(undefined)).toBeNull();
    expect(normalizePhoneKey("")).toBeNull();
    expect(normalizePhoneKey("   ")).toBeNull();
    expect(normalizePhoneKey("abc")).toBeNull();
    expect(normalizePhoneKey("n/a")).toBeNull();
  });

  it("≤10 位原样保留，>10 位取后 10 位", () => {
    expect(normalizePhoneKey("1234567890")).toBe("1234567890");
    expect(normalizePhoneKey("12345")).toBe("12345");
    expect(normalizePhoneKey("+44 20 7946 0958")).toBe("2079460958");
  });

  it("describePhoneVariants 去重并按次数降序", () => {
    const out = describePhoneVariants([
      "+1 419-529-6160",
      "+14195296160",
      "+1 419-529-6160",
      null,
      "",
    ]);
    expect(out).toEqual([
      { raw: "+1 419-529-6160", count: 2 },
      { raw: "+14195296160", count: 1 },
    ]);
  });
});

// ───────────────────────────────────────────────
// 2. 🔴 priceEuro null-last
// ───────────────────────────────────────────────

describe("priceEuro 排序：无价行绝不能排在最前（Postgres NULLS FIRST 陷阱）", () => {
  const rows = [
    mkRow({ id: "a", priceEuro: 100, listedAt: new Date("2024-01-01T00:00:00Z") }),
    mkRow({ id: "b", priceEuro: null, listedAt: new Date("2024-03-01T00:00:00Z") }),
    mkRow({ id: "c", priceEuro: 300, listedAt: new Date("2024-02-01T00:00:00Z") }),
  ];

  it("降序：无价行排在最后，首条是有价行", async () => {
    useInMemoryTable(rows);
    const res = await listMascusListings({ orderBy: "priceEuro", order: "desc" });

    expect(res.items.map((i) => i.id)).toEqual(["c", "a", "b"]);
    expect(res.items[0].priceEuro).toBe(300);
    expect(res.items[res.items.length - 1].priceEuro).toBeNull();
  });

  it("升序：无价行同样排在最后", async () => {
    useInMemoryTable(rows);
    const res = await listMascusListings({ orderBy: "priceEuro", order: "asc" });
    expect(res.items.map((i) => i.id)).toEqual(["a", "c", "b"]);
  });

  it("对照实验：朴素 `{priceEuro:\"desc\"}` 确实会把无价行顶到最前（证明模拟可信）", () => {
    const naive = applyPgOrder(rows, [{ priceEuro: "desc" }]);
    expect(naive[0].priceEuro).toBeNull();
    expect(naive[0].id).toBe("b");
  });

  it("下发给 Prisma 的 orderBy 显式带 nulls: last，且带稳定二级键 id", async () => {
    useInMemoryTable(rows);
    await listMascusListings({ orderBy: "priceEuro", order: "desc" });
    const args = h.findMany.mock.calls.at(-1)?.[0] as { orderBy: unknown };
    expect(args.orderBy).toEqual([{ priceEuro: { sort: "desc", nulls: "last" } }, { id: "asc" }]);
  });

  it("默认排序（listedAt desc）同样 null-last：缺挂牌时间的行不顶到最前", async () => {
    const withNullDate = [
      mkRow({ id: "x", listedAt: null }),
      mkRow({ id: "y", listedAt: new Date("2024-05-01T00:00:00Z") }),
    ];
    useInMemoryTable(withNullDate);
    const res = await listMascusListings({});
    expect(res.items.map((i) => i.id)).toEqual(["y", "x"]);
  });
});

// ───────────────────────────────────────────────
// 3/4. 分页钳制 + 排序白名单
// ───────────────────────────────────────────────

describe("分页钳制与排序白名单", () => {
  it("pageSize 超过 100 被钳到 100", async () => {
    useInMemoryTable([]);
    await listMascusListings({ pageSize: 1000 });
    expect((h.findMany.mock.calls.at(-1)?.[0] as { take: number }).take).toBe(100);
  });

  it("page=0 / 负数被钳到 1（skip 为 0）", async () => {
    useInMemoryTable([]);
    await listMascusListings({ page: 0, pageSize: 10 });
    expect((h.findMany.mock.calls.at(-1)?.[0] as { skip: number }).skip).toBe(0);

    await listMascusListings({ page: -5, pageSize: 10 });
    expect((h.findMany.mock.calls.at(-1)?.[0] as { skip: number }).skip).toBe(0);
  });

  it("pageSize=0 / 缺省时回落 30", async () => {
    useInMemoryTable([]);
    await listMascusListings({ pageSize: 0 });
    expect((h.findMany.mock.calls.at(-1)?.[0] as { take: number }).take).toBe(30);

    await listMascusListings({});
    expect((h.findMany.mock.calls.at(-1)?.[0] as { take: number }).take).toBe(30);
  });

  it("orderBy 传非法值回落 listedAt desc", () => {
    expect(buildMascusOrderBy("dropTable", "desc")).toEqual([
      { listedAt: { sort: "desc", nulls: "last" } },
      { id: "asc" },
    ]);
    expect(buildMascusOrderBy(undefined, undefined)).toEqual([
      { listedAt: { sort: "desc", nulls: "last" } },
      { id: "asc" },
    ]);
  });

  it("lastSeenAt 为非空列，orderBy 不加 nulls", () => {
    expect(buildMascusOrderBy("lastSeenAt", "asc")).toEqual([{ lastSeenAt: "asc" }, { id: "asc" }]);
  });
});

// ───────────────────────────────────────────────
// 列表返回面：绝不含明文电话
// ───────────────────────────────────────────────

describe("列表脱敏与筛选口径", () => {
  it("items 只给掩码，序列化后不含明文 sellerPhone", async () => {
    useInMemoryTable([mkRow({ id: "a", sellerPhone: "+1 419-529-6160" })]);
    const res = await listMascusListings({});

    expect(res.items[0].sellerPhoneMasked).toBe("141****6160");
    expect(res.items[0].hasPhone).toBe(true);
    expect(Object.prototype.hasOwnProperty.call(res.items[0], "sellerPhone")).toBe(false);
    expect(JSON.stringify(res.items)).not.toContain("419-529-6160");
    expect(JSON.stringify(res.items)).not.toContain("14195296160");
  });

  it("无电话行 hasPhone=false 且掩码为 null", async () => {
    useInMemoryTable([mkRow({ id: "a", sellerPhone: null })]);
    const res = await listMascusListings({});
    expect(res.items[0].hasPhone).toBe(false);
    expect(res.items[0].sellerPhoneMasked).toBeNull();
  });

  it("hasPhone=true 时下发 sellerPhone not null 过滤；默认不过滤", async () => {
    useInMemoryTable([]);
    await listMascusListings({ hasPhone: true });
    const whereWith = (h.findMany.mock.calls.at(-1)?.[0] as { where: Record<string, unknown> }).where;
    expect(whereWith.sellerPhone).toEqual({ not: null });

    await listMascusListings({});
    const whereDefault = (h.findMany.mock.calls.at(-1)?.[0] as { where: Record<string, unknown> }).where;
    expect(whereDefault.sellerPhone).toBeUndefined();
  });

  it("assignedTo=unassigned 翻译成 assignedTo: null", async () => {
    useInMemoryTable([]);
    await listMascusListings({ assignedTo: "unassigned" });
    const where = (h.findMany.mock.calls.at(-1)?.[0] as { where: Record<string, unknown> }).where;
    expect(where.assignedTo).toBeNull();
  });

  it("statusCounts 覆盖全部取值域且来自不含 followStatus 的 where", async () => {
    useInMemoryTable([]);
    const res = await listMascusListings({ followStatus: "已联系" });

    expect(res.statusCounts["未联系"]).toBe(3);
    expect(res.statusCounts["已联系"]).toBe(1);
    // 取值域补零
    for (const s of MASCUS_FOLLOW_STATUSES) expect(res.statusCounts[s]).toBeDefined();

    const statusCall = h.groupBy.mock.calls.find(
      (c) => (c[0] as { by: string[] }).by[0] === "followStatus"
    );
    expect(statusCall).toBeDefined();
    expect((statusCall?.[0] as { where: Record<string, unknown> }).where.followStatus).toBeUndefined();
  });

  /**
   * 「我的线索」按 assignedTo 筛选时，Tab 计数必须跟着收窄；
   * 用裸 baseWhere 会漏掉 assignedTo（它只在 withFollowFilters 里追加），Tab 会显示全库口径。
   */
  it("statusCounts 计入 assignedTo 筛选（我的线索 Tab 计数不是全库口径）", async () => {
    const rows = [
      mkRow({ id: "a", assignedTo: "u1", followStatus: "未联系" }),
      mkRow({ id: "b", assignedTo: "u1", followStatus: "已联系" }),
      mkRow({ id: "c", assignedTo: "u2", followStatus: "未联系" }),
      mkRow({ id: "d", assignedTo: "u2", followStatus: "未联系" }),
    ];
    useInMemoryTable(rows);
    // 让 groupBy 忠实按传入的 where 过滤，模拟真实 DB 的 groupBy 行为
    h.groupBy.mockImplementation(async (args: Record<string, unknown>) => {
      const by = (args?.by as string[] | undefined)?.[0];
      const where = (args?.where ?? {}) as Record<string, unknown>;
      const filtered = rows.filter((r) => {
        if (typeof where.assignedTo === "string" && r.assignedTo !== where.assignedTo) return false;
        if (where.assignedTo === null && r.assignedTo !== null) return false;
        if (typeof where.followStatus === "string" && r.followStatus !== where.followStatus) return false;
        return true;
      });
      if (by === "followStatus") {
        const counts = new Map<string, number>();
        for (const r of filtered) counts.set(r.followStatus, (counts.get(r.followStatus) ?? 0) + 1);
        return Array.from(counts, ([followStatus, n]) => ({ followStatus, _count: { _all: n } }));
      }
      return [];
    });

    const res = await listMascusListings({ assignedTo: "u1" });
    // u1 只有 2 条（未联系 1 / 已联系 1）；若漏了 assignedTo 会是 3 / 1（全库口径）
    expect(res.statusCounts["未联系"]).toBe(1);
    expect(res.statusCounts["已联系"]).toBe(1);

    const statusCall = h.groupBy.mock.calls.find(
      (c) => (c[0] as { by: string[] }).by[0] === "followStatus"
    );
    const statusWhere = (statusCall?.[0] as { where: Record<string, unknown> }).where;
    expect(statusWhere.assignedTo).toBe("u1");
    expect(statusWhere.followStatus).toBeUndefined();

    // 同时带 followStatus 时：计数仍须忽略自身状态，但 assignedTo 不能丢
    const res2 = await listMascusListings({ assignedTo: "u1", followStatus: "已联系" });
    expect(res2.statusCounts["未联系"]).toBe(1);
    expect(res2.statusCounts["已联系"]).toBe(1);
    const statusCalls = h.groupBy.mock.calls.filter(
      (c) => (c[0] as { by: string[] }).by[0] === "followStatus"
    );
    const lastWhere = (statusCalls.at(-1)?.[0] as { where: Record<string, unknown> }).where;
    expect(lastWhere.assignedTo).toBe("u1");
    expect(lastWhere.followStatus).toBeUndefined();
  });

  it("lookups：segments 5 段、countries 去 null 排序、assignees 用 username 兜 email", async () => {
    useInMemoryTable([]);
    const res = await listMascusListings({});

    expect(res.lookups.segments).toEqual([
      "tractors",
      "tillage-machines",
      "hay-and-forage-machines",
      "other-agricultural-machines",
      "agricultural-harvesters",
    ]);
    expect(res.lookups.countries).toEqual(["DE", "US"]);
    expect(res.lookups.assignees).toEqual([{ id: "u1", label: "alice" }]);
  });

  it("assignedToName 通过一次 in 查询批量补全", async () => {
    useInMemoryTable([
      mkRow({ id: "a", assignedTo: "u1" }),
      mkRow({ id: "b", assignedTo: "u1" }),
    ]);
    const res = await listMascusListings({});

    expect(res.items[0].assignedToName).toBe("alice");
    const nameCalls = h.userFindMany.mock.calls.filter(
      (c) => (c[0] as { where?: { id?: { in?: string[] } } })?.where?.id?.in !== undefined
    );
    expect(nameCalls).toHaveLength(1);
    expect((nameCalls[0][0] as { where: { id: { in: string[] } } }).where.id.in).toEqual(["u1"]);
  });
});

// ───────────────────────────────────────────────
// 5. 卖家聚合
// ───────────────────────────────────────────────

describe("aggregateBySeller：按归一后的电话归并", () => {
  it("同一卖家 3 种写法归成 1 组，listingCount 正确，写法种数如实体现", async () => {
    const rows = [
      mkRow({ id: "a", sellerPhone: "+1 419-529-6160", priceEuro: 1000 }),
      mkRow({ id: "b", sellerPhone: "+14195296160", priceEuro: 3000 }),
      mkRow({ id: "c", sellerPhone: "1 (419) 529-6160", priceEuro: null }),
    ];
    h.count.mockResolvedValue(rows.length);
    h.findMany.mockResolvedValue(rows);

    const groups = await aggregateBySeller({});

    expect(groups).toHaveLength(1);
    expect(groups[0].phoneKeyMasked).toBe("419****6160");
    expect(groups[0].listingCount).toBe(3);
    expect(groups[0].phoneVariants).toHaveLength(3);
    // sampleListingId 必须是桶内真实存在的一条线索 id（供前端调详情接口看明文）
    expect(rows.map((r) => r.id)).toContain(groups[0].sampleListingId);
    expect(groups[0].priceMinEuro).toBe(1000);
    expect(groups[0].priceMaxEuro).toBe(3000);
  });

  it("两台机器同一写法 ⇒ 1 组、listingCount=2", async () => {
    const rows = [
      mkRow({ id: "a", sellerPhone: "+1 419-529-6160" }),
      mkRow({ id: "b", sellerPhone: "+1 419-529-6160" }),
    ];
    h.count.mockResolvedValue(rows.length);
    h.findMany.mockResolvedValue(rows);

    const groups = await aggregateBySeller({});
    expect(groups).toHaveLength(1);
    expect(groups[0].listingCount).toBe(2);
    expect(groups[0].phoneVariants).toEqual([{ masked: "141****6160", count: 2 }]);
  });

  it("sellerPhone 为 null 的行不出现（否则 top1 永远是 null 卖家）", async () => {
    const rows = [
      mkRow({ id: "a", sellerPhone: null }),
      mkRow({ id: "b", sellerPhone: null }),
      mkRow({ id: "c", sellerPhone: "+1 419-529-6160" }),
    ];
    h.count.mockResolvedValue(rows.length);
    h.findMany.mockResolvedValue(rows);

    const groups = await aggregateBySeller({});
    expect(groups).toHaveLength(1);
    expect(groups[0].listingCount).toBe(1);
    expect(groups.some((g) => !g.phoneKeyMasked || g.phoneKeyMasked.length === 0)).toBe(false);
    expect(groups[0].phoneKeyMasked).toBe("419****6160");
  });

  it("下发的 where 带 sellerPhone not null", async () => {
    h.count.mockResolvedValue(0);
    h.findMany.mockResolvedValue([]);
    await aggregateBySeller({ segment: "tractors" });
    const args = h.findMany.mock.calls.at(-1)?.[0] as { where: Record<string, unknown> };
    expect(args.where.sellerPhone).toEqual({ not: null });
    expect(args.where.scanSegment).toBe("tractors");
  });

  it("组内公司名/国家取众数，assignedTo 取第一个非空", async () => {
    const rows = [
      mkRow({ id: "a", sellerPhone: "4195296160", companyName: "A", locationCountry: "US", assignedTo: null }),
      mkRow({ id: "b", sellerPhone: "4195296160", companyName: "B", locationCountry: "US", assignedTo: "u1" }),
      mkRow({ id: "c", sellerPhone: "4195296160", companyName: "B", locationCountry: "DE", assignedTo: null }),
    ];
    h.count.mockResolvedValue(rows.length);
    h.findMany.mockResolvedValue(rows);

    const groups = await aggregateBySeller({});
    expect(groups[0].companyName).toBe("B"); // 出现 2 次 > A 的 1 次
    expect(groups[0].locationCountry).toBe("US"); // 并列 1:1 → 取最先出现的非空
    expect(groups[0].assignedTo).toBe("u1"); // 第一个非空
  });

  it("超过阈值时走候选电话路径（先 groupBy 再 in 反查）", async () => {
    h.count.mockResolvedValue(6000);
    h.groupBy.mockResolvedValue([{ sellerPhone: "+1 419-529-6160", _count: { _all: 6000 } }]);
    h.findMany.mockResolvedValue([mkRow({ id: "a", sellerPhone: "+1 419-529-6160" })]);

    const groups = await aggregateBySeller({});

    expect(h.groupBy).toHaveBeenCalled();
    const args = h.findMany.mock.calls.at(-1)?.[0] as { where: Record<string, unknown> };
    expect(args.where.sellerPhone).toEqual({ in: ["+1 419-529-6160"] });
    expect(groups[0].listingCount).toBe(1);
  });

  /**
   * 🔴 防回归核心：聚合视图属于「列表」，序列化结果里绝不能出现任何可拨号明文。
   * 一旦有人把 `phoneKeyMasked` 改回明文 `phoneKey`、或把 `phoneVariants` 改回
   * `raw`，下面任一断言都会挂 —— 这是本次 PII 修复的锁。
   */
  it("🔴 聚合视图不得下发明文电话（phoneKey / 各原始写法 / 归一数字串均不可出现在序列化结果里）", async () => {
    const rows = [
      mkRow({ id: "a", sellerPhone: "+1 419-529-6160" }),
      mkRow({ id: "b", sellerPhone: "+14195296160" }),
      mkRow({ id: "c", sellerPhone: "1 (419) 529-6160" }),
    ];
    h.count.mockResolvedValue(rows.length);
    h.findMany.mockResolvedValue(rows);

    const groups = await aggregateBySeller({});
    const serialized = JSON.stringify(groups);

    expect(serialized).not.toContain("+1 419-529-6160");
    expect(serialized).not.toContain("4195296160");
    expect(serialized).not.toContain("+14195296160");
    // 明文只应存在于「归一 key 的掩码」与「各写法的掩码」里
    expect(groups).toHaveLength(1);
    expect(groups[0].phoneKeyMasked).toBe("419****6160");
    expect(groups[0].phoneVariants).toHaveLength(3); // 写法种数信息必须保留
    expect(groups[0].phoneVariants.every((v) => v.masked.includes("****"))).toBe(true);
    expect(groups[0].sampleListingId).toBe("a");
    // 内部排序键不得随输出下发
    expect(Object.keys(groups[0])).not.toContain("_sortKey");
    expect(Object.keys(groups[0])).not.toContain("phoneKey");
  });
});

// ───────────────────────────────────────────────
// 品牌聚合
// ───────────────────────────────────────────────

describe("aggregateByBrand", () => {
  it("合并总表与带电话表，剔除空品牌，按数量降序", async () => {
    h.groupBy.mockImplementation(async (args: Record<string, unknown>) => {
      const hasPhoneFilter = (args.where as Record<string, unknown>)?.sellerPhone !== undefined;
      if (hasPhoneFilter) {
        return [{ brandName: "John Deere", _count: { _all: 2 } }];
      }
      return [
        { brandName: "John Deere", _count: { _all: 5 } },
        { brandName: "Claas", _count: { _all: 1 } },
        { brandName: null, _count: { _all: 3 } },
        { brandName: "  ", _count: { _all: 1 } },
      ];
    });

    const groups = await aggregateByBrand({});
    expect(groups).toEqual([
      { brandName: "John Deere", listingCount: 5, withPhoneCount: 2 },
      { brandName: "Claas", listingCount: 1, withPhoneCount: 0 },
    ]);
  });
});

// ───────────────────────────────────────────────
// 6/7. 更新
// ───────────────────────────────────────────────

describe("updateMascusListing", () => {
  it("非法 followStatus 抛 MascusQueryError 且不落库", async () => {
    await expect(
      updateMascusListing("id-1", { followStatus: "随便写" }, "actor-1")
    ).rejects.toBeInstanceOf(MascusQueryError);

    await expect(
      updateMascusListing("id-1", { followStatus: "" }, "actor-1")
    ).rejects.toThrow(/跟进状态非法/);

    expect(h.executeRaw).not.toHaveBeenCalled();
  });

  it("MascusQueryError 被 mapMascusError 映射成 400 信封", () => {
    const mapped = mapMascusError(new MascusQueryError("跟进状态非法", 400, "VALIDATION_ERROR"));
    expect(mapped.status).toBe(400);
    expect(mapped.body).toEqual({
      success: false,
      error: "跟进状态非法",
      code: "VALIDATION_ERROR",
    });
  });

  it("🔴 绝不写 lastSeenAt（走定向 SQL，不经过 @updatedAt）", async () => {
    h.executeRaw.mockResolvedValue(1);
    h.findUnique.mockResolvedValue(mkRow({ id: "id-1" }));

    await updateMascusListing("id-1", { followStatus: "已联系", note: "打过电话" }, "actor-1");

    expect(h.executeRaw).toHaveBeenCalledTimes(1);
    const statement = h.executeRaw.mock.calls[0][0] as { sql: string; values: unknown[] };
    // SQL 里只碰这 3 列，绝无 lastSeenAt / firstSeenAt
    expect(statement.sql).not.toContain("lastSeenAt");
    expect(statement.sql).not.toContain("firstSeenAt");
    expect(statement.sql).toContain('"followStatus"');
    expect(statement.sql).toContain('"note"');
    expect(statement.sql).toContain('WHERE "id" = ?');
    // 没传 assignedTo ⇒ 不产生 assignedAt 的 Date 参数
    expect(statement.values.some((v) => v instanceof Date)).toBe(false);
  });

  it("传 assignedTo=null 时 assignedTo 与 assignedAt 一起清空", async () => {
    h.executeRaw.mockResolvedValue(1);
    h.findUnique.mockResolvedValue(mkRow({ id: "id-1" }));

    await updateMascusListing("id-1", { assignedTo: null }, "actor-1");

    const statement = h.executeRaw.mock.calls[0][0] as { sql: string; values: unknown[] };
    expect(statement.sql).toContain('"assignedTo" = NULL');
    expect(statement.sql).toContain('"assignedAt" = NULL');
    expect(statement.values).toEqual(["id-1"]);
  });

  it("分配负责人时校验角色并同步 assignedAt=now", async () => {
    h.executeRaw.mockResolvedValue(1);
    h.findUnique.mockResolvedValue(mkRow({ id: "id-1", assignedTo: "u1" }));
    h.userFindUnique.mockResolvedValue({ id: "u1", role: "editor", isActive: true });

    await updateMascusListing("id-1", { assignedTo: "u1" }, "actor-1");

    const statement = h.executeRaw.mock.calls[0][0] as { sql: string; values: unknown[] };
    expect(statement.sql).toContain('"assignedAt" = ?');
    expect(statement.values.some((v) => v instanceof Date)).toBe(true);
  });

  it("负责人角色非法 / 已停用 ⇒ ASSIGNEE_INVALID 且不落库", async () => {
    h.userFindUnique.mockResolvedValue({ id: "u9", role: "buyer", isActive: true });
    await expect(updateMascusListing("id-1", { assignedTo: "u9" }, "actor-1")).rejects.toMatchObject({
      code: "ASSIGNEE_INVALID",
    });

    h.userFindUnique.mockResolvedValue({ id: "u9", role: "admin", isActive: false });
    await expect(updateMascusListing("id-1", { assignedTo: "u9" }, "actor-1")).rejects.toMatchObject({
      code: "ASSIGNEE_INVALID",
    });

    expect(h.executeRaw).not.toHaveBeenCalled();
  });

  it("空 body 抛 VALIDATION_ERROR", async () => {
    await expect(updateMascusListing("id-1", {}, "actor-1")).rejects.toMatchObject({
      code: "VALIDATION_ERROR",
    });
  });

  it("更新不存在的 id ⇒ NOT_FOUND", async () => {
    h.executeRaw.mockResolvedValue(0);
    await expect(
      updateMascusListing("missing", { note: "x" }, "actor-1")
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});
