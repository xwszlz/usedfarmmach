/**
 * 跨境自评估（T05 — 合规看板扩充指标）
 *
 * 口径（与既有 getComplianceMetrics 一致）：
 *  - distinctRecipients = distinct EmailSendLog.recipientHash WHERE provider='resend'
 *    （resend 计为数据出境；console 降级 / 国内通道不计）
 *  - threshold = 100000（10 万人阈值）
 *  - 达到 80000（阈值 80%）即触发预警，建议补 PIPIA / 标准合同（SCC）。
 *
 * 红线：
 *  - .cn 站不调用此函数（数据不出境）；由调用方用 isComSite() 守卫。
 *  - 仅读取，无写入副作用。
 */

import { prisma } from "@/lib/db";

export interface CrossBorderAssessment {
  /** 去重收件人数（出境） */
  distinctRecipients: number;
  /** 阈值（10 万） */
  threshold: number;
  /** 剩余额度 */
  remaining: number;
  /** 是否预警 */
  alert: boolean;
  /** 预警建议 */
  suggestion?: string;
}

/** 跨境传输预警阈值（达阈值的 80% 即预警） */
const ALERT_AT_RATIO = 0.8;
const THRESHOLD = 100000;

export async function crossBorderAssessment(): Promise<CrossBorderAssessment> {
  const groups = await prisma.emailSendLog.groupBy({
    by: ["recipientHash"],
    where: { provider: "resend" },
    _count: { _all: true },
  });
  const distinctRecipients = Array.isArray(groups) ? groups.length : 0;
  const remaining = Math.max(0, THRESHOLD - distinctRecipients);
  const alert = distinctRecipients >= THRESHOLD * ALERT_AT_RATIO;

  return {
    distinctRecipients,
    threshold: THRESHOLD,
    remaining,
    alert,
    suggestion: alert
      ? "出境个人信息已达阈值 80%，建议补做 PIPIA 并与境外接收方签署标准合同（SCC）"
      : undefined,
  };
}
