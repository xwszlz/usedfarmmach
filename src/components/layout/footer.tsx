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
                  href={`/${locale}/products`}
                  className="text-sm text-gray-500 hover:text-primary-600"
                >
                  {t("quickLinks")}
                </Link>
              </li>
              <li>
                <Link
                  href={`/${locale}/logistics`}
                  className="text-sm text-gray-500 hover:text-primary-600"
                >
                  {t("quickLinks")}
                </Link>
              </li>
              <li>
                <Link
                  href={`/${locale}/about`}
                  className="text-sm text-gray-500 hover:text-primary-600"
                >
                  {t("quickLinks")}
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
                {t("email")}: contact@agritrade.com
              </li>
              <li className="text-sm text-gray-500">
                {t("phone")}: +86 400-888-8888
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
