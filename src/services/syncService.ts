import NetInfo, { NetInfoState } from '@react-native-community/netinfo';
import { supabase } from '../lib/supabase';
import {
  getPendingSyncItems,
  markSynced,
  SyncQueueItem,
} from '../database/syncQueue';
import { useAuthStore } from '../store/useAuthStore';
import { getDatabase } from '../database/db';
import { useExpenseStore } from '../store/useExpenseStore';
import { useIncomeStore } from '../store/useIncomeStore';
import { usePremiumStore } from '../store/usePremiumStore';

let unsubscribe: (() => void) | null = null;
let flushing = false;
let retryTimeout: ReturnType<typeof setTimeout> | null = null;
let retryCount = 0;
const MAX_RETRIES = 5;

async function processItem(item: SyncQueueItem, userId: string) {
  const payload = JSON.parse(item.payload);
  const localId = item.expense_local_id;

  if (item.entity_type === 'income') {
    switch (item.action) {
      case 'insert': {
        const { error } = await supabase.from('incomes').upsert(
          {
            user_id: userId,
            local_id: localId,
            amount: payload.amount,
            date: payload.date,
            type: payload.type,
            description: payload.description ?? '',
            invoiced: payload.invoiced ?? false,
            recurring: payload.recurring ?? false,
            payment_method: payload.paymentMethod ?? 'transferencia',
          },
          { onConflict: 'user_id,local_id' },
        );
        if (error) throw error;
        break;
      }
      case 'update': {
        const { error } = await supabase
          .from('incomes')
          .update({
            amount: payload.amount,
            date: payload.date,
            type: payload.type,
            description: payload.description ?? '',
            invoiced: payload.invoiced ?? false,
            recurring: payload.recurring ?? false,
            payment_method: payload.paymentMethod ?? 'transferencia',
          })
          .eq('user_id', userId)
          .eq('local_id', localId);
        if (error) throw error;
        break;
      }
      case 'delete': {
        const { error } = await supabase
          .from('incomes')
          .delete()
          .eq('user_id', userId)
          .eq('local_id', localId);
        if (error) throw error;
        break;
      }
    }
    return;
  }

  switch (item.action) {
    case 'insert': {
      const { error } = await supabase.from('expenses').insert({
        user_id: userId,
        local_id: localId,
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
        .eq('local_id', localId);
      if (error) throw error;
      break;
    }
    case 'delete': {
      const { error } = await supabase
        .from('expenses')
        .update({ deleted_at: new Date().toISOString() })
        .eq('user_id', userId)
        .eq('local_id', localId);
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
    let failed = false;
    for (const item of items) {
      try {
        await processItem(item, session.user.id);
        synced.push(item.id);
        retryCount = 0;
      } catch {
        // Stop on first error to preserve order, schedule retry with backoff
        failed = true;
        break;
      }
    }

    if (synced.length > 0) {
      await markSynced(synced);
    }

    if (failed && retryCount < MAX_RETRIES) {
      const delay = Math.min(1000 * 2 ** retryCount, 30000); // 1s, 2s, 4s, 8s, 16s, max 30s
      retryCount++;
      if (retryTimeout) clearTimeout(retryTimeout);
      retryTimeout = setTimeout(() => flushSyncQueue(), delay);
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

// ── Pull: descarga datos de Supabase al SQLite local ─────────────────────────
// Se llama después de iniciar sesión para restaurar los datos del usuario.

export async function pullFromSupabase(): Promise<void> {
  const session = useAuthStore.getState().session;
  if (!session?.user?.id) return;
  const userId = session.user.id;

  try {
    // Avatar — siempre jalar al login, independiente de datos locales
    void (async () => {
      try {
        const { data } = await supabase.from('profiles').select('avatar_url').eq('id', userId).single();
        if (data?.avatar_url) usePremiumStore.getState().setAvatarUri(data.avatar_url);
      } catch {}
    })();

    const db = await getDatabase();

    // Solo jalar si no hay datos locales — evita duplicados en reloads
    const [countResult] = await db.executeSql('SELECT COUNT(*) as count FROM expenses');
    const localCount = countResult.rows.item(0).count ?? 0;
    if (localCount > 0) return;

    // ── Gastos ────────────────────────────────────────────────────────────────
    const { data: expenses, error: expError } = await supabase
      .from('expenses')
      .select('*')
      .eq('user_id', userId)
      .is('deleted_at', null)
      .order('date', { ascending: false });

    if (!expError && expenses && expenses.length > 0) {
      for (const row of expenses) {
        await db.executeSql(
          `INSERT OR IGNORE INTO expenses
            (amount, date, category, description, merchantName, conceptsText,
             ocrRawText, deductible, rfc, usoCFDI, source, createdAt, receiptImageUri)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            row.amount,
            row.date,
            row.category,
            row.description ?? '',
            row.merchant_name ?? '',
            row.concepts_text ?? '',
            row.ocr_raw_text ?? '',
            row.deductible ? 1 : 0,
            row.rfc ?? '',
            row.uso_cfdi ?? '',
            row.source ?? 'manual',
            row.created_at ?? new Date().toISOString(),
            row.receipt_image_uri ?? '',
          ],
        );
      }
      await useExpenseStore.getState().loadExpenses();
    }

    // ── Ingresos ──────────────────────────────────────────────────────────────
    const { data: incomes, error: incError } = await supabase
      .from('incomes')
      .select('*')
      .eq('user_id', userId)
      .order('date', { ascending: false });

    if (!incError && incomes && incomes.length > 0) {
      for (const row of incomes) {
        await db.executeSql(
          `INSERT OR IGNORE INTO incomes
            (amount, date, type, description, invoiced, recurring, paymentMethod, createdAt)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            row.amount,
            row.date,
            row.type ?? 'otros',
            row.description ?? '',
            row.invoiced ? 1 : 0,
            row.recurring ? 1 : 0,
            row.payment_method ?? 'transferencia',
            row.created_at ?? new Date().toISOString(),
          ],
        );
      }
      await useIncomeStore.getState().loadIncomes();
    }
  } catch {
    // Pull silencioso — si falla, el usuario puede seguir usando la app offline
  }
}
