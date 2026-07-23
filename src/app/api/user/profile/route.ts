/**
 * POST /api/user/profile —— 本人补全资料（阶段 0，任务 T10）
 *
 * 设计依据：docs/architecture/邮箱方案阶段0实施设计_2026-07-23.md §3.5 ①
 *
 * 鉴权：Bearer token 或 httpOnly cookie（getTokenFromHeaders + verifyToken，本人）。
 * 校验：completeProfileSchema（email/companyName/country/password 可选；dataCrossBorderConsent 必须 true）。
 *
 * 错误码：
 *   400 校验失败 / 未勾选数据出境单独同意
 *   401 未登录（token 缺失或无效）
 *   409 邮箱已被其他账号占用（唯一约束冲突）
 *
 * 服务端动作：
 *   1. 更新本人字段（email/companyName/country/passwordHash 按提交填入）；
 *   2. 置 emailVerified=true、emailPending=false、consentCrossBorderAt=now；
 *   3. 调 grantRegisterGiftIfNeeded（幂等，基于 UserMilestone.register_gift 去重）→ 返回最新积分。
 *
 * 说明：阶段 0 视为"自证验证"——补全提交即 emailVerified=true（无邮件服务，无法发验证链接）；
 * 阶段 1 接入 Resend 后改为令牌验证后置 true（已留口，不在此改）。
 */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getTokenFromHeaders, verifyToken, hashPassword } from "@/lib/auth";
import { completeProfileSchema } from "@/lib/validators";
import { grantRegisterGiftIfNeeded } from "@/lib/credits/grant";

export async function POST(request: NextRequest) {
  try {
    // 1) 鉴权：Bearer 或 cookie 中提取 token，校验并解析本人身份
    const token = getTokenFromHeaders(request.headers);
    const payload = token ? verifyToken(token) : null;
    if (!payload) {
      return NextResponse.json(
        { success: false, error: "未登录" },
        { status: 401 }
      );
    }

    // 2) 校验请求体
    const body = await request.json();
    const parsed = completeProfileSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: parsed.error.errors[0].message },
        { status: 400 }
      );
    }

    const { email, companyName, country, password, dataCrossBorderConsent } =
      parsed.data;

    // 3) 数据出境单独同意兜底校验（schema 已 refine 为 true，此处再次防御）
    if (!dataCrossBorderConsent) {
      return NextResponse.json(
        { success: false, error: "请勾选并同意《数据出境》单独同意条款" },
        { status: 400 }
      );
    }

    // 规范化：空串视为未提供，避免把已有数据清空或触发唯一约束
    const normalizedEmail =
      typeof email === "string" && email.trim().length > 0
        ? email.trim()
        : null;

    // 4) 邮箱唯一性预检（排除本人，避免提交自己的邮箱被判冲突）
    if (normalizedEmail) {
      const existing = await prisma.user.findUnique({
        where: { email: normalizedEmail },
        select: { id: true },
      });
      if (existing && existing.id !== payload.userId) {
        return NextResponse.json(
          { success: false, error: "邮箱已被占用" },
          { status: 409 }
        );
      }
    }

    // 5) 组装更新数据（仅写入提交且非空的字段）
    const updateData: Record<string, unknown> = {
      // 阶段 0 自证：补全即视为已验证，并解除待补全标记
      emailVerified: true,
      emailPending: false,
      // 数据出境单独同意留痕
      consentCrossBorderAt: new Date(),
    };
    if (normalizedEmail) updateData.email = normalizedEmail;
    if (companyName && companyName.trim().length > 0) {
      updateData.companyName = companyName.trim();
    }
    if (country && country.trim().length > 0) {
      updateData.country = country.trim();
    }
    if (password) {
      updateData.passwordHash = await hashPassword(password);
    }

    const updated = await prisma.user.update({
      where: { id: payload.userId },
      data: updateData,
      select: { id: true, credits: true },
    });

    // 6) 幂等发放注册礼包（重复提交不重复发分）
    const gift = await grantRegisterGiftIfNeeded(payload.userId);
    const finalCredits = (updated.credits ?? 0) + (gift.granted ? gift.amount : 0);

    // 7) 返回最新状态
    return NextResponse.json({
      success: true,
      data: {
        emailVerified: true,
        emailPending: false,
        credits: finalCredits,
        giftGranted: gift.granted,
        giftAmount: gift.amount,
      },
    });
  } catch (error: any) {
    // 并发写入或其他唯一约束冲突兜底为 409
    if (error?.code === "P2002") {
      return NextResponse.json(
        { success: false, error: "邮箱已被占用" },
        { status: 409 }
      );
    }
    console.error("Complete profile error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
