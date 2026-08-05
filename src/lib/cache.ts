/**
 * 通用缓存层
 * 
 * 支持两种模式：
 * 1. 内存缓存（默认）：无需额外配置，开发环境和低并发场景可用
 * 2. Upstash Redis：配置环境变量后自动切换，适合 Vercel 生产环境跨实例共享
 * 
 * 环境变量：
 *   UPSTASH_REDIS_REST_URL=https://xxx.upstash.io
 *   UPSTASH_REDIS_REST_TOKEN=xxx
 * 
 * 缓存策略：
 *   - 列表 API：按请求 URL+参数作为 key，TTL 60 秒
 *   - 详情 API：按产品 ID 作为 key，TTL 300 秒
 *   - 首次访问后，后续请求从缓存直接返回（毫秒级）
 */

interface CacheProvider {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T, ttlSeconds?: number): Promise<void>;
  del(key: string): Promise<void>;
}

// 内存缓存实现
class MemoryCache implements CacheProvider {
  private store = new Map<
    string,
    { value: string; expiresAt: number }
  >();

  async get<T>(key: string): Promise<T | null> {
    const item = this.store.get(key);
    if (!item) return null;

    if (item.expiresAt < Date.now()) {
      this.store.delete(key);
      return null;
    }

    try {
      return JSON.parse(item.value) as T;
    } catch {
      this.store.delete(key);
      return null;
    }
  }

  async set<T>(key: string, value: T, ttlSeconds?: number): Promise<void> {
    const expiresAt = ttlSeconds
      ? Date.now() + ttlSeconds * 1000
      : Number.MAX_SAFE_INTEGER;

    this.store.set(key, {
      value: JSON.stringify(value),
      expiresAt,
    });
  }

  async del(key: string): Promise<void> {
    this.store.delete(key);
  }
}

// Redis 缓存实现（懒加载）
let RedisCache: any = null;
let redisProvider: CacheProvider | null = null;

async function getRedisProvider(): Promise<CacheProvider | null> {
  if (redisProvider) return redisProvider;

  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!url || !token) return null;

  try {
    if (!RedisCache) {
      // 使用 require 动态加载，避免 TypeScript 在 @upstash/redis 未安装时报错
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const upstash = require("@upstash/redis");
      RedisCache = upstash.Redis;
    }

    const redis = new RedisCache({ url, token });

    redisProvider = {
      async get<T>(key: string): Promise<T | null> {
        try {
          const value = await redis.get(key);
          if (value === null || value === undefined) return null;
          return value as T;
        } catch (err) {
          console.error("[Cache] Redis get failed:", err);
          return null;
        }
      },
      async set<T>(key: string, value: T, ttlSeconds?: number): Promise<void> {
        try {
          if (ttlSeconds) {
            await redis.set(key, value, { ex: ttlSeconds });
          } else {
            await redis.set(key, value);
          }
        } catch (err) {
          console.error("[Cache] Redis set failed:", err);
        }
      },
      async del(key: string): Promise<void> {
        try {
          await redis.del(key);
        } catch (err) {
          console.error("[Cache] Redis del failed:", err);
        }
      },
    };

    return redisProvider;
  } catch (err) {
    console.error("[Cache] Redis init failed:", err);
    return null;
  }
}

// 缓存管理器
class CacheManager implements CacheProvider {
  private memory = new MemoryCache();
  private redis: CacheProvider | null = null;
  private initialized = false;

  private async init() {
    if (this.initialized) return;
    this.redis = await getRedisProvider();
    this.initialized = true;
  }

  async get<T>(key: string): Promise<T | null> {
    await this.init();

    // 优先 Redis
    if (this.redis) {
      const value = await this.redis.get<T>(key);
      if (value !== null) {
        // 同步回内存，作为本地副本
        await this.memory.set(key, value, 60);
        return value;
      }
    }

    // fallback 内存
    return this.memory.get<T>(key);
  }

  async set<T>(key: string, value: T, ttlSeconds?: number): Promise<void> {
    await this.init();

    // 写入内存
    await this.memory.set(key, value, ttlSeconds);

    // 写入 Redis（如果可用）
    if (this.redis) {
      await this.redis.set(key, value, ttlSeconds);
    }
  }

  async del(key: string): Promise<void> {
    await this.init();

    // 删除内存
    await this.memory.del(key);

    // 删除 Redis（如果可用）
    if (this.redis) {
      await this.redis.del(key);
    }
  }
}

// 导出单例
export const cache = new CacheManager();

/**
 * 生成缓存 key
 */
export function cacheKey(prefix: string, identifier: string): string {
  return `shendiao:${prefix}:${identifier}`;
}

/**
 * 缓存装饰器：自动缓存函数返回值
 */
export async function withCache<T>(
  key: string,
  fn: () => Promise<T>,
  ttlSeconds = 60
): Promise<T> {
  const cached = await cache.get<T>(key);
  if (cached !== null) {
    console.log(`[Cache] hit: ${key}`);
    return cached;
  }

  console.log(`[Cache] miss: ${key}`);
  const result = await fn();
  await cache.set(key, result, ttlSeconds);
  return result;
}
