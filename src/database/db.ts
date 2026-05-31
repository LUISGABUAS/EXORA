import SQLite, { SQLiteDatabase } from 'react-native-sqlite-storage';
import { initSyncQueue } from './syncQueue';

SQLite.enablePromise(true);

let dbInstance: SQLiteDatabase | null = null;

export async function getDatabase(): Promise<SQLiteDatabase> {
  if (dbInstance) {
    return dbInstance;
  }
  dbInstance = await SQLite.openDatabase({ name: 'smartexpense-mx.db', location: 'default' });
  return dbInstance;
}

export async function initDatabase() {
  const db = await getDatabase();
  await db.executeSql(`
    CREATE TABLE IF NOT EXISTS expenses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      amount REAL NOT NULL,
      date TEXT NOT NULL,
      category TEXT NOT NULL,
      description TEXT DEFAULT '',
      merchantName TEXT DEFAULT '',
      conceptsText TEXT DEFAULT '',
      ocrRawText TEXT DEFAULT '',
      deductible INTEGER DEFAULT 0,
      rfc TEXT DEFAULT '',
      usoCFDI TEXT DEFAULT '',
      source TEXT NOT NULL,
      createdAt TEXT NOT NULL,
      receiptImageUri TEXT DEFAULT ''
    );
  `);
  // Migration: add receiptImageUri if it doesn't exist yet
  try {
    await db.executeSql(`ALTER TABLE expenses ADD COLUMN receiptImageUri TEXT DEFAULT '';`);
  } catch {
    // Column already exists — ignore
  }
  await db.executeSql(`
    CREATE TABLE IF NOT EXISTS incomes (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      amount        REAL    NOT NULL,
      date          TEXT    NOT NULL,
      type          TEXT    NOT NULL,
      description   TEXT    DEFAULT '',
      invoiced      INTEGER DEFAULT 0,
      recurring     INTEGER DEFAULT 0,
      paymentMethod TEXT    DEFAULT 'transferencia',
      createdAt     TEXT    NOT NULL
    );
  `);
  try { await db.executeSql(`ALTER TABLE incomes ADD COLUMN recurring INTEGER DEFAULT 0;`); } catch {}
  try { await db.executeSql(`ALTER TABLE incomes ADD COLUMN paymentMethod TEXT DEFAULT 'transferencia';`); } catch {}
  await initSyncQueue();
}
