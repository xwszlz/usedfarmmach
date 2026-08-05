"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Sprout, Tractor, DollarSign, Maximize, Globe, Calendar, Play } from "lucide-react";
import type { ArenaInput } from "@/lib/arena/types";

interface ArenaFormProps {
  initialCrop?: string;
  initialMachineType?: string;
  initialBudget?: number;
  locale: string;
  onSubmit: (input: ArenaInput) => void;
  isLoading?: boolean;
}

export function ArenaForm({
  initialCrop = "wheat",
  initialMachineType = "tractor",
  initialBudget = 30,
  locale,
  onSubmit,
  isLoading,
}: ArenaFormProps) {
  const t = useTranslations("arena");
  const tHero = useTranslations("hero");

  const [crop, setCrop] = useState(initialCrop);
  const [machineType, setMachineType] = useState(initialMachineType);
  const [budget, setBudget] = useState(initialBudget);
  const [fieldSize, setFieldSize] = useState<string>("");
  const [targetRegion, setTargetRegion] = useState("any");
  const [maxAge, setMaxAge] = useState("0");

  const cropOptions = [
    { value: "wheat", key: "hero.cropWheat" },
    { value: "corn", key: "hero.cropCorn" },
    { value: "rice", key: "hero.cropRice" },
    { value: "soybean", key: "hero.cropSoybean" },
    { value: "cotton", key: "hero.cropCotton" },
    { value: "other", key: "hero.cropOther" },
  ];

  const machineOptions = [
    { value: "tractor", key: "hero.machineTractor" },
    { value: "harvester", key: "hero.machineHarvester" },
    { value: "baler", key: "hero.machineBaler" },
    { value: "wrapper", key: "hero.machineWrapper" },
    { value: "other", key: "hero.machineOther" },
  ];

  const regionOptions = [
    { value: "any", key: "regionAny" },
    { value: "central-asia", key: "regionCentralAsia" },
    { value: "africa", key: "regionAfrica" },
    { value: "south-america", key: "regionSouthAmerica" },
    { value: "middle-east", key: "regionMiddleEast" },
  ];

  const ageOptions = [
    { value: "0", key: "ageAny" },
    { value: "5", key: "age5" },
    { value: "8", key: "age8" },
    { value: "10", key: "age10" },
  ];

  const handleSubmit = () => {
    onSubmit({
      crop,
      machineType,
      budget,
      fieldSize: fieldSize ? Number(fieldSize) : undefined,
      targetRegion,
      maxAge: maxAge !== "0" ? Number(maxAge) : undefined,
    });
  };

  const selectClass =
    "w-full rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm text-gray-900 focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 dark:border-gray-600 dark:bg-gray-800 dark:text-white";
  const labelClass =
    "mb-2 flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300";

  return (
    <div className="rounded-2xl border border-gray-200 bg-white/80 p-6 shadow-lg backdrop-blur dark:border-gray-700 dark:bg-gray-900/80">
      <div className="grid gap-5 sm:grid-cols-2">
        {/* Crop Type */}
        <div>
          <label className={labelClass}>
            <Sprout className="h-4 w-4 text-primary-500" />
            {tHero("crop")}
          </label>
          <select
            value={crop}
            onChange={(e) => setCrop(e.target.value)}
            className={selectClass}
          >
            {cropOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {tHero(opt.key)}
              </option>
            ))}
          </select>
        </div>

        {/* Machine Type */}
        <div>
          <label className={labelClass}>
            <Tractor className="h-4 w-4 text-primary-500" />
            {tHero("machineType")}
          </label>
          <select
            value={machineType}
            onChange={(e) => setMachineType(e.target.value)}
            className={selectClass}
          >
            {machineOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {tHero(opt.key)}
              </option>
            ))}
          </select>
        </div>

        {/* Budget Slider */}
        <div className="sm:col-span-2">
          <label className={`${labelClass} justify-between`}>
            <span className="flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-primary-500" />
              {tHero("budget")}
            </span>
            <span className="text-primary-600 dark:text-primary-400">
              ¥{budget}{locale === "zh" ? "万" : "0K"}
            </span>
          </label>
          <input
            type="range"
            min={5}
            max={100}
            step={5}
            value={budget}
            onChange={(e) => setBudget(Number(e.target.value))}
            className="w-full accent-primary-500"
          />
          <div className="mt-1 flex justify-between text-xs text-gray-400">
            <span>5{locale === "zh" ? "万" : "0K"}</span>
            <span>100{locale === "zh" ? "万" : "0K"}</span>
          </div>
        </div>

        {/* Field Size */}
        <div>
          <label className={labelClass}>
            <Maximize className="h-4 w-4 text-primary-500" />
            {t("fieldSize")}
          </label>
          <input
            type="number"
            min={0}
            placeholder="500"
            value={fieldSize}
            onChange={(e) => setFieldSize(e.target.value)}
            className={selectClass}
          />
        </div>

        {/* Target Region */}
        <div>
          <label className={labelClass}>
            <Globe className="h-4 w-4 text-primary-500" />
            {t("targetRegion")}
          </label>
          <select
            value={targetRegion}
            onChange={(e) => setTargetRegion(e.target.value)}
            className={selectClass}
          >
            {regionOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {t(opt.key)}
              </option>
            ))}
          </select>
        </div>

        {/* Max Age */}
        <div className="sm:col-span-2">
          <label className={labelClass}>
            <Calendar className="h-4 w-4 text-primary-500" />
            {t("maxAge")}
          </label>
          <div className="flex gap-2">
            {ageOptions.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setMaxAge(opt.value)}
                className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                  maxAge === opt.value
                    ? "border-primary-500 bg-primary-50 text-primary-700 dark:bg-primary-900/20 dark:text-primary-300"
                    : "border-gray-300 text-gray-600 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-400 dark:hover:bg-gray-700"
                }`}
              >
                {t(opt.key)}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Submit Button */}
      <button
        onClick={handleSubmit}
        disabled={isLoading}
        className="mt-6 flex w-full items-center justify-center gap-2 rounded-lg bg-brand-accent px-6 py-3 text-base font-semibold text-white shadow-md transition-all hover:bg-brand-accent-hover hover:shadow-lg active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
      >
        <Play className="h-5 w-5" />
        {isLoading ? t("matching") : t("startMatch")}
      </button>
    </div>
  );
}
