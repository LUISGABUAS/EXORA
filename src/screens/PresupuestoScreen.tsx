import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { ScreenContainer } from '../components/ScreenContainer';
import { notifyBudgetAlert } from '../services/notificationService';
import { useBudgetStore } from '../store/useBudgetStore';
import { useCustomCategoryStore } from '../store/useCustomCategoryStore';
import { useExpenseStore } from '../store/useExpenseStore';
import { ColorPalette } from '../theme/colors';
import { getCategoryIcon } from '../theme/icons';
import { font } from '../theme/typography';
import { useTheme } from '../theme/ThemeContext';
import { ExpenseCategory } from '../types/expense';
import { formatCurrency, localDateString } from '../utils/format';

const BUILTIN_CATEGORIES: ExpenseCategory[] = [
  'Comida', 'Transporte', 'Entretenimiento', 'Salud', 'Educacion', 'Otros',
];

const BUILTIN_COLORS: Record<ExpenseCategory, string> = {
  Comida: '#22C55E',
  Transporte: '#3B82F6',
  Entretenimiento: '#F59E0B',
  Salud: '#EF4444',
  Educacion: '#8B5CF6',
  Otros: '#8E8E93',
};

const MONTHS = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

export function PresupuestoScreen() {
  const { colors, isDark } = useTheme();
  const s = useStyles(colors, isDark);
  const expenses = useExpenseStore(state => state.expenses);
  const budgets = useBudgetStore(state => state.budgets);
  const setBudget = useBudgetStore(state => state.setBudget);
  const clearBudget = useBudgetStore(state => state.clearBudget);
  const customCategories = useCustomCategoryStore(state => state.categories);

  const now = new Date();
  const monthPrefix = localDateString(now).slice(0, 7);
  const monthLabel = `${MONTHS[now.getMonth()]} ${now.getFullYear()}`;

  // Todas las categorías: built-in + personalizadas
  const allCategories = useMemo(() => {
    const custom = customCategories.map(c => ({
      name: c.name,
      color: c.color,
      icon: c.icon,
    }));
    const builtin = BUILTIN_CATEGORIES.map(c => ({
      name: c,
      color: BUILTIN_COLORS[c],
      icon: getCategoryIcon(c),
    }));
    return [...builtin, ...custom];
  }, [customCategories]);

  const [inputs, setInputs] = useState<Record<string, string>>({});
  const [editing, setEditing] = useState<string | null>(null);

  const spentByCategory = useMemo(() => {
    const map: Record<string, number> = {};
    for (const cat of allCategories) {
      map[cat.name] = expenses
        .filter(e => e.date.startsWith(monthPrefix) && e.category === cat.name)
        .reduce((sum, e) => sum + e.amount, 0);
    }
    return map;
  }, [expenses, monthPrefix, allCategories]);

  const totalBudget = Object.values(budgets).reduce((s, v) => s + (v ?? 0), 0);
  const totalSpent = allCategories.reduce((s, cat) => s + (spentByCategory[cat.name] ?? 0), 0);
  const budgetedSpent = allCategories
    .filter(cat => (budgets[cat.name] ?? 0) > 0)
    .reduce((s, cat) => s + (spentByCategory[cat.name] ?? 0), 0);

  const handleEdit = (cat: string) => {
    setEditing(cat);
    setInputs(prev => ({ ...prev, [cat]: budgets[cat] ? String(budgets[cat]) : '' }));
  };

  const alertedRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    allCategories.forEach(cat => {
      const limit = budgets[cat.name] ?? 0;
      const spent = spentByCategory[cat.name] ?? 0;
      if (limit <= 0) return;
      const key = `${monthPrefix}-${cat.name}`;
      const pct = spent / limit;
      if (pct >= 0.8 && !alertedRef.current.has(key)) {
        alertedRef.current.add(key);
        notifyBudgetAlert(cat.name, spent, limit);
      }
    });
  }, [spentByCategory, budgets, monthPrefix, allCategories]);

  const handleSave = async (cat: string) => {
    const val = parseFloat((inputs[cat] ?? '').replace(/,/g, '.'));
    if (isNaN(val) || val < 0) {
      Alert.alert('Valor inválido', 'Ingresa un monto mayor a 0.');
      return;
    }
    if (val === 0) {
      await clearBudget(cat);
    } else {
      await setBudget(cat, val);
    }
    setEditing(null);
  };

  const handleClear = (cat: string) => {
    Alert.alert(
      'Eliminar presupuesto',
      `¿Quitar el presupuesto de ${cat}?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Eliminar', style: 'destructive', onPress: () => clearBudget(cat) },
      ],
    );
  };

  const barColor = (pct: number, catColor: string) => {
    if (pct >= 1) return '#EF4444';
    if (pct >= 0.75) return '#F59E0B';
    return catColor;
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScreenContainer>
        {/* Header summary */}
        <Animated.View entering={FadeInDown.duration(300)}>
          <View style={s.summaryCard}>
            <Text style={s.summaryMonth}>{monthLabel}</Text>
            {totalBudget > 0 ? (
              <>
                <View style={s.summaryRow}>
                  <View style={s.summaryItem}>
                    <Text style={s.summaryValue}>{formatCurrency(budgetedSpent)}</Text>
                    <Text style={s.summaryLabel}>Gastado (categorías con límite)</Text>
                  </View>
                  <View style={s.summaryDivider} />
                  <View style={s.summaryItem}>
                    <Text style={[s.summaryValue, { color: colors.primary }]}>
                      {formatCurrency(totalBudget)}
                    </Text>
                    <Text style={s.summaryLabel}>Total presupuestado</Text>
                  </View>
                </View>
                {/* Global progress bar */}
                <View style={s.globalTrack}>
                  <View
                    style={[
                      s.globalFill,
                      {
                        width: `${Math.min((budgetedSpent / totalBudget) * 100, 100)}%`,
                        backgroundColor: barColor(budgetedSpent / totalBudget, colors.primary),
                      },
                    ]}
                  />
                </View>
                <Text style={s.summaryHint}>
                  {formatCurrency(Math.max(totalBudget - budgetedSpent, 0))} disponibles · Total gastado este mes {formatCurrency(totalSpent)}
                </Text>
              </>
            ) : (
              <Text style={s.summaryEmpty}>
                Define límites por categoría para ver tu progreso aquí.
              </Text>
            )}
          </View>
        </Animated.View>

        {/* Category rows */}
        <View style={s.listCard}>
          {allCategories.map((cat, idx) => {
            const limit = budgets[cat.name] ?? 0;
            const spent = spentByCategory[cat.name] ?? 0;
            const pct = limit > 0 ? Math.min(spent / limit, 1) : 0;
            const fill = barColor(pct, cat.color);
            const isOver = pct >= 1;
            const isWarn = pct >= 0.75 && pct < 1;
            const isActive = editing === cat.name;

            return (
              <Animated.View
                key={cat.name}
                entering={FadeInDown.delay(idx * 40).duration(300)}
                style={[s.catRow, idx === allCategories.length - 1 && s.catRowLast]}
              >
                <View style={s.catHeader}>
                  <View style={[s.catIcon, { backgroundColor: cat.color + '18' }]}>
                    <Icon name={cat.icon} size={18} color={cat.color} />
                  </View>
                  <View style={s.catInfo}>
                    <Text style={s.catName}>{cat.name}</Text>
                    {limit > 0 ? (
                      <Text style={[s.catStatus, { color: isOver ? '#EF4444' : isWarn ? '#F59E0B' : colors.textMuted }]}>
                        {isOver
                          ? `Excedido por ${formatCurrency(spent - limit)}`
                          : isWarn
                          ? `Quedan ${formatCurrency(limit - spent)}`
                          : `${formatCurrency(spent)} de ${formatCurrency(limit)}`}
                      </Text>
                    ) : (
                      <Text style={s.catStatus}>Gastado: {formatCurrency(spent)} · Sin límite</Text>
                    )}
                  </View>
                  {limit > 0 ? (
                    <Pressable onPress={() => handleClear(cat.name)} hitSlop={8}>
                      <Icon name="close-circle-outline" size={18} color={colors.textMuted} />
                    </Pressable>
                  ) : null}
                </View>

                {limit > 0 ? (
                  <View style={s.barTrack}>
                    <View style={[s.barFill, { width: `${pct * 100}%`, backgroundColor: fill }]} />
                  </View>
                ) : null}

                {isActive ? (
                  <View style={s.inputRow}>
                    <TextInput
                      style={s.input}
                      value={inputs[cat.name] ?? ''}
                      onChangeText={v => setInputs(prev => ({ ...prev, [cat.name]: v }))}
                      keyboardType="decimal-pad"
                      placeholder="0.00"
                      placeholderTextColor={colors.textMuted}
                      autoFocus
                    />
                    <Pressable style={s.saveBtn} onPress={() => handleSave(cat.name)}>
                      <Icon name="check" size={18} color={colors.white} />
                      <Text style={s.saveBtnText}>Guardar</Text>
                    </Pressable>
                    <Pressable style={s.cancelBtn} onPress={() => setEditing(null)} hitSlop={8}>
                      <Icon name="close" size={18} color={colors.textMuted} />
                    </Pressable>
                  </View>
                ) : (
                  <Pressable style={s.editBtn} onPress={() => handleEdit(cat.name)}>
                    <Icon name={limit > 0 ? 'pencil-outline' : 'plus-circle-outline'} size={14} color={colors.primary} />
                    <Text style={s.editBtnText}>{limit > 0 ? 'Editar límite' : 'Agregar límite'}</Text>
                  </Pressable>
                )}
              </Animated.View>
            );
          })}
        </View>

        <View style={{ height: 32 }} />
      </ScreenContainer>
    </KeyboardAvoidingView>
  );
}

const useStyles = (colors: ColorPalette, _isDark: boolean) =>
  StyleSheet.create({
    summaryCard: {
      backgroundColor: colors.surface,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 18,
      gap: 12,
    },
    summaryMonth: {
      color: colors.textMuted,
      fontSize: 13,
      fontFamily: font.semibold,
    },
    summaryRow: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    summaryItem: {
      flex: 1,
      gap: 2,
    },
    summaryDivider: {
      width: 1,
      height: 36,
      backgroundColor: colors.border,
      marginHorizontal: 16,
    },
    summaryValue: {
      color: colors.text,
      fontSize: 22,
      fontFamily: font.extrabold,
    },
    summaryLabel: {
      color: colors.textMuted,
      fontSize: 11,
    },
    globalTrack: {
      height: 8,
      backgroundColor: colors.surfaceAlt,
      borderRadius: 4,
      overflow: 'hidden',
    },
    globalFill: {
      height: 8,
      borderRadius: 4,
    },
    summaryHint: {
      color: colors.textMuted,
      fontSize: 12,
    },
    summaryEmpty: {
      color: colors.textMuted,
      fontSize: 13,
      lineHeight: 20,
    },
    listCard: {
      backgroundColor: colors.surface,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: colors.border,
      overflow: 'hidden',
    },
    catRow: {
      paddingHorizontal: 16,
      paddingVertical: 14,
      gap: 10,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    catRowLast: {
      borderBottomWidth: 0,
    },
    catHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    catIcon: {
      width: 38,
      height: 38,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
    },
    catInfo: {
      flex: 1,
      gap: 2,
    },
    catName: {
      color: colors.text,
      fontSize: 15,
      fontFamily: font.bold,
    },
    catStatus: {
      color: colors.textMuted,
      fontSize: 12,
    },
    barTrack: {
      height: 6,
      backgroundColor: colors.surfaceAlt,
      borderRadius: 3,
      overflow: 'hidden',
    },
    barFill: {
      height: 6,
      borderRadius: 3,
    },
    inputRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    input: {
      flex: 1,
      backgroundColor: colors.surfaceAlt,
      borderWidth: 1,
      borderColor: colors.primary,
      borderRadius: 12,
      paddingHorizontal: 12,
      paddingVertical: 10,
      color: colors.text,
      fontSize: 16,
      fontFamily: font.bold,
    },
    saveBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      backgroundColor: colors.primary,
      paddingHorizontal: 14,
      paddingVertical: 10,
      borderRadius: 12,
    },
    saveBtnText: {
      color: colors.white,
      fontFamily: font.bold,
      fontSize: 14,
    },
    cancelBtn: {
      padding: 10,
    },
    editBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      alignSelf: 'flex-start',
      paddingVertical: 4,
    },
    editBtnText: {
      color: colors.primary,
      fontSize: 13,
      fontFamily: font.semibold,
    },
  });
