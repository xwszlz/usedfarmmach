const createNextIntlPlugin = require("next-intl/plugin");

const withNextIntl = createNextIntlPlugin("./i18n.ts");

/** @type {import('next').NextConfig} */
const nextConfig = {
  generateBuildId: () => `shendiao-build-${Date.now()}`,
  // .cn 站点使用 standalone 输出（适合 Docker/阿里云 ECS 部署）
  output: process.env.SITE === "cn" ? "standalone" : undefined,
  // AI 销售策略 PDF 导出依赖 Noto Sans SC 字体文件（运行时 fs 读取）。
  // standalone 构建只追踪 import 图，js 里用 process.cwd() 拼路径的字体不会被自动带上，
  // 故显式声明：把字体目录纳入 export/pdf 路由的产物追踪，确保 .cn 镜像内可用。
  // ⚠️ Next.js 14 里 outputFileTracingIncludes 必须放在 experimental 下；
  // 放到顶层会报 "Unrecognized key(s) in object"，且配置不生效（字体不会被打进产物）。
  experimental: {
    outputFileTracingIncludes: {
      "/api/agents/seller-helper/sales-strategy/export/pdf": [
        "./src/lib/sales-strategy/fonts/**",
      ],
    },
  },
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

  // 黑龙江农机展（2026-09-19~21）与天津 CIAME（2026-10-26~28）均已收官，专题页已下线。
  // 旧 URL 永久 301 到仍在运营的线上展馆 /:locale/expo（神雕云展常年在线），
  // 而不是让它 404 —— 这两条 URL 此前在 sitemap 里 priority 0.8 收录过，权重不能白扔。
  // 注意：next.config 的 redirects 在 middleware 之前执行，故这里按「带语言前缀」的
  // 真实收录形态匹配；无前缀的请求由 middleware 先补语言前缀，会多一跳但结果一致。
  async redirects() {
    const LOCALES = "zh|en|ru|es|pt|ar|fr|hi";
    return [
      {
        source: `/:locale(${LOCALES})/expo/heilongjiang-2026`,
        destination: "/:locale/expo",
        statusCode: 301,
      },
      {
        source: `/:locale(${LOCALES})/expo/heilongjiang-2026/:path*`,
        destination: "/:locale/expo",
        statusCode: 301,
      },
      // 天津 CIAME 2026 专题页下线（2026-10-29），保留 301 承接已收录 URL
      {
        source: `/:locale(${LOCALES})/expo/tianjin-2026`,
        destination: "/:locale/expo",
        statusCode: 301,
      },
      {
        source: `/:locale(${LOCALES})/expo/tianjin-2026/:path*`,
        destination: "/:locale/expo",
        statusCode: 301,
      },
    ];
  },
};

module.exports = withNextIntl(nextConfig);
