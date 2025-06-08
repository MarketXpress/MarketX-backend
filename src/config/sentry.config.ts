import * as Sentry from '@sentry/node';
import { ProfilingIntegration } from '@sentry/profiling-node';

export const initializeSentry = () => {
  if (!process.env.SENTRY_DSN) {
    console.warn('SENTRY_DSN is not defined. Sentry will not be initialized.');
    return;
  }

  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV || 'development',
    integrations: [
      new ProfilingIntegration(),
    ],
    // Performance Monitoring
    tracesSampleRate: 1.0, // Capture 100% of transactions
    // Set sampling rate for profiling
    profilesSampleRate: 1.0,
  });
};

export const captureException = (error: Error, context?: any) => {
  if (process.env.SENTRY_DSN) {
    Sentry.withScope((scope) => {
      if (context) {
        scope.setExtras(context);
      }
      Sentry.captureException(error);
    });
  }
}; 