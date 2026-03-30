import { getDatabase } from './db';
import { Expense, ExpenseInput } from '../types/expense';

function normalizeExpense(row: any): Expense {
  return {
    id: row.id,
    amount: row.amount,
    date: row.date,
    category: row.category,
    description: row.description ?? '',
    merchantName: row.merchantName ?? '',
    conceptsText: row.conceptsText ?? '',
    ocrRawText: row.ocrRawText ?? '',
    deductible: Boolean(row.deductible),
    rfc: row.rfc ?? '',
    usoCFDI: row.usoCFDI ?? '',
    source: row.source,
    createdAt: row.createdAt,
  };
}

export async function getAllExpenses(): Promise<Expense[]> {
  const db = await getDatabase();
  const [results] = await db.executeSql('SELECT * FROM expenses ORDER BY date DESC, id DESC;');
  const expenses: Expense[] = [];
  for (let i = 0; i < results.rows.length; i++) {
    expenses.push(normalizeExpense(results.rows.item(i)));
  }
  return expenses;
}

export async function getExpenseById(id: number): Promise<Expense | null> {
  const db = await getDatabase();
  const [results] = await db.executeSql('SELECT * FROM expenses WHERE id = ?;', [id]);
  if (results.rows.length === 0) {
    return null;
  }
  return normalizeExpense(results.rows.item(0));
}

export async function createExpense(expense: ExpenseInput): Promise<void> {
  const db = await getDatabase();
  const createdAt = new Date().toISOString();
  await db.executeSql(
    `INSERT INTO expenses
      (amount, date, category, description, merchantName, conceptsText, ocrRawText, deductible, rfc, usoCFDI, source, createdAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
    [
      expense.amount,
      expense.date,
      expense.category,
      expense.description,
      expense.merchantName,
      expense.conceptsText,
      expense.ocrRawText,
      expense.deductible ? 1 : 0,
      expense.rfc,
      expense.usoCFDI,
      expense.source,
      createdAt,
    ],
  );
}

export async function updateExpense(id: number, expense: ExpenseInput): Promise<void> {
  const db = await getDatabase();
  await db.executeSql(
    `UPDATE expenses SET
      amount = ?, date = ?, category = ?, description = ?, merchantName = ?,
      conceptsText = ?, ocrRawText = ?, deductible = ?, rfc = ?, usoCFDI = ?, source = ?
      WHERE id = ?;`,
    [
      expense.amount,
      expense.date,
      expense.category,
      expense.description,
      expense.merchantName,
      expense.conceptsText,
      expense.ocrRawText,
      expense.deductible ? 1 : 0,
      expense.rfc,
      expense.usoCFDI,
      expense.source,
      id,
    ],
  );
}

export async function deleteExpense(id: number): Promise<void> {
  const db = await getDatabase();
  await db.executeSql('DELETE FROM expenses WHERE id = ?;', [id]);
}
