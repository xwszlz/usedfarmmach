/**
 * GET /api/credits/transactions —— 本人积分明细真实数据（P0 I-2）
 *
 * 设计依据：《用户体系完善方案_2026-07-24》§3.1 I-2。
 *
 * 鉴权：cookie 会话（getUserFromRequest，与 /api/user/me 一致）。
 * 数据：查真实 CreditTransaction 表，按 userId 倒序分页。库内已有真实流水，
 *   只需暴露；不增发、不改写任何积分。
 *
 * Query（可选）：
 *   page     —— 页码，1-based，默认 1
 *   pageSize —— 每页条数，默认 20，最大 100
 *
 * 返回：
 *   data: Transaction[]（id, type, amount, balance, reason, createdAt）
 *   pagination: { page, pageSize, total, hasMore }
 *
 * 错误码：
 *   401 未登录
 *   500 服务器内部错误
 */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getUserFromRequest } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json(
        { success: false, error: "未登录" },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const page = Math.max(1, Number(searchParams.get("page") || "1"));
    const pageSize = Math.min(
      100,
      Math.max(1, Number(searchParams.get("pageSize") || "20"))
    );

    const where = { userId: user.id };

    const [total, transactions] = await Promise.all([
      prisma.creditTransaction.count({ where }),
      prisma.creditTransaction.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: {
          id: true,
          type: true,
          amount: true,
          balance: true,
          reason: true,
          createdAt: true,
        },
      }),
    ]);

    return NextResponse.json({
      success: true,
      data: transactions,
      pagination: {
        page,
        pageSize,
        total,
        hasMore: page * pageSize < total,
      },
    });
  } catch (error) {
    console.error("Credits transactions error:", error);
    return NextResponse.json(
      { success: false, error: "服务器内部错误" },
      { status: 500 }
    );
  }
}
