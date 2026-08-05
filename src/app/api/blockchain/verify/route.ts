/**
 * 区块链溯源 API
 *
 * GET /api/blockchain/verify?productId=xxx — 获取产品溯源链
 * GET /api/blockchain/verify?hash=xxx — 按哈希验证某条记录
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import crypto from "crypto";

export const dynamic = "force-dynamic";

// 计算区块哈希
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

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const productId = searchParams.get("productId");
    const hash = searchParams.get("hash");

    // 按哈希查询单条记录
    if (hash) {
      const record = await prisma.blockchainRecord.findFirst({
        where: { currentHash: hash },
      });
      if (!record) {
        return NextResponse.json({ error: "Record not found" }, { status: 404 });
      }

      // 验证哈希
      const recalculatedHash = calculateBlockHash(
        record.blockIndex,
        record.previousHash,
        record.eventData,
        record.timestamp.toISOString(),
        record.operatorId
      );
      const isVerified = recalculatedHash === record.currentHash;

      return NextResponse.json({
        record,
        verification: {
          isVerified,
          recalculatedHash,
          originalHash: record.currentHash,
          message: isVerified
            ? "Blockchain record verified successfully"
            : "WARNING: Hash mismatch! Record may have been tampered with.",
        },
      });
    }

    // 按产品获取完整溯源链
    if (!productId) {
      return NextResponse.json({ error: "productId or hash is required" }, { status: 400 });
    }

    const records = await prisma.blockchainRecord.findMany({
      where: { productId },
      orderBy: { blockIndex: "asc" },
    });

    // 验证整条链
    const chainVerification = records.map((record, index) => {
      const recalculatedHash = calculateBlockHash(
        record.blockIndex,
        record.previousHash,
        record.eventData,
        record.timestamp.toISOString(),
        record.operatorId
      );
      const hashMatches = recalculatedHash === record.currentHash;
      const chainLinksCorrect =
        index === 0 || record.previousHash === records[index - 1].currentHash;

      return {
        blockIndex: record.blockIndex,
        eventType: record.eventType,
        timestamp: record.timestamp,
        hashValid: hashMatches,
        chainLinkValid: chainLinksCorrect,
        isVerified: hashMatches && chainLinksCorrect,
      };
    });

    const allVerified = chainVerification.every((v) => v.isVerified);

    return NextResponse.json({
      productId,
      totalBlocks: records.length,
      chain: records.map((r) => ({
        ...r,
        eventData: r.eventData ? JSON.parse(r.eventData) : null,
      })),
      verification: {
        allBlocksVerified: allVerified,
        blockDetails: chainVerification,
        message: allVerified
          ? "All blockchain records verified. Chain integrity confirmed."
          : "WARNING: Some blocks failed verification. Chain may be compromised.",
      },
    });
  } catch (error) {
    console.error("Blockchain verify error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
