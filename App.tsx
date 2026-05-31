import React, { useEffect, useState } from 'react';
import { ActivityIndicator, AppState, StatusBar, StyleSheet, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { initDatabase } from './src/database/db';
import { AppNavigator } from './src/navigation/AppNavigator';
import { BiometricLock } from './src/components/BiometricLock';
import { configureNotifications, scheduleSatDeadlines } from './src/services/notificationService';
import { startSyncService } from './src/services/syncService';
import { getAvailableBiometric, BiometricType } from './src/services/biometricService';
import { useAuthStore } from './src/store/useAuthStore';
import { useExpenseStore } from './src/store/useExpenseStore';
import { usePremiumStore } from './src/store/usePremiumStore';
import { useTemplateStore } from './src/store/useTemplateStore';
import { initRevenueCat } from './src/services/revenuecatService';
import { useBudgetStore } from './src/store/useBudgetStore';
import { useCustomCategoryStore } from './src/store/useCustomCategoryStore';
import { useCurrencyStore } from './src/store/useCurrencyStore';
import { useRecurringStore } from './src/store/useRecurringStore';
import { useSavingsStore } from './src/store/useSavingsStore';
import { useIncomeStore } from './src/store/useIncomeStore';
import { ThemeProvider, useTheme } from './src/theme/ThemeContext';

function AppContent() {
  const loadExpenses = useExpenseStore(state => state.loadExpenses);
  const initializeAuth = useAuthStore(state => state.initialize);
  const authLoading = useAuthStore(state => state.loading);
  const hydratePremium = usePremiumStore(state => state.hydrate);
  const updateStreak = usePremiumStore(state => state.updateStreak);
  const syncWithRevenueCat = usePremiumStore(state => state.syncWithRevenueCat);
  const premiumLoaded = usePremiumStore(state => state.loaded);
  const biometricEnabled = usePremiumStore(state => state.biometricEnabled);

  const [locked, setLocked] = useState(false);
  const [biometricType, setBiometricType] = useState<BiometricType>('none');
  const hydrateTemplates = useTemplateStore(state => state.hydrate);
  const hydrateBudgets = useBudgetStore(state => state.hydrate);
  const hydrateRecurring = useRecurringStore(state => state.hydrate);
  const hydrateSavings = useSavingsStore(state => state.hydrate);
  const loadIncomes = useIncomeStore(state => state.loadIncomes);
  const hydrateCustomCategories = useCustomCategoryStore(state => state.hydrate);
  const hydrateCurrency = useCurrencyStore(state => state.hydrate);
  const getDueThisMonth = useRecurringStore(state => state.getDueThisMonth);
  const markProcessed = useRecurringStore(state => state.markProcessed);
  const { colors, isDark } = useTheme();

  // Lock when app goes to background
  useEffect(() => {
    if (!biometricEnabled) return;
    const sub = AppState.addEventListener('change', nextState => {
      if (nextState === 'background' || nextState === 'inactive') {
        setLocked(true);
      }
    });
    return () => sub.remove();
  }, [biometricEnabled]);

  // Detect biometric type and lock on first load if enabled
  useEffect(() => {
    if (!premiumLoaded) return;
    if (!biometricEnabled) return;
    getAvailableBiometric().then(type => {
      setBiometricType(type);
      if (type !== 'none') setLocked(true);
    });
  }, [premiumLoaded, biometricEnabled]);

  useEffect(() => {
    const bootstrap = async () => {
      // Auth (network) and DB (local) are independent — run in parallel
      // Each promise handles its own errors so one failure can't block the others
      await Promise.allSettled([
        initializeAuth(),
        initDatabase().then(() => loadExpenses()).catch(e => console.error('DB error:', e)),
        hydratePremium(),
        hydrateTemplates(),
        hydrateBudgets(),
        hydrateRecurring(),
        hydrateSavings(),
        hydrateCustomCategories(),
        loadIncomes(),
        hydrateCurrency(),
      ]);
      await updateStreak().catch(() => {});

      // Procesar gastos recurrentes vencidos este mes
      try {
        const due = getDueThisMonth();
        const addExpense = useExpenseStore.getState().addExpense;
        const today = new Date();
        const month = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
        for (const r of due) {
          await addExpense({
            amount: r.amount,
            date: `${month}-${String(r.dayOfMonth).padStart(2, '0')}`,
            category: r.category,
            description: r.description,
            merchantName: r.merchantName,
            conceptsText: '',
            ocrRawText: '',
            deductible: r.deductible,
            rfc: '',
            usoCFDI: '',
            source: 'manual',
          });
          await markProcessed(r.id, month);
        }
      } catch (e) {
        if (__DEV__) console.warn('Recurring error:', e);
      }

      configureNotifications();
      const { fiscalRegime } = usePremiumStore.getState();
      scheduleSatDeadlines(fiscalRegime);
      startSyncService();

      // Init RevenueCat + sync premium status (best-effort)
      try {
        const currentSession = useAuthStore.getState().session;
        await initRevenueCat(currentSession?.user?.id);
        await syncWithRevenueCat();
      } catch (error) {
        if (__DEV__) console.warn('RevenueCat bootstrap error:', error);
      }
    };
    void bootstrap();
  }, [loadExpenses, initializeAuth, hydratePremium, updateStreak, hydrateTemplates, syncWithRevenueCat]);

  if (authLoading || !premiumLoaded) {
    return (
      <View style={[styles.splash, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
      <AppNavigator />
      {locked && biometricType !== 'none' ? (
        <BiometricLock
          biometricType={biometricType}
          onUnlocked={() => setLocked(false)}
        />
      ) : null}
    </>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <GestureHandlerRootView style={styles.flex}>
        <SafeAreaProvider>
          <AppContent />
        </SafeAreaProvider>
      </GestureHandlerRootView>
    </ThemeProvider>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  splash: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
