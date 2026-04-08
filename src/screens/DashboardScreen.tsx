import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Animated, { FadeInDown } from 'react-native-reanimated';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { Avatar } from '../components/Avatar';
import { EmptyState } from '../components/EmptyState';
import { InsightCard } from '../components/InsightCard';
import { LineChart } from '../components/LineChart';
import { NewExpenseModal } from '../components/NewExpenseModal';
import { PaywallModal } from '../components/PaywallModal';
import { SmartInputBar } from '../components/SmartInputBar';
import { ScreenContainer } from '../components/ScreenContainer';
import { StreakBadge } from '../components/StreakBadge';
import { TaxSavingsCard } from '../components/TaxSavingsCard';
import { UndoToast } from '../components/UndoToast';
import { RootStackParamList, TabParamList } from '../navigation/AppNavigator';
import { useAuthStore } from '../store/useAuthStore';
import { useExpenseStore } from '../store/useExpenseStore';
import { usePremiumStore } from '../store/usePremiumStore';
import { ColorPalette } from '../theme/colors';
import { categoryIcons } from '../theme/icons';
import { useTheme } from '../theme/ThemeContext';
import { generateLocalInsights, Insight } from '../services/insightService';
import { ExpenseCategory } from '../types/expense';
import { formatCurrency, localDateString } from '../utils/format';

const MONTHS = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

const DAY_LABELS = ['L', 'M', 'Mi', 'J', 'V', 'S', 'D'];

const CATEGORY_COLORS: Record<ExpenseCategory, string> = {
  Comida: '#22C55E',
  Transporte: '#3B82F6',
  Entretenimiento: '#F59E0B',
  Salud: '#EF4444',
  Educacion: '#8B5CF6',
  Otros: '#8E8E93',
};

function getFirstName(session: any): string {
  if (!session?.user) return '';
  const meta = session.user.user_metadata;
  if (meta?.full_name) return meta.full_name.split(' ')[0];
  if (session.user.email) return session.user.email.split('@')[0];
  return '';
}

function formatTime(createdAt: string): string {
  const now = new Date();
  const todayStr = localDateString(now);
  const yesterdayStr = localDateString(
    new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1),
  );

  const dateStr = createdAt.slice(0, 10);
  const timePart = createdAt.slice(11, 16);
  const [hStr, mStr] = timePart.split(':');
  const h = parseInt(hStr || '0', 10);
  const m = mStr || '00';
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;

  if (dateStr === todayStr) return `Hoy, ${h12}:${m} ${ampm}`;
  if (dateStr === yesterdayStr) return `Ayer, ${h12}:${m} ${ampm}`;
  return `${dateStr.slice(5)}`;
}

