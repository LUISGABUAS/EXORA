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

const SIZE = 160;
const HALF = SIZE / 2;

function PieSegment({
  startAngle,
  sweepAngle,
  color,
}: {
  startAngle: number;
  sweepAngle: number;
  color: string;
}) {
  const segments: React.ReactNode[] = [];
  let remaining = sweepAngle;
  let currentStart = startAngle;
  let i = 0;

  while (remaining > 0) {
    const chunk = Math.min(remaining, 180);
    segments.push(
      <View
        key={i}
        style={[
          pieStyles.half,
          {
            width: SIZE,
            height: HALF,
            borderTopLeftRadius: HALF,
            borderTopRightRadius: HALF,
            backgroundColor: color,
            transform: [
              { translateY: HALF / 2 },
              { rotate: `${currentStart + chunk}deg` },
              { translateY: -HALF / 2 },
            ],
          },
        ]}
      />,
    );
    remaining -= chunk;
    currentStart += chunk;
    i++;
  }

  return <>{segments}</>;
}

const pieStyles = StyleSheet.create({
  half: {
    position: 'absolute',
    left: 0,
    top: 0,
    transformOrigin: 'center bottom',
  },
});

export function PieChart({ data }: PieChartProps) {
  const { colors } = useTheme();
  const s = useStyles(colors);
  const total = data.reduce((sum, d) => sum + d.amount, 0);

  if (total === 0) return null;

  let accumulated = 0;
  const slices = data
    .filter(d => d.amount > 0)
    .map(d => {
      const start = accumulated;
      const sweep = (d.amount / total) * 360;
      accumulated += sweep;
      return { ...d, start, sweep };
    });

  return (
    <View style={s.container}>
      <Text style={s.title}>Desglose por categoria</Text>
      <View style={s.chartRow}>
        <View style={s.pieWrap}>
          <View style={s.pieContainer}>
            {slices.map((slice, idx) => (
              <PieSegment
                key={idx}
                startAngle={slice.start}
                sweepAngle={slice.sweep}
                color={slice.color}
              />
            ))}
            <View style={s.centerHole}>
              <Text style={s.centerText}>{formatCurrency(total)}</Text>
            </View>
          </View>
        </View>
        <View style={s.legend}>
          {slices.map((slice, idx) => {
            const pct = ((slice.amount / total) * 100).toFixed(0);
            return (
              <View key={idx} style={s.legendRow}>
                <View style={[s.legendDot, { backgroundColor: slice.color }]} />
                <Text style={s.legendLabel} numberOfLines={1}>{slice.category}</Text>
                <Text style={s.legendValue}>{pct}%</Text>
              </View>
            );
          })}
        </View>
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
    title: {
      color: colors.text,
      fontWeight: '700',
      fontSize: 16,
    },
    chartRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 16,
    },
    pieWrap: {
      width: SIZE,
      height: SIZE,
    },
    pieContainer: {
      width: SIZE,
      height: SIZE,
      borderRadius: HALF,
      overflow: 'hidden',
      backgroundColor: colors.border,
    },
    centerHole: {
      position: 'absolute',
      top: SIZE * 0.2,
      left: SIZE * 0.2,
      width: SIZE * 0.6,
      height: SIZE * 0.6,
      borderRadius: SIZE * 0.3,
      backgroundColor: colors.surface,
      alignItems: 'center',
      justifyContent: 'center',
    },
    centerText: {
      color: colors.text,
      fontWeight: '800',
      fontSize: 13,
    },
    legend: {
      flex: 1,
      gap: 6,
    },
    legendRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    legendDot: {
      width: 10,
      height: 10,
      borderRadius: 5,
    },
    legendLabel: {
      flex: 1,
      color: colors.text,
      fontSize: 12,
      fontWeight: '600',
    },
    legendValue: {
      color: colors.textMuted,
      fontSize: 12,
      fontWeight: '700',
    },
  });
