"use client";
import { useTranslations } from "next-intl";
import { DisclaimerBanner } from "@/components/expo/DisclaimerBanner";
import { CnFooter } from "@/components/cn/CnFooter";
import { isCnSite } from "@/config/site";
import { useTr } from "@/lib/i18n-tr";
interface FooterProps {
    locale: string;
}
export function Footer({ locale }: FooterProps) {
  const tr = useTr();
    const t = useTranslations("footer");
    return (<>
      <footer className="border-t border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-950">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
          {/* Brand */}
          <div>
            <div className="flex items-center gap-2">
              <img src="/logo.jpg" alt={tr("神雕农机")} className="h-8 w-auto object-contain"/>
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
                <a href="https://www.rbauction.com/" target="_blank" rel="noopener noreferrer" className="text-sm text-gray-500 hover:text-primary-600 dark:text-gray-400 dark:hover:text-primary-400">
                  {t("quickLinkRb")}
                </a>
              </li>
              <li>
                <a href="https://www.camda.org.cn/" target="_blank" rel="noopener noreferrer" className="text-sm text-gray-500 hover:text-primary-600 dark:text-gray-400 dark:hover:text-primary-400">
                  {t("quickLinkCamda")}
                </a>
              </li>
              <li>
                <a href="https://www.tractorhouse.com/" target="_blank" rel="noopener noreferrer" className="text-sm text-gray-500 hover:text-primary-600 dark:text-gray-400 dark:hover:text-primary-400">
                  {t("quickLinkTractorHouse")}
                </a>
              </li>
              <li>
                <a href="https://www.agriaffaires.com/" target="_blank" rel="noopener noreferrer" className="text-sm text-gray-500 hover:text-primary-600 dark:text-gray-400 dark:hover:text-primary-400">
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
          <DisclaimerBanner locale={locale} variant="full"/>
        </div>

        {/* Legal Links */}
        <div className="mt-6 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm">
          <a href={`/${locale}/privacy`} className="text-gray-500 hover:text-primary-600 dark:text-gray-400 dark:hover:text-primary-400">
            {t("privacy")}
          </a>
          <span className="text-gray-300 dark:text-gray-600">|</span>
          <a href={`/${locale}/terms`} className="text-gray-500 hover:text-primary-600 dark:text-gray-400 dark:hover:text-primary-400">
            {t("terms")}
          </a>
        </div>

        {/* 协会关系声明 — 合规口径（唯一标准称谓，含分会层级） */}
        <div className="mt-6 text-center text-xs leading-relaxed text-gray-400">
          {locale === "zh"
            ? "\u795E\u96D5\u519C\u673A\u662F\u4E2D\u56FD\u519C\u673A\u6D41\u901A\u534F\u4F1A\u00B7\u4E8C\u624B\u519C\u673A\u6D41\u901A\u5206\u4F1A\u526F\u4F1A\u957F\u5355\u4F4D\u3002\u795E\u96D5\u519C\u673A\u5C55\u3001\u795E\u96D5\u4E91\u5C55\u3001\u795E\u96D5\u5C55\u7FFC\u4E3A\u795E\u96D5\u519C\u673A\u81EA\u6709\u54C1\u724C\uFF0C\u72EC\u7ACB\u8FD0\u8425\uFF0C\u4E0D\u4EE3\u8868\u534F\u4F1A\u5B98\u65B9\u3002"
            : "Shendiao Agricultural Machinery is a Vice-President Unit of the Used Farm Machinery Circulation Branch under the China Agricultural Machinery Circulation Association. Shendiao Agri-Machinery Expo\u2122, Shendiao Cloud Expo\u2122, and Shendiao WingShow\u2122 are proprietary brands of Shendiao, operated independently and not representing the Association."}
        </div>

        {!isCnSite() && (<div className="mt-4 border-t border-gray-200 pt-6 text-center text-sm text-gray-400 dark:border-gray-700">
            {t("copyright")}
          </div>)}
      </div>
      </footer>
      <CnFooter />
    </>);
}
