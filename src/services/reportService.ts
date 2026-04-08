import RNFS from 'react-native-fs';
import Share from 'react-native-share';
import { FiscalRegime } from '../store/usePremiumStore';
import { Expense, ExpenseCategory } from '../types/expense';
import { calculateTaxSavings } from '../utils/taxSavings';

const REGIME_LABELS: Record<FiscalRegime, string> = {
  resico: 'RESICO',
  actividad_empresarial: 'Actividad Empresarial',
  no_facturo: 'Sin regimen',
};

function sanitize(value: string) {
  return `"${(value || '').replace(/"/g, '""')}"`;
}

export function generateFiscalReport(expenses: Expense[], regime: FiscalRegime) {
  const now = new Date();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const monthPrefix = `${now.getFullYear()}-${m}`;

  const monthExpenses = expenses.filter(e => e.date.startsWith(monthPrefix));
  const deductible = monthExpenses.filter(e => e.deductible);

  const byCategory: Record<string, { count: number; total: number; deductibleTotal: number }> = {};
  for (const e of monthExpenses) {
    if (!byCategory[e.category]) {
      byCategory[e.category] = { count: 0, total: 0, deductibleTotal: 0 };
    }
    byCategory[e.category].count++;
    byCategory[e.category].total += e.amount;
    if (e.deductible) {
      byCategory[e.category].deductibleTotal += e.amount;
    }
  }

  const savings = calculateTaxSavings(expenses, regime);

  return {
    month: monthPrefix,
    regime: REGIME_LABELS[regime],
    totalExpenses: monthExpenses.length,
    totalAmount: monthExpenses.reduce((s, e) => s + e.amount, 0),
    deductibleCount: deductible.length,
    deductibleAmount: savings.monthlyDeductible,
    estimatedSaving: savings.estimatedTaxSaving,
    yearToDate: savings.yearToDate,
    byCategory,
  };
}

export async function exportFiscalReportCsv(expenses: Expense[], regime: FiscalRegime) {
  const report = generateFiscalReport(expenses, regime);

  const lines: string[] = [];
  lines.push('Reporte Fiscal Mensual');
  lines.push(`Periodo,${report.month}`);
  lines.push(`Regimen,${report.regime}`);
  lines.push('');
  lines.push('Resumen');
  lines.push(`Total gastos,${report.totalExpenses}`);
  lines.push(`Monto total,$${report.totalAmount.toFixed(2)}`);
  lines.push(`Gastos deducibles,${report.deductibleCount}`);
  lines.push(`Monto deducible,$${report.deductibleAmount.toFixed(2)}`);
  lines.push(`Ahorro fiscal estimado,$${report.estimatedSaving.toFixed(2)}`);
  lines.push(`Ahorro acumulado anual,$${report.yearToDate.toFixed(2)}`);
  lines.push('');
  lines.push('Desglose por categoria');
  lines.push('Categoria,Cantidad,Total,Deducible');

  for (const [cat, data] of Object.entries(report.byCategory)) {
    lines.push(`${sanitize(cat)},${data.count},$${data.total.toFixed(2)},$${data.deductibleTotal.toFixed(2)}`);
  }

  const csv = lines.join('\n');
  const fileName = `reporte-fiscal-${report.month}.csv`;
  const fileUri = `${RNFS.CachesDirectoryPath}/${fileName}`;

  await RNFS.writeFile(fileUri, csv, 'utf8');
  await Share.open({
    url: `file://${fileUri}`,
    type: 'text/csv',
    filename: fileName,
  });
}
