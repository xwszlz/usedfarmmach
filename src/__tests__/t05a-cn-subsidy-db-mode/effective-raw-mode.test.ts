/**
 * T05-A ① getEffectiveRawMode() —— DB 即时开关「唯一真源」语义单测。
 *
 * 保留真实 raw-mode.ts；只 mock 站点判定与数据层，systemConfig.findUnique 可注入。
 * 证明：env=off 是硬锁（不读库）；env≠off 时 DB 裸字符串值成为唯一真源；
 * DB 行缺失 / 值非法 / 读取抛错 → fail-closed 回落 envMode（不是一律 off）；
 * .com 站点恒 off 且不读库。
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const h = vi.hoisted(() => ({
  isCn: true,
  systemFindUnique: vi.fn(),
}));

vi.mock("@/config/site", () => ({ isCnSite: () => h.isCn }));
vi.mock("@/lib/db", () => ({
  prisma: { systemConfig: { findUnique: h.systemFindUnique } },
  getCurrentDatabaseUrl: () => "mock://no-real-db",
}));

import { getEffectiveRawMode } from "@/lib/subsidy/raw-mode";

const ENV_KEY = "CN_SUBSIDY_RAW_MODE";
const origEnv = process.env[ENV_KEY];

beforeEach(() => {
  h.isCn = true;
  h.systemFindUnique.mockReset().mockResolvedValue({ value: "login" });
  process.env[ENV_KEY] = "login";
});

afterEach(() => {
  if (origEnv === undefined) delete process.env[ENV_KEY];
  else process.env[ENV_KEY] = origEnv;
});

describe("① env=off 是硬锁：恒 off、不读库、DB 值被忽略", () => {
  it.each(["off", "login", "public", "garbage", "LOGIN"])(
    "env=off + DB=%s ⇒ off，且 systemConfig.findUnique 零调用",
    async (dbValue) => {
      process.env[ENV_KEY] = "off";
      h.systemFindUnique.mockResolvedValue({ value: dbValue });
      expect(await getEffectiveRawMode()).toBe("off");
      expect(h.systemFindUnique).not.toHaveBeenCalled();
    }
  );
});

describe("② env≠off 时 DB 值成为唯一真源（秒级开关 / 秒级回滚）", () => {
  it("env=login + DB=off ⇒ off（DB 一键关，零裸露窗口），且确实读了库", async () => {
    h.systemFindUnique.mockResolvedValue({ value: "off" });
    expect(await getEffectiveRawMode()).toBe("off");
    expect(h.systemFindUnique).toHaveBeenCalledTimes(1);
  });

  it("env=login + DB=login ⇒ login", async () => {
    h.systemFindUnique.mockResolvedValue({ value: "login" });
    expect(await getEffectiveRawMode()).toBe("login");
  });

  it("env=login + DB=public ⇒ 返回 DB 的 public（不是 env 的 login）", async () => {
    h.systemFindUnique.mockResolvedValue({ value: "public" });
    expect(await getEffectiveRawMode()).toBe("public");
  });

  it("env=public + DB=off ⇒ off（DB 也可降级，秒级回滚）", async () => {
    process.env[ENV_KEY] = "public";
    h.systemFindUnique.mockResolvedValue({ value: "off" });
    expect(await getEffectiveRawMode()).toBe("off");
  });

  it("env=login + DB=login ⇒ login（DB 与 env 一致时仍返回 login）", async () => {
    h.systemFindUnique.mockResolvedValue({ value: "login" });
    expect(await getEffectiveRawMode()).toBe("login");
  });
});

describe("③ DB 行缺失 / 值非法 / 读取抛错 ⇒ fail-closed 回落 envMode", () => {
  it("行缺失(null) ⇒ 回落 env(login)，显式断言是 login 不是 off", async () => {
    h.systemFindUnique.mockResolvedValue(null);
    const mode = await getEffectiveRawMode();
    expect(mode).toBe("login");
    expect(mode).not.toBe("off");
  });

  it.each(["garbage", "LOGIN", " login ", "", 42, null])(
    "非法 DB 值 %j ⇒ 回落 env(login)",
    async (bad) => {
      h.systemFindUnique.mockResolvedValue({ value: bad });
      expect(await getEffectiveRawMode()).toBe("login");
    }
  );

  it("env=public + 非法 DB ⇒ 回落 env(public)（按 envMode 回落，不是一律 off）", async () => {
    process.env[ENV_KEY] = "public";
    h.systemFindUnique.mockResolvedValue({ value: "garbage" });
    expect(await getEffectiveRawMode()).toBe("public");
  });

  it("DB 读取抛错 ⇒ 回落 env(login)，且不抛", async () => {
    h.systemFindUnique.mockRejectedValue(new Error("db down"));
    await expect(getEffectiveRawMode()).resolves.toBe("login");
  });

  it("行缺失 + env=public ⇒ 回落 public（显式断言回落跟随 envMode）", async () => {
    process.env[ENV_KEY] = "public";
    h.systemFindUnique.mockResolvedValue(null);
    expect(await getEffectiveRawMode()).toBe("public");
  });
});

describe("④ .com（isCnSite=false）恒 off，且不读库", () => {
  it(".com + env=login + DB=public ⇒ off，findUnique 零调用", async () => {
    h.isCn = false;
    h.systemFindUnique.mockResolvedValue({ value: "public" });
    expect(await getEffectiveRawMode()).toBe("off");
    expect(h.systemFindUnique).not.toHaveBeenCalled();
  });
});

describe("⑤ env 自身非法 ⇒ getRawMode=off ⇒ 硬锁（不读库）", () => {
  it("env=LOGIN（大小写不符）⇒ off 且不读库", async () => {
    process.env[ENV_KEY] = "LOGIN";
    h.systemFindUnique.mockResolvedValue({ value: "public" });
    expect(await getEffectiveRawMode()).toBe("off");
    expect(h.systemFindUnique).not.toHaveBeenCalled();
  });
});
