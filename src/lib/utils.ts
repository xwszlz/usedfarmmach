import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatPrice(price: number, currency: "cny" | "usd"): string {
  if (currency === "cny") {
    return `¥${price.toLocaleString("zh-CN")}`;
  }
  return `$${price.toLocaleString("en-US")}`;
}

export function calculateArbitragePercent(
  priceCny: number,
  priceUsd: number | null,
  exchangeRate: number = 7.25
): number | null {
  if (!priceUsd || priceUsd <= 0) return null;
  const priceUsdInCny = priceUsd * exchangeRate;
  if (priceUsdInCny <= 0) return null;
  return Math.round(((priceCny - priceUsdInCny) / priceUsdInCny) * 100);
}

export function formatDate(date: string | Date, locale: string = "zh"): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleDateString(locale === "zh" ? "zh-CN" : "en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export function truncate(str: string, length: number): string {
  if (str.length <= length) return str;
  return str.slice(0, length) + "...";
}

export function slugify(str: string): string {
  return str
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
