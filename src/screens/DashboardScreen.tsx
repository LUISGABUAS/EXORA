import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { ScreenContainer } from '../components/ScreenContainer';
import { SimpleBarChart } from '../components/SimpleBarChart';
import { StatCard } from '../components/StatCard';
import { useExpenseStore } from '../store/useExpenseStore';
import { colors } from '../theme/colors';
import { formatCurrency, localDateString } from '../utils/format';
import { monthlyDeductibleTotal } from '../utils/tax';

export function DashboardScreen() {
  const expenses = useExpenseStore((state) => state.expenses);

  const now = new Date();
  const todayStr = localDateString(now);
  const monthPrefix = todayStr.slice(0, 7);

  const weekDates = Array.from({ length: 7 }).map((_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - (6 - i));
    return localDateString(d);
  });
  const weekStart = weekDates[0];

  const daily = expenses.filter((e) => e.date.startsWith(todayStr)).reduce((s, e) => s + e.amount, 0);
  const weekly = expenses.filter((e) => e.date >= weekStart && e.date <= todayStr).reduce((s, e) => s + e.amount, 0);
  const monthly = expenses.filter((e) => e.date.startsWith(monthPrefix)).reduce((s, e) => s + e.amount, 0);
  const deductibleMonth = monthlyDeductibleTotal(expenses);

  const chartData = weekDates.map((dateStr) => ({
    label: String(Number(dateStr.slice(8, 10))),
    value: expenses.filter((e) => e.date.startsWith(dateStr)).reduce((s, e) => s + e.amount, 0),
  }));

  return (
    <ScreenContainer>
      <View style={styles.hero}>
        <Text style={styles.title}>SmartExpense MX</Text>
        <Text style={styles.subtitle}>Controla gastos, tickets y deducciones en un solo lugar.</Text>
      </View>

      <View style={styles.statsGrid}>
        <StatCard label="Hoy" value={formatCurrency(daily)} tone="primary" />
        <StatCard label="Semana" value={formatCurrency(weekly)} tone="secondary" />
        <StatCard label="Mes" value={formatCurrency(monthly)} tone="accent" />
      </View>

      <SimpleBarChart data={chartData} />

      <View style={styles.summaryCard}>
        <Text style={styles.summaryTitle}>Resumen fiscal del mes</Text>
        <Text style={styles.summaryValue}>{formatCurrency(deductibleMonth)}</Text>
        <Text style={styles.summaryCaption}>Gastos marcados como deducibles con RFC y/o CFDI.</Text>
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  hero: { backgroundColor: colors.text, borderRadius: 28, padding: 22, gap: 8 },
  title: { color: colors.white, fontSize: 30, fontWeight: '800' },
  subtitle: { color: '#e7dcca', fontSize: 15, lineHeight: 22 },
  statsGrid: { flexDirection: 'row', gap: 10 },
  summaryCard: { borderRadius: 24, padding: 20, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, gap: 6 },
  summaryTitle: { color: colors.text, fontSize: 18, fontWeight: '700' },
  summaryValue: { color: colors.success, fontSize: 28, fontWeight: '800' },
  summaryCaption: { color: colors.textMuted, lineHeight: 20 },
});
