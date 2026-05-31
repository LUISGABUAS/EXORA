import RNFS from 'react-native-fs';
import Share from 'react-native-share';
import { createExpense, getAllExpenses } from '../database/expenseRepository';
import { ExpenseInput } from '../types/expense';

interface BackupData {
  version: 1;
  exportedAt: string;
  expenses: any[];
}

export async function exportBackup(): Promise<void> {
  const expenses = await getAllExpenses();
  const data: BackupData = {
    version: 1,
    exportedAt: new Date().toISOString(),
    expenses,
  };
  const json = JSON.stringify(data, null, 2);
  const path = `${RNFS.DocumentDirectoryPath}/expensia_backup_${Date.now()}.json`;
  await RNFS.writeFile(path, json, 'utf8');
  await Share.open({
    url: `file://${path}`,
    type: 'application/json',
    filename: `expensia_backup_${new Date().toISOString().slice(0, 10)}.json`,
    title: 'Exportar backup Expensia',
  });
}

export async function importBackup(): Promise<{ imported: number; errors: number }> {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const DocumentPicker = require('react-native-document-picker').default;

  let result: any;
  try {
    result = await DocumentPicker.pickSingle({
      type: DocumentPicker.types.allFiles,
    });
  } catch (err: any) {
    if (
      DocumentPicker.isCancel(err) ||
      err?.code === 'DOCUMENT_PICKER_CANCELED' ||
      err?.message?.toLowerCase().includes('cancel') ||
      err?.nativeStackIOS?.some?.((f: string) => f?.includes('cancel')) ||
      (err?.domain === 'NSCocoaErrorDomain' && err?.code === 3072)
    ) {
      throw new Error('CANCELLED');
    }
    throw err;
  }

  const content = await RNFS.readFile(result.uri, 'utf8');
  let data: BackupData;
  try {
    data = JSON.parse(content);
  } catch {
    throw new Error('El archivo no es un JSON válido.');
  }

  if (data.version !== 1 || !Array.isArray(data.expenses)) {
    throw new Error('El archivo no parece un backup válido de Expensia.');
  }

  let imported = 0;
  let errors = 0;

  for (const raw of data.expenses) {
    try {
      const input: ExpenseInput = {
        amount: Number(raw.amount) || 0,
        date: raw.date ?? new Date().toISOString().slice(0, 10),
        category: raw.category ?? 'Otros',
        description: raw.description ?? '',
        merchantName: raw.merchantName ?? '',
        conceptsText: raw.conceptsText ?? '',
        ocrRawText: raw.ocrRawText ?? '',
        deductible: Boolean(raw.deductible),
        rfc: raw.rfc ?? '',
        usoCFDI: raw.usoCFDI ?? '',
        source: raw.source ?? 'manual',
        receiptImageUri: raw.receiptImageUri ?? '',
      };
      await createExpense(input);
      imported++;
    } catch {
      errors++;
    }
  }

  return { imported, errors };
}
