import React from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { DarkTheme, DefaultTheme, NavigationContainer, NavigatorScreenParams } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { BackupScreen } from '../screens/BackupScreen';
import { BankImportScreen } from '../screens/BankImportScreen';
import { CurrencySettingsScreen } from '../screens/CurrencySettingsScreen';
import { CustomCategoriesScreen } from '../screens/CustomCategoriesScreen';
import { DashboardScreen } from '../screens/DashboardScreen';
import { ExpenseDetailScreen } from '../screens/ExpenseDetailScreen';
import { HistoryScreen } from '../screens/HistoryScreen';
import { LoginScreen } from '../screens/LoginScreen';
import { OnboardingScreen } from '../screens/OnboardingScreen';
import { ProfileEditScreen } from '../screens/ProfileEditScreen';
import { PresupuestoScreen } from '../screens/PresupuestoScreen';
import { RecurringScreen } from '../screens/RecurringScreen';
import { SavingsScreen } from '../screens/SavingsScreen';
import { ReporteFiscalScreen } from '../screens/ReporteFiscalScreen';
import { ResicoCalculatorScreen } from '../screens/ResicoCalculatorScreen';
import { ScanScreen } from '../screens/ScanScreen';
import { SettingsScreen } from '../screens/SettingsScreen';
import { SplitScreen } from '../screens/SplitScreen';
import { useAuthStore } from '../store/useAuthStore';
import { usePremiumStore } from '../store/usePremiumStore';
import { useTheme } from '../theme/ThemeContext';
import { tabIcons } from '../theme/icons';

export type RootStackParamList = {
  Login: undefined;
  Onboarding: undefined;
  Tabs: NavigatorScreenParams<TabParamList> | undefined;
  ExpenseDetail: { expenseId: number };
  Scan: undefined;
  ProfileEdit: undefined;
  ReporteFiscal: undefined;
  Presupuesto: undefined;
  Recurrentes: undefined;
  Ahorros: undefined;
  ResicoCalculator: undefined;
  Split: undefined;
  CustomCategories: undefined;
  Backup: undefined;
  CurrencySettings: undefined;
  BankImport: undefined;
};

export type TabParamList = {
  Inicio: undefined;
  Movimientos: undefined;
  Perfil: undefined;
};

const Tab = createBottomTabNavigator<TabParamList>();
const Stack = createNativeStackNavigator<RootStackParamList>();

function TabIcon({ routeName, color }: { routeName: keyof typeof tabIcons; color: string }) {
  return (
    <Icon name={tabIcons[routeName] ?? 'circle-outline'} size={22} color={color} />
  );
}

function Tabs() {
  const { colors } = useTheme();

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: {
          height: Platform.OS === 'ios' ? 84 : 64,
          paddingTop: 8,
          paddingBottom: Platform.OS === 'ios' ? 28 : 10,
          backgroundColor: colors.surface,
          borderTopWidth: 0,
          elevation: 0,
          shadowOpacity: 0,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600',
          marginTop: 2,
        },
        tabBarLabel: route.name,
        tabBarIcon: ({ color }) => (
          <TabIcon routeName={route.name} color={color} />
        ),
      })}
    >
      <Tab.Screen name="Inicio" component={DashboardScreen} />
      <Tab.Screen name="Movimientos" component={HistoryScreen} />
      <Tab.Screen name="Perfil" component={SettingsScreen} />
    </Tab.Navigator>
  );
}

export function AppNavigator() {
  const session = useAuthStore(state => state.session);
  const onboardingComplete = usePremiumStore(state => state.onboardingComplete);
  const { colors, isDark } = useTheme();

  const navTheme = {
    ...(isDark ? DarkTheme : DefaultTheme),
    colors: {
      ...(isDark ? DarkTheme : DefaultTheme).colors,
      background: colors.background,
      card: colors.surface,
      text: colors.text,
      border: colors.border,
      primary: colors.primary,
    },
  };

  return (
    <NavigationContainer theme={navTheme}>
      <Stack.Navigator
        screenOptions={{
          headerStyle: { backgroundColor: colors.surface },
          headerTintColor: colors.text,
          contentStyle: { backgroundColor: colors.background },
        }}
      >
        {session === null ? (
          <Stack.Screen
            name="Login"
            component={LoginScreen}
            options={{ headerShown: false, animationTypeForReplace: 'pop' }}
          />
        ) : !onboardingComplete ? (
          <Stack.Screen
            name="Onboarding"
            component={OnboardingScreen}
            options={{ headerShown: false }}
          />
        ) : (
          <>
            <Stack.Screen name="Tabs" component={Tabs} options={{ headerShown: false }} />
            <Stack.Screen
              name="ExpenseDetail"
              component={ExpenseDetailScreen}
              options={{ title: 'Detalle del gasto', headerBackTitle: 'Inicio' }}
            />
            <Stack.Screen
              name="Scan"
              component={ScanScreen}
              options={{ title: 'Escanear', headerBackTitle: 'Inicio' }}
            />
            <Stack.Screen
              name="ProfileEdit"
              component={ProfileEditScreen}
              options={{ title: 'Editar perfil', headerBackTitle: 'Atras' }}
            />
            <Stack.Screen
              name="ReporteFiscal"
              component={ReporteFiscalScreen}
              options={{ title: 'Reporte Fiscal', headerBackTitle: 'Perfil' }}
            />
            <Stack.Screen
              name="Presupuesto"
              component={PresupuestoScreen}
              options={{ title: 'Presupuestos', headerBackTitle: 'Inicio' }}
            />
            <Stack.Screen
              name="Recurrentes"
              component={RecurringScreen}
              options={{ title: 'Gastos recurrentes', headerBackTitle: 'Perfil' }}
            />
            <Stack.Screen
              name="Ahorros"
              component={SavingsScreen}
              options={{ title: 'Metas de ahorro', headerBackTitle: 'Perfil' }}
            />
            <Stack.Screen
              name="ResicoCalculator"
              component={ResicoCalculatorScreen}
              options={{ title: 'Calculadora Fiscal', headerBackTitle: 'Atras' }}
            />
            <Stack.Screen
              name="Split"
              component={SplitScreen}
              options={{ title: 'Dividir Gastos', headerBackTitle: 'Atras' }}
            />
            <Stack.Screen
              name="CustomCategories"
              component={CustomCategoriesScreen}
              options={{ title: 'Categorías personalizadas', headerBackTitle: 'Perfil' }}
            />
            <Stack.Screen
              name="Backup"
              component={BackupScreen}
              options={{ title: 'Backup y Restauración', headerBackTitle: 'Perfil' }}
            />
            <Stack.Screen
              name="CurrencySettings"
              component={CurrencySettingsScreen}
              options={{ title: 'Moneda y tipo de cambio', headerBackTitle: 'Perfil' }}
            />
            <Stack.Screen
              name="BankImport"
              component={BankImportScreen}
              options={{ title: 'Importar estado de cuenta', headerBackTitle: 'Perfil' }}
            />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
