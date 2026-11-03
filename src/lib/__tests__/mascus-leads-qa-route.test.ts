/**
 * mascus 线索链路 — QA 对抗性补充测试（cron 入口鉴权 / SITE 闸门）
 *
 * 只测 `src/app/api/cron/mascus-leads/route.ts` 的**入口安全面**，把 ingest 整体 mock 掉
 * （既不触网也不连库）。不改动 route.ts 任何一行。
 *
 * 钉住的怀疑点（对应审查项 7）：
 *   ① 是否存在默认密钥兜底 —— 断言 env 全空时任何 token（含常见占位串）都 401；
 *   ② `.cn` 侧是否**先**判 SITE 再鉴权 —— 断言 SITE≠com 时即使带合法 token 也返回 403，
 *      且 ingest 从未被调用（不泄漏"token 是否有效"，也不产生任何抓取副作用）；
 *   ③ `lastcreateddays` / `page` 是否可被外部注入 —— 断言 route 不接受任何 query 参数
 *      （只有 token），因此不存在被外部放大页数/窗口的面。
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

const h = vi.hoisted(() => ({
  ingest: vi.fn(),
}));

vi.mock("@/lib/mascus-leads/ingest", () => ({
  ingestMascusLeads: h.ingest,
}));

import { NextRequest } from "next/server";
import { GET, POST } from "@/app/api/cron/mascus-leads/route";

const BASE = "http://localhost/api/cron/mascus-leads";

/** 一个"看起来总是成功"的 ingest 返回，用于验证放行路径 */
function fakeStats(overrides: Record<string, unknown> = {}) {
  return {
    ok: true,
    fetchedPages: 5,
    failedPages: 0,
    items: 40,
    uniqueItems: 40,
    inserted: 10,
    updated: 30,
    bySegment: { tractors: 40 },
    emptySegments: [],
    truncatedSegments: [],
    failedUpserts: 0,
    budgetExhausted: false,
    tookMs: 1234,
    ...overrides,
  };
}

function getReq(query = "", headers: Record<string, string> = {}) {
  return new NextRequest(`${BASE}${query}`, { method: "GET", headers });
}

function postReq(headers: Record<string, string> = {}) {
  return new NextRequest(BASE, { method: "POST", headers });
}

/** 清空所有与 cron 鉴权相关的环境变量，便于逐条验证 fail-closed */
function clearAuthEnv() {
  delete process.env.CRON_API_KEY;
  delete process.env.CRON_SECRET;
  delete process.env.INTERNAL_API_KEY;
  delete process.env.INTERNAL_API_KEY_PREVIOUS;
}

beforeEach(() => {
  h.ingest.mockReset().mockResolvedValue(fakeStats());
  clearAuthEnv();
  process.env.SITE = "com";
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
  delete process.env.SITE;
  delete process.env.CRON_API_KEY;
  delete process.env.CRON_SECRET;
  delete process.env.INTERNAL_API_KEY;
  delete process.env.INTERNAL_API_KEY_PREVIOUS;
});

describe("SITE 闸门先于鉴权（.cn 侧不泄漏 token 有效性）", () => {
  beforeEach(() => {
    process.env.SITE = "cn";
  });

  it("SITE=cn 且**携带合法 token** 时仍返回 403，且不调用 ingest", async () => {
    process.env.CRON_API_KEY = "secret-key";

    const res = await GET(getReq("?token=secret-key"));

    expect(res.status).toBe(403);
    expect((await res.json()).success).toBe(false);
    expect(h.ingest).not.toHaveBeenCalled();
  });

  it("SITE=cn 且**不带 token** 时也返回 403（不是 401 ⇒ 鉴权确实在 SITE 之后）", async () => {
    process.env.CRON_API_KEY = "secret-key";

    const resNoToken = await GET(getReq());
    const resBadToken = await GET(getReq("?token=wrong"));

    // 两种输入返回同一个状态码与同一句提示 ⇒ 外部无法据此判断 token 对错
    expect(resNoToken.status).toBe(403);
    expect(resBadToken.status).toBe(403);
    expect(await resNoToken.json()).toEqual(await resBadToken.json());
    expect(h.ingest).not.toHaveBeenCalled();
  });

  it("SITE=cn 时 POST 同样 403 且不调用 ingest", async () => {
    process.env.CRON_API_KEY = "secret-key";

    const res = await POST(postReq({ authorization: "Bearer secret-key" }));

    expect(res.status).toBe(403);
    expect(h.ingest).not.toHaveBeenCalled();
  });

  it("SITE=cn 时 ingest 即使被调用也不应该发生（双保险：ingest 自身也抛错）", async () => {
    // route 层的 403 是第一道闸；ingest 入口第一行还有第二道闸（另一处已单测）。
    // 这里只确认 route 这一层没有绕过路径。
    process.env.INTERNAL_API_KEY = "internal-key";
    const res = await GET(getReq("?token=internal-key"));
    expect(res.status).toBe(403);
    expect(h.ingest).not.toHaveBeenCalled();
  });
});

