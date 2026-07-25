/**
 * 超管专属能力 —— 共享数据层（T03 基础层）
 *
 * 把「读系统数据」的逻辑收口到此，供 route handler 与 server component 页面共用，
 * 避免业务/UI 重复实现。所有读取均为只读，无写入副作用（除角色变更走独立 route）。
 *
 * 双层校验惯式：middleware（SUPER_ADMIN_PATHS）网关 + 本文件 requireSuperAdmin 再校验。
 */
import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { verifyToken, getTokenFromHeaders } from "@/lib/auth";

/** 仅 super_admin 放行；否则返回 null（route 据此 403） */
export async function requireSuperAdmin(req: NextRequest) {
  const token = getTokenFromHeaders(req.headers);
  if (!token) return null;
  const payload = verifyToken(token);
  if (!payload) return null;
  const user = await prisma.user.findUnique({
    where: { id: payload.userId },
    select: { role: true },
  });
  if (!user || user.role !== "super_admin") return null;
  return payload;
}

export type AuditType = "pii_audit" | "email_send";

export interface AuditQuery {
  type?: AuditType;
  page?: number;
  pageSize?: number;
  actorId?: string;
  targetUserId?: string;
  action?: string;
  provider?: string;
}

/** 读取审计日志（PiiAuditLog + EmailSendLog），支持类型/分页/筛选（只读） */
export async function getAuditLogs(q: AuditQuery) {
  const page = Math.max(1, q.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, q.pageSize ?? 20));
  const skip = (page - 1) * pageSize;

  if (q.type === "email_send") {
    const where: Record<string, unknown> = {};
    if (q.provider) where.provider = q.provider;
    const [list, total] = await Promise.all([
      prisma.emailSendLog.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: pageSize,
      }),
      prisma.emailSendLog.count({ where }),
    ]);
    return { type: "email_send" as const, list, total, page, pageSize };
  }

  const where: Record<string, unknown> = {};
  if (q.actorId) where.actorId = q.actorId;
  if (q.targetUserId) where.targetUserId = q.targetUserId;
  if (q.action) where.action = q.action;
  const [list, total] = await Promise.all([
    prisma.piiAuditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take: pageSize,
    }),
    prisma.piiAuditLog.count({ where }),
  ]);
  return { type: "pii_audit" as const, list, total, page, pageSize };
}

/** 系统配置（只读）：环境变量 / 功能开关 / 邮件通道状态 */
export function getSystemConfig() {
  const configured = (v: string | undefined) => !!v && v.length > 0;
  return {
    env: {
      CREDITS_ISSUANCE_ENABLED: process.env.CREDITS_ISSUANCE_ENABLED === "true",
      EMAIL_PROVIDER_DOMESTIC: process.env.EMAIL_PROVIDER_DOMESTIC || "aliyun_directmail",
      RESEND_CONFIGURED: configured(process.env.RESEND_API_KEY),
      ALIYUN_DM_CONFIGURED: configured(process.env.ALIYUN_DM_ACCESS_KEY),
      TENCENT_SES_CONFIGURED: configured(process.env.TENCENT_SES_SECRET_ID),
    },
    providers: {
      resend: { configured: configured(process.env.RESEND_API_KEY), label: "Resend（境外）" },
      aliyun_directmail: {
        configured: configured(process.env.ALIYUN_DM_ACCESS_KEY),
        label: "阿里云 DirectMail（国内·需备案）",
      },
      tencent_ses: {
        configured: configured(process.env.TENCENT_SES_SECRET_ID),
        label: "腾讯云 SES（国内·需备案）",
      },
      console: { configured: true, label: "Console 降级（本地/未配置）" },
    },
  };
}

/** 数据出境合规阈值（10 万人） */
export const COMPLIANCE_THRESHOLD = 100000;

/**
 * 数据出境合规指标：
 *   - crossBorderRecipients = distinct EmailSendLog.recipientHash WHERE provider='resend'（console 降级不计；国内通道不计）
 *   - providers = 各 provider 发送次数分布
 */
export async function getComplianceMetrics() {
  const threshold = COMPLIANCE_THRESHOLD;
  const groups = await prisma.emailSendLog.groupBy({
    by: ["recipientHash"],
    where: { provider: "resend" },
    _count: { _all: true },
  });
  const crossBorderRecipients = Array.isArray(groups) ? groups.length : 0;

  const byProvider = await prisma.emailSendLog.groupBy({
    by: ["provider"],
    _count: { _all: true },
  });
  const providers = (Array.isArray(byProvider) ? byProvider : []).map(
    (p: { provider: string; _count: { _all: number } }) => ({
      name: p.provider,
      count: p._count._all,
    }),
  );

  return {
    crossBorderRecipients,
    threshold,
    ratio: crossBorderRecipients / threshold,
    providers,
  };
}
