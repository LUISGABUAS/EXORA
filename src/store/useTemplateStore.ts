import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { ExpenseCategory } from '../types/expense';

export interface Template {
  id: string;
  name: string;
  amount: number;
  category: ExpenseCategory;
  merchantName: string;
  description: string;
  isDefault: boolean;
}

const DEFAULT_TEMPLATES: Template[] = [
  { id: 'd1', name: 'Netflix', amount: 219, category: 'Entretenimiento', merchantName: 'Netflix', description: 'Netflix', isDefault: true },
  { id: 'd2', name: 'Spotify', amount: 115, category: 'Entretenimiento', merchantName: 'Spotify', description: 'Spotify', isDefault: true },
  { id: 'd3', name: 'Uber', amount: 150, category: 'Transporte', merchantName: 'Uber', description: 'Uber', isDefault: true },
  { id: 'd4', name: 'Gasolina', amount: 800, category: 'Transporte', merchantName: '', description: 'Gasolina', isDefault: true },
  { id: 'd5', name: 'Comida oficina', amount: 120, category: 'Comida', merchantName: '', description: 'Comida oficina', isDefault: true },
  { id: 'd6', name: 'Super', amount: 500, category: 'Comida', merchantName: 'Walmart', description: 'Super', isDefault: true },
  { id: 'd7', name: 'Gym', amount: 599, category: 'Salud', merchantName: '', description: 'Gym', isDefault: true },
  { id: 'd8', name: 'Farmacia', amount: 250, category: 'Salud', merchantName: '', description: 'Farmacia', isDefault: true },
];

const STORAGE_KEY = '@exora_templates';

interface TemplateState {
  templates: Template[];
  loaded: boolean;
  hydrate: () => Promise<void>;
  addTemplate: (t: Omit<Template, 'id' | 'isDefault'>) => Promise<void>;
  removeTemplate: (id: string) => Promise<void>;
}

function generateId(): string {
  return 'c_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

async function persistCustom(templates: Template[]) {
  const custom = templates.filter(t => !t.isDefault);
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(custom));
}

export const useTemplateStore = create<TemplateState>((set, get) => ({
  templates: DEFAULT_TEMPLATES,
  loaded: false,

  hydrate: async () => {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      if (raw) {
        const custom: Template[] = JSON.parse(raw);
        set({ templates: [...DEFAULT_TEMPLATES, ...custom], loaded: true });
      } else {
        set({ loaded: true });
      }
    } catch {
      set({ loaded: true });
    }
  },

  addTemplate: async t => {
    const newTemplate: Template = {
      ...t,
      id: generateId(),
      isDefault: false,
    };
    const updated = [...get().templates, newTemplate];
    set({ templates: updated });
    await persistCustom(updated);
  },

  removeTemplate: async id => {
    const template = get().templates.find(t => t.id === id);
    if (!template || template.isDefault) return;
    const updated = get().templates.filter(t => t.id !== id);
    set({ templates: updated });
    await persistCustom(updated);
  },
}));