describe("fail-closed：不存在默认密钥兜底", () => {
  it("env 全部未配置时，任何 token（含常见占位串）都 401", async () => {
    const probes = [
      "",
      "dev-secret-key",
      "test",
      "undefined",
      "null",
      "changeme",
      "2234e4ead3e570c2aa3b0cd3747315367dc6040c42ae74e0749aae480cf2826e", // 曾是 vercel.json 明文
    ];
    for (const token of probes) {
      const res = await GET(getReq(token ? `?token=${encodeURIComponent(token)}` : ""));
      expect(res.status, `token=${token || "(empty)"}`).toBe(401);
    }
    expect(h.ingest).not.toHaveBeenCalled();
  });

  it("env 未配置时 Bearer 头同样 401", async () => {
    const res = await GET(getReq("", { authorization: "Bearer dev-secret-key" }));
    expect(res.status).toBe(401);
    expect(h.ingest).not.toHaveBeenCalled();
  });

  it("只配了 CRON_SECRET 时，CRON_API_KEY 猜值无效、CRON_SECRET 有效", async () => {
    process.env.CRON_SECRET = "only-secret";

    expect((await GET(getReq("?token=undefined"))).status).toBe(401);
    expect((await GET(getReq("?token=only-secret"))).status).toBe(200);
  });
});

describe("放行路径：三套密钥任一命中", () => {
  it("CRON_API_KEY 经 query token 放行并调用一次 ingest", async () => {
    process.env.CRON_API_KEY = "cron-key";

    const res = await GET(getReq("?token=cron-key"));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(h.ingest).toHaveBeenCalledTimes(1);
    // 返回体确实透传了 ingest 的统计（route 不做二次加工）
    expect(body.stats).toEqual(fakeStats());
  });

  it("INTERNAL_API_KEY 经 Authorization Bearer 放行", async () => {
    process.env.INTERNAL_API_KEY = "internal-key";

    const res = await GET(getReq("", { authorization: "Bearer internal-key" }));
    expect(res.status).toBe(200);
    expect(h.ingest).toHaveBeenCalledTimes(1);
  });

  it("过渡期 INTERNAL_API_KEY_PREVIOUS 也放行（轮换不回滚可用性）", async () => {
    process.env.INTERNAL_API_KEY = "new-key";
    process.env.INTERNAL_API_KEY_PREVIOUS = "old-key";

    const res = await GET(getReq("?token=old-key"));
    expect(res.status).toBe(200);
  });

  it("POST 只认 Bearer 头，且 CRON_SECRET 同样可用", async () => {
    process.env.CRON_SECRET = "cron-secret";

    const res = await POST(postReq({ authorization: "Bearer cron-secret" }));
    expect(res.status).toBe(200);
    expect(h.ingest).toHaveBeenCalledTimes(1);
  });

  it("token 前后空格不被 trim（严格相等比对）", async () => {
    process.env.CRON_API_KEY = "cron-key";

    const res = await GET(getReq("?token=%20cron-key%20"));
    expect(res.status).toBe(401);
  });

  it("Bearer 前缀大小写敏感：bearer xxx 被拒", async () => {
    process.env.CRON_SECRET = "cron-secret";

    const resPost = await POST(postReq({ authorization: "bearer cron-secret" }));
    expect(resPost.status).toBe(401);
    // GET 走 header 时同样走 startsWith("Bearer ")
    const resGet = await GET(getReq("", { authorization: "bearer cron-secret" }));
    expect(resGet.status).toBe(401);
    expect(h.ingest).not.toHaveBeenCalled();
  });
});

