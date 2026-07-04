/**
 * 一机一码 — 添加生命周期事件 API
 *
 * POST /api/machinery/event
 *   { productId, eventType, title, description, operator, location }
 *   → 为指定产品的一机一码添加生命周期事件
 *
 * 事件类型：manufactured, listed, inspected, traded, exported, maintained, transferred
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

const VALID_EVENT_TYPES = [
  "manufactured",
  "listed",
  "inspected",
  "traded",
  "exported",
  "maintained",
  "transferred",
];

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { productId, eventType, title, description, operator, location, evidence, metadata } = body;

    if (!productId || !eventType || !title) {
      return NextResponse.json(
        { success: false, error: "缺少必填字段: productId, eventType, title" },
        { status: 400 }
      );
    }

    if (!VALID_EVENT_TYPES.includes(eventType)) {
      return NextResponse.json(
        { success: false, error: `无效事件类型，支持: ${VALID_EVENT_TYPES.join(", ")}` },
        { status: 400 }
      );
    }

    // 查找产品的一机一码
    const identity = await prisma.machineryIdentity.findUnique({
      where: { productId },
      select: { id: true },
    });

    if (!identity) {
      return NextResponse.json(
        { success: false, error: "该产品尚未生成一机一码，请先生成" },
        { status: 404 }
      );
    }

    // 创建事件
    const event = await prisma.machineryEvent.create({
      data: {
        identityId: identity.id,
        eventType,
        title,
        description: description || null,
        operator: operator || null,
        location: location || null,
        evidence: evidence ? JSON.stringify(evidence) : null,
        metadata: metadata ? JSON.stringify(metadata) : null,
        eventDate: new Date(),
      },
    });

    return NextResponse.json({
      success: true,
      data: event,
      message: "生命周期事件添加成功",
    });
  } catch (error: any) {
    console.error("[MachineryEvent] 添加错误:", error);
    return NextResponse.json(
      { success: false, error: "添加生命周期事件失败" },
      { status: 500 }
    );
  }
}
