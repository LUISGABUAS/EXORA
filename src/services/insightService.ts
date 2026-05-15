import AsyncStorage from '@react-native-async-storage/async-storage';
import { Expense } from '../types/expense';
import { FiscalRegime } from '../store/usePremiumStore';
import { formatCurrency, localDateString } from '../utils/format';

export interface Insight {
  id: string;
  type: 'warning' | 'tip' | 'saving';
  icon: string;
  title: string;
  message: string;
  isPremium: boolean;
}

const AI_CACHE_KEY = '@expensia_ai_insights';
const AI_CACHE_TTL = 24 * 60 * 60 * 1000; // 24h

function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return localDateString(d);
}

/**
 * Genera insights locales basados en patrones de gastos (free).
 * Retorna max 2 para free, ilimitados para premium.
 */
export function generateLocalInsights(
  expenses: Expense[],
  _regime: FiscalRegime,
  isPremium: boolean,
): Insight[] {
  const insights: Insight[] = [];
  const now = new Date();
  const today = localDateString(now);
  const thirtyAgo = daysAgo(30);
  const sixtyAgo = daysAgo(60);

  const recent = expenses.filter(e => e.date >= thirtyAgo && e.date <= today);
  const previous = expenses.filter(e => e.date >= sixtyAgo && e.date < thirtyAgo);

  // 1. Category with biggest increase
  const recentByCat: Record<string, number> = {};
  const prevByCat: Record<string, number> = {};
  recent.forEach(e => {
    recentByCat[e.category] = (recentByCat[e.category] || 0) + e.amount;
  });
  previous.forEach(e => {
    prevByCat[e.category] = (prevByCat[e.category] || 0) + e.amount;
  });

  let maxIncrease = 0;
  let maxCat = '';
  for (const cat of Object.keys(recentByCat)) {
    const delta = (recentByCat[cat] || 0) - (prevByCat[cat] || 0);
    if (delta > maxIncrease) {
      maxIncrease = delta;
      maxCat = cat;
    }
  }
  if (maxCat && maxIncrease > 50) {
    insights.push({
      id: 'local_cat_increase',
      type: 'warning',
      icon: 'trending-up',
      title: `${maxCat} en aumento`,
      message: `Gastaste ${formatCurrency(maxIncrease)} más en ${maxCat.toLowerCase()} que el mes pasado.`,
      isPremium: false,
    });
  }

  // 2. Recurring expense detection (same amount ±10%, same description, >2 times)
  const descMap: Record<string, number[]> = {};
  recent.forEach(e => {
    const key = (e.description || e.merchantName || '').toLowerCase().trim();
    if (key) {
      if (!descMap[key]) descMap[key] = [];
      descMap[key].push(e.amount);
    }
  });
  for (const [key, amounts] of Object.entries(descMap)) {
    if (amounts.length >= 3) {
      const avg = amounts.reduce((s, a) => s + a, 0) / amounts.length;
      const allSimilar = amounts.every(a => Math.abs(a - avg) / avg < 0.1);
      if (allSimilar) {
        insights.push({
          id: `local_recurring_${key}`,
          type: 'tip',
          icon: 'repeat',
          title: 'Gasto recurrente detectado',
          message: `"${key}" aparece ${amounts.length} veces (~${formatCurrency(avg)} c/u). ¿Es una suscripción?`,
          isPremium: false,
        });
        break; // Only show first recurring
      }
    }
  }

  // 3. Day with highest spending
  const dayTotals: Record<string, number> = {};
  recent.forEach(e => {
    dayTotals[e.date] = (dayTotals[e.date] || 0) + e.amount;
  });
  let maxDay = '';
  let maxDayTotal = 0;
  for (const [day, total] of Object.entries(dayTotals)) {
    if (total > maxDayTotal) {
      maxDayTotal = total;
      maxDay = day;
    }
  }
  if (maxDay && maxDayTotal > 0) {
    const dayNames = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
    const d = new Date(maxDay + 'T12:00:00');
    const dayName = dayNames[d.getDay()];
    insights.push({
      id: 'local_max_day',
      type: 'tip',
      icon: 'calendar-alert',
      title: 'Día de mayor gasto',
      message: `Tu día más caro fue ${dayName} ${maxDay.slice(5)} con ${formatCurrency(maxDayTotal)}.`,
      isPremium: false,
    });
  }

  // 4. Deductible ratio (premium insight)
  const deductibleCount = recent.filter(e => e.deductible).length;
  const deductiblePct = recent.length > 0 ? (deductibleCount / recent.length) * 100 : 0;
  if (recent.length >= 5) {
    insights.push({
      id: 'local_deductible_ratio',
      type: 'saving',
      icon: 'percent-outline',
      title: 'Potencial de ahorro fiscal',
      message: `Solo ${deductiblePct.toFixed(0)}% de tus gastos son deducibles. Importa tus facturas XML para aumentar tu ahorro.`,
      isPremium: true,
    });
  }

  const limit = isPremium ? insights.length : 2;
  return insights.slice(0, limit);
}

