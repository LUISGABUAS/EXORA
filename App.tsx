import React, { useEffect, useState } from 'react';
import { ActivityIndicator, AppState, LogBox, StatusBar, StyleSheet, View } from 'react-native';

// Suppress dev-only toasts and SDK noise in production
if (!__DEV__) {
  LogBox.ignoreAllLogs();
}
LogBox.ignoreLogs([
  /\[RevenueCat\]/,
  /Open debugger/,
  'Non-serializable values were found in the navigation state',
]);
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import * as Sentry from '@sentry/react-native';
import { initDatabase } from './src/database/db';
import { AppNavigator } from './src/navigation/AppNavigator';
import { BiometricLock } from './src/components/BiometricLock';
import { ErrorBoundary } from './src/components/ErrorBoundary';
import { configureNotifications, scheduleSatDeadlines } from './src/services/notificationService';
import { startSyncService, pullFromSupabase } from './src/services/syncService';
import { setUserContext } from './src/services/crashReporting';
import { syncWidgetData } from './src/utils/widgetBridge';
import { track, flushNow } from './src/services/analyticsService';
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
import { useRecurringIncomeStore } from './src/store/useRecurringIncomeStore';
import { ThemeProvider, useTheme } from './src/theme/ThemeContext';

// Sentry — initialized by the wizard, wraps the app below
Sentry.init({
  dsn: 'https://936126e6a2a51caec1d808428e97bdcb@o4511520191086592.ingest.us.sentry.io/4511520196395008',
  sendDefaultPii: true,
  enableLogs: true,
  environment: __DEV__ ? 'development' : 'production',
  tracesSampleRate: __DEV__ ? 0 : 0.2,
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1,
  integrations: [
    Sentry.mobileReplayIntegration(),
    Sentry.feedbackIntegration(),
  ],
});

function AppContent() {
  const loadExpenses = useExpenseStore(state => state.loadExpenses);
  const session = useAuthStore(state => state.session);
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
  const hydrateRecurringIncome = useRecurringIncomeStore(state => state.hydrate);
  const getDueIncomeThisMonth = useRecurringIncomeStore(state => state.getDueThisMonth);
  const markIncomeProcessed = useRecurringIncomeStore(state => state.markProcessed);
  const { colors, isDark } = useTheme();

  // Pull datos desde Supabase cuando el usuario inicia sesión
  const prevSessionRef = React.useRef<string | null>(null);
  useEffect(() => {
    const userId = session?.user?.id ?? null;
    if (userId && userId !== prevSessionRef.current) {
      prevSessionRef.current = userId;
      pullFromSupabase().catch(() => {});
    }
    if (!userId) {
      prevSessionRef.current = null;
    }
  }, [session]);

  // Flush analytics + lock on background
  useEffect(() => {
    const sub = AppState.addEventListener('change', nextState => {
      if (nextState === 'background' || nextState === 'inactive') {
        flushNow();
        if (biometricEnabled) setLocked(true);
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
      // Auth primero — necesario para que el chequeo de fundador en Supabase funcione
      await initializeAuth().catch(() => {});

      await Promise.allSettled([
        initDatabase().then(() => loadExpenses()).catch(e => console.error('DB error:', e)),
        hydratePremium(),
        hydrateTemplates(),
        hydrateBudgets(),
        hydrateRecurring(),
        hydrateSavings(),
        hydrateCustomCategories(),
        loadIncomes(),
        hydrateCurrency(),
        hydrateRecurringIncome(),
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

      // Procesar ingresos recurrentes vencidos este mes
      try {
        const dueIncomes = getDueIncomeThisMonth();
        const addIncome = useIncomeStore.getState().addIncome;
        const today = new Date();
        const month = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
        for (const r of dueIncomes) {
          await addIncome({
            amount: r.amount,
            date: `${month}-${String(r.dayOfMonth).padStart(2, '0')}`,
            type: r.type,
            description: r.description,
            invoiced: r.invoiced,
            recurring: true,
            paymentMethod: r.paymentMethod,
          });
          await markIncomeProcessed(r.id, month);
        }
      } catch (e) {
        if (__DEV__) console.warn('Recurring income error:', e);
      }

      configureNotifications();
      const { fiscalRegime, plan } = usePremiumStore.getState();
      scheduleSatDeadlines(fiscalRegime);
      startSyncService();

      // Sync widget data al abrir la app
      try {
        const { expenses } = useExpenseStore.getState();
        const { incomes } = useIncomeStore.getState();
        syncWidgetData(expenses, incomes);
      } catch {}


      try {
        const currentSession = useAuthStore.getState().session;
        await initRevenueCat(currentSession?.user?.id);
        await syncWithRevenueCat();
      } catch (error) {
        if (__DEV__) console.warn('RevenueCat bootstrap error:', error);
      }

      // Sentry user context + analytics
      const session = useAuthStore.getState().session;
      if (session?.user) {
        setUserContext(session.user.id, session.user.email ?? undefined);
      }
      track('app_open', { plan, fiscalRegime });
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
        <BiometricLock biometricType={biometricType} onUnlocked={() => setLocked(false)} />
      ) : null}
    </>
  );
}

export default Sentry.wrap(function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider>
        <GestureHandlerRootView style={styles.flex}>
          <SafeAreaProvider>
            <AppContent />
          </SafeAreaProvider>
        </GestureHandlerRootView>
      </ThemeProvider>
    </ErrorBoundary>
  );
});

const styles = StyleSheet.create({
  flex: { flex: 1 },
  splash: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
