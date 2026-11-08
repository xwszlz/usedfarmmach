/**
 * T05-A ② 页面级贯通：详情页 / 列表页的 mode 已统一到 await getEffectiveRawMode()。
 *
 * 保留真实 raw-mode.ts / raw-detail.ts / raw-detail-view.ts / aggregate.ts；
 * 只 mock 页面 UI 依赖、站点、数据层、身份解析与站点 URL。
 *
 * RSC 不真实渲染：页面函数返回 React element 树（esbuild jsx=automatic，组件不被执行），
 * 通过遍历 element.props.children 收集文本判定「A 区明文 / 列表文案」；
 * 通过 prisma.subsidyRecordRaw 探针判定「off / denied 不查 SubsidyRecordRaw」。
 * 关键回归保护：env 固定 login，仅切换 DB 值即应改变页面行为；若页面仍用
 * getRawMode()（env 真源），下列 DB=off 用例会失败。
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const h = vi.hoisted(() => ({
  isCn: true,
  systemFindUnique: vi.fn(),
  catalogFindUnique: vi.fn(),
  catalogFindMany: vi.fn(),
  rawCount: vi.fn(),
  rawFindMany: vi.fn(),
  resolveViewer: vi.fn(),
  viewer: null as unknown,
  dbValue: "login" as unknown,
  notFoundCalls: 0,
}));

const NOT_FOUND = "T05A_NOT_FOUND";

vi.mock("@/config/site", () => ({
  isCnSite: () => h.isCn,
  siteConfig: {},
}));
vi.mock("@/lib/site-url", () => ({ SITE_ORIGIN: "https://usedfarmmach.cn" }));
vi.mock("@/lib/db", () => ({
  prisma: {
    systemConfig: { findUnique: h.systemFindUnique },
    subsidyCatalog: {
      findUnique: h.catalogFindUnique,
      findMany: h.catalogFindMany,
    },
    subsidyRecordRaw: {
      count: h.rawCount,
      findMany: h.rawFindMany,
    },
  },
  getCurrentDatabaseUrl: () => "mock://no-real-db",
}));
vi.mock("next/navigation", () => ({
  notFound: () => {
    h.notFoundCalls += 1;
    throw new Error("T05A_NOT_FOUND");
  },
}));
vi.mock("next-intl/server", () => ({ setRequestLocale: () => {} }));
vi.mock("@/lib/subsidy/raw-identity", () => ({
  resolveRawViewer: h.resolveViewer,
}));
vi.mock("next/link", () => ({ default: () => null }));
vi.mock("lucide-react", () => ({
  ShieldAlert: () => null,
  Database: () => null,
  ArrowRight: () => null,
  Search: () => null,
}));
vi.mock("@/components/ui/badge", () => ({ Badge: () => null }));
vi.mock("@/components/ui/card", () => ({
  Card: () => null,
  CardContent: () => null,
  CardHeader: () => null,
  CardTitle: () => null,
}));
vi.mock("@/components/subsidy/SubsidySpecTable", () => ({
  SubsidySpecTable: () => null,
}));
vi.mock("@/components/subsidy/SubsidyRawDetailTable", () => ({
  SubsidyRawDetailTable: () => null,
}));
vi.mock("@/components/subsidy/SubsidyCommonSections", () => ({
  SubsidyCommonSections: () => null,
}));
vi.mock("@/components/subsidy/SubsidyModelImages", () => ({
  SubsidyModelImages: () => null,
}));

const ENTRY = {
  id: "entry-1",
  isActive: true,
  brandName: "测试品牌",
  modelName: "XX-1804",
  category: "轮式拖拉机",
  policyYear: 2024,
  province: "河北省",
  sampleSize: 16,
  manufacturer: "测试厂家",
  medianPriceCny: 180000,
  p25PriceCny: 160000,
  p75PriceCny: 200000,
  medianCentralSubsidy: 30000,
  medianTotalSubsidy: 30000,
  batchCode: "domestic-seed-2026-11",
  updatedAt: new Date("2026-11-01T00:00:00.000Z"),
};

const VALID_VIEWER = {
  userId: "u1",
  role: "user",
  isActive: true,
  anonKeyHash: null,
  identitySource: "db_user",
  subject: "u1",
};

/** 遍历 React element 树收集全部文本（jsx automatic 下组件不执行，文本都在 props.children）。 */
function collectText(node: unknown, out: string[] = []): string[] {
  if (node === null || node === undefined || typeof node === "boolean") return out;
  if (typeof node === "string" || typeof node === "number") {
    out.push(String(node));
    return out;
  }
  if (Array.isArray(node)) {
    for (const child of node) collectText(child, out);
    return out;
  }
  if (typeof node === "object") {
    const props = (node as { props?: Record<string, unknown> }).props;
    if (props && typeof props === "object") collectText(props.children, out);
  }
  return out;
}

const ENV_KEYS = ["CN_SUBSIDY_RAW_MODE", "CN_SUBSIDY_RAW_ROLES"] as const;
const origEnv: Record<string, string | undefined> = {};
for (const k of ENV_KEYS) origEnv[k] = process.env[k];

