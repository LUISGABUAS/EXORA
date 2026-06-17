import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';

export interface CustomCategory {
  id: string;
  name: string;
  icon: string;
  color: string;
}

export const DEFAULT_ICONS = [
  // Hogar y vida
  'home-outline', 'sofa-outline', 'lightbulb-outline', 'water-outline', 'wifi', 'television',
  // Transporte
  'car-outline', 'airplane', 'bus', 'bicycle', 'motorbike', 'train',
  // Salud y fitness
  'dumbbell', 'heart-outline', 'pill', 'meditation', 'yoga', 'run',
  // Comida y bebida
  'food-fork-drink', 'coffee-outline', 'beer-outline', 'pizza', 'hamburger', 'fruit-watermelon',
  // Entretenimiento
  'gamepad-variant-outline', 'music-note', 'movie-open-outline', 'book-open-outline', 'controller-classic-outline', 'guitar-acoustic',
  // Mascotas
  'dog', 'cat', 'paw',
  // Familia
  'baby-carriage', 'human-male-female', 'human-child',
  // Trabajo y educación
  'briefcase-outline', 'school-outline', 'laptop', 'pencil-outline', 'calculator', 'chart-line',
  // Compras
  'shopping-outline', 'shopping-cart-outline', 'tag-outline', 'hanger',
  // Servicios
  'tools', 'wrench-outline', 'hammer-wrench', 'phone-outline', 'printer-outline',
  // Arte y hobbies
  'palette', 'camera-outline', 'flower-outline', 'cards-playing-outline', 'dice-multiple-outline',
  // Finanzas
  'bank-outline', 'cash-multiple', 'credit-card-outline', 'piggy-bank-outline', 'currency-usd',
  // Viajes
  'map-marker-outline', 'beach', 'camping', 'passport', 'suitcase-outline',
  // Otros
  'gift-outline', 'star-outline', 'fire', 'leaf-outline', 'recycle', 'earth',
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

const STORAGE_KEY = '@exora_custom_categories';

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
