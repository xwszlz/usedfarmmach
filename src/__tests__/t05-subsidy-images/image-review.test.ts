/**
 * T05 纯函数层单测：状态机单向迁移 / 11 项留痕 / 白名单 fail-closed / 动作前置校验。
 * 不连库、不触网，全部通过显式构造的 config / row 驱动。
 */
import { describe, it, expect } from "vitest";
import {
  assertChecksComplete,
  assertRejectNote,
  assertReviewable,
  assertReviewTransition,
  assertSourceAllowed,
  buildReviewPatch,
  ImageReviewError,
  nextReviewStatus,
  REGISTER_TRACE_FIELDS,
  REVIEW_TRACE_FIELDS,
  reviewStatusForAction,
  type ReviewableRow,
} from "@/lib/subsidy/image-review";
import { isImageFetchAllowed, type RawFeatureConfig } from "@/lib/subsidy/raw-mode";

function cfg(allowlist: string[], imageEnabled = true): RawFeatureConfig {
  return {
    mode: "login",
    roles: [],
    pageSize: 50,
    imageEnabled,
    imageSourceAllowlist: allowlist,
    imageModelLimit: 100,
  };
}

function fullRow(): ReviewableRow {
  return {
    modelKey: "品牌|品类|型号",
    sourceUrl: "https://example.com/a.jpg",
    sourceDomain: "example.com",
    finalUrl: "https://example.com/a.jpg",
    httpStatus: 200,
    contentType: "image/jpeg",
    fetchedAt: new Date("2026-11-08T00:00:00Z"),
    sha256: "deadbeef",
    ossUrl: "https://usedfarmmach-oss.oss-cn-beijing.aliyuncs.com/subsidy-images/deadbeef.jpg",
    reviewedBy: "u1",
    reviewedAt: new Date("2026-11-08T01:00:00Z"),
    reviewStatus: "pending",
    reviewNote: null,
  };
}

describe("① 状态机：单向迁移", () => {
  it("pending + approve → approved；pending + reject → rejected", () => {
    expect(nextReviewStatus("pending", "approve")).toBe("approved");
    expect(nextReviewStatus("pending", "reject")).toBe("rejected");
    expect(reviewStatusForAction("approve")).toBe("approved");
    expect(reviewStatusForAction("reject")).toBe("rejected");
    expect(() => assertReviewTransition("pending", "approved")).not.toThrow();
    expect(() => assertReviewTransition("pending", "rejected")).not.toThrow();
  });

  it("非法迁移一律抛错（approved→pending / rejected→approved / 重复复核）", () => {
    const illegal: Array<[string, string]> = [
      ["approved", "pending"],
      ["rejected", "approved"],
      ["approved", "approved"], // 重复复核
      ["rejected", "rejected"], // 重复复核
      ["approved", "rejected"],
      ["rejected", "pending"],
      ["pending", "pending"],
    ];
    for (const [from, to] of illegal) {
      expect(() => assertReviewTransition(from, to)).toThrow(ImageReviewError);
    }
    expect(() => nextReviewStatus("approved", "approve")).toThrow(ImageReviewError);
    expect(() => nextReviewStatus("rejected", "approve")).toThrow(ImageReviewError);
  });

  it("rejected 保留 reviewNote 且行不物理删除（patch 无删除语义）", () => {
    const patch = buildReviewPatch({
      action: "reject",
      actorId: "u1",
      now: new Date("2026-11-08T02:00:00Z"),
      note: "来源不实",
    });
    expect(patch.reviewStatus).toBe("rejected");
    expect(patch.reviewNote).toBe("来源不实");
    // patch 只含 4 个写入字段，绝不携带任何删除标记
    expect(Object.keys(patch).sort()).toEqual(
      ["reviewNote", "reviewStatus", "reviewedAt", "reviewedBy"].sort()
    );
    // 把 patch 应用到内存行后，行对象仍在、note 保留（不物理删除）
    const row = { ...fullRow(), ...patch };
    expect(row).toBeTruthy();
    expect(row.reviewNote).toBe("来源不实");
    expect(row.reviewStatus).toBe("rejected");
  });

  it("approve 的 note 可为 null，reject 的 note 去空白", () => {
    const a = buildReviewPatch({ action: "approve", actorId: "u1", now: new Date() });
    expect(a.reviewNote).toBeNull();
    const r = buildReviewPatch({ action: "reject", actorId: "u1", now: new Date(), note: "  不合规  " });
    expect(r.reviewNote).toBe("不合规");
  });
});

