import React from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { ColorPalette } from '../theme/colors';
import { useTheme } from '../theme/ThemeContext';

interface AmountRangeFilterProps {
  minAmount: string;
  maxAmount: string;
  onChangeMin: (val: string) => void;
  onChangeMax: (val: string) => void;
}

export function AmountRangeFilter({
  minAmount,
  maxAmount,
  onChangeMin,
  onChangeMax,
}: AmountRangeFilterProps) {
  const { colors, isDark } = useTheme();
  const s = useStyles(colors, isDark);

  return (
    <View style={s.container}>
      <Text style={s.label}>Rango de monto</Text>
      <View style={s.row}>
        <TextInput
          style={s.input}
          placeholder="$ Min"
          placeholderTextColor={colors.textMuted}
          value={minAmount}
          onChangeText={onChangeMin}
          keyboardType="decimal-pad"
        />
        <Text style={s.dash}>-</Text>
        <TextInput
          style={s.input}
          placeholder="$ Max"
          placeholderTextColor={colors.textMuted}
          value={maxAmount}
          onChangeText={onChangeMax}
          keyboardType="decimal-pad"
        />
      </View>
    </View>
  );
}

const useStyles = (colors: ColorPalette, isDark: boolean) =>
  StyleSheet.create({
    container: { gap: 8 },
    label: { color: colors.text, fontWeight: '700', fontSize: 14 },
    row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    input: {
      flex: 1,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 12,
      paddingHorizontal: 12,
      paddingVertical: 10,
      backgroundColor: isDark ? colors.surfaceAlt : colors.white,
      color: colors.text,
      fontSize: 13,
    },
    dash: { color: colors.textMuted, fontWeight: '700' },
  });
