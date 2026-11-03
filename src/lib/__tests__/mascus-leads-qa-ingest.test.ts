/**
 * mascus 线索链路 — QA 对抗性补充测试（采集编排层 / 第二轮）
 *
 * 定位：`src/lib/__tests__/mascus-leads.test.ts` 已覆盖主链路（SITE 闸门、dryRun、
 * emptySegments、幂等 upsert、跨段去重计数）。本文件只补**它没覆盖的失败面与统计口径**，
 * 用来把审查结论钉成回归测试。不改动 ingest.ts / parse.ts 任何一行。
 *
 * 通过 mock `@/lib/db`（不连库）与 `globalThis.fetch`（不出网）跑完整编排流程。
 *
 * 钉住的怀疑点（**收尾轮已全部闭环，断言已同步为修复后的语义**）：
 *   A. `bySegment` 是「去重前原始命中数」，sum(bySegment) 可以大于 uniqueItems（口径保留）；
 *   B. 段内「部分页失败」由 failedPages / ok=false 表达，**不再**由 truncatedSegments 定位
 *      （两者语义不同：一个该重试，一个该调大 maxPages）；
 *   C. `totalResults > maxPages × 40`（结构性截断）才由 truncatedSegments 显式报出；
 *   D. `MAX_CONSECUTIVE_PAGE_FAILURES` 已调为 2（小于 DEFAULT_MAX_PAGES 5），skip 分支可达；
 *   E. `update` 载荷不含 firstSeenAt / lastSeenAt / createdAt，且不再重写 raw（raw 只在 create 写）；
 *   F. 写库是**逐条串行** upsert（600 条 = 600 次 RTT），但写库前会再判一次 budgetMs；
 *   G. 抓取参数：redirect=follow + 落点 host 校验、带浏览器 UA、no-store。
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

/** 用 vi.hoisted 保证 mock 工厂在模块 import 之前就拿到 spy */
const h = vi.hoisted(() => ({
  findMany: vi.fn(),
  upsert: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    mascusListing: {
      findMany: h.findMany,
      upsert: h.upsert,
    },
  },
}));

import { ingestMascusLeads } from "@/lib/mascus-leads/ingest";

const SEG_A = "/agriculture/tractors";
const SEG_B = "/agriculture/tillage-machines";

/** 一条 item（字段名对齐真实 mascus item） */
function rawItem(productId: string) {
  return {
    productId,
    brand: "Fendt",
    model: "724",
    categoryName: "tractors",
    catalogName: "agriculture",
    locationCountryCode: "DE",
    locationCity: "Vechta",
    companyName: "Landtechnik Vechta",
    sellerPhone: "+49 4441 123",
    priceEURO: 0,
    createDate: "2026-11-03T00:02:53.857",
  };
}

/** 把 items 包成真实搜索页 HTML */
function pageHtml(items: unknown[], totalResults = items.length): string {
  const payload = { props: { pageProps: { searchRes: { searchData: { items, totalResults } } } } };
  return `<html><body><script id="__NEXT_DATA__">${JSON.stringify(payload)}</script></body></html>`;
}

/** 生成 n 条互不重复的 item */
function itemsFrom(prefix: string, n: number): unknown[] {
  return Array.from({ length: n }, (_, i) => rawItem(`{${prefix}-${i}}`));
}

/** 从 URL 里取 page 号（缺省 1） */
function pageOf(url: string): number {
  const matched = /[?&]page=(\d+)/.exec(url);
  return matched ? Number(matched[1]) : 1;
}

type FetchRoute = (url: string) => Promise<Response> | Response;

/** 安装 fetch mock，返回调用记录 */
function installFetch(route: FetchRoute) {
  const calls: { url: string; init: RequestInit }[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
      calls.push({ url, init: init ?? {} });
      return route(url);
    })
  );
  return calls;
}

function ok(html: string): Response {
  return new Response(html, { status: 200, headers: { "content-type": "text/html" } });
}

