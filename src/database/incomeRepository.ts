import { getDatabase } from './db';
import { Income, IncomeInput } from '../types/income';

function normalizeIncome(row: any): Income {
  return {
    id: row.id,
    amount: row.amount,
    date: row.date,
    type: row.type,
    description: row.description ?? '',
    invoiced: Boolean(row.invoiced),
    createdAt: row.createdAt,
  };
}

export async function getAllIncomes(): Promise<Income[]> {
  const db = await getDatabase();
  const [results] = await db.executeSql(
    'SELECT id, amount, date, type, description, invoiced, createdAt FROM incomes ORDER BY date DESC, id DESC;',
  );
  const incomes: Income[] = [];
  for (let i = 0; i < results.rows.length; i++) {
    incomes.push(normalizeIncome(results.rows.item(i)));
  }
  return incomes;
}

export async function createIncome(income: IncomeInput): Promise<number> {
  const db = await getDatabase();
  const createdAt = new Date().toISOString();
  const [result] = await db.executeSql(
    `INSERT INTO incomes (amount, date, type, description, invoiced, createdAt)
     VALUES (?, ?, ?, ?, ?, ?);`,
    [income.amount, income.date, income.type, income.description, income.invoiced ? 1 : 0, createdAt],
  );
  return result.insertId;
}

export async function updateIncome(id: number, income: IncomeInput): Promise<void> {
  const db = await getDatabase();
  await db.executeSql(
    `UPDATE incomes SET amount=?, date=?, type=?, description=?, invoiced=? WHERE id=?;`,
    [income.amount, income.date, income.type, income.description, income.invoiced ? 1 : 0, id],
  );
}

export async function deleteIncome(id: number): Promise<void> {
  const db = await getDatabase();
  await db.executeSql('DELETE FROM incomes WHERE id=?;', [id]);
}
