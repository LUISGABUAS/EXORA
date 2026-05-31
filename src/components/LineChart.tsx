import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { ColorPalette } from '../theme/colors';
import { useTheme } from '../theme/ThemeContext';
import { formatCurrency } from '../utils/format';

interface LineDataPoint {
  label: string;
  value: number;
  isToday?: boolean;
}

interface LineChartProps {
  data: LineDataPoint[];
  title?: string;
}

const CHART_HEIGHT = 110;
const MIN_BAR_HEIGHT = 3; // Mínimo visible para días con gasto

export function LineChart({ data, title }: LineChartProps) {
  const { colors } = useTheme();
  const s = useStyles(colors);

  const max = Math.max(...data.map(d => d.value), 1);
  const total = data.reduce((sum, d) => sum + d.value, 0);
  const todayIdx = data.findIndex(d => d.isToday);
  const activeIdx = todayIdx >= 0 ? todayIdx : data.length - 1;

  // Y axis labels: max, half, 0
  const yLabels = [max, max / 2, 0];

  return (
    <View style={s.container}>
      {/* Header */}
      <View style={s.header}>
        {title ? <Text style={s.title}>{title}</Text> : null}
        <Text style={s.totalLabel}>{formatCurrency(total)}</Text>
      </View>

      <View style={s.chart}>
        {/* Y axis */}
        <View style={s.yAxis}>
          {yLabels.map((v, i) => (
            <Text key={i} style={s.yLabel}>
              {v === 0 ? '$0' : `$${Math.round(v)}`}
            </Text>
          ))}
        </View>

        {/* Plot area */}
        <View style={s.plotArea}>
          {/* Grid lines */}
          <View style={[s.gridLine, { top: 0 }]} />
          <View style={[s.gridLine, { top: '50%' }]} />
          <View style={[s.gridLine, { bottom: 0 }]} />

          {/* Bars */}
          <View style={s.barsRow}>
            {data.map((point, idx) => {
              const pct = point.value / max;
              const barH = point.value > 0
                ? Math.max(pct * CHART_HEIGHT, MIN_BAR_HEIGHT)
                : 0;
              const isActive = idx === activeIdx;
              const isEmpty = point.value === 0;

              return (
                <View key={idx} style={s.barCol}>
                  {/* Valor encima de la barra */}
                  {isActive && point.value > 0 ? (
                    <Text style={s.barValue}>{formatCurrency(point.value)}</Text>
                  ) : <View style={s.barValuePlaceholder} />}

                  {/* Espacio de la gráfica */}
                  <View style={s.barSpace}>
                    {isEmpty ? (
                      // Punto pequeño para días sin gasto
                      <View style={[s.emptyDot, { backgroundColor: colors.border }]} />
                    ) : (
                      <View
                        style={[
                          s.bar,
                          {
                            height: barH,
                            backgroundColor: isActive ? colors.primary : colors.primary + '55',
                            borderTopLeftRadius: 5,
                            borderTopRightRadius: 5,
                          },
                        ]}
                      />
                    )}
                  </View>
                </View>
              );
            })}
          </View>
        </View>
      </View>

      {/* X axis labels */}
      <View style={s.xAxis}>
        <View style={s.xSpacer} />
        <View style={s.xLabels}>
          {data.map((point, idx) => {
            const isActive = idx === activeIdx;
            return (
              <View key={idx} style={s.xLabelCol}>
                <Text style={[s.xLabel, isActive && s.xLabelActive]}>
                  {point.label}
                </Text>
                {isActive && <View style={s.xDot} />}
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
      gap: 4,
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 8,
    },
    title: {
      color: colors.text,
      fontWeight: '700',
      fontSize: 15,
    },
    totalLabel: {
      color: colors.primary,
      fontWeight: '800',
      fontSize: 15,
    },
    chart: {
      flexDirection: 'row',
      height: CHART_HEIGHT + 20, // extra for value label
      gap: 6,
    },
    yAxis: {
      justifyContent: 'space-between',
      paddingTop: 20, // align with bar top
      width: 42,
    },
    yLabel: {
      color: colors.textMuted,
      fontSize: 9,
      fontWeight: '600',
      textAlign: 'right',
    },
    plotArea: {
      flex: 1,
      position: 'relative',
    },
    gridLine: {
      position: 'absolute',
      left: 0,
      right: 0,
      height: 1,
      backgroundColor: colors.border,
      opacity: 0.5,
    },
    barsRow: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'flex-end',
      paddingTop: 20,
    },
    barCol: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'flex-end',
    },
    barValue: {
      color: colors.primary,
      fontSize: 9,
      fontWeight: '700',
      marginBottom: 3,
      textAlign: 'center',
    },
    barValuePlaceholder: {
      height: 14,
    },
    barSpace: {
      height: CHART_HEIGHT,
      justifyContent: 'flex-end',
      alignItems: 'center',
      width: '70%',
    },
    bar: {
      width: '100%',
    },
    emptyDot: {
      width: 4,
      height: 4,
      borderRadius: 2,
      marginBottom: 2,
    },
    xAxis: {
      flexDirection: 'row',
      marginTop: 4,
    },
    xSpacer: {
      width: 48, // yAxis width + gap
    },
    xLabels: {
      flex: 1,
      flexDirection: 'row',
    },
    xLabelCol: {
      flex: 1,
      alignItems: 'center',
      gap: 2,
    },
    xLabel: {
      color: colors.textMuted,
      fontSize: 10,
      fontWeight: '600',
    },
    xLabelActive: {
      color: colors.primary,
      fontWeight: '800',
    },
    xDot: {
      width: 4,
      height: 4,
      borderRadius: 2,
      backgroundColor: colors.primary,
    },
  });
