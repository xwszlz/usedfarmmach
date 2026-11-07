/**
 * T01 独立通道纯函数层单测 —— **零数据库 / 零 Prisma / 零真实 token 查询**。
 *
 * 负向保障：@/lib/db 与 @/lib/auth 被 mock 成「一旦被调用就记名并抛错」的探针，
 * 测试全程不加载 PrismaClient；queryRawDetail 与 db_user provider 均不在单测中调用，
 * 「UTC 二次过滤 + 计数断言」通过可单测纯函数 finalizeRawDetailResult 覆盖。
 * 末尾的「不连库」用例断言 probes.calls 为空，作为硬证据。
 *
 * 注意 @/config/site 的 SITE 是模块加载期常量，切换 env 须 vi.resetModules() 后动态 import。
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const probes = vi.hoisted(() => ({ calls: [] as string[] }));

vi.mock("@/lib/db", () => ({
  prisma: {
    subsidyRecordRaw: {
      count: async () => {
        probes.calls.push("db.count");
        throw new Error("单测禁止触发 Prisma 查询");
      },
      findMany: async () => {
        probes.calls.push("db.findMany");
        throw new Error("单测禁止触发 Prisma 查询");
      },
    },
    systemConfig: {
      findUnique: async () => {
        probes.calls.push("db.systemConfig.findUnique");
        throw new Error("单测禁止触发 Prisma 查询");
      },
    },
  },
  getCurrentDatabaseUrl: () => "mock://no-real-database",
}));

vi.mock("@/lib/auth", () => ({
  getTokenFromHeaders: () => {
    probes.calls.push("auth.getTokenFromHeaders");
    return null;
  },
  verifyToken: () => {
    probes.calls.push("auth.verifyToken");
    return null;
  },
  getUserFromToken: async () => {
    probes.calls.push("auth.getUserFromToken");
    return null;
  },
}));

vi.mock("next/headers", () => ({
  headers: () => new Headers({ "user-agent": "vitest-probe" }),
}));

const ENV_KEYS = [
  "SITE",
  "CN_SUBSIDY_RAW_MODE",
  "CN_SUBSIDY_RAW_ROLES",
  "CN_SUBSIDY_RAW_PAGE_SIZE",
  "CN_SUBSIDY_IMAGE_ENABLED",
  "SUBSIDY_IMAGE_SOURCE_ALLOWLIST",
  "CN_SUBSIDY_IMAGE_MODEL_LIMIT",
  "CN_SUBSIDY_IDENTITY_PROVIDER",
] as const;

const originalEnv: Record<string, string | undefined> = {};
for (const key of ENV_KEYS) originalEnv[key] = process.env[key];

function clearEnv(): void {
  for (const key of ENV_KEYS) delete process.env[key];
}

/** 设定 env 后重新加载模块（SITE 为加载期常量，必须 resetModules + 动态 import）。 */
async function load(env: Record<string, string | undefined> = {}): Promise<{
  mode: typeof import("../raw-mode");
  detail: typeof import("../raw-detail");
  identity: typeof import("../raw-identity");
}> {
  clearEnv();
  for (const [key, value] of Object.entries(env)) {
    if (value !== undefined) process.env[key] = value;
  }
  vi.resetModules();
  const mode = await import("../raw-mode");
  const detail = await import("../raw-detail");
  const identity = await import("../raw-identity");
  return { mode, detail, identity };
}

beforeEach(() => {
  clearEnv();
  probes.calls.length = 0;
});

afterEach(() => {
  clearEnv();
  for (const key of ENV_KEYS) {
    if (originalEnv[key] !== undefined) process.env[key] = originalEnv[key];
  }
});

/* ─────────────────────────── 开关三态 ─────────────────────────── */

