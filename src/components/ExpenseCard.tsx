import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useCustomCategoryStore } from '../store/useCustomCategoryStore';
import { Expense } from '../types/expense';
import { ColorPalette } from '../theme/colors';
import { useTheme } from '../theme/ThemeContext';
import { categoryIcons } from '../theme/icons';
import { shadows } from '../theme/spacing';
import { formatCurrency, formatDate } from '../utils/format';

interface ExpenseCardProps {
  expense: Expense;
  onPress: () => void;
  index?: number;
}

export function ExpenseCard({ expense, onPress, index = 0 }: ExpenseCardProps) {
  const { colors, isDark } = useTheme();
  const s = useStyles(colors, isDark);
  const customCategories = useCustomCategoryStore(state => state.categories);

  const customCat = customCategories.find(c => c.name === expense.category);
  const iconName = customCat?.icon ?? categoryIcons[expense.category] ?? 'circle-outline';
  const iconColor = customCat?.color ?? colors.primary;
  const iconBg = customCat ? customCat.color + '20' : (isDark ? '#1a3a34' : '#d8f0ea');

  return (
    <Animated.View entering={FadeInDown.delay(index * 50).duration(300).springify()}>
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [s.card, pressed && s.cardPressed]}
      >
        <View style={s.header}>
          <View style={[s.iconWrap, { backgroundColor: iconBg }]}>
            <Icon
              name={iconName}
              size={22}
              color={iconColor}
            />
          </View>
          <Text style={s.merchant} numberOfLines={1}>
            {expense.merchantName || expense.description || 'Gasto sin título'}
          </Text>
          <Text style={s.amount}>{formatCurrency(expense.amount)}</Text>
        </View>
        <View style={s.metaRow}>
          <Text style={s.meta}>{expense.category}</Text>
          <Text style={s.meta}>{formatDate(expense.date)}</Text>
        </View>
        <View style={s.footer}>
          <Text style={s.description} numberOfLines={1}>
            {expense.description || expense.conceptsText || 'Sin descripción'}
          </Text>
          <View style={[s.badge, expense.deductible ? s.deductible : s.nonDeductible]}>
            <Text style={s.badgeText}>{expense.deductible ? 'Deducible' : 'No deducible'}</Text>
          </View>
        </View>
      </Pressable>
    </Animated.View>
  );
}

const useStyles = (colors: ColorPalette, isDark: boolean) =>
  StyleSheet.create({
    card: {
      backgroundColor: colors.surface,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 16,
      gap: 10,
      ...shadows.card,
    },
    cardPressed: {
      opacity: 0.92,
      transform: [{ scale: 0.98 }],
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    iconWrap: {
      width: 36,
      height: 36,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
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
      backgroundColor: isDark ? '#1a3a34' : '#d8f0ea',
    },
    nonDeductible: {
      backgroundColor: isDark ? '#3a2a24' : '#f1ddd6',
    },
    badgeText: {
      fontSize: 11,
      fontWeight: '700',
      color: colors.text,
    },
  });
