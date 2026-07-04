/**
 * Open API 中间件 — API Key 验证 + 速率限制
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export interface ApiKeyInfo {
  id: string;
  userId: string;
  name: string;
  scope: string;
  rateLimitPerHour: number;
  rateLimitPerDay: number;
}

/**
 * 验证 API Key 并检查速率限制
 * 返回 null 表示验证失败，错误信息已写入 response
 */
export async function validateApiKey(request: NextRequest): Promise<{ keyInfo: ApiKeyInfo } | NextResponse> {
  const authHeader = request.headers.get("authorization");
  const apiKey = authHeader?.replace("Bearer ", "") || searchParamKey(request);

  if (!apiKey || !apiKey.startsWith("sk_")) {
    return NextResponse.json(
      { error: "Missing or invalid API key. Use 'Authorization: Bearer sk_xxx' header." },
      { status: 401 }
    );
  }

  const keyRecord = await prisma.apiKey.findFirst({
    where: { key: apiKey, status: "active" },
  });

  if (!keyRecord) {
    return NextResponse.json({ error: "Invalid or revoked API key" }, { status: 403 });
  }

  // 检查过期
  if (keyRecord.expiresAt && keyRecord.expiresAt < new Date()) {
    return NextResponse.json({ error: "API key has expired" }, { status: 403 });
  }

  // 简单速率限制：基于totalRequests vs rateLimitPerDay
  if (keyRecord.totalRequests >= keyRecord.rateLimitPerDay) {
    return NextResponse.json(
      { error: "Daily rate limit exceeded", limit: keyRecord.rateLimitPerDay, used: keyRecord.totalRequests },
      { status: 429 }
    );
  }

  // 异步更新使用统计
  prisma.apiKey
    .update({
      where: { id: keyRecord.id },
      data: {
        totalRequests: { increment: 1 },
        lastUsedAt: new Date(),
      },
    })
    .catch(() => {});

  return {
    keyInfo: {
      id: keyRecord.id,
      userId: keyRecord.userId,
      name: keyRecord.name,
      scope: keyRecord.scope,
      rateLimitPerHour: keyRecord.rateLimitPerHour,
      rateLimitPerDay: keyRecord.rateLimitPerDay,
    },
  };
}

function searchParamKey(request: NextRequest): string | null {
  const { searchParams } = new URL(request.url);
  return searchParams.get("api_key");
}
