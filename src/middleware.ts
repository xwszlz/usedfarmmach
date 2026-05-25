import createMiddleware from "next-intl/middleware";

export default createMiddleware({
  locales: ["zh", "en", "ru"],
  defaultLocale: "zh",
});

export const config = {
  matcher: ["/", "/(zh|en|ru)/:path*"],
};
