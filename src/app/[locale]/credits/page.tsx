import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { verifyToken } from "@/lib/auth";
import { MEMBERSHIP_TIERS } from "@/lib/permissions";
import { CreditTransactionList } from "./credit-transactions";
import { MembershipCard } from "./membership-card";
import { RechargeForm } from "./recharge-form";

interface PageProps {
  params: { locale: string };
}

export default async function CreditsPage({ params }: PageProps) {
  const t = await getTranslations("credits");
  const locale = params.locale;

  // SSR 鉴权
  // 注意：真实场景从 cookie/token 读取，这里用 props 传递 userId
  // 实际由 middleware 注入 x-user-id header，需改为 client component 或在 layout 处理
  // 此处简化为客户端渲染，见 client component

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
      <h1 className="mb-6 text-2xl font-bold text-gray-900">
        {t("title") || "会员中心"}
      </h1>

      <div className="grid gap-6 md:grid-cols-2">
        {/* 会员状态卡片 */}
        <MembershipCard locale={locale} />

        {/* 积分余额 & 充值 */}
        <RechargeForm locale={locale} />

        {/* 积分明细 */}
        <div className="md:col-span-2">
          <CreditTransactionList locale={locale} />
        </div>
      </div>
    </div>
  );
}
