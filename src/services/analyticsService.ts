import { Platform } from 'react-native';
import { supabase } from '../lib/supabase';

// ── Event catalog ──────────────────────────────────────────────────────────
export type AnalyticsEvent =
  | 'app_open'
  | 'expense_created'
  | 'expense_deleted'
  | 'income_created'
  | 'scan_started'
  | 'scan_completed'
  | 'scan_failed'
  | 'xml_imported'
  | 'bank_import_completed'
  | 'paywall_viewed'
  | 'paywall_converted'
  | 'founder_code_redeemed'
  | 'report_exported'
  | 'category_changed'
  | 'budget_set'
  | 'savings_goal_created'
  | 'savings_deposit'
  | 'split_created'
  | 'widget_setup'
  | 'biometric_enabled'
  | 'theme_changed';

interface EventPayload {
  event: AnalyticsEvent;
  properties?: Record<string, unknown>;
}

// ── Batch queue ────────────────────────────────────────────────────────────
let queue: EventPayload[] = [];
let flushTimer: ReturnType<typeof setTimeout> | null = null;
const FLUSH_INTERVAL = 15_000; // 15s
const MAX_QUEUE = 20;

async function flush() {
  if (queue.length === 0) return;
  const batch = [...queue];
  queue = [];

  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const userId = user?.id ?? null;

    const rows = batch.map(item => ({
      user_id: userId,
      event: item.event,
      properties: item.properties ?? {},
      platform: Platform.OS,
    }));

    await supabase.from('analytics_events').insert(rows);
  } catch {
    // Never block the app for analytics
  }
}

function scheduleFlush() {
  if (flushTimer) return;
  flushTimer = setTimeout(() => {
    flushTimer = null;
    flush();
  }, FLUSH_INTERVAL);
}

// ── Public API ──────────────────────────────────────────────────────────────
export function track(
  event: AnalyticsEvent,
  properties?: Record<string, unknown>,
) {
  if (__DEV__) console.log(`[Analytics] ${event}`, properties ?? '');
  queue.push({ event, properties });
  if (queue.length >= MAX_QUEUE) {
    if (flushTimer) {
      clearTimeout(flushTimer);
      flushTimer = null;
    }
    flush();
  } else {
    scheduleFlush();
  }
}

export function flushNow() {
  if (flushTimer) {
    clearTimeout(flushTimer);
    flushTimer = null;
  }
  return flush();
}