describe("② assertReviewable：11 项留痕缺一即抛错且状态保持 pending", () => {
  it("完整 11 项不抛错", () => {
    expect(() => assertReviewable(fullRow())).not.toThrow();
    expect(REGISTER_TRACE_FIELDS).toHaveLength(9);
    expect(REVIEW_TRACE_FIELDS).toHaveLength(2);
  });

  it("逐一挖空 11 项中的任意 1 项都抛 TRACE_INCOMPLETE", () => {
    const fields = [...REGISTER_TRACE_FIELDS, ...REVIEW_TRACE_FIELDS];
    for (const f of fields) {
      const row: ReviewableRow = { ...fullRow(), [f]: null };
      expect(() => assertReviewable(row), `挖空 ${f} 应抛错`).toThrow(ImageReviewError);
      try {
        assertReviewable(row);
      } catch (e) {
        expect((e as ImageReviewError).code).toBe("TRACE_INCOMPLETE");
      }
    }
  });

  it("字符串空白 / httpStatus 非法也视为缺失", () => {
    expect(() => assertReviewable({ ...fullRow(), sha256: "   " })).toThrow(ImageReviewError);
    expect(() => assertReviewable({ ...fullRow(), httpStatus: Number.NaN })).toThrow(ImageReviewError);
  });

  it("抛错后候选行状态仍是 pending（纯函数无副作用、未落库）", () => {
    const row = fullRow();
    row.sha256 = "";
    expect(() => assertReviewable(row)).toThrow(ImageReviewError);
    expect(row.reviewStatus).toBe("pending");
  });
});

describe("③ 白名单 fail-closed（抓取器复用）", () => {
  it("白名单为空 ⇒ isImageFetchAllowed=false 且 assertSourceAllowed 抛错（0 新增）", () => {
    const c = cfg([]);
    expect(isImageFetchAllowed(c)).toBe(false);
    expect(() => assertSourceAllowed("https://example.com/a.jpg", c)).toThrow(ImageReviewError);
    try {
      assertSourceAllowed("https://example.com/a.jpg", c);
    } catch (e) {
      expect((e as ImageReviewError).code).toBe("IMAGE_FETCH_DISABLED");
    }
  });

  it("开关未启用（imageEnabled=false）同样 fail-closed", () => {
    const c = cfg(["example.com"], false);
    expect(isImageFetchAllowed(c)).toBe(false);
    expect(() => assertSourceAllowed("https://example.com/a.jpg", c)).toThrow(ImageReviewError);
  });

  it("evil-example.com 绝不被 example.com 放行（禁止 includes 旁路）", () => {
    const c = cfg(["example.com"]);
    expect(() => assertSourceAllowed("https://evil-example.com/a.jpg", c)).toThrow(ImageReviewError);
    expect(() => assertSourceAllowed("https://example.com.evil.tld/a.jpg", c)).toThrow(ImageReviewError);
    try {
      assertSourceAllowed("https://evil-example.com/a.jpg", c);
    } catch (e) {
      expect((e as ImageReviewError).code).toBe("SOURCE_NOT_ALLOWED");
    }
  });

  it("精确等值命中通过并返回小写 hostname", () => {
    const c = cfg(["example.com"]);
    expect(assertSourceAllowed("https://example.com/a.jpg", c)).toBe("example.com");
    expect(assertSourceAllowed("https://EXAMPLE.COM/a.jpg", c)).toBe("example.com");
  });

  it("以 '.' 开头的 allowlist 项按 endsWith 放行子域，仍不放行 evil 域", () => {
    const c = cfg([".example.com"]);
    expect(assertSourceAllowed("https://img.example.com/a.jpg", c)).toBe("img.example.com");
    expect(() => assertSourceAllowed("https://evil-example.com/a.jpg", c)).toThrow(ImageReviewError);
  });

  it("协议只允许 https；非法 URL 抛错", () => {
    const c = cfg(["example.com"]);
    expect(() => assertSourceAllowed("http://example.com/a.jpg", c)).toThrow(ImageReviewError);
    expect(() => assertSourceAllowed("not-a-url", c)).toThrow(ImageReviewError);
  });
});

describe("④ 动作前置校验", () => {
  it("approve 要求 4 项 checks 全为 true", () => {
    const all = { modelMatch: true, sourceReal: true, notAi: true, licensed: true };
    expect(() => assertChecksComplete(all)).not.toThrow();
    for (const k of ["modelMatch", "sourceReal", "notAi", "licensed"] as const) {
      expect(() => assertChecksComplete({ ...all, [k]: false })).toThrow(ImageReviewError);
    }
    expect(() => assertChecksComplete(undefined)).toThrow(ImageReviewError);
  });

  it("reject 要求 reviewNote 非空并返回去空白文本", () => {
    expect(assertRejectNote("  不合规  ")).toBe("不合规");
    expect(() => assertRejectNote("")).toThrow(ImageReviewError);
    expect(() => assertRejectNote("   ")).toThrow(ImageReviewError);
    expect(() => assertRejectNote(null)).toThrow(ImageReviewError);
  });
});
