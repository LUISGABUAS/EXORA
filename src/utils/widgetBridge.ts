import { NativeModules, Platform } from 'react-native';
import { Expense } from '../types/expense';
import { Income } from '../types/income';
import { localDateString } from './format';

const { WidgetDataBridge } = NativeModules;

function formatTime(createdAt: string): string {
  const now = new Date();
  const todayStr = localDateString(now);
  const yesterdayStr = localDateString(
    new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1),
  );
  const dateStr = createdAt.slice(0, 10);
  const timePart = createdAt.slice(11, 16);
  const [hStr, mStr] = timePart.split(':');
  const h = parseInt(hStr || '0', 10);
  const m = mStr || '00';
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  if (dateStr === todayStr) return `Hoy ${h12}:${m} ${ampm}`;
  if (dateStr === yesterdayStr) return 'Ayer';
  return dateStr.slice(5).replace('-', '/');
}

export function syncWidgetData(expenses: Expense[], incomes: Income[]) {
  if (Platform.OS !== 'ios') return;
  if (!WidgetDataBridge?.updateWidgetData) {
    if (__DEV__) console.warn('[Widget] WidgetDataBridge no disponible — el native module no está cargado');
    return;
  }

  const now = new Date();
  const monthPrefix = localDateString(now).slice(0, 7);
  const todayStr = localDateString(now);

  const monthExpenses = expenses.filter(e => e.date.startsWith(monthPrefix));
  const monthTotal = monthExpenses.reduce((sum, e) => sum + e.amount, 0);

  const monthIncome = incomes
    .filter(i => i.date.startsWith(monthPrefix))
    .reduce((sum, i) => sum + i.amount, 0);

  const dayTotal = expenses
    .filter(e => e.date.startsWith(todayStr))
    .reduce((sum, e) => sum + e.amount, 0);

  const balance = monthIncome - monthTotal;

  // Top category this month
  const categoryTotals: Record<string, number> = {};
  for (const e of monthExpenses) {
    categoryTotals[e.category] = (categoryTotals[e.category] ?? 0) + e.amount;
  }
  const topCategory =
    Object.entries(categoryTotals).sort((a, b) => b[1] - a[1])[0]?.[0] ??
    'Otros';

  // Last 4 expenses
  const lastExpenses = [...expenses]
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 4)
    .map(e => ({
      amount: e.amount,
      category: e.category,
      description: e.description || e.merchantName || e.category,
      time: formatTime(e.createdAt),
    }));

  // Weekly totals (Mon–Sun of current week)
  const weeklyTotals: number[] = [0, 0, 0, 0, 0, 0, 0];
  const startOfWeek = new Date(now);
  const day = now.getDay(); // 0=Sun
  const diffToMonday = (day + 6) % 7;
  startOfWeek.setDate(now.getDate() - diffToMonday);
  startOfWeek.setHours(0, 0, 0, 0);

  for (const e of expenses) {
    const expDate = new Date(e.date + 'T00:00:00');
    if (expDate >= startOfWeek) {
      const diff = Math.floor(
        (expDate.getTime() - startOfWeek.getTime()) / 86400000,
      );
      if (diff >= 0 && diff < 7) weeklyTotals[diff] += e.amount;
    }
  }

  const payload = {
    monthTotal,
    monthIncome,
    dayTotal,
    balance,
    topCategory,
    lastExpenses,
    weeklyTotals,
    updatedAt: now.toISOString(),
  };

  WidgetDataBridge.updateWidgetData(JSON.stringify(payload));
}
