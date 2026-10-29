/**
 * 产品详情页编辑权限矩阵（2026-10-29）
 *
 * 业务口径（产品方拍板）：
 *   - 所有注册登录用户 → 可编辑**自己发布**的产品（含图片、视频）；
 *   - editor（以及 admin / super_admin）→ 可编辑**全站任意**产品（含图片、视频）。
 *
 * 本测试只验证纯判定逻辑，通过 mock 掉 @/lib/db，不触碰真实数据库。
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const findUser = vi.fn();
const findProduct = vi.fn();

vi.mock("@/lib/db", () => ({
  prisma: {
    user: { findUnique: (...args: unknown[]) => findUser(...args) },
    product: { findUnique: (...args: unknown[]) => findProduct(...args) },
  },
}));

import {
  checkProductEditPermission,
  describeEditDenial,
  canDeleteAnyProduct,
  EDIT_ANY_PRODUCT_ROLES,
} from "@/lib/product-edit-auth";

const PRODUCT_ID = "prod-1";
const OWNER_ID = "user-owner";

function mockUser(role: string | null) {
  findUser.mockResolvedValue(role === null ? null : { role });
}
function mockProduct(sellerId: string | null) {
  findProduct.mockResolvedValue(sellerId === null ? null : { id: PRODUCT_ID, sellerId });
}

describe("checkProductEditPermission", () => {
  beforeEach(() => {
    findUser.mockReset();
    findProduct.mockReset();
  });

  it("产品不存在 → not_found，不放行", async () => {
    mockUser("seller");
    mockProduct(null);

    const r = await checkProductEditPermission(OWNER_ID, PRODUCT_ID);

    expect(r.allowed).toBe(false);
    expect(r.outcome).toBe("not_found");
    expect(r.product).toBeNull();
  });

  it("用户不存在（token 指向已删账号）→ anonymous，不放行", async () => {
    mockUser(null);
    mockProduct(OWNER_ID);

    const r = await checkProductEditPermission("ghost", PRODUCT_ID);

    expect(r.allowed).toBe(false);
    expect(r.outcome).toBe("anonymous");
  });

  it("卖家编辑自己发布的产品 → 放行（owner）", async () => {
    mockUser("seller");
    mockProduct(OWNER_ID);

    const r = await checkProductEditPermission(OWNER_ID, PRODUCT_ID);

    expect(r.allowed).toBe(true);
    expect(r.outcome).toBe("owner");
  });

  it("buyer 角色编辑自己发布的产品 → 仍放行（归属优先于角色）", async () => {
    mockUser("buyer");
    mockProduct(OWNER_ID);

    const r = await checkProductEditPermission(OWNER_ID, PRODUCT_ID);

    expect(r.allowed).toBe(true);
    expect(r.outcome).toBe("owner");
  });

  it.each(["editor", "admin", "super_admin"])(
    "%s 编辑他人产品 → 放行（privileged）",
    async (role) => {
      mockUser(role);
      mockProduct(OWNER_ID);

      const r = await checkProductEditPermission("someone-else", PRODUCT_ID);

      expect(r.allowed).toBe(true);
      expect(r.outcome).toBe("privileged");
      expect(r.role).toBe(role);
    }
  );

  it("普通卖家编辑他人产品 → 拒绝（forbidden）", async () => {
    mockUser("seller");
    mockProduct(OWNER_ID);

    const r = await checkProductEditPermission("another-seller", PRODUCT_ID);

    expect(r.allowed).toBe(false);
    expect(r.outcome).toBe("forbidden");
  });

  it("buyer 编辑他人产品 → 拒绝（forbidden）", async () => {
    mockUser("buyer");
    mockProduct(OWNER_ID);

    const r = await checkProductEditPermission("a-buyer", PRODUCT_ID);

    expect(r.allowed).toBe(false);
    expect(r.outcome).toBe("forbidden");
  });

  it("partner_limited 等未授权角色编辑他人产品 → 拒绝", async () => {
    mockUser("partner_limited");
    mockProduct(OWNER_ID);

    const r = await checkProductEditPermission("partner-1", PRODUCT_ID);

    expect(r.allowed).toBe(false);
    expect(r.outcome).toBe("forbidden");
  });

  it("EDIT_ANY_PRODUCT_ROLES 只包含 editor/admin/super_admin（防止误加角色）", () => {
    expect([...EDIT_ANY_PRODUCT_ROLES].sort()).toEqual(
      ["admin", "editor", "super_admin"].sort()
    );
  });
});

describe("canDeleteAnyProduct", () => {
  it.each(["editor", "admin", "super_admin"])("%s 可删除全站任意产品", (role) => {
    expect(canDeleteAnyProduct(role)).toBe(true);
  });

  it.each(["seller", "buyer", "partner_limited", "", null, undefined])(
    "非内部角色（%s）不能删除他人产品",
    (role) => {
      expect(canDeleteAnyProduct(role as string | null | undefined)).toBe(false);
    }
  );
});

describe("describeEditDenial", () => {
  it("按拒绝原因给出可读提示", () => {
    expect(
      describeEditDenial({ allowed: false, outcome: "not_found", role: null, product: null })
    ).toBe("产品不存在");
    expect(
      describeEditDenial({ allowed: false, outcome: "anonymous", role: null, product: null })
    ).toBe("请先登录");
    expect(
      describeEditDenial({ allowed: false, outcome: "forbidden", role: "seller", product: null })
    ).toBe("无权编辑此产品");
  });
});
