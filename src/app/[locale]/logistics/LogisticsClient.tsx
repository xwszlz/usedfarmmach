"use client";

import { useTranslations } from "next-intl";
import { Card, CardContent } from "@/components/ui/card";
import {
  Ship,
  Package,
  Plane,
  ClipboardCheck,
  Box,
  FileText,
  Globe,
  Truck,
} from "lucide-react";

export default function LogisticsClient() {
  const t = useTranslations("logistics");

  const timelineSteps = [
    { icon: ClipboardCheck, title: t("timeline.step1"), desc: t("timeline.step1Desc") },
    { icon: Box, title: t("timeline.step2"), desc: t("timeline.step2Desc") },
    { icon: FileText, title: t("timeline.step3"), desc: t("timeline.step3Desc") },
    { icon: Globe, title: t("timeline.step4"), desc: t("timeline.step4Desc") },
    { icon: Truck, title: t("timeline.step5"), desc: t("timeline.step5Desc") },
  ];

  const shippingOptions = [
    {
      icon: Ship,
      title: t("fcl.title"),
      desc: t("fcl.desc"),
      price: t("fcl.price"),
      time: t("fcl.time"),
      features: t("fcl.features").split("|"),
      color: "primary",
    },
    {
      icon: Package,
      title: t("lcl.title"),
      desc: t("lcl.desc"),
      price: t("lcl.price"),
      time: t("lcl.time"),
      features: t("lcl.features").split("|"),
      color: "blue",
    },
    {
      icon: Plane,
      title: t("air.title"),
      desc: t("air.desc"),
      price: t("air.price"),
      time: t("air.time"),
      features: t("air.features").split("|"),
      color: "accent",
    },
  ];

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-12 text-center">
        <h1 className="text-2xl font-bold text-gray-900 sm:text-3xl">
          {t("title")}
        </h1>
        <p className="mt-2 text-gray-500">{t("subtitle")}</p>
      </div>

      <div className="mb-16">
        <h2 className="mb-8 text-center text-xl font-bold text-gray-900">
          {t("timeline.title")}
        </h2>
        <div className="relative">
          <div className="absolute left-1/2 top-0 h-full w-0.5 -translate-x-1/2 bg-gray-200" />
          <div className="space-y-8">
            {timelineSteps.map((step, idx) => (
              <div
                key={idx}
                className={`relative flex items-center gap-6 ${
                  idx % 2 === 0 ? "flex-row" : "flex-row-reverse"
                }`}
              >
                <div className="flex-1" />
                <div className="relative z-10 flex h-12 w-12 items-center justify-center rounded-full bg-primary-500 text-white shadow-lg">
                  <step.icon className="h-5 w-5" />
                </div>
                <div className="flex-1">
                  <Card className="border-0 shadow-sm">
                    <CardContent className="p-4">
                      <h3 className="font-semibold text-gray-900">
                        {step.title}
                      </h3>
                      <p className="text-sm text-gray-500">{step.desc}</p>
                    </CardContent>
                  </Card>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        {shippingOptions.map((option, idx) => (
          <Card
            key={idx}
            className={`border-2 shadow-sm transition-shadow hover:shadow-md ${
              option.color === "primary"
                ? "border-primary-200"
                : option.color === "accent"
                  ? "border-accent-200"
                  : "border-blue-200"
            }`}
          >
            <CardContent className="p-6">
              <div
                className={`mb-4 inline-flex rounded-lg p-3 ${
                  option.color === "primary"
                    ? "bg-primary-100 text-primary-600"
                    : option.color === "accent"
                      ? "bg-accent-100 text-accent-600"
                      : "bg-blue-100 text-blue-600"
                }`}
              >
                <option.icon className="h-6 w-6" />
              </div>
              <h3 className="mb-2 text-lg font-bold text-gray-900">
                {option.title}
              </h3>
              <p className="mb-4 text-sm text-gray-500">{option.desc}</p>
              <div className="mb-2 text-lg font-bold text-primary-600">
                {option.price}
              </div>
              <div className="mb-4 text-sm text-gray-500">
                {option.time}
              </div>
              <ul className="space-y-1">
                {option.features.map((feat, fidx) => (
                  <li key={fidx} className="flex items-center gap-2 text-sm text-gray-600">
                    <span className="text-primary-500">✓</span>
                    {feat}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
