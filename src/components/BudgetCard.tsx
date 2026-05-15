import React, { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useBudgetStore } from '../store/useBudgetStore';
import { useExpenseStore } from '../store/useExpenseStore';
import { ColorPalette } from '../theme/colors';
import { categoryIcons } from '../theme/icons';
import { useTheme } from '../theme/ThemeContext';
import { ExpenseCategory } from '../types/expense';
import { formatCurrency, localDateString } from '../utils/format';

const CATEGORY_COLORS: Record<ExpenseCategory, string> = {
  Comida: '#22C55E',
  Transporte: '#3B82F6',
  Entretenimiento: '#F59E0B',
  Salud: '#EF4444',
  Educacion: '#8B5CF6',
  Otros: '#8E8E93',
};

interface Props {
  onPress: () => void;
}

export function BudgetCard({ onPress }: Props) {
  const { colors } = useTheme();
  const s = useStyles(colors);
  const expenses = useExpenseStore(state => state.expenses);
  const budgets = useBudgetStore(state => state.budgets);

  const now = new Date();
  const monthPrefix = localDateString(now).slice(0, 7);

  const rows = useMemo(() => {
    const entries = Object.entries(budgets) as [ExpenseCategory, number][];
    if (entries.length === 0) return [];

    return entries
      .filter(([, limit]) => limit > 0)
      .map(([category, limit]) => {
        const spent = expenses
          .filter(e => e.date.startsWith(monthPrefix) && e.category === category)
          .reduce((sum, e) => sum + e.amount, 0);
        const pct = Math.min(spent / limit, 1);
        const status: 'ok' | 'warning' | 'over' =
          pct >= 1 ? 'over' : pct >= 0.75 ? 'warning' : 'ok';
        return { category, limit, spent, pct, status };
      })
      .sort((a, b) => b.pct - a.pct);
  }, [budgets, expenses, monthPrefix]);

  if (rows.length === 0) return null;

  const overCount = rows.filter(r => r.status === 'over').length;
  const warningCount = rows.filter(r => r.status === 'warning').length;

  const barColor = (status: 'ok' | 'warning' | 'over', catColor: string) => {
    if (status === 'over') return '#EF4444';
    if (status === 'warning') return '#F59E0B';
    return catColor;
  };

  return (
    <Pressable style={s.card} onPress={onPress}>
      <View style={s.header}>
        <View style={s.headerLeft}>
          <Icon name="gauge" size={20} color={colors.primary} />
          <Text style={s.title}>Presupuestos</Text>
        </View>
        <View style={s.headerRight}>
          {overCount > 0 ? (
            <View style={s.alertBadge}>
              <Icon name="alert-circle" size={12} color="#EF4444" />
              <Text style={s.alertBadgeText}>{overCount} excedido{overCount > 1 ? 's' : ''}</Text>
            </View>
          ) : warningCount > 0 ? (
            <View style={s.warningBadge}>
              <Icon name="alert" size={12} color="#F59E0B" />
              <Text style={s.warningBadgeText}>{warningCount} cerca</Text>
            </View>
          ) : null}
          <Icon name="chevron-right" size={18} color={colors.textMuted} />
        </View>
      </View>

      <View style={s.rows}>
        {rows.slice(0, 4).map(row => {
          const catColor = CATEGORY_COLORS[row.category];
          const fillColor = barColor(row.status, catColor);
          return (
            <View key={row.category} style={s.row}>
              <View style={s.rowLeft}>
                <Icon name={categoryIcons[row.category]} size={14} color={catColor} />
                <Text style={s.rowLabel}>{row.category}</Text>
              </View>
              <View style={s.barWrap}>
                <View style={s.barTrack}>
                  <View
                    style={[
                      s.barFill,
                      { width: `${row.pct * 100}%`, backgroundColor: fillColor },
                    ]}
                  />
                </View>
                <Text style={[s.rowPct, { color: fillColor }]}>
                  {formatCurrency(row.spent)}/{formatCurrency(row.limit)}
                </Text>
              </View>
            </View>
          );
        })}
        {rows.length > 4 ? (
          <Text style={s.moreText}>+{rows.length - 4} más</Text>
        ) : null}
      </View>
    </Pressable>
  );
}

const useStyles = (colors: ColorPalette) =>
  StyleSheet.create({
    card: {
      backgroundColor: colors.surface,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 16,
      gap: 12,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    headerLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    headerRight: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    title: {
      color: colors.text,
      fontSize: 15,
      fontWeight: '700',
    },
    alertBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      backgroundColor: '#EF444418',
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 999,
    },
    alertBadgeText: {
      color: '#EF4444',
      fontSize: 11,
      fontWeight: '700',
    },
    warningBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      backgroundColor: '#F59E0B18',
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 999,
    },
    warningBadgeText: {
      color: '#F59E0B',
      fontSize: 11,
      fontWeight: '700',
    },
    rows: {
      gap: 10,
    },
    row: {
      gap: 6,
    },
    rowLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    rowLabel: {
      color: colors.text,
      fontSize: 12,
      fontWeight: '600',
    },
    barWrap: {
      gap: 4,
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
    rowPct: {
      fontSize: 11,
      fontWeight: '600',
    },
    moreText: {
      color: colors.textMuted,
      fontSize: 12,
      textAlign: 'center',
    },
  });
