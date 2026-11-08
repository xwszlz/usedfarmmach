/**
 * 超管专属：系统配置查看（P1-b，只读）
 * GET /api/admin/system/config
 *
 * 返回环境变量 / 功能开关 / 邮件服务商状态（仅展示，无写入）。
 * 双层校验：middleware SUPER_ADMIN_PATHS 网关 + 本处 requireSuperAdmin。
 */
import { NextRequest, NextResponse } from "next/server";
import { requireSuperAdmin, getSystemConfig } from "@/lib/admin/system";
import { RAW_DB_MODE_KEY, isRawMode, getRawMode } from "@/lib/subsidy/raw-mode";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const admin = await requireSuperAdmin(request);
  if (!admin) {
    return NextResponse.json({ success: false, error: "无权限" }, { status: 403 });
  }

  return NextResponse.json({ success: true, data: getSystemConfig() });
}

/**
 * 超管专属：.cn 补贴 raw 明细 DB 即时开关（T05，仅新增 PATCH，GET 零改动）
 * PATCH /api/admin/system/config  body: { key: "subsidy.raw.mode", value: "off"|"login"|"public" }
 *
 * 🔴 middleware 的 /api/ 分支早退 ⇒ 函数内首行 requireSuperAdmin 兜底。
 * 🔴 绝不复用 credits/config.ts::setConfig（它会 JSON.stringify，写入 "\"login\""，
 *    isRawMode 判 false、开关静默失效）；这里用 Prisma upsert 写【裸模式串】。
 *    仍必须走 Prisma：SystemConfig.updatedAt 是 client 层 @updatedAt，DB 列 NOT NULL
 *    且无 DEFAULT，裸 SQL INSERT 必失败。
 * env=off 时 DB 不得覆盖（409，且不写库）。
 */
export async function PATCH(request: NextRequest) {
  const admin = await requireSuperAdmin(request);
  if (!admin) {
    return NextResponse.json({ success: false, error: "无权限" }, { status: 403 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json(
      { success: false, error: "请求体不是合法 JSON", code: "VALIDATION_ERROR" },
      { status: 400 }
    );
  }

  if (body.key !== RAW_DB_MODE_KEY) {
    return NextResponse.json(
      { success: false, error: "不支持的配置键", code: "VALIDATION_ERROR" },
      { status: 400 }
    );
  }
  if (!isRawMode(body.value)) {
    return NextResponse.json(
      { success: false, error: "非法的模式值（仅 off/login/public）", code: "VALIDATION_ERROR" },
      { status: 400 }
    );
  }
  const value = body.value;

  // env 已锁定 off ⇒ DB 不得覆盖（且绝不写库）
  if (getRawMode() === "off") {
    return NextResponse.json(
      { success: false, error: "env 已锁定 off，DB 不得覆盖", code: "ENV_LOCKED_OFF" },
      { status: 409 }
    );
  }

  await prisma.systemConfig.upsert({
    where: { key: RAW_DB_MODE_KEY },
    create: { key: RAW_DB_MODE_KEY, value, updatedBy: admin.userId },
    update: { value, updatedBy: admin.userId },
  });

  return NextResponse.json({ success: true, data: { key: RAW_DB_MODE_KEY, value } });
}
