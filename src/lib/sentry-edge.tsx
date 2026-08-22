/**
 * Sentry Edge 配置 - 用于 Middleware 和 Edge Runtime
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
    debug: ENVIRONMENT !== 'production',
  });
}

export const onRequestError = Sentry.captureRequestError;