import { useTranslations } from "next-intl";
import { DisclaimerBanner } from "@/components/expo/DisclaimerBanner";

interface FooterProps {
  locale: string;
}

export function Footer({ locale }: FooterProps) {
  const t = useTranslations("footer");

  return (
    <footer className="border-t border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-950">
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
            <p className="mt-3 text-sm text-gray-500 dark:text-gray-400">{t("description")}</p>
          </div>

          {/* Quick Links — 行业权威平台 */}
          <div>
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
              {t("quickLinks")}
            </h3>
            <ul className="mt-3 space-y-2">
              <li>
                <a
                  href="https://www.rbauction.com/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-gray-500 hover:text-primary-600 dark:text-gray-400 dark:hover:text-primary-400"
                >
                  {t("quickLinkRb")}
                </a>
              </li>
              <li>
                <a
                  href="https://www.camda.org.cn/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-gray-500 hover:text-primary-600 dark:text-gray-400 dark:hover:text-primary-400"
                >
                  {t("quickLinkCamda")}
                </a>
              </li>
              <li>
                <a
                  href="https://www.tractorhouse.com/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-gray-500 hover:text-primary-600 dark:text-gray-400 dark:hover:text-primary-400"
                >
                  {t("quickLinkTractorHouse")}
                </a>
              </li>
              <li>
                <a
                  href="https://www.agriaffaires.com/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-gray-500 hover:text-primary-600 dark:text-gray-400 dark:hover:text-primary-400"
                >
                  {t("quickLinkAgriaffaires")}
                </a>
              </li>
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
              {t("contactUs")}
            </h3>
            <ul className="mt-3 space-y-2">
              <li className="text-sm text-gray-500 dark:text-gray-400">
                {t("company")}: {t("companyName")}
              </li>
              <li className="text-sm text-gray-500 dark:text-gray-400">
                {t("email")}: jiusei0319@gmail.com
              </li>
              <li className="text-sm text-gray-500 dark:text-gray-400">
                {t("address")}: {t("companyAddress")}
              </li>
            </ul>
          </div>
        </div>

        {/* Disclaimer */}
        <div className="mt-8">
          <DisclaimerBanner locale={locale} variant="full" />
        </div>

        <div className="mt-8 border-t border-gray-200 pt-8 text-center text-sm text-gray-400 dark:border-gray-700">
          {t("copyright")}
        </div>
      </div>
    </footer>
  );
}
