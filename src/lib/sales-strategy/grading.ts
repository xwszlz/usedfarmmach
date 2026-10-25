/**
 * AI 销售策略 · 经销商 A/B/C 分级（T5）
 * ─────────────────────────────────────────────────────────
 * 纯函数模块：**零运行时依赖**（不 import prisma / pii / db），
 * 因此可被「服务端路由 / 服务层」与「客户端组件」安全引用。
 *
 * 分级口径（对齐架构 §3.4，括号内为实现细节）：
 *   - 归一化 norm(s) = 小写 + 去空白
 *   - isAuthorized = nature 含「授权经销商」
 *   - hasContact   = 脱敏值非空即说明原字段存在（只判「有没有」，绝不碰明文）
 *   - lowContact   = tags 含「电话占位」或「自家·禁外呼」
 *   - hasCtx       = 是否提供产品上下文（brand / model 任一）
 *   - hitBrand / hitModel = 上下文与经销商覆盖品牌 / 机型双向包含即命中
 *   - 判定顺序：lowContact || !hasContact → C；isAuthorized && (!hasCtx || hit) → A；否则 B
 */
import type { DealerPublic } from "./types";

/** A/B/C 分级 */
export type DealerGrade = "A" | "B" | "C";

/** 产品上下文（用于品牌 / 机型命中判定） */
export interface GradeContext {
  /** 本品品牌（如 "CLAAS" / "东方红"） */
  brand?: string | null;
  /** 本品机型组（如 "AXION 850"） */
  model?: string | null;
}

/** 归一化：小写 + 去空白（中英文统一处理） */
function norm(s: string | null | undefined): string {
  return (s ?? "").toLowerCase().replace(/\s+/g, "");
}

/**
 * 实时计算 A/B/C 分级。
 *
 * @param d   经销商公开信息（含脱敏联系方式 / tags）
 * @param ctx 可选的本品上下文；提供时参与品牌 / 机型命中判定
 * @returns "A" | "B" | "C"
 */
export function gradeDealer(d: DealerPublic, ctx?: GradeContext): DealerGrade {
  const isAuthorized = (d.nature ?? "").includes("授权经销商");
  // 脱敏值非空 → 原字段存在（通过 maskPhone/maskEmail 的唯一出口产出）
  const hasContact = !!(d.phoneMasked || d.emailMasked || d.wechatMasked);
  const lowContact = (d.tags ?? []).some(
    (t) => t.includes("电话占位") || t.includes("自家·禁外呼")
  );

  const ctxBrand = ctx?.brand;
  const ctxModel = ctx?.model;
  const hasCtx = !!(ctxBrand || ctxModel);

  const hitBrand =
    !!ctxBrand &&
    (d.brands ?? []).some((b) => {
      const nb = norm(b);
      const nc = norm(ctxBrand);
      // 双空串的 includes 恒真，故必须排除空串，避免误命中
      return nb.length > 0 && nc.length > 0 && (nb.includes(nc) || nc.includes(nb));
    });

  const hitModel =
    !!ctxModel &&
    (d.models ?? []).some((m) => {
      const nm = norm(m);
      const nc = norm(ctxModel);
      return nm.length > 0 && nc.length > 0 && (nm.includes(nc) || nc.includes(nm));
    });

  // ① 不可外呼 → C（优先级最高）
  if (lowContact || !hasContact) return "C";
  // ② 授权经销商且（无上下文 或 品牌/机型命中）→ A
  if (isAuthorized && (!hasCtx || hitBrand || hitModel)) return "A";
  // ③ 其余 → B
  return "B";
}

/**
 * 解析最终分级：
 *   - **有产品上下文** → 以实时计算为准（seed 预填的 grade 不含产品上下文，实时更准）；
 *   - **无产品上下文** → 沿用库里 grade；缺失（null / undefined）才实时兜底计算。
 */
export function resolveGrade(d: DealerPublic, ctx?: GradeContext): DealerGrade {
  const hasCtx = !!(ctx?.brand || ctx?.model);
  if (hasCtx) return gradeDealer(d, ctx);
  return (d.grade as DealerGrade) ?? gradeDealer(d, ctx);
}
