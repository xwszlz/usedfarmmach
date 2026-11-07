/**
 * T02 审计层单测 —— **零真实数据库 / 零 PrismaClient / 零真实 token**。
 *
 * `@/lib/db` 被 mock 成「一调用即记名并抛错」的探针（默认 throwOnCreate=true）：
 *   - 校验失败 / 模块加载路径：断言 `expect(probes.calls).toEqual([])` 作为零 IO 硬证据；
 *   - 正常写入路径：临时把探针切到「记录参数并返回」模式，断言 create.data 的键集合
 *     严格等于 8 个白名单字段、且不含任何 PII / raw 行字段；
 *   - 失败路径：探针抛错，断言 `logRawAccess()` 不抛且 `console.warn` 带 `[subsidy-raw]` 前缀。
 *
 * raw-audit.ts 的 db 是函数内动态 import，vitest 的 vi.mock 会拦截动态 import，
 * 因此全程不会加载真实 PrismaClient，也不需要 DATABASE_URL。
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const probes = vi.hoisted(() => ({
  calls: [] as string[],
  created: [] as Array<{ data: Record<string, unknown> }>,
  throwOnCreate: true,
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    subsidyRawAccessLog: {
      create: async (args: { data: Record<string, unknown> }) => {
        probes.calls.push("db.subsidyRawAccessLog.create");
        if (probes.throwOnCreate) {
          throw new Error("单测禁止触发真实 Prisma 写入");
        }
        probes.created.push(args);
        return { id: "mock-log-id" };
      },
    },
  },
  getCurrentDatabaseUrl: () => "mock://no-real-database",
}));

import {
  RAW_ACCESS_LOG_ALLOWED_FIELDS,
  RAW_ACCESS_LOG_FORBIDDEN_FIELDS,
  buildRawAccessLogData,
  isValidRawAccessLogInput,
  logRawAccess,
} from "../raw-audit";
import type { RawAccessLogInput } from "../raw-audit";

let warnSpy: ReturnType<typeof vi.spyOn>;

const VALID: RawAccessLogInput = {
  catalogId: "cat-001",
  userId: "user-1",
  anonKeyHash: null,
  mode: "login",
  rowCount: 16,
  decision: "allowed",
  reason: "ok",
};

function asInput(value: unknown): RawAccessLogInput {
  return value as RawAccessLogInput;
}

beforeEach(() => {
  probes.calls.length = 0;
  probes.created.length = 0;
  probes.throwOnCreate = true;
  warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);
});

afterEach(() => {
  warnSpy.mockRestore();
});

/* ─────────────────────────── 字段白名单（纯函数） ─────────────────────────── */

describe("buildRawAccessLogData / 字段白名单", () => {
  it("输出严格 8 个白名单字段，createdAt 用注入时间（可复现）", () => {
    const fixed = new Date(Date.UTC(2026, 10, 7, 9, 0, 0));
    const data = buildRawAccessLogData(VALID, fixed);
    expect(Object.keys(data).sort()).toEqual([...RAW_ACCESS_LOG_ALLOWED_FIELDS].sort());
    expect(data.createdAt).toBe(fixed);
    expect(data.catalogId).toBe("cat-001");
    expect(data.userId).toBe("user-1");
    expect(data.anonKeyHash).toBeNull();
    expect(data.mode).toBe("login");
    expect(data.rowCount).toBe(16);
    expect(data.decision).toBe("allowed");
    expect(data.reason).toBe("ok");
  });

  it("输出对象不含任何 PII / raw 行字段（黑名单逐项断言）", () => {
    const data = buildRawAccessLogData(VALID, new Date(0)) as unknown as Record<string, unknown>;
    for (const pii of RAW_ACCESS_LOG_FORBIDDEN_FIELDS) {
      expect(data).not.toHaveProperty(pii);
    }
    expect(data).not.toHaveProperty("buyerName");
    expect(data).not.toHaveProperty("county");
    expect(data).not.toHaveProperty("township");
    expect(data).not.toHaveProperty("serialNo");
    expect(data).not.toHaveProperty("salePriceCny");
  });

  it("入参夹带 PII 键时静默丢弃，只告警键名、绝不告警值", () => {
    const dirty = asInput({
      ...VALID,
      buyerName: "张三-不得外泄",
      county: "某县",
      salePriceCny: 180000,
    });
    const data = buildRawAccessLogData(dirty, new Date(0)) as unknown as Record<string, unknown>;
    expect(data).not.toHaveProperty("buyerName");
    expect(data).not.toHaveProperty("county");
    expect(data).not.toHaveProperty("salePriceCny");
    expect(warnSpy).toHaveBeenCalled();
    const allWarnings = warnSpy.mock.calls.map((c) => c.map(String).join(" ")).join("\n");
    expect(allWarnings).toContain("buyerName");
    expect(allWarnings).not.toContain("张三");
    expect(allWarnings).not.toContain("180000");
  });

  it("reason 省略 → null；userId / anonKeyHash 非字符串 → null", () => {
    const data = buildRawAccessLogData(
      asInput({
        catalogId: "c",
        userId: 123,
        anonKeyHash: {},
        mode: "public",
        rowCount: 0,
        decision: "denied",
      }),
      new Date(0)
    );
    expect(data.reason).toBeNull();
    expect(data.userId).toBeNull();
    expect(data.anonKeyHash).toBeNull();
    expect(data.decision).toBe("denied");
  });
});

