import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { IncomeType, PaymentMethod } from '../types/income';

export interface RecurringIncome {
  id: string;
  description: string;
  amount: number;
  type: IncomeType;
  paymentMethod: PaymentMethod;
  invoiced: boolean;
  dayOfMonth: number;   // 1-28
  active: boolean;
  lastProcessed: string | null; // 'YYYY-MM'
}

interface RecurringIncomeState {
  items: RecurringIncome[];
  loaded: boolean;
  hydrate: () => Promise<void>;
  add: (item: Omit<RecurringIncome, 'id' | 'lastProcessed'>) => Promise<void>;
  update: (id: string, patch: Partial<RecurringIncome>) => Promise<void>;
  remove: (id: string) => Promise<void>;
  markProcessed: (id: string, month: string) => Promise<void>;
  getDueThisMonth: () => RecurringIncome[];
}

const KEY = '@exora_recurring_income';

function currentMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
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
      set({ items: raw ? JSON.parse(raw) : [], loaded: true });
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

  markProcessed: async (id, month) => {
    const items = get().items.map(i => (i.id === id ? { ...i, lastProcessed: month } : i));
    set({ items });
    await AsyncStorage.setItem(KEY, JSON.stringify(items));
  },

  getDueThisMonth: () => {
    const month = currentMonth();
    const day = new Date().getDate();
    return get().items.filter(
      i => i.active && i.lastProcessed !== month && i.dayOfMonth <= day,
    );
  },
}));
