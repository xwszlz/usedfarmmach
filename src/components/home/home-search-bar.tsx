"use client";

import { useTranslations } from "next-intl";
import { Search } from "lucide-react";

interface HomeSearchBarProps {
  /** Current locale, used to build the form action "/{locale}/products". */
  locale: string;
}

/**
 * Lightweight homepage search box (A-spec).
 *
 * Uses a native GET form so the browser navigates to
 * `/{locale}/products?query=<encoded>` without any client-side router or JS.
 * The query is consumed by ProductsClient, which reads `?query=` once on mount
 * and injects it into its filters (see ProductsClient.tsx). No new i18n key is
 * introduced: the submit button reuses the same `home.searchPlaceholder` value
 * as its aria-label, and this component renders no <h1> (that belongs to
 * RecruitmentBanner).
 */
export function HomeSearchBar({ locale }: HomeSearchBarProps) {
  const t = useTranslations("home");
  const placeholder = t("searchPlaceholder");

  return (
    <form
      method="get"
      action={`/${locale}/products`}
      role="search"
      dir={locale === "ar" ? "rtl" : undefined}
      className="mx-auto flex w-full max-w-xl items-center gap-2 rounded-full border border-gray-300 bg-white px-4 py-2 shadow-sm"
    >
      <label htmlFor="home-search-input" className="sr-only">
        {placeholder}
      </label>
      <input
        id="home-search-input"
        type="search"
        name="query"
        placeholder={placeholder}
        autoComplete="off"
        className="w-full bg-transparent text-base text-gray-800 outline-none placeholder:text-gray-400"
      />
      <button
        type="submit"
        aria-label={placeholder}
        className="shrink-0 rounded-full bg-blue-600 p-2 text-white transition-colors hover:bg-blue-700"
      >
        <Search aria-hidden="true" className="h-5 w-5" />
      </button>
    </form>
  );
}
