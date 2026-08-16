import React, { useEffect, useState } from 'react';
import {
  ActionSheetIOS,
  Alert,
  Platform,
  Pressable,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { ScreenContainer } from '../components/ScreenContainer';
import {
  cancelAllReminders,
  notifyBudgetAlert,
  scheduleDailyReminder,
  scheduleSatDeadlines,
  scheduleWeeklySummary,
} from '../services/notificationService';
import { usePremiumStore } from '../store/usePremiumStore';
import { ColorPalette } from '../theme/colors';
import { font } from '../theme/typography';
import { useTheme } from '../theme/ThemeContext';

const KEYS = {
  daily: '@exora_notif_daily',
  dailyHour: '@exora_notif_daily_hour',
  weekly: '@exora_notif_weekly',
  budget: '@exora_notif_budget',
  sat: '@exora_notif_sat',
};

const HOURS = Array.from({ length: 18 }, (_, i) => i + 6); // 6 AM – 11 PM

function formatHour(h: number): string {
  const ampm = h >= 12 ? 'PM' : 'AM';
  const display = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${display}:00 ${ampm}`;
}

export function NotificationsScreen() {
  const { colors, isDark } = useTheme();
  const s = useStyles(colors, isDark);
  const fiscalRegime = usePremiumStore(state => state.fiscalRegime);
  const hasSatRegime = fiscalRegime !== 'no_facturo';

  const [dailyOn, setDailyOn] = useState(false);
  const [dailyHour, setDailyHour] = useState(20);
  const [weeklyOn, setWeeklyOn] = useState(false);
  const [budgetOn, setBudgetOn] = useState(true);
  const [satOn, setSatOn] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    (async () => {
      const [daily, hour, weekly, budget, sat] = await Promise.all([
        AsyncStorage.getItem(KEYS.daily),
        AsyncStorage.getItem(KEYS.dailyHour),
        AsyncStorage.getItem(KEYS.weekly),
        AsyncStorage.getItem(KEYS.budget),
        AsyncStorage.getItem(KEYS.sat),
      ]);
      setDailyOn(daily === 'true');
      setDailyHour(hour ? parseInt(hour, 10) : 20);
      setWeeklyOn(weekly === 'true');
      setBudgetOn(budget !== 'false'); // default true
      setSatOn(sat === 'true');
      setLoaded(true);
    })();
  }, []);

  const applySchedules = async (
    daily: boolean,
    hour: number,
    weekly: boolean,
    sat: boolean,
  ) => {
    if (!daily && !weekly && !sat) {
      cancelAllReminders();
      return;
    }
    if (daily) scheduleDailyReminder(hour);
    else cancelAllReminders();
    if (weekly) scheduleWeeklySummary();
    if (sat && hasSatRegime) scheduleSatDeadlines(fiscalRegime);
  };

  const toggleDaily = async (value: boolean) => {
    setDailyOn(value);
    await AsyncStorage.setItem(KEYS.daily, String(value));
    await applySchedules(value, dailyHour, weeklyOn, satOn);
  };

  const toggleWeekly = async (value: boolean) => {
    setWeeklyOn(value);
    await AsyncStorage.setItem(KEYS.weekly, String(value));
    await applySchedules(dailyOn, dailyHour, value, satOn);
  };

  const toggleBudget = async (value: boolean) => {
    setBudgetOn(value);
    await AsyncStorage.setItem(KEYS.budget, String(value));
  };

  const toggleSat = async (value: boolean) => {
    setSatOn(value);
    await AsyncStorage.setItem(KEYS.sat, String(value));
    await applySchedules(dailyOn, dailyHour, weeklyOn, value);
  };

  const pickHour = () => {
    const options = [...HOURS.map(formatHour), 'Cancelar'];
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        { options, cancelButtonIndex: options.length - 1, title: '¿A qué hora quieres el recordatorio?' },
        async idx => {
          if (idx === options.length - 1) return;
          const selected = HOURS[idx];
          setDailyHour(selected);
          await AsyncStorage.setItem(KEYS.dailyHour, String(selected));
          if (dailyOn) scheduleDailyReminder(selected);
        },
      );
    } else {
      Alert.alert(
        'Elige la hora',
        undefined,
        HOURS.map(h => ({
          text: formatHour(h),
          onPress: async () => {
            setDailyHour(h);
            await AsyncStorage.setItem(KEYS.dailyHour, String(h));
            if (dailyOn) scheduleDailyReminder(h);
          },
        })),
      );
    }
  };

  if (!loaded) return null;

  return (
    <ScreenContainer>
      <Text style={s.sectionLabel}>RECORDATORIOS</Text>
      <View style={s.card}>
        {/* Daily reminder */}
        <View style={s.row}>
          <View style={s.iconWrap}>
            <Icon name="bell-ring-outline" size={18} color="#F59E0B" />
          </View>
          <View style={s.rowBody}>
            <Text style={s.rowTitle}>Recordatorio diario</Text>
            <Text style={s.rowSub}>Te recordamos registrar tus gastos del día</Text>
          </View>
          <Switch value={dailyOn} onValueChange={toggleDaily} trackColor={{ true: colors.primary }} />
        </View>

        {dailyOn && (
          <>
            <View style={s.divider} />
            <Pressable style={s.row} onPress={pickHour}>
              <View style={[s.iconWrap, { backgroundColor: '#F59E0B18' }]}>
                <Icon name="clock-outline" size={18} color="#F59E0B" />
              </View>
              <View style={s.rowBody}>
                <Text style={s.rowTitle}>Hora del recordatorio</Text>
                <Text style={[s.rowSub, { color: colors.primary }]}>{formatHour(dailyHour)}</Text>
              </View>
              <Icon name="chevron-right" size={18} color={colors.textMuted} />
            </Pressable>
          </>
        )}

        <View style={s.divider} />

        {/* Weekly summary */}
        <View style={s.row}>
          <View style={[s.iconWrap, { backgroundColor: '#8B5CF618' }]}>
            <Icon name="calendar-week" size={18} color="#8B5CF6" />
          </View>
          <View style={s.rowBody}>
            <Text style={s.rowTitle}>Resumen semanal</Text>
            <Text style={s.rowSub}>Domingo 10:00 AM — resumen de la semana</Text>
          </View>
          <Switch value={weeklyOn} onValueChange={toggleWeekly} trackColor={{ true: colors.primary }} />
        </View>
      </View>

      <Text style={s.sectionLabel}>ALERTAS</Text>
      <View style={s.card}>
        {/* Budget alerts */}
        <View style={s.row}>
          <View style={[s.iconWrap, { backgroundColor: '#EF444418' }]}>
            <Icon name="gauge-full" size={18} color="#EF4444" />
          </View>
          <View style={s.rowBody}>
            <Text style={s.rowTitle}>Alertas de presupuesto</Text>
            <Text style={s.rowSub}>Aviso cuando llegas al 80% o 100% de una categoría</Text>
          </View>
          <Switch value={budgetOn} onValueChange={toggleBudget} trackColor={{ true: colors.primary }} />
        </View>

        {hasSatRegime && (
          <>
            <View style={s.divider} />
            {/* SAT deadlines */}
            <View style={s.row}>
              <View style={[s.iconWrap, { backgroundColor: '#06B6D418' }]}>
                <Icon name="file-clock-outline" size={18} color="#06B6D4" />
              </View>
              <View style={s.rowBody}>
                <Text style={s.rowTitle}>Vencimientos SAT</Text>
                <Text style={s.rowSub}>Recordatorio 2 días antes de tu declaración</Text>
              </View>
              <Switch value={satOn} onValueChange={toggleSat} trackColor={{ true: colors.primary }} />
            </View>
          </>
        )}
      </View>

      <Text style={s.hint}>
        Los recordatorios se activan localmente en tu dispositivo y no requieren internet.
      </Text>
    </ScreenContainer>
  );
}

const useStyles = (colors: ColorPalette, isDark: boolean) =>
  StyleSheet.create({
    sectionLabel: {
      color: colors.textMuted,
      fontSize: 11,
      fontFamily: font.semibold,
      letterSpacing: 0.8,
      textTransform: 'uppercase',
      marginBottom: 6,
      marginLeft: 4,
    },
    card: {
      backgroundColor: isDark ? '#111111' : colors.surface,
      borderRadius: 18,
      overflow: 'hidden',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: isDark ? 0.2 : 0.05,
      shadowRadius: 6,
      elevation: 2,
      marginBottom: 20,
    },
    divider: {
      height: StyleSheet.hairlineWidth,
      backgroundColor: isDark ? '#1E1E1E' : colors.border,
      marginLeft: 60,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingVertical: 14,
      gap: 12,
    },
    iconWrap: {
      width: 36,
      height: 36,
      borderRadius: 10,
      backgroundColor: '#F59E0B18',
      alignItems: 'center',
      justifyContent: 'center',
    },
    rowBody: { flex: 1, gap: 2 },
    rowTitle: { color: colors.text, fontSize: 15, fontFamily: font.medium },
    rowSub: { color: colors.textMuted, fontSize: 12 },
    hint: {
      color: colors.textMuted,
      fontSize: 12,
      textAlign: 'center',
      paddingHorizontal: 20,
      lineHeight: 18,
    },
  });
