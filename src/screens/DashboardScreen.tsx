import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Keyboard,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { Avatar } from '../components/Avatar';
import { DashboardSkeleton } from '../components/DashboardSkeleton';
import { EmptyState } from '../components/EmptyState';
import { InsightCard } from '../components/InsightCard';
import { NewExpenseModal } from '../components/NewExpenseModal';
import { PaywallModal } from '../components/PaywallModal';
import { SmartInputBar } from '../components/SmartInputBar';
import { ScreenContainer } from '../components/ScreenContainer';
import { StreakBadge } from '../components/StreakBadge';
import { StreakCard } from '../components/StreakCard';
import { UndoToast } from '../components/UndoToast';
import { RootStackParamList, TabParamList } from '../navigation/AppNavigator';
import { useAuthStore } from '../store/useAuthStore';
import { useDeepLinkStore } from '../store/useDeepLinkStore';
import { useExpenseStore } from '../store/useExpenseStore';
import { useIncomeStore } from '../store/useIncomeStore';
import { usePremiumStore } from '../store/usePremiumStore';
import { ColorPalette } from '../theme/colors';
import { categoryIcons } from '../theme/icons';
import { useTheme } from '../theme/ThemeContext';
import { generateAIInsights, generateLocalInsights, Insight } from '../services/insightService';
import { font } from '../theme/typography';
import { ExpenseCategory } from '../types/expense';
import {
  INCOME_TYPE_ICONS,
  INCOME_TYPE_LABELS,
  IncomeType,
} from '../types/income';
import { formatCurrency, localDateString } from '../utils/format';
import { estimateTaxSavings } from '../utils/taxCalculator';

const MONTHS = [
  'Enero','Febrero','Marzo','Abril','Mayo','Junio',
  'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre',
];

const CATEGORY_COLORS: Record<ExpenseCategory, string> = {
  Comida: '#22C55E',
  Transporte: '#3B82F6',
  Entretenimiento: '#F59E0B',
  Salud: '#EF4444',
  Educacion: '#8B5CF6',
  Otros: '#8E8E93',
};

const INCOME_TYPES: IncomeType[] = [
  'honorarios','nomina','plataformas','arrendamiento','rendimientos','otros',
];

function getFirstName(session: any): string {
  if (!session?.user) return '';
  const meta = session.user.user_metadata;
  if (meta?.full_name) return meta.full_name.split(' ')[0];
  const email = session.user.email ?? '';
  if (!email.endsWith('@privaterelay.appleid.com')) return email.split('@')[0];
  return '';
}

function formatTime(createdAt: string): string {
  const now = new Date();
  const todayStr = localDateString(now);
  const yesterdayStr = localDateString(
    new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1),
  );
  const date = new Date(createdAt);
  const dateStr = localDateString(date);
  const h = date.getHours();
  const m = String(date.getMinutes()).padStart(2, '0');
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  if (dateStr === todayStr) return `Hoy ${h12}:${m} ${ampm}`;
  if (dateStr === yesterdayStr) return `Ayer`;
  return dateStr.slice(5).replace('-', '/');
}