beforeEach(() => {
  h.findMany.mockReset().mockResolvedValue([]);
  h.upsert.mockReset().mockResolvedValue({});
  vi.stubEnv("SITE", "com");
  // 关掉预期内的告警噪音，个别用例再按需 spy
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("SITE 合规闸门（补充边界）", () => {
  it("SITE=cn 时在抓取/读库/写库之前抛错（零副作用）", async () => {
    vi.stubEnv("SITE", "cn");
    const calls = installFetch(() => ok(pageHtml(itemsFrom("X", 1))));

    await expect(ingestMascusLeads()).rejects.toThrow(/\[合规\]/);
    expect(calls).toHaveLength(0);
    expect(h.findMany).not.toHaveBeenCalled();
    expect(h.upsert).not.toHaveBeenCalled();
  });

  it("SITE 为空串 / 大写 / 带空格时一律 fail-closed（口径为精确匹配 \"com\"）", async () => {
    installFetch(() => ok(pageHtml(itemsFrom("X", 1))));
    for (const site of ["", "COM", " com", "cn "]) {
      vi.stubEnv("SITE", site);
      await expect(ingestMascusLeads()).rejects.toThrow(/\[合规\]/);
    }
  });

  it("SITE 未设置时按 com 处理，正常采集", async () => {
    // 删除 SITE 以模拟"未配置"，走 `process.env.SITE ?? "com"` 的兜底分支
    delete process.env.SITE;
    const calls = installFetch(() => ok(pageHtml(itemsFrom("X", 1))));

    const result = await ingestMascusLeads({ segmentPaths: [SEG_A], maxPages: 1 });
    expect(result.ok).toBe(true);
    expect(calls).toHaveLength(1);
  });
});

describe("upsert 载荷（幂等语义的关键约束）", () => {
  it("update 载荷不含 firstSeenAt / lastSeenAt / createdAt，也不含 raw（raw 只在 create 写）", async () => {
    installFetch(() => ok(pageHtml([rawItem("{ID-1}")], 1)));

    await ingestMascusLeads({ segmentPaths: [SEG_A], maxPages: 1 });

    const arg = h.upsert.mock.calls[0][0];
    expect(arg.where).toEqual({ productId: "{ID-1}" });
    expect(arg.create.productId).toBe("{ID-1}");
    for (const key of ["firstSeenAt", "lastSeenAt", "createdAt"]) {
      // update 分支绝不能带这三个字段：firstSeenAt 一旦被写就会毁掉"首次发现"语义
      expect(arg.update).not.toHaveProperty(key);
      expect(arg.create).not.toHaveProperty(key);
    }
    // 关键业务字段确实下发
    expect(arg.update).toHaveProperty("sellerPhone", "+49 4441 123");
    expect(arg.update).toHaveProperty("scanSegment", "tractors");
    expect(arg.update).toHaveProperty("listedAt");
    // raw 实测约 1.4KB/行、占整行 ~79% ⇒ 只在 create 写一次作为字段快照，
    // update 不再每轮重写（会变的值都在独立标量列里）
    expect(arg.create).toHaveProperty("raw");
    expect(arg.update).not.toHaveProperty("raw");
  });

  it("写库是逐条串行 upsert：600 条唯一线索 = 600 次 upsert 调用", async () => {
    // 每段 3 页 × 40 条，段间 productId 不重叠
    installFetch((url) => {
      const prefix = url.includes("tractors") ? "A" : "B";
      return ok(pageHtml(itemsFrom(`${prefix}${pageOf(url)}`, 40), 200));
    });

    const result = await ingestMascusLeads({ segmentPaths: [SEG_A, SEG_B], maxPages: 3 });

    expect(result.uniqueItems).toBe(240);
    expect(h.upsert).toHaveBeenCalledTimes(240);
    // UPSERT_BATCH_SIZE=50 只是"分批"（用于日志/连接粒度），并没有批量写入语义
    expect(h.upsert.mock.calls[0][0].where.productId).toBe("{A1-0}");
  });
});

describe("bySegment 统计口径（跨段重复导致虚高）", () => {
  it("sum(bySegment) 大于 uniqueItems：段条数是去重前原始命中数", async () => {
    installFetch((url) =>
      url.includes("tractors")
        ? ok(pageHtml([rawItem("{SHARED}"), rawItem("{A1}")], 2))
        : ok(pageHtml([rawItem("{SHARED}"), rawItem("{B1}")], 2))
    );

    const result = await ingestMascusLeads({ segmentPaths: [SEG_A, SEG_B], maxPages: 1 });

    expect(result.uniqueItems).toBe(3);
    expect(result.bySegment).toEqual({ tractors: 2, "tillage-machines": 2 });
    const sum = Object.values(result.bySegment).reduce((a, b) => a + b, 0);
    // 结论 A：sum=4 > uniqueItems=3。用 bySegment 判断"某段产出多少线索"会系统性高估，
    // 尤其当先扫的段（tractors）把共有机器全部吃掉 scanSegment 之后，后段看起来是"虚高但无贡献"。
    expect(sum).toBe(4);
    expect(sum - result.uniqueItems).toBe(1);
  });

  it("被多段命中的机器，落库 scanSegment 归属「先扫到的段」", async () => {
    installFetch((url) =>
      url.includes("tractors")
        ? ok(pageHtml([rawItem("{SHARED}")], 1))
        : ok(pageHtml([rawItem("{SHARED}")], 1))
    );

    await ingestMascusLeads({ segmentPaths: [SEG_A, SEG_B], maxPages: 1 });

    expect(h.upsert).toHaveBeenCalledTimes(1);
    expect(h.upsert.mock.calls[0][0].update.scanSegment).toBe("tractors");
  });
});

describe("失败路径与不完整性（失败必须可见）", () => {
  it("HTTP 500 单页失败：failedPages+1，其余段继续，ok=false（不再假绿）", async () => {
    installFetch((url) =>
      url.includes("tractors")
        ? new Response("boom", { status: 500 })
        : ok(pageHtml(itemsFrom("B", 2), 2))
    );

    const result = await ingestMascusLeads({ segmentPaths: [SEG_A, SEG_B], maxPages: 1 });

    // ok 现在按实际算：有失败页就不为 true，cron 才能暴露问题
    expect(result.ok).toBe(false);
    expect(result.failedPages).toBe(1);
    expect(result.fetchedPages).toBe(1);
    expect(result.bySegment).toEqual({ tractors: 0, "tillage-machines": 2 });
  });

  it("段内第 1 页成功 / 第 2 页失败，且 maxPages 容量本身也不够：仍报截断", async () => {
    installFetch((url) =>
      pageOf(url) === 1
        ? ok(pageHtml(itemsFrom("P1", 40), 120)) // 自报 120 条，本应还有 2 页
        : new Response("upstream error", { status: 502 })
    );

    const result = await ingestMascusLeads({ segmentPaths: [SEG_A], maxPages: 2 });

    expect(result.fetchedPages).toBe(1);
    expect(result.failedPages).toBe(1);
    expect(result.bySegment.tractors).toBe(40);
    expect(result.uniqueItems).toBe(40);
    // maxPages=2 × 40 = 80 < totalResults=120 ⇒ 即便没有失败页也已结构性截断，故仍标记
    expect(result.truncatedSegments).toEqual(["tractors"]);
    expect(result.emptySegments).toEqual([]);
    expect(result.ok).toBe(false);
  });

  it("🔴 回归：抓取失败导致的少采不得被误报成 maxPages 截断", async () => {
    installFetch((url) =>
      pageOf(url) === 1
        ? ok(pageHtml(itemsFrom("P1", 40), 120)) // 自报 120 条
        : new Response("upstream error", { status: 502 })
    );

    // maxPages=3 ⇒ 容量 3 × 40 = 120，刚好装得下 totalResults=120，结构上不该判截断
    const result = await ingestMascusLeads({ segmentPaths: [SEG_A], maxPages: 3 });

    expect(result.fetchedPages).toBe(1);
    // page2、page3 连败 2 次触发 MAX_CONSECUTIVE_PAGE_FAILURES 兜底放弃
    expect(result.failedPages).toBe(2);
    expect(result.bySegment.tractors).toBe(40);
    // 关键：少采是「失败」不是「截断」，truncatedSegments 必须为空
    expect(result.truncatedSegments).toEqual([]);
    // 但问题依然必须可见：ok=false
    expect(result.ok).toBe(false);
  });

  it("consecutiveFailures 阈值 2（必须小于 maxPages，否则该分支永远走不到）", async () => {
    const calls = installFetch(() => new Response("nope", { status: 503 }));

    const result = await ingestMascusLeads({ segmentPaths: [SEG_A] });

    // 阈值 2 < maxPages 默认 5 ⇒ 第 2 页失败后立刻放弃该段，不再白打第 3/4/5 页
    expect(result.failedPages).toBe(2);
    expect(calls).toHaveLength(2);
    expect(result.ok).toBe(false);
  });

  it("网络层抛错（AbortError）计入 failedPages，不炸整轮", async () => {
    installFetch(() => {
      const err = new Error("The operation was aborted");
      err.name = "AbortError";
      throw err;
    });

    const result = await ingestMascusLeads({ segmentPaths: [SEG_A], maxPages: 1 });
    expect(result.failedPages).toBe(1);
    expect(result.ok).toBe(false);
  });

  it("反爬页面（200 + 无 __NEXT_DATA__）被当作「成功且 0 条新挂牌」", async () => {
    installFetch(() => ok("<html><body>Cloudflare challenge page</body></html>"));

    const result = await ingestMascusLeads({ segmentPaths: [SEG_A], maxPages: 2 });

    expect(result.failedPages).toBe(0);
    expect(result.fetchedPages).toBe(1); // 第一页 0 条 → 判定末页
    expect(result.ok).toBe(true);
    // 唯一能被发现的信号：emptySegments（新增的死段防线）
    expect(result.emptySegments).toEqual(["tractors"]);
  });
});

describe("截断：totalResults 大于抓到的条数必须可见", () => {
  it("totalResults=400 / maxPages=3 ⇒ 只入库 120 条，但 truncatedSegments 会报出来", async () => {
    const calls = installFetch((url) => ok(pageHtml(itemsFrom(`P${pageOf(url)}`, 40), 400)));

    const result = await ingestMascusLeads({ segmentPaths: [SEG_A], maxPages: 3 });

    expect(calls).toHaveLength(3);
    expect(result.uniqueItems).toBe(120);
    expect(result.bySegment.tractors).toBe(120);
    // 少采 280 条，但至少能看见：该段被标记为截断（靠次日累积 + 幂等 upsert 补全）
    expect(result.truncatedSegments).toEqual(["tractors"]);
  });

  it("totalResults 收敛生效：抓到条数达到 totalResults 后不再请求下一页", async () => {
    const calls = installFetch((url) => ok(pageHtml(itemsFrom(`Q${pageOf(url)}`, 40), 45)));

    const result = await ingestMascusLeads({ segmentPaths: [SEG_A], maxPages: 3 });

    // 第 1 页 40 < 45 → 抓第 2 页；第 2 页后 segmentItems=80 ≥ 45 → 收工（不发第 3 页）
    expect(calls).toHaveLength(2);
    expect(result.uniqueItems).toBe(80);
  });
});

describe("dryRun 语义", () => {
  it("dryRun=true 不写库，但仍然读库（findMany 照样打）", async () => {
    h.findMany.mockResolvedValue([{ productId: "{ID-1}" }]);
    installFetch(() => ok(pageHtml([rawItem("{ID-1}"), rawItem("{ID-2}")], 2)));

    const result = await ingestMascusLeads({ segmentPaths: [SEG_A], maxPages: 1, dryRun: true });

    expect(h.upsert).not.toHaveBeenCalled();
    expect(h.findMany).toHaveBeenCalledTimes(1);
    expect(result.inserted).toBe(1);
    expect(result.updated).toBe(1);
  });

  it("dryRun=true 时表不存在（P2021）会直接冒泡 ⇒ 无法用于「建表前」预演", async () => {
    h.findMany.mockRejectedValue(
      Object.assign(new Error("The table `MascusListing` does not exist in the current database."), {
        code: "P2021",
      })
    );
    installFetch(() => ok(pageHtml([rawItem("{ID-1}")], 1)));

    await expect(
      ingestMascusLeads({ segmentPaths: [SEG_A], maxPages: 1, dryRun: true })
    ).rejects.toThrow(/does not exist/);
  });

  it("0 条线索时完全不碰数据库（连 findMany 都不发）", async () => {
    installFetch(() => ok(pageHtml([], 0)));

    await ingestMascusLeads({ segmentPaths: [SEG_A], maxPages: 1 });

    expect(h.findMany).not.toHaveBeenCalled();
    expect(h.upsert).not.toHaveBeenCalled();
  });
});

describe("抓取参数（安全面）", () => {
  it("带浏览器 UA、cache=no-store、signal 为 AbortSignal 实例（非 AbortSignal.timeout）", async () => {
    const calls = installFetch(() => ok(pageHtml([rawItem("{S1}")], 1)));

    await ingestMascusLeads({ segmentPaths: [SEG_A], maxPages: 1, timeoutMs: 1234 });

    const { init } = calls[0];
    expect(init.method).toBe("GET");
    expect((init.headers as Record<string, string>)["user-agent"]).toContain("Mozilla/5.0");
    expect(init.cache).toBe("no-store");
    expect(init.signal).toBeInstanceOf(AbortSignal);
    expect((init.signal as AbortSignal).aborted).toBe(false);
  });

  it("redirect=follow（不改成 manual，避免正常跳转被误判失败），但落点必须在 mascus 域内", async () => {
    const calls = installFetch(() => ok(pageHtml([rawItem("{S2}")], 1)));

    await ingestMascusLeads({ segmentPaths: [SEG_A], maxPages: 1 });

    expect(calls[0].init.redirect).toBe("follow");

    // 落点被 30x 带离 mascus 域 ⇒ 该页计为失败（fetchHtml 里的 host 断言）
    installFetch(() => {
      const res = ok(pageHtml([rawItem("{S2}")], 1));
      Object.defineProperty(res, "url", { value: "https://evil.example.com/steal" });
      return res;
    });
    const result = await ingestMascusLeads({ segmentPaths: [SEG_A], maxPages: 1 });
    expect(result.failedPages).toBe(1);
    expect(result.fetchedPages).toBe(0);
    expect(result.items).toBe(0);
    expect(result.ok).toBe(false);
  });

  it("所有请求 URL 都锁在 https://www.mascus.com 域内（外部路径无法逃逸）", async () => {
    const calls = installFetch(() => ok(pageHtml([rawItem("{S3}")], 1)));

    await ingestMascusLeads({
      segmentPaths: [SEG_A, "https://evil.example.com/x"],
      maxPages: 1,
    });

    expect(calls.length).toBeGreaterThan(0);
    for (const { url } of calls) {
      expect(new URL(url).origin).toBe("https://www.mascus.com");
    }
  });
});
