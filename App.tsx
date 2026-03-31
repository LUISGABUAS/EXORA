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
import { ThemeProvider, useTheme } from './src/theme/ThemeContext';

function AppContent() {
  const loadExpenses = useExpenseStore(state => state.loadExpenses);
  const initializeAuth = useAuthStore(state => state.initialize);
  const authLoading = useAuthStore(state => state.loading);
  const { colors, isDark } = useTheme();

  useEffect(() => {
    const bootstrap = async () => {
      await initializeAuth();
      await initDatabase();
      configureNotifications();
      await loadExpenses();
      startSyncService();
    };
    void bootstrap();
  }, [loadExpenses, initializeAuth]);

  if (authLoading) {
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
