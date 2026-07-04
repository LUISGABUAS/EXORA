import React, { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useExpenseStore } from '../store/useExpenseStore';
import { ColorPalette } from '../theme/colors';
import { categoryIcons } from '../theme/icons';
import { useTheme } from '../theme/ThemeContext';
import { ExpenseCategory, ExpenseInput } from '../types/expense';
import { formatCurrency, localDateString } from '../utils/format';

interface QuickShortcutsProps {
  onSelect: (input: ExpenseInput) => void;
}

interface ShortcutItem {
  description: string;
  amount: number;
  category: ExpenseCategory;
  frequency: number;
}

function normalizeDesc(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

function getHour(createdAt: string): number {
  return new Date(createdAt).getHours();
}

function isInTimeWindow(expenseHour: number, currentHour: number): boolean {
  const low = (currentHour - 2 + 24) % 24;
  const high = (currentHour + 2) % 24;
  if (low <= high) {
    return expenseHour >= low && expenseHour <= high;
  }
  return expenseHour >= low || expenseHour <= high;
}

export function QuickShortcuts({ onSelect }: QuickShortcutsProps) {
  const { colors } = useTheme();
  const s = useStyles(colors);
  const expenses = useExpenseStore(state => state.expenses);

  const shortcuts = useMemo((): ShortcutItem[] => {
    if (expenses.length < 5) return [];

    const currentHour = new Date().getHours();
    const relevant = expenses.filter(e =>
      e.description && isInTimeWindow(getHour(e.createdAt), currentHour),
    );

    const groups: Record<string, { amounts: number[]; categories: ExpenseCategory[]; count: number }> = {};
    for (const e of relevant) {
      const key = normalizeDesc(e.description);
      if (!key) continue;
      if (!groups[key]) groups[key] = { amounts: [], categories: [], count: 0 };
      groups[key].amounts.push(e.amount);
      groups[key].categories.push(e.category);
      groups[key].count++;
    }

    return Object.entries(groups)
      .filter(([, g]) => g.count >= 2)
      .map(([desc, g]) => {
        const avgAmount = Math.round(g.amounts.reduce((a, b) => a + b, 0) / g.amounts.length);
        const catCounts: Record<string, number> = {};
        for (const c of g.categories) catCounts[c] = (catCounts[c] || 0) + 1;
        const topCategory = Object.entries(catCounts).sort((a, b) => b[1] - a[1])[0][0] as ExpenseCategory;

        return { description: desc, amount: avgAmount, category: topCategory, frequency: g.count };
      })
      .sort((a, b) => b.frequency - a.frequency)
      .slice(0, 4);
  }, [expenses]);

  if (shortcuts.length === 0) return null;

  const handlePress = (item: ShortcutItem) => {
    const input: ExpenseInput = {
      amount: item.amount,
      date: localDateString(new Date()),
      category: item.category,
      description: item.description,
      merchantName: '',
      conceptsText: '',
      ocrRawText: '',
      deductible: false,
      rfc: '',
      usoCFDI: '',
      source: 'manual',
    };
    onSelect(input);
  };

  return (
    <Animated.View entering={FadeInDown.delay(200).duration(300)} style={s.container}>
      <View style={s.header}>
        <Text style={s.title}>Gastos frecuentes</Text>
        <Text style={s.viewAll}>Ver todos</Text>
      </View>
      <View style={s.grid}>
        {shortcuts.map(item => (
          <Pressable key={item.description} style={s.item} onPress={() => handlePress(item)}>
            <View style={s.iconCircle}>
              <Icon name={categoryIcons[item.category]} size={22} color={colors.text} />
            </View>
            <Text style={s.itemLabel} numberOfLines={1}>
              {item.description.charAt(0).toUpperCase() + item.description.slice(1)}
            </Text>
            <Text style={s.itemAmount}>{formatCurrency(item.amount)}</Text>
          </Pressable>
        ))}
      </View>
    </Animated.View>
  );
}

const useStyles = (colors: ColorPalette) =>
  StyleSheet.create({
    container: { gap: 12 },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    title: {
      color: colors.text,
      fontSize: 16,
      fontWeight: '700',
    },
    viewAll: {
      color: colors.primary,
      fontSize: 13,
      fontWeight: '600',
    },
    grid: {
      flexDirection: 'row',
      gap: 12,
    },
    item: {
      flex: 1,
      alignItems: 'center',
      gap: 6,
    },
    iconCircle: {
      width: 48,
      height: 48,
      borderRadius: 24,
      backgroundColor: colors.surfaceAlt,
      alignItems: 'center',
      justifyContent: 'center',
    },
    itemLabel: {
      color: colors.textMuted,
      fontSize: 11,
      fontWeight: '600',
      textAlign: 'center',
    },
    itemAmount: {
      color: colors.text,
      fontSize: 11,
      fontWeight: '700',
    },
  });
