import React from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { DarkTheme, DefaultTheme, NavigationContainer, NavigatorScreenParams } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { DashboardScreen } from '../screens/DashboardScreen';
import { ExpenseDetailScreen } from '../screens/ExpenseDetailScreen';
import { HistoryScreen } from '../screens/HistoryScreen';
import { LoginScreen } from '../screens/LoginScreen';
import { OnboardingScreen } from '../screens/OnboardingScreen';
import { ProfileEditScreen } from '../screens/ProfileEditScreen';
import { ScanScreen } from '../screens/ScanScreen';
import { SettingsScreen } from '../screens/SettingsScreen';
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
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
