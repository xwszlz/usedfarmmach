"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Trophy, AlertCircle, SearchX } from "lucide-react";
import type { ArenaMatchResult } from "@/lib/arena/types";
import { CandidateCard } from "./candidate-card";
import { ArenaRadarChart } from "./radar-chart";

interface ArenaResultsProps {
  result: ArenaMatchResult | null;
  isLoading: boolean;
  error: string | null;
  locale: string;
}

export function ArenaResults({ result, isLoading, error, locale }: ArenaResultsProps) {
  const t = useTranslations("arena");
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [compareIdx, setCompareIdx] = useState<number | null>(null);

  // 加载中
  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-48 animate-pulse rounded-lg bg-gray-200 dark:bg-gray-700" />
        <div className="grid gap-4 md:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="h-40 animate-pulse rounded-xl bg-gray-200 dark:bg-gray-700"
            />
          ))}
        </div>
        <div className="h-80 animate-pulse rounded-xl bg-gray-200 dark:bg-gray-700" />
      </div>
    );
  }

  // 错误
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-red-200 bg-red-50 py-16 dark:border-red-900 dark:bg-red-900/20">
        <AlertCircle className="h-12 w-12 text-red-500" />
        <p className="mt-4 text-center text-red-600 dark:text-red-400">{error}</p>
      </div>
    );
  }

  // 无结果
  if (!result || result.candidates.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-gray-200 bg-gray-50 py-16 dark:border-gray-700 dark:bg-gray-800/50">
        <SearchX className="h-12 w-12 text-gray-400" />
        <p className="mt-4 text-center text-gray-500 dark:text-gray-400">
          {t("noMatch")}
        </p>
      </div>
    );
  }

  const { candidates } = result;
  const primary = candidates[selectedIdx] ?? candidates[0];
  const secondary = compareIdx != null ? candidates[compareIdx] : null;

  return (
    <div className="space-y-6">
      {/* 顶部统计 */}
      <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
        <Trophy className="h-5 w-5 text-amber-500" />
        <span>
          {t("foundCandidates", { count: result.totalFound })}
          {result.returnedCount < result.totalFound && (
            <> · {t("showingTop", { count: result.returnedCount })}</>
          )}
        </span>
      </div>

      {/* 排行榜 */}
      <div className="grid gap-4 md:grid-cols-2">
        {candidates.map((candidate, idx) => (
          <CandidateCard
            key={candidate.product.id}
            candidate={candidate}
            locale={locale}
            isActive={selectedIdx === idx}
            onClick={() => {
              setSelectedIdx(idx);
              setCompareIdx(null);
            }}
          />
        ))}
      </div>

      {/* 雷达图区域 */}
      {primary && (
        <div className="rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              {t("compareTitle")}
            </h3>
            {candidates.length > 1 && (
              <div className="flex items-center gap-2">
                <label className="text-xs text-gray-500 dark:text-gray-400">
                  {t("champion")}:
                </label>
                <select
                  value={compareIdx ?? ""}
                  onChange={(e) => {
                    const val = e.target.value;
                    setCompareIdx(val === "" ? null : Number(val));
                  }}
                  className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs text-gray-900 focus:border-primary-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                >
                  <option value="">{t("viewDetail")}</option>
                  {candidates.map((c, i) => (
                    <option key={c.product.id} value={i}>
                      #{c.rank} {c.product.brand?.nameEn} {c.product.modelName}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          <div className="flex flex-col items-center gap-2">
            <div className="text-center">
              <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
                #{primary.rank} {primary.product.brand?.nameEn} {primary.product.modelName}
                {" — "}
                <span className="text-primary-600 dark:text-primary-400">
                  {t("totalScore")}: {primary.scores.total}
                </span>
              </span>
            </div>

            <ArenaRadarChart
              primary={primary.scores}
              secondary={secondary?.scores ?? null}
              primaryLabel={`#${primary.rank} ${primary.product.modelName}`}
              secondaryLabel={
                secondary ? `#${secondary.rank} ${secondary.product.modelName}` : undefined
              }
            />
          </div>
        </div>
      )}
    </div>
  );
}