const SUPABASE_URL = 'https://oxefxfwwwrdypjnbnzdy.supabase.co';
const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im94ZWZ4Znd3d3JkeXBqbmJuemR5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ5MjI2MzYsImV4cCI6MjA5MDQ5ODYzNn0.g3raLrkTnk9ZraNX5IVhrJ25HotfNuSuME7nAWtvT2c';

/**
 * Genera insights con IA (Claude Haiku) via Supabase Edge Function — solo premium.
 * La API key de Anthropic vive en el servidor, nunca en el cliente.
 */
export async function generateAIInsights(
  expenses: Expense[],
  regime: FiscalRegime,
  authToken: string,
): Promise<Insight[]> {
  // Check cache
  try {
    const cached = await AsyncStorage.getItem(AI_CACHE_KEY);
    if (cached) {
      const { insights, timestamp } = JSON.parse(cached);
      if (Date.now() - timestamp < AI_CACHE_TTL) {
        return insights;
      }
    }
  } catch {
    // continue
  }

  const now = new Date();
  const today = localDateString(now);
  const thirtyAgo = daysAgo(30);
  const recent = expenses.filter(e => e.date >= thirtyAgo && e.date <= today);

  if (recent.length < 3) return [];

  // Build anonymized summary (sin datos personales)
  const byCat: Record<string, number> = {};
  const byMerchant: Record<string, number> = {};
  let deductibleTotal = 0;
  let nonDeductibleTotal = 0;

  recent.forEach(e => {
    byCat[e.category] = (byCat[e.category] || 0) + e.amount;
    const merchant = e.merchantName || e.description || 'Otro';
    byMerchant[merchant] = (byMerchant[merchant] || 0) + e.amount;
    if (e.deductible) deductibleTotal += e.amount;
    else nonDeductibleTotal += e.amount;
  });

  const topMerchants = Object.entries(byMerchant)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([name, total]) => `${name}: $${total.toFixed(0)}`)
    .join(', ');

  const catSummary = Object.entries(byCat)
    .map(([cat, total]) => `${cat}: $${total.toFixed(0)}`)
    .join(', ');

  try {
    const response = await fetch(
      `${SUPABASE_URL}/functions/v1/ai-insights`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`,
          'apikey': SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({
          catSummary,
          topMerchants,
          deductibleTotal: deductibleTotal.toFixed(0),
          nonDeductibleTotal: nonDeductibleTotal.toFixed(0),
          totalExpenses: recent.length,
          regime,
        }),
      },
    );

    if (!response.ok) return [];

    const data = await response.json();
    const parsed: Array<{ type: string; title: string; message: string }> =
      data.insights || [];

    const ICONS: Record<string, string> = {
      warning: 'alert-circle-outline',
      tip: 'lightbulb-outline',
      saving: 'piggy-bank-outline',
    };

    const insights: Insight[] = parsed.map((item, idx) => ({
      id: `ai_${idx}`,
      type: (item.type as Insight['type']) || 'tip',
      icon: ICONS[item.type] || 'lightbulb-outline',
      title: item.title,
      message: item.message,
      isPremium: true,
    }));

    // Cache 24h
    await AsyncStorage.setItem(
      AI_CACHE_KEY,
      JSON.stringify({ insights, timestamp: Date.now() }),
    );

    return insights;
  } catch {
    return [];
  }
}
