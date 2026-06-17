import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { ExpenseCategory } from '../types/expense';

export interface RecurringExpense {
  id: string;
  description: string;
  amount: number;
  category: ExpenseCategory;
  merchantName: string;
  dayOfMonth: number; // 1-28
  active: boolean;
  lastProcessed: string | null; // 'YYYY-MM' del último mes procesado
  deductible: boolean;
}

interface RecurringState {
  items: RecurringExpense[];
  loaded: boolean;
  hydrate: () => Promise<void>;
  add: (item: Omit<RecurringExpense, 'id' | 'lastProcessed'>) => Promise<void>;
  update: (id: string, patch: Partial<RecurringExpense>) => Promise<void>;
  remove: (id: string) => Promise<void>;
  markProcessed: (id: string, month: string) => Promise<void>;
  getDueThisMonth: () => RecurringExpense[];
}

const KEY = '@exora_recurring';

function currentMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function todayDay() {
  return new Date().getDate();
}

function uuid() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export const useRecurringStore = create<RecurringState>((set, get) => ({
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
    const newItem: RecurringExpense = { ...item, id: uuid(), lastProcessed: null };
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
    const day = todayDay();
    return get().items.filter(
      i => i.active && i.lastProcessed !== month && i.dayOfMonth <= day,
    );
  },
}));
