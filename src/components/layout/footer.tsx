import { useTranslations } from "next-intl";
import { DisclaimerBanner } from "@/components/expo/DisclaimerBanner";
import { CnFooter } from "@/components/cn/CnFooter";
import { isCnSite } from "@/config/site";

interface FooterProps {
  locale: string;
}

export function Footer({ locale }: FooterProps) {
  const t = useTranslations("footer");

  return (
    <>
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

        {/* Legal Links */}
        <div className="mt-6 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm">
          <a
            href={`/${locale}/privacy`}
            className="text-gray-500 hover:text-primary-600 dark:text-gray-400 dark:hover:text-primary-400"
          >
            {t("privacy")}
          </a>
          <span className="text-gray-300 dark:text-gray-600">|</span>
          <a
            href={`/${locale}/terms`}
            className="text-gray-500 hover:text-primary-600 dark:text-gray-400 dark:hover:text-primary-400"
          >
            {t("terms")}
          </a>
        </div>

        {/* 协会关系声明 — 合规口径（唯一标准称谓，含分会层级） */}
        <div className="mt-6 text-center text-xs leading-relaxed text-gray-400">
          {locale === "zh"
            ? "神雕农机是中国农机流通协会·二手农机流通分会副会长单位。神雕农机展、神雕云展、神雕展翼为神雕农机自有品牌，独立运营，不代表协会官方。"
            : "Shendiao Agricultural Machinery is a Vice-President Unit of the Used Farm Machinery Circulation Branch under the China Agricultural Machinery Circulation Association. Shendiao Agri-Machinery Expo™, Shendiao Cloud Expo™, and Shendiao WingShow™ are proprietary brands of Shendiao, operated independently and not representing the Association."}
        </div>

        {!isCnSite() && (
          <div className="mt-4 border-t border-gray-200 pt-6 text-center text-sm text-gray-400 dark:border-gray-700">
            {t("copyright")}
          </div>
        )}
      </div>
      </footer>
      <CnFooter />
    </>
  );
}
