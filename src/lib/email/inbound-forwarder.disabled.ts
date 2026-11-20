/**
 * `.cn` 构建的占位实现（数据不出境 D3）
 *
 * next.config.js 在 `SITE=cn` 时把 `inbound-forwarder` 结构性替换成本文件，
 * 于是 `.cn` 产物里物理上不存在 api.resend.com、不存在任何出网代码。
 * 行为等价于「未配置」：返回 200 跳过，不重投、不报错。
 *
 * ⚠️ 本文件必须与 inbound-forwarder.ts 保持同一导出签名（仅 handleInboundEmail）。
 * 不要在这里 import 任何会拉进 Resend/axios 的东西。
 */
import type { InboundResult } from "@/lib/email/inbound";

export async function handleInboundEmail(): Promise<InboundResult> {
  return {
    status: 200,
    body: { received: true, skipped: "cn-build-disabled" },
  };
}
