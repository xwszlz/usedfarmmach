/**
 * Normalize a raw Product.condition value into the canonical i18n suffix used by
 * messages/{locale}/products.detail.condition{Excellent,Good,Fair,Poor}.
 *
 * The DB stores `condition` as a free-form string (Prisma `String`, not an enum).
 * It historically held English grades ("Good", "excellent"), but the migrated
 * data contains Chinese grades ("良", "良好", …). The old code did:
 *   t(`condition${value.charAt(0).toUpperCase() + value.slice(1)}`)
 * which produced keys like `condition良` that don't exist in any locale →
 * next-intl MISSING_MESSAGE (en product pages crashed / logged errors).
 *
 * This maps both English and Chinese variants to the canonical suffix and returns
 * the trimmed raw value when nothing matches, so callers can fall back to showing
 * the raw string instead of throwing.
 */
const CONDITION_MAP: Record<string, string> = {
  // English variants (case-insensitive)
  excellent: "Excellent",
  good: "Good",
  fair: "Fair",
  poor: "Poor",
  new: "Excellent",
  // Chinese variants
  "优": "Excellent",
  "优秀": "Excellent",
  "全新": "Excellent",
  "良": "Good",
  "良好": "Good",
  "中": "Fair",
  "一般": "Fair",
  "差": "Poor",
  "较差": "Poor",
};

const CANONICAL = new Set(["Excellent", "Good", "Fair", "Poor"]);

export function normalizeCondition(raw?: string | null): string {
  if (!raw) return "";
  const key = raw.trim();
  const mapped = CONDITION_MAP[key.toLowerCase()] ?? CONDITION_MAP[key];
  if (mapped) return mapped;
  const titled = key.charAt(0).toUpperCase() + key.slice(1);
  if (CANONICAL.has(titled)) return titled;
  return key;
}
