"use client";

import { useCallback } from "react";
import { useLocale } from "next-intl";
import { translate } from "./i18n-runtime";
import type { RtLocale } from "./i18n-types";

/**
 * Client hook: returns a `tr()` bound to the active locale.
 *
 * Usage in a client component:
 *   const tr = useTr();
 *   return <span>{tr("报价已提交")}</span>;
 *
 * Works inside NextIntlClientProvider (already mounted at the root layout),
 * so no extra provider is required.
 */
export function useTr() {
  const locale = useLocale() as RtLocale;
  return useCallback((sourceZh: string) => translate(sourceZh, locale), [locale]);
}
