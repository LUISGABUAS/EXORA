import React, { useEffect, useState } from 'react';
import { Alert, Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { Avatar } from '../components/Avatar';
import { PaywallModal } from '../components/PaywallModal';
import { ScreenContainer } from '../components/ScreenContainer';
import { RootStackParamList } from '../navigation/AppNavigator';
import { exportExpensesToCsv } from '../services/exportService';
import {
  cancelAllReminders,
  scheduleDailyReminder,
  scheduleWeeklySummary,
} from '../services/notificationService';
import { useAuthStore } from '../store/useAuthStore';
import { useExpenseStore } from '../store/useExpenseStore';
import { FiscalRegime, usePremiumStore } from '../store/usePremiumStore';
import { ColorPalette } from '../theme/colors';
import { ThemeMode, useTheme } from '../theme/ThemeContext';
import { localDateString } from '../utils/format';

const REMINDER_KEY = '@smartexpense_reminders';

const themeModes: Array<{ mode: ThemeMode; label: string; icon: string }> = [
  { mode: 'light', label: 'Claro', icon: 'white-balance-sunny' },
  { mode: 'dark', label: 'Oscuro', icon: 'moon-waning-crescent' },
  { mode: 'system', label: 'Sistema', icon: 'cellphone' },
];

const fiscalModes: Array<{ value: FiscalRegime; label: string; icon: string }> = [
  { value: 'resico', label: 'RESICO', icon: 'account-check' },
  { value: 'actividad_empresarial', label: 'Act. Empresarial', icon: 'briefcase-outline' },
  { value: 'no_facturo', label: 'No facturo', icon: 'wallet-outline' },
];

export function SettingsScreen() {
  const { colors, isDark, mode, setMode } = useTheme();
  const s = useStyles(colors, isDark);
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const expenses = useExpenseStore((state) => state.expenses);
  const session = useAuthStore(state => state.session);
  const signOut = useAuthStore(state => state.signOut);
  const isPremium = usePremiumStore(state => state.isPremium);
  const plan = usePremiumStore(state => state.plan);
  const hasFullAccess = usePremiumStore(state => state.hasFullAccess);
  const fiscalRegime = usePremiumStore(state => state.fiscalRegime);
  const setFiscalRegime = usePremiumStore(state => state.setFiscalRegime);
  const [remindersOn, setRemindersOn] = useState(false);
  const [paywallVisible, setPaywallVisible] = useState(false);

  const userName = session?.user?.user_metadata?.full_name
    || session?.user?.email?.split('@')[0]
    || 'Usuario';
  const userEmail = session?.user?.email || '';

  useEffect(() => {
    AsyncStorage.getItem(REMINDER_KEY).then(val => {
      if (val === 'true') setRemindersOn(true);
    });
  }, []);

  const toggleReminders = async (value: boolean) => {
    setRemindersOn(value);
    await AsyncStorage.setItem(REMINDER_KEY, String(value));
    if (value) {
      scheduleDailyReminder();
      scheduleWeeklySummary();
    } else {
      cancelAllReminders();
    }
  };

  const exportCsv = async () => {
    try {
      let data = expenses;
      if (!hasFullAccess()) {
        const n = new Date();
        const cutoff = localDateString(new Date(n.getFullYear(), n.getMonth(), n.getDate() - 30));
        data = expenses.filter(e => e.date >= cutoff);
      }
      await exportExpensesToCsv(data);
    } catch (error) {
      Alert.alert('Error', error instanceof Error ? error.message : 'No se pudo exportar.');
    }
  };

  const planLabel = plan === 'monthly' ? 'Mensual' : plan === 'yearly' ? 'Anual' : 'Gratuito';

  const handleSignOut = () => {
    Alert.alert('Cerrar sesión', '¿Seguro que deseas cerrar tu sesión?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Cerrar sesión', style: 'destructive', onPress: () => signOut() },
    ]);
  };

  return (
    <ScreenContainer>
      {/* Profile Header */}
      <Pressable style={s.profileHeader} onPress={() => navigation.navigate('ProfileEdit')}>
        <Avatar size={72} name={userName} />
        <Text style={s.userName}>{userName}</Text>
        {userEmail ? <Text style={s.userEmail}>{userEmail}</Text> : null}
        <Text style={s.editHint}>Toca para editar</Text>
      </Pressable>

      <View style={s.card}>
        <View style={s.cardHeader}>
          <Icon name="theme-light-dark" size={22} color={colors.text} />
          <Text style={s.cardTitle}>Apariencia</Text>
        </View>
        <Text style={s.cardText}>Selecciona el tema de la aplicación.</Text>
        <View style={s.themeRow}>
          {themeModes.map(item => (
            <Pressable
              key={item.mode}
              style={[s.themeChip, mode === item.mode && s.themeChipActive]}
              onPress={() => setMode(item.mode)}
            >
              <Icon name={item.icon} size={16} color={mode === item.mode ? colors.white : colors.text} />
              <Text style={[s.themeChipText, mode === item.mode && s.themeChipTextActive]}>
                {item.label}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      <View style={s.card}>
        <View style={s.cardHeader}>
          <Icon name="file-document-outline" size={22} color={colors.text} />
          <Text style={s.cardTitle}>Régimen fiscal</Text>
        </View>
        <Text style={s.cardText}>Selecciona cómo facturas para calcular tu ahorro fiscal.</Text>
        <View style={s.themeRow}>
          {fiscalModes.map(item => (
            <Pressable
              key={item.value}
              style={[s.themeChip, fiscalRegime === item.value && s.themeChipActive]}
              onPress={() => setFiscalRegime(item.value)}
            >
              <Icon name={item.icon} size={16} color={fiscalRegime === item.value ? colors.white : colors.text} />
              <Text style={[s.themeChipText, fiscalRegime === item.value && s.themeChipTextActive]}>
                {item.label}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      <View style={s.card}>
        <View style={s.cardHeader}>
          <Icon name="bell-ring-outline" size={22} color={colors.text} />
          <Text style={s.cardTitle}>Recordatorios</Text>
        </View>
        <Text style={s.cardText}>Diario a las 20:00 y resumen semanal los domingos a las 10:00.</Text>
        <View style={s.switchRow}>
          <Text style={s.switchLabel}>Activar recordatorios</Text>
          <Switch
            value={remindersOn}
            onValueChange={toggleReminders}
            trackColor={{ true: colors.primary }}
          />
        </View>
      </View>

      {/* Subscription Card */}
      <View style={s.card}>
        <View style={s.cardHeader}>
          <Icon name="shield-crown-outline" size={22} color={colors.primary} />
          <Text style={s.cardTitle}>Suscripción</Text>
        </View>
        {isPremium ? (
          <>
            <Text style={s.cardText}>Plan activo: {planLabel}</Text>
            <Pressable style={s.buttonOutline} onPress={() => Alert.alert('Próximamente', 'Gestión de suscripción disponible pronto.')}>
              <Text style={s.buttonOutlineText}>Gestionar suscripción</Text>
            </Pressable>
          </>
        ) : (
          <>
            <Text style={s.cardText}>Plan gratuito — funcionalidades limitadas</Text>
            <Pressable style={s.button} onPress={() => setPaywallVisible(true)}>
              <Icon name="arrow-up-bold" size={18} color={colors.white} />
              <Text style={s.buttonText}>Actualizar a Premium</Text>
            </Pressable>
          </>
        )}
      </View>

      <View style={s.card}>
        <View style={s.cardHeader}>
          <Icon name="file-export-outline" size={22} color={colors.text} />
          <Text style={s.cardTitle}>Exportar datos</Text>
        </View>
        <Text style={s.cardText}>
          {hasFullAccess()
            ? 'Comparte tus gastos en formato CSV para análisis o respaldo.'
            : 'Exporta los últimos 30 días en CSV. Actualiza a Premium para exportar todo.'}
        </Text>
        <Pressable style={s.button} onPress={exportCsv}>
          <Icon name="download" size={18} color={colors.white} />
          <Text style={s.buttonText}>Exportar CSV</Text>
        </Pressable>
      </View>

      <Pressable style={s.signOutButton} onPress={handleSignOut}>
        <Icon name="logout" size={18} color={colors.danger} />
        <Text style={s.signOutText}>Cerrar sesión</Text>
      </Pressable>

      <Text style={s.version}>EXPENSIA v0.0.1</Text>

      <PaywallModal
        visible={paywallVisible}
        onClose={() => setPaywallVisible(false)}
        trigger="export"
      />
    </ScreenContainer>
  );
}

const useStyles = (colors: ColorPalette, _isDark: boolean) =>
  StyleSheet.create({
    profileHeader: {
      alignItems: 'center',
      gap: 8,
      paddingVertical: 24,
    },
    userName: {
      color: colors.text,
      fontSize: 22,
      fontWeight: '800',
    },
    userEmail: {
      color: colors.textMuted,
      fontSize: 14,
    },
    editHint: {
      color: colors.primary,
      fontSize: 12,
      fontWeight: '600',
      marginTop: 2,
    },
    card: {
      backgroundColor: colors.surface,
      borderRadius: 20,
      padding: 18,
      borderWidth: 1,
      borderColor: colors.border,
      gap: 12,
    },
    cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    cardTitle: { color: colors.text, fontSize: 18, fontWeight: '700' },
    cardText: { color: colors.textMuted, lineHeight: 22 },
    themeRow: { flexDirection: 'row', gap: 8 },
    themeChip: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      paddingVertical: 12,
      borderRadius: 14,
      backgroundColor: colors.surfaceAlt,
    },
    themeChipActive: { backgroundColor: colors.primary },
    themeChipText: { color: colors.text, fontWeight: '600', fontSize: 13 },
    themeChipTextActive: { color: colors.white },
    switchRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    switchLabel: { color: colors.text, fontWeight: '600' },
    button: {
      flexDirection: 'row',
      gap: 8,
      backgroundColor: colors.primary,
      paddingVertical: 14,
      borderRadius: 16,
      alignItems: 'center',
      justifyContent: 'center',
    },
    buttonText: { color: colors.white, fontWeight: '700' },
    buttonOutline: {
      flexDirection: 'row',
      gap: 8,
      borderWidth: 1,
      borderColor: colors.primary,
      paddingVertical: 14,
      borderRadius: 16,
      alignItems: 'center',
      justifyContent: 'center',
    },
    buttonOutlineText: { color: colors.primary, fontWeight: '700' },
    signOutButton: {
      flexDirection: 'row',
      gap: 8,
      backgroundColor: colors.danger + '12',
      paddingVertical: 14,
      borderRadius: 16,
      alignItems: 'center',
      justifyContent: 'center',
    },
    signOutText: { color: colors.danger, fontWeight: '700', fontSize: 15 },
    version: { color: colors.textMuted, fontSize: 12, textAlign: 'center' },
  });
