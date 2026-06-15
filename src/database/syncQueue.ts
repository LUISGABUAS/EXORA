import { getDatabase } from './db';

export type SyncAction = 'insert' | 'update' | 'delete';
export type SyncEntity = 'expense' | 'income';

export interface SyncQueueItem {
  id: number;
  action: SyncAction;
  entity_type: SyncEntity;
  expense_local_id: number;
  payload: string;
  synced: number;
}

export async function initSyncQueue() {
  const db = await getDatabase();
  await db.executeSql(`
    CREATE TABLE IF NOT EXISTS sync_queue (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      action TEXT NOT NULL,
      entity_type TEXT NOT NULL DEFAULT 'expense',
      expense_local_id INTEGER NOT NULL,
      payload TEXT NOT NULL DEFAULT '{}',
      synced INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);
  try {
    await db.executeSql(`ALTER TABLE sync_queue ADD COLUMN entity_type TEXT NOT NULL DEFAULT 'expense';`);
  } catch {
    // Column already exists — ignore
  }
}

export async function addToSyncQueue(
  action: SyncAction,
  localId: number,
  payload: Record<string, any> = {},
  entityType: SyncEntity = 'expense',
) {
  const db = await getDatabase();
  await db.executeSql(
    'INSERT INTO sync_queue (action, entity_type, expense_local_id, payload) VALUES (?, ?, ?, ?)',
    [action, entityType, localId, JSON.stringify(payload)],
  );
  // Dispara el flush inmediatamente — import dinámico para evitar dependencia circular
  import('../services/syncService').then(({ flushSyncQueue }) => {
    flushSyncQueue().catch(() => {});
  });
}

export async function getPendingSyncItems(): Promise<SyncQueueItem[]> {
  const db = await getDatabase();
  const [result] = await db.executeSql(
    'SELECT * FROM sync_queue WHERE synced = 0 ORDER BY id ASC',
  );
  const items: SyncQueueItem[] = [];
  for (let i = 0; i < result.rows.length; i++) {
    items.push(result.rows.item(i));
  }
  return items;
}

export async function markSynced(ids: number[]) {
  if (ids.length === 0) return;
  const db = await getDatabase();
  const placeholders = ids.map(() => '?').join(',');
  await db.executeSql(
    `UPDATE sync_queue SET synced = 1 WHERE id IN (${placeholders})`,
    ids,
  );
}
