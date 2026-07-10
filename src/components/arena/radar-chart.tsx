"use client";

import {
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { useTranslations } from "next-intl";
import type { SixDimScore } from "@/lib/arena/types";

interface RadarChartProps {
  primary: SixDimScore;
  secondary?: SixDimScore | null;
  primaryLabel?: string;
  secondaryLabel?: string;
}

export function ArenaRadarChart({
  primary,
  secondary,
  primaryLabel,
  secondaryLabel,
}: RadarChartProps) {
  const t = useTranslations("arena");

  const axes = [
    { key: "costPerformance", label: t("dimCost") },
    { key: "performanceMatch", label: t("dimPerformance") },
    { key: "brandReputation", label: t("dimBrand") },
    { key: "partsAvailability", label: t("dimParts") },
    { key: "residualValue", label: t("dimResidual") },
    { key: "crossBorderFit", label: t("dimCrossBorder") },
  ] as const;

  const data = axes.map((axis) => ({
    dimension: axis.label,
    primary: primary[axis.key],
    secondary: secondary ? secondary[axis.key] : undefined,
  }));

  return (
    <div className="w-full">
      <ResponsiveContainer width="100%" height={320}>
        <RadarChart data={data} cx="50%" cy="50%" outerRadius="75%">
          <PolarGrid
            stroke="currentColor"
            className="text-gray-300 dark:text-gray-600"
          />
          <PolarAngleAxis
            dataKey="dimension"
            tick={{ fontSize: 12, fill: "currentColor" }}
            className="text-gray-600 dark:text-gray-400"
          />
          <PolarRadiusAxis
            angle={90}
            domain={[0, 100]}
            tick={{ fontSize: 10, fill: "currentColor" }}
            className="text-gray-400 dark:text-gray-500"
          />

          <Radar
            name={primaryLabel || "#1"}
            dataKey="primary"
            stroke="#6366f1"
            fill="#6366f1"
            fillOpacity={0.3}
            strokeWidth={2}
          />

          {secondary && (
            <Radar
              name={secondaryLabel || "#2"}
              dataKey="secondary"
              stroke="#f59e0b"
              fill="#f59e0b"
              fillOpacity={0.2}
              strokeWidth={2}
            />
          )}

          {secondary && (
            <Legend
              wrapperStyle={{ fontSize: 12 }}
              className="text-gray-600 dark:text-gray-400"
            />
          )}
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
}
