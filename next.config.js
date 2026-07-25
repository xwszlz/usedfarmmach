const createNextIntlPlugin = require("next-intl/plugin");

const withNextIntl = createNextIntlPlugin("./i18n.ts");

/** @type {import('next').NextConfig} */
const nextConfig = {
  generateBuildId: () => `shendiao-build-${Date.now()}`,
  // .cn 站点使用 standalone 输出（适合 Docker/阿里云 ECS 部署）
  output: process.env.SITE === "cn" ? "standalone" : undefined,
  // 注入 SITE 环境变量到运行时
  env: {
    SITE: process.env.SITE ?? "com",
    NEXT_PUBLIC_SITE: process.env.SITE ?? "com",
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.aliyuncs.com",
      },
      {
        protocol: "https",
        hostname: "*.oss-cn-beijing.aliyuncs.com",
      },
      {
        protocol: "https",
        hostname: "oss-cn-beijing.aliyuncs.com",
      },
    ],
  },
};

module.exports = withNextIntl(nextConfig);