describe("参数面：只接受 dryRun，其余采集参数一律不从外部读", () => {
  it("query 里塞 lastcreateddays / page / maxPages / recentDays 都不影响调用（仍是零参数调用）", async () => {
    process.env.CRON_API_KEY = "cron-key";

    const res = await GET(
      getReq(
        "?token=cron-key&lastcreateddays=365&page=99&maxPages=50&recentDays=365&budgetMs=1&segmentPaths=/agriculture/tractors"
      )
    );

    expect(res.status).toBe(200);
    // route 绝不能透传抓取量参数，否则就是资源耗尽 / 抓取放大面
    expect(h.ingest).toHaveBeenCalledTimes(1);
    expect(h.ingest.mock.calls[0]).toEqual([]);
  });

  it("?dryRun=1 透传 { dryRun: true }（唯一被允许的采集开关），并在返回体回显", async () => {
    process.env.CRON_API_KEY = "cron-key";

    const res = await GET(getReq("?token=cron-key&dryRun=1"));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(h.ingest.mock.calls[0]).toEqual([{ dryRun: true }]);
    expect(body.dryRun).toBe(true);
  });

  it("?dryRun=0 / dryRun=true 不触发放映（严格等于字符串 \"1\"）", async () => {
    process.env.CRON_API_KEY = "cron-key";

    await GET(getReq("?token=cron-key&dryRun=0"));
    expect(h.ingest.mock.calls[0]).toEqual([]);

    h.ingest.mockClear();
    await GET(getReq("?token=cron-key&dryRun=true"));
    expect(h.ingest.mock.calls[0]).toEqual([]);
  });
});

describe("返回体与失败处理", () => {
  it("emptySegments 非空时 message 显式列出段名（死段唯一可发现通道）", async () => {
    process.env.CRON_API_KEY = "cron-key";
    h.ingest.mockResolvedValue(
      fakeStats({ emptySegments: ["soil-preparation", "loaders"], bySegment: {} })
    );

    const body = await (await GET(getReq("?token=cron-key"))).json();

    expect(body.message).toContain("0 条段 2");
    expect(body.message).toContain("soil-preparation");
    expect(body.message).toContain("loaders");
  });

  it("budgetExhausted 时 message 标注「预算耗尽提前收工」", async () => {
    process.env.CRON_API_KEY = "cron-key";
    h.ingest.mockResolvedValue(fakeStats({ budgetExhausted: true }));

    const body = await (await GET(getReq("?token=cron-key"))).json();
    expect(body.message).toContain("预算耗尽");
  });

  it("ingest 抛错 → 500 且不透出堆栈，只透出 message", async () => {
    process.env.CRON_API_KEY = "cron-key";
    h.ingest.mockRejectedValue(new Error("[db.ts] 未设置 DATABASE_URL 环境变量"));

    const res = await GET(getReq("?token=cron-key"));
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body.success).toBe(false);
    expect(body.error).toContain("DATABASE_URL");
    expect(JSON.stringify(body)).not.toContain("at ");
  });

  it("ingest 抛非 Error（字符串）时回落到通用文案，不把原始值塞进响应", async () => {
    process.env.CRON_API_KEY = "cron-key";
    h.ingest.mockRejectedValue("boom-string");

    const res = await GET(getReq("?token=cron-key"));
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body.error).toBe("内部服务器错误");
  });

  it("鉴权失败时不会因为 ingest 抛错而变成 500（顺序正确）", async () => {
    process.env.CRON_API_KEY = "cron-key";
    h.ingest.mockRejectedValue(new Error("should not run"));

    const res = await GET(getReq("?token=wrong"));
    expect(res.status).toBe(401);
  });

  // ↓ 以下 3 例为「截断/失败可见性」收尾加固新增（2026-11）
  it("一页都没抓成功（fetchedPages=0）⇒ 503，绝不假绿", async () => {
    process.env.CRON_API_KEY = "cron-key";
    h.ingest.mockResolvedValue(fakeStats({ fetchedPages: 0, failedPages: 15, ok: false }));

    const res = await GET(getReq("?token=cron-key"));
    const body = await res.json();

    expect(res.status).toBe(503);
    expect(body.success).toBe(false);
    expect(body.error).toContain("全部页抓取失败");
    // stats 仍然透出，便于排查是全挂还是被挡住
    expect(body.stats.failedPages).toBe(15);
  });

  it("success 反映 stats.ok：有失败页/失败写入 ⇒ 200 但 success:false", async () => {
    process.env.CRON_API_KEY = "cron-key";
    h.ingest.mockResolvedValue(fakeStats({ ok: false, failedPages: 2, failedUpserts: 3 }));

    const res = await GET(getReq("?token=cron-key"));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(false);
    expect(body.message).toContain("写入失败 3 条");
  });

  it("truncatedSegments 非空时 message 标注「截断段 N（a,b）」", async () => {
    process.env.CRON_API_KEY = "cron-key";
    h.ingest.mockResolvedValue(
      fakeStats({ truncatedSegments: ["tractors", "tillage-machines"] })
    );

    const body = await (await GET(getReq("?token=cron-key"))).json();

    expect(body.message).toContain("截断段 2");
    expect(body.message).toContain("tractors");
    expect(body.message).toContain("tillage-machines");
  });
});
