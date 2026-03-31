import React, { useEffect, useMemo, useState } from 'react';
import { Alert, FlatList, LayoutAnimation, Platform, Pressable, StyleSheet, Text, TextInput, UIManager, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { AmountRangeFilter } from '../components/AmountRangeFilter';
import { DateRangePicker } from '../components/DateRangePicker';
import { EmptyState } from '../components/EmptyState';
import { ExpenseCard } from '../components/ExpenseCard';
import { ExpenseForm } from '../components/ExpenseForm';
import { ScreenContainer } from '../components/ScreenContainer';
import { RootStackParamList } from '../navigation/AppNavigator';
import { useExpenseStore } from '../store/useExpenseStore';
import { ColorPalette } from '../theme/colors';
import { useTheme } from '../theme/ThemeContext';
import { categoryIcons } from '../theme/icons';
import { ExpenseCategory, ExpenseInput } from '../types/expense';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const categories: Array<ExpenseCategory | 'Todas'> = ['Todas', 'Comida', 'Transporte', 'Entretenimiento', 'Salud', 'Educacion', 'Otros'];

type SortMode = 'recent' | 'amount_desc' | 'amount_asc';
const sortOptions: Array<{ value: SortMode; label: string }> = [
  { value: 'recent', label: 'Mas reciente' },
  { value: 'amount_desc', label: 'Mayor monto' },
  { value: 'amount_asc', label: 'Menor monto' },
];

export function HistoryScreen() {
  const { colors, isDark } = useTheme();
  const s = useStyles(colors, isDark);
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const expenses = useExpenseStore((state) => state.expenses);
  const addExpense = useExpenseStore((state) => state.addExpense);
  const [showForm, setShowForm] = useState(false);
  const [query, setQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<ExpenseCategory | 'Todas'>('Todas');
  const [showAdvanced, setShowAdvanced] = useState(false);
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
    let result = expenses.filter(e => {
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
  }, [expenses, query, selectedCategory, startDate, endDate, minAmount, maxAmount, sortMode]);

  useEffect(() => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
  }, [filteredExpenses.length, showForm, showAdvanced]);

  const saveManualExpense = async (payload: ExpenseInput) => {
    await addExpense({ ...payload, source: 'manual' });
    setShowForm(false);
    Alert.alert('Guardado', 'El gasto manual fue registrado.');
  };

  return (
    <ScreenContainer>
      <View style={s.header}>
        <Text style={s.title}>Historial de gastos</Text>
        <Pressable style={s.addButton} onPress={() => setShowForm(v => !v)}>
          <Icon name={showForm ? 'close' : 'plus'} size={16} color={colors.white} />
          <Text style={s.addButtonText}>{showForm ? 'Cerrar' : 'Nuevo gasto'}</Text>
        </Pressable>
      </View>

      <View style={s.searchRow}>
        <Icon name="magnify" size={20} color={colors.textMuted} style={s.searchIcon} />
        <TextInput
          placeholder="Buscar por comercio o descripcion"
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
        ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
        ListEmptyComponent={
          <EmptyState
            icon="receipt"
            title="Sin resultados"
            message="Aun no hay gastos para este filtro. Agrega uno nuevo o cambia el filtro."
          />
        }
        scrollEnabled={false}
      />
    </ScreenContainer>
  );
}

const useStyles = (colors: ColorPalette, isDark: boolean) =>
  StyleSheet.create({
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 },
    title: { flex: 1, color: colors.text, fontSize: 28, fontWeight: '800' },
    addButton: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.secondary, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 999 },
    addButtonText: { color: colors.white, fontWeight: '700' },
    searchRow: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: colors.border, borderRadius: 16, backgroundColor: colors.surface, paddingHorizontal: 14 },
    searchIcon: { marginRight: 8 },
    search: { flex: 1, paddingVertical: 12, color: colors.text },
    filters: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    chip: { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: colors.surfaceAlt },
    chipActive: { backgroundColor: colors.accent },
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
  });