export function DashboardScreen() {
  const { colors, isDark } = useTheme();
  const s = useStyles(colors, isDark);
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  const expenses = useExpenseStore(state => state.expenses);
  const loading = useExpenseStore(state => state.loading);
  const session = useAuthStore(state => state.session);
  const incomes = useIncomeStore(state => state.incomes);
  const addIncome = useIncomeStore(state => state.addIncome);
  const streak = usePremiumStore(state => state.streak);
  const fiscalRegime = usePremiumStore(state => state.fiscalRegime);
  const hasFullAccess = usePremiumStore(state => state.hasFullAccess);
  const premiumLoaded = usePremiumStore(state => state.loaded);

  const [modalVisible, setModalVisible] = useState(false);
  const [modalQuickMode, setModalQuickMode] = useState(false);
  const [paywallVisible, setPaywallVisible] = useState(false);
  const [incomeModalVisible, setIncomeModalVisible] = useState(false);
  const [incomeAmount, setIncomeAmount] = useState('');
  const [incomeType, setIncomeType] = useState<IncomeType>('honorarios');
  const [incomeSaving, setIncomeSaving] = useState(false);
  const incomeInputRef = useRef<TextInput>(null);

  const [toastVisible, setToastVisible] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [lastSavedId, setLastSavedId] = useState<number | null>(null);

  const pendingAction = useDeepLinkStore(state => state.pendingAction);
  const clearPendingAction = useDeepLinkStore(state => state.clearPendingAction);

  useEffect(() => {
    if (pendingAction === 'add-expense') {
      setModalQuickMode(true);
      setModalVisible(true);
      clearPendingAction();
    }
  }, [pendingAction, clearPendingAction]);

  const now = new Date();
  const todayStr = localDateString(now);
  const monthPrefix = todayStr.slice(0, 7);
  const currentMonth = MONTHS[now.getMonth()];
  const currentYear = now.getFullYear();

  // Prefijo del mes anterior
  const prevMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const prevMonthPrefix = `${prevMonthDate.getFullYear()}-${String(prevMonthDate.getMonth() + 1).padStart(2, '0')}`;
  const prevMonthLabel = MONTHS[prevMonthDate.getMonth()];

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
  const monthlyIncome = incomes
    .filter(i => i.date.startsWith(monthPrefix))
    .reduce((sum, i) => sum + i.amount, 0);

  // Sobrante del mes anterior
  const prevMonthExpenses = expenses
    .filter(e => e.date.startsWith(prevMonthPrefix))
    .reduce((sum, e) => sum + e.amount, 0);
  const prevMonthIncome = incomes
    .filter(i => i.date.startsWith(prevMonthPrefix))
    .reduce((sum, i) => sum + i.amount, 0);
  const rollover = Math.max(0, prevMonthIncome - prevMonthExpenses);

  const deductibleTotal = monthlyExpenses.filter(e => e.deductible).reduce((sum, e) => sum + e.amount, 0);
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

  const netFlow = monthlyIncome + rollover - monthly;

  const recentExpenses = useMemo(() => expenses.slice(0, 4), [expenses]);

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

  const topInsight: Insight | undefined = useMemo(
    () => [...localInsights, ...aiInsights][0],
    [localInsights, aiInsights],
  );

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

  const handleSaveIncome = async () => {
    const amount = parseFloat(incomeAmount.replace(/,/g, ''));
    if (!amount || amount <= 0) {
      Alert.alert('Monto inválido', 'Ingresa un monto mayor a cero.');
      return;
    }
    setIncomeSaving(true);
    try {
      await addIncome({
        amount,
        date: todayStr,
        type: incomeType,
        description: INCOME_TYPE_LABELS[incomeType],
        invoiced: false,
        recurring: false,
        paymentMethod: 'transferencia',
      });
      setIncomeAmount('');
      setIncomeType('honorarios');
      setIncomeModalVisible(false);
      setToastMessage('Ingreso guardado');
      setToastVisible(true);
    } catch {
      Alert.alert('Error', 'No se pudo guardar el ingreso.');
    } finally {
      setIncomeSaving(false);
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
            {/* Header */}
            <Animated.View entering={FadeIn.duration(300)} style={s.header}>
              <Pressable
                onPress={() => navigation.navigate('ProfileEdit')}
                style={s.headerLeft}
              >
                <Avatar size={40} name={firstName} />
                <View>
                  <Text style={s.headerGreeting}>
                    {firstName || 'Inicio'}
                  </Text>
                  <Text style={s.headerSub}>{currentMonth} {currentYear}</Text>
                </View>
              </Pressable>
              <StreakBadge streak={streak} />
            </Animated.View>

            {/* Smart Input */}
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
                {/* Hero Card */}
                <Animated.View entering={FadeInDown.delay(100).duration(400)}>
                  <View style={s.heroCard}>
                    <View style={s.heroCircle} />

                    {/* Gastos */}
                    <View style={s.heroSection}>
                      <Text style={s.heroLabel}>Gastos del mes</Text>
                      <Text style={s.heroAmount}>{formatCurrency(monthly)}</Text>
                      {weekPct > 0 && (
                        <View style={s.heroMeta}>
                          <View style={[s.heroDot, { backgroundColor: weekUp ? colors.danger : colors.success }]} />
                          <Text style={s.heroMetaText}>
                            {weekUp ? '+' : '-'}{formatCurrency(Math.abs(weekDiff))} vs semana pasada
                          </Text>
                        </View>
                      )}
                    </View>

                    <View style={s.heroDivider} />

                    {/* Ingresos */}
                    <View style={s.heroIncomeRow}>
                      <View>
                        <Text style={s.heroLabel}>Ingresos del mes</Text>
                        <Text style={[s.heroIncomeAmount, { color: monthlyIncome > 0 ? colors.success : colors.textMuted }]}>
                          {monthlyIncome > 0 ? formatCurrency(monthlyIncome) : '—'}
                        </Text>
                        {rollover > 0 && (
                          <View style={s.rolloverChip}>
                            <Icon name="arrow-up-right" size={10} color={colors.success} />
                            <Text style={s.rolloverText}>
                              +{formatCurrency(rollover)} de {prevMonthLabel}
                            </Text>
                          </View>
                        )}
                      </View>
                      <Pressable style={s.heroIncomeBtn} onPress={() => {
                        setIncomeModalVisible(true);
                        setTimeout(() => incomeInputRef.current?.focus(), 200);
                      }}>
                        <Icon name="plus" size={14} color="#fff" />
                        <Text style={s.heroIncomeBtnText}>Ingreso</Text>
                      </Pressable>
                    </View>
                  </View>
                </Animated.View>

                {/* Stats Row */}
                <Animated.View entering={FadeInDown.delay(150).duration(380)}>
                  <View style={s.statsRow}>
                    {/* Deducibles / Ahorro fiscal */}
                    <Pressable style={s.statCard} onPress={() => navigation.navigate('ReporteFiscal')}>
                      <Icon name="shield-check-outline" size={16} color="#8B5CF6" />
                      <Text style={s.statValue}>
                        {taxSavingsEstimate > 0 ? formatCurrency(taxSavingsEstimate) : formatCurrency(deductibleTotal)}
                      </Text>
                      <Text style={s.statLabel}>
                        {taxSavingsEstimate > 0 ? 'Ahorro fiscal' : 'Deducibles'}
                      </Text>
                    </Pressable>

                    {/* Flujo neto o esta semana */}
                    {monthlyIncome > 0 ? (
                      <Pressable style={s.statCard} onPress={() => navigation.navigate('Ingresos')}>
                        <Icon name="swap-vertical" size={16} color="#06B6D4" />
                        <Text style={[s.statValue, { color: netFlow >= 0 ? colors.success : colors.danger }]}>
                          {netFlow >= 0 ? '+' : ''}{formatCurrency(netFlow)}
                        </Text>
                        <Text style={s.statLabel}>Flujo neto</Text>
                      </Pressable>
                    ) : (
                      <Pressable style={s.statCard} onPress={() => navigation.navigate('Tabs', { screen: 'Movimientos' } as any)}>
                        <Icon name="calendar-week" size={16} color={colors.primary} />
                        <Text style={s.statValue}>{formatCurrency(thisWeek)}</Text>
                        <Text style={s.statLabel}>
                          Esta semana{weekPct > 0 ? ` · ${weekUp ? '+' : '-'}${weekPct.toFixed(0)}%` : ''}
                        </Text>
                      </Pressable>
                    )}
                  </View>
                </Animated.View>

                {/* Streak Card */}
                <StreakCard streak={streak} />

                {/* Recent Transactions */}
                <Animated.View entering={FadeInDown.delay(200).duration(350)}>
                  <View style={s.sectionRow}>
                    <Text style={s.sectionTitle}>Últimos movimientos</Text>
                    <Pressable onPress={() => navigation.navigate('Tabs', { screen: 'Movimientos' } as any)} hitSlop={8}>
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
                          onPress={() => navigation.navigate('ExpenseDetail', { expenseId: exp.id, startEditing: true })}
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

                {/* Top Insight */}
                {topInsight && (
                  <Animated.View entering={FadeInDown.delay(220).duration(350)}>
                    <Text style={[s.sectionTitle, { marginBottom: 8 }]}>Insight</Text>
                    <InsightCard
                      insight={topInsight}
                      index={0}
                      onPremiumPress={topInsight.isPremium && !hasFullAccess() ? () => setPaywallVisible(true) : undefined}
                    />
                  </Animated.View>
                )}

                {/* Conversion Banner */}
                {showConversionBanner && (
                  <Animated.View entering={FadeInDown.delay(230).duration(350)}>
                    <Pressable style={s.conversionBanner} onPress={() => setPaywallVisible(true)}>
                      <Icon name="file-chart-outline" size={20} color={colors.primary} />
                      <View style={s.conversionText}>
                        <Text style={s.conversionTitle}>
                          Tienes {formatCurrency(deductibleTotal)} en deducciones
                        </Text>
                        <Text style={s.conversionSub}>Exporta tu reporte fiscal al SAT con Pro →</Text>
                      </View>
                      <View style={s.conversionBadge}>
                        <Text style={s.conversionBadgeText}>Pro</Text>
                      </View>
                    </Pressable>
                  </Animated.View>
                )}

                {/* Quick Actions */}
                <Animated.View entering={FadeInDown.delay(240).duration(350)}>
                  <View style={s.quickRow}>
                    <Pressable style={s.quickCard} onPress={() => navigation.navigate('Asesor')}>
                      <View style={[s.quickIcon, { backgroundColor: colors.primary + '18' }]}>
                        <Icon name="brain" size={20} color={colors.primary} />
                      </View>
                      <Text style={s.quickLabel}>Asesor IA</Text>
                    </Pressable>

                    <Pressable style={s.quickCard} onPress={() => navigation.navigate('MisFacturas')}>
                      <View style={[s.quickIcon, { backgroundColor: '#3B82F620' }]}>
                        <Icon name="file-check-outline" size={20} color="#3B82F6" />
                      </View>
                      <Text style={s.quickLabel}>Facturas</Text>
                    </Pressable>

                    <Pressable style={s.quickCard} onPress={() => navigation.navigate('ReporteFiscal')}>
                      <View style={[s.quickIcon, { backgroundColor: '#8B5CF620' }]}>
                        <Icon name="chart-bar" size={20} color="#8B5CF6" />
                      </View>
                      <Text style={s.quickLabel}>Reporte</Text>
                    </Pressable>

                    <Pressable style={s.quickCard} onPress={navigateToScan}>
                      <View style={[s.quickIcon, { backgroundColor: '#F59E0B20' }]}>
                        <Icon name="scan-helper" size={20} color="#F59E0B" />
                      </View>
                      <Text style={s.quickLabel}>Escanear</Text>
                    </Pressable>
                  </View>
                </Animated.View>
              </>
            )}

            <View style={s.spacer} />
          </>
        )}
      </ScreenContainer>

      {/* Modals */}
      <NewExpenseModal
        visible={modalVisible}
        onClose={() => { setModalVisible(false); setModalQuickMode(false); }}
        onSaved={handleSaved}
        onScanPress={navigateToScan}
        quickMode={modalQuickMode}
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

      {/* Income Quick-Add Modal */}
      <Modal
        visible={incomeModalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setIncomeModalVisible(false)}
      >
        <Pressable style={s.modalOverlay} onPress={() => { Keyboard.dismiss(); setIncomeModalVisible(false); }}>
          <Pressable style={s.incomeSheet} onPress={e => e.stopPropagation()}>
            {/* Handle */}
            <View style={s.sheetHandle} />

            <Text style={s.sheetTitle}>Registrar ingreso</Text>

            {/* Amount input */}
            <View style={s.amountRow}>
              <Text style={s.currencySign}>$</Text>
              <TextInput
                ref={incomeInputRef}
                style={s.amountInput}
                value={incomeAmount}
                onChangeText={setIncomeAmount}
                keyboardType="decimal-pad"
                placeholder="0.00"
                placeholderTextColor={colors.textMuted}
                returnKeyType="done"
                onSubmitEditing={Keyboard.dismiss}
              />
            </View>

            {/* Type selector */}
            <Text style={s.typeLabel}>Tipo de ingreso</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.typePills} contentContainerStyle={{ gap: 8 }}>
              {INCOME_TYPES.map(type => (
                <Pressable
                  key={type}
                  style={[s.typePill, incomeType === type && s.typePillActive]}
                  onPress={() => setIncomeType(type)}
                >
                  <Icon
                    name={INCOME_TYPE_ICONS[type]}
                    size={14}
                    color={incomeType === type ? '#fff' : colors.textMuted}
                  />
                  <Text style={[s.typePillText, incomeType === type && s.typePillTextActive]}>
                    {INCOME_TYPE_LABELS[type]}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>

            {/* Save button */}
            <Pressable
              style={[s.saveIncomeBtn, incomeSaving && { opacity: 0.6 }]}
              onPress={handleSaveIncome}
              disabled={incomeSaving}
            >
              <Text style={s.saveIncomeBtnText}>
                {incomeSaving ? 'Guardando...' : 'Guardar ingreso'}
              </Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const useStyles = (colors: ColorPalette, isDark: boolean) =>
  StyleSheet.create({
    flex: { flex: 1 },

    // Header
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
    headerGreeting: { color: colors.text, fontSize: 18, fontFamily: font.extrabold, letterSpacing: -0.3 },
    headerSub: { color: colors.textMuted, fontSize: 12, fontFamily: font.medium, marginTop: 1 },

    // Hero card
    heroCard: {
      backgroundColor: isDark ? '#111111' : colors.surface,
      borderRadius: 24,
      padding: 22,
      overflow: 'hidden',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: isDark ? 0.3 : 0.07,
      shadowRadius: 12,
      elevation: 4,
    },
    heroCircle: {
      position: 'absolute',
      width: 200,
      height: 200,
      borderRadius: 100,
      backgroundColor: colors.primary + '08',
      top: -60,
      right: -50,
    },
    heroSection: { gap: 4 },
    heroLabel: {
      color: colors.textMuted,
      fontSize: 11,
      fontFamily: font.semibold,
      letterSpacing: 1,
      textTransform: 'uppercase',
    },
    heroAmount: {
      color: colors.text,
      fontSize: 42,
      fontFamily: font.black,
      letterSpacing: -2,
      marginTop: 2,
    },
    heroMeta: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
    heroDot: { width: 6, height: 6, borderRadius: 3 },
    heroMetaText: { color: colors.textMuted, fontSize: 13 },
    heroDivider: {
      height: StyleSheet.hairlineWidth,
      backgroundColor: isDark ? '#2A2A2A' : colors.border,
      marginVertical: 16,
    },
    heroIncomeRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    heroIncomeAmount: { fontSize: 22, fontFamily: font.extrabold, marginTop: 2 },
    rolloverChip: {
      flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 4,
      backgroundColor: colors.success + '15', borderRadius: 6,
      paddingHorizontal: 6, paddingVertical: 2, alignSelf: 'flex-start',
    },
    rolloverText: { fontSize: 10, fontFamily: font.semibold, color: colors.success },
    heroIncomeBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      backgroundColor: colors.success,
      paddingHorizontal: 14,
      paddingVertical: 9,
      borderRadius: 12,
    },
    heroIncomeBtnText: { color: '#fff', fontSize: 13, fontFamily: font.bold },

    // Stats Row
    statsRow: { flexDirection: 'row', gap: 10 },
    statCard: {
      flex: 1,
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
    statValue: { color: colors.text, fontSize: 20, fontFamily: font.extrabold, letterSpacing: -0.5, marginTop: 6 },
    statLabel: { color: colors.textMuted, fontSize: 12, fontFamily: font.medium },

    // Section header
    sectionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
    sectionTitle: { color: colors.text, fontSize: 16, fontWeight: '700', letterSpacing: -0.2 },
    sectionLink: { color: colors.primary, fontSize: 13, fontWeight: '600' },

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
    txItemLast: { borderBottomWidth: 0 },
    txIconWrap: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
    txInfo: { flex: 1, gap: 2 },
    txName: { color: colors.text, fontSize: 14, fontWeight: '600' },
    txMeta: { color: colors.textMuted, fontSize: 12 },
    txAmount: { color: colors.text, fontSize: 14, fontWeight: '700' },

    // Conversion banner
    conversionBanner: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      backgroundColor: colors.primary + '12',
      borderWidth: 1,
      borderColor: colors.primary + '30',
      borderRadius: 16,
      padding: 14,
    },
    conversionText: { flex: 1, gap: 2 },
    conversionTitle: { color: colors.text, fontSize: 13, fontWeight: '700' },
    conversionSub: { color: colors.primary, fontSize: 12, fontWeight: '500' },
    conversionBadge: { backgroundColor: colors.primary, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
    conversionBadgeText: { color: '#fff', fontSize: 11, fontWeight: '800' },

    // Quick actions
    quickRow: { flexDirection: 'row', gap: 10 },
    quickCard: { flex: 1, alignItems: 'center', gap: 8 },
    quickIcon: { width: 52, height: 52, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
    quickLabel: { color: colors.textMuted, fontSize: 11, fontFamily: font.medium, textAlign: 'center' },

    // Income modal
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
    incomeSheet: {
      backgroundColor: isDark ? '#141414' : '#fff',
      borderTopLeftRadius: 28,
      borderTopRightRadius: 28,
      padding: 24,
      paddingBottom: 40,
      gap: 16,
    },
    sheetHandle: { width: 36, height: 4, borderRadius: 2, backgroundColor: colors.border, alignSelf: 'center', marginBottom: 4 },
    sheetTitle: { color: colors.text, fontSize: 20, fontFamily: font.extrabold, letterSpacing: -0.5 },
    amountRow: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: isDark ? '#1E1E1E' : colors.background,
      borderRadius: 16,
      paddingHorizontal: 16,
      paddingVertical: 4,
      borderWidth: 1.5,
      borderColor: colors.primary + '40',
    },
    currencySign: { color: colors.textMuted, fontSize: 24, fontFamily: font.bold, marginRight: 4 },
    amountInput: {
      flex: 1,
      color: colors.text,
      fontSize: 32,
      fontFamily: font.extrabold,
      paddingVertical: 12,
      letterSpacing: -1,
    },
    typeLabel: { color: colors.textMuted, fontSize: 12, fontFamily: font.semibold, letterSpacing: 0.5, textTransform: 'uppercase' },
    typePills: { flexGrow: 0 },
    typePill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 12,
      backgroundColor: isDark ? '#1E1E1E' : colors.background,
      borderWidth: 1,
      borderColor: colors.border,
    },
    typePillActive: { backgroundColor: colors.primary, borderColor: colors.primary },
    typePillText: { color: colors.textMuted, fontSize: 13, fontFamily: font.medium },
    typePillTextActive: { color: '#fff', fontFamily: font.semibold },
    saveIncomeBtn: {
      backgroundColor: colors.success,
      borderRadius: 16,
      paddingVertical: 17,
      alignItems: 'center',
    },
    saveIncomeBtnText: { color: '#fff', fontSize: 16, fontFamily: font.bold },

    spacer: { height: 24 },
  });
