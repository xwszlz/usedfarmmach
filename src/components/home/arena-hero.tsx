"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Sprout, Tractor, DollarSign, ArrowRight, Sparkles } from "lucide-react";

interface ArenaHeroProps {
  locale: string;
}

export function ArenaHero({ locale }: ArenaHeroProps) {
  const t = useTranslations();
  const router = useRouter();

  const [crop, setCrop] = useState("wheat");
  const [machineType, setMachineType] = useState("tractor");
  const [budget, setBudget] = useState(30);

  const handleSubmit = () => {
    router.push(`/${locale}/arena?crop=${crop}&type=${machineType}&budget=${budget}`);
  };

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

  return (
    <section className="relative overflow-hidden py-20 lg:py-28">
      {/* Background gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary-50 via-white to-accent-50 dark:from-gray-900 dark:via-gray-950 dark:to-gray-900" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(99,102,241,0.08),transparent_50%)]" />

      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid items-center gap-12 lg:grid-cols-2">
          {/* Left — Title + Form */}
          <div>
            <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-brand-accent-light px-3 py-1 text-sm font-medium text-brand-accent">
              <Sparkles className="h-4 w-4" />
              AI Powered
            </div>
            <h1 className="text-4xl font-bold tracking-tight text-gray-900 dark:text-white sm:text-5xl lg:text-6xl">
              {t("hero.arenaTitle")}
            </h1>
            <p className="mt-4 text-lg text-gray-600 dark:text-gray-400">
              {t("hero.arenaSubtitle")}
            </p>

            {/* Arena Form */}
            <div className="mt-8 rounded-2xl border border-gray-200 bg-white/80 p-6 shadow-lg backdrop-blur dark:border-gray-700 dark:bg-gray-900/80">
              {/* Crop Type */}
              <div className="mb-5">
                <label className="mb-2 flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300">
                  <Sprout className="h-4 w-4 text-primary-500" />
                  {t("hero.crop")}
                </label>
                <select
                  value={crop}
                  onChange={(e) => setCrop(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm text-gray-900 focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
                >
                  {cropOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {t(opt.key)}
                    </option>
                  ))}
                </select>
              </div>

              {/* Machine Type */}
              <div className="mb-5">
                <label className="mb-2 flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300">
                  <Tractor className="h-4 w-4 text-primary-500" />
                  {t("hero.machineType")}
                </label>
                <select
                  value={machineType}
                  onChange={(e) => setMachineType(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm text-gray-900 focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
                >
                  {machineOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {t(opt.key)}
                    </option>
                  ))}
                </select>
              </div>

              {/* Budget Slider */}
              <div className="mb-6">
                <label className="mb-2 flex items-center justify-between text-sm font-medium text-gray-700 dark:text-gray-300">
                  <span className="flex items-center gap-2">
                    <DollarSign className="h-4 w-4 text-primary-500" />
                    {t("hero.budget")}
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

              {/* Submit Button */}
              <button
                onClick={handleSubmit}
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-brand-accent px-6 py-3 text-base font-semibold text-white shadow-md transition-all hover:bg-brand-accent-hover hover:shadow-lg active:scale-[0.98]"
              >
                {t("hero.startArena")}
                <ArrowRight className="h-5 w-5" />
              </button>
            </div>
          </div>

          {/* Right — Decorative Visual */}
          <div className="hidden lg:block">
            <div className="relative">
              {/* Gradient orb */}
              <div className="absolute -right-20 -top-20 h-72 w-72 rounded-full bg-gradient-to-br from-primary-400/30 to-accent-400/30 blur-3xl" />
              <div className="absolute bottom-0 left-0 h-48 w-48 rounded-full bg-gradient-to-br from-brand-accent/20 to-primary-500/20 blur-3xl" />

              {/* Icon grid */}
              <div className="relative grid grid-cols-3 gap-4">
                {[
                  { icon: Tractor, label: "Tractor", color: "text-primary-500", bg: "bg-primary-50 dark:bg-primary-900/20" },
                  { icon: Sprout, label: "Crop", color: "text-green-500", bg: "bg-green-50 dark:bg-green-900/20" },
                  { icon: DollarSign, label: "Budget", color: "text-amber-500", bg: "bg-amber-50 dark:bg-amber-900/20" },
                  { icon: Sparkles, label: "AI", color: "text-brand-accent", bg: "bg-brand-accent-light" },
                  { icon: Tractor, label: "Harvester", color: "text-red-500", bg: "bg-red-50 dark:bg-red-900/20" },
                  { icon: Sprout, label: "Yield", color: "text-blue-500", bg: "bg-blue-50 dark:bg-blue-900/20" },
                  { icon: DollarSign, label: "ROI", color: "text-purple-500", bg: "bg-purple-50 dark:bg-purple-900/20" },
                  { icon: Sparkles, label: "Smart", color: "text-cyan-500", bg: "bg-cyan-50 dark:bg-cyan-900/20" },
                  { icon: Tractor, label: "Fleet", color: "text-orange-500", bg: "bg-orange-50 dark:bg-orange-900/20" },
                ].map((item, i) => (
                  <div
                    key={i}
                    className={`flex aspect-square flex-col items-center justify-center gap-2 rounded-2xl ${item.bg} p-4 transition-transform hover:scale-105`}
                  >
                    <item.icon className={`h-8 w-8 ${item.color}`} />
                    <span className="text-xs font-medium text-gray-600 dark:text-gray-400">
                      {item.label}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
