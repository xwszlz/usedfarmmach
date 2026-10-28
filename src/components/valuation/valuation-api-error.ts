/**
 * 估值请求失败的文案与错误体解析（纯函数，无 React/Next 依赖）。
 *
 * 为什么单独成文件：
 * - `page.tsx` 是 Next 的页面模块，**不允许有默认导出/特定字段之外的导出**，
 *   否则 `next build` 的类型检查（`.next/types` 的 OmitWithTag 校验）会直接报错；
 * - 这段逻辑（413/504/502 的文案映射）是最需要被回归测试锁死的部分，
 *   放进独立模块才能在 node 环境里单测，不必把整个估值页面拖进测试。
 *
 * 背景：Vercel 请求体超限返回 413 `FUNCTION_PAYLOAD_TOO_LARGE`，**响应体是 HTML 错误页**；
 * nginx 504/502 同样是 HTML。历史实现用 `res.json().catch(() => null)` 把这类响应解析成
 * null，再静默回退成本地粗算 —— 用户看到的是「AI 估值明显不聪明」而不是「请求失败」。
 */

/**
 * 非 2xx 响应的用户可读文案。
 *
 * @param status HTTP 状态码
 * @param serverMsg 后端结构化错误信息（有则优先，如「积分不足」「今日次数已用完」）
 */
export function describeValuationHttpError(status: number, serverMsg?: string | null): string {
  const msg = (serverMsg ?? "").trim();
  if (msg) return msg;
  if (status === 413) {
    return "上传的图片总体积超过服务端上限（413）。请减少图片数量或使用更小的照片。";
  }
  if (status === 504 || status === 408) {
    return "估值超时（服务端超过网关时限）。请重试；若反复出现请联系平台。";
  }
  if (status === 502) {
    return "AI 服务暂时不可用（502），请稍后重试。";
  }
  return `估值失败（HTTP ${status}），请稍后重试。`;
}

/**
 * 读取一个「可能是 JSON 也可能是 HTML」的错误响应体。
 *
 * body 只能读一次，所以统一用 `text()`；HTML 错误页绝不把原文抛给用户
 * （只交给 {@link describeValuationHttpError} 按状态码出文案），
 * 但后端给了结构化 `error` / `message` 时优先使用它。
 *
 * @returns 可用错误文案；拿不到则为 null
 */
export async function readServerErrorMessage(res: Response): Promise<string | null> {
  const raw = await res.text().catch(() => "");
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as { error?: unknown; message?: unknown };
    const msg = parsed?.error ?? parsed?.message;
    return typeof msg === "string" && msg.trim() ? msg : null;
  } catch {
    // HTML 错误页（413/504 网关页）：交给 describeValuationHttpError 按状态码出文案
    return null;
  }
}
