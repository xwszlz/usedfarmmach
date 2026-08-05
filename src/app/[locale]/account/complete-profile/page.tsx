import { CompleteProfileForm } from "@/components/account/complete-profile-form";

/**
 * 引导式补全资料页（阶段 0，任务 T11①）
 * 非强制：除“数据出境单独同意”勾选外，其余字段均为选填。
 * 服务端组件仅负责布局与文案，交互逻辑在 Client 组件 complete-profile-form。
 */
export default async function CompleteProfilePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const isZh = locale === "zh";

  return (
    <div className="mx-auto max-w-2xl px-4 py-12 sm:px-6 lg:px-8">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
        {isZh ? "补全资料" : "Complete Your Profile"}
      </h1>
      <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
        {isZh
          ? "为获得更好的服务（如找回密码、接收通知），建议您补全以下资料。除“数据出境单独同意”外，其余均为选填。补全邮箱即视为已验证。"
          : "To get a better experience (e.g. password recovery, notifications), we recommend completing the following. Except for the cross-border data transfer consent, all fields are optional. Submitting a valid email is treated as verified in this phase."}
      </p>
      <div className="mt-8">
        <CompleteProfileForm locale={locale} />
      </div>
    </div>
  );
}
