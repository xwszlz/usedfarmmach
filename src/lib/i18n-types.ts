// Shared locale types for the runtime i18n layer.
export type RtLocale = "zh" | "en" | "ru" | "es" | "pt" | "ar" | "fr" | "hi";

export const RT_LOCALES: RtLocale[] = ["zh", "en", "ru", "es", "pt", "ar", "fr", "hi"];

// Locales whose primary non-English fallback is English.
export const EN_FALLBACK: RtLocale[] = ["ru", "es", "pt", "ar", "fr", "hi"];

export type I18nEntry = Partial<Record<RtLocale, string>>;
