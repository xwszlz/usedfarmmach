/**
 * 单测：导出链路 PII 门禁公共层（`@/lib/sales-strategy/pii-export`）
 *
 * 这是 excel / pdf 两个导出路由的**唯一口径**实现，故单独锁住三件事：
 *  ① 解锁集解析：只认 `unlock:dealer_` / `unlock:lead_`，前缀必须剥掉，null 行不炸；
 *  ② 留痕 field 恒为 `export:` 前缀，**永不被①识别为解锁**（否则 = 永久解锁 = 权限泄漏）；
 *  ③ 留痕写入失败时向上抛（fail-closed：无痕不发文件），不静默吞掉。
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db", () => ({
  prisma: { piiAuditLog: { create: vi.fn() } },
}));

import { prisma } from "@/lib/db";
import {
  DEALER_UNLOCK_FIELD_PREFIX,
  EXPORT_AUDIT_FIELD_PREFIX,
  LEAD_UNLOCK_FIELD_PREFIX,
  UNLOCK_FIELD_PREFIX,
  buildExportAuditField,
  buildExportAuditPurpose,
  buildUnlockedContactSets,
  buildUnlockedDealerSet,
  recordAdminFullPiiExport,
  type ExportAuditScope,
} from "@/lib/sales-strategy/pii-export";

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(prisma.piiAuditLog.create).mockResolvedValue({ id: "log_1" } as any);
});

describe("前缀常量口径", () => {
  it("解锁前缀与留痕前缀互相不重叠", () => {
    expect(UNLOCK_FIELD_PREFIX).toBe("unlock:");
    expect(DEALER_UNLOCK_FIELD_PREFIX).toBe("unlock:dealer_");
    expect(LEAD_UNLOCK_FIELD_PREFIX).toBe("unlock:lead_");
    expect(EXPORT_AUDIT_FIELD_PREFIX).toBe("export:");
    // 留痕前缀绝不能落进 unlock: 命名空间
    expect(EXPORT_AUDIT_FIELD_PREFIX.startsWith(UNLOCK_FIELD_PREFIX)).toBe(false);
    expect(EXPORT_AUDIT_FIELD_PREFIX.startsWith(DEALER_UNLOCK_FIELD_PREFIX)).toBe(false);
    expect(EXPORT_AUDIT_FIELD_PREFIX.startsWith(LEAD_UNLOCK_FIELD_PREFIX)).toBe(false);
  });
});

describe("buildUnlockedDealerSet", () => {
  it("只认 unlock:dealer_ 前缀，并剥掉前缀得到裸 id", () => {
    const set = buildUnlockedDealerSet([
      { field: "unlock:dealer_abc" },
      { field: "unlock:dealer_def" },
    ]);
    expect([...set].sort()).toEqual(["abc", "def"]);
    // 前缀未剥干净会与 dealer.id 对不上 ⇒ 全表打码
    expect(set.has("dealer_abc")).toBe(false);
  });

  it("lead 前缀 / 留痕 export: 前缀一律不得混入经销商解锁集", () => {
    const set = buildUnlockedDealerSet([
      { field: "unlock:lead_xyz" },
      { field: "export:dealer_batch" },
      { field: "export:dealer_abc" }, // 即便带 id 也不得解锁
      { field: "unlock:dealer_" }, // 空 id 丢弃
    ]);
    expect(set.size).toBe(0);
  });

  it("容错：null / undefined / 空数组 / 非字符串 field", () => {
    expect(buildUnlockedDealerSet(null).size).toBe(0);
    expect(buildUnlockedDealerSet(undefined).size).toBe(0);
    expect(buildUnlockedDealerSet([]).size).toBe(0);
    expect(buildUnlockedDealerSet([{ field: null }, {} as any]).size).toBe(0);
  });
});

describe("buildUnlockedContactSets", () => {
  it("经销商与线索分别归集，互不串台", () => {
    const { dealers, leads } = buildUnlockedContactSets([
      { field: "unlock:dealer_d1" },
      { field: "unlock:lead_l1" },
      { field: "unlock:lead_l2" },
      { field: "export:dealer+lead_batch" },
      { field: "unlock:dealer_" },
    ]);
    expect([...dealers]).toEqual(["d1"]);
    expect([...leads].sort()).toEqual(["l1", "l2"]);
  });

  it("容错：null 输入返回两个空集", () => {
    const { dealers, leads } = buildUnlockedContactSets(null);
    expect(dealers.size).toBe(0);
    expect(leads.size).toBe(0);
  });
});

describe("buildExportAuditField", () => {
  const scopes: ExportAuditScope[] = ["dealer", "lead", "dealer+lead"];

  it.each(scopes)("scope=%s 时前缀为 export: 且绝不是 unlock:", (scope) => {
    const field = buildExportAuditField(scope);
    expect(field).toBe(`export:${scope}_batch`);
    expect(field.startsWith(UNLOCK_FIELD_PREFIX)).toBe(false);
  });

  it("任何留痕 field 都不会解锁任何经销商/线索（回灌死锁验证）", () => {
    for (const scope of scopes) {
      const field = buildExportAuditField(scope);
      expect(buildUnlockedDealerSet([{ field }]).size).toBe(0);
      const { dealers, leads } = buildUnlockedContactSets([{ field }]);
      expect(dealers.size).toBe(0);
      expect(leads.size).toBe(0);
    }
  });
});

describe("buildExportAuditPurpose", () => {
  it("含渠道 / 角色 / 范围 / 行数，不含任何 PII 正文", () => {
    const purpose = buildExportAuditPurpose({
      channel: "pdf",
      role: "super_admin",
      scope: "dealer=3;lead=2",
      rows: 5,
    });
    expect(purpose).toBe(
      "admin_export_full_pii channel=pdf role=super_admin scope=dealer=3;lead=2 rows=5"
    );
  });
});

describe("recordAdminFullPiiExport", () => {
  it("写 action=export 的汇总记录，target 一律 null（不编造）", async () => {
    await recordAdminFullPiiExport({
      actorId: "u1",
      role: "super_admin",
      channel: "excel",
      scope: "all",
      rows: 42,
      auditScope: "dealer",
    });

    expect(prisma.piiAuditLog.create).toHaveBeenCalledTimes(1);
    const data = vi.mocked(prisma.piiAuditLog.create).mock.calls[0][0].data as any;
    expect(data).toMatchObject({
      actorId: "u1",
      targetUserId: null,
      targetListingId: null,
      field: "export:dealer_batch",
      action: "export",
    });
    expect(data.purpose).toContain("rows=42");
    expect(String(data.field).startsWith("unlock:")).toBe(false);
  });

  it("auditScope 缺省时按 dealer 记账", async () => {
    await recordAdminFullPiiExport({
      actorId: "u1",
      role: "admin",
      channel: "excel",
      scope: "cn",
      rows: 1,
    });
    expect((vi.mocked(prisma.piiAuditLog.create).mock.calls[0][0].data as any).field).toBe(
      "export:dealer_batch"
    );
  });

  it("fail-closed：DB 写入失败必须抛出（路由据此 500，绝不明文无痕外发）", async () => {
    vi.mocked(prisma.piiAuditLog.create).mockRejectedValueOnce(new Error("db down"));
    await expect(
      recordAdminFullPiiExport({
        actorId: "u1",
        role: "super_admin",
        channel: "pdf",
        scope: "dealer=1;lead=0",
        rows: 1,
      })
    ).rejects.toThrow("db down");
  });
});
