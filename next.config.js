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

  // 黑龙江农机展（2026-09-19~21）已收官且不再推进：相关页面已下线，
  // 旧 URL 永久 301 到当前主战场天津页，避免 404 白白丢掉已积累的权重。
  // 注意：next.config 的 redirects 在 middleware 之前执行，故这里按「带语言前缀」的
  // 真实收录形态匹配；无前缀的请求由 middleware 先补语言前缀，会多一跳但结果一致。
  async redirects() {
    const LOCALES = "zh|en|ru|es|pt|ar|fr|hi";
    return [
      {
        source: `/:locale(${LOCALES})/expo/heilongjiang-2026`,
        destination: "/:locale/expo/tianjin-2026",
        statusCode: 301,
      },
      {
        source: `/:locale(${LOCALES})/expo/heilongjiang-2026/:path*`,
        destination: "/:locale/expo/tianjin-2026",
        statusCode: 301,
      },
    ];
  },
};

module.exports = withNextIntl(nextConfig);
