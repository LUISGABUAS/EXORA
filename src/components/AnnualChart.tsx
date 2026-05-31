import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { ColorPalette } from '../theme/colors';
import { useTheme } from '../theme/ThemeContext';
import { Expense } from '../types/expense';
import { formatCurrency } from '../utils/format';

const MONTH_LABELS = [
  'Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun',
  'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic',
];

interface Props {
  expenses: Expense[];
}

export function AnnualChart({ expenses }: Props) {
  const { colors, isDark } = useTheme();
  const s = useStyles(colors, isDark);

  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth(); // 0-indexed

  const monthlyTotals = useMemo(() => {
    const totals = new Array(12).fill(0) as number[];
    for (const expense of expenses) {
      if (!expense.date.startsWith(String(currentYear))) continue;
      const month = parseInt(expense.date.slice(5, 7), 10) - 1; // 0-indexed
      if (month >= 0 && month < 12) {
        totals[month] += expense.amount;
      }
    }
    return totals;
  }, [expenses, currentYear]);

  const maxAmount = Math.max(...monthlyTotals, 1);

  return (
    <View style={s.container}>
      <Text style={s.title}>Gasto anual {currentYear}</Text>
      {MONTH_LABELS.map((label, idx) => {
        const amount = monthlyTotals[idx];
        const isCurrentMonth = idx === currentMonth;
        const barWidthPct = (amount / maxAmount) * 100;

        return (
          <View key={label} style={s.row}>
            <Text style={[s.monthLabel, isCurrentMonth && s.monthLabelActive]}>
              {label}
            </Text>
            <View style={s.barTrack}>
              <View
                style={[
                  s.barFill,
                  {
                    width: `${barWidthPct}%`,
                    backgroundColor: isCurrentMonth
                      ? colors.primary
                      : colors.primary + '99',
                    opacity: isCurrentMonth ? 1 : 0.6,
                  },
                ]}
              />
            </View>
            <Text style={[s.amountLabel, isCurrentMonth && s.amountLabelActive]}>
              {amount > 0 ? formatCurrency(amount) : '—'}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

const useStyles = (colors: ColorPalette, _isDark: boolean) =>
  StyleSheet.create({
    container: {
      backgroundColor: colors.surface,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 18,
      gap: 10,
    },
    title: {
      color: colors.text,
      fontSize: 15,
      fontWeight: '700',
      marginBottom: 4,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    monthLabel: {
      color: colors.textMuted,
      fontSize: 12,
      fontWeight: '600',
      width: 30,
    },
    monthLabelActive: {
      color: colors.primary,
      fontWeight: '800',
    },
    barTrack: {
      flex: 1,
      height: 10,
      backgroundColor: colors.surfaceAlt,
      borderRadius: 5,
      overflow: 'hidden',
    },
    barFill: {
      height: 10,
      borderRadius: 5,
    },
    amountLabel: {
      color: colors.textMuted,
      fontSize: 11,
      fontWeight: '600',
      width: 80,
      textAlign: 'right',
    },
    amountLabelActive: {
      color: colors.primary,
      fontWeight: '800',
    },
  });
