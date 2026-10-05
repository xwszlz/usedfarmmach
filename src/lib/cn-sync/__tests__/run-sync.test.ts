/**
 * Stage 1 单元测试：增量同步核心（run-sync / cn-export-client）
 *
 * 运行：npm run test:cn-sync-s1
 *       （等价：npx tsx src/lib/cn-sync/__tests__/run-sync.test.ts）
 * （仓库未引入 vitest / jest，故用零依赖的 node:assert 断言脚本，退出码非 0 即失败）
 *
 * ⚠️ 本测试**不触碰任何数据库**：
 * - 纯函数（normalize / sha256 / contentHash / mapProductScalars）直接断言；
 * - 分页循环通过注入 `fetchPage`（内存模拟服务端 keyset）验证，无网络；
 * - 冲突守卫通过注入「假 Prisma 客户端」，断言**不触发任何写库调用**。
 * → run-sync / cn-export-client / runtime 均未在顶层静态 import `@/lib/db`，
 *   故此文件加载时不会构造真实 PrismaClient（避免连生产库）。
 */
import assert from "node:assert/strict";
import type { PrismaClient } from "@prisma/client";
import {
  normalize,
  contentHash,
  mapProductScalars,
  upsertProduct,
  runCnProductSync,
} from "../run-sync";
import { iterateIncremental, type FetchPageFn, type CnExportItem } from "../cn-export-client";
import { reconcile } from "../reconcile";
import type { GroupPushPayload } from "@/lib/wecom/group-webhook";

let passed = 0;
const failures: string[] = [];

async function it(name: string, fn: () => void | Promise<void>): Promise<void> {
  try {
    await fn();
    passed++;
    console.log(`  \u2713 ${name}`);
  } catch (e) {
    failures.push(name);
    console.error(`  \u2717 ${name}\n      ${e instanceof Error ? e.message : String(e)}`);
  }
}

const FORBIDDEN = [
  "latitude",
  "longitude",
  "sellerId",
  "contactName",
  "contactPhone",
  "contactWechat",
  "contactEmail",
];

/** 构造一条含敏感字段的出境 item（模拟 .cn 导出行，故意夹带禁字段） */
function sampleItem(): CnExportItem {
  return {
    id: "cmdemo0000000000000000001",
    modelName: "Jaguar 970",
    year: 2020,
    condition: "used",
    priceCny: 580000,
    priceUsd: 80000,
    location: "河北 石家庄",
    province: "河北",
    city: "石家庄",
    country: "CN",
    descriptionZh: "9成新",
    priceMode: "por",
    tradeTerm: "FOB",
    tradePort: "天津港",
    enginePower: 626,
    engineType: "diesel",
    driveSystem: "4WD",
    mainConfig: "豪华配置",
    netWeight: 12000,
    overallLength: 9.2,
    overallWidth: 3.0,
    overallHeight: 3.8,
    status: "active",
    aiGenerated: false,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-02-01T00:00:00.000Z",
    // ↓↓↓ 绝不应被映射/出境 ↓↓↓
    latitude: 38.0428,
    longitude: 114.5149,
    sellerId: "cluser0000000000000000001",
    contactName: "张三",
    contactPhone: "13800000000",
    contactWechat: "zhangsan",
    contactEmail: "zhangsan@example.com",
    brand: { nameZh: "克拉斯", nameEn: "CLAAS", originCountry: "DE", isImported: true },
    category: { nameZh: "青贮收获机", nameEn: "Forage Harvester" },
    images: [{ url: "https://oss.example.com/a.jpg", sortOrder: 0, isPrimary: true }],
    videos: [
      { url: "https://oss.example.com/v.mp4", sortOrder: 0, title: "作业视频", duration: 30, moderationStatus: "approved" },
    ],
  };
}

