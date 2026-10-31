/**
 * `ai-assistant.tsx` 的 AI 回填：工时字段「识别值 → 表单值」回归用例
 *
 * 被锁死的 Bug（2026-10-31 之前）：
 *
 *   filled[formKey] = rawValue ? String(rawValue) : ""
 *
 * `0` 是合法业务值（全新机 / 刚试机，仪表盘读数就是 0），但数字 0 是 falsy ⇒
 * 被当成「没识别到」清成空串 "" ⇒ 后面的保存链路再正确也救不回来。
 * 这是工时 0 链路上的**第二道** falsy 闸（第一道在 recognize API，第三道在编辑页 payload）。
 *
 * 修法：只把「空」（null / undefined / ""，以及 NaN/Infinity 这类非法数字）当空，
 * 其余（含 0 与 "0"）原样字符串化 —— 表单输入框里就是 "0"，不会被清掉。
 *
 * 注：本文件测的是从组件模块里抽出的**纯函数** `formatWorkingHoursForForm`。
 * 不渲染组件的原因：`handleSelectiveFill` 是组件内部闭包，node 环境下不可达；
 * 抽成纯函数既让规则可单测，也保证组件里调用的是同一份实现（不是"测一套、跑一套"）。
 */
import { describe, it, expect } from "vitest";

import { formatWorkingHoursForForm } from "../ai-assistant";

describe("formatWorkingHoursForForm：0 不能被当空值", () => {
  it("数字 0（全新机）⇒ \"0\"（核心回归）", () => {
    expect(formatWorkingHoursForForm(0)).toBe("0");
  });

  it("字符串 \"0\" ⇒ \"0\"", () => {
    expect(formatWorkingHoursForForm("0")).toBe("0");
  });

  it("数字 3200 ⇒ \"3200\"", () => {
    expect(formatWorkingHoursForForm(3200)).toBe("3200");
  });

  it("字符串 \"3200\" ⇒ \"3200\"", () => {
    expect(formatWorkingHoursForForm("3200")).toBe("3200");
  });

  it("null ⇒ \"\"（清空）", () => {
    expect(formatWorkingHoursForForm(null)).toBe("");
  });

  it("undefined ⇒ \"\"", () => {
    expect(formatWorkingHoursForForm(undefined)).toBe("");
  });

  it("空串 \"\" ⇒ \"\"", () => {
    expect(formatWorkingHoursForForm("")).toBe("");
  });

  it("NaN ⇒ \"\"（不把 \"NaN\" 渲染进输入框）", () => {
    expect(formatWorkingHoursForForm(Number.NaN)).toBe("");
  });

  it("Infinity ⇒ \"\"", () => {
    expect(formatWorkingHoursForForm(Number.POSITIVE_INFINITY)).toBe("");
  });

  it("非法字符串 \"abc\" 原样保留，交给后端归一（不在前端猜）", () => {
    expect(formatWorkingHoursForForm("abc")).toBe("abc");
  });
});
