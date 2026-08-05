"use client";

import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import {
  Award,
  Cpu,
  Users,
  LayoutGrid,
  BarChart3,
  Gauge,
  Shield,
  Wrench,
  Leaf,
  ArrowRight,
  ChevronRight,
  Star,
  CheckCircle2,
  GraduationCap,
  MonitorPlay,
  ClipboardCheck,
  FileBadge,
} from "lucide-react";

interface EngineerCertClientProps {
  locale: string;
}

const skillIcons = [Cpu, Users, LayoutGrid, BarChart3, Gauge, Shield, Wrench, Leaf];
const skillColors = [
  "text-violet-600 dark:text-violet-400",
  "text-blue-600 dark:text-blue-400",
  "text-cyan-600 dark:text-cyan-400",
  "text-emerald-600 dark:text-emerald-400",
  "text-amber-600 dark:text-amber-400",
  "text-red-600 dark:text-red-400",
  "text-orange-600 dark:text-orange-400",
  "text-green-600 dark:text-green-400",
];
const skillBgs = [
  "bg-violet-50 dark:bg-violet-900/20",
  "bg-blue-50 dark:bg-blue-900/20",
  "bg-cyan-50 dark:bg-cyan-900/20",
  "bg-emerald-50 dark:bg-emerald-900/20",
  "bg-amber-50 dark:bg-amber-900/20",
  "bg-red-50 dark:bg-red-900/20",
  "bg-orange-50 dark:bg-orange-900/20",
  "bg-green-50 dark:bg-green-900/20",
];

const certLevels = [
  {
    key: "L1",
    color: "border-slate-400 bg-slate-50 dark:bg-slate-900/30",
    iconColor: "text-slate-500",
    badgeColor: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
  },
  {
    key: "L2",
    color: "border-blue-400 bg-blue-50 dark:bg-blue-900/20",
    iconColor: "text-blue-500",
    badgeColor: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
  },
  {
    key: "L3",
    color: "border-amber-400 bg-amber-50 dark:bg-amber-900/20",
    iconColor: "text-amber-500",
    badgeColor: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
  },
  {
    key: "L4",
    color: "border-orange-400 bg-orange-50 dark:bg-orange-900/20",
    iconColor: "text-orange-500",
    badgeColor: "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300",
  },
  {
    key: "L5",
    color: "border-red-400 bg-red-50 dark:bg-red-900/20",
    iconColor: "text-red-500",
    badgeColor: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
  },
];

const processSteps = [
  { icon: GraduationCap, color: "text-blue-500", bg: "bg-blue-50 dark:bg-blue-900/20" },
  { icon: MonitorPlay, color: "text-violet-500", bg: "bg-violet-50 dark:bg-violet-900/20" },
  { icon: ClipboardCheck, color: "text-amber-500", bg: "bg-amber-50 dark:bg-amber-900/20" },
  { icon: FileBadge, color: "text-emerald-500", bg: "bg-emerald-50 dark:bg-emerald-900/20" },
];

