import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { Currency } from '../services/exchangeRateService';

const STORAGE_KEY = '@expensia_currency';

interface CurrencyState {
  defaultCurrency: Currency;
  loaded: boolean;
  hydrate: () => Promise<void>;
  setDefaultCurrency: (c: Currency) => Promise<void>;
}

async function persist(currency: Currency) {
  await AsyncStorage.setItem(STORAGE_KEY, currency);
}

export const useCurrencyStore = create<CurrencyState>((set, _get) => ({
  defaultCurrency: 'MXN',
  loaded: false,

  hydrate: async () => {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      if (raw) {
        set({ defaultCurrency: raw as Currency, loaded: true });
      } else {
        set({ loaded: true });
      }
    } catch {
      set({ loaded: true });
    }
  },

  setDefaultCurrency: async c => {
    set({ defaultCurrency: c });
    await persist(c);
  },
}));
