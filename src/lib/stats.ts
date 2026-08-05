/**
 * 前端埋点工具：调用公开 track API 进行浏览/播放计数。
 *
 * 设计约定（见架构文档 §3 接口签名）：
 *   POST /api/stats/track
 *   body:  { scope: "product"|"category"|"video"|"fieldVideo", id: string }
 *   resp:  { success: true, data: { scope, id, count } }  // count 为最新累计值
 *          { success: false, error }  // 404 id 不存在 / 400 scope 非法 / 网络异常
 */

export type TrackScope = "product" | "category" | "video" | "fieldVideo";

export interface TrackResponse {
  success: boolean;
  data?: {
    scope: TrackScope;
    id: string;
    count: number;
  };
  error?: string;
}

/**
 * 向埋点接口上报一次浏览/播放，并返回最新累计值。
 * 任何异常（网络错误 / 非 2xx）均被吞掉并返回 null，保证调用方 UI 不崩。
 *
 * @param scope 计数维度
 * @param id    实体主键（product.id / category.id / productVideo.id / fieldVideo.id）
 * @returns 最新累计值（number）或 null（失败 / 静默跳过）
 */
export async function trackView(scope: TrackScope, id: string): Promise<number | null> {
  try {
    const res = await fetch("/api/stats/track", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      // 不缓存，确保每次访问都真实打到服务端
      cache: "no-store",
      body: JSON.stringify({ scope, id }),
    });
    if (!res.ok) return null;
    const json = (await res.json()) as TrackResponse;
    if (json?.success && json?.data) return json.data.count;
    return null;
  } catch {
    return null;
  }
}
