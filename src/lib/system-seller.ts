/**
 * 系统卖家（小程序发布账号）解析 —— 小程序发布兜底的单一真源
 *
 * 背景：小程序发布的产品需要一个「系统卖家」承接，而 `.cn → .com` 同步器
 * 以 email=`miniprogram@shendiao.com` 作为「同系统卖家」的判定键
 * （见 `src/lib/cn-sync/run-sync.ts` 的 `MINIAPP_SELLER_EMAIL` /
 * `resolveSystemSeller`）。历史上小程序老接口 `/api/miniapp/products`
 * 把兜底写死成 id=`miniapp_default`（另一个 2026-06 建的历史账号），
 * 与新账号不一致 ⇒ 这些产品在同步时被判定为「id 被非同步来源产品占用」，
 * 每轮进 conflict 并反复告警。
 *
 * 设计约束（additive-only）：
 * - 本模块**只服务发布兜底**，不改动 `cn-sync/run-sync.ts` 与
 *   `api/internal/products` 里既有且已验证的解析逻辑；
 * - 两者的一致性由单测 `__tests__/system-seller.test.ts` 断言锁死，
 *   任一侧改了邮箱就会红，而不是变成运行期才发现的错挂卖家。
 */
import crypto from "crypto";
import bcrypt from "bcryptjs";
import type { PrismaClient } from "@prisma/client";

/**
 * 系统卖家邮箱。必须与 `src/lib/cn-sync/run-sync.ts` 的
 * `MINIAPP_SELLER_EMAIL` 完全一致（单测断言）。
 */
export const SYSTEM_SELLER_EMAIL = "miniprogram@shendiao.com";

/** .com 可见性规则（`product-visibility.ts`）同样以该邮箱为判定键 */
export const SYSTEM_SELLER_USERNAME = "miniprogram";
export const SYSTEM_SELLER_COMPANY = "小程序发布";

/**
 * 取（必要时创建）系统卖家的 user id。
 *
 * 语义与 `cn-sync/run-sync.ts::resolveSystemSeller` 保持一致：
 * 先查后建、并发唯一约束冲突时回查、零自然人 PII。
 *
 * 刻意要求显式传 client（不在此模块 import `@/lib/db`），
 * 便于单测用假客户端跑纯逻辑，不碰真实数据库连接。
 */
export async function getOrCreateSystemSellerId(
  client: PrismaClient
): Promise<string> {
  const existing = await client.user.findUnique({
    where: { email: SYSTEM_SELLER_EMAIL },
    select: { id: true },
  });
  if (existing) return existing.id;

  const passwordHash = await bcrypt.hash(crypto.randomBytes(32).toString("hex"), 10);
  try {
    const created = await client.user.create({
      data: {
        email: SYSTEM_SELLER_EMAIL,
        username: SYSTEM_SELLER_USERNAME,
        passwordHash,
        role: "seller",
        companyName: SYSTEM_SELLER_COMPANY,
        country: "CN",
        preferredLanguage: "zh",
        credits: 999999, // 系统账号，避免发布积分不足
        isActive: true,
      },
      select: { id: true },
    });
    return created.id;
  } catch (e) {
    // 并发创建竞争：唯一约束失败 → 回查
    const again = await client.user.findUnique({
      where: { email: SYSTEM_SELLER_EMAIL },
      select: { id: true },
    });
    if (again) return again.id;
    throw e;
  }
}
