import React, { useEffect, useMemo, useState } from 'react';
import { FlatList, LayoutAnimation, Platform, Pressable, StyleSheet, Text, TextInput, UIManager, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { AmountRangeFilter } from '../components/AmountRangeFilter';
import { HistorySkeleton } from '../components/HistorySkeleton';
import { DateRangePicker } from '../components/DateRangePicker';
import { DeductibleSummary } from '../components/DeductibleSummary';
import { EmptyState } from '../components/EmptyState';
import { ExpenseCard } from '../components/ExpenseCard';
import { ExpenseForm } from '../components/ExpenseForm';
import { LineChart } from '../components/LineChart';
import { PaywallModal } from '../components/PaywallModal';
import { PieChart } from '../components/PieChart';
import { ScreenContainer } from '../components/ScreenContainer';
import { SimpleBarChart } from '../components/SimpleBarChart';
import { UndoToast } from '../components/UndoToast';
import { RootStackParamList } from '../navigation/AppNavigator';
import { useExpenseStore } from '../store/useExpenseStore';
import { usePremiumStore } from '../store/usePremiumStore';
import { ColorPalette } from '../theme/colors';
import { useTheme } from '../theme/ThemeContext';
import { categoryIcons } from '../theme/icons';
import { ExpenseCategory, ExpenseInput } from '../types/expense';
import { formatCurrency, localDateString } from '../utils/format';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const CATEGORY_COLORS: Record<ExpenseCategory, string> = {
  Comida: '#22C55E',
  Transporte: '#3B82F6',
  Entretenimiento: '#F59E0B',
  Salud: '#EF4444',
  Educacion: '#8B5CF6',
  Otros: '#8E8E93',
};

const categories: Array<ExpenseCategory | 'Todas'> = ['Todas', 'Comida', 'Transporte', 'Entretenimiento', 'Salud', 'Educacion', 'Otros'];

type SortMode = 'recent' | 'amount_desc' | 'amount_asc';
const sortOptions: Array<{ value: SortMode; label: string }> = [
  { value: 'recent', label: 'Más reciente' },
  { value: 'amount_desc', label: 'Mayor monto' },
  { value: 'amount_asc', label: 'Menor monto' },
];

const separatorStyle = { height: 12 };
function SeparatorComponent() {
  return <View style={separatorStyle} />;
}

export function HistoryScreen() {
  const { colors, isDark } = useTheme();
  const s = useStyles(colors, isDark);
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const expenses = useExpenseStore((state) => state.expenses);
  const loading = useExpenseStore((state) => state.loading);
  const addExpense = useExpenseStore((state) => state.addExpense);
  const removeExpense = useExpenseStore((state) => state.removeExpense);
  const hasFullAccess = usePremiumStore(state => state.hasFullAccess);
  const premiumLoaded = usePremiumStore(state => state.loaded);
  const [paywallVisible, setPaywallVisible] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [toastVisible, setToastVisible] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [lastSavedId, setLastSavedId] = useState<number | null>(null);
  const [query, setQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<ExpenseCategory | 'Todas'>('Todas');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showStats, setShowStats] = useState(false);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [minAmount, setMinAmount] = useState('');
  const [maxAmount, setMaxAmount] = useState('');
  const [sortMode, setSortMode] = useState<SortMode>('recent');

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (selectedCategory !== 'Todas') count++;
    if (query.trim()) count++;
    if (startDate || endDate) count++;
    if (minAmount || maxAmount) count++;
    return count;
  }, [selectedCategory, query, startDate, endDate, minAmount, maxAmount]);

  const clearFilters = () => {
    setQuery('');
    setSelectedCategory('Todas');
    setStartDate('');
    setEndDate('');
    setMinAmount('');
    setMaxAmount('');
    setSortMode('recent');
  };

  const filteredExpenses = useMemo(() => {
    let source = expenses;
    let result = source.filter(e => {
      const matchesQuery =
        !query ||
        `${e.merchantName} ${e.description} ${e.conceptsText}`.toLowerCase().includes(query.toLowerCase());
      const matchesCategory = selectedCategory === 'Todas' || e.category === selectedCategory;

      let matchesDate = true;
      if (startDate) matchesDate = matchesDate && e.date >= startDate;
      if (endDate) matchesDate = matchesDate && e.date <= endDate;

      let matchesAmount = true;
      if (minAmount) matchesAmount = matchesAmount && e.amount >= Number(minAmount);
      if (maxAmount) matchesAmount = matchesAmount && e.amount <= Number(maxAmount);

      return matchesQuery && matchesCategory && matchesDate && matchesAmount;
    });

    switch (sortMode) {
      case 'amount_desc':
        result = [...result].sort((a, b) => b.amount - a.amount);
        break;
      case 'amount_asc':
        result = [...result].sort((a, b) => a.amount - b.amount);
        break;
      case 'recent':
      default:
        result = [...result].sort((a, b) => b.date.localeCompare(a.date));
        break;
    }

    return result;
  }, [expenses, query, selectedCategory, startDate, endDate, minAmount, maxAmount, sortMode, hasFullAccess]);

  // Chart data computed from all expenses (not filtered)
  const now = new Date();
  const todayStr = localDateString(now);
  const monthPrefix = todayStr.slice(0, 7);

  const weekDates = useMemo(() => {
    const today = new Date();
    return Array.from({ length: 7 }).map((_, i) => {
      const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() - (6 - i));
      return localDateString(d);
    });
  }, []);

  const chartData = useMemo(() =>
    weekDates.map(dateStr => ({
      label: String(Number(dateStr.slice(8, 10))),
      value: expenses.filter(e => e.date.startsWith(dateStr)).reduce((sum, e) => sum + e.amount, 0),
    })),
  [expenses, weekDates]);

  const categoryBreakdown = useMemo(() => {
    const monthExpenses = expenses.filter(e => e.date.startsWith(monthPrefix));
    const groups: Record<string, number> = {};
    for (const e of monthExpenses) {
      groups[e.category] = (groups[e.category] || 0) + e.amount;
    }
    return Object.entries(groups)
      .map(([category, amount]) => ({
        category,
        amount,
        color: CATEGORY_COLORS[category as ExpenseCategory] || '#999',
      }))
      .sort((a, b) => b.amount - a.amount);
  }, [expenses, monthPrefix]);

  const weeklyTrend = useMemo(() => {
    const today = new Date();
    const weeks: Array<{ label: string; value: number }> = [];
    for (let w = 3; w >= 0; w--) {
      const wEnd = new Date(today.getFullYear(), today.getMonth(), today.getDate() - w * 7);
      const wStart = new Date(wEnd.getFullYear(), wEnd.getMonth(), wEnd.getDate() - 6);
      const wStartStr = localDateString(wStart);
      const wEndStr = localDateString(wEnd);
      const total = expenses
        .filter(e => e.date >= wStartStr && e.date <= wEndStr)
        .reduce((sum, e) => sum + e.amount, 0);
      weeks.push({ label: `S${4 - w}`, value: total });
    }
    return weeks;
  }, [expenses]);

  useEffect(() => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
  }, [filteredExpenses.length, showForm, showAdvanced, showStats]);

  const saveManualExpense = async (payload: ExpenseInput) => {
    await addExpense({ ...payload, source: 'manual' });
    const allExpenses = useExpenseStore.getState().expenses;
    const newId = Math.max(...allExpenses.map(e => e.id));
    setLastSavedId(newId);
    setShowForm(false);
    setToastMessage(`${formatCurrency(payload.amount)} ${payload.category} registrado`);
    setToastVisible(true);
  };

  const handleUndo = async () => {
    if (lastSavedId !== null) {
      await removeExpense(lastSavedId);
      setLastSavedId(null);
    }
  };

  const isLoading = !premiumLoaded || loading;

  return (
    <View style={s.flex}>
    <ScreenContainer>
      {isLoading ? (
        <HistorySkeleton />
      ) : (
      <>
      <View style={s.header}>
        <Text style={s.title}>Movimientos</Text>
        <Pressable style={s.addButton} onPress={() => setShowForm(v => !v)}>
          <Icon name={showForm ? 'close' : 'plus'} size={16} color={colors.white} />
          <Text style={s.addButtonText}>{showForm ? 'Cerrar' : 'Nuevo gasto'}</Text>
        </Pressable>
      </View>

      {/* Stats toggle */}
      {expenses.length > 0 ? (
        <Pressable
          style={s.statsToggle}
          onPress={() => setShowStats(v => !v)}
        >
          <Icon name="chart-arc" size={18} color={colors.primary} />
          <Text style={s.statsToggleText}>Estadísticas</Text>
          <Icon
            name={showStats ? 'chevron-up' : 'chevron-down'}
            size={20}
            color={colors.textMuted}
          />
        </Pressable>
      ) : null}

      {showStats && expenses.length > 0 ? (
        <View style={s.statsSection}>
          <DeductibleSummary expenses={expenses} />
          {categoryBreakdown.length > 0 ? (
            <PieChart data={categoryBreakdown} />
          ) : null}
          <SimpleBarChart data={chartData} highlightLast />
          <LineChart data={weeklyTrend} title="Tendencia últimas 4 semanas" />
        </View>
      ) : null}

      <View style={s.searchRow}>
        <Icon name="magnify" size={20} color={colors.textMuted} style={s.searchIcon} />
        <TextInput
          placeholder="Buscar por comercio o descripción"
          placeholderTextColor={colors.textMuted}
          style={s.search}
          value={query}
          onChangeText={setQuery}
        />
      </View>

      <View style={s.filters}>
        {categories.map(cat => {
          const iconName = cat === 'Todas' ? 'tag-multiple' : categoryIcons[cat];
          return (
            <Pressable
              key={cat}
              style={[s.chip, selectedCategory === cat && s.chipActive]}
              onPress={() => setSelectedCategory(cat)}
            >
              <Icon name={iconName} size={13} color={selectedCategory === cat ? colors.white : colors.text} />
              <Text style={[s.chipText, selectedCategory === cat && s.chipTextActive]}>{cat}</Text>
            </Pressable>
          );
        })}
      </View>

      {/* Advanced filters toggle */}
      <Pressable
        style={s.advancedToggle}
        onPress={() => setShowAdvanced(v => !v)}
      >
        <Icon name="filter-variant" size={18} color={colors.text} />
        <Text style={s.advancedToggleText}>Filtros avanzados</Text>
        {activeFilterCount > 0 ? (
          <View style={s.badge}>
            <Text style={s.badgeText}>{activeFilterCount}</Text>
          </View>
        ) : null}
        <Icon
          name={showAdvanced ? 'chevron-up' : 'chevron-down'}
          size={20}
          color={colors.textMuted}
        />
      </Pressable>

      {showAdvanced ? (
        <View style={s.advancedCard}>
          <DateRangePicker
            startDate={startDate}
            endDate={endDate}
            onChangeStart={setStartDate}
            onChangeEnd={setEndDate}
          />
          <AmountRangeFilter
            minAmount={minAmount}
            maxAmount={maxAmount}
            onChangeMin={setMinAmount}
            onChangeMax={setMaxAmount}
          />

          <Text style={s.sortLabel}>Ordenar por</Text>
          <View style={s.sortRow}>
            {sortOptions.map(opt => (
              <Pressable
                key={opt.value}
                style={[s.sortChip, sortMode === opt.value && s.sortChipActive]}
                onPress={() => setSortMode(opt.value)}
              >
                <Text style={[s.sortChipText, sortMode === opt.value && s.sortChipTextActive]}>
                  {opt.label}
                </Text>
              </Pressable>
            ))}
          </View>

          {activeFilterCount > 0 ? (
            <Pressable style={s.clearButton} onPress={clearFilters}>
              <Icon name="close-circle-outline" size={16} color={colors.danger} />
              <Text style={s.clearText}>Limpiar filtros</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}

      {showForm ? <ExpenseForm submitLabel="Guardar gasto manual" onSubmit={saveManualExpense} /> : null}

      <FlatList
        data={filteredExpenses}
        keyExtractor={item => String(item.id)}
        renderItem={({ item, index }) => (
          <ExpenseCard
            expense={item}
            index={index}
            onPress={() => navigation.navigate('ExpenseDetail', { expenseId: item.id })}
          />
        )}
        ItemSeparatorComponent={SeparatorComponent}
        ListEmptyComponent={
          expenses.length === 0 ? (
            <EmptyState
              variant="large"
              icon="receipt-text-outline"
              title="Sin movimientos aún"
              message="Registra tu primer gasto para comenzar a ver tu historial y estadísticas."
              actionLabel="Agregar gasto"
              onAction={() => setShowForm(true)}
            />
          ) : (
            <EmptyState
              icon="filter-remove-outline"
              title="Sin resultados"
              message={
                activeFilterCount > 0
                  ? 'Ningún gasto coincide con los filtros aplicados. Prueba cambiando el criterio de búsqueda.'
                  : 'No hay gastos en este período.'
              }
              actionLabel={activeFilterCount > 0 ? 'Limpiar filtros' : undefined}
              onAction={activeFilterCount > 0 ? clearFilters : undefined}
            />
          )
        }
        scrollEnabled={false}
      />
      {/* Upgrade banner for free users */}
      {null}

      <PaywallModal
        visible={paywallVisible}
        onClose={() => setPaywallVisible(false)}
        trigger="history"
      />
      </>
      )}
    </ScreenContainer>
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
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 },
    title: { flex: 1, color: colors.text, fontSize: 28, fontWeight: '800' },
    addButton: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.primary, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 999 },
    addButtonText: { color: colors.white, fontWeight: '700' },
    statsToggle: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      backgroundColor: colors.primaryGlow,
      borderRadius: 14,
      paddingHorizontal: 14,
      paddingVertical: 12,
    },
    statsToggleText: {
      flex: 1,
      color: colors.primary,
      fontWeight: '700',
      fontSize: 14,
    },
    statsSection: { gap: 12 },
    searchRow: { flexDirection: 'row', alignItems: 'center', borderRadius: 16, backgroundColor: colors.surfaceAlt, paddingHorizontal: 14 },
    searchIcon: { marginRight: 8 },
    search: { flex: 1, paddingVertical: 12, color: colors.text },
    filters: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    chip: { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: colors.surfaceAlt },
    chipActive: { backgroundColor: colors.primary },
    chipText: { color: colors.text, fontSize: 12, fontWeight: '600' },
    chipTextActive: { color: colors.white },
    advancedToggle: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingVertical: 4,
    },
    advancedToggleText: { flex: 1, color: colors.text, fontWeight: '600', fontSize: 14 },
    badge: {
      backgroundColor: colors.primary,
      borderRadius: 10,
      width: 20,
      height: 20,
      alignItems: 'center',
      justifyContent: 'center',
    },
    badgeText: { color: colors.white, fontSize: 11, fontWeight: '800' },
    advancedCard: {
      backgroundColor: colors.surface,
      borderRadius: 20,
      padding: 16,
      borderWidth: 1,
      borderColor: colors.border,
      gap: 14,
    },
    sortLabel: { color: colors.text, fontWeight: '700', fontSize: 14 },
    sortRow: { flexDirection: 'row', gap: 8 },
    sortChip: {
      paddingHorizontal: 12,
      paddingVertical: 7,
      borderRadius: 999,
      backgroundColor: colors.surfaceAlt,
    },
    sortChipActive: { backgroundColor: colors.primary },
    sortChipText: { color: colors.text, fontSize: 11, fontWeight: '600' },
    sortChipTextActive: { color: colors.white },
    clearButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 8 },
    clearText: { color: colors.danger, fontWeight: '600', fontSize: 13 },
    upgradeBanner: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      backgroundColor: colors.warning + '12',
      borderRadius: 14,
      paddingHorizontal: 14,
      paddingVertical: 12,
    },
    upgradeBannerText: {
      flex: 1,
      color: colors.text,
      fontSize: 13,
      fontWeight: '600',
    },
  });
