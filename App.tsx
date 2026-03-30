import React, { useEffect } from 'react';
import { StatusBar } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { initDatabase } from './src/database/db';
import { AppNavigator } from './src/navigation/AppNavigator';
import { configureNotifications } from './src/services/notificationService';
import { useExpenseStore } from './src/store/useExpenseStore';

export default function App() {
  const loadExpenses = useExpenseStore((state) => state.loadExpenses);

  useEffect(() => {
    const bootstrap = async () => {
      await initDatabase();
      configureNotifications();
      await loadExpenses();
    };
    void bootstrap();
  }, [loadExpenses]);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <StatusBar barStyle="dark-content" />
        <AppNavigator />
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
