/**
 * Paddle.js 全局类型最小声明（仅 .com 国际站使用）。
 *
 * 为满足「本次改造不新增 npm 依赖」的约束，不引入 @paddle/paddle-js，
 * 只声明 recharge-form.tsx 实际用到的两个 API：
 *   - Paddle.Initialize({ token, environment })
 *   - Paddle.Checkout.open({ transactionId })
 *
 * 脚本源：https://cdn.paddle.com/paddle/v2/paddle.js
 * 环境变量：NEXT_PUBLIC_PADDLE_CLIENT_TOKEN / NEXT_PUBLIC_PADDLE_ENV
 *
 * 注意：PaddleGlobal 放在 declare global 内成为全局接口，这样 recharge-form.tsx
 * 无需 import 即可直接引用；Window.Paddle 为可选（脚本未加载/被拦时为 undefined），
 * 调用方必须判空。
 */
declare global {
  interface PaddleGlobal {
    Initialize(opts: { token: string; environment: "sandbox" | "production" }): void;
    Checkout: { open(opts: { transactionId: string }): void };
  }

  interface Window {
    Paddle?: PaddleGlobal;
  }
}

export {};