export function DashboardScreen() {
  const { colors, isDark } = useTheme();
  const s = useStyles(colors, isDark);
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const expenses = useExpenseStore(state => state.expenses);
  const session = useAuthStore(state => state.session);

  const streak = usePremiumStore(state => state.streak);
  const fiscalRegime = usePremiumStore(state => state.fiscalRegime);
  const hasFullAccess = usePremiumStore(state => state.hasFullAccess);

  const [modalVisible, setModalVisible] = useState(false);
  const [paywallVisible, setPaywallVisible] = useState(false);
  const [toastVisible, setToastVisible] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [lastSavedId, setLastSavedId] = useState<number | null>(null);

  const now = new Date();
  const todayStr = localDateString(now);
  const monthPrefix = todayStr.slice(0, 7);
  const currentMonth = MONTHS[now.getMonth()];
  const currentYear = now.getFullYear();

  const weekStart = localDateString(
    new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6),
  );
  const prevWeekStart = localDateString(
    new Date(now.getFullYear(), now.getMonth(), now.getDate() - 13),
  );
  const prevWeekEnd = localDateString(
    new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7),
  );

  const monthly = expenses
    .filter(e => e.date.startsWith(monthPrefix))
    .reduce((sum, e) => sum + e.amount, 0);

  const thisWeek = expenses
    .filter(e => e.date >= weekStart && e.date <= todayStr)
    .reduce((sum, e) => sum + e.amount, 0);

  const prevWeek = expenses
    .filter(e => e.date >= prevWeekStart && e.date <= prevWeekEnd)
    .reduce((sum, e) => sum + e.amount, 0);

  const weekDiff = thisWeek - prevWeek;
  const weekPct = prevWeek > 0 ? Math.abs(weekDiff / prevWeek) * 100 : 0;
  const weekUp = weekDiff >= 0;

  const recentExpenses = useMemo(
    () => expenses.slice(0, 4),
    [expenses],
  );

  // Insights: local pattern analysis
  const insights: Insight[] = useMemo(() => {
    if (expenses.length === 0) return [];
    return generateLocalInsights(expenses, fiscalRegime, hasFullAccess());
  }, [expenses, fiscalRegime, hasFullAccess]);

  // Weekly chart data (last 7 days)
  const chartData = useMemo(() => {
    const today = new Date();
    return Array.from({ length: 7 }).map((_, i) => {
      const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() - (6 - i));
      const dateStr = localDateString(d);
      const dayIdx = (d.getDay() + 6) % 7; // Mon=0
      return {
        label: DAY_LABELS[dayIdx],
        value: expenses.filter(e => e.date.startsWith(dateStr)).reduce((sum, e) => sum + e.amount, 0),
      };
    });
  }, [expenses]);

  const firstName = getFirstName(session);

  const handleSaved = (message: string, expenseId: number) => {
    setLastSavedId(expenseId);
    setToastMessage(message);
    setToastVisible(true);
  };

  const handleInlineSave = (expenseId: number, message: string) => {
    setLastSavedId(expenseId);
    setToastMessage(message);
    setToastVisible(true);
  };

  const handleUndo = async () => {
    if (lastSavedId !== null) {
      await useExpenseStore.getState().removeExpense(lastSavedId);
      setLastSavedId(null);
    }
  };

  const navigateToScan = () => navigation.navigate('Scan');

  return (
    <View style={s.flex}>
      <ScreenContainer>
        {/* Header — Avatar + Greeting + Bell */}
        <Animated.View entering={FadeInDown.duration(300)}>
          <View style={s.headerRow}>
            <Pressable onPress={() => navigation.navigate('ProfileEdit')} style={s.headerTap}>
              <Avatar size={44} name={firstName} />
              <View style={s.greetingBlock}>
                <Text style={s.greeting}>
                  {firstName ? `Hola, ${firstName}` : 'Hola'}
                </Text>
                <Text style={s.monthLabel}>{currentMonth} {currentYear}</Text>
              </View>
            </Pressable>
            <StreakBadge streak={streak} />
            <Pressable hitSlop={8}>
              <Icon name="bell-outline" size={22} color={colors.textMuted} />
            </Pressable>
          </View>
        </Animated.View>

        {/* Smart Input Bar — always visible */}
        <Animated.View entering={FadeInDown.delay(50).duration(350)}>
          <SmartInputBar
            onSave={handleInlineSave}
            onScanPress={navigateToScan}
            onExpandPress={() => setModalVisible(true)}
          />
        </Animated.View>

        {/* Tax Savings Card */}
        <Animated.View entering={FadeInDown.delay(75).duration(350)}>
          <TaxSavingsCard
            expenses={expenses}
            regime={fiscalRegime}
            isPremium={hasFullAccess()}
            onUpgradePress={() => setPaywallVisible(true)}
          />
        </Animated.View>

        {expenses.length === 0 ? (
          <Animated.View entering={FadeInDown.delay(100).duration(350)}>
            <EmptyState
              icon="wallet-outline"
              title="Sin gastos registrados"
              message="Escribe tu primer gasto arriba para comenzar."
            />
          </Animated.View>
        ) : (
          <>
            {/* Monthly Summary Card */}
            <Animated.View entering={FadeInDown.delay(100).duration(350)}>
              <View style={s.summaryCard}>
                <Text style={s.summaryLabel}>Gastos este mes</Text>
                <View style={s.summaryRow}>
                  <Text style={s.summaryAmount}>{formatCurrency(monthly)}</Text>
                  {weekPct > 0 ? (
                    <View style={[s.pctBadge, weekUp ? s.pctBadgeUp : s.pctBadgeDown]}>
                      <Icon
                        name={weekUp ? 'arrow-up' : 'arrow-down'}
                        size={12}
                        color={weekUp ? colors.danger : colors.success}
                      />
                      <Text style={[s.pctText, { color: weekUp ? colors.danger : colors.success }]}>
                        {weekPct.toFixed(1)}%
                      </Text>
                    </View>
                  ) : null}
                </View>
                <View style={s.progressTrack}>
                  <View style={[s.progressFill, { width: `${Math.min((thisWeek / (prevWeek || thisWeek || 1)) * 100, 100)}%` }]} />
                </View>
                <Text style={s.compareText}>
                  vs semana pasada: {formatCurrency(Math.abs(weekDiff))} {weekUp ? 'más' : 'menos'}
                </Text>
              </View>
            </Animated.View>

            {/* Recent Transactions */}
            <Animated.View entering={FadeInDown.delay(150).duration(350)}>
              <View style={s.sectionHeader}>
                <Text style={s.sectionTitle}>Últimos movimientos</Text>
                <Pressable onPress={() => navigation.navigate('Tabs', { screen: 'Movimientos' })} hitSlop={6}>
                  <Text style={s.sectionLink}>Ver todos</Text>
                </Pressable>
              </View>
              <View style={s.recentList}>
                {recentExpenses.map((exp, idx) => {
                  const catColor = CATEGORY_COLORS[exp.category as ExpenseCategory] || colors.textMuted;
                  return (
                    <Pressable
                      key={exp.id}
                      style={[s.recentItem, idx === recentExpenses.length - 1 && s.recentItemLast]}
                      onPress={() => navigation.navigate('ExpenseDetail', { expenseId: exp.id })}
                    >
                      <View style={[s.recentIcon, { backgroundColor: catColor + '18' }]}>
                        <Icon
                          name={categoryIcons[exp.category as ExpenseCategory] || 'dots-horizontal-circle-outline'}
                          size={20}
                          color={catColor}
                        />
                      </View>
                      <View style={s.recentInfo}>
                        <Text style={s.recentName} numberOfLines={1}>
                          {exp.merchantName || exp.description || exp.category}
                        </Text>
                        <Text style={s.recentCategory}>
                          {exp.category} · {formatTime(exp.createdAt)}
                        </Text>
                      </View>
                      <Text style={s.recentAmount}>
                        -{formatCurrency(exp.amount)}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </Animated.View>

            {/* Insight Cards */}
            {insights.length > 0 ? (
              <View style={s.insightsContainer}>
                {insights.slice(0, 3).map((ins, idx) => (
                  <InsightCard
                    key={ins.id}
                    insight={ins}
                    index={idx}
                    onPremiumPress={ins.isPremium && !hasFullAccess() ? () => setPaywallVisible(true) : undefined}
                  />
                ))}
              </View>
            ) : null}

            {/* Weekly Chart */}
            <Animated.View entering={FadeInDown.delay(250).duration(350)}>
              <LineChart data={chartData} title="Últimos 7 días" />
            </Animated.View>
          </>
        )}

        <View style={s.spacer} />
      </ScreenContainer>

      {/* Modal */}
      <NewExpenseModal
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
        onSaved={handleSaved}
        onScanPress={navigateToScan}
      />

      {/* Paywall */}
      <PaywallModal
        visible={paywallVisible}
        onClose={() => setPaywallVisible(false)}
        trigger="tax_detail"
      />

      {/* Toast */}
      <UndoToast
        visible={toastVisible}
        message={toastMessage}
        onUndo={handleUndo}
        onDismiss={() => setToastVisible(false)}
      />
    </View>
  );
}

const useStyles = (colors: ColorPalette, _isDark: boolean) =>
  StyleSheet.create({
    flex: { flex: 1 },
    headerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    headerTap: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      flex: 1,
    },
    greetingBlock: {
      flex: 1,
      gap: 2,
    },
    greeting: {
      color: colors.text,
      fontSize: 20,
      fontWeight: '800',
    },
    monthLabel: {
      color: colors.textMuted,
      fontSize: 13,
    },
    summaryCard: {
      backgroundColor: colors.surface,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 18,
      gap: 8,
    },
    summaryLabel: {
      color: colors.textMuted,
      fontSize: 13,
      fontWeight: '600',
    },
    summaryRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    summaryAmount: {
      color: colors.text,
      fontSize: 32,
      fontWeight: '800',
    },
    pctBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 2,
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 999,
    },
    pctBadgeUp: {
      backgroundColor: '#EF444418',
    },
    pctBadgeDown: {
      backgroundColor: '#22C55E18',
    },
    pctText: {
      fontSize: 12,
      fontWeight: '700',
    },
    progressTrack: {
      height: 4,
      backgroundColor: colors.border,
      borderRadius: 2,
    },
    progressFill: {
      height: 4,
      backgroundColor: colors.primary,
      borderRadius: 2,
    },
    compareText: {
      color: colors.textMuted,
      fontSize: 12,
    },
    sectionHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 10,
    },
    sectionTitle: {
      color: colors.text,
      fontSize: 16,
      fontWeight: '700',
    },
    sectionLink: {
      color: colors.primary,
      fontSize: 13,
      fontWeight: '600',
    },
    recentList: {
      backgroundColor: colors.surface,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: colors.border,
      overflow: 'hidden',
    },
    recentItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingHorizontal: 14,
      paddingVertical: 14,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    recentIcon: {
      width: 40,
      height: 40,
      borderRadius: 20,
      alignItems: 'center',
      justifyContent: 'center',
    },
    recentInfo: {
      flex: 1,
      gap: 2,
    },
    recentName: {
      color: colors.text,
      fontSize: 14,
      fontWeight: '600',
    },
    recentCategory: {
      color: colors.textMuted,
      fontSize: 12,
    },
    recentAmount: {
      color: colors.text,
      fontSize: 15,
      fontWeight: '700',
    },
    recentItemLast: {
      borderBottomWidth: 0,
    },
    insightsContainer: {
      gap: 10,
    },
    spacer: { height: 24 },
  });
