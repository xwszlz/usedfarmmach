'use client';

import * as Sentry from '@sentry/nextjs';
import { useEffect } from 'react';

export function SentryErrorBoundaryWrapper({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    // 捕获未处理的 Promise rejection
    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      Sentry.captureException(event.reason);
    };
    
    window.addEventListener('unhandledrejection', handleUnhandledRejection);
    
    return () => {
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
    };
  }, []);

  return (
    <Sentry.ErrorBoundary
      fallback={({ error, resetError }) => (
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
      )}
      onError={(error, errorInfo) => {
        Sentry.captureException(error, {
          extra: { componentStack: typeof errorInfo === 'string' ? errorInfo : (errorInfo as any)?.componentStack },
        });
      }}
    >
      {children}
    </Sentry.ErrorBoundary>
  );
}