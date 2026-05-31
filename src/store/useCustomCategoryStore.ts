import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';

export interface CustomCategory {
  id: string;
  name: string;
  icon: string;
  color: string;
}

export const DEFAULT_ICONS = [
  'car-outline',
  'home-outline',
  'dumbbell',
  'shopping-outline',
  'airplane',
  'gift-outline',
  'dog',
  'baby-carriage',
  'tools',
  'palette',
];

export const DEFAULT_COLORS = [
  '#22C55E',
  '#3B82F6',
  '#F59E0B',
  '#EF4444',
  '#8B5CF6',
  '#EC4899',
  '#14B8A6',
  '#F97316',
];

const STORAGE_KEY = '@expensia_custom_categories';

interface CustomCategoryState {
  categories: CustomCategory[];
  loaded: boolean;
  hydrate: () => Promise<void>;
  addCategory: (name: string, icon: string, color: string) => Promise<void>;
  removeCategory: (id: string) => Promise<void>;
  clearAll: () => Promise<void>;
}

async function persist(categories: CustomCategory[]) {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(categories));
}

export const useCustomCategoryStore = create<CustomCategoryState>((set, get) => ({
  categories: [],
  loaded: false,

  hydrate: async () => {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed: CustomCategory[] = JSON.parse(raw);
        set({ categories: parsed, loaded: true });
      } else {
        set({ loaded: true });
      }
    } catch {
      set({ loaded: true });
    }
  },

  addCategory: async (name, icon, color) => {
    const id = `cat_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const next = [...get().categories, { id, name: name.trim(), icon, color }];
    set({ categories: next });
    await persist(next);
  },

  removeCategory: async id => {
    const next = get().categories.filter(c => c.id !== id);
    set({ categories: next });
    await persist(next);
  },

  clearAll: async () => {
    set({ categories: [] });
    await AsyncStorage.removeItem(STORAGE_KEY);
  },
}));
