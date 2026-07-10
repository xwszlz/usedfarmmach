import { useTranslations } from "next-intl";

export default function ArenaPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-4 py-20">
      <div className="text-center">
        <h1 className="text-4xl font-bold tracking-tight text-gray-900 dark:text-white">
          AI 农机竞技场
        </h1>
        <p className="mt-4 text-lg text-gray-600 dark:text-gray-400">
          AI Machinery Arena — Coming Soon
        </p>
        <div className="mt-8 inline-flex items-center rounded-full bg-brand-accent-light px-4 py-2 text-sm font-medium text-brand-accent">
          即将上线 / Coming Soon
        </div>
      </div>
    </div>
  );
}
