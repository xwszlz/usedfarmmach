import { test } from "node:test";
import assert from "node:assert/strict";
const { isSecureContext } = await import("../src/lib/cookie-secure.ts");

test("undefined request → false (不强制 secure，保证可存储)", () => {
  assert.equal(isSecureContext(), false);
});

test("HTTP 协议 → false（修复前此处为 true，会锁死 .cn 后台）", () => {
  assert.equal(
    isSecureContext({ nextUrl: { protocol: "http:" }, headers: { get: () => null } }),
    false
  );
});

test("HTTPS 协议 → true（保持安全）", () => {
  assert.equal(
    isSecureContext({ nextUrl: { protocol: "https:" }, headers: { get: () => null } }),
    true
  );
});

test("HTTP 但反向代理透传 x-forwarded-proto:https → true（.cn 修好 SSL 后的场景）", () => {
  assert.equal(
    isSecureContext({
      nextUrl: { protocol: "http:" },
      headers: { get: (k) => (k === "x-forwarded-proto" ? "https" : null) },
    }),
    true
  );
});

test("x-forwarded-proto 为非 https → false", () => {
  assert.equal(
    isSecureContext({
      nextUrl: { protocol: "http:" },
      headers: { get: (k) => (k === "x-forwarded-proto" ? "http" : null) },
    }),
    false
  );
});
