import AsyncStorage from '@react-native-async-storage/async-storage';
import { getDatabase } from '../database/db';
import { useExpenseStore } from '../store/useExpenseStore';
import { useIncomeStore } from '../store/useIncomeStore';
import { usePremiumStore } from '../store/usePremiumStore';
import { useBudgetStore } from '../store/useBudgetStore';
import { useSavingsStore } from '../store/useSavingsStore';
import { useRecurringStore } from '../store/useRecurringStore';
import { useRecurringIncomeStore } from '../store/useRecurringIncomeStore';
import { useCustomCategoryStore } from '../store/useCustomCategoryStore';
import { useSplitStore } from '../store/useSplitStore';
import { useTemplateStore } from '../store/useTemplateStore';

const ASYNC_STORAGE_KEYS = [
  '@smartexpense_premium',
  '@smartexpense_budgets',
  '@expensia_custom_categories',
  '@expensia_currency',
  '@expensia_templates',
  '@expensia_recurring',
  '@expensia_savings_goals',
  '@expensia_split_expenses',
  '@expensia_recurring_income',
  '@expensia_ai_insights_cache',
  '@expensia_last_rating_request',
];

export async function clearAllUserData(): Promise<void> {
  // 1. Limpiar SQLite — tablas con datos del usuario
  try {
    const db = await getDatabase();
    await db.executeSql('DELETE FROM expenses');
    await db.executeSql('DELETE FROM incomes');
    await db.executeSql('DELETE FROM sync_queue');
  } catch {
    // Silencioso — puede que la tabla aún no exista en primer uso
  }

  // 2. Limpiar AsyncStorage
  await AsyncStorage.multiRemove(ASYNC_STORAGE_KEYS);

  // 3. Resetear stores en memoria (sin recargar desde DB vacía)
  useExpenseStore.setState({ expenses: [], loading: false });
  useIncomeStore.setState({ incomes: [], loading: false });

  // Premium: resetear todo EXCEPTO onboardingComplete (para que no repita el onboarding en la nueva cuenta)
  usePremiumStore.setState({
    isPremium: false,
    plan: 'free',
    trialEndsAt: null,
    weeklyScans: 0,
    weekStartDate: '',
    streak: 0,
    lastActiveDate: null,
    fiscalRegime: 'resico',
    allFiscalRegimes: [],
    razonSocial: null,
    constanciaUri: null,
    constanciaUploadDate: null,
    onboardingComplete: false,  // nueva cuenta = nuevo onboarding
    avatarUri: null,
    biometricEnabled: false,
    isFounder: false,
    financialGoals: [],
    ageRange: '',
  });

  useBudgetStore.setState({ budgets: {} });
  useSavingsStore.setState({ goals: [] });
  useRecurringStore.setState({ items: [] });
  useRecurringIncomeStore.setState({ items: [] });
  useCustomCategoryStore.setState({ categories: [] });
  useSplitStore.setState({ splits: [] });
  useTemplateStore.setState({ templates: [] });
}
