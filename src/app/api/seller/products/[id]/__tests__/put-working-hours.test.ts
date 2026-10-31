/**
 * `PUT /api/seller/products/[id]` —— 数值字段「空」与「零」的区分回归用例
 *
 * 被锁死的那个 Bug（2026-10-31 实测于 origin/main 4fb8788）：
 *
 *   workingHours: workingHours ? Number(workingHours) : null
 *
 * `workingHours` 的语义是「累计使用小时数」，**0 是合法业务值**（全新机 / 刚试机的机器），
 * 但 `0` 在 JS 里是 falsy ⇒ 走 `: null` 分支，被写成 NULL；而字符串 `"0"` 是 truthy，
 * `Number("0") === 0` ⇒ 正确写入 0。同一个字段，**因为入参类型不同而结果不同**：
 *
 *   PUT { workingHours: 0 }     → 库里 null   ❌（AI 视觉识别回填送的就是数字）
 *   PUT { workingHours: "0" }   → 库里 0      ✅
 *   PUT { workingHours: "" }    → 库里 null   ✅（清空）
 *
 * 修复后统一为「空 → null，可转成有限数字 → 数字本身，转不成数字 → null」，
 * 与同文件 `descriptionZh`、以及 `/api/internal/products` 里
 * `finalWorkingHours`（注释原文：「工时由发布者填写，0 合法；空/非数字落 null
 * （不能把 0 当空值丢掉）」）完全同一口径。
 *
 * 另：文件末尾那条用例**刻意锁定** enginePower/尺寸/净重的现有语义（0 → null），
 * 因为评审结论是「只有工时的 0 有业务含义，其余 5 个字段保持原样，不许批量改成新写法」。
 * 若将来业务口径变了，这条用例会先红，提醒改的人是有意为之。
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// vi.mock 会被提升到文件顶部，因此 mock 函数必须用 vi.hoisted 声明
const { updateMock, permissionMock } = vi.hoisted(() => ({
  updateMock: vi.fn(),
  permissionMock: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    product: {
      update: updateMock,
    },
    brand: {
      findFirst: vi.fn(async () => null),
      create: vi.fn(async () => ({ id: "brand-created" })),
    },
    category: {
      findFirst: vi.fn(async () => null),
      create: vi.fn(async () => ({ id: "category-created" })),
    },
  },
}));

vi.mock("@/lib/auth", () => ({
  getTokenFromHeaders: () => "test-token",
  verifyToken: () => ({ userId: "user-1", role: "seller" }),
}));

vi.mock("@/lib/product-edit-auth", () => ({
  checkProductEditPermission: permissionMock,
  describeEditDenial: () => "无权限",
  canDeleteAnyProduct: () => false,
}));

vi.mock("@/lib/exchange-rate", () => ({
  cnyToUsd: (cny: number) => Math.round((cny / 7.2) * 100) / 100,
  getUsdPerCny: async () => 7.2,
}));

import { PUT } from "../route";

/** 构造一个最小的 PUT 请求（只带要测的那一个字段） */
function makePutRequest(body: Record<string, unknown>): NextRequest {
  return new NextRequest("http://localhost/api/seller/products/prod-1", {
    method: "PUT",
    headers: {
      "content-type": "application/json",
      authorization: "Bearer test-token",
    },
    body: JSON.stringify(body),
  });
}

/** 调一次 PUT，返回本次真正传给 Prisma 的 `data` */
async function putAndCaptureData(body: Record<string, unknown>): Promise<Record<string, any>> {
  const res = await PUT(makePutRequest(body), { params: { id: "prod-1" } });
  expect(res.status).toBe(200);
  expect(updateMock).toHaveBeenCalledTimes(1);
  return updateMock.mock.calls[0][0].data as Record<string, any>;
}

beforeEach(() => {
  updateMock.mockReset();
  permissionMock.mockReset();
  permissionMock.mockResolvedValue({
    allowed: true,
    outcome: "owner",
    role: "seller",
    product: { id: "prod-1", sellerId: "user-1" },
  });
  // Prisma 会回填 updatedAt 等字段，这里只关心传进去的 data
  updateMock.mockImplementation(async (args: { data: unknown }) => ({ id: "prod-1", ...(args.data as object) }));
});

