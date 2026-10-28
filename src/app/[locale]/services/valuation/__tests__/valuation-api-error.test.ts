/**
 * 估值请求失败文案守卫（413 / 504 / 502 不能再被静默吞掉）
 * ─────────────────────────────────────────────────────────
 * 真实背景：Vercel 请求体超限返回 **413 `FUNCTION_PAYLOAD_TOO_LARGE`，响应体是 HTML 错误页**；
 * nginx 504/502 同样是 HTML。历史实现里 `res.json().catch(() => null)` 把这类响应解析成
 * `null`，然后**静默回退成本地粗算** —— 用户看到的是「AI 估值明显不聪明」而不是「请求失败」，
 * 本轮投诉的一部分正是被这个假象带偏的。
 *
 * 本文件锁死：
 *   ① 413/504/408/502 各自出明确中文文案，不能只说「失败」；
 *   ② 后端给了结构化 `error` 就优先用它（积分不足/护栏拦截等）；
 *   ③ HTML 错误页不把原始 HTML 当错误信息抛给用户。
 *
 * 运行：`npx vitest run src/app/\[locale\]/services/valuation`
 */
import { describe, expect, it } from "vitest";
import {
  describeValuationHttpError,
  readServerErrorMessage,
} from "@/components/valuation/valuation-api-error";

describe("describeValuationHttpError · 按状态码出明确文案", () => {
  it("413 → 提示图片体积超限并给出可操作建议", () => {
    const msg = describeValuationHttpError(413);
    expect(msg).toContain("413");
    expect(msg).toContain("图片");
    expect(msg).toContain("减少图片数量");
  });

  it("504 / 408 → 提示网关超时 + 重试指引", () => {
    expect(describeValuationHttpError(504)).toContain("超时");
    expect(describeValuationHttpError(408)).toContain("超时");
    expect(describeValuationHttpError(504)).toContain("重试");
  });

  it("502 → 提示 AI 服务暂时不可用", () => {
    const msg = describeValuationHttpError(502);
    expect(msg).toContain("502");
    expect(msg).toContain("暂时不可用");
  });

  it("其它非 2xx → 带状态码的通用文案（不允许只显示「失败」）", () => {
    expect(describeValuationHttpError(500)).toBe("估值失败（HTTP 500），请稍后重试。");
    expect(describeValuationHttpError(400)).toContain("HTTP 400");
  });

  it("后端给了结构化 error 就优先用它（积分不足 / 护栏拦截 / 参数非法）", () => {
    expect(describeValuationHttpError(402, "积分不足，请先充值")).toBe("积分不足，请先充值");
    expect(describeValuationHttpError(413, "  单次上传体积过大  ")).toBe("单次上传体积过大");
  });

  it("serverMsg 为空白串时回落到状态码文案，不显示空白错误", () => {
    expect(describeValuationHttpError(413, "   ")).toContain("413");
    expect(describeValuationHttpError(502, null)).toContain("502");
  });
});

describe("readServerErrorMessage · 只取可用信息，不抛 HTML 给用户", () => {
  it("JSON 错误体 → 取 error 字段", async () => {
    const res = new Response(JSON.stringify({ success: false, error: "积分不足" }), {
      status: 402,
      headers: { "Content-Type": "application/json" },
    });
    await expect(readServerErrorMessage(res)).resolves.toBe("积分不足");
  });

  it("JSON 只有 message 字段 → 取 message", async () => {
    const res = new Response(JSON.stringify({ message: "参数非法" }), { status: 400 });
    await expect(readServerErrorMessage(res)).resolves.toBe("参数非法");
  });

  it("HTML 错误页（413 网关页）→ 返回 null，交给状态码文案", async () => {
    const res = new Response(
      "<html><body><h1>413 FUNCTION_PAYLOAD_TOO_LARGE</h1></body></html>",
      { status: 413, headers: { "Content-Type": "text/html" } }
    );
    await expect(readServerErrorMessage(res)).resolves.toBeNull();
  });

  it("空响应体 → 返回 null", async () => {
    const res = new Response("", { status: 502 });
    await expect(readServerErrorMessage(res)).resolves.toBeNull();
  });
});
