import React, { useEffect, useState } from 'react';
import { Alert, Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { ScreenContainer } from '../components/ScreenContainer';
import { exportExpensesToCsv } from '../services/exportService';
import {
  cancelAllReminders,
  scheduleDailyReminder,
  scheduleWeeklySummary,
} from '../services/notificationService';
import { useAuthStore } from '../store/useAuthStore';
import { useExpenseStore } from '../store/useExpenseStore';
import { ColorPalette } from '../theme/colors';
import { ThemeMode, useTheme } from '../theme/ThemeContext';
import { shadows } from '../theme/spacing';

const REMINDER_KEY = '@smartexpense_reminders';

const themeModes: Array<{ mode: ThemeMode; label: string; icon: string }> = [
  { mode: 'light', label: 'Claro', icon: 'white-balance-sunny' },
  { mode: 'dark', label: 'Oscuro', icon: 'moon-waning-crescent' },
  { mode: 'system', label: 'Sistema', icon: 'cellphone' },
];

export function SettingsScreen() {
  const { colors, isDark, mode, setMode } = useTheme();
  const s = useStyles(colors, isDark);
  const expenses = useExpenseStore((state) => state.expenses);
  const signOut = useAuthStore(state => state.signOut);
  const [remindersOn, setRemindersOn] = useState(false);

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
      await exportExpensesToCsv(expenses);
    } catch (error) {
      Alert.alert('Error', error instanceof Error ? error.message : 'No se pudo exportar.');
    }
  };

  const handleSignOut = () => {
    Alert.alert('Cerrar sesion', '¿Deseas cerrar tu sesion?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Cerrar sesion', style: 'destructive', onPress: () => signOut() },
    ]);
  };

  return (
    <ScreenContainer>
      <View style={s.hero}>
        <Text style={s.title}>Configuracion</Text>
        <Text style={s.subtitle}>Herramientas utiles para mantener tu control financiero al dia.</Text>
      </View>

      <View style={s.card}>
        <View style={s.cardHeader}>
          <Icon name="theme-light-dark" size={22} color={colors.text} />
          <Text style={s.cardTitle}>Apariencia</Text>
        </View>
        <Text style={s.cardText}>Selecciona el tema de la aplicacion.</Text>
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

      <View style={s.card}>
        <View style={s.cardHeader}>
          <Icon name="file-export-outline" size={22} color={colors.text} />
          <Text style={s.cardTitle}>Exportar datos</Text>
        </View>
        <Text style={s.cardText}>Comparte tus gastos en formato CSV para analisis o respaldo.</Text>
        <Pressable style={s.button} onPress={exportCsv}>
          <Icon name="download" size={18} color={isDark ? colors.background : colors.white} />
          <Text style={s.buttonText}>Exportar CSV</Text>
        </Pressable>
      </View>

      <Pressable style={s.signOutButton} onPress={handleSignOut}>
        <Icon name="logout" size={18} color={colors.white} />
        <Text style={s.signOutText}>Cerrar sesion</Text>
      </Pressable>

      <Text style={s.version}>Expensia v0.0.1</Text>
    </ScreenContainer>
  );
}

const useStyles = (colors: ColorPalette, isDark: boolean) =>
  StyleSheet.create({
    hero: { backgroundColor: isDark ? colors.surface : '#f6ddce', borderRadius: 28, padding: 22, gap: 8 },
    title: { color: colors.text, fontSize: 28, fontWeight: '800' },
    subtitle: { color: colors.textMuted, lineHeight: 22 },
    card: {
      backgroundColor: colors.surface,
      borderRadius: 24,
      padding: 18,
      borderWidth: 1,
      borderColor: colors.border,
      gap: 12,
      ...shadows.card,
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
      backgroundColor: colors.text,
      paddingVertical: 14,
      borderRadius: 16,
      alignItems: 'center',
      justifyContent: 'center',
    },
    buttonText: { color: isDark ? colors.background : colors.white, fontWeight: '700' },
    signOutButton: {
      flexDirection: 'row',
      gap: 8,
      backgroundColor: colors.danger,
      paddingVertical: 14,
      borderRadius: 16,
      alignItems: 'center',
      justifyContent: 'center',
    },
    signOutText: { color: colors.white, fontWeight: '700', fontSize: 15 },
    version: { color: colors.textMuted, fontSize: 12, textAlign: 'center' },
  });
