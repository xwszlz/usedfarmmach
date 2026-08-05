/**
 * 保存搜索条件 API
 *
 * GET    /api/saved-searches  — 获取当前用户保存的搜索
 * POST   /api/saved-searches  — 保存搜索条件 { name, filters, notifyOnNew }
 * DELETE /api/saved-searches?id=xxx — 删除保存的搜索
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getTokenFromHeaders, getUserFromToken } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const token = getTokenFromHeaders(request.headers);
    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await getUserFromToken(token);
    if (!user) {
      return NextResponse.json({ error: "Invalid token" }, { status: 401 });
    }

    const searches = await prisma.savedSearch.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
    });

    const searchesWithParsed = searches.map((s) => ({
      ...s,
      filters: s.filters ? JSON.parse(s.filters) : {},
    }));

    return NextResponse.json({ savedSearches: searchesWithParsed });
  } catch (error) {
    console.error("Failed to fetch saved searches:", error);
    return NextResponse.json({ error: "Failed to fetch saved searches" }, { status: 500 });
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
      return NextResponse.json({ error: "Invalid token" }, { status: 401 });
    }

    const { name, filters, notifyOnNew } = await request.json();
    if (!name || !filters) {
      return NextResponse.json({ error: "Missing name or filters" }, { status: 400 });
    }

    const savedSearch = await prisma.savedSearch.create({
      data: {
        userId: user.id,
        name,
        filters: JSON.stringify(filters),
        notifyOnNew: notifyOnNew || false,
      },
    });

    return NextResponse.json({ savedSearch }, { status: 201 });
  } catch (error) {
    console.error("Failed to save search:", error);
    return NextResponse.json({ error: "Failed to save search" }, { status: 500 });
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
      return NextResponse.json({ error: "Invalid token" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    if (!id) {
      return NextResponse.json({ error: "Missing id" }, { status: 400 });
    }

    await prisma.savedSearch.deleteMany({
      where: { id, userId: user.id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete saved search:", error);
    return NextResponse.json({ error: "Failed to delete saved search" }, { status: 500 });
  }
}