describe("workingHours：空与零必须区分（核心回归）", () => {
  it("数字 0（全新机）⇒ 写入 0，不是 null", async () => {
    const data = await putAndCaptureData({ workingHours: 0 });
    expect(data.workingHours).toBe(0);
    expect(data.workingHours).not.toBeNull();
    // 顺便盯住类型：必须是 number，不能是字符串 "0"
    expect(typeof data.workingHours).toBe("number");
  });

  it("字符串 \"0\" ⇒ 写入 0（修复前后都正确，用作对照）", async () => {
    const data = await putAndCaptureData({ workingHours: "0" });
    expect(data.workingHours).toBe(0);
    expect(typeof data.workingHours).toBe("number");
  });

  it("空字符串 \"\"（用户清空）⇒ 写入 null", async () => {
    const data = await putAndCaptureData({ workingHours: "" });
    expect(data.workingHours).toBeNull();
  });

  it("显式 null ⇒ 写入 null", async () => {
    const data = await putAndCaptureData({ workingHours: null });
    expect(data.workingHours).toBeNull();
  });

  it("字符串 \"12\" ⇒ 写入 12", async () => {
    const data = await putAndCaptureData({ workingHours: "12" });
    expect(data.workingHours).toBe(12);
  });

  it("数字 12 ⇒ 写入 12", async () => {
    const data = await putAndCaptureData({ workingHours: 12 });
    expect(data.workingHours).toBe(12);
  });

  it("非数字 \"abc\" ⇒ 写入 null（绝不把 NaN 塞进库）", async () => {
    const data = await putAndCaptureData({ workingHours: "abc" });
    expect(data.workingHours).toBeNull();
    // 反证：NaN !== NaN，用 Number.isNaN 断言它真的不是 NaN
    expect(Number.isNaN(data.workingHours)).toBe(false);
  });

  it("NaN ⇒ 写入 null", async () => {
    const data = await putAndCaptureData({ workingHours: Number.NaN });
    expect(data.workingHours).toBeNull();
  });

  it("Infinity ⇒ 写入 null（Number.isFinite 拦掉）", async () => {
    const data = await putAndCaptureData({ workingHours: "Infinity" });
    expect(data.workingHours).toBeNull();
  });

  it("完全不带该字段 ⇒ 不写 workingHours（避免误清空）", async () => {
    const data = await putAndCaptureData({ modelName: "只改型号" });
    expect("workingHours" in data).toBe(false);
  });
});

describe("其余数值字段保持原语义（本轮刻意不动）", () => {
  /**
   * 评审结论：`0 kW / 0 mm / 0 kg` 都不存在实物，只有工时的 0 有业务含义。
   * 因此 enginePower / overallLength / overallWidth / overallHeight / netWeight
   * **保持原有 `x ? Number(x) : null` 写法**，这里把它锁定成「0 → null」，
   * 防止后来者「顺手批量改成同一个新写法」而改变既有语义。
   */
  it("正常值照常写入：enginePower \"120\" ⇒ 120，netWeight \"3200\" ⇒ 3200", async () => {
    const data = await putAndCaptureData({ enginePower: "120", netWeight: "3200" });
    expect(data.enginePower).toBe(120);
    expect(data.netWeight).toBe(3200);
  });

  it("这 5 个字段传数字 0 仍然是 null（现状锁定，不是本轮要修的东西）", async () => {
    const data = await putAndCaptureData({
      enginePower: 0,
      overallLength: 0,
      overallWidth: 0,
      overallHeight: 0,
      netWeight: 0,
    });
    expect(data.enginePower).toBeNull();
    expect(data.overallLength).toBeNull();
    expect(data.overallWidth).toBeNull();
    expect(data.overallHeight).toBeNull();
    expect(data.netWeight).toBeNull();
  });
});
