import AsyncStorage from '@react-native-async-storage/async-storage';

export const SUPPORTED_CURRENCIES = ['MXN', 'USD', 'EUR', 'CAD', 'GBP'] as const;
export type Currency = (typeof SUPPORTED_CURRENCIES)[number];

export const CURRENCY_SYMBOLS: Record<Currency, string> = {
  MXN: '$',
  USD: 'US$',
  EUR: '€',
  CAD: 'C$',
  GBP: '£',
};

export const CURRENCY_NAMES: Record<Currency, string> = {
  MXN: 'Peso Mexicano',
  USD: 'Dólar Estadounidense',
  EUR: 'Euro',
  CAD: 'Dólar Canadiense',
  GBP: 'Libra Esterlina',
};

const CACHE_KEY = '@exora_exchange_rates';
const CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6 hours

interface CachedRates {
  rates: Record<Currency, number>;
  fetchedAt: number;
}

// Fallback rates (MXN per 1 unit of foreign currency)
const FALLBACK_RATES: Record<Currency, number> = {
  MXN: 1,
  USD: 17.5,
  EUR: 18.9,
  CAD: 12.8,
  GBP: 22.1,
};

export async function getExchangeRates(): Promise<Record<Currency, number>> {
  try {
    const raw = await AsyncStorage.getItem(CACHE_KEY);
    if (raw) {
      const cached: CachedRates = JSON.parse(raw);
      const age = Date.now() - cached.fetchedAt;
      if (age < CACHE_TTL_MS) {
        return cached.rates;
      }
    }
  } catch {
    // Cache miss or parse error — continue to fetch
  }

  try {
    // Fetch rates with MXN as base; the API returns how many MXN per 1 USD, etc.
    const res = await fetch('https://open.er-api.com/v6/latest/MXN', {
      method: 'GET',
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    if (json.result !== 'success') throw new Error('API error');

    // json.rates are: 1 MXN = X foreign currency
    // We want: 1 foreign = Y MXN, i.e. invert the rate
    const apiRates: Record<string, number> = json.rates;
    const rates: Record<Currency, number> = { MXN: 1 } as Record<Currency, number>;
    for (const cur of SUPPORTED_CURRENCIES) {
      if (cur === 'MXN') continue;
      const mxnPerForeign = apiRates[cur] ? 1 / apiRates[cur] : FALLBACK_RATES[cur];
      rates[cur] = mxnPerForeign;
    }

    const cached: CachedRates = { rates, fetchedAt: Date.now() };
    await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(cached));
    return rates;
  } catch {
    // Network error — return fallback
    return FALLBACK_RATES;
  }
}

export async function convertToMXN(amount: number, fromCurrency: Currency): Promise<number> {
  if (fromCurrency === 'MXN') return amount;
  const rates = await getExchangeRates();
  return amount * (rates[fromCurrency] ?? FALLBACK_RATES[fromCurrency]);
}
