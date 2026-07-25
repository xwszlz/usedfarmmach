import type { Metadata } from "next";
import { EngineerCertClient } from "./EngineerCertClient";
import { generatePageMetadata } from "@/lib/seo-metadata";
import { BreadcrumbStructuredData, CourseStructuredData } from "@/components/seo/structured-data";
import { translate } from "@/lib/i18n-runtime";

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || "https://usedfarmmach.com";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  return generatePageMetadata("engineer", locale, "", {
    openGraph: {
      images: [{ url: `${BASE_URL}/images/og-engineer.png`, width: 1200, height: 630 }],
    },
  });
}

export default async function EngineerPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  
  return (
    <div>
      <BreadcrumbStructuredData
        locale={locale}
        items={[
          { name: translate("首页", locale), url: `${BASE_URL}/${locale}` },
          {
            name: translate("AI农机工程师认证", locale),
            url: `${BASE_URL}/${locale}/engineer`,
          },
        ]}
      />
      <CourseStructuredData
        locale={locale}
        courseName={translate("AI农机工程师认证体系", locale)}
        courseDescription={
          translate("全球首个农机AI操控认证体系，涵盖AI编程、人机协同、多机调度、数据决策等八维技能，五级认证从AI学徒到首席操控师，证书绑定平台派单权限。", locale)
        }
        modules={[
          { name: translate("AI编程", locale), description: translate("农机AI任务编程与参数调优", locale) },
          { name: translate("人机协同", locale), description: translate("人机协同作业策略与应急接管", locale) },
          { name: translate("多机调度", locale), description: translate("多台农机协同调度与路径优化", locale) },
          { name: translate("数据决策", locale), description: translate("作业数据分析与决策优化", locale) },
          { name: translate("传统操控", locale), description: translate("农机基础操控与田间作业", locale) },
          { name: translate("安全规范", locale), description: translate("农机安全操作规范与风险评估", locale) },
          { name: translate("维护保养", locale), description: translate("农机日常维护与故障排除", locale) },
          { name: translate("应急处理", locale), description: translate("紧急情况处理与应急预案", locale) },
        ]}
      />
      <EngineerCertClient locale={locale} />
    </div>
  );
}
