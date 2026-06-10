import { useTranslations } from "next-intl";
import Link from "next/link";

interface FooterProps {
  locale: string;
}

export function Footer({ locale }: FooterProps) {
  const t = useTranslations("footer");

  return (
    <footer className="border-t bg-gray-50">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
          {/* Brand */}
          <div>
            <div className="flex items-center gap-2">
              <img
                src="/logo.jpg"
                alt="神雕农机"
                className="h-8 w-auto object-contain"
              />
            </div>
            <p className="mt-3 text-sm text-gray-500">{t("description")}</p>
          </div>

          {/* Quick Links */}
          <div>
            <h3 className="text-sm font-semibold text-gray-900">
              {t("quickLinks")}
            </h3>
            <ul className="mt-3 space-y-2">
              <li>
                <Link
                  href={`/${locale}/category/forage-harvester`}
                  className="text-sm text-gray-500 hover:text-primary-600"
                >
                  {t("quickLinkForage")}
                </Link>
              </li>
              <li>
                <Link
                  href={`/${locale}/brand/claas`}
                  className="text-sm text-gray-500 hover:text-primary-600"
                >
                  {t("quickLinkClaas")}
                </Link>
              </li>
              <li>
                <Link
                  href={`/${locale}/`}
                  className="text-sm text-gray-500 hover:text-primary-600"
                >
                  {t("quickLinkValuation")}
                </Link>
              </li>
              <li>
                <Link
                  href={`/${locale}/intelligence`}
                  className="text-sm text-gray-500 hover:text-primary-600"
                >
                  {t("quickLinkArbitrage")}
                </Link>
              </li>
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h3 className="text-sm font-semibold text-gray-900">
              {t("contactUs")}
            </h3>
            <ul className="mt-3 space-y-2">
              <li className="text-sm text-gray-500">
                {t("company")}: {t("companyName")}
              </li>
              <li className="text-sm text-gray-500">
                WhatsApp: +86 15511395016
              </li>
              <li className="text-sm text-gray-500">
                {t("phone")}: +86 18633878701
              </li>
              <li className="text-sm text-gray-500">
                {t("email")}: 932133255@qq.com
              </li>
              <li className="text-sm text-gray-500">
                {t("address")}: {t("companyAddress")}
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-8 border-t pt-8 text-center text-sm text-gray-400">
          {t("copyright")}
        </div>
      </div>
    </footer>
  );
}
