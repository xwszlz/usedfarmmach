import { verifyEmailToken } from "@/lib/email-token";
import { prisma } from "@/lib/db";
import { grantEmailVerifiedGiftIfNeeded } from "@/lib/credits/grant";
import { getTranslations } from "next-intl/server";
import Link from "next/link";

interface VerifyEmailPageProps {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ token?: string }>;
}

/**
 * 邮箱验证回调页（magic link，阶段 1，任务 T06，Server Component）
 *
 * 读 ?token → 校验 → 比对 user.email 与 token.email 一致
 *   → 置 emailVerified=true、emailPending=false → 幂等发分(+5)
 *   → 渲染成功 / 过期 / 无效 三态（不抛 500）。
 */
export default async function VerifyEmailPage({
  params,
  searchParams,
}: VerifyEmailPageProps) {
  const { locale } = await params;
  const { token } = await searchParams;
  const t = await getTranslations({ locale, namespace: "auth.verifyEmail" });

  type Status = "success" | "expired" | "invalid";
  let status: Status = "invalid";
  let giftAmount = 0;

  if (token) {
    const result = verifyEmailToken(token, "verify_email");
    if (result) {
      const user = await prisma.user.findUnique({
        where: { id: result.userId },
        select: { id: true, email: true, emailVerified: true },
      });
      // 邮箱一致才置验证通过（防 token 被错位使用）
      if (
        user &&
        user.email &&
        user.email.toLowerCase() === result.email.toLowerCase()
      ) {
        await prisma.user.update({
          where: { id: user.id },
          data: { emailVerified: true, emailPending: false },
        });
        const gift = await grantEmailVerifiedGiftIfNeeded(user.id);
        status = "success";
        giftAmount = gift.granted ? gift.amount : 0;
      }
    } else {
      // token 篡改 / 过期 → expired
      status = "expired";
    }
  }

  const title =
    status === "success"
      ? t("successTitle")
      : status === "expired"
        ? t("expiredTitle")
        : t("invalidTitle");

  const message =
    status === "success"
      ? giftAmount > 0
        ? t("successMessageWithGift", { amount: giftAmount })
        : t("successMessage")
      : status === "expired"
        ? t("expiredMessage")
        : t("invalidMessage");

  const iconBg = status === "success" ? "bg-green-100" : "bg-amber-100";
  const iconColor = status === "success" ? "text-green-600" : "text-amber-600";
  const icon = status === "success" ? "✓" : "!";

  return (
    <div className="mx-auto max-w-2xl px-4 py-12 sm:px-6 lg:px-8">
      <div className="rounded-xl border bg-white p-8 text-center shadow-sm">
        <div
          className={`mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full ${iconBg}`}
        >
          <span className={`text-2xl ${iconColor}`}>{icon}</span>
        </div>
        <h1 className="text-xl font-bold text-gray-900">{title}</h1>
        <p className="mt-3 text-sm text-gray-600">{message}</p>
        <div className="mt-6 flex justify-center gap-3">
          <Link
            href={`/${locale}/account/complete-profile`}
            className="font-medium text-primary-600 hover:underline"
          >
            {t("gotoAccount")}
          </Link>
          <Link
            href={`/${locale}`}
            className="font-medium text-primary-600 hover:underline"
          >
            {t("backHome")}
          </Link>
        </div>
      </div>
    </div>
  );
}