async function main(): Promise<void> {
  console.log("run-sync 单元测试");

  // ── 1. normalize 稳定序列化：字段顺序无关 ──
  await it("normalize()：字段顺序不同 → 产物相同", () => {
    const a = normalize({ b: 1, a: { d: 2, c: 3 }, list: [{ y: 1, x: 2 }] });
    const b = normalize({ list: [{ x: 2, y: 1 }], a: { c: 3, d: 2 }, b: 1 });
    assert.equal(a, b);
  });

  await it("contentHash()：仅字段顺序不同 → 同 hash", () => {
    const item = sampleItem();
    const reordered: CnExportItem = {
      ...item,
      brand: { isImported: true, originCountry: "DE", nameEn: "CLAAS", nameZh: "克拉斯" },
    };
    assert.equal(contentHash(item), contentHash(reordered));
  });

  await it("contentHash()：内容变化 → hash 变化", () => {
    const item = sampleItem();
    const changed: CnExportItem = { ...item, priceCny: 999999 };
    assert.notEqual(contentHash(item), contentHash(changed));
  });

  // ── 2. mapProductScalars 不含禁字段 ──
  await it("mapProductScalars()：输出不含 latitude/longitude/sellerId/contact*", () => {
    const out = mapProductScalars(sampleItem()) as unknown as Record<string, unknown>;
    for (const f of FORBIDDEN) {
      assert.ok(!(f in out), `映射结果不应包含禁字段 ${f}`);
    }
    const json = JSON.stringify(out);
    for (const f of FORBIDDEN) {
      assert.ok(!json.includes(`"${f}"`), `序列化后不应包含禁字段 key ${f}`);
    }
    // 公开字段被保留
    assert.equal(out.modelName, "Jaguar 970");
    assert.equal(out.priceCny, 580000);
    assert.equal(out.location, "河北 石家庄");
    assert.equal(out.status, undefined, "status 由调用方单独处理，不属 scalars");
    assert.equal(out.id, undefined, "id 由调用方单独处理，不属 scalars");
  });

  // ── 3. 分页循环：同毫秒多行（≥5、limit=2）不漏不重；<limit 时停止 ──
  await it("iterateIncremental()：同毫秒 6 条 + 跨毫秒 2 条，limit=2 逐页拉完不漏不重", async () => {
    const rows = [
      { id: "a3", t: 1000 },
      { id: "a1", t: 1000 },
      { id: "a6", t: 1000 },
      { id: "a2", t: 1000 },
      { id: "a5", t: 1000 },
      { id: "a4", t: 1000 },
      { id: "b2", t: 2000 },
      { id: "b1", t: 2000 },
    ];
    const sorted = [...rows].sort(
      (x, y) => x.t - y.t || (x.id < y.id ? -1 : x.id > y.id ? 1 : 0)
    );
    const fakeFetchPage: FetchPageFn = async ({ since, sinceId, limit }) => {
      const s = since ? Number(since) : null;
      let pool = sorted;
      if (s !== null) {
        pool = sinceId
          ? sorted.filter((r) => r.t > s || (r.t === s && r.id > sinceId))
          : sorted.filter((r) => r.t > s);
      }
      const page = pool.slice(0, limit);
      const last = page[page.length - 1];
      return {
        items: page.map((r) => ({ id: r.id })),
        nextSince: last ? String(last.t) : null,
        nextId: last ? last.id : null,
      };
    };

    const seen: string[] = [];
    const res = await iterateIncremental(
      async (item) => {
        seen.push(item.id);
      },
      { fetchPage: fakeFetchPage, limit: 2 }
    );
    assert.equal(res.error, null);
    assert.equal(seen.length, 8, `应拉到 8 条，实际 ${seen.length}`);
    assert.equal(new Set(seen).size, 8, "不应出现重复");
    assert.equal(res.pages, 5, `应为 5 页（4 满页 + 1 空页），实际 ${res.pages}`);
  });

  await it("iterateIncremental()：items.length < limit 时停止（limit=5 → 2 页）", async () => {
    const rows = Array.from({ length: 8 }, (_, i) => ({ id: `x${i}`, t: 1000 }));
    const sorted = [...rows].sort((x, y) => (x.id < y.id ? -1 : 1));
    const fakeFetchPage: FetchPageFn = async ({ since, sinceId, limit }) => {
      const s = since ? Number(since) : null;
      let pool = sorted;
      if (s !== null) {
        pool = sinceId
          ? sorted.filter((r) => r.t > s || (r.t === s && r.id > sinceId))
          : sorted.filter((r) => r.t > s);
      }
      const page = pool.slice(0, limit);
      const last = page[page.length - 1];
      return {
        items: page.map((r) => ({ id: r.id })),
        nextSince: last ? String(last.t) : null,
        nextId: last ? last.id : null,
      };
    };
    const seen: string[] = [];
    const res = await iterateIncremental(async (i) => void seen.push(i.id), {
      fetchPage: fakeFetchPage,
      limit: 5,
    });
    assert.equal(seen.length, 8);
    assert.equal(new Set(seen).size, 8);
    assert.equal(res.pages, 2, `应在第 2 页（3 条 < 5）停止，实际 ${res.pages}`);
  });

  await it("iterateIncremental()：fetchPage 返回 null（接口不可达）→ 停止并回报 error", async () => {
    const res = await iterateIncremental(async () => {}, {
      fetchPage: async () => null,
      limit: 2,
    });
    assert.equal(res.error, "export-unreachable");
    assert.equal(res.processed, 0);
  });

  // ── 4. 冲突守卫：无 map 且 .com 已有同 id（**非同属系统卖家**）→ conflict 且不写库 ──
  await it("upsertProduct()：id 被非同步产品占用（卖家不符）→ 返回 conflict 且不触发任何写库", async () => {
    const calls = { productUpsert: 0, transaction: 0, mapUpsert: 0 };
    const fake = {
      productSyncMap: {
        findUnique: async () => null, // 从未登记
        update: async () => ({}),
        upsert: async () => {
          calls.mapUpsert++;
          return {};
        },
      },
      product: {
        // .com 已有同 id，但归属「非系统卖家」（other-seller）→ 真冲突
        findUnique: async () => ({ id: "cmdemo0000000000000000001", sellerId: "other-seller" }),
        upsert: async () => {
          calls.productUpsert++;
          return {};
        },
      },
      $transaction: async () => {
        calls.transaction++;
        return {};
      },
      user: { findUnique: async () => ({ id: "seller1" }) },
      brand: { findFirst: async () => null, create: async () => ({ id: "b1" }) },
      category: { findFirst: async () => null, create: async () => ({ id: "c1" }) },
      cnSyncRunLog: { create: async () => ({}) },
    } as unknown as PrismaClient;

    const result = await upsertProduct(fake, sampleItem());
    assert.equal(result.result, "conflict");
    assert.equal(result.brandMismatchBrand, null);
    assert.equal(result.lineageWarning, null);
    assert.equal(calls.productUpsert, 0, "冲突时绝不应 upsert 产品");
    assert.equal(calls.transaction, 0, "冲突时绝不应开启写事务");
    assert.equal(calls.mapUpsert, 0, "冲突时绝不应写账本");
  });

  // ── 4b. 认领（adopt）：无 map 且 .com 已有同 id（**同属系统卖家**）→ adopted，仅补账本 ──
  await it("upsertProduct()：同 id 且同属系统卖家 → 认领（adopted），不写 Product、不改字段", async () => {
    const item = sampleItem();
    const calls = {
      productUpsert: 0,
      transaction: 0,
      mapUpsert: 0,
      brandFindFirst: 0,
      brandCreate: 0,
      categoryFindFirst: 0,
      categoryCreate: 0,
    };
    const mapUpsertArgs: Array<{ where?: unknown; create?: unknown; update?: unknown }> = [];
    const fake = {
      productSyncMap: {
        findUnique: async () => null, // 从未登记
        update: async () => ({}),
        upsert: async (args: { where?: unknown; create?: unknown; update?: unknown }) => {
          calls.mapUpsert++;
          mapUpsertArgs.push(args);
          return {};
        },
      },
      product: {
        // .com 已有同 id，归属「系统卖家」（seller1）且机型/年份一致 → 历史产品 → 认领（无血缘告警）
        findUnique: async () => ({
          id: item.id,
          sellerId: "seller1",
          modelName: "Jaguar 970",
          year: 2020,
        }),
        upsert: async () => {
          calls.productUpsert++;
          return {};
        },
      },
      $transaction: async () => {
        calls.transaction++;
        return {};
      },
      user: { findUnique: async () => ({ id: "seller1" }) },
      brand: {
        findFirst: async () => {
          calls.brandFindFirst++;
          return null;
        },
        create: async () => {
          calls.brandCreate++;
          return { id: "b1" };
        },
      },
      category: {
        findFirst: async () => {
          calls.categoryFindFirst++;
          return null;
        },
        create: async () => {
          calls.categoryCreate++;
          return { id: "c1" };
        },
      },
      cnSyncRunLog: { create: async () => ({}) },
    } as unknown as PrismaClient;

    const result = await upsertProduct(fake, item);
    assert.equal(result.result, "adopted");
    assert.equal(result.brandMismatchBrand, null);
    assert.equal(result.lineageWarning, null, "机型/年份一致 → 不应有血缘告警");
    assert.equal(calls.productUpsert, 0, "认领时绝不应写 Product");
    assert.equal(calls.transaction, 0, "认领时绝不应开启写事务");
    assert.equal(calls.mapUpsert, 1, "认领时应补写账本 1 次");
    // 账本应登记为同 id 直通 + isActive
    const created = (mapUpsertArgs[0]?.create ?? {}) as Record<string, unknown>;
    assert.equal(created.cnProductId, item.id);
    assert.equal(created.neonProductId, item.id);
    assert.equal(created.isActive, true);
    // 认领分支不解析品牌/分类（保持既有 .com 产品不动）
    assert.equal(calls.brandFindFirst, 0, "认领时不应查品牌");
    assert.equal(calls.brandCreate, 0, "认领时不应建品牌");
    assert.equal(calls.categoryFindFirst, 0, "认领时不应查分类");
    assert.equal(calls.categoryCreate, 0, "认领时不应建分类");
  });

  // ── 4c. 血缘校验：同 id 同卖家但机型不符 → 仍认领，但给出 lineageWarning（不静默） ──
  await it("upsertProduct()：同 id 同卖家但 modelName 不符 → 仍认领，并给出 lineageWarning", async () => {
    const item = sampleItem();
    const calls = { productUpsert: 0, transaction: 0, mapUpsert: 0 };
    const fake = {
      productSyncMap: {
        findUnique: async () => null, // 从未登记
        update: async () => ({}),
        upsert: async () => {
          calls.mapUpsert++;
          return {};
        },
      },
      product: {
        // .com 同 id、同卖家，但机型/年份与 .cn 不符 → cuid 复用嫌疑 → 血缘告警
        findUnique: async () => ({
          id: item.id,
          sellerId: "seller1",
          modelName: "别家机型",
          year: 1999,
        }),
        upsert: async () => {
          calls.productUpsert++;
          return {};
        },
      },
      $transaction: async () => {
        calls.transaction++;
        return {};
      },
      user: { findUnique: async () => ({ id: "seller1" }) },
      brand: { findFirst: async () => null, create: async () => ({ id: "b1" }) },
      category: { findFirst: async () => null, create: async () => ({ id: "c1" }) },
      cnSyncRunLog: { create: async () => ({}) },
    } as unknown as PrismaClient;

    const result = await upsertProduct(fake, item);
    assert.equal(result.result, "adopted", "血缘可疑仍认领（不阻断功能）");
    assert.ok(result.lineageWarning, "应给出非空血缘告警");
    assert.ok(result.lineageWarning.includes(".com 侧"), "告警应包含 .com 侧机型/年份");
    assert.equal(result.brandMismatchBrand, null);
    assert.equal(calls.productUpsert, 0, "血缘可疑也绝不覆盖 Product");
    assert.equal(calls.transaction, 0, "血缘可疑也不应开启写事务");
    assert.equal(calls.mapUpsert, 1, "血缘可疑仍补写账本 1 次");
  });

  await it("upsertProduct()：哈希未变且 isActive → skipped，且不写产品", async () => {
    const item = sampleItem();
    const hash = contentHash(item);
    const calls = { productUpsert: 0, mapUpdated: 0 };
    const fake = {
      productSyncMap: {
        findUnique: async () => ({ cnProductId: item.id, sourceHash: hash, isActive: true }),
        update: async () => {
          calls.mapUpdated++;
          return {};
        },
      },
      product: {
        findUnique: async () => null,
        upsert: async () => {
          calls.productUpsert++;
          return {};
        },
      },
      $transaction: async () => ({}),
      user: { findUnique: async () => ({ id: "seller1" }) },
      brand: { findFirst: async () => null, create: async () => ({ id: "b1" }) },
      category: { findFirst: async () => null, create: async () => ({ id: "c1" }) },
      cnSyncRunLog: { create: async () => ({}) },
    } as unknown as PrismaClient;

    const result = await upsertProduct(fake, item);
    assert.equal(result.result, "skipped");
    assert.equal(result.brandMismatchBrand, null);
    assert.equal(calls.productUpsert, 0, "skipped 时不应写产品");
    assert.equal(calls.mapUpdated, 1, "skipped 时应仅刷新 lastSeenAt（1 次 update）");
  });

  await it("upsertProduct()：既有品牌 isImported=false → 上报 brandMismatchBrand 且不覆盖品牌字段", async () => {
    let brandUpdateCalls = 0;
    const tx = {
      product: { upsert: async () => ({}) },
      productImage: { deleteMany: async () => ({}), createMany: async () => ({}) },
      productVideo: { deleteMany: async () => ({}), createMany: async () => ({}) },
      productSyncMap: { upsert: async () => ({}) },
    };
    const fake = {
      productSyncMap: {
        findUnique: async () => null, // 无账本
        update: async () => ({}),
        upsert: async () => ({}),
      },
      product: { findUnique: async () => null, upsert: async () => ({}) }, // .com 无同 id → 不冲突
      brand: {
        // 既有同名品牌，但 isImported=false（.com 可见性规则将拒绝）
        findFirst: async () => ({ id: "b1", nameZh: "克拉斯", nameEn: "CLAAS", isImported: false }),
        create: async () => ({ id: "bnew" }),
        update: async () => {
          brandUpdateCalls++;
          return {};
        },
      },
      category: { findFirst: async () => ({ id: "c1" }), create: async () => ({ id: "cnew" }) },
      user: { findUnique: async () => ({ id: "seller1" }) },
      cnSyncRunLog: { create: async () => ({}) },
      // 真正执行回调，让事务内部逻辑跑到
      $transaction: async (fn: (t: unknown) => Promise<unknown>) => fn(tx),
    } as unknown as PrismaClient;

    const outcome = await upsertProduct(fake, sampleItem());
    assert.equal(outcome.result, "created");
    assert.deepEqual(outcome.brandMismatchBrand, { brandId: "b1", nameZh: "克拉斯" });
    assert.equal(brandUpdateCalls, 0, "绝不覆盖既有品牌字段（含 isImported）");
  });

  await it("iterateIncremental()：服务端「满页 + 游标不变」→ cursor-stalled 停手（防空转）", async () => {
    let calls = 0;
    const fakeFetchPage: FetchPageFn = async () => {
      calls++;
      // 永远返回满页，且游标恒定不变 → 触发停滞守卫
      return { items: [{ id: "x0" }, { id: "x1" }], nextSince: "1000", nextId: "x1" };
    };
    const seen: string[] = [];
    const res = await iterateIncremental(async (i) => void seen.push(i.id), {
      fetchPage: fakeFetchPage,
      limit: 2,
    });
    assert.equal(res.error, "cursor-stalled");
    assert.equal(res.pages, 2, "应在第 2 页发现游标未推进即停");
    assert.equal(calls, 2);
    assert.equal(seen.length, 4);
  });

  // ── LOW-5：对账单条失败不中断整批 ──
  await it("reconcile()：单条删除抛非外键错 → 不中断整批，计入 skipped 并告警", async () => {
    const tx = {
      valuation: { deleteMany: async () => ({}) },
      productImage: { deleteMany: async () => ({}) },
      productVideo: { deleteMany: async () => ({}) },
      product: {
        delete: async (args: { where: { id: string } }) => {
          if (args.where.id === "p-fail") throw new Error("boom-non-fk");
          return {};
        },
      },
      productSyncMap: { update: async () => ({}) },
    };
    const fake = {
      cnSyncRunLog: { findMany: async () => [], create: async () => ({}) },
      productSyncMap: {
        findMany: async () => [
          { cnProductId: "keep", neonProductId: "p-keep" },
          { cnProductId: "gone-ok", neonProductId: "p-ok" },
          { cnProductId: "gone-fail", neonProductId: "p-fail" },
        ],
        update: async () => ({}),
      },
      product: {
        findUnique: async (args: { where: { id: string } }) =>
          args.where.id === "p-keep"
            ? null
            : { id: args.where.id, brand: null, category: null, images: [], videos: [] },
      },
      productSyncTombstone: { create: async () => ({}) },
      $transaction: async (fn: (t: unknown) => Promise<unknown>) => fn(tx),
    } as unknown as PrismaClient;

    const res = await reconcile({
      client: fake,
      fetchFullIdSet: async () => new Set<string>(["keep"]),
      guardN: 3,
    });
    assert.equal(res.ok, true, "不应因单条失败而整轮中断");
    assert.equal(res.checked, 3);
    assert.equal(res.deleted, 1);
    assert.equal(res.archivedFallback, 0);
    assert.equal(res.skipped, 1, "gone-fail 计 skipped；keep 属 continue 不计");
  });

  // ── 时间预算守卫（Commit 1）：deadlineAt 已过 → 立即停手且不处理任何项 ──
  await it("iterateIncremental()：deadlineAt 已过 → time-budget-exceeded 且不处理任何项", async () => {
    let handled = 0;
    const res = await iterateIncremental(
      async () => {
        handled++;
      },
      {
        fetchPage: async () => ({ items: [{ id: "a" }, { id: "b" }], nextSince: null, nextId: null }),
        limit: 10,
        deadlineAt: Date.now() - 1000,
      }
    );
    assert.equal(res.error, "time-budget-exceeded");
    assert.equal(res.processed, 0);
    assert.equal(handled, 0, "超时后绝不处理任何一项（不半写）");
  });

  await it("runCnProductSync()：时间预算耗尽 → stats.partial=true、日志 status=partial、推独立告警且不误报 ❌", async () => {
    process.env.CN_SYNC_RUN_BUDGET_MS = "5";
    try {
      const alerts: GroupPushPayload[] = [];
      let logStatus: unknown;
      const fake = {
        user: { findUnique: async () => ({ id: "sys-seller" }) },
        productSyncMap: { findUnique: async () => null, update: async () => ({}), upsert: async () => ({}) },
        product: { findUnique: async () => null, upsert: async () => ({}) },
        cnSyncRunLog: {
          create: async (a: { data: { status: unknown } }) => {
            logStatus = a.data.status;
            return {};
          },
        },
      } as unknown as PrismaClient;

      const res = await runCnProductSync({
        client: fake,
        limit: 10,
        fetchPage: async () => {
          await new Promise((r) => setTimeout(r, 30)); // 故意慢于 5ms 预算
          return { items: [{ id: "a" }, { id: "b" }], nextSince: null, nextId: null };
        },
        pushAlert: async (p) => {
          alerts.push(p);
        },
      });
      assert.equal(res.partial, true, "应标记 partial");
      assert.equal(res.ok, false);
      assert.equal(res.error, "time-budget-exceeded");
      assert.equal(logStatus, "partial", "日志 status 必须是 partial（不得为 error，否则拖垮对账护栏②）");
      assert.ok(alerts.some((a) => a.title.includes("未跑完（时间预算耗尽）")), "应推 partial 独立告警");
      assert.ok(!alerts.some((a) => a.title.includes("❌")), "partial 不得复用 ❌ 失败分支");
      assert.equal(res.processed, 0, "超时后不应处理任何项");
    } finally {
      delete process.env.CN_SYNC_RUN_BUDGET_MS;
    }
  });

  // ── 冲突抑制账本（Commit 2）──
  await it("upsertProduct()：同一冲突项第二次出现（hash 未变）→ 抑制告警（conflictAlert=null）", async () => {
    const item = sampleItem();
    const store = new Map<string, any>();
    const calls = { upsert: 0, update: 0 };
    const fake = {
      productSyncMap: { findUnique: async () => null, update: async () => ({}), upsert: async () => ({}) },
      product: {
        findUnique: async () => ({
          id: item.id,
          sellerId: "other-seller",
          modelName: item.modelName,
          year: item.year,
        }),
      },
      user: { findUnique: async () => ({ id: "sys-seller" }) },
      productSyncConflict: {
        findUnique: async (a: any) => store.get(a.where.cnProductId) ?? null,
        upsert: async (a: any) => {
          calls.upsert++;
          store.set(a.where.cnProductId, a.create);
          return {};
        },
        update: async (a: any) => {
          calls.update++;
          store.set(a.where.cnProductId, { ...store.get(a.where.cnProductId), ...a.data });
          return {};
        },
      },
      cnSyncRunLog: { create: async () => ({}) },
    } as unknown as PrismaClient;

    const first = await upsertProduct(fake, item);
    assert.equal(first.result, "conflict");
    assert.ok(first.conflictAlert, "首次冲突应告警");
    const second = await upsertProduct(fake, item);
    assert.equal(second.result, "conflict");
    assert.equal(second.conflictAlert, null, "同 hash 且近期已告警 → 不再告警");
    assert.equal(calls.upsert, 1, "第二次不应再 upsert 账本（走快跳）");
    assert.equal(calls.update, 1, "第二次应只刷 lastSeenAt（1 次 update）");
  });

  await it("runCnProductSync()：多台冲突 → 汇总告警每轮只推 1 条，stats.conflict 仍为总数", async () => {
    const store = new Map<string, any>();
    const alerts: GroupPushPayload[] = [];
    const fake = {
      productSyncMap: { findUnique: async () => null, update: async () => ({}), upsert: async () => ({}) },
      product: {
        findUnique: async (a: any) => ({ id: a.where.id, sellerId: "other-seller", modelName: "X", year: 2000 }),
      },
      user: { findUnique: async () => ({ id: "sys-seller" }) },
      productSyncConflict: {
        findUnique: async (a: any) => store.get(a.where.cnProductId) ?? null,
        upsert: async (a: any) => {
          store.set(a.where.cnProductId, a.create);
          return {};
        },
        update: async (a: any) => {
          store.set(a.where.cnProductId, a.update);
          return {};
        },
      },
      cnSyncRunLog: { create: async () => ({}) },
    } as unknown as PrismaClient;

    const res = await runCnProductSync({
      client: fake,
      limit: 10,
      fetchPage: async () => ({
        items: [{ id: "c1" }, { id: "c2" }, { id: "c3" }],
        nextSince: null,
        nextId: null,
      }),
      pushAlert: async (p) => {
        alerts.push(p);
      },
    });
    assert.equal(res.conflict, 3, "stats.conflict 为本轮遇见总数");
    const conflictMsgs = alerts.filter((a) => a.title.includes("id 冲突已跳过"));
    assert.equal(conflictMsgs.length, 1, "每轮冲突汇总只推 1 条（不再逐台 3 条）");
    assert.ok(conflictMsgs[0].lines.some((l) => l.includes("c1")), "汇总应列出冲突 id");
  });

  await it("upsertProduct()：冲突表缺失（P2021）→ 退化为旧行为且不中断（不抛异常）", async () => {
    const fake = {
      productSyncMap: { findUnique: async () => null, update: async () => ({}), upsert: async () => ({}) },
      product: {
        findUnique: async () => ({ id: "x", sellerId: "other-seller", modelName: "X", year: 2000 }),
      },
      user: { findUnique: async () => ({ id: "sys-seller" }) },
      productSyncConflict: {
        findUnique: async () => {
          throw new Error("P2021: The table `ProductSyncConflict` does not exist");
        },
      },
      cnSyncRunLog: { create: async () => ({}) },
    } as unknown as PrismaClient;

    const res = await upsertProduct(fake, sampleItem());
    assert.equal(res.result, "conflict", "表缺失也应正常判定为 conflict（不抛异常）");
    assert.equal(res.conflictAlert, null, "退化路径不进入汇总告警集合");
  });

  console.log(`\n结果：${passed} passed, ${failures.length} failed`);
  if (failures.length > 0) {
    console.error(`失败用例：\n  - ${failures.join("\n  - ")}`);
    process.exit(1);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
