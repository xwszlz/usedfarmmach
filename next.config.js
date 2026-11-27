const path = require("path");
const createNextIntlPlugin = require("next-intl/plugin");

const withNextIntl = createNextIntlPlugin("./i18n.ts");

/** .cn 构建标记（与下方 output / env 的判据保持同一表达式，避免两处漂移） */
const IS_CN_BUILD = process.env.SITE === "cn";

/** 开发环境标记：next dev 的 HMR / React Refresh 依赖 eval，必须放行 'unsafe-eval'。 */
const IS_DEV = process.env.NODE_ENV === "development";

/**
 * 内容安全策略（CSP）。
 *
 * 设计依据全部来自 2026-11-25 websiteanalyzer.dev 审计报告的实测项 + 两站真实抓包，
 * 每一条白名单都能指出代码出处，不做「宁滥勿缺」式堆砌：
 *
 * - script-src 'unsafe-inline'：实测 .com 首页有 22 个内联 <script>（其中 17 个是
 *   RSC payload 的 self.__next_f.push，其余是 application/ld+json 与联盟追踪脚本）。
 *   去掉会让整站白屏。真严格版要 nonce + middleware，代价是全部路由退化为动态渲染、
 *   丢掉 Vercel 静态优化，收益与代价不成比例，故本批不做。
 * - script-src https://mc.yandex.ru：Yandex Metrica（src/app/[locale]/layout.tsx:74）。
 *   注意它是 document.createElement('script') 动态注入的，SSR HTML 里看不到，
 *   靠 curl 抓页面会漏掉 —— 这是「只看 curl 就配 CSP」最典型的踩坑点。
 * - script-src https://cdn.paddle.com：Paddle.js 结账（credits/recharge-form.tsx:46），
 *   `.cn` 因 `if (!isCom) return` 永不加载，但 CSP 是两站共用一份，必须写进来。
 * - style-src 'unsafe-inline'：项目用 MUI（emotion），运行时插入 <style> 标签。
 * - img-src https://*.aliyuncs.com：实测 .cn 首页 100 处图片来自
 *   usedfarmmach-oss.oss-cn-beijing.aliyuncs.com。
 * - frame-src https://*.paddle.com：Paddle 结账浮层是 iframe。
 * - frame-ancestors 'self'：配合 X-Frame-Options: SAMEORIGIN 防点击劫持。
 *   注意小程序 <web-view>（shendiao-miniprogram/pages/about/about.js:28 嵌
 *   https://usedfarmmach.cn）是原生 WebView 顶层导航、不是 iframe，不受此限制，不会白屏。
 *
 * ⚠️ 首批以 Content-Security-Policy-Report-Only 头名上线（2026-11-27 老板拍板）：
 * 只报告不拦截，零风险；观察期内按 F12 Console 的违规项补全白名单后，再把头名
 * 换成 Content-Security-Policy 切强制。切强制时唯一必须确认的是：产品图有没有
 * 引用 OSS 之外的第三方图床 —— 若有，img-src 要按实测域名追加。
 */
const CSP_DIRECTIVES = [
  "default-src 'self'",
  // 'unsafe-eval' 只在 dev 放行；生产构建下 Next 不需要它。
  `script-src 'self' 'unsafe-inline'${IS_DEV ? " 'unsafe-eval'" : ""} https://mc.yandex.ru https://cdn.paddle.com`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://*.aliyuncs.com https://mc.yandex.ru https://*.paddle.com",
  "font-src 'self' data:",
  "connect-src 'self' https://mc.yandex.ru https://*.paddle.com https://*.aliyuncs.com",
  "frame-src 'self' https://*.paddle.com",
  "media-src 'self' https://*.aliyuncs.com",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'self'",
  "manifest-src 'self'",
  "worker-src 'self' blob:",
];

const CSP = CSP_DIRECTIVES.join("; ");

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

  // 隐藏 X-Powered-By: Next.js —— 少给扫描器一条指纹（审计报告把它列为信息泄露面）。
  poweredByHeader: false,

  // 安全响应头统一落在 next.config.js 的 headers()，而不是 vercel.json：
  // vercel.json 只对 Vercel 平台生效，`.cn` 走 ECS + Docker standalone 完全读不到；
  // next.config.js 是应用层能力，两站同一个构建配置、两边同时生效，不会漂移。
  //
  // 🔴 这里**不写** Strict-Transport-Security：Vercel 与 `.cn` nginx 已各自下发 HSTS
  // （.com 63072000 / .cn 31536000），应用层再写一份会产生两个同名头，浏览器只认
  // 第一个，反而让两站的有效期变得不可预测。
  async headers() {
    return [
      {
        // 全局安全头。Next 会把所有命中的规则追加合并，不影响下面 subsidy 的 no-store。
        source: "/(.*)",
        headers: [
          // ① CSP —— 首批 Report-Only，只报告不拦截（2026-11-27 拍板）。
          //    观察期结束后把头名换成 "Content-Security-Policy" 即切强制，其余不动。
          { key: "Content-Security-Policy-Report-Only", value: CSP },
          // ② 点击劫持 —— 与 CSP 的 frame-ancestors 'self' 双保险。
          //    Report-Only 阶段 frame-ancestors 不生效，所以这个头必须真上。
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          // ③ 禁止 MIME 嗅探，防「上传的图片被当成 JS 执行」类攻击。
          { key: "X-Content-Type-Options", value: "nosniff" },
          // ④ 跨站只送 origin、不送完整路径 —— 既保住外链来源统计，又不泄露站内路径。
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          // ⑤ 关掉本站用不到的浏览器能力，缩小被恶意脚本滥用的面。
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(), browsing-topics=()",
          },
        ],
      },
      // 国内农机补贴明细页 / raw JSON 通道：动态内容 + fail-closed 门禁，禁用缓存。
      // 仅覆盖 /:locale/subsidy/*（详情页与 /api/(cn)/subsidy/raw/* 由 API 自身再补 no-store），
      // 不动其它路由、不动 redirects / images / env（T04 仅 additive）。
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
