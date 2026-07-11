import type { Metadata } from "next";
import { EngineerCertClient } from "./EngineerCertClient";
import { generatePageMetadata } from "@/lib/seo-metadata";
import { BreadcrumbStructuredData, CourseStructuredData } from "@/components/seo/structured-data";

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
  const isZh = locale === "zh";

  return (
    <div>
      <BreadcrumbStructuredData
        locale={locale}
        items={[
          { name: isZh ? "首页" : "Home", url: `${BASE_URL}/${locale}` },
          {
            name: isZh ? "AI农机工程师认证" : "AI Engineer Certification",
            url: `${BASE_URL}/${locale}/engineer`,
          },
        ]}
      />
      <CourseStructuredData
        locale={locale}
        courseName={isZh ? "AI农机工程师认证体系" : "AI Agricultural Machinery Engineer Certification"}
        courseDescription={
          isZh
            ? "全球首个农机AI操控认证体系，涵盖AI编程、人机协同、多机调度、数据决策等八维技能，五级认证从AI学徒到首席操控师，证书绑定平台派单权限。"
            : "The world's first agricultural machinery AI control certification system, covering 8-dimensional skills including AI programming, human-machine collaboration, multi-machine scheduling, and data-driven decision making. 5-level certification from AI Apprentice to Chief Controller, with certificates linked to platform dispatch authority."
        }
        modules={[
          { name: isZh ? "AI编程" : "AI Programming", description: isZh ? "农机AI任务编程与参数调优" : "Agricultural machinery AI task programming and parameter tuning" },
          { name: isZh ? "人机协同" : "Human-Machine Collaboration", description: isZh ? "人机协同作业策略与应急接管" : "Human-machine collaboration strategies and emergency takeover" },
          { name: isZh ? "多机调度" : "Multi-Machine Scheduling", description: isZh ? "多台农机协同调度与路径优化" : "Multi-machine coordination and path optimization" },
          { name: isZh ? "数据决策" : "Data-Driven Decision Making", description: isZh ? "作业数据分析与决策优化" : "Operational data analysis and decision optimization" },
          { name: isZh ? "传统操控" : "Traditional Operation", description: isZh ? "农机基础操控与田间作业" : "Basic machinery operation and field work" },
          { name: isZh ? "安全规范" : "Safety Standards", description: isZh ? "农机安全操作规范与风险评估" : "Machinery safety protocols and risk assessment" },
          { name: isZh ? "维护保养" : "Maintenance", description: isZh ? "农机日常维护与故障排除" : "Daily maintenance and troubleshooting" },
          { name: isZh ? "应急处理" : "Emergency Response", description: isZh ? "紧急情况处理与应急预案" : "Emergency handling and contingency planning" },
        ]}
      />
      <EngineerCertClient locale={locale} />
    </div>
  );
}
