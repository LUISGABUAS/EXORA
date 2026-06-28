import { ExpenseCategory } from '../types/expense';
import { classifyExpense } from './classifier';
import { localDateString } from './format';

export interface SmartParseResult {
  amount: number | null;
  category: ExpenseCategory;
  description: string;
  date: string;
  confidence: 'high' | 'medium' | 'low';
  usedKnownPrice: boolean;
  merchantName: string;
}

interface KnownPrice {
  amount: number;
  category: ExpenseCategory;
}

const KNOWN_PRICES: Record<string, KnownPrice> = {
  netflix: { amount: 219, category: 'Entretenimiento' },
  spotify: { amount: 115, category: 'Entretenimiento' },
  'disney+': { amount: 179, category: 'Entretenimiento' },
  'disney plus': { amount: 179, category: 'Entretenimiento' },
  'hbo max': { amount: 149, category: 'Entretenimiento' },
  'youtube premium': { amount: 129, category: 'Entretenimiento' },
  'apple tv': { amount: 99, category: 'Entretenimiento' },
  'amazon prime': { amount: 99, category: 'Entretenimiento' },
};

const KNOWN_MERCHANTS: Array<[string, string]> = [
  ['uber eats', 'Uber Eats'],
  ['rappi', 'Rappi'],
  ['didi food', 'DiDi Food'],
  ['didi', 'DiDi'],
  ['uber', 'Uber'],
  ['oxxo', 'OXXO'],
  ['seven eleven', '7-Eleven'],
  ['7 eleven', '7-Eleven'],
  ['7eleven', '7-Eleven'],
  ['starbucks', 'Starbucks'],
  ['mcdonalds', 'McDonald\'s'],
  ['burger king', 'Burger King'],
  ['dominos', 'Domino\'s'],
  ['subway', 'Subway'],
  ['walmart', 'Walmart'],
  ['soriana', 'Soriana'],
  ['chedraui', 'Chedraui'],
  ['costco', 'Costco'],
  ['sams', 'Sam\'s Club'],
  ['sam\'s', 'Sam\'s Club'],
  ['liverpool', 'Liverpool'],
  ['elektra', 'Elektra'],
  ['cinepolis', 'Cinepolis'],
  ['cinemex', 'Cinemex'],
  ['farmacia guadalajara', 'Farmacia Guadalajara'],
  ['farmacias similares', 'Farmacias Similares'],
  ['coppel', 'Coppel'],
  ['mercado libre', 'Mercado Libre'],
  ['amazon', 'Amazon'],
  ['telcel', 'Telcel'],
  ['telmex', 'Telmex'],
  ['italiannis', 'Italianni\'s'],
  ['vips', 'VIPS'],
  ['sanborns', 'Sanborns'],
  ['bodega aurrera', 'Bodega Aurrera'],
  ['la comer', 'La Comer'],
  ['office depot', 'Office Depot'],
  ['home depot', 'Home Depot'],
  ['mix up', 'MixUp'],
  ['totalplay', 'TotalPlay'],
  ['izzi', 'izzi'],
  ['cabify', 'Cabify'],
  ['cornershop', 'Cornershop'],
];

function lookupMerchant(text: string): string {
  const normalized = normalizeText(text);
  for (const [key, canonical] of KNOWN_MERCHANTS) {
    if (normalized.includes(key)) {
      return canonical;
    }
  }
  return '';
}

const DAY_NAMES: Record<string, number> = {
  domingo: 0,
  lunes: 1,
  martes: 2,
  miercoles: 3,
  jueves: 4,
  viernes: 5,
  sabado: 6,
};

function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

function subDays(date: Date, n: number): Date {
  const result = new Date(date.getFullYear(), date.getMonth(), date.getDate() - n);
  return result;
}

function lastWeekday(now: Date, targetDay: number): Date {
  const currentDay = now.getDay();
  let diff = currentDay - targetDay;
  if (diff <= 0) diff += 7;
  return subDays(now, diff);
}

function extractAmount(text: string): { amount: number | null; remaining: string } {
  const match = text.match(/(\d{1,3}(?:,\d{3})+(?:\.\d{1,2})?|\d+(?:\.\d{1,2})?)/);
  if (!match) return { amount: null, remaining: text };

  const raw = match[1].replace(/,/g, '');
  const amount = parseFloat(raw);
  if (isNaN(amount) || amount <= 0) return { amount: null, remaining: text };

  const remaining = text.slice(0, match.index) + text.slice(match.index! + match[0].length);
  return { amount, remaining };
}

function extractDate(text: string, now: Date): { date: string; remaining: string } {
  const normalized = normalizeText(text);

  const dateKeywords: Array<{ pattern: RegExp; resolver: () => Date }> = [
    { pattern: /\bantier\b/, resolver: () => subDays(now, 2) },
    { pattern: /\banteayer\b/, resolver: () => subDays(now, 2) },
    { pattern: /\bayer\b/, resolver: () => subDays(now, 1) },
    { pattern: /\bhoy\b/, resolver: () => now },
  ];

  for (const { pattern, resolver } of dateKeywords) {
    const match = normalized.match(pattern);
    if (match) {
      const remaining = text.slice(0, match.index) + text.slice(match.index! + match[0].length);
      return { date: localDateString(resolver()), remaining };
    }
  }

  for (const [dayName, dayNum] of Object.entries(DAY_NAMES)) {
    const pattern = new RegExp(`\\b${dayName}\\b`);
    const match = normalized.match(pattern);
    if (match) {
      const remaining = text.slice(0, match.index) + text.slice(match.index! + match[0].length);
      return { date: localDateString(lastWeekday(now, dayNum)), remaining };
    }
  }

  return { date: localDateString(now), remaining: text };
}

function lookupKnownPrice(description: string): KnownPrice | null {
  const normalized = normalizeText(description);
  for (const [key, value] of Object.entries(KNOWN_PRICES)) {
    if (normalized.includes(key)) {
      return value;
    }
  }
  return null;
}

export function parseSmartInput(text: string): SmartParseResult {
  const now = new Date();

  if (!text || !text.trim()) {
    return {
      amount: null,
      category: 'Otros',
      description: '',
      date: localDateString(now),
      confidence: 'low',
      usedKnownPrice: false,
      merchantName: '',
    };
  }

  let working = normalizeText(text);

  const { amount: extractedAmount, remaining: afterAmount } = extractAmount(working);
  working = afterAmount;

  const { date, remaining: afterDate } = extractDate(working, now);
  working = afterDate;

  const description = working.replace(/\s+/g, ' ').trim();

  let finalAmount = extractedAmount;
  let usedKnownPrice = false;
  let category: ExpenseCategory;

  const knownPrice = lookupKnownPrice(description);
  if (finalAmount === null && knownPrice) {
    finalAmount = knownPrice.amount;
    category = knownPrice.category;
    usedKnownPrice = true;
  } else {
    category = classifyExpense(description);
    if (knownPrice && category === 'Otros') {
      category = knownPrice.category;
    }
  }

  let confidence: 'high' | 'medium' | 'low';
  if (finalAmount !== null && category !== 'Otros') {
    confidence = 'high';
  } else if (finalAmount !== null || usedKnownPrice) {
    confidence = 'medium';
  } else {
    confidence = 'low';
  }

  const merchantName = lookupMerchant(description) || lookupMerchant(text);

  return {
    amount: finalAmount,
    category,
    description,
    date,
    confidence,
    usedKnownPrice,
    merchantName,
  };
}
