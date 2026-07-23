/**
 * 积分体系错误类型（路由层据此映射 HTTP 响应）
 */

/** 积分不足（E7：任何扣减不得出负余额，余额不足整体拒绝） */
export class InsufficientCreditsError extends Error {
  readonly code = "INSUFFICIENT_CREDITS" as const;
  readonly httpStatus = 403 as const;
  credits: number;
  required: number;

  constructor(credits = 0, required = 0) {
    super("积分不足");
    this.name = "InsufficientCreditsError";
    this.credits = credits;
    this.required = required;
  }
}

/** 批次余额与 User.credits 缓存漂移（防御性，触发即回滚） */
export class CreditLotDriftError extends Error {
  readonly code = "CREDIT_LOT_DRIFT" as const;
  readonly httpStatus = 500 as const;

  constructor(userId: string) {
    super(`积分批次与余额不一致（userId=${userId}），已回滚`);
    this.name = "CreditLotDriftError";
  }
}

/** 订单状态冲突（重复确认/已关闭/已驳回等） */
export class OrderConflictError extends Error {
  readonly code = "ORDER_CONFLICT" as const;
  readonly httpStatus = 409 as const;

  constructor(message = "订单状态不允许该操作") {
    super(message);
    this.name = "OrderConflictError";
  }
}

/** 首页推荐位今日名额已满 */
export class HomeFeatureFullError extends Error {
  readonly code = "HOME_FEATURE_FULL" as const;
  readonly httpStatus = 409 as const;

  constructor() {
    super("今日推荐位名额已满");
    this.name = "HomeFeatureFullError";
  }
}

/** 业务通用错误（带 HTTP 状态码与错误码） */
export class CreditBizError extends Error {
  readonly code: string;
  readonly httpStatus: number;

  constructor(message: string, code = "BIZ_ERROR", httpStatus = 400) {
    super(message);
    this.name = "CreditBizError";
    this.code = code;
    this.httpStatus = httpStatus;
  }
}

/** Prisma 唯一约束冲突判定（E2/E3 幂等重放识别） */
export function isP2002(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    (error as { code?: string }).code === "P2002"
  );
}
