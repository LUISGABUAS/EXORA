import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Expense } from '../types/expense';
import { colors } from '../theme/colors';
import { formatCurrency, formatDate } from '../utils/format';

interface ExpenseCardProps {
  expense: Expense;
  onPress: () => void;
}

export function ExpenseCard({ expense, onPress }: ExpenseCardProps) {
  return (
    <Pressable onPress={onPress} style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.merchant} numberOfLines={1}>
          {expense.merchantName || expense.description || 'Gasto sin titulo'}
        </Text>
        <Text style={styles.amount}>{formatCurrency(expense.amount)}</Text>
      </View>
      <View style={styles.metaRow}>
        <Text style={styles.meta}>{expense.category}</Text>
        <Text style={styles.meta}>{formatDate(expense.date)}</Text>
      </View>
      <View style={styles.footer}>
        <Text style={styles.description} numberOfLines={1}>
          {expense.description || expense.conceptsText || 'Sin descripcion'}
        </Text>
        <View style={[styles.badge, expense.deductible ? styles.deductible : styles.nonDeductible]}>
          <Text style={styles.badgeText}>{expense.deductible ? 'Deducible' : 'No deducible'}</Text>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    gap: 10,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  merchant: {
    flex: 1,
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
  },
  amount: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.primary,
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  meta: {
    color: colors.textMuted,
    fontSize: 13,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  description: {
    flex: 1,
    color: colors.textMuted,
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
  },
  deductible: {
    backgroundColor: '#d8f0ea',
  },
  nonDeductible: {
    backgroundColor: '#f1ddd6',
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.text,
  },
});
