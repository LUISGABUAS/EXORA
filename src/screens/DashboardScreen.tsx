import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Animated, { FadeIn, FadeInDown, FadeInUp } from 'react-native-reanimated';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { Avatar } from '../components/Avatar';
import { DashboardSkeleton } from '../components/DashboardSkeleton';
import { EmptyState } from '../components/EmptyState';
import { InsightCard } from '../components/InsightCard';
import { LineChart } from '../components/LineChart';
import { NewExpenseModal } from '../components/NewExpenseModal';
import { PaywallModal } from '../components/PaywallModal';
import { SmartInputBar } from '../components/SmartInputBar';
import { ScreenContainer } from '../components/ScreenContainer';
import { StreakBadge } from '../components/StreakBadge';
import { UndoToast } from '../components/UndoToast';
import { RootStackParamList, TabParamList } from '../navigation/AppNavigator';
import { useAuthStore } from '../store/useAuthStore';
import { useExpenseStore } from '../store/useExpenseStore';
import { usePremiumStore } from '../store/usePremiumStore';
import { ColorPalette } from '../theme/colors';
import { categoryIcons } from '../theme/icons';
import { useTheme } from '../theme/ThemeContext';
import { generateAIInsights, generateLocalInsights, Insight } from '../services/insightService';
import { font } from '../theme/typography';
import { ExpenseCategory } from '../types/expense';
import { formatCurrency, localDateString } from '../utils/format';
import { estimateTaxSavings } from '../utils/taxCalculator';

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

  if (dateStr === todayStr) return `Hoy ${h12}:${m} ${ampm}`;
  if (dateStr === yesterdayStr) return `Ayer`;
  return `${dateStr.slice(5).replace('-', '/')}`;
}

