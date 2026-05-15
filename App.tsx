import React, { useEffect } from 'react';
import { ActivityIndicator, StatusBar, StyleSheet, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { initDatabase } from './src/database/db';
import { AppNavigator } from './src/navigation/AppNavigator';
import { configureNotifications } from './src/services/notificationService';
import { startSyncService } from './src/services/syncService';
import { useAuthStore } from './src/store/useAuthStore';
import { useExpenseStore } from './src/store/useExpenseStore';
import { usePremiumStore } from './src/store/usePremiumStore';
import { useTemplateStore } from './src/store/useTemplateStore';
import { initRevenueCat } from './src/services/revenuecatService';
import { useBudgetStore } from './src/store/useBudgetStore';
import { ThemeProvider, useTheme } from './src/theme/ThemeContext';

function AppContent() {
  const loadExpenses = useExpenseStore(state => state.loadExpenses);
  const initializeAuth = useAuthStore(state => state.initialize);
  const authLoading = useAuthStore(state => state.loading);
  const hydratePremium = usePremiumStore(state => state.hydrate);
  const updateStreak = usePremiumStore(state => state.updateStreak);
  const syncWithRevenueCat = usePremiumStore(state => state.syncWithRevenueCat);
  const premiumLoaded = usePremiumStore(state => state.loaded);
  const hydrateTemplates = useTemplateStore(state => state.hydrate);
  const hydrateBudgets = useBudgetStore(state => state.hydrate);
  const { colors, isDark } = useTheme();

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
      ]);
      await updateStreak().catch(() => {});
      configureNotifications();
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