export function EngineerCertClient({ locale }: EngineerCertClientProps) {
  const t = useTranslations();
  const router = useRouter();

  return (
    <div>
      {/* ===== Hero Section ===== */}
      <section className="relative overflow-hidden py-16 lg:py-24">
        <div className="absolute inset-0 bg-gradient-to-br from-amber-50 via-white to-violet-50 dark:from-gray-900 dark:via-gray-950 dark:to-gray-900" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(251,191,36,0.12),transparent_60%)]" />

        <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-3xl text-center">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-amber-100 px-4 py-1.5 text-sm font-semibold text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
              <Award className="h-4 w-4" />
              {t("engineer.heroBadge")}
            </div>
            <h1 className="text-4xl font-bold tracking-tight text-gray-900 dark:text-white sm:text-5xl lg:text-6xl">
              {t("engineer.title")}
            </h1>
            <p className="mt-4 text-lg text-gray-600 dark:text-gray-400">
              {t("engineer.subtitle")}
            </p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
              <button
                onClick={() => router.push(`/${locale}/arena`)}
                className="inline-flex items-center gap-2 rounded-lg bg-amber-600 px-6 py-3 text-base font-semibold text-white shadow-md transition-all hover:bg-amber-700 hover:shadow-lg active:scale-[0.98]"
              >
                {t("engineer.heroCTA")}
                <ArrowRight className="h-5 w-5" />
              </button>
              <button
                onClick={() => {
                  document.getElementById("skills-section")?.scrollIntoView({ behavior: "smooth" });
                }}
                className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-6 py-3 text-base font-semibold text-gray-700 shadow-sm transition-all hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
              >
                {t("engineer.learnMore")}
                <ChevronRight className="h-5 w-5" />
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* ===== Why Certification ===== */}
      <section className="py-16 lg:py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-3xl text-center">
            <h2 className="text-3xl font-bold text-gray-900 dark:text-white">
              {t("engineer.whyTitle")}
            </h2>
            <p className="mt-4 text-gray-600 dark:text-gray-400">
              {t("engineer.whySubtitle")}
            </p>
          </div>
          <div className="mt-12 grid gap-8 sm:grid-cols-3">
            {[1, 2, 3].map((n) => (
              <div
                key={n}
                className="rounded-2xl border border-gray-200 bg-white p-8 shadow-sm transition-shadow hover:shadow-md dark:border-gray-700 dark:bg-gray-900"
              >
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-amber-100 dark:bg-amber-900/30">
                  <Star className="h-6 w-6 text-amber-600 dark:text-amber-400" />
                </div>
                <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                  {t(`engineer.why${n}Title`)}
                </h3>
                <p className="mt-3 text-gray-600 dark:text-gray-400">
                  {t(`engineer.why${n}Desc`)}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== 8-Dimension Skill System ===== */}
      <section id="skills-section" className="bg-gray-50 py-16 lg:py-20 dark:bg-gray-950">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-3xl text-center">
            <h2 className="text-3xl font-bold text-gray-900 dark:text-white">
              {t("engineer.skillsTitle")}
            </h2>
            <p className="mt-4 text-gray-600 dark:text-gray-400">
              {t("engineer.skillsSubtitle")}
            </p>
          </div>

          {/* AI Core Skills */}
          <div className="mt-12">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full bg-violet-100 px-4 py-1.5 text-sm font-semibold text-violet-700 dark:bg-violet-900/30 dark:text-violet-300">
              <Cpu className="h-4 w-4" />
              {t("engineer.coreSkills")} (55%)
            </div>
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {[1, 2, 3, 4].map((n) => {
                const Icon = skillIcons[n - 1];
                return (
                  <div
                    key={`ai-${n}`}
                    className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm transition-all hover:shadow-md hover:-translate-y-0.5 dark:border-gray-700 dark:bg-gray-900"
                  >
                    <div className={`mb-3 inline-flex h-10 w-10 items-center justify-center rounded-xl ${skillBgs[n - 1]}`}>
                      <Icon className={`h-5 w-5 ${skillColors[n - 1]}`} />
                    </div>
                    <div className="mb-1 text-xs font-semibold text-gray-400 dark:text-gray-500">
                      {t(`engineer.skill${n}Weight`)}
                    </div>
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                      {t(`engineer.skill${n}Name`)}
                    </h3>
                    <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                      {t(`engineer.skill${n}Desc`)}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Traditional Skills */}
          <div className="mt-10">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full bg-amber-100 px-4 py-1.5 text-sm font-semibold text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
              <Award className="h-4 w-4" />
              {t("engineer.tradSkills")} (45%)
            </div>
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {[5, 6, 7, 8].map((n) => {
                const Icon = skillIcons[n - 1];
                return (
                  <div
                    key={`trad-${n}`}
                    className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm transition-all hover:shadow-md hover:-translate-y-0.5 dark:border-gray-700 dark:bg-gray-900"
                  >
                    <div className={`mb-3 inline-flex h-10 w-10 items-center justify-center rounded-xl ${skillBgs[n - 1]}`}>
                      <Icon className={`h-5 w-5 ${skillColors[n - 1]}`} />
                    </div>
                    <div className="mb-1 text-xs font-semibold text-gray-400 dark:text-gray-500">
                      {t(`engineer.skill${n}Weight`)}
                    </div>
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                      {t(`engineer.skill${n}Name`)}
                    </h3>
                    <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                      {t(`engineer.skill${n}Desc`)}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      {/* ===== 5-Level Certification Ladder ===== */}
      <section className="py-16 lg:py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-3xl text-center">
            <h2 className="text-3xl font-bold text-gray-900 dark:text-white">
              {t("engineer.certTitle")}
            </h2>
            <p className="mt-4 text-gray-600 dark:text-gray-400">
              {t("engineer.certSubtitle")}
            </p>
          </div>

          <div className="mt-12 space-y-6">
            {certLevels.map((level, i) => (
              <div
                key={level.key}
                className={`relative rounded-2xl border-2 ${level.color} bg-white p-6 shadow-sm transition-all hover:shadow-md sm:flex sm:items-start sm:gap-6 dark:bg-gray-900`}
              >
                {/* Level Badge */}
                <div className="mb-4 flex-shrink-0 sm:mb-0">
                  <div
                    className={`inline-flex h-16 w-16 items-center justify-center rounded-xl ${level.badgeColor}`}
                  >
                    <Star className={`h-8 w-8 ${level.iconColor}`} />
                  </div>
                </div>

                <div className="flex-1">
                  <div className="flex flex-wrap items-center gap-3">
                    <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                      {t(`engineer.cert${level.key}Name`)}
                    </h3>
                    <span
                      className={`rounded-full px-3 py-0.5 text-xs font-semibold ${level.badgeColor}`}
                    >
                      {t(`engineer.cert${level.key}Badge`)}
                    </span>
                    {i === 4 && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-3 py-0.5 text-xs font-semibold text-red-700 dark:bg-red-900/30 dark:text-red-400">
                        <Cpu className="h-3 w-3" />
                        {t("engineer.certTop")}
                      </span>
                    )}
                  </div>

                  <p className="mt-2 text-gray-600 dark:text-gray-400">
                    {t(`engineer.cert${level.key}Req`)}
                  </p>

                  <div className="mt-3 flex flex-wrap items-center gap-4 text-sm">
                    <span className="inline-flex items-center gap-1 text-gray-500 dark:text-gray-400">
                      <Gauge className="h-4 w-4" />
                      {t(`engineer.cert${level.key}Score`)}
                    </span>
                    <span className="inline-flex items-center gap-1 text-amber-600 dark:text-amber-400">
                      <Award className="h-4 w-4" />
                      {t(`engineer.cert${level.key}Bonus`)}
                    </span>
                    <span className="text-gray-500 dark:text-gray-400">
                      {t(`engineer.cert${level.key}Price`)}
                    </span>
                  </div>

                  <div className="mt-3 flex flex-wrap gap-2">
                    {(t(`engineer.cert${level.key}Perks`) as string).split("|").map((perk: string, j: number) => (
                      <span
                        key={j}
                        className="inline-flex items-center gap-1 rounded-full bg-green-50 px-2.5 py-0.5 text-xs font-medium text-green-700 dark:bg-green-900/20 dark:text-green-400"
                      >
                        <CheckCircle2 className="h-3 w-3" />
                        {perk}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== Certification Process ===== */}
      <section className="bg-gray-50 py-16 lg:py-20 dark:bg-gray-950">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-3xl text-center">
            <h2 className="text-3xl font-bold text-gray-900 dark:text-white">
              {t("engineer.processTitle")}
            </h2>
            <p className="mt-4 text-gray-600 dark:text-gray-400">
              {t("engineer.processSubtitle")}
            </p>
          </div>

          <div className="mt-12 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            {processSteps.map((step, i) => {
              const Icon = step.icon;
              return (
                <div key={i} className="relative text-center">
                  {/* Connector line (desktop) */}
                  {i < 3 && (
                    <div className="absolute left-1/2 top-12 hidden h-0.5 w-full bg-gray-300 lg:block dark:bg-gray-600" />
                  )}

                  <div className="relative z-10 mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-white shadow-sm ring-1 ring-gray-200 dark:bg-gray-800 dark:ring-gray-700">
                    <Icon className={`h-8 w-8 ${step.color}`} />
                  </div>
                  <div className="mb-1 inline-flex items-center gap-1 rounded-full bg-gray-100 px-3 py-0.5 text-xs font-semibold text-gray-600 dark:bg-gray-800 dark:text-gray-400">
                    {t("engineer.processStep")} {i + 1}
                  </div>
                  <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                    {t(`engineer.process${i + 1}Title`)}
                  </h3>
                  <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                    {t(`engineer.process${i + 1}Desc`)}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ===== CTA Section ===== */}
      <section className="py-16 lg:py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-3xl rounded-3xl bg-gradient-to-br from-amber-500 to-amber-600 p-10 text-center shadow-xl sm:p-16">
            <div className="mb-4 inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-white/20">
              <Award className="h-8 w-8 text-white" />
            </div>
            <h2 className="text-3xl font-bold text-white">
              {t("engineer.ctaTitle")}
            </h2>
            <p className="mt-4 text-lg text-amber-50">
              {t("engineer.ctaSubtitle")}
            </p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
              <button
                onClick={() => router.push(`/${locale}/arena`)}
                className="inline-flex items-center gap-2 rounded-lg bg-white px-6 py-3 text-base font-semibold text-amber-700 shadow-md transition-all hover:bg-amber-50 active:scale-[0.98]"
              >
                {t("engineer.ctaButton")}
                <ArrowRight className="h-5 w-5" />
              </button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
