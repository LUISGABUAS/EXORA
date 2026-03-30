import RNFS from 'react-native-fs';
import Share from 'react-native-share';
import { Expense } from '../types/expense';

function sanitizeCsv(value: string) {
  return `"${(value || '').replace(/"/g, '""')}"`;
}

export async function exportExpensesToCsv(expenses: Expense[]) {
  const header = ['id', 'fecha', 'monto', 'categoria', 'comercio', 'descripcion', 'deducible', 'rfc', 'usoCFDI', 'origen'];

  const rows = expenses.map((e) =>
    [
      e.id,
      e.date,
      e.amount,
      e.category,
      sanitizeCsv(e.merchantName),
      sanitizeCsv(e.description),
      e.deductible ? 'Si' : 'No',
      e.rfc,
      e.usoCFDI,
      e.source,
    ].join(','),
  );

  const csv = [header.join(','), ...rows].join('\n');
  const fileUri = `${RNFS.CachesDirectoryPath}/smartexpense-mx.csv`;

  await RNFS.writeFile(fileUri, csv, 'utf8');

  await Share.open({
    url: `file://${fileUri}`,
    type: 'text/csv',
    filename: 'smartexpense-mx.csv',
  });
}
