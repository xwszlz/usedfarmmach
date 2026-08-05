"use client";

import { useState, useCallback } from "react";
import { useTranslations } from "next-intl";
import { Sparkles } from "lucide-react";
import { ArenaForm } from "@/components/arena/arena-form";
import { ArenaResults } from "@/components/arena/arena-results";
import type { ArenaInput, ArenaMatchResult } from "@/lib/arena/types";

interface ArenaPageClientProps {
  locale: string;
  initialCrop: string;
  initialMachineType: string;
  initialBudget: number;
}

export function ArenaPageClient({
  locale,
  initialCrop,
  initialMachineType,
  initialBudget,
}: ArenaPageClientProps) {
  const t = useTranslations("arena");
  const [result, setResult] = useState<ArenaMatchResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasSubmitted, setHasSubmitted] = useState(false);

  const handleSubmit = useCallback(async (input: ArenaInput) => {
    setIsLoading(true);
    setError(null);
    setHasSubmitted(true);

    try {
      const res = await fetch("/api/arena/match", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });

      if (!res.ok) {
        throw new Error("Failed to fetch candidates");
      }

      const json = await res.json();
      if (json.success) {
        setResult(json.data);
      } else {
        throw new Error(json.error || "Unknown error");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
      setResult(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 via-white to-accent-50 dark:from-gray-950 dark:via-gray-900 dark:to-gray-950">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        {/* 页面标题 */}
        <div className="mb-8 text-center">
          <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-brand-accent-light px-3 py-1 text-sm font-medium text-brand-accent">
            <Sparkles className="h-4 w-4" />
            AI Powered
          </div>
          <h1 className="text-4xl font-bold tracking-tight text-gray-900 dark:text-white sm:text-5xl">
            {t("title")}
          </h1>
          <p className="mt-3 text-lg text-gray-600 dark:text-gray-400">
            {t("subtitle")}
          </p>
        </div>

        {/* 表单区 */}
        <div className="mx-auto mb-10 max-w-3xl">
          <ArenaForm
            initialCrop={initialCrop}
            initialMachineType={initialMachineType}
            initialBudget={initialBudget}
            locale={locale}
            onSubmit={handleSubmit}
            isLoading={isLoading}
          />
        </div>

        {/* 结果区 / 引导文字 */}
        {hasSubmitted ? (
          <ArenaResults
            result={result}
            isLoading={isLoading}
            error={error}
            locale={locale}
          />
        ) : (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-gray-300 py-20 text-center dark:border-gray-700">
            <div className="mb-4 flex gap-3">
              {["🏆", "⚙️", "📊", "🌍"].map((emoji, i) => (
                <span
                  key={i}
                  className="flex h-14 w-14 items-center justify-center rounded-full bg-gray-100 text-2xl dark:bg-gray-800"
                >
                  {emoji}
                </span>
              ))}
            </div>
            <p className="max-w-md text-gray-500 dark:text-gray-400">
              {t("subtitle")}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
