import NetInfo, { NetInfoState } from '@react-native-community/netinfo';
import { supabase } from '../lib/supabase';
import {
  getPendingSyncItems,
  markSynced,
  SyncQueueItem,
} from '../database/syncQueue';
import { useAuthStore } from '../store/useAuthStore';

let unsubscribe: (() => void) | null = null;
let flushing = false;

async function processItem(item: SyncQueueItem, userId: string) {
  const payload = JSON.parse(item.payload);

  switch (item.action) {
    case 'insert': {
      const { error } = await supabase.from('expenses').insert({
        user_id: userId,
        local_id: item.expense_local_id,
        amount: payload.amount,
        date: payload.date,
        category: payload.category,
        description: payload.description ?? '',
        merchant_name: payload.merchantName ?? '',
        concepts_text: payload.conceptsText ?? '',
        ocr_raw_text: payload.ocrRawText ?? '',
        deductible: payload.deductible ?? false,
        rfc: payload.rfc ?? '',
        uso_cfdi: payload.usoCFDI ?? '',
        source: payload.source ?? 'manual',
      });
      if (error) throw error;
      break;
    }
    case 'update': {
      const { error } = await supabase
        .from('expenses')
        .update({
          amount: payload.amount,
          date: payload.date,
          category: payload.category,
          description: payload.description ?? '',
          merchant_name: payload.merchantName ?? '',
          concepts_text: payload.conceptsText ?? '',
          ocr_raw_text: payload.ocrRawText ?? '',
          deductible: payload.deductible ?? false,
          rfc: payload.rfc ?? '',
          uso_cfdi: payload.usoCFDI ?? '',
          source: payload.source ?? 'manual',
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', userId)
        .eq('local_id', item.expense_local_id);
      if (error) throw error;
      break;
    }
    case 'delete': {
      const { error } = await supabase
        .from('expenses')
        .update({ deleted_at: new Date().toISOString() })
        .eq('user_id', userId)
        .eq('local_id', item.expense_local_id);
      if (error) throw error;
      break;
    }
  }
}

export async function flushSyncQueue() {
  if (flushing) return;
  flushing = true;

  try {
    const session = useAuthStore.getState().session;
    if (!session?.user?.id) return;

    const items = await getPendingSyncItems();
    if (items.length === 0) return;

    const synced: number[] = [];
    for (const item of items) {
      try {
        await processItem(item, session.user.id);
        synced.push(item.id);
      } catch {
        // stop processing on first error to preserve order
        break;
      }
    }

    if (synced.length > 0) {
      await markSynced(synced);
    }
  } finally {
    flushing = false;
  }
}

export function startSyncService() {
  if (unsubscribe) return;

  unsubscribe = NetInfo.addEventListener((state: NetInfoState) => {
    if (state.isConnected) {
      flushSyncQueue();
    }
  });

  // Initial flush
  flushSyncQueue();
}

export function stopSyncService() {
  if (unsubscribe) {
    unsubscribe();
    unsubscribe = null;
  }
}
