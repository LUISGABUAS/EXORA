import * as Sentry from '@sentry/react-native';

// Sentry is initialized in App.tsx by the wizard.
// This module exposes helpers for use throughout the app.

export function setUserContext(userId: string, email?: string) {
  Sentry.setUser({ id: userId, email });
}

export function clearUserContext() {
  Sentry.setUser(null);
}

export function captureError(error: unknown, context?: Record<string, unknown>) {
  if (__DEV__) console.error('[Crash]', error, context);
  Sentry.withScope(scope => {
    if (context) scope.setExtras(context);
    Sentry.captureException(error);
  });
}

export function captureMessage(msg: string, level: 'info' | 'warning' | 'error' = 'info') {
  if (__DEV__) console.log(`[Sentry ${level}]`, msg);
  Sentry.captureMessage(msg, level);
}