describe("raw-mode 三态开关", () => {
  it.each(["off", "login", "public"] as const)("SITE=cn 且值 %s → 原样返回", async (value) => {
    const { mode } = await load({ SITE: "cn", CN_SUBSIDY_RAW_MODE: value });
    expect(mode.getRawMode()).toBe(value);
  });

  it.each(["LOGIN", "PUBLIC", "OFF", "publik", "offx", " login ", ""])(
    "非法 / 大小写不符 / 拼错 %j → off",
    async (bad) => {
      const { mode } = await load({ SITE: "cn", CN_SUBSIDY_RAW_MODE: bad });
      expect(mode.getRawMode()).toBe("off");
    }
  );

  it("未设置 CN_SUBSIDY_RAW_MODE → off（代码层 fail-closed 缺省）", async () => {
    const { mode } = await load({ SITE: "cn" });
    expect(mode.getRawMode()).toBe("off");
    expect(mode.isRawEnabled()).toBe(false);
  });

  it("SITE=com 恒 off，且 isRawEnabled()===false（即便 flag=login）", async () => {
    const { mode } = await load({ SITE: "com", CN_SUBSIDY_RAW_MODE: "login" });
    expect(mode.getRawMode()).toBe("off");
    expect(mode.isRawEnabled()).toBe(false);
  });

  it("SITE 未设置（缺省 com）恒 off", async () => {
    const { mode } = await load({ CN_SUBSIDY_RAW_MODE: "public" });
    expect(mode.getRawMode()).toBe("off");
  });

  it("SITE=cn + login → isRawEnabled()===true", async () => {
    const { mode } = await load({ SITE: "cn", CN_SUBSIDY_RAW_MODE: "login" });
    expect(mode.isRawEnabled()).toBe(true);
  });

  it("getEffectiveRawMode: env=off 时直接返回 off 且不读 DB", async () => {
    const { mode } = await load({ SITE: "cn", CN_SUBSIDY_RAW_MODE: "off" });
    expect(await mode.getEffectiveRawMode()).toBe("off");
    expect(probes.calls).toEqual([]);
  });

  it("getRawFeatureConfig: pageSize 默认 50 / clamp 上限 100 / 非法回默认", async () => {
    const a = await load({ SITE: "cn" });
    expect(a.mode.getRawFeatureConfig().pageSize).toBe(50);
    const b = await load({ SITE: "cn", CN_SUBSIDY_RAW_PAGE_SIZE: "500" });
    expect(b.mode.getRawFeatureConfig().pageSize).toBe(100);
    const c = await load({ SITE: "cn", CN_SUBSIDY_RAW_PAGE_SIZE: "abc" });
    expect(c.mode.getRawFeatureConfig().pageSize).toBe(50);
    const d = await load({ SITE: "cn", CN_SUBSIDY_RAW_PAGE_SIZE: "0" });
    expect(d.mode.getRawFeatureConfig().pageSize).toBe(50);
    expect(a.mode.clampPageSize(1)).toBe(1);
    expect(a.mode.clampPageSize(-3)).toBe(50);
  });

  it("roles 空 = 所有已激活用户；非空按逗号解析", async () => {
    const a = await load({ SITE: "cn" });
    expect(a.mode.getRawRoles()).toEqual([]);
    const b = await load({ SITE: "cn", CN_SUBSIDY_RAW_ROLES: " admin , super_admin ," });
    expect(b.mode.getRawRoles()).toEqual(["admin", "super_admin"]);
  });

  it("imageSourceAllowlist 空 → fail-closed（即使 imageEnabled=true 也不许抓取）", async () => {
    const { mode } = await load({ SITE: "cn", CN_SUBSIDY_IMAGE_ENABLED: "true" });
    const config = mode.getRawFeatureConfig();
    expect(config.imageEnabled).toBe(true);
    expect(config.imageSourceAllowlist).toEqual([]);
    expect(mode.isImageFetchAllowed(config)).toBe(false);
  });

  it("imageSourceAllowlist 非空 + enabled 才允许抓取；缺省 imageEnabled=false", async () => {
    const { mode } = await load({ SITE: "cn" });
    const config = mode.getRawFeatureConfig();
    expect(config.imageEnabled).toBe(false);
    expect(config.imageModelLimit).toBe(100);
    expect(mode.isImageFetchAllowed({ ...config, imageSourceAllowlist: ["a.cn"] })).toBe(false);
    expect(
      mode.isImageFetchAllowed({
        ...config,
        imageEnabled: true,
        imageSourceAllowlist: ["a.cn"],
      })
    ).toBe(true);
  });
});

/* ─────────────────────────── 6 道门禁 ─────────────────────────── */

describe("assertRawDetailAllowed 六道 fail-closed", () => {
  const viewer = {
    userId: "u1",
    role: "user",
    isActive: true,
    anonKeyHash: null,
    identitySource: "db_user" as const,
    subject: "u1",
  };
  const base = { site: "cn" as const, mode: "login" as const, viewer, locale: "zh" };

  it("site_not_cn", async () => {
    const { detail } = await load({ SITE: "cn" });
    expect(detail.assertRawDetailAllowed({ ...base, site: "com" })).toEqual({
      showRaw: false,
      reason: "site_not_cn",
    });
  });

  it("mode_invalid", async () => {
    const { detail } = await load({ SITE: "cn" });
    expect(
      detail.assertRawDetailAllowed({ ...base, mode: "LOGIN" as unknown as "login" })
    ).toEqual({ showRaw: false, reason: "mode_invalid" });
  });

  it("mode_off", async () => {
    const { detail } = await load({ SITE: "cn" });
    expect(detail.assertRawDetailAllowed({ ...base, mode: "off" })).toEqual({
      showRaw: false,
      reason: "mode_off",
    });
  });

  it("login_required：viewer 为 null", async () => {
    const { detail } = await load({ SITE: "cn" });
    expect(detail.assertRawDetailAllowed({ ...base, viewer: null })).toEqual({
      showRaw: false,
      reason: "login_required",
    });
  });

  it("login_required：viewer.isActive !== true", async () => {
    const { detail } = await load({ SITE: "cn" });
    expect(
      detail.assertRawDetailAllowed({ ...base, viewer: { ...viewer, isActive: false } })
    ).toEqual({ showRaw: false, reason: "login_required" });
  });

  it("role_denied：角色白名单不匹配", async () => {
    const { detail } = await load({ SITE: "cn", CN_SUBSIDY_RAW_ROLES: "admin" });
    expect(detail.assertRawDetailAllowed(base)).toEqual({
      showRaw: false,
      reason: "role_denied",
    });
  });

  it("role_denied：viewer.role 为 null", async () => {
    const { detail } = await load({ SITE: "cn", CN_SUBSIDY_RAW_ROLES: "admin" });
    expect(
      detail.assertRawDetailAllowed({ ...base, viewer: { ...viewer, role: null } })
    ).toEqual({ showRaw: false, reason: "role_denied" });
  });

  it("locale_denied：默认仅 zh 放行", async () => {
    const { detail } = await load({ SITE: "cn" });
    expect(detail.assertRawDetailAllowed({ ...base, locale: "en" })).toEqual({
      showRaw: false,
      reason: "locale_denied",
    });
  });

  it("login + 有效激活 viewer（不看来源）→ showRaw:true", async () => {
    const { detail } = await load({ SITE: "cn" });
    expect(detail.assertRawDetailAllowed(base)).toEqual({ showRaw: true, mode: "login" });
    expect(
      detail.assertRawDetailAllowed({
        ...base,
        viewer: { ...viewer, identitySource: "miniapp_jwt" },
      })
    ).toEqual({ showRaw: true, mode: "login" });
  });

  it("public + viewer=null → showRaw:true", async () => {
    const { detail } = await load({ SITE: "cn" });
    expect(
      detail.assertRawDetailAllowed({ ...base, mode: "public", viewer: null })
    ).toEqual({ showRaw: true, mode: "public" });
  });

  it("独立错误类携带 reason，OrThrow 在 denied 时抛错", async () => {
    const { detail } = await load({ SITE: "cn" });
    expect(() =>
      detail.assertRawDetailAllowedOrThrow({ ...base, site: "com" })
    ).toThrow(detail.RawDetailForbiddenError);
    try {
      detail.assertRawDetailAllowedOrThrow({ ...base, viewer: null });
      throw new Error("should not reach");
    } catch (error) {
      expect(error).toBeInstanceOf(detail.RawDetailForbiddenError);
      expect((error as InstanceType<typeof detail.RawDetailForbiddenError>).reason).toBe(
        "login_required"
      );
    }
  });
});

/* ─────────────────────────── 组键 / 边界 / 一致性 ─────────────────────────── */

describe("组键与 UTC 时区消解", () => {
  const entry = {
    batchCode: "domestic-seed-2026-11",
    manufacturer: "某某农业机械有限公司",
    brandName: "归并品牌（不得使用）",
    category: "轮式拖拉机",
    modelName: "XX-1804",
    province: "河北省",
    policyYear: 2024,
    sampleSize: 16,
  };

  it("resolveGroupKey 返回 6 元组，厂家取 entry.manufacturer 而非 brandName", async () => {
    const { detail } = await load({ SITE: "cn" });
    const key = detail.resolveGroupKey(entry);
    expect(key).toEqual({
      batchCode: "domestic-seed-2026-11",
      manufacturer: "某某农业机械有限公司",
      category: "轮式拖拉机",
      modelName: "XX-1804",
      province: "河北省",
      policyYear: 2024,
    });
    expect(Object.keys(key).sort()).toEqual(
      ["batchCode", "category", "manufacturer", "modelName", "policyYear", "province"].sort()
    );
    expect(key.manufacturer).not.toBe(entry.brandName);
  });

  it("buildRawDetailWhere: UTC 年边界 / goodsRegion=cn / 无 contentHash / 无 PII 键", async () => {
    const { detail } = await load({ SITE: "cn" });
    const key = detail.resolveGroupKey(entry);
    const where = detail.buildRawDetailWhere(key);
    expect(where.purchaseDate.gte.getTime()).toBe(Date.UTC(2024, 0, 1));
    expect(where.purchaseDate.lt.getTime()).toBe(Date.UTC(2025, 0, 1));
    expect(where.purchaseDate.gte.toISOString()).toBe("2024-01-01T00:00:00.000Z");
    expect(where.goodsRegion).toBe("cn");
    expect(JSON.stringify(where)).not.toContain("contentHash");
    expect(detail.hasForbiddenRawQueryKeys(where)).toBe(false);
  });

  it("跨年边界 2023-12-31 / 2024-01-01：utcYearOf + 二次过滤", async () => {
    const { detail } = await load({ SITE: "cn" });
    expect(detail.utcYearOf("2023-12-31")).toBe(2023);
    expect(detail.utcYearOf("2024-01-01")).toBe(2024);
    expect(detail.utcYearOf(new Date(Date.UTC(2023, 11, 31, 23, 59, 59)))).toBe(2023);
    expect(detail.utcYearOf(new Date(Date.UTC(2024, 0, 1, 0, 0, 0)))).toBe(2024);
    expect(detail.utcYearOf("not-a-date")).toBeNull();

    const rows = [
      { purchaseDate: "2023-12-31", tag: "prev" },
      { purchaseDate: "2024-01-01", tag: "next" },
      { purchaseDate: "2024-06-01", tag: "in" },
      { purchaseDate: "invalid", tag: "bad" },
    ];
    expect(detail.filterRowsByUtcYear(rows, 2024).map((r) => r.tag)).toEqual(["next", "in"]);
    expect(detail.filterRowsByUtcYear(rows, 2023).map((r) => r.tag)).toEqual(["prev"]);
  });

  it("isRawDetailConsistent 严格相等、无容差", async () => {
    const { detail } = await load({ SITE: "cn" });
    expect(detail.isRawDetailConsistent(16, 16)).toBe(true);
    expect(detail.isRawDetailConsistent(15, 16)).toBe(false);
    expect(detail.isRawDetailConsistent(17, 16)).toBe(false);
    expect(detail.isRawDetailConsistent(-1, 16)).toBe(false);
    expect(detail.isRawDetailConsistent(16.5, 16)).toBe(false);
  });

  it("hasForbiddenRawQueryKeys 拒绝县/乡/购机者/哈希等下钻键", async () => {
    const { detail } = await load({ SITE: "cn" });
    for (const key of [
      "county",
      "TOWNSHIP",
      "buyerName",
      "serialNo",
      "sourceFile",
      "contentHash",
      "id",
    ]) {
      expect(detail.hasForbiddenRawQueryKeys({ [key]: "x" })).toBe(true);
    }
    expect(detail.hasForbiddenRawQueryKeys(detail.resolveGroupKey(entry))).toBe(false);
    expect(detail.hasForbiddenRawQueryKeys(null)).toBe(false);
  });
});

describe("finalizeRawDetailResult（可单测纯函数，覆盖 consistent:false）", () => {
  const key = {
    batchCode: "domestic-seed-2026-11",
    manufacturer: "某某农业机械有限公司",
    category: "轮式拖拉机",
    modelName: "XX-1804",
    province: "河北省",
    policyYear: 2024,
  };

  function row(purchaseDate: string): import("../raw-detail").RawDetailRow {
    return {
      batchCode: key.batchCode,
      sourceFile: null,
      province: key.province,
      county: "某县",
      township: "某乡",
      buyerName: "购机者",
      manufacturer: key.manufacturer,
      category: key.category,
      productName: "轮式拖拉机",
      modelName: key.modelName,
      quantity: 1,
      dealer: "某经销商",
      purchaseDate,
      salePriceCny: 180000,
      centralSubsidyCny: 30000,
      totalSubsidyCny: 30000,
      serialNo: null,
      status: "资金已兑付",
    };
  }

  it("total === expectedSampleSize → consistent:true 且保留本政策年行", async () => {
    const { detail } = await load({ SITE: "cn" });
    const result = detail.finalizeRawDetailResult(
      [row("2024-01-01"), row("2023-12-31")],
      2,
      { key, expectedSampleSize: 2, page: 1, pageSize: 50 }
    );
    expect(result.consistent).toBe(true);
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].purchaseDate).toBe("2024-01-01");
    expect(result.total).toBe(2);
  });

  it("total≠sampleSize → consistent:false 且 rows=[]（fail-closed，不抛）", async () => {
    const { detail } = await load({ SITE: "cn" });
    const result = detail.finalizeRawDetailResult(
      [row("2024-01-01"), row("2024-06-01")],
      9,
      { key, expectedSampleSize: 10, page: 1, pageSize: 50 }
    );
    expect(result.consistent).toBe(false);
    expect(result.rows).toEqual([]);
    expect(result.total).toBe(9);
  });

  it("page/pageSize 归一化：page<1→1，pageSize>100→100", async () => {
    const { detail } = await load({ SITE: "cn" });
    const result = detail.finalizeRawDetailResult([row("2024-01-01")], 1, {
      key,
      expectedSampleSize: 1,
      page: -5,
      pageSize: 500,
    });
    expect(result.page).toBe(1);
    expect(result.pageSize).toBe(100);
  });
});