beforeEach(() => {
  h.isCn = true;
  h.notFoundCalls = 0;
  h.dbValue = "login";
  h.viewer = null;
  h.systemFindUnique.mockReset().mockImplementation(async () => ({ value: h.dbValue }));
  h.catalogFindUnique.mockReset().mockResolvedValue(ENTRY);
  h.catalogFindMany.mockReset().mockResolvedValue([]);
  h.rawCount.mockReset().mockResolvedValue(16);
  h.rawFindMany.mockReset().mockResolvedValue([]);
  h.resolveViewer.mockReset().mockImplementation(async () => h.viewer);
  process.env.CN_SUBSIDY_RAW_MODE = "login";
  delete process.env.CN_SUBSIDY_RAW_ROLES;
});

afterEach(() => {
  for (const k of ENV_KEYS) {
    if (origEnv[k] === undefined) delete process.env[k];
    else process.env[k] = origEnv[k];
  }
});

async function detailPage() {
  return await import("@/app/[locale]/(cn)/subsidy/[id]/page");
}
async function listPage() {
  return await import("@/app/[locale]/(cn)/subsidy/page");
}
function metaArgs() {
  return { params: Promise.resolve({ locale: "zh", id: "entry-1" }) };
}
function detailArgs() {
  return {
    params: Promise.resolve({ locale: "zh", id: "entry-1" }),
    searchParams: Promise.resolve({} as Record<string, string | string[] | undefined>),
  };
}
function listArgs() {
  return {
    params: Promise.resolve({ locale: "zh" }),
    searchParams: Promise.resolve({} as Record<string, string | string[] | undefined>),
  };
}

describe("① 详情页 generateMetadata：robots 由 DB 真源驱动", () => {
  it("env=login + DB=off ⇒ index:true/follow:true（且确实读了库）", async () => {
    h.dbValue = "off";
    const { generateMetadata } = await detailPage();
    const meta = await generateMetadata(metaArgs());
    expect(meta.robots).toEqual({ index: true, follow: true });
    expect(h.systemFindUnique).toHaveBeenCalledTimes(1);
  });

  it("env=login + DB=login ⇒ noindex,nofollow", async () => {
    h.dbValue = "login";
    const { generateMetadata } = await detailPage();
    expect((await generateMetadata(metaArgs())).robots).toEqual({
      index: false,
      follow: false,
    });
  });

  it("env=login + DB=public ⇒ noindex,nofollow", async () => {
    h.dbValue = "public";
    const { generateMetadata } = await detailPage();
    expect((await generateMetadata(metaArgs())).robots).toEqual({
      index: false,
      follow: false,
    });
  });

  it("env=off 硬锁：DB=login ⇒ 仍 index:true 且零读库", async () => {
    process.env.CN_SUBSIDY_RAW_MODE = "off";
    h.dbValue = "login";
    const { generateMetadata } = await detailPage();
    expect((await generateMetadata(metaArgs())).robots).toEqual({
      index: true,
      follow: true,
    });
    expect(h.systemFindUnique).not.toHaveBeenCalled();
  });

  it(".com ⇒ mode 恒 off ⇒ index:true 且零读库", async () => {
    h.isCn = false;
    h.dbValue = "login";
    const { generateMetadata } = await detailPage();
    expect((await generateMetadata(metaArgs())).robots).toEqual({
      index: true,
      follow: true,
    });
    expect(h.systemFindUnique).not.toHaveBeenCalled();
  });

  it("DB 缺失(回落 login) ⇒ 仍 noindex（显式：回落 login 不是 off）", async () => {
    h.systemFindUnique.mockResolvedValue(null);
    const { generateMetadata } = await detailPage();
    expect((await generateMetadata(metaArgs())).robots).toEqual({
      index: false,
      follow: false,
    });
  });
});