/* ─────────────────────────── 入参校验（零 IO） ─────────────────────────── */

describe("isValidRawAccessLogInput / 最小校验", () => {
  it("合法入参 → true", () => {
    expect(isValidRawAccessLogInput(VALID)).toBe(true);
    expect(isValidRawAccessLogInput({ ...VALID, reason: undefined })).toBe(true);
  });

  it.each([
    ["负数", -1],
    ["小数", 1.5],
    ["NaN", Number.NaN],
    ["Infinity", Number.POSITIVE_INFINITY],
    ["字符串", "16"],
    ["null", null],
  ] as const)("rowCount %s → false 且零 IO", async (_label, bad) => {
    expect(isValidRawAccessLogInput(asInput({ ...VALID, rowCount: bad }))).toBe(false);
    await logRawAccess(asInput({ ...VALID, rowCount: bad }));
    expect(probes.calls).toEqual([]);
    expect(warnSpy).toHaveBeenCalled();
  });

  it.each(["unknown", "", "ALLOWED", null, 1] as const)(
    "未知 decision %j → false 且零 IO",
    async (bad) => {
      const input = asInput({ ...VALID, decision: bad });
      expect(isValidRawAccessLogInput(input)).toBe(false);
      await logRawAccess(input);
      expect(probes.calls).toEqual([]);
    }
  );

  it.each(["off", "LOGIN", "", null, "publicx"] as const)(
    "未知 mode %j → false 且零 IO",
    async (bad) => {
      const input = asInput({ ...VALID, mode: bad });
      expect(isValidRawAccessLogInput(input)).toBe(false);
      await logRawAccess(input);
      expect(probes.calls).toEqual([]);
    }
  );

  it.each(["", "   ", null, 42] as const)("catalogId %j → false 且零 IO", async (bad) => {
    const input = asInput({ ...VALID, catalogId: bad });
    expect(isValidRawAccessLogInput(input)).toBe(false);
    await logRawAccess(input);
    expect(probes.calls).toEqual([]);
  });

  it.each([
    ["userId 为对象", { userId: {} }],
    ["anonKeyHash 为数字", { anonKeyHash: 123 }],
    ["reason 为对象", { reason: { raw: "PII" } }],
  ] as const)("%s → false 且零 IO", async (_label, patch) => {
    const input = asInput({ ...VALID, ...patch });
    expect(isValidRawAccessLogInput(input)).toBe(false);
    await logRawAccess(input);
    expect(probes.calls).toEqual([]);
  });

  it.each([null, undefined, [], "string", 0] as const)(
    "入参整体非法 %j → false 且零 IO",
    async (bad) => {
      expect(isValidRawAccessLogInput(bad)).toBe(false);
      await logRawAccess(asInput(bad));
      expect(probes.calls).toEqual([]);
      expect(warnSpy).toHaveBeenCalled();
    }
  );
});

/* ─────────────────────────── 正常写入路径 ─────────────────────────── */