/* ─────────────────────────── 身份提供者可插拔 ─────────────────────────── */

describe("raw-identity 可插拔 provider", () => {
  it("缺省 / db_user / public / wecom_jwt / miniapp_jwt 各自选中正确 source", async () => {
    for (const [envValue, expected] of [
      [undefined, "db_user"],
      ["db_user", "db_user"],
      ["public", "public"],
      ["wecom_jwt", "wecom_jwt"],
      ["miniapp_jwt", "miniapp_jwt"],
      ["some-typo", "db_user"],
    ] as const) {
      const { identity } = await load({
        SITE: "cn",
        CN_SUBSIDY_IDENTITY_PROVIDER: envValue,
      });
      expect(identity.getRawIdentityProvider().source).toBe(expected);
    }
  });

  it("未知值 provider 的 resolve() 恒 null（fail-closed，不查库）", async () => {
    const { identity } = await load({
      SITE: "cn",
      CN_SUBSIDY_IDENTITY_PROVIDER: "some-typo",
    });
    expect(await identity.getRawIdentityProvider().resolve(new Headers())).toBeNull();
    expect(probes.calls).toEqual([]);
  });

  it("public provider 返回 anonKeyHash（哈希，非原始 IP）与 isActive=true", async () => {
    const { identity } = await load({
      SITE: "cn",
      CN_SUBSIDY_IDENTITY_PROVIDER: "public",
    });
    const viewer = await identity
      .getRawIdentityProvider()
      .resolve(new Headers({ "x-forwarded-for": "1.2.3.4", "user-agent": "ua" }));
    expect(viewer).not.toBeNull();
    expect(viewer?.userId).toBeNull();
    expect(viewer?.role).toBeNull();
    expect(viewer?.isActive).toBe(true);
    expect(viewer?.identitySource).toBe("public");
    expect(viewer?.subject).toBeNull();
    expect(viewer?.anonKeyHash).toMatch(/^[0-9a-f]{32}$/);
    expect(viewer?.anonKeyHash).not.toContain("1.2.3.4");
  });

  it("C′ 预留 JWT provider 的 resolve() 恒 null（T01 不猜验签）", async () => {
    for (const value of ["wecom_jwt", "miniapp_jwt"]) {
      const { identity } = await load({ SITE: "cn", CN_SUBSIDY_IDENTITY_PROVIDER: value });
      expect(await identity.getRawIdentityProvider().resolve(new Headers())).toBeNull();
    }
    expect(probes.calls).toEqual([]);
  });

  it("resolveRawViewer() 唯一入口：public 模式下拿到 viewer，且零 DB / 零 token 查询", async () => {
    const { identity } = await load({
      SITE: "cn",
      CN_SUBSIDY_IDENTITY_PROVIDER: "public",
    });
    const viewer = await identity.resolveRawViewer();
    expect(viewer).not.toBeNull();
    expect(viewer?.identitySource).toBe("public");
    expect(probes.calls).toEqual([]);
  });
});

/* ─────────────────────────── 不连库硬断言 ─────────────────────────── */

describe("跑测试不连库", () => {
  it("全程零 Prisma / 零真实 token 查询 / 零 DATABASE_URL 依赖", async () => {
    expect(process.env.DATABASE_URL).toBeUndefined();
    expect(process.env.DATABASE_URL_CN).toBeUndefined();
    const { mode, detail, identity } = await load({ SITE: "cn" });
    expect(mode.getRawMode()).toBe("off");
    expect(detail.assertRawDetailAllowed({
      site: "cn",
      mode: "off",
      viewer: null,
      locale: "zh",
    })).toEqual({ showRaw: false, reason: "mode_off" });
    expect(identity.getRawIdentityProvider().source).toBe("db_user");
    expect(probes.calls).toEqual([]);
  });
});
