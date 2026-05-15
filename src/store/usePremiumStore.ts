import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { checkPremiumStatus } from '../services/revenuecatService';

export type PremiumPlan = 'free' | 'monthly' | 'yearly';
export type FiscalRegime =
  | 'resico'
  | 'actividad_empresarial'
  | 'no_facturo'
  | 'sueldos_salarios'
  | 'arrendamiento'
  | 'plataformas_digitales'
  | 'honorarios'
  | 'regimen_general'
  | 'incorporacion_fiscal';

interface PremiumState {
  // Persisted data
  isPremium: boolean;
  plan: PremiumPlan;
  trialEndsAt: string | null;
  weeklyScans: number;
  weekStartDate: string;
  streak: number;
  lastActiveDate: string;
  fiscalRegime: FiscalRegime;
  razonSocial: string | null;
  constanciaUri: string | null;
  constanciaUploadDate: string | null;
  onboardingComplete: boolean;
  avatarUri: string | null;
  // Runtime
  loaded: boolean;
  // Actions
  hydrate: () => Promise<void>;
  canScanOCR: () => boolean;
  incrementScan: () => Promise<void>;
  hasFullAccess: () => boolean;
  updateStreak: () => Promise<void>;
  setFiscalRegime: (r: FiscalRegime) => Promise<void>;
  setFiscalProfile: (data: {
    fiscalRegime?: FiscalRegime;
    razonSocial?: string | null;
    constanciaUri?: string | null;
    constanciaUploadDate?: string | null;
  }) => Promise<void>;
  clearConstancia: () => Promise<void>;
  completeOnboarding: () => Promise<void>;
  setPlan: (p: PremiumPlan) => Promise<void>;
  setAvatarUri: (uri: string | null) => Promise<void>;
  syncWithRevenueCat: () => Promise<void>;
}

const STORAGE_KEY = '@smartexpense_premium';

function getMonday(date: Date): string {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const day = d.getDay();
  const diff = day === 0 ? 6 : day - 1;
  d.setDate(d.getDate() - diff);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}

function todayStr(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}

function yesterdayStr(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}

const defaults = {
  isPremium: false,
  plan: 'free' as PremiumPlan,
  trialEndsAt: null as string | null,
  weeklyScans: 0,
  weekStartDate: getMonday(new Date()),
  streak: 0,
  lastActiveDate: '',
  fiscalRegime: 'no_facturo' as FiscalRegime,
  razonSocial: null as string | null,
  constanciaUri: null as string | null,
  constanciaUploadDate: null as string | null,
  onboardingComplete: false,
  avatarUri: null as string | null,
};

type PersistData = typeof defaults;

async function persist(data: PersistData) {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

function getData(state: PremiumState): PersistData {
  return {
    isPremium: state.isPremium,
    plan: state.plan,
    trialEndsAt: state.trialEndsAt,
    weeklyScans: state.weeklyScans,
    weekStartDate: state.weekStartDate,
    streak: state.streak,
    lastActiveDate: state.lastActiveDate,
    fiscalRegime: state.fiscalRegime,
    razonSocial: state.razonSocial,
    constanciaUri: state.constanciaUri,
    constanciaUploadDate: state.constanciaUploadDate,
    onboardingComplete: state.onboardingComplete,
    avatarUri: state.avatarUri,
  };
}

export const usePremiumStore = create<PremiumState>((set, get) => ({
  ...defaults,
  loaded: false,

  hydrate: async () => {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        set({ ...defaults, ...parsed, loaded: true });
      } else {
        set({ loaded: true });
      }
    } catch {
      set({ loaded: true });
    }
  },

  canScanOCR: () => {
    const state = get();
    if (state.hasFullAccess()) return true;
    const currentMonday = getMonday(new Date());
    if (currentMonday !== state.weekStartDate) {
      set({ weeklyScans: 0, weekStartDate: currentMonday });
      const updated = get();
      persist(getData(updated));
      return true;
    }
    return state.weeklyScans < 3;
  },

  incrementScan: async () => {
    const state = get();
    // Reset week if needed
    const currentMonday = getMonday(new Date());
    let scans = state.weeklyScans;
    if (currentMonday !== state.weekStartDate) {
      scans = 0;
    }
    set({ weeklyScans: scans + 1, weekStartDate: currentMonday });
    await persist(getData(get()));
  },

  hasFullAccess: () => {
    const state = get();
    if (state.isPremium) return true;
    if (state.trialEndsAt && state.trialEndsAt >= todayStr()) return true;
    return false;
  },

  updateStreak: async () => {
    const state = get();
    const today = todayStr();
    const yesterday = yesterdayStr();

    if (state.lastActiveDate === today) return;

    let newStreak = 1;
    if (state.lastActiveDate === yesterday) {
      newStreak = state.streak + 1;
    }

    set({ streak: newStreak, lastActiveDate: today });
    await persist(getData(get()));
  },

  setFiscalRegime: async r => {
    set({ fiscalRegime: r });
    await persist(getData(get()));
  },

  setFiscalProfile: async data => {
    set({
      ...(data.fiscalRegime !== undefined && { fiscalRegime: data.fiscalRegime }),
      ...(data.razonSocial !== undefined && { razonSocial: data.razonSocial }),
      ...(data.constanciaUri !== undefined && { constanciaUri: data.constanciaUri }),
      ...(data.constanciaUploadDate !== undefined && { constanciaUploadDate: data.constanciaUploadDate }),
    });
    await persist(getData(get()));
  },

  clearConstancia: async () => {
    set({ constanciaUri: null, constanciaUploadDate: null, razonSocial: null });
    await persist(getData(get()));
  },

  completeOnboarding: async () => {
    set({ onboardingComplete: true });
    await persist(getData(get()));
  },

  setPlan: async p => {
    const premium = p !== 'free';
    set({ plan: p, isPremium: premium });
    await persist(getData(get()));
  },

  setAvatarUri: async uri => {
    set({ avatarUri: uri });
    await persist(getData(get()));
  },

  syncWithRevenueCat: async () => {
    try {
      const status = await checkPremiumStatus();
      const premium = status.isPremium;
      const plan = (status.plan || 'free') as PremiumPlan;
      set({ isPremium: premium, plan });
      await persist(getData(get()));
    } catch {
      // Silently fail — keep local state
    }
  },
}));
