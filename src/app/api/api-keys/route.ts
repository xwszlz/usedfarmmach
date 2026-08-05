/**
 * API Key 管理 API
 *
 * GET    /api/api-keys         — 获取当前用户的API Key列表
 * POST   /api/api-keys         — 创建新的API Key
 * DELETE /api/api-keys?id=xxx  — 吊销API Key
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getTokenFromHeaders, getUserFromToken } from "@/lib/auth";
import crypto from "crypto";

export const dynamic = "force-dynamic";

// 生成API Key: sk_<32位随机hex>
function generateApiKey(): string {
  return "sk_" + crypto.randomBytes(16).toString("hex");
}

export async function GET(request: NextRequest) {
  try {
    const token = getTokenFromHeaders(request.headers);
    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const user = await getUserFromToken(token);
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const keys = await prisma.apiKey.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        key: true,
        name: true,
        organization: true,
        scope: true,
        rateLimitPerHour: true,
        rateLimitPerDay: true,
        totalRequests: true,
        lastUsedAt: true,
        status: true,
        expiresAt: true,
        createdAt: true,
      },
    });

    return NextResponse.json({ keys });
  } catch (error) {
    console.error("API Keys GET error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const token = getTokenFromHeaders(request.headers);
    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const user = await getUserFromToken(token);
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const body = await request.json();
    const { name, organization, scope, rateLimitPerHour, rateLimitPerDay, expiresAt } = body;

    if (!name || typeof name !== "string") {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }

    // 限制每用户最多5个Key
    const existingCount = await prisma.apiKey.count({
      where: { userId: user.id, status: "active" },
    });
    if (existingCount >= 5) {
      return NextResponse.json({ error: "Maximum 5 active API keys allowed" }, { status: 400 });
    }

    const apiKey = generateApiKey();

    const newKey = await prisma.apiKey.create({
      data: {
        key: apiKey,
        userId: user.id,
        name: name.slice(0, 100),
        organization: organization?.slice(0, 200) || null,
        scope: scope === "read_write" ? "read_write" : "read",
        rateLimitPerHour: Math.min(rateLimitPerHour || 100, 1000),
        rateLimitPerDay: Math.min(rateLimitPerDay || 1000, 10000),
        expiresAt: expiresAt ? new Date(expiresAt) : null,
      },
    });

    return NextResponse.json({
      id: newKey.id,
      key: apiKey,
      name: newKey.name,
      organization: newKey.organization,
      scope: newKey.scope,
      rateLimitPerHour: newKey.rateLimitPerHour,
      rateLimitPerDay: newKey.rateLimitPerDay,
      expiresAt: newKey.expiresAt,
      createdAt: newKey.createdAt,
      message: "API Key created successfully. Save it now - it won't be shown again.",
    });
  } catch (error) {
    console.error("API Keys POST error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const token = getTokenFromHeaders(request.headers);
    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const user = await getUserFromToken(token);
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    if (!id) {
      return NextResponse.json({ error: "API Key ID is required" }, { status: 400 });
    }

    const key = await prisma.apiKey.findFirst({
      where: { id, userId: user.id },
    });
    if (!key) {
      return NextResponse.json({ error: "API Key not found" }, { status: 404 });
    }

    await prisma.apiKey.update({
      where: { id },
      data: { status: "revoked" },
    });

    return NextResponse.json({ message: "API Key revoked" });
  } catch (error) {
    console.error("API Keys DELETE error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
