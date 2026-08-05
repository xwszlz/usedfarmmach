/**
 * 数据库连接实例（双库同源）
 *
 * 按 SITE 环境变量选择对应的 DATABASE_URL：
 * - SITE=com（或未设置）→ 使用 DATABASE_URL（Neon 境外）
 * - SITE=cn → 使用 DATABASE_URL_CN（阿里云 RDS 北京）
 *
 * 统一导出 prisma 实例，业务代码无需关心底层是哪个库。
 */

import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

/**
 * 获取当前站点对应的 DATABASE_URL。
 * .com → DATABASE_URL（Neon 境外）
 * .cn   → DATABASE_URL_CN（阿里云 RDS 北京）
 */
function getDatabaseUrl(): string {
  const site = process.env.SITE ?? "com";
  if (site === "cn") {
    const url = process.env.DATABASE_URL_CN;
    if (!url) {
      throw new Error(
        "[db.ts] SITE=cn 但未设置 DATABASE_URL_CN 环境变量。请确保 .cn 部署环境中已配置 DATABASE_URL_CN。"
      );
    }
    return url;
  }
  // .com 或未设置
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "[db.ts] 未设置 DATABASE_URL 环境变量。请确保 .com 部署环境中已配置 DATABASE_URL。"
    );
  }
  return url;
}

/**
 * 创建对应站点的 PrismaClient 实例。
 * 注意：由于 PrismaClient 在构建时已固定 datasource url（默认 DATABASE_URL），
 * 此处通过 runtime 直接 new PrismaClient({ datasources: { db: { url } } })
 * 实现双库切换（需确保两库 schema 同源）。
 */
function createPrismaClient(): PrismaClient {
  const databaseUrl = getDatabaseUrl();
  return new PrismaClient({
    datasources: {
      db: {
        url: databaseUrl,
      },
    },
  });
}

export const prisma: PrismaClient =
  globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

/**
 * 获取当前站点对应的数据库 URL（用于诊断/管理工具）。
 */
export function getCurrentDatabaseUrl(): string {
  return getDatabaseUrl();
}
