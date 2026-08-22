/**
 * Sentry 配置 - Next.js App Router
 * 用于错误监控、性能追踪、用户反馈
 */

import * as Sentry from '@sentry/nextjs';

const SENTRY_DSN = process.env.SENTRY_DSN;
const SITE = process.env.SITE ?? 'com';
const ENVIRONMENT = process.env.NODE_ENV === 'production' ? 'production' : 'development';
const RELEASE = process.env.npm_package_version ?? '0.1.0';

if (SENTRY_DSN) {
  Sentry.init({
    dsn: SENTRY_DSN,
    environment: `${ENVIRONMENT}-${SITE}`,
    release: RELEASE,
    tracesSampleRate: ENVIRONMENT === 'production' ? 0.1 : 1.0,
    profilesSampleRate: ENVIRONMENT === 'production' ? 0.1 : 1.0,
    debug: ENVIRONMENT !== 'production',
    
    // 过滤敏感数据
    beforeSend(event, hint) {
      // 过滤健康检查错误
      if (event.request?.url?.includes('/api/health')) {
        return null;
      }
      
      // 过滤已知的无害错误
      const error = hint.originalException;
      if (error instanceof Error) {
        // 忽略网络错误
        if (error.message.includes('ECONNREFUSED') || error.message.includes('ENOTFOUND')) {
          return null;
        }
        // 忽略 Prisma 连接错误（由健康检查处理）
        if (error.message.includes('Can\'t reach database server') || error.message.includes('P1001')) {
          return null;
        }
      }
      
      return event;
    },
    
    // 性能监控配置
    integrations: [
      Sentry.httpIntegration({}),
      Sentry.consoleIntegration({}),
    ],
  });
}

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;

// 自定义错误边界包装器
export function withSentryErrorBoundary(Component: React.ComponentType<any>) {
  return Sentry.withErrorBoundary(Component, {
    fallback: ({ error, resetError }) => (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="text-center max-w-md">
          <h1 className="text-2xl font-bold text-red-600 mb-4">出错了</h1>
          <p className="text-gray-600 mb-6">
            {process.env.NODE_ENV === 'production'
              ? '系统遇到了意外错误，我们的工程师已收到通知正在处理。'
              : `错误详情: ${error instanceof Error ? error.message : 'Unknown error'}`}
          </p>
          <button
            onClick={resetError}
            className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
          >
            重试
          </button>
        </div>
      </div>
    ),
  });
}