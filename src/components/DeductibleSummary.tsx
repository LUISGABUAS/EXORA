import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { Expense } from '../types/expense';
import { ColorPalette } from '../theme/colors';
import { useTheme } from '../theme/ThemeContext';
import { formatCurrency, localDateString } from '../utils/format';

interface DeductibleSummaryProps {
  expenses: Expense[];
}

type Period = 'today' | 'week';

export function DeductibleSummary({ expenses }: DeductibleSummaryProps) {
  const { colors, isDark } = useTheme();
  const s = useStyles(colors, isDark);
  const [period, setPeriod] = useState<Period>('today');

  const now = new Date();
  const todayStr = localDateString(now);
  const weekStart = localDateString(
    new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6),
  );

  const filtered =
    period === 'today'
      ? expenses.filter(e => e.date === todayStr)
      : expenses.filter(e => e.date >= weekStart && e.date <= todayStr);

  const deductible = filtered.filter(e => e.deductible).reduce((s, e) => s + e.amount, 0);
  const nonDeductible = filtered.filter(e => !e.deductible).reduce((s, e) => s + e.amount, 0);
  const total = deductible + nonDeductible;

  return (
    <View style={s.container}>
      <View style={s.header}>
        <Icon name="scale-balance" size={20} color={colors.text} />
        <Text style={s.title}>Resumen deducible</Text>
        <View style={s.toggle}>
          <Pressable
            style={[s.toggleBtn, period === 'today' && s.toggleBtnActive]}
            onPress={() => setPeriod('today')}
          >
            <Text style={[s.toggleText, period === 'today' && s.toggleTextActive]}>Hoy</Text>
          </Pressable>
          <Pressable
            style={[s.toggleBtn, period === 'week' && s.toggleBtnActive]}
            onPress={() => setPeriod('week')}
          >
            <Text style={[s.toggleText, period === 'week' && s.toggleTextActive]}>Semana</Text>
          </Pressable>
        </View>
      </View>

      <View style={s.columns}>
        <View style={s.column}>
          <View style={[s.indicator, { backgroundColor: colors.success }]} />
          <Text style={s.columnLabel}>Deducible</Text>
          <Text style={[s.columnValue, { color: colors.success }]}>
            {formatCurrency(deductible)}
          </Text>
        </View>
        <View style={s.column}>
          <View style={[s.indicator, { backgroundColor: colors.secondary }]} />
          <Text style={s.columnLabel}>No deducible</Text>
          <Text style={[s.columnValue, { color: colors.secondary }]}>
            {formatCurrency(nonDeductible)}
          </Text>
        </View>
        <View style={s.column}>
          <View style={[s.indicator, { backgroundColor: colors.text }]} />
          <Text style={s.columnLabel}>Total</Text>
          <Text style={[s.columnValue, { color: colors.text }]}>
            {formatCurrency(total)}
          </Text>
        </View>
      </View>
    </View>
  );
}

const useStyles = (colors: ColorPalette, _isDark: boolean) =>
  StyleSheet.create({
    container: {
      backgroundColor: colors.surface,
      borderRadius: 24,
      padding: 18,
      borderWidth: 1,
      borderColor: colors.border,
      gap: 14,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    title: {
      flex: 1,
      color: colors.text,
      fontWeight: '700',
      fontSize: 16,
    },
    toggle: {
      flexDirection: 'row',
      backgroundColor: colors.surfaceAlt,
      borderRadius: 10,
      padding: 2,
    },
    toggleBtn: {
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 8,
    },
    toggleBtnActive: {
      backgroundColor: colors.primary,
    },
    toggleText: {
      color: colors.textMuted,
      fontSize: 11,
      fontWeight: '700',
    },
    toggleTextActive: {
      color: colors.white,
    },
    columns: {
      flexDirection: 'row',
      gap: 8,
    },
    column: {
      flex: 1,
      alignItems: 'center',
      gap: 4,
    },
    indicator: {
      width: 24,
      height: 4,
      borderRadius: 2,
    },
    columnLabel: {
      color: colors.textMuted,
      fontSize: 11,
      fontWeight: '600',
    },
    columnValue: {
      fontSize: 16,
      fontWeight: '800',
    },
  });
