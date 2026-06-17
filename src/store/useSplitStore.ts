import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';

export interface SplitParticipant {
  name: string;
  amount: number;  // their share
  paid: boolean;
}

export interface SplitExpense {
  id: string;
  description: string;
  totalAmount: number;
  date: string;        // YYYY-MM-DD
  participants: SplitParticipant[];
  createdAt: string;
}

interface SplitState {
  splits: SplitExpense[];
  loaded: boolean;
  hydrate: () => Promise<void>;
  addSplit: (split: Omit<SplitExpense, 'id' | 'createdAt'>) => Promise<void>;
  removeSplit: (id: string) => Promise<void>;
  markPaid: (id: string, participantName: string) => Promise<void>;
  clearAll: () => Promise<void>;
}

const KEY = '@exora_split_expenses';

function uuid() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

async function persist(splits: SplitExpense[]) {
  await AsyncStorage.setItem(KEY, JSON.stringify(splits));
}

export const useSplitStore = create<SplitState>((set, get) => ({
  splits: [],
  loaded: false,

  hydrate: async () => {
    try {
      const raw = await AsyncStorage.getItem(KEY);
      set({ splits: raw ? JSON.parse(raw) : [], loaded: true });
    } catch {
      set({ loaded: true });
    }
  },

  addSplit: async split => {
    const newSplit: SplitExpense = {
      ...split,
      id: uuid(),
      createdAt: new Date().toISOString().slice(0, 10),
    };
    const splits = [newSplit, ...get().splits];
    set({ splits });
    await persist(splits);
  },

  removeSplit: async id => {
    const splits = get().splits.filter(s => s.id !== id);
    set({ splits });
    await persist(splits);
  },

  markPaid: async (id, participantName) => {
    const splits = get().splits.map(s => {
      if (s.id !== id) return s;
      return {
        ...s,
        participants: s.participants.map(p =>
          p.name === participantName ? { ...p, paid: !p.paid } : p,
        ),
      };
    });
    set({ splits });
    await persist(splits);
  },

  clearAll: async () => {
    set({ splits: [] });
    await AsyncStorage.removeItem(KEY);
  },
}));
