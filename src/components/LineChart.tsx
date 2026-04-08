import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { ColorPalette } from '../theme/colors';
import { useTheme } from '../theme/ThemeContext';
import { formatCurrency } from '../utils/format';

interface LineDataPoint {
  label: string;
  value: number;
}

interface LineChartProps {
  data: LineDataPoint[];
  title?: string;
}

const CHART_HEIGHT = 120;

export function LineChart({ data, title }: LineChartProps) {
  const { colors } = useTheme();
  const s = useStyles(colors);
  const max = Math.max(...data.map(d => d.value), 1);

  return (
    <View style={s.container}>
      {title ? <Text style={s.title}>{title}</Text> : null}
      <View style={s.chart}>
        {/* Y axis labels */}
        <View style={s.yAxis}>
          <Text style={s.yLabel}>{formatCurrency(max)}</Text>
          <Text style={s.yLabel}>{formatCurrency(max / 2)}</Text>
          <Text style={s.yLabel}>$0</Text>
        </View>

        {/* Plot area */}
        <View style={s.plotArea}>
          {/* Grid lines */}
          <View style={[s.gridLine, s.gridTop]} />
          <View style={[s.gridLine, s.gridMid]} />
          <View style={[s.gridLine, s.gridBot]} />

          {/* Dots and connecting lines */}
          {data.map((point, idx) => {
            const x = data.length > 1 ? idx / (data.length - 1) : 0.5;
            const y = 1 - point.value / max;

            return (
              <View
                key={idx}
                style={[
                  s.dot,
                  {
                    left: `${x * 100}%`,
                    top: `${y * 100}%`,
                  },
                ]}
              />
            );
          })}

          {/* Connecting lines between dots */}
          {data.map((point, idx) => {
            if (idx === 0) return null;
            const prev = data[idx - 1];
            const x1 = (idx - 1) / (data.length - 1);
            const y1 = 1 - prev.value / max;
            const x2 = idx / (data.length - 1);
            const y2 = 1 - point.value / max;

            const dx = (x2 - x1) * 100;
            const dy = (y2 - y1) * CHART_HEIGHT;
            const length = Math.sqrt(dx * dx + dy * dy);
            const angle = Math.atan2(dy, dx) * (180 / Math.PI);

            return (
              <View
                key={`line-${idx}`}
                style={[
                  s.line,
                  {
                    left: `${x1 * 100}%`,
                    top: y1 * CHART_HEIGHT,
                    width: length,
                    transform: [{ rotate: `${angle}deg` }],
                  },
                ]}
              />
            );
          })}
        </View>
      </View>

      {/* X axis labels */}
      <View style={s.xAxis}>
        {data.map((point, idx) => (
          <Text key={idx} style={s.xLabel}>{point.label}</Text>
        ))}
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
      gap: 8,
    },
    title: {
      color: colors.text,
      fontWeight: '700',
      fontSize: 16,
    },
    chart: {
      flexDirection: 'row',
      height: CHART_HEIGHT,
      gap: 8,
    },
    yAxis: {
      justifyContent: 'space-between',
      width: 60,
    },
    yLabel: {
      color: colors.textMuted,
      fontSize: 9,
      fontWeight: '600',
    },
    plotArea: {
      flex: 1,
      height: CHART_HEIGHT,
      position: 'relative',
    },
    gridLine: {
      position: 'absolute',
      left: 0,
      right: 0,
      height: 1,
      backgroundColor: colors.border,
    },
    gridTop: { top: 0 },
    gridMid: { top: '50%' },
    gridBot: { bottom: 0 },
    dot: {
      position: 'absolute',
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: colors.primary,
      marginLeft: -4,
      marginTop: -4,
      zIndex: 2,
    },
    line: {
      position: 'absolute',
      height: 2,
      backgroundColor: colors.primary,
      opacity: 0.5,
      transformOrigin: 'left center',
      zIndex: 1,
    },
    xAxis: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      paddingLeft: 68,
    },
    xLabel: {
      color: colors.textMuted,
      fontSize: 10,
      fontWeight: '600',
      textAlign: 'center',
    },
  });
