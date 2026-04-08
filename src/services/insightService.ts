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
      message: `Gastaste ${formatCurrency(maxIncrease)} mas en ${maxCat.toLowerCase()} que el mes pasado.`,
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
          message: `"${key}" aparece ${amounts.length} veces (~${formatCurrency(avg)} c/u). ¿Es una suscripcion?`,
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
    const dayNames = ['Domingo', 'Lunes', 'Martes', 'Miercoles', 'Jueves', 'Viernes', 'Sabado'];
    const d = new Date(maxDay + 'T12:00:00');
    const dayName = dayNames[d.getDay()];
    insights.push({
      id: 'local_max_day',
      type: 'tip',
      icon: 'calendar-alert',
      title: 'Dia de mayor gasto',
      message: `Tu dia mas caro fue ${dayName} ${maxDay.slice(5)} con ${formatCurrency(maxDayTotal)}.`,
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

/**
 * Genera insights con IA (Claude Haiku) — solo premium + online.
 */
export async function generateAIInsights(
  expenses: Expense[],
  regime: FiscalRegime,
  apiKey: string,
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

  // Build anonymized summary
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

  const prompt = `Eres un asesor financiero mexicano. Analiza estos gastos y da 2-3 recomendaciones practicas en JSON.

Regimen fiscal: ${regime}
Gastos ultimos 30 dias por categoria: ${catSummary}
Top comercios: ${topMerchants}
Deducibles: $${deductibleTotal.toFixed(0)}, No deducibles: $${nonDeductibleTotal.toFixed(0)}
Total gastos: ${recent.length}

Responde SOLO con un array JSON:
[{"type":"tip|warning|saving","title":"titulo corto","message":"recomendacion practica de max 80 chars"}]`;

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 512,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (!response.ok) return [];

    const data = await response.json();
    const text = data.content?.[0]?.text || '';

    // Extract JSON array from response
    const match = text.match(/\[[\s\S]*\]/);
    if (!match) return [];

    const parsed: Array<{ type: string; title: string; message: string }> = JSON.parse(match[0]);

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

    // Cache
    await AsyncStorage.setItem(
      AI_CACHE_KEY,
      JSON.stringify({ insights, timestamp: Date.now() }),
    );

    return insights;
  } catch {
    return [];
  }
}