describe("logRawAccess / 正常写入（探针记录模式）", () => {
  beforeEach(() => {
    probes.throwOnCreate = false;
  });

  it("create.data 键集合严格 8 项且不含任何 PII 键", async () => {
    await logRawAccess(VALID);
    expect(probes.calls).toEqual(["db.subsidyRawAccessLog.create"]);
    expect(probes.created).toHaveLength(1);
    const data = probes.created[0].data;
    expect(Object.keys(data).sort()).toEqual([...RAW_ACCESS_LOG_ALLOWED_FIELDS].sort());
    for (const pii of RAW_ACCESS_LOG_FORBIDDEN_FIELDS) {
      expect(data).not.toHaveProperty(pii);
    }
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it.each([
    ["login", "allowed"],
    ["login", "denied"],
    ["public", "allowed"],
    ["public", "denied"],
  ] as const)("mode=%s / decision=%s 原样落库", async (mode, decision) => {
    const input: RawAccessLogInput = {
      catalogId: "c-2",
      userId: mode === "login" ? "u-2" : null,
      anonKeyHash: mode === "public" ? "abcdef0123456789" : null,
      mode,
      rowCount: mode === "login" ? 12 : 0,
      decision,
    };
    await logRawAccess(input);
    const data = probes.created[0].data;
    expect(data.mode).toBe(mode);
    expect(data.decision).toBe(decision);
    expect(data.catalogId).toBe("c-2");
    expect(data.rowCount).toBe(mode === "login" ? 12 : 0);
    expect(data.userId).toBe(mode === "login" ? "u-2" : null);
    expect(data.anonKeyHash).toBe(mode === "public" ? "abcdef0123456789" : null);
    expect(data.reason).toBeNull();
    expect(data.createdAt).toBeInstanceOf(Date);
  });

  it("reason 可选：传入原样、省略为 null", async () => {
    await logRawAccess({ ...VALID, reason: "login_required" });
    expect(probes.created[0].data.reason).toBe("login_required");
    probes.created.length = 0;
    const { reason: _omitted, ...withoutReason } = VALID;
    void _omitted;
    await logRawAccess(withoutReason);
    expect(probes.created[0].data.reason).toBeNull();
  });

  it("夹带 PII 的入参不会把 PII 带进 create.data", async () => {
    await logRawAccess(asInput({ ...VALID, buyerName: "张三", county: "某县", serialNo: "SN-1" }));
    const data = probes.created[0].data;
    expect(Object.keys(data).sort()).toEqual([...RAW_ACCESS_LOG_ALLOWED_FIELDS].sort());
    const serialized = JSON.stringify(data);
    expect(serialized).not.toContain("张三");
    expect(serialized).not.toContain("某县");
    expect(serialized).not.toContain("SN-1");
  });
});

/* ─────────────────────────── fail-closed ─────────────────────────── */

describe("logRawAccess / 写失败只告警不抛", () => {
  it("db create 抛错 → 不抛、console.warn 带 [subsidy-raw] 前缀", async () => {
    probes.throwOnCreate = true;
    await expect(logRawAccess(VALID)).resolves.toBeUndefined();
    expect(probes.calls).toEqual(["db.subsidyRawAccessLog.create"]);
    expect(warnSpy).toHaveBeenCalled();
    const first = warnSpy.mock.calls[0].map(String).join(" ");
    expect(first).toContain("[subsidy-raw]");
    expect(first).toContain("审计写入失败");
  });

  it("多次写失败也不抛（不阻塞渲染）", async () => {
    probes.throwOnCreate = true;
    for (let i = 0; i < 3; i += 1) {
      await expect(logRawAccess(VALID)).resolves.toBeUndefined();
    }
    expect(probes.calls).toHaveLength(3);
  });
});

/* ─────────────────────────── 零真实 IO 硬断言 ─────────────────────────── */

describe("跑测试不连库", () => {
  it("模块加载 / 校验失败路径全程零 DB 调用、零 DATABASE_URL 依赖", async () => {
    expect(process.env.DATABASE_URL).toBeUndefined();
    expect(process.env.DATABASE_URL_CN).toBeUndefined();
    expect(probes.calls).toEqual([]);
    expect(isValidRawAccessLogInput(VALID)).toBe(true);
    expect(buildRawAccessLogData(VALID, new Date(0)).rowCount).toBe(16);
    await logRawAccess(asInput({ ...VALID, rowCount: -1 }));
    expect(probes.calls).toEqual([]);
  });
});
