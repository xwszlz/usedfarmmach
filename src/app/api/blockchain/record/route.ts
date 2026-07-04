/**
 * 区块链记录写入 API
 *
 * POST /api/blockchain/record
 * Body: { productId, eventType, eventData, operatorName }
 *
 * 在产品生命周期事件发生时调用，自动创建新区块
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getTokenFromHeaders, getUserFromToken } from "@/lib/auth";
import crypto from "crypto";

export const dynamic = "force-dynamic";

function calculateBlockHash(
  blockIndex: number,
  previousHash: string,
  eventData: string,
  timestamp: string,
  operatorId: string | null
): string {
  const data = `${blockIndex}${previousHash}${eventData}${timestamp}${operatorId || ""}`;
  return crypto.createHash("sha256").update(data).digest("hex");
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
    const { productId, eventType, eventData, operatorName } = body;

    if (!productId || !eventType) {
      return NextResponse.json({ error: "productId and eventType are required" }, { status: 400 });
    }

    // 验证产品存在
    const product = await prisma.product.findUnique({ where: { id: productId } });
    if (!product) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }

    // 获取当前链的最后一个区块
    const lastBlock = await prisma.blockchainRecord.findFirst({
      where: { productId },
      orderBy: { blockIndex: "desc" },
    });

    const blockIndex = lastBlock ? lastBlock.blockIndex + 1 : 0;
    const previousHash = lastBlock ? lastBlock.currentHash : "0".repeat(64); // 创世块的前哈希
    const timestamp = new Date();
    const eventDataStr = JSON.stringify(eventData || {});

    const currentHash = calculateBlockHash(
      blockIndex,
      previousHash,
      eventDataStr,
      timestamp.toISOString(),
      user.id
    );

    const record = await prisma.blockchainRecord.create({
      data: {
        productId,
        blockIndex,
        previousHash,
        currentHash,
        eventType,
        eventData: eventDataStr,
        timestamp,
        operatorId: user.id,
        operatorName: operatorName || user.username || user.email || "Unknown",
        isVerified: true,
        verifiedAt: new Date(),
      },
    });

    return NextResponse.json({
      success: true,
      block: {
        blockIndex: record.blockIndex,
        currentHash: record.currentHash,
        previousHash: record.previousHash,
        eventType: record.eventType,
        timestamp: record.timestamp,
      },
      message: `Block #${blockIndex} added to chain for product ${productId}`,
    });
  } catch (error) {
    console.error("Blockchain record POST error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
