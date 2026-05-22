import { useTranslations } from "next-intl";
import { Card, CardContent } from "@/components/ui/card";
import { Brain, TrendingUp, Shield, Globe } from "lucide-react";

export function ArbitrageShowcase() {
  const t = useTranslations("home");

  const features = [
    {
      icon: Brain,
      title: t("feature1Title"),
      desc: t("feature1Desc"),
      color: "text-primary-600 bg-primary-100",
    },
    {
      icon: TrendingUp,
      title: t("feature2Title"),
      desc: t("feature2Desc"),
      color: "text-accent-600 bg-accent-100",
    },
    {
      icon: Shield,
      title: t("feature3Title"),
      desc: t("feature3Desc"),
      color: "text-green-600 bg-green-100",
    },
    {
      icon: Globe,
      title: t("feature4Title"),
      desc: t("feature4Desc"),
      color: "text-blue-600 bg-blue-100",
    },
  ];

  return (
    <section className="bg-gray-50 py-16">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mb-10 text-center">
          <h2 className="text-2xl font-bold text-gray-900 sm:text-3xl">
            {t("features")}
          </h2>
        </div>
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {features.map((feat, idx) => (
            <Card key={idx} className="border-0 shadow-sm transition-shadow hover:shadow-md">
              <CardContent className="p-6">
                <div
                  className={`mb-4 inline-flex rounded-lg p-3 ${feat.color}`}
                >
                  <feat.icon className="h-6 w-6" />
                </div>
                <h3 className="mb-2 text-lg font-semibold text-gray-900">
                  {feat.title}
                </h3>
                <p className="text-sm text-gray-500">{feat.desc}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}
