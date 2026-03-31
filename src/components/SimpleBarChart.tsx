import React, { useEffect } from 'react';
import { LayoutAnimation, Platform, StyleSheet, Text, UIManager, View } from 'react-native';
import { ColorPalette } from '../theme/colors';
import { useTheme } from '../theme/ThemeContext';
import { formatCurrency } from '../utils/format';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

interface BarData {
  label: string;
  value: number;
}

interface SimpleBarChartProps {
  data: BarData[];
  highlightLast?: boolean;
}

export function SimpleBarChart({ data, highlightLast }: SimpleBarChartProps) {
  const { colors } = useTheme();
  const s = useStyles(colors);
  const max = Math.max(...data.map((d) => d.value), 1);

  useEffect(() => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
  }, [data]);

  return (
    <View style={s.container}>
      <Text style={s.title}>Ultimos 7 dias</Text>
      <View style={s.chart}>
        {data.map((item, index) => {
          const isHighlighted = highlightLast && index === data.length - 1;
          return (
            <View key={index} style={s.barWrapper}>
              {item.value > 0 ? (
                <Text style={s.valueLabel}>{formatCurrency(item.value)}</Text>
              ) : null}
              <View style={s.barTrack}>
                <View
                  style={[
                    s.bar,
                    { height: `${(item.value / max) * 100}%` },
                    isHighlighted && { backgroundColor: colors.secondary, opacity: 1 },
                  ]}
                />
              </View>
              <Text style={[s.barLabel, isHighlighted && { color: colors.text, fontWeight: '800' }]}>
                {item.label}
              </Text>
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
      gap: 12,
    },
    title: {
      color: colors.text,
      fontWeight: '700',
      fontSize: 16,
    },
    chart: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      height: 120,
      gap: 6,
    },
    barWrapper: {
      flex: 1,
      alignItems: 'center',
      gap: 4,
      height: '100%',
      justifyContent: 'flex-end',
    },
    valueLabel: {
      color: colors.textMuted,
      fontSize: 8,
      fontWeight: '600',
    },
    barTrack: {
      flex: 1,
      width: '100%',
      justifyContent: 'flex-end',
    },
    bar: {
      backgroundColor: colors.primary,
      borderRadius: 6,
      minHeight: 4,
      width: '100%',
      opacity: 0.85,
    },
    barLabel: {
      color: colors.textMuted,
      fontSize: 10,
      fontWeight: '600',
    },
  });
