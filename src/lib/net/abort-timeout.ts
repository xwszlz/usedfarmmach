/**
 * 跨浏览器安全的「超时 AbortSignal」构造器。
 *
 * 为什么不用 `AbortSignal.timeout(ms)`：
 *   它是 2022 年才落地的静态方法（Chrome 103+ / Safari 16+ / Firefox 100+），
 *   在老浏览器和国产双核浏览器的旧内核里是 `undefined`，
 *   调用会直接抛 `TypeError: AbortSignal.timeout is not a function`，
 *   表现为用户点了按钮什么都没发生（2026-11 线上 P0：AI 深度分析点了直接红字报错）。
 *   本项目 `.com` 站面向 8 语种的全球用户，不能假定浏览器够新，
 *   所以这里用 `AbortController` + `setTimeout` 手工实现。
 *
 * ⚠️ 本模块同时被浏览器（`"use client"` 组件）和 Node 侧代码引用，
 *    因此**不得**引入任何 `node:*` 依赖，保持零运行时依赖。
 *
 * 用法：
 *   const t = createTimeoutSignal(300_000);
 *   try { await fetch(url, { signal: t.signal }); }
 *   finally { t.dispose(); }   // ← 必须调用，否则定时器泄漏
 */

/** `createTimeoutSignal` 的返回值。 */
export interface TimeoutSignal {
  /** 传给 `fetch` / `AbortSignal` 消费方的 signal */
  signal: AbortSignal;
  /**
   * 取消底层定时器。
   *
   * 请求结束（成功 / 失败 / 超时）后**必须**调用，否则 `setTimeout` 会一直挂到
   * 超时时刻才释放（长连接 300s 场景下既占内存也会在组件卸载后留下无用定时器）。
   * 幂等：重复调用不会抛异常。
   */
  dispose: () => void;
}

/**
 * 构造一个「`ms` 毫秒后自动 abort」的 signal，语义对齐 `AbortSignal.timeout(ms)`。
 *
 * 差异说明（有意为之，调用方需知）：
 *   - 原生 `AbortSignal.timeout()` 触发时 reject 的 `err.name` 是 `TimeoutError`；
 *   - 手工 `controller.abort()` 抛的是 `AbortError`。
 *   本项目的超时分支同时判断两者（见 `deep-analysis-card.tsx` 的 catch），
 *   所以切换实现不需要改文案。
 *
 * @param ms 超时毫秒数。`<= 0` 时立即 abort（与 `AbortSignal.timeout(0)` 一致）。
 * @returns signal 与配套的 `dispose()`。
 */
export function createTimeoutSignal(ms: number): TimeoutSignal {
  const controller = new AbortController();
  // 负数 / NaN 一律按 0 处理：Math.max 对 NaN 返回 NaN，setTimeout(NaN) 会当作 0 处理，
  // 行为虽然正确但依赖规范细节，这里显式归一化，读代码的人不必去查表。
  const delay = Number.isFinite(ms) ? Math.max(0, ms) : 0;
  const timer: ReturnType<typeof setTimeout> = setTimeout(() => controller.abort(), delay);
  return {
    signal: controller.signal,
    dispose: (): void => {
      clearTimeout(timer);
    },
  };
}