export function DashboardScreen() {
  const { colors, isDark } = useTheme();
  const s = useStyles(colors, isDark);
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const expenses = useExpenseStore(state => state.expenses);
  const loading = useExpenseStore(state => state.loading);
  const session = useAuthStore(state => state.session);

  const streak = usePremiumStore(state => state.streak);
  const fiscalRegime = usePremiumStore(state => state.fiscalRegime);
  const hasFullAccess = usePremiumStore(state => state.hasFullAccess);
  const premiumLoaded = usePremiumStore(state => state.loaded);

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

  const monthlyExpenses = expenses.filter(e => e.date.startsWith(monthPrefix));

  const monthly = monthlyExpenses.reduce((sum, e) => sum + e.amount, 0);

  const deductibleTotal = monthlyExpenses
    .filter(e => e.deductible)
    .reduce((sum, e) => sum + e.amount, 0);

  const taxSavingsEstimate = estimateTaxSavings(deductibleTotal, fiscalRegime);
  const showConversionBanner = !hasFullAccess() && deductibleTotal >= 500 && fiscalRegime !== 'no_facturo';

  const thisWeek = expenses
    .filter(e => e.date >= weekStart && e.date <= todayStr)
    .reduce((sum, e) => sum + e.amount, 0);

  const prevWeek = expenses
    .filter(e => e.date >= prevWeekStart && e.date <= prevWeekEnd)
    .reduce((sum, e) => sum + e.amount, 0);

  const weekDiff = thisWeek - prevWeek;
  const weekPct = prevWeek > 0 ? Math.abs(weekDiff / prevWeek) * 100 : 0;
  const weekUp = weekDiff >= 0;

  const recentExpenses = useMemo(() => expenses.slice(0, 5), [expenses]);

  // Insights
  const localInsights: Insight[] = useMemo(() => {
    if (expenses.length === 0) return [];
    return generateLocalInsights(expenses, fiscalRegime, hasFullAccess());
  }, [expenses, fiscalRegime, hasFullAccess]);

  const [aiInsights, setAiInsights] = useState<Insight[]>([]);
  useEffect(() => {
    if (!hasFullAccess() || expenses.length < 3) return;
    const token = session?.access_token;
    if (!token) return;
    generateAIInsights(expenses, fiscalRegime, token)
      .then(setAiInsights)
      .catch(() => {});
  }, [expenses, fiscalRegime, hasFullAccess, session]);

  const insights: Insight[] = useMemo(
    () => [...localInsights, ...aiInsights],
    [localInsights, aiInsights],
  );

  // Weekly chart data (last 7 days)
  const chartData = useMemo(() => {
    const today = new Date();
    return Array.from({ length: 7 }).map((_, i) => {
      const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() - (6 - i));
      const dateStr = localDateString(d);
      const dayIdx = (d.getDay() + 6) % 7;
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

  const isLoading = !premiumLoaded || loading;

  return (
    <View style={s.flex}>
      <ScreenContainer>
        {isLoading ? (
          <DashboardSkeleton />
        ) : (
          <>
            {/* ── Header ── */}
            <Animated.View entering={FadeIn.duration(300)} style={s.header}>
              <Pressable onPress={() => navigation.navigate('ProfileEdit')} style={s.headerLeft}>
                <Avatar size={40} name={firstName} />
                <View>
                  <Text style={s.headerGreeting}>
                    {firstName ? `Hola, ${firstName}` : 'Hola'}
                  </Text>
                  <Text style={s.headerSub}>{currentMonth} {currentYear}</Text>
                </View>
              </Pressable>
              <StreakBadge streak={streak} />
            </Animated.View>

            {/* ── Smart Input ── */}
            <Animated.View entering={FadeInDown.delay(60).duration(350)}>
              <SmartInputBar
                onSave={handleInlineSave}
                onScanPress={navigateToScan}
                onExpandPress={() => setModalVisible(true)}
              />
            </Animated.View>

            {expenses.length === 0 ? (
              <Animated.View entering={FadeInDown.delay(100).duration(350)}>
                <EmptyState
                  variant="large"
                  icon="wallet-plus-outline"
                  title="¡Empieza a registrar!"
                  message="Aún no tienes gastos. Escribe tu primer gasto en la barra de arriba o escanea un recibo."
                  actionLabel="Nuevo gasto"
                  onAction={() => setModalVisible(true)}
                />
              </Animated.View>
            ) : (
              <>
                {/* ── Hero Card ── */}
                <Animated.View entering={FadeInDown.delay(100).duration(400)}>
                  <View style={s.heroCard}>
                    {/* Decorative circle */}
                    <View style={s.heroCircle} />
                    <View style={s.heroContent}>
                      <Text style={s.heroLabel}>Gastos del mes</Text>
                      <Text style={s.heroAmount}>{formatCurrency(monthly)}</Text>
                      <View style={s.heroMeta}>
                        <View style={[s.heroDot, { backgroundColor: weekUp ? colors.danger : colors.success }]} />
                        <Text style={s.heroMetaText}>
                          {weekUp ? '+' : '-'}{formatCurrency(Math.abs(weekDiff))} vs semana pasada
                        </Text>
                      </View>
                    </View>
                    <Pressable
                      style={s.heroScanBtn}
                      onPress={navigateToScan}
                    >
                      <Icon name="scan-helper" size={18} color={colors.primary} />
                      <Text style={s.heroScanText}>Escanear</Text>
                    </Pressable>
                  </View>
                </Animated.View>

                {/* ── Stats Grid 2×2 ── */}
                <Animated.View entering={FadeInDown.delay(150).duration(380)}>
                  <View style={s.grid}>
                    {/* Semana */}
                    <Pressable style={s.gridCard} onPress={() => navigation.navigate('Tabs', { screen: 'Movimientos' })}>
                      <Icon name="calendar-week" size={18} color={colors.primary} style={s.gridIcon} />
                      <Text style={s.gridValue}>{formatCurrency(thisWeek)}</Text>
                      <Text style={s.gridLabel}>Esta semana</Text>
                      {weekPct > 0 ? (
                        <View style={[s.gridBadge, { backgroundColor: weekUp ? '#EF444418' : '#22C55E18' }]}>
                          <Icon name={weekUp ? 'trending-up' : 'trending-down'} size={11} color={weekUp ? colors.danger : colors.success} />
                          <Text style={[s.gridBadgeText, { color: weekUp ? colors.danger : colors.success }]}>
                            {weekPct.toFixed(0)}%
                          </Text>
                        </View>
                      ) : null}
                    </Pressable>

                    {/* Ahorro fiscal */}
                    <Pressable style={s.gridCard} onPress={() => navigation.navigate('ReporteFiscal')}>
                      <Icon name="shield-check-outline" size={18} color="#8B5CF6" style={s.gridIcon} />
                      {taxSavingsEstimate > 0 ? (
                        <>
                          <Text style={s.gridValue}>{formatCurrency(taxSavingsEstimate)}</Text>
                          <Text style={s.gridLabel}>Ahorro fiscal</Text>
                          <View style={[s.gridBadge, { backgroundColor: '#8B5CF618' }]}>
                            <Text style={[s.gridBadgeText, { color: '#8B5CF6' }]}>estimado</Text>
                          </View>
                        </>
                      ) : (
                        <>
                          <Text style={s.gridValue}>{formatCurrency(deductibleTotal)}</Text>
                          <Text style={s.gridLabel}>Deducibles</Text>
                          <View style={[s.gridBadge, { backgroundColor: '#8B5CF618' }]}>
                            <Text style={[s.gridBadgeText, { color: '#8B5CF6' }]}>este mes</Text>
                          </View>
                        </>
                      )}
                    </Pressable>

                    {/* Racha */}
                    <Pressable style={s.gridCard} onPress={() => navigation.navigate('Presupuesto')}>
                      <Icon name="fire" size={18} color="#F59E0B" style={s.gridIcon} />
                      <Text style={s.gridValue}>{streak}</Text>
                      <Text style={s.gridLabel}>Días racha</Text>
                      <View style={[s.gridBadge, { backgroundColor: '#F59E0B18' }]}>
                        <Text style={[s.gridBadgeText, { color: '#F59E0B' }]}>consecutivos</Text>
                      </View>
                    </Pressable>

                    {/* Gastos */}
                    <Pressable style={s.gridCard} onPress={() => navigation.navigate('Tabs', { screen: 'Movimientos' })}>
                      <Icon name="receipt" size={18} color="#3B82F6" style={s.gridIcon} />
                      <Text style={s.gridValue}>{monthlyExpenses.length}</Text>
                      <Text style={s.gridLabel}>Gastos</Text>
                      <View style={[s.gridBadge, { backgroundColor: '#3B82F618' }]}>
                        <Text style={[s.gridBadgeText, { color: '#3B82F6' }]}>este mes</Text>
                      </View>
                    </Pressable>
                  </View>
                </Animated.View>

                {/* ── Recent Transactions ── */}
                <Animated.View entering={FadeInDown.delay(200).duration(350)}>
                  <View style={s.sectionRow}>
                    <Text style={s.sectionTitle}>Últimos movimientos</Text>
                    <Pressable onPress={() => navigation.navigate('Tabs', { screen: 'Movimientos' })} hitSlop={8}>
                      <Text style={s.sectionLink}>Ver todos →</Text>
                    </Pressable>
                  </View>
                  <View style={s.txList}>
                    {recentExpenses.map((exp, idx) => {
                      const catColor = CATEGORY_COLORS[exp.category as ExpenseCategory] || colors.textMuted;
                      return (
                        <Pressable
                          key={exp.id}
                          style={[s.txItem, idx === recentExpenses.length - 1 && s.txItemLast]}
                          onPress={() => navigation.navigate('ExpenseDetail', { expenseId: exp.id })}
                        >
                          <View style={[s.txIconWrap, { backgroundColor: catColor + '18' }]}>
                            <Icon
                              name={categoryIcons[exp.category as ExpenseCategory] || 'dots-horizontal-circle-outline'}
                              size={18}
                              color={catColor}
                            />
                          </View>
                          <View style={s.txInfo}>
                            <Text style={s.txName} numberOfLines={1}>
                              {exp.merchantName || exp.description || exp.category}
                            </Text>
                            <Text style={s.txMeta}>{exp.category} · {formatTime(exp.createdAt)}</Text>
                          </View>
                          <Text style={s.txAmount}>-{formatCurrency(exp.amount)}</Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </Animated.View>

                {/* ── Banner de conversión ── */}
                {showConversionBanner ? (
                  <Animated.View entering={FadeInDown.delay(220).duration(350)}>
                    <Pressable style={s.conversionBanner} onPress={() => setPaywallVisible(true)}>
                      <View style={s.conversionLeft}>
                        <Icon name="file-chart-outline" size={22} color={colors.primary} />
                        <View style={s.conversionText}>
                          <Text style={s.conversionTitle}>
                            Tienes {formatCurrency(deductibleTotal)} en deducciones
                          </Text>
                          <Text style={s.conversionSub}>
                            Exporta tu reporte fiscal al SAT con Pro →
                          </Text>
                        </View>
                      </View>
                      <View style={s.conversionBadge}>
                        <Text style={s.conversionBadgeText}>Pro</Text>
                      </View>
                    </Pressable>
                  </Animated.View>
                ) : null}

                {/* ── Insights ── */}
                {insights.length > 0 ? (
                  <Animated.View entering={FadeInDown.delay(230).duration(350)} style={s.insightsWrap}>
                    <Text style={s.sectionTitle}>Insights</Text>
                    <View style={s.insightsList}>
                      {(hasFullAccess() ? insights : insights.slice(0, 1)).map((ins, idx) => (
                        <InsightCard
                          key={ins.id}
                          insight={ins}
                          index={idx}
                          onPremiumPress={ins.isPremium && !hasFullAccess() ? () => setPaywallVisible(true) : undefined}
                        />
                      ))}
                      {!hasFullAccess() && insights.length > 1 ? (
                        <Pressable onPress={() => setPaywallVisible(true)} style={s.insightsLocked}>
                          <Icon name="lock-outline" size={16} color={colors.textMuted} />
                          <Text style={s.insightsLockedText}>+{insights.length - 1} insights con Pro</Text>
                        </Pressable>
                      ) : null}
                    </View>
                  </Animated.View>
                ) : null}

                {/* ── Weekly Chart ── */}
                <Animated.View entering={FadeInDown.delay(260).duration(350)}>
                  <LineChart data={chartData} title="Últimos 7 días" />
                </Animated.View>
              </>
            )}

            <View style={s.spacer} />
          </>
        )}
      </ScreenContainer>

      <NewExpenseModal
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
        onSaved={handleSaved}
        onScanPress={navigateToScan}
      />

      <PaywallModal
        visible={paywallVisible}
        onClose={() => setPaywallVisible(false)}
        trigger="tax_detail"
      />

      <UndoToast
        visible={toastVisible}
        message={toastMessage}
        onUndo={handleUndo}
        onDismiss={() => setToastVisible(false)}
      />
    </View>
  );
}

const useStyles = (colors: ColorPalette, isDark: boolean) =>
  StyleSheet.create({
    flex: { flex: 1 },

    // Header
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    headerLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      flex: 1,
    },
    headerGreeting: {
      color: colors.text,
      fontSize: 18,
      fontFamily: font.extrabold,
      letterSpacing: -0.3,
    },
    headerSub: {
      color: colors.textMuted,
      fontSize: 12,
      fontFamily: font.medium,
      marginTop: 1,
    },

    // Hero card
    heroCard: {
      backgroundColor: isDark ? '#111111' : colors.surface,
      borderRadius: 24,
      padding: 24,
      overflow: 'hidden',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: isDark ? 0.3 : 0.07,
      shadowRadius: 12,
      elevation: 4,
    },
    heroCircle: {
      position: 'absolute',
      width: 220,
      height: 220,
      borderRadius: 110,
      backgroundColor: colors.primary + '08',
      top: -60,
      right: -60,
    },
    heroContent: {
      gap: 4,
    },
    heroLabel: {
      color: colors.textMuted,
      fontSize: 11,
      fontFamily: font.semibold,
      letterSpacing: 1,
      textTransform: 'uppercase',
    },
    heroAmount: {
      color: colors.text,
      fontSize: 44,
      fontFamily: font.black,
      letterSpacing: -2,
      marginTop: 4,
    },
    heroMeta: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      marginTop: 6,
    },
    heroDot: {
      width: 6,
      height: 6,
      borderRadius: 3,
    },
    heroMetaText: {
      color: colors.textMuted,
      fontSize: 13,
    },
    heroScanBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      alignSelf: 'flex-start',
      marginTop: 20,
      backgroundColor: colors.primary + '15',
      paddingHorizontal: 14,
      paddingVertical: 9,
      borderRadius: 12,
    },
    heroScanText: {
      color: colors.primary,
      fontSize: 13,
      fontWeight: '700',
    },

    // 2×2 Grid
    grid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 10,
    },
    gridCard: {
      width: '48%',
      backgroundColor: isDark ? '#111111' : colors.surface,
      borderRadius: 20,
      padding: 16,
      gap: 4,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: isDark ? 0.25 : 0.05,
      shadowRadius: 8,
      elevation: 2,
    },
    gridIcon: {
      marginBottom: 6,
    },
    gridValue: {
      color: colors.text,
      fontSize: 22,
      fontFamily: font.extrabold,
      letterSpacing: -0.5,
    },
    gridLabel: {
      color: colors.textMuted,
      fontSize: 12,
      fontFamily: font.medium,
    },
    gridBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 3,
      alignSelf: 'flex-start',
      paddingHorizontal: 7,
      paddingVertical: 3,
      borderRadius: 8,
      marginTop: 4,
    },
    gridBadgeText: {
      fontSize: 11,
      fontWeight: '600',
    },

    // Sections
    sectionRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 10,
    },
    sectionTitle: {
      color: colors.text,
      fontSize: 16,
      fontWeight: '700',
      letterSpacing: -0.2,
    },
    sectionLink: {
      color: colors.primary,
      fontSize: 13,
      fontWeight: '600',
    },

    // Transactions
    txList: {
      backgroundColor: isDark ? '#111111' : colors.surface,
      borderRadius: 20,
      overflow: 'hidden',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: isDark ? 0.25 : 0.05,
      shadowRadius: 8,
      elevation: 2,
    },
    txItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingHorizontal: 16,
      paddingVertical: 14,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: isDark ? '#1E1E1E' : colors.border,
    },
    txItemLast: {
      borderBottomWidth: 0,
    },
    txIconWrap: {
      width: 38,
      height: 38,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
    },
    txInfo: {
      flex: 1,
      gap: 2,
    },
    txName: {
      color: colors.text,
      fontSize: 14,
      fontWeight: '600',
    },
    txMeta: {
      color: colors.textMuted,
      fontSize: 12,
    },
    txAmount: {
      color: colors.text,
      fontSize: 14,
      fontWeight: '700',
    },

    // Insights
    insightsWrap: {
      gap: 10,
    },
    insightsList: {
      gap: 8,
    },
    conversionBanner: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: colors.primary + '12',
      borderWidth: 1,
      borderColor: colors.primary + '30',
      borderRadius: 16,
      padding: 14,
      gap: 10,
    },
    conversionLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      flex: 1,
    },
    conversionText: {
      flex: 1,
      gap: 2,
    },
    conversionTitle: {
      color: colors.text,
      fontSize: 13,
      fontWeight: '700',
    },
    conversionSub: {
      color: colors.primary,
      fontSize: 12,
      fontWeight: '500',
    },
    conversionBadge: {
      backgroundColor: colors.primary,
      borderRadius: 8,
      paddingHorizontal: 8,
      paddingVertical: 3,
    },
    conversionBadgeText: {
      color: '#fff',
      fontSize: 11,
      fontWeight: '800',
    },
    insightsLocked: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingVertical: 10,
      paddingHorizontal: 14,
      borderRadius: 12,
      borderWidth: 1,
      borderStyle: 'dashed',
      borderColor: colors.border,
    },
    insightsLockedText: {
      color: colors.textMuted,
      fontSize: 13,
      fontWeight: '500',
    },

    spacer: { height: 24 },
  });
