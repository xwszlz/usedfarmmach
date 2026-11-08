/**
 * T05 config/route.ts PATCH 单测（DB 即时开关）：
 * - 鉴权负向；
 * - env=off → 409 且 upsert 零调用（DB 不得覆盖）；
 * - env≠off + 合法 mode → 200，且写入必须是【裸串】login（不是 JSON.stringify 后的 "\"login\""）；
 * - 非法 mode / 其他 key → 400。
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";

const h = vi.hoisted(() => ({
  isCn: true,
  userFindUnique: vi.fn(),
  systemUpsert: vi.fn(),
}));

vi.mock("@/config/site", () => ({ isCnSite: () => h.isCn }));

vi.mock("@/lib/db", () => ({
  prisma: {
    user: { findUnique: h.userFindUnique },
    systemConfig: { upsert: h.systemUpsert },
  },
}));

vi.mock("@/lib/auth", () => ({
  getTokenFromHeaders: (headers: Headers) => headers.get("x-test-token"),
  verifyToken: (t: string) =>
    t === "good" ? { userId: "u1", role: "super_admin", tier: "free" } : null,
}));

import { PATCH } from "@/app/api/admin/system/config/route";

const URL = "http://localhost/api/admin/system/config";

function req(token: string | null = "good", body: unknown = { key: "subsidy.raw.mode", value: "login" }) {
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (token) headers["x-test-token"] = token;
  return new NextRequest(URL, { method: "PATCH", headers, body: JSON.stringify(body) });
}

beforeEach(() => {
  h.isCn = true;
  h.userFindUnique.mockReset().mockResolvedValue({ role: "super_admin" });
  h.systemUpsert.mockReset().mockResolvedValue({});
  process.env.CN_SUBSIDY_RAW_MODE = "login"; // env≠off，允许 DB 覆盖
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  delete process.env.CN_SUBSIDY_RAW_MODE;
  vi.restoreAllMocks();
});

describe("① 鉴权负向", () => {
  it("无 token / 无效 token / role=editor → 403（且不写库）", async () => {
    expect((await PATCH(req(null))).status).toBe(403);
    expect((await PATCH(req("bad"))).status).toBe(403);

    h.userFindUnique.mockResolvedValue({ role: "editor" });
    expect((await PATCH(req("good"))).status).toBe(403);
    expect(h.systemUpsert).not.toHaveBeenCalled();
  });
});

describe("② env=off 锁定", () => {
  it("getRawMode()==='off' → 409 ENV_LOCKED_OFF 且 upsert 零调用", async () => {
    process.env.CN_SUBSIDY_RAW_MODE = "off";
    const res = await PATCH(req());
    const body = await res.json();
    expect(res.status).toBe(409);
    expect(body.code).toBe("ENV_LOCKED_OFF");
    expect(body.error).toContain("env 已锁定 off");
    expect(h.systemUpsert).not.toHaveBeenCalled();
  });

  it("非 .cn（isCnSite=false）→ getRawMode=off → 409", async () => {
    h.isCn = false;
    process.env.CN_SUBSIDY_RAW_MODE = "public";
    const res = await PATCH(req());
    expect(res.status).toBe(409);
    expect(h.systemUpsert).not.toHaveBeenCalled();
  });
});

describe("③ 合法写入：必须是裸串（不复用 setConfig 的 JSON.stringify）", () => {
  it("env≠off + value=login → 200 且 create/update.value 都是裸串 \"login\"", async () => {
    const res = await PATCH(req());
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data).toEqual({ key: "subsidy.raw.mode", value: "login" });

    expect(h.systemUpsert).toHaveBeenCalledTimes(1);
    const arg = h.systemUpsert.mock.calls[0][0] as {
      where: { key: string };
      create: { key: string; value: string; updatedBy: string };
      update: { value: string; updatedBy: string };
    };
    expect(arg.where.key).toBe("subsidy.raw.mode");
    expect(arg.create.value).toBe("login");
    expect(arg.update.value).toBe("login");
    // 🔴 绝不能是 credits/config.ts::setConfig 会写出的 "\"login\""
    expect(arg.create.value).not.toBe(JSON.stringify("login"));
    expect(arg.update.value).not.toBe(JSON.stringify("login"));
    expect(arg.create.updatedBy).toBe("u1");
    expect(arg.update.updatedBy).toBe("u1");
  });

  it("off / public 同样写裸串", async () => {
    for (const v of ["off", "public"]) {
      h.systemUpsert.mockClear();
      const res = await PATCH(req("good", { key: "subsidy.raw.mode", value: v }));
      expect(res.status).toBe(200);
      const arg = h.systemUpsert.mock.calls[0][0] as { create: { value: string } };
      expect(arg.create.value).toBe(v);
    }
  });
});

describe("④ 输入校验", () => {
  it("非法 mode → 400，零写库", async () => {
    const res = await PATCH(req("good", { key: "subsidy.raw.mode", value: "bogus" }));
    expect(res.status).toBe(400);
    expect((await res.json()).code).toBe("VALIDATION_ERROR");
    expect(h.systemUpsert).not.toHaveBeenCalled();
  });

  it("其他 key → 400，零写库", async () => {
    const res = await PATCH(req("good", { key: "some.other.key", value: "login" }));
    expect(res.status).toBe(400);
    expect(h.systemUpsert).not.toHaveBeenCalled();
  });

  it("非法 JSON → 400", async () => {
    const bad = new NextRequest(URL, {
      method: "PATCH",
      headers: { "x-test-token": "good", "content-type": "application/json" },
      body: "{not json",
    });
    const res = await PATCH(bad);
    expect(res.status).toBe(400);
    expect(h.systemUpsert).not.toHaveBeenCalled();
  });
});
