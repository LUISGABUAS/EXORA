import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { IncomeType, PaymentMethod } from '../types/income';

export type RecurringFrequency = 'monthly' | 'weekly';

export interface RecurringIncome {
  id: string;
  description: string;
  amount: number;
  type: IncomeType;
  paymentMethod: PaymentMethod;
  invoiced: boolean;
  frequency: RecurringFrequency;
  dayOfMonth: number;   // 1-28, used when frequency === 'monthly'
  dayOfWeek: number;    // 0=Dom 1=Lun ... 6=Sáb, used when frequency === 'weekly'
  active: boolean;
  lastProcessed: string | null; // 'YYYY-MM' for monthly, 'YYYY-WW' for weekly
}

interface RecurringIncomeState {
  items: RecurringIncome[];
  loaded: boolean;
  hydrate: () => Promise<void>;
  add: (item: Omit<RecurringIncome, 'id' | 'lastProcessed'>) => Promise<void>;
  update: (id: string, patch: Partial<RecurringIncome>) => Promise<void>;
  remove: (id: string) => Promise<void>;
  markProcessed: (id: string, period: string) => Promise<void>;
  getDueItems: () => RecurringIncome[];
}

const KEY = '@exora_recurring_income';

function currentMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function currentWeek() {
  const d = new Date();
  const startOfYear = new Date(d.getFullYear(), 0, 1);
  const weekNum = Math.ceil(
    ((d.getTime() - startOfYear.getTime()) / 86400000 + startOfYear.getDay() + 1) / 7,
  );
  return `${d.getFullYear()}-W${String(weekNum).padStart(2, '0')}`;
}

function uuid() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export const useRecurringIncomeStore = create<RecurringIncomeState>((set, get) => ({
  items: [],
  loaded: false,

  hydrate: async () => {
    try {
      const raw = await AsyncStorage.getItem(KEY);
      const parsed: any[] = raw ? JSON.parse(raw) : [];
      // Backward compat: old items without frequency default to monthly
      const items: RecurringIncome[] = parsed.map(i => ({
        frequency: 'monthly' as RecurringFrequency,
        dayOfWeek: 1,
        ...i,
      }));
      set({ items, loaded: true });
    } catch {
      set({ loaded: true });
    }
  },

  add: async item => {
    const newItem: RecurringIncome = { ...item, id: uuid(), lastProcessed: null };
    const items = [...get().items, newItem];
    set({ items });
    await AsyncStorage.setItem(KEY, JSON.stringify(items));
  },

  update: async (id, patch) => {
    const items = get().items.map(i => (i.id === id ? { ...i, ...patch } : i));
    set({ items });
    await AsyncStorage.setItem(KEY, JSON.stringify(items));
  },

  remove: async id => {
    const items = get().items.filter(i => i.id !== id);
    set({ items });
    await AsyncStorage.setItem(KEY, JSON.stringify(items));
  },

  markProcessed: async (id, period) => {
    const items = get().items.map(i => (i.id === id ? { ...i, lastProcessed: period } : i));
    set({ items });
    await AsyncStorage.setItem(KEY, JSON.stringify(items));
  },

  getDueItems: () => {
    const today = new Date();
    const month = currentMonth();
    const week = currentWeek();
    const dayOfMonth = today.getDate();
    const dayOfWeek = today.getDay();
    return get().items.filter(i => {
      if (!i.active) return false;
      if (i.frequency === 'weekly') {
        return i.dayOfWeek === dayOfWeek && i.lastProcessed !== week;
      }
      return i.lastProcessed !== month && i.dayOfMonth <= dayOfMonth;
    });
  },
}));