describe("② 详情页默认导出：DB 值驱动 A 区明文门禁 + 不查 raw", () => {
  it("env=login + DB=off ⇒ A 区不渲染、不查 SubsidyRecordRaw、不解析身份", async () => {
    h.dbValue = "off";
    const mod = await detailPage();
    const text = collectText(await mod.default(detailArgs())).join("");
    expect(text).not.toContain("个人信息警示");
    expect(text).not.toContain("购机者姓名");
    expect(h.rawCount).not.toHaveBeenCalled();
    expect(h.rawFindMany).not.toHaveBeenCalled();
    expect(h.resolveViewer).not.toHaveBeenCalled();
  });

  it("env=login + DB=login + 匿名 ⇒ denied（A 区不渲染、不查 raw）、resolveViewer 被调用", async () => {
    h.dbValue = "login";
    h.viewer = null;
    const mod = await detailPage();
    const text = collectText(await mod.default(detailArgs())).join("");
    expect(text).not.toContain("个人信息警示");
    expect(h.rawCount).not.toHaveBeenCalled();
    expect(h.resolveViewer).toHaveBeenCalledTimes(1);
  });

  it("env=login + DB=login + 有效 viewer ⇒ A 区渲染、确实查 raw", async () => {
    h.dbValue = "login";
    h.viewer = VALID_VIEWER;
    const mod = await detailPage();
    const text = collectText(await mod.default(detailArgs())).join("");
    expect(text).toContain("个人信息警示");
    expect(h.rawCount).toHaveBeenCalledTimes(1);
    expect(h.rawFindMany).toHaveBeenCalledTimes(1);
  });

  it("env=login + DB=public（匿名）⇒ A 区渲染（public 无需登录）", async () => {
    h.dbValue = "public";
    h.viewer = null;
    const mod = await detailPage();
    const text = collectText(await mod.default(detailArgs())).join("");
    expect(text).toContain("个人信息警示");
    expect(h.rawCount).toHaveBeenCalledTimes(1);
  });

  it("env=off 硬锁 + DB=login ⇒ A 区不渲染、不查 raw、零读库", async () => {
    process.env.CN_SUBSIDY_RAW_MODE = "off";
    h.dbValue = "login";
    const mod = await detailPage();
    const text = collectText(await mod.default(detailArgs())).join("");
    expect(text).not.toContain("个人信息警示");
    expect(h.rawCount).not.toHaveBeenCalled();
    expect(h.systemFindUnique).not.toHaveBeenCalled();
  });

  it("DB 缺失(回落 login) + 匿名 ⇒ denied（A 区不渲染）——回落 login 而非 off 的旁证", async () => {
    h.dbValue = "login";
    h.viewer = null;
    h.systemFindUnique.mockResolvedValue(null);
    const mod = await detailPage();
    const text = collectText(await mod.default(detailArgs())).join("");
    expect(text).not.toContain("个人信息警示");
    expect(h.resolveViewer).toHaveBeenCalledTimes(1); // login 回落才会解析身份
    expect(h.rawCount).not.toHaveBeenCalled();
  });

  it("DB 非法(回落 login) + 有效 viewer ⇒ A 区渲染（证明回落 login 不是 off）", async () => {
    h.dbValue = "login";
    h.viewer = VALID_VIEWER;
    h.systemFindUnique.mockResolvedValue({ value: "garbage" });
    const mod = await detailPage();
    const text = collectText(await mod.default(detailArgs())).join("");
    expect(text).toContain("个人信息警示");
  });

  it("DB 抛错(回落 login) + 有效 viewer ⇒ A 区渲染且 fail-closed 不抛", async () => {
    h.viewer = VALID_VIEWER;
    h.systemFindUnique.mockRejectedValue(new Error("db down"));
    const mod = await detailPage();
    const text = collectText(await mod.default(detailArgs())).join("");
    expect(text).toContain("个人信息警示");
  });
});

describe("③ 列表页文案由 DB 真源驱动", () => {
  it("env=login + DB=off ⇒ off 版文案（非在售商品），且不含明文态文案", async () => {
    h.dbValue = "off";
    const mod = await listPage();
    const text = collectText(await mod.default(listArgs())).join("");
    expect(text).toContain("非在售商品");
    expect(text).not.toContain("原始公示明细档案");
  });

  it("env=login + DB=login ⇒ 明文态文案（原始公示明细档案）", async () => {
    h.dbValue = "login";
    const mod = await listPage();
    const text = collectText(await mod.default(listArgs())).join("");
    expect(text).toContain("原始公示明细档案");
    expect(text).not.toContain("非在售商品");
  });

  it("env=login + DB=public ⇒ 明文态文案", async () => {
    h.dbValue = "public";
    const mod = await listPage();
    const text = collectText(await mod.default(listArgs())).join("");
    expect(text).toContain("原始公示明细档案");
  });

  it("env=off 硬锁 + DB=login ⇒ off 版文案且零读库", async () => {
    process.env.CN_SUBSIDY_RAW_MODE = "off";
    h.dbValue = "login";
    const mod = await listPage();
    const text = collectText(await mod.default(listArgs())).join("");
    expect(text).toContain("非在售商品");
    expect(h.systemFindUnique).not.toHaveBeenCalled();
  });

  it(".com ⇒ 列表页站点闸 notFound，且不读库", async () => {
    h.isCn = false;
    const mod = await listPage();
    await expect(mod.default(listArgs())).rejects.toThrow(NOT_FOUND);
    expect(h.notFoundCalls).toBe(1);
    expect(h.systemFindUnique).not.toHaveBeenCalled();
  });
});

describe("④ .com 站点隔离（详情页）", () => {
  it("详情页默认导出 ⇒ notFound 且不读库（即便 env=login/DB=login）", async () => {
    h.isCn = false;
    h.dbValue = "login";
    const mod = await detailPage();
    await expect(mod.default(detailArgs())).rejects.toThrow(NOT_FOUND);
    expect(h.notFoundCalls).toBe(1);
    expect(h.systemFindUnique).not.toHaveBeenCalled();
  });
});
