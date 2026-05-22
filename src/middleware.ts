import createMiddleware from "next-intl/middleware";

export default createMiddleware({
  locales: ["zh", "en"],
  defaultLocale: "zh",
});

export const config = {
  matcher: ["/", "/(zh|en)/:path*"],
};
