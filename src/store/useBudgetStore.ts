import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';

// BudgetMap ahora acepta cualquier string como categoría (built-in + personalizadas)
export type BudgetMap = Record<string, number>;

interface BudgetState {
  budgets: BudgetMap;
  loaded: boolean;
  hydrate: () => Promise<void>;
  setBudget: (category: string, amount: number) => Promise<void>;
  clearBudget: (category: string) => Promise<void>;
}

const STORAGE_KEY = '@exora_budgets';

export const useBudgetStore = create<BudgetState>((set, get) => ({
  budgets: {},
  loaded: false,

  hydrate: async () => {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      const budgets: BudgetMap = raw ? JSON.parse(raw) : {};
      set({ budgets, loaded: true });
    } catch {
      set({ loaded: true });
    }
  },

  setBudget: async (category, amount) => {
    const budgets = { ...get().budgets, [category]: amount };
    set({ budgets });
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(budgets));
  },

  clearBudget: async category => {
    const budgets = { ...get().budgets };
    delete budgets[category];
    set({ budgets });
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(budgets));
  },
}));
