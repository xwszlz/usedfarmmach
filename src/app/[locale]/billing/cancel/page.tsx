import type { Metadata } from "next";
import Link from "next/link";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  return {
    title: locale === "zh" ? "支付未完成" : "Payment Not Completed",
  };
}

export default async function BillingCancelPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const zh = locale === "zh";
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 text-center shadow-sm">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-amber-100 text-3xl">
          !
        </div>
        <h1 className="mb-2 text-xl font-semibold text-gray-900">
          {zh ? "支付未完成" : "Payment Not Completed"}
        </h1>
        <p className="mb-6 text-sm text-gray-500">
          {zh
            ? "您取消了支付或未完成付款，未产生任何扣费。可重新前往会员页发起支付。"
            : "You cancelled or did not complete the payment. No charge was made. You can return to the membership page to try again."}
        </p>
        <div className="flex flex-col gap-2">
          <Link
            href={"/" + locale + "/membership"}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            {zh ? "重新支付" : "Try Again"}
          </Link>
          <Link
            href={"/" + locale}
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            {zh ? "返回首页" : "Back to Home"}
          </Link>
        </div>
      </div>
    </main>
  );
}
