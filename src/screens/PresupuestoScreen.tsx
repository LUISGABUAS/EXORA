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
import { useExpenseStore } from '../store/useExpenseStore';
import { ColorPalette } from '../theme/colors';
import { categoryIcons } from '../theme/icons';
import { font } from '../theme/typography';
import { useTheme } from '../theme/ThemeContext';
import { ExpenseCategory } from '../types/expense';
import { formatCurrency, localDateString } from '../utils/format';

const CATEGORIES: ExpenseCategory[] = [
  'Comida',
  'Transporte',
  'Entretenimiento',
  'Salud',
  'Educacion',
  'Otros',
];

const CATEGORY_COLORS: Record<ExpenseCategory, string> = {
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

  const now = new Date();
  const monthPrefix = localDateString(now).slice(0, 7);
  const monthLabel = `${MONTHS[now.getMonth()]} ${now.getFullYear()}`;

  // Local input state per category
  const [inputs, setInputs] = useState<Partial<Record<ExpenseCategory, string>>>({});
  const [editing, setEditing] = useState<ExpenseCategory | null>(null);

  const spentByCategory = useMemo(() => {
    const map: Partial<Record<ExpenseCategory, number>> = {};
    for (const cat of CATEGORIES) {
      map[cat] = expenses
        .filter(e => e.date.startsWith(monthPrefix) && e.category === cat)
        .reduce((sum, e) => sum + e.amount, 0);
    }
    return map;
  }, [expenses, monthPrefix]);

  const totalBudget = Object.values(budgets).reduce((s, v) => s + (v ?? 0), 0);
  const totalSpent = CATEGORIES.reduce((s, cat) => s + (spentByCategory[cat] ?? 0), 0);
  const budgetedSpent = CATEGORIES
    .filter(cat => (budgets[cat] ?? 0) > 0)
    .reduce((s, cat) => s + (spentByCategory[cat] ?? 0), 0);

  const handleEdit = (cat: ExpenseCategory) => {
    setEditing(cat);
    setInputs(prev => ({
      ...prev,
      [cat]: budgets[cat] ? String(budgets[cat]) : '',
    }));
  };

  // Alertas automáticas cuando el gasto supera 80% del presupuesto
  const alertedRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    CATEGORIES.forEach(cat => {
      const limit = budgets[cat] ?? 0;
      const spent = spentByCategory[cat] ?? 0;
      if (limit <= 0) return;
      const key = `${monthPrefix}-${cat}`;
      const pct = spent / limit;
      if (pct >= 0.8 && !alertedRef.current.has(key)) {
        alertedRef.current.add(key);
        notifyBudgetAlert(cat, spent, limit);
      }
    });
  }, [spentByCategory, budgets, monthPrefix]);

  const handleSave = async (cat: ExpenseCategory) => {
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

  const handleClear = (cat: ExpenseCategory) => {
    Alert.alert(
      'Eliminar presupuesto',
      `¿Quitar el presupuesto de ${cat}?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: () => clearBudget(cat),
        },
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
          {CATEGORIES.map((cat, idx) => {
            const catColor = CATEGORY_COLORS[cat];
            const limit = budgets[cat] ?? 0;
            const spent = spentByCategory[cat] ?? 0;
            const pct = limit > 0 ? Math.min(spent / limit, 1) : 0;
            const fill = barColor(pct, catColor);
            const isOver = pct >= 1;
            const isWarn = pct >= 0.75 && pct < 1;
            const isActive = editing === cat;

            return (
              <Animated.View
                key={cat}
                entering={FadeInDown.delay(idx * 40).duration(300)}
                style={[s.catRow, idx === CATEGORIES.length - 1 && s.catRowLast]}
              >
                {/* Icon + name */}
                <View style={s.catHeader}>
                  <View style={[s.catIcon, { backgroundColor: catColor + '18' }]}>
                    <Icon name={categoryIcons[cat]} size={18} color={catColor} />
                  </View>
                  <View style={s.catInfo}>
                    <Text style={s.catName}>{cat}</Text>
                    {limit > 0 ? (
                      <Text style={[s.catStatus, { color: isOver ? '#EF4444' : isWarn ? '#F59E0B' : colors.textMuted }]}>
                        {isOver
                          ? `Excedido por ${formatCurrency(spent - limit)}`
                          : isWarn
                          ? `Quedan ${formatCurrency(limit - spent)}`
                          : `${formatCurrency(spent)} de ${formatCurrency(limit)}`}
                      </Text>
                    ) : (
                      <Text style={s.catStatus}>
                        Gastado: {formatCurrency(spent)} · Sin límite
                      </Text>
                    )}
                  </View>
                  {limit > 0 ? (
                    <Pressable onPress={() => handleClear(cat)} hitSlop={8}>
                      <Icon name="close-circle-outline" size={18} color={colors.textMuted} />
                    </Pressable>
                  ) : null}
                </View>

                {/* Progress bar (only when limit set) */}
                {limit > 0 ? (
                  <View style={s.barTrack}>
                    <View
                      style={[
                        s.barFill,
                        { width: `${pct * 100}%`, backgroundColor: fill },
                      ]}
                    />
                  </View>
                ) : null}

                {/* Input */}
                {isActive ? (
                  <View style={s.inputRow}>
                    <TextInput
                      style={s.input}
                      value={inputs[cat] ?? ''}
                      onChangeText={v => setInputs(prev => ({ ...prev, [cat]: v }))}
                      keyboardType="decimal-pad"
                      placeholder="0.00"
                      placeholderTextColor={colors.textMuted}
                      autoFocus
                    />
                    <Pressable style={s.saveBtn} onPress={() => handleSave(cat)}>
                      <Icon name="check" size={18} color={colors.white} />
                      <Text style={s.saveBtnText}>Guardar</Text>
                    </Pressable>
                    <Pressable style={s.cancelBtn} onPress={() => setEditing(null)} hitSlop={8}>
                      <Icon name="close" size={18} color={colors.textMuted} />
                    </Pressable>
                  </View>
                ) : (
                  <Pressable style={s.editBtn} onPress={() => handleEdit(cat)}>
                    <Icon
                      name={limit > 0 ? 'pencil-outline' : 'plus-circle-outline'}
                      size={14}
                      color={colors.primary}
                    />
                    <Text style={s.editBtnText}>
                      {limit > 0 ? 'Editar límite' : 'Agregar límite'}
                    </Text>
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
