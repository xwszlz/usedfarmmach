/**
 * 通用限流（阶段 1，任务 T04）
 *
 * 复用 src/lib/cache.ts（prod=Upstash Redis，dev=内存），跨实例一致。
 * 滑动窗口计数：windowSec 内最多 max 次；key 不存在则新建。
 */
import { cache } from "./cache";
import { sha256 } from "./email-token";

/** 限流结果 */
export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterSec: number;
}

/**
 * 滑动窗口限流。
 * @param key      限流维度 key（如 rateLimitKeys.forgotPasswordEmail(email)）
 * @param windowSec 窗口秒数
 * @param max      窗口内最大次数
 */
export async function rateLimit(opts: {
  key: string;
  windowSec: number;
  max: number;
}): Promise<RateLimitResult> {
  const { key, windowSec, max } = opts;
  const now = Date.now();

  const raw = await cache.get<number[]>(key);
  const hits = (raw ?? []).filter((t) => now - t < windowSec * 1000);

  if (hits.length >= max) {
    const oldest = hits[0] ?? now;
    const retryAfterSec = Math.ceil(
      (oldest + windowSec * 1000 - now) / 1000
    );
    return { allowed: false, remaining: 0, retryAfterSec: Math.max(1, retryAfterSec) };
  }

  hits.push(now);
  await cache.set(key, hits, windowSec);
  return { allowed: true, remaining: max - hits.length, retryAfterSec: 0 };
}

/** 预设限流 key 构造器（邮箱统一小写后再 hash） */
export const rateLimitKeys = {
  forgotPasswordEmail: (email: string): string =>
    `rl:fpwd:email:${sha256(email.toLowerCase())}`,
  forgotPasswordIp: (ip: string): string => `rl:fpwd:ip:${ip}`,
  sendVerifyEmail: (email: string): string =>
    `rl:verify:email:${sha256(email.toLowerCase())}`,
  adminReminder: (userId: string): string => `rl:remind:user:${userId}`,
};
