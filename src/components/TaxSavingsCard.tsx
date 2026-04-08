import React, { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { FiscalRegime } from '../store/usePremiumStore';
import { ColorPalette } from '../theme/colors';
import { useTheme } from '../theme/ThemeContext';
import { Expense } from '../types/expense';
import { formatCurrency } from '../utils/format';
import { calculateTaxSavings } from '../utils/taxSavings';

interface Props {
  expenses: Expense[];
  regime: FiscalRegime;
  isPremium: boolean;
  onUpgradePress: () => void;
}

export function TaxSavingsCard({ expenses, regime, isPremium, onUpgradePress }: Props) {
  const { colors } = useTheme();
  const s = useStyles(colors);

  const savings = useMemo(
    () => calculateTaxSavings(expenses, regime),
    [expenses, regime],
  );

  if (regime === 'no_facturo') return null;

  return (
    <View style={s.card}>
      <View style={s.headerRow}>
        <Icon name="calculator-variant" size={20} color={colors.primary} />
        <Text style={s.headerText}>Tu ahorro fiscal este mes</Text>
      </View>

      {isPremium ? (
        <View style={s.detailBlock}>
          <Text style={s.amount}>{formatCurrency(savings.estimatedTaxSaving)}</Text>
          <Text style={s.detail}>
            Gastos deducibles: {formatCurrency(savings.monthlyDeductible)}
          </Text>
          <Text style={s.detail}>
            Acumulado anual: {formatCurrency(savings.yearToDate)}
          </Text>
        </View>
      ) : (
        <View style={s.lockedBlock}>
          <View style={s.blurRow}>
            <Text style={s.blurAmount}>$X,XXX</Text>
            <Icon name="lock" size={18} color={colors.textMuted} />
          </View>
          <Pressable style={s.upgradeButton} onPress={onUpgradePress}>
            <Text style={s.upgradeText}>Ver mi ahorro real</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

const useStyles = (colors: ColorPalette) =>
  StyleSheet.create({
    card: {
      backgroundColor: colors.surface,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 18,
      gap: 12,
    },
    headerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    headerText: {
      color: colors.text,
      fontSize: 14,
      fontWeight: '700',
    },
    detailBlock: {
      gap: 4,
    },
    amount: {
      color: colors.primary,
      fontSize: 28,
      fontWeight: '800',
    },
    detail: {
      color: colors.textMuted,
      fontSize: 13,
    },
    lockedBlock: {
      alignItems: 'center',
      gap: 12,
    },
    blurRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    blurAmount: {
      color: colors.textMuted,
      fontSize: 28,
      fontWeight: '800',
      opacity: 0.4,
    },
    upgradeButton: {
      backgroundColor: colors.primary,
      paddingHorizontal: 20,
      paddingVertical: 10,
      borderRadius: 12,
    },
    upgradeText: {
      color: colors.white,
      fontSize: 14,
      fontWeight: '700',
    },
  });
