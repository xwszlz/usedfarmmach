/**
 * PII 脱敏与序列化核心层（阶段 0 唯一脱敏出口）。
 *
 * 共享知识 §1：所有邮箱/手机脱敏一律走本文件的 maskEmail / maskPhone，
 * 组件 / 路由禁止手写 slice / replace 脱敏逻辑。
 *
 * 阶段 2 加密（AES-256）将在本文件内加 encryptField / decryptField，
 * 调用方无需改动（seam 预留）。
 */

/** 可查看完整 PII 的角色 */
const FULL_PII_ROLES: readonly string[] = ["super_admin", "admin"];

/**
 * 脱敏邮箱：本地部分保留前 2 位 + "***" + 完整域名。
 * maskEmail("zhangsan@qq.com") === "zh***@qq.com"
 */
export function maskEmail(raw: string | null | undefined): string {
  if (!raw) return "";
  const atIndex = raw.indexOf("@");
  if (atIndex <= 0) return "***"; // 无 @ 或 @ 在首位，无法脱敏，整体掩码
  const local = raw.slice(0, atIndex);
  const domain = raw.slice(atIndex); // 含 "@"
  const head = local.slice(0, 2);
  return `${head}***${domain}`;
}

/**
 * 脱敏手机：保留前 3 后 4，中间 4 位掩码。
 * maskPhone("13812348000") === "138****8000"
 */
export function maskPhone(raw: string | null | undefined): string {
  if (!raw) return "";
  const digits = raw.replace(/\D/g, "");
  if (digits.length < 7) return "***"; // 太短无法安全脱敏
  return `${digits.slice(0, 3)}****${digits.slice(-4)}`;
}

/** 仅 super_admin / admin 可看完整 PII */
export function canViewFullPii(role: string): boolean {
  return FULL_PII_ROLES.includes(role);
}

/** 查看者上下文 */
export interface PiiViewer {
  role: string;
}

/** 需要序列化的用户 PII 输入（可附带其它字段） */
export interface PiiUserInput {
  email?: string | null;
  phone?: string | null;
  [key: string]: unknown;
}

/** 统一 PII 响应结构 */
export interface PiiResponse {
  email: string;
  phone: string;
  emailFull?: string;
  phoneFull?: string;
}

/**
 * 统一 PII 响应构造：默认全部脱敏；
 * 仅当 viewer 为 admin 且显式 reveal 时才带 full。
 */
export function piiResponse(
  user: PiiUserInput,
  opts: { viewer: PiiViewer; reveal?: boolean }
): PiiResponse {
  const canFull = opts.reveal === true && canViewFullPii(opts.viewer.role);
  const response: PiiResponse = {
    email: maskEmail(user.email),
    phone: maskPhone(user.phone),
  };
  if (canFull) {
    if (user.email) response.emailFull = user.email;
    if (user.phone) response.phoneFull = user.phone;
  }
  return response;
}

/** 资料完整度结果 */
export interface Completeness {
  hasEmail: boolean;
  hasCompany: boolean;
  hasCountry: boolean;
  hasPhone: boolean;
  score: number; // 0–100
  pending: boolean; // emailPending === true
}

/** 计算完整度所需的用户字段 */
export interface CompletenessInput {
  email?: string | null;
  companyName?: string | null;
  country?: string | null;
  phone?: string | null;
  emailPending?: boolean;
}

/**
 * 资料完整度（方案 4.2）：用于后台"完整度列"与引导补全。
 * 4 个维度各占 25%；pending 标记 emailPending。
 */
export function profileCompleteness(user: CompletenessInput): Completeness {
  const hasEmail = !!user.email;
  const hasCompany = !!user.companyName;
  const hasCountry = !!user.country;
  const hasPhone = !!user.phone;

  const checks = [hasEmail, hasCompany, hasCountry, hasPhone];
  const filled = checks.filter(Boolean).length;
  const score = Math.round((filled / checks.length) * 100);

  return {
    hasEmail,
    hasCompany,
    hasCountry,
    hasPhone,
    score,
    pending: !!user.emailPending,
  };
}

/* ─────────────────── Product 卖家联系方式：公开接口出厂前必剥离 ─────────────────── */

/**
 * 卖家联系方式字段：只能经 GET /api/products/[id]/contact（需登录）读取。
 * 任何公开、可缓存的接口在把 Product 行下发或写入缓存前，都必须先剥离这 4 个字段。
 * ⚠️ 以后新增 contact* 字段时必须同步维护此清单，否则列表接口会重新泄漏。
 */
export const CONTACT_FIELDS = [
  "contactName",
  "contactPhone",
  "contactWechat",
  "contactEmail",
] as const;

export function stripContactFields<T>(row: T): T {
  if (row && typeof row === "object") {
    for (const field of CONTACT_FIELDS) {
      delete (row as Record<string, unknown>)[field];
    }
  }
  return row;
}

/** 列表接口用：批量原地剥离，返回同一数组 */
export function stripContactFieldsFromList<T>(rows: T[]): T[] {
  if (Array.isArray(rows)) {
    for (const row of rows) stripContactFields(row);
  }
  return rows;
}
