/**
 * ResendProvider 的 `.cn` 构建占位实现（P1 · D3 数据不出境 · 结构性保证）
 *
 * 为什么需要这个文件：
 * 原先只在 config.ts 里用 `if (CN_BUILD_GUARD) { ... return }` 提前返回，指望
 * webpack / Terser 把后面的 `import("./provider-resend")` 当死代码消除掉。
 * 2026-11-20 实测证明这条假设不成立 —— webpack 在 Terser 做死代码消除**之前**
 * 就已建好 async chunk 图，`SITE=cn` 的产物里仍然出现含 api.resend.com 的
 * `.next/server/chunks/*.js`。也就是说「.cn 产物物理零命中 Resend」这条红线
 * 当时是靠另一件事（provider-resend.ts 里的 webpackIgnore）偶然满足的，
 * 换掉 webpackIgnore 就会破防。
 *
 * 所以改由 next.config.js 在 `SITE=cn` 时用 NormalModuleReplacementPlugin
 * 把 `./provider-resend` 直接换成本文件：不依赖任何优化器行为，物理上就没有
 * Resend 端点、没有 fetch 出网代码。
 *
 * 若本文件被真的调用到，说明 .cn 的路由判断出了 bug（数据要出境了），
 * 因此这里**必须抛错**，绝不静默降级。
 */
import type { EmailInput, EmailProvider, EmailSendResult } from "./provider";

/** 占位 Provider：构造成功但发信必定失败，用于把误配置暴露成显式错误 */
export class ResendProvider implements EmailProvider {
  readonly name = "resend";

  constructor(_apiKey: string, _from: string, _replyTo?: string) {
    // 故意不发任何网络请求
  }

  async send(_input: EmailInput): Promise<EmailSendResult> {
    throw new Error(
      "[mail] .cn 构建中 ResendProvider 已被禁用（数据不出境红线），此调用不应发生"
    );
  }
}
