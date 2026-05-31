import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { ColorPalette } from '../theme/colors';
import { useTheme } from '../theme/ThemeContext';
import { formatCurrency } from '../utils/format';

interface PieSlice {
  category: string;
  amount: number;
  color: string;
}

interface PieChartProps {
  data: PieSlice[];
}

export function PieChart({ data }: PieChartProps) {
  const { colors } = useTheme();
  const s = useStyles(colors);
  const total = data.reduce((sum, d) => sum + d.amount, 0);

  if (total === 0) return null;

  const slices = data
    .filter(d => d.amount > 0)
    .sort((a, b) => b.amount - a.amount)
    .map(d => ({ ...d, pct: d.amount / total }));

  return (
    <View style={s.container}>
      <View style={s.header}>
        <Text style={s.title}>Desglose por categoría</Text>
        <Text style={s.totalLabel}>{formatCurrency(total)}</Text>
      </View>

      {/* Stacked proportional bar */}
      <View style={s.stackedBar}>
        {slices.map((slice, idx) => (
          <View
            key={idx}
            style={[
              s.stackSegment,
              {
                flex: slice.pct,
                backgroundColor: slice.color,
                borderTopLeftRadius: idx === 0 ? 6 : 0,
                borderBottomLeftRadius: idx === 0 ? 6 : 0,
                borderTopRightRadius: idx === slices.length - 1 ? 6 : 0,
                borderBottomRightRadius: idx === slices.length - 1 ? 6 : 0,
              },
            ]}
          />
        ))}
      </View>

      {/* Category rows */}
      <View style={s.rows}>
        {slices.map((slice, idx) => {
          const pct = Math.round(slice.pct * 100);
          return (
            <View key={idx} style={s.row}>
              <View style={[s.dot, { backgroundColor: slice.color }]} />
              <Text style={s.categoryName} numberOfLines={1}>
                {slice.category}
              </Text>
              <View style={s.barTrack}>
                <View
                  style={[
                    s.bar,
                    { flex: slice.pct, backgroundColor: slice.color },
                  ]}
                />
                <View style={{ flex: 1 - slice.pct }} />
              </View>
              <Text style={s.pct}>{pct}%</Text>
              <Text style={s.amount}>{formatCurrency(slice.amount)}</Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const useStyles = (colors: ColorPalette) =>
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
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    title: {
      color: colors.text,
      fontWeight: '700',
      fontSize: 16,
    },
    totalLabel: {
      color: colors.primary,
      fontWeight: '800',
      fontSize: 15,
    },
    stackedBar: {
      flexDirection: 'row',
      height: 10,
      borderRadius: 6,
      overflow: 'hidden',
      backgroundColor: colors.border,
    },
    stackSegment: {
      height: '100%',
    },
    rows: {
      gap: 10,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    dot: {
      width: 10,
      height: 10,
      borderRadius: 5,
      flexShrink: 0,
    },
    categoryName: {
      color: colors.text,
      fontSize: 13,
      fontWeight: '600',
      width: 90,
      flexShrink: 0,
    },
    barTrack: {
      flex: 1,
      flexDirection: 'row',
      height: 6,
      borderRadius: 3,
      overflow: 'hidden',
      backgroundColor: colors.border,
    },
    bar: {
      height: '100%',
      borderRadius: 3,
      opacity: 0.85,
    },
    pct: {
      color: colors.textMuted,
      fontSize: 12,
      fontWeight: '700',
      width: 34,
      textAlign: 'right',
      flexShrink: 0,
    },
    amount: {
      color: colors.text,
      fontSize: 12,
      fontWeight: '700',
      width: 68,
      textAlign: 'right',
      flexShrink: 0,
    },
  });
