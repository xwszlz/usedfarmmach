// Runtime i18n translation layer.
//
// Why this exists: the platform has thousands of user-facing strings that were
// historically hardcoded as `isZh ? "中文" : "English"`. To support all 8 locales
// (zh/en/ru/es/pt/ar/fr/hi) without threading a `t()` key through every component,
// we key translations by the Chinese *source* string and look them up at runtime.
//
// Fallback rules:
//   zh            -> the source string (always correct)
//   en            -> English entry (seeded from the inline English)
//   ru/es/pt/ar/fr/hi -> that language's entry if present, else English, else source
//
// The dictionary lives in ./i18n-dictionary and is pure data, so adding a
// translation is just a data edit — no code change required.

import { I18N_DICT } from "./i18n-dictionary";
import type { RtLocale, I18nEntry } from "./i18n-types";

export type { RtLocale, I18nEntry } from "./i18n-types";

/**
 * Translate a Chinese source string into the target locale.
 * Pure and synchronous — safe in both Server and Client Components.
 */
export function translate(sourceZh: string, locale: string): string {
  if (!sourceZh) return sourceZh;
  const loc = (locale || "zh") as RtLocale;
  if (loc === "zh") return sourceZh;

  const entry = I18N_DICT[sourceZh];
  if (entry) {
    const direct = entry[loc];
    if (direct) return direct;
    if (loc !== "en" && entry.en) return entry.en as string;
  }
  // Gap: no translation yet. Return the source so the UI is never blank.
  // Track these by grepping for `tr("<untranslated>")` after switching locale.
  return sourceZh;
}

/**
 * Server-component convenience: resolves the active locale via next-intl and
 * translates. Only valid inside the request scope (Server Component / Route
 * Handler). For most server pages it is simpler to pass `locale` from params
 * and call `translate(text, locale)` directly.
 */
export async function serverTranslate(sourceZh: string): Promise<string> {
  const { getLocale } = await import("next-intl/server");
  const locale = await getLocale();
  return translate(sourceZh, locale);
}
