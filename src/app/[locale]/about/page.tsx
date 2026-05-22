"use client";

import { useTranslations } from "next-intl";
import { Card, CardContent } from "@/components/ui/card";
import { Eye, Shield, Zap, Handshake, Users } from "lucide-react";

export default function AboutPage() {
  const t = useTranslations("about");

  const values = [
    {
      icon: Eye,
      title: t("value1Title"),
      desc: t("value1Desc"),
      color: "text-primary-600 bg-primary-100",
    },
    {
      icon: Shield,
      title: t("value2Title"),
      desc: t("value2Desc"),
      color: "text-green-600 bg-green-100",
    },
    {
      icon: Zap,
      title: t("value3Title"),
      desc: t("value3Desc"),
      color: "text-accent-600 bg-accent-100",
    },
    {
      icon: Handshake,
      title: t("value4Title"),
      desc: t("value4Desc"),
      color: "text-blue-600 bg-blue-100",
    },
  ];

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="mb-12 text-center">
        <h1 className="text-2xl font-bold text-gray-900 sm:text-3xl">
          {t("title")}
        </h1>
        <p className="mt-2 text-gray-500">{t("subtitle")}</p>
      </div>

      {/* Mission */}
      <div className="mb-16">
        <Card className="border-0 bg-gradient-to-br from-primary-50 to-white shadow-sm">
          <CardContent className="p-8 text-center">
            <h2 className="mb-4 text-xl font-bold text-gray-900">
              {t("mission")}
            </h2>
            <p className="mx-auto max-w-2xl text-gray-600 leading-relaxed">
              {t("missionText")}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Core Values */}
      <div className="mb-16">
        <h2 className="mb-8 text-center text-xl font-bold text-gray-900">
          {t("values")}
        </h2>
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {values.map((val, idx) => (
            <Card key={idx} className="border-0 shadow-sm transition-shadow hover:shadow-md">
              <CardContent className="p-6 text-center">
                <div
                  className={`mx-auto mb-4 inline-flex rounded-lg p-3 ${val.color}`}
                >
                  <val.icon className="h-6 w-6" />
                </div>
                <h3 className="mb-2 text-lg font-semibold text-gray-900">
                  {val.title}
                </h3>
                <p className="text-sm text-gray-500">{val.desc}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Team */}
      <div className="mb-8">
        <Card className="border-0 bg-gray-50 shadow-sm">
          <CardContent className="p-8 text-center">
            <Users className="mx-auto mb-4 h-10 w-10 text-primary-500" />
            <h2 className="mb-4 text-xl font-bold text-gray-900">
              {t("team")}
            </h2>
            <p className="mx-auto max-w-2xl text-gray-600 leading-relaxed">
              {t("teamText")}
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
