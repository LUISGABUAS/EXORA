import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { DeductibleSummary } from '../components/DeductibleSummary';
import { EmptyState } from '../components/EmptyState';
import { LineChart } from '../components/LineChart';
import { PieChart } from '../components/PieChart';
import { ScreenContainer } from '../components/ScreenContainer';
import { SimpleBarChart } from '../components/SimpleBarChart';
import { StatCard } from '../components/StatCard';
import { useExpenseStore } from '../store/useExpenseStore';
import { ColorPalette } from '../theme/colors';
import { useTheme } from '../theme/ThemeContext';
import { shadows } from '../theme/spacing';
import { ExpenseCategory } from '../types/expense';
import { formatCurrency, localDateString } from '../utils/format';
import { monthlyDeductibleTotal } from '../utils/tax';

const CATEGORY_COLORS: Record<ExpenseCategory, string> = {
  Comida: '#0f766e',
  Transporte: '#355c7d',
  Entretenimiento: '#c96f3b',
  Salud: '#b42318',
  Educacion: '#7c3aed',
  Otros: '#74685f',
};

export function DashboardScreen() {
  const { colors, isDark } = useTheme();
  const s = useStyles(colors, isDark);
  const expenses = useExpenseStore((state) => state.expenses);

  const now = new Date();
  const todayStr = localDateString(now);
  const monthPrefix = todayStr.slice(0, 7);

  const weekDates = Array.from({ length: 7 }).map((_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - (6 - i));
    return localDateString(d);
  });
  const weekStart = weekDates[0];

  const daily = expenses.filter(e => e.date.startsWith(todayStr)).reduce((sum, e) => sum + e.amount, 0);
  const weekly = expenses.filter(e => e.date >= weekStart && e.date <= todayStr).reduce((sum, e) => sum + e.amount, 0);
  const monthly = expenses.filter(e => e.date.startsWith(monthPrefix)).reduce((sum, e) => sum + e.amount, 0);
  const deductibleMonth = monthlyDeductibleTotal(expenses);

  const chartData = weekDates.map(dateStr => ({
    label: String(Number(dateStr.slice(8, 10))),
    value: expenses.filter(e => e.date.startsWith(dateStr)).reduce((sum, e) => sum + e.amount, 0),
  }));

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
    const weeks: Array<{ label: string; value: number }> = [];
    for (let w = 3; w >= 0; w--) {
      const wEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate() - w * 7);
      const wStart = new Date(wEnd.getFullYear(), wEnd.getMonth(), wEnd.getDate() - 6);
      const startStr = localDateString(wStart);
      const endStr = localDateString(wEnd);
      const total = expenses
        .filter(e => e.date >= startStr && e.date <= endStr)
        .reduce((sum, e) => sum + e.amount, 0);
      weeks.push({
        label: `S${4 - w}`,
        value: total,
      });
    }
    return weeks;
  }, [expenses, now]);

  return (
    <ScreenContainer>
      <Animated.View entering={FadeInDown.duration(400).springify()} style={s.hero}>
        <Text style={s.title}>Expensia</Text>
        <Text style={s.subtitle}>Controla gastos, tickets y deducciones en un solo lugar.</Text>
      </Animated.View>

      {expenses.length === 0 ? (
        <EmptyState
          icon="wallet-outline"
          title="Sin gastos registrados"
          message="Escanea un ticket o agrega un gasto manual para comenzar."
        />
      ) : (
        <>
          <DeductibleSummary expenses={expenses} />

          <View style={s.statsGrid}>
            <StatCard label="Hoy" value={formatCurrency(daily)} tone="primary" icon="calendar-today" />
            <StatCard label="Semana" value={formatCurrency(weekly)} tone="secondary" icon="calendar-week" />
            <StatCard label="Mes" value={formatCurrency(monthly)} tone="accent" icon="calendar-month" />
          </View>

          {categoryBreakdown.length > 0 ? (
            <PieChart data={categoryBreakdown} />
          ) : null}

          <SimpleBarChart data={chartData} highlightLast />

          <LineChart data={weeklyTrend} title="Tendencia ultimas 4 semanas" />

          <View style={s.summaryCard}>
            <View style={s.summaryHeader}>
              <Icon name="shield-check-outline" size={22} color={colors.success} />
              <Text style={s.summaryTitle}>Resumen fiscal del mes</Text>
            </View>
            <Text style={s.summaryValue}>{formatCurrency(deductibleMonth)}</Text>
            <Text style={s.summaryCaption}>Gastos marcados como deducibles con RFC y/o CFDI.</Text>
          </View>
        </>
      )}
    </ScreenContainer>
  );
}

const useStyles = (colors: ColorPalette, isDark: boolean) =>
  StyleSheet.create({
    hero: { backgroundColor: isDark ? colors.surface : colors.text, borderRadius: 28, padding: 22, gap: 8 },
    title: { color: colors.white, fontSize: 30, fontWeight: '800' },
    subtitle: { color: isDark ? colors.textMuted : '#e7dcca', fontSize: 15, lineHeight: 22 },
    statsGrid: { flexDirection: 'row', gap: 10 },
    summaryCard: {
      borderRadius: 24,
      padding: 20,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      gap: 6,
      ...shadows.card,
    },
    summaryHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    summaryTitle: { color: colors.text, fontSize: 18, fontWeight: '700' },
    summaryValue: { color: colors.success, fontSize: 28, fontWeight: '800' },
    summaryCaption: { color: colors.textMuted, lineHeight: 20 },
  });
