import type { Metadata } from "next";
import { NextIntlClientProvider } from "next-intl";
import { getMessages } from "next-intl/server";
import { notFound } from "next/navigation";
import Script from "next/script";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import { OrganizationStructuredData } from "@/components/seo/structured-data";
import { ThemeProvider } from "@/lib/theme/theme-provider";
import { SmoothScrollProvider } from "@/lib/lenis/smooth-scroll-provider";
import { SITE_ORIGIN } from "@/lib/site-url";

const locales = ["zh", "en", "ru", "es", "pt", "ar", "fr", "hi"] as const;
const BASE_URL = SITE_ORIGIN;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  return {
    // metadataBase 是 OG 图片相对路径绝对化、以及部分 canonical 兜底的基础。
    // 取 SITE_ORIGIN（= siteConfig.domains.canonical，.com 带 www / .cn 裸域），
    // 不用 NEXT_PUBLIC_APP_URL —— 后者线上是裸域，全站 308 跳 www，
    // 拿它做 metadataBase 等于对外声明一个非最终 host。
    metadataBase: new URL(BASE_URL),
    openGraph: {
      locale: locale === "zh" ? "zh_CN" : locale,
      // 兜底值：有 generatePageMetadata 的页面会各自覆盖成更准确的 type。
      // 这里是给不走那套封装的路由（后台、详情页等）一个合法默认值，
      // 避免 og:type 缺失 —— 2026-11-25 审计报告的 High/Medium 项之一。
      type: "website",
    },
  };
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  if (!(locales as readonly string[]).includes(locale)) {
    notFound();
  }

  const messages = await getMessages();

  return (
    <html lang={locale} suppressHydrationWarning>
      <body
        className={`${GeistSans.variable} ${GeistMono.variable} min-h-screen`}
        style={{ backgroundColor: "var(--color-bg-primary)" }}
      >
            <OrganizationStructuredData locale={locale} />
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <NextIntlClientProvider messages={messages}>
            <SmoothScrollProvider>
              <Navbar locale={locale} />
              <main className="min-h-[calc(100vh-4rem)]">{children}</main>
              <Footer locale={locale} />
            </SmoothScrollProvider>
          </NextIntlClientProvider>
        </ThemeProvider>

        {/* 分销裂变 P0：?ref= 推广码捕获 → 30 天 Cookie（ref_code，不采集任何个人信息） */}
        <Script id="affiliate-ref-capture" strategy="afterInteractive">{`
          (function(){try{var p=new URLSearchParams(window.location.search);var r=p.get('ref');if(r){var v=encodeURIComponent(String(r).slice(0,64));document.cookie='ref_code='+v+';path=/;max-age=2592000;SameSite=Lax';}}catch(e){}})();
        `}</Script>

        {/* Yandex Metrika — 俄罗斯广告流量监控 */}
        <Script
          id="yandex-metrika"
          strategy="afterInteractive"
        >{`
          (function(m,e,t,r,i,k,a){
            m[i]=m[i]||function(){(m[i].a=m[i].a||[]).push(arguments)};
            m[i].l=1*new Date();
            for (var j = 0; j < document.scripts.length; j++) {if (document.scripts[j].src === r) { return; }}
            k=e.createElement(t),a=e.getElementsByTagName(t)[0],k.async=1,k.src=r,a.parentNode.insertBefore(k,a)
          })(window, document,'script','https://mc.yandex.ru/metrika/tag.js?id=109732268', 'ym');

          ym(109732268, 'init', {
            accurateTrackBounce:true,
            clickmap:true,
            ecommerce:"dataLayer",
            referrer: document.referrer,
            ssr:true,
            trackLinks:true,
            url: location.href,
            webvisor:true
          });
        `}</Script>
        <noscript>
          <div>
            <img
              src="https://mc.yandex.ru/watch/109732268"
              style={{ position: "absolute", left: "-9999px" }}
              alt=""
            />
          </div>
        </noscript>
      </body>
    </html>
  );
}
