import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { checkPremiumStatus } from '../services/revenuecatService';
import { redeemFounderCodeInSupabase } from '../services/founderService';
import { track } from '../services/analyticsService';

export type PremiumPlan = 'free' | 'monthly' | 'yearly' | 'founder';

export type FinancialGoal =
  | 'ahorrar_mas'
  | 'maximizar_deducciones'
  | 'reducir_gastos_hormiga'
  | 'pagar_menos_impuestos'
  | 'liquidar_deudas'
  | 'fondo_emergencia'
  | 'meta_especifica'
  | 'entender_finanzas';
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
  allFiscalRegimes: FiscalRegime[];
  razonSocial: string | null;
  actividadEconomica: string | null;
  constanciaUri: string | null;
  constanciaUploadDate: string | null;
  onboardingComplete: boolean;
  avatarUri: string | null;
  biometricEnabled: boolean;
  isFounder: boolean;
  financialGoals: FinancialGoal[];
  ageRange: string;
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
    allFiscalRegimes?: FiscalRegime[];
    razonSocial?: string | null;
    actividadEconomica?: string | null;
    constanciaUri?: string | null;
    constanciaUploadDate?: string | null;
  }) => Promise<void>;
  clearConstancia: () => Promise<void>;
  completeOnboarding: () => Promise<void>;
  setFinancialGoals: (goals: FinancialGoal[], ageRange: string) => Promise<void>;
  setPlan: (p: PremiumPlan) => Promise<void>;
  setAvatarUri: (uri: string | null) => Promise<void>;
  setBiometricEnabled: (enabled: boolean) => Promise<void>;
  extendTrial: (days: number) => Promise<void>;
  syncWithRevenueCat: () => Promise<void>;
  redeemFounderCode: (
    code: string,
  ) => Promise<'success' | 'already_used' | 'invalid' | 'error'>;
}

const STORAGE_KEY = '@smartexpense_premium';
const ONBOARDING_KEY = '@expensia_onboarding_complete';

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
  allFiscalRegimes: [] as FiscalRegime[],
  razonSocial: null as string | null,
  actividadEconomica: null as string | null,
  constanciaUri: null as string | null,
  constanciaUploadDate: null as string | null,
  onboardingComplete: false,
  avatarUri: null as string | null,
  biometricEnabled: false,
  isFounder: false,
  financialGoals: [] as FinancialGoal[],
  ageRange: '',
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
    allFiscalRegimes: state.allFiscalRegimes,
    razonSocial: state.razonSocial,
    actividadEconomica: state.actividadEconomica,
    constanciaUri: state.constanciaUri,
    constanciaUploadDate: state.constanciaUploadDate,
    onboardingComplete: state.onboardingComplete,
    avatarUri: state.avatarUri,
    biometricEnabled: state.biometricEnabled,
    isFounder: state.isFounder,
    financialGoals: state.financialGoals,
    ageRange: state.ageRange,
  };
}

export const usePremiumStore = create<PremiumState>((set, get) => ({
  ...defaults,
  loaded: false,

  hydrate: async () => {
    try {
      const [raw, onboardingFlag] = await Promise.all([
        AsyncStorage.getItem(STORAGE_KEY),
        AsyncStorage.getItem(ONBOARDING_KEY),
      ]);
      const parsed = raw ? JSON.parse(raw) : {};
      // onboardingComplete sobrevive sign-out — se guarda en clave separada
      if (onboardingFlag === 'true') parsed.onboardingComplete = true;
      set({ ...defaults, ...parsed, loaded: true });

      // Siempre verifica fundador en Supabase — garantiza sync tras reinstalar o limpiar datos
      try {
        const { checkIsFounderInSupabase } = await import(
          '../services/founderService'
        );
        const isFounder = await checkIsFounderInSupabase();
        if (isFounder) {
          set({ isFounder: true, isPremium: true, plan: 'founder' });
          await persist(getData(get()));
        }
      } catch {
        // Si falla la red, mantiene el estado local
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
    return state.weeklyScans < 5;
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
    if (state.isFounder) return true;
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
      ...(data.allFiscalRegimes !== undefined && { allFiscalRegimes: data.allFiscalRegimes }),
      ...(data.razonSocial !== undefined && { razonSocial: data.razonSocial }),
      ...(data.actividadEconomica !== undefined && { actividadEconomica: data.actividadEconomica }),
      ...(data.constanciaUri !== undefined && { constanciaUri: data.constanciaUri }),
      ...(data.constanciaUploadDate !== undefined && { constanciaUploadDate: data.constanciaUploadDate }),
    });
    await persist(getData(get()));
  },

  clearConstancia: async () => {
    set({ constanciaUri: null, constanciaUploadDate: null, razonSocial: null, actividadEconomica: null, allFiscalRegimes: [] });
    await persist(getData(get()));
  },

  completeOnboarding: async () => {
    const state = get();
    const trialEndsAt =
      !state.isPremium && !state.trialEndsAt
        ? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
            .toISOString()
            .slice(0, 10)
        : state.trialEndsAt;
    set({ onboardingComplete: true, trialEndsAt });
    await persist(getData(get()));
    await AsyncStorage.setItem(ONBOARDING_KEY, 'true');
    if (trialEndsAt) {
      const { scheduleTrialReminders } = await import(
        '../services/notificationService'
      );
      scheduleTrialReminders(trialEndsAt);
    }
  },

  setFinancialGoals: async (goals, ageRange) => {
    set({ financialGoals: goals, ageRange });
    await persist(getData(get()));
  },

  setPlan: async p => {
    const premium = p !== 'free';
    if (premium) track('paywall_converted', { plan: p });
    set({ plan: p, isPremium: premium });
    await persist(getData(get()));
  },

  setAvatarUri: async uri => {
    set({ avatarUri: uri });
    await persist(getData(get()));
  },

  setBiometricEnabled: async enabled => {
    set({ biometricEnabled: enabled });
    await persist(getData(get()));
  },

  extendTrial: async (days: number) => {
    const state = get();
    const base =
      state.trialEndsAt && state.trialEndsAt > todayStr()
        ? new Date(state.trialEndsAt)
        : new Date();
    base.setDate(base.getDate() + days);
    const trialEndsAt = base.toISOString().slice(0, 10);
    set({ trialEndsAt });
    await persist(getData(get()));
  },

  syncWithRevenueCat: async () => {
    try {
      // Never downgrade a founder — their access comes from Supabase, not RevenueCat
      if (get().isFounder) return;
      const status = await checkPremiumStatus();
      const premium = status.isPremium;
      const plan = (status.plan || 'free') as PremiumPlan;
      set({ isPremium: premium, plan });
      await persist(getData(get()));
    } catch {
      // Silently fail — keep local state
    }
  },

  redeemFounderCode: async (code: string) => {
    const result = await redeemFounderCodeInSupabase(code.trim().toUpperCase());
    if (result === 'success') {
      set({ isPremium: true, plan: 'founder', isFounder: true });
      await persist(getData(get()));
      track('founder_code_redeemed');
    }
    return result;
  },
}));
