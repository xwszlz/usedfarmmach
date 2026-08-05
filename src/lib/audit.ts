/**
 * PII 访问审计统一写入（T01 基础层）
 *
 * 所有「读/写用户 PII 字段」的操作（角色变更、查看联系方式等）
 * 统一经此函数留痕，便于超管审计与合规追溯。
 * 只存操作人/对象 id 与字段/动作/用途，绝不落明文 PII 正文。
 */
import { prisma } from "@/lib/db";

export interface PiiAuditInput {
  actorId: string;
  targetUserId: string;
  field: string;
  action: string;
  purpose?: string | null;
}

/** 写一条 PiiAuditLog；失败仅记录日志，不影响主流程 */
export async function writePiiAuditLog(input: PiiAuditInput): Promise<void> {
  try {
    await prisma.piiAuditLog.create({
      data: {
        actorId: input.actorId,
        targetUserId: input.targetUserId,
        field: input.field,
        action: input.action,
        purpose: input.purpose ?? null,
      },
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("[audit] writePiiAuditLog failed:", err);
  }
}
