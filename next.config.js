const path = require("path");
const createNextIntlPlugin = require("next-intl/plugin");

const withNextIntl = createNextIntlPlugin("./i18n.ts");

/** .cn 构建标记（与下方 output / env 的判据保持同一表达式，避免两处漂移） */
const IS_CN_BUILD = process.env.SITE === "cn";

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

  /**
   * D3 数据不出境：`.cn` 产物必须物理零命中 Resend。
   *
   * ⚠️ 只靠 config.ts 里的 `if (CN_BUILD_GUARD) { ...return }` 不够 —— 2026-11-20
   * 实测 `SITE=cn npx next build`，`.next/server/chunks/*.js` 里仍有 api.resend.com：
   * webpack 在 Terser 做死代码消除之前就建好了 async chunk 图，提前 return 挡不住它。
   * 故这里做**结构性替换**：.cn 构建把 ./provider-resend 换成 disabled 占位实现，
   * 不依赖任何优化器行为，产物里物理上不存在 Resend 端点与出网代码。
   * 该替换只影响打包结果，不影响 tsc（真实实现照常接受类型检查）。
   */
  webpack(config, { webpack }) {
    if (IS_CN_BUILD) {
      config.plugins.push(
        new webpack.NormalModuleReplacementPlugin(
          /[\\/]provider-resend$/,
          path.resolve(__dirname, "src/lib/email/provider-resend.disabled.ts")
        )
      );
      // 同理：收信转发执行体（含 api.resend.com 与出网代码）在 .cn 产物中也必须零命中。
      // /api/resend/inbound 路由本身保留（返回 200 跳过），只是执行体被换成占位实现。
      config.plugins.push(
        new webpack.NormalModuleReplacementPlugin(
          /[\\/]inbound-forwarder$/,
          path.resolve(
            __dirname,
            "src/lib/email/inbound-forwarder.disabled.ts"
          )
        )
      );
    }
    return config;
  },

  // 国内农机补贴明细页 / raw JSON 通道：动态内容 + fail-closed 门禁，禁用缓存。
  // 仅覆盖 /:locale/subsidy/*（详情页与 /api/(cn)/subsidy/raw/* 由 API 自身再补 no-store），
  // 不动其它路由、不动 redirects / images / env（T04 仅 additive）。
  async headers() {
    return [
      {
        source: "/:locale(zh|en)/subsidy/:path*",
        headers: [{ key: "Cache-Control", value: "no-store" }],
      },
    ];
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
