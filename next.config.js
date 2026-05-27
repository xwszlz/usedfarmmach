const createNextIntlPlugin = require("next-intl/plugin");

const withNextIntl = createNextIntlPlugin("./i18n.ts");

/** @type {import('next').NextConfig} */
const nextConfig = {
  generateBuildId: () => `shendiao-build-${Date.now()}`,
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.aliyuncs.com",
      },
    ],
  },
};

module.exports = withNextIntl(nextConfig);
