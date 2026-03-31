import { getDatabase } from './db';

export type SyncAction = 'insert' | 'update' | 'delete';

export interface SyncQueueItem {
  id: number;
  action: SyncAction;
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
      expense_local_id INTEGER NOT NULL,
      payload TEXT NOT NULL DEFAULT '{}',
      synced INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);
}

export async function addToSyncQueue(
  action: SyncAction,
  expenseLocalId: number,
  payload: Record<string, any> = {},
) {
  const db = await getDatabase();
  await db.executeSql(
    'INSERT INTO sync_queue (action, expense_local_id, payload) VALUES (?, ?, ?)',
    [action, expenseLocalId, JSON.stringify(payload)],
  );
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
