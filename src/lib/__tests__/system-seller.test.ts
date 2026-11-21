import { describe, it, expect, vi } from "vitest";
import type { PrismaClient } from "@prisma/client";
import {
  SYSTEM_SELLER_EMAIL,
  SYSTEM_SELLER_USERNAME,
  SYSTEM_SELLER_COMPANY,
  getOrCreateSystemSellerId,
} from "@/lib/system-seller";
import { MINIAPP_SELLER_EMAIL } from "@/lib/cn-sync/run-sync";

/**
 * 系统卖家「单一真源」漂移护栏 + 小程序发布兜底逻辑。
 *
 * 起因（2026-11-21）：`/api/miniapp/products` 的卖家兜底曾写死 id=`miniapp_default`
 * （2026-06-13 建的历史账号 `miniapp@usedfarmmach.com`），而 `.cn→.com` 同步器
 * 只认 email=`miniprogram@shendiao.com` 这个账号。两者不是同一个 ⇒ 挂在旧账号下的
 * 产品每轮同步都被判「id 被非同步来源产品占用」，进 conflict 并反复告警
 * （.com 侧累计 54 条冲突账本、每 24h 弹 1-2 条）。
 *
 * 这里用两条断言把坑钉死：
 * 1. 发布兜底用的邮箱必须与同步器认定的系统卖家邮箱**完全相同**；
 * 2. 兜底解析行为（先查后建、并发冲突回查）不被改坏。
 */
describe("系统卖家邮箱：单一真源", () => {
  it("与 cn-sync 同步器的判定键完全一致（改任一侧都会红）", () => {
    expect(SYSTEM_SELLER_EMAIL).toBe(MINIAPP_SELLER_EMAIL);
  });

  it("钉死为 miniprogram@shendiao.com，不得退回 miniapp_default", () => {
    expect(SYSTEM_SELLER_EMAIL).toBe("miniprogram@shendiao.com");
    expect(SYSTEM_SELLER_EMAIL).not.toContain("miniapp_default");
  });
});

describe("getOrCreateSystemSellerId", () => {
  function makeClient(overrides: {
    findUnique?: ReturnType<typeof vi.fn>;
    create?: ReturnType<typeof vi.fn>;
  }) {
    return {
      user: {
        findUnique: overrides.findUnique ?? vi.fn(),
        create: overrides.create ?? vi.fn(),
      },
    } as unknown as PrismaClient;
  }

  it("账号已存在：直接复用，不创建", async () => {
    const findUnique = vi.fn().mockResolvedValue({ id: "cmqpa97eq0000d6ko4mxqs07j" });
    const create = vi.fn();
    const id = await getOrCreateSystemSellerId(makeClient({ findUnique, create }));

    expect(id).toBe("cmqpa97eq0000d6ko4mxqs07j");
    expect(create).not.toHaveBeenCalled();
    expect(findUnique).toHaveBeenCalledWith({
      where: { email: "miniprogram@shendiao.com" },
      select: { id: true },
    });
  });

  it("账号缺失：按系统卖家口径创建（零 PII、积分兜底）", async () => {
    const findUnique = vi.fn().mockResolvedValue(null);
    const create = vi.fn().mockResolvedValue({ id: "new-system-seller" });
    const id = await getOrCreateSystemSellerId(makeClient({ findUnique, create }));

    expect(id).toBe("new-system-seller");
    expect(create).toHaveBeenCalledTimes(1);
    const data = create.mock.calls[0][0].data;
    expect(data.email).toBe("miniprogram@shendiao.com");
    expect(data.username).toBe(SYSTEM_SELLER_USERNAME);
    expect(data.companyName).toBe(SYSTEM_SELLER_COMPANY);
    expect(data.credits).toBe(999999);
    expect(data.isActive).toBe(true);
    // 零自然人 PII：不得写入手机号 / 真实姓名
    expect(data.phone).toBeUndefined();
    expect(data.name).toBeUndefined();
  });

  it("并发创建撞唯一约束：回查成功，不把错误抛给调用方", async () => {
    const findUnique = vi
      .fn()
      .mockResolvedValueOnce(null) // 首次查不到
      .mockResolvedValueOnce({ id: "won-by-other-request" }); // 回查命中
    const create = vi.fn().mockRejectedValue(new Error("Unique constraint failed"));
    const id = await getOrCreateSystemSellerId(makeClient({ findUnique, create }));

    expect(id).toBe("won-by-other-request");
    expect(findUnique).toHaveBeenCalledTimes(2);
  });

  it("回查仍失败：原样抛出（不吞错）", async () => {
    const findUnique = vi.fn().mockResolvedValue(null);
    const create = vi.fn().mockRejectedValue(new Error("Unique constraint failed"));

    await expect(getOrCreateSystemSellerId(makeClient({ findUnique, create }))).rejects.toThrow(
      "Unique constraint failed"
    );
  });
});
