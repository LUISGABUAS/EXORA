import RNFS from 'react-native-fs';
import Share from 'react-native-share';
import { Expense } from '../types/expense';
import { formatCurrency, formatDate } from '../utils/format';

const CATEGORY_COLORS: Record<string, string> = {
  Comida: '#22C55E',
  Transporte: '#3B82F6',
  Entretenimiento: '#F59E0B',
  Salud: '#EF4444',
  Educacion: '#8B5CF6',
  Otros: '#8E8E93',
};

function buildHtml(expenses: Expense[], month: string): string {
  const total = expenses.reduce((s, e) => s + e.amount, 0);
  const deductible = expenses.filter(e => e.deductible).reduce((s, e) => s + e.amount, 0);
  const nonDeductible = total - deductible;

  const rows = expenses
    .map(e => {
      const catColor = CATEGORY_COLORS[e.category] ?? '#8E8E93';
      return `
        <tr>
          <td>${formatDate(e.date)}</td>
          <td>${escapeHtml(e.merchantName || e.description || '—')}</td>
          <td><span class="cat-badge" style="background:${catColor}20;color:${catColor}">${escapeHtml(e.category)}</span></td>
          <td class="amount">${formatCurrency(e.amount)}</td>
          <td class="center">${e.deductible ? '<span class="badge-yes">Sí</span>' : '<span class="badge-no">No</span>'}</td>
        </tr>`;
    })
    .join('');

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Reporte Expensia — ${escapeHtml(month)}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #F5F5F7; color: #1A1A1A; }
    .header { background: #0A0A0A; padding: 32px 24px; }
    .header-title { color: #22C55E; font-size: 28px; font-weight: 800; letter-spacing: -0.5px; }
    .header-sub { color: #8E8E93; font-size: 14px; margin-top: 4px; }
    .header-month { color: #FFFFFF; font-size: 20px; font-weight: 700; margin-top: 12px; }
    .body { padding: 24px; max-width: 960px; margin: 0 auto; }
    .summary { display: flex; gap: 16px; margin-bottom: 24px; flex-wrap: wrap; }
    .card { background: #FFFFFF; border-radius: 16px; padding: 20px 24px; flex: 1; min-width: 180px; border: 1px solid #E5E5EA; }
    .card-label { font-size: 12px; font-weight: 600; color: #8E8E93; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 6px; }
    .card-value { font-size: 24px; font-weight: 800; }
    .card-value.green { color: #22C55E; }
    .card-value.blue { color: #3B82F6; }
    .card-value.red { color: #EF4444; }
    .section-title { font-size: 16px; font-weight: 700; margin-bottom: 12px; }
    table { width: 100%; border-collapse: collapse; background: #FFFFFF; border-radius: 16px; overflow: hidden; border: 1px solid #E5E5EA; }
    th { background: #F5F5F7; padding: 12px 14px; text-align: left; font-size: 12px; font-weight: 700; color: #8E8E93; text-transform: uppercase; letter-spacing: 0.4px; }
    td { padding: 12px 14px; font-size: 14px; border-top: 1px solid #F0F0F2; vertical-align: middle; }
    .amount { font-weight: 700; text-align: right; }
    .center { text-align: center; }
    tr:hover td { background: #F9F9FB; }
    .cat-badge { display: inline-block; padding: 3px 10px; border-radius: 999px; font-size: 12px; font-weight: 600; }
    .badge-yes { display: inline-block; padding: 3px 10px; border-radius: 999px; font-size: 12px; font-weight: 700; background: #22C55E20; color: #22C55E; }
    .badge-no { display: inline-block; padding: 3px 10px; border-radius: 999px; font-size: 12px; font-weight: 700; background: #EF444420; color: #EF4444; }
    .footer { margin-top: 32px; text-align: center; color: #8E8E93; font-size: 12px; padding-bottom: 32px; }
    @media print { body { background: #FFFFFF; } }
  </style>
</head>
<body>
  <div class="header">
    <div class="header-title">EXPENSIA</div>
    <div class="header-sub">Reporte mensual de gastos</div>
    <div class="header-month">${escapeHtml(month)}</div>
  </div>
  <div class="body">
    <div class="summary">
      <div class="card">
        <div class="card-label">Total gastado</div>
        <div class="card-value">${formatCurrency(total)}</div>
      </div>
      <div class="card">
        <div class="card-label">Deducible</div>
        <div class="card-value green">${formatCurrency(deductible)}</div>
      </div>
      <div class="card">
        <div class="card-label">No deducible</div>
        <div class="card-value red">${formatCurrency(nonDeductible)}</div>
      </div>
      <div class="card">
        <div class="card-label">Transacciones</div>
        <div class="card-value blue">${expenses.length}</div>
      </div>
    </div>

    <div class="section-title">Detalle de gastos</div>
    ${
      expenses.length > 0
        ? `<table>
      <thead>
        <tr>
          <th>Fecha</th>
          <th>Comercio / Descripción</th>
          <th>Categoría</th>
          <th style="text-align:right">Monto</th>
          <th style="text-align:center">Deducible</th>
        </tr>
      </thead>
      <tbody>
        ${rows}
      </tbody>
    </table>`
        : '<p style="color:#8E8E93;margin-top:8px;">Sin gastos registrados para este período.</p>'
    }

    <div class="footer">
      Generado por Expensia · ${new Date().toLocaleDateString('es-MX', { day: '2-digit', month: 'long', year: 'numeric' })}
    </div>
  </div>
</body>
</html>`;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export async function exportMonthlyReport(
  expenses: Expense[],
  month: string,
): Promise<void> {
  const html = buildHtml(expenses, month);
  const filename = `expensia_reporte_${month.replace(/\s/g, '_').toLowerCase()}.html`;
  const path = `${RNFS.DocumentDirectoryPath}/${filename}`;
  await RNFS.writeFile(path, html, 'utf8');
  await Share.open({
    url: `file://${path}`,
    type: 'text/html',
    filename,
    title: `Reporte Expensia — ${month}`,
  });
}
