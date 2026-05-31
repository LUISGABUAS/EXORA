import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';

export interface SavingsGoal {
  id: string;
  title: string;
  targetAmount: number;
  currentAmount: number;
  emoji: string;
  deadline: string | null; // YYYY-MM-DD
  createdAt: string;
  completed: boolean;
}

interface SavingsState {
  goals: SavingsGoal[];
  loaded: boolean;
  hydrate: () => Promise<void>;
  add: (goal: Omit<SavingsGoal, 'id' | 'createdAt' | 'completed' | 'currentAmount'>) => Promise<void>;
  deposit: (id: string, amount: number) => Promise<void>;
  withdraw: (id: string, amount: number) => Promise<void>;
  remove: (id: string) => Promise<void>;
  update: (id: string, patch: Partial<SavingsGoal>) => Promise<void>;
}

const KEY = '@expensia_savings_goals';

function uuid() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

async function persist(goals: SavingsGoal[]) {
  await AsyncStorage.setItem(KEY, JSON.stringify(goals));
}

export const useSavingsStore = create<SavingsState>((set, get) => ({
  goals: [],
  loaded: false,

  hydrate: async () => {
    try {
      const raw = await AsyncStorage.getItem(KEY);
      set({ goals: raw ? JSON.parse(raw) : [], loaded: true });
    } catch {
      set({ loaded: true });
    }
  },

  add: async goal => {
    const newGoal: SavingsGoal = {
      ...goal,
      id: uuid(),
      currentAmount: 0,
      completed: false,
      createdAt: new Date().toISOString().slice(0, 10),
    };
    const goals = [...get().goals, newGoal];
    set({ goals });
    await persist(goals);
  },

  deposit: async (id, amount) => {
    const goals = get().goals.map(g => {
      if (g.id !== id) return g;
      const next = Math.min(g.currentAmount + amount, g.targetAmount);
      return { ...g, currentAmount: next, completed: next >= g.targetAmount };
    });
    set({ goals });
    await persist(goals);
  },

  withdraw: async (id, amount) => {
    const goals = get().goals.map(g => {
      if (g.id !== id) return g;
      const next = Math.max(g.currentAmount - amount, 0);
      return { ...g, currentAmount: next, completed: false };
    });
    set({ goals });
    await persist(goals);
  },

  remove: async id => {
    const goals = get().goals.filter(g => g.id !== id);
    set({ goals });
    await persist(goals);
  },

  update: async (id, patch) => {
    const goals = get().goals.map(g => (g.id === id ? { ...g, ...patch } : g));
    set({ goals });
    await persist(goals);
  },
}));
