import React from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { ColorPalette } from '../theme/colors';
import { useTheme } from '../theme/ThemeContext';
import { localDateString } from '../utils/format';

interface DateRangePickerProps {
  startDate: string;
  endDate: string;
  onChangeStart: (val: string) => void;
  onChangeEnd: (val: string) => void;
}

export function DateRangePicker({
  startDate,
  endDate,
  onChangeStart,
  onChangeEnd,
}: DateRangePickerProps) {
  const { colors, isDark } = useTheme();
  const s = useStyles(colors, isDark);

  const now = new Date();
  const todayStr = localDateString(now);

  const weekStart = localDateString(
    new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6),
  );

  const monthStart = localDateString(
    new Date(now.getFullYear(), now.getMonth(), 1),
  );

  const setQuick = (start: string, end: string) => {
    onChangeStart(start);
    onChangeEnd(end);
  };

  return (
    <View style={s.container}>
      <Text style={s.label}>Rango de fechas</Text>
      <View style={s.row}>
        <TextInput
          style={s.input}
          placeholder="Desde"
          placeholderTextColor={colors.textMuted}
          value={startDate}
          onChangeText={onChangeStart}
        />
        <Text style={s.dash}>-</Text>
        <TextInput
          style={s.input}
          placeholder="Hasta"
          placeholderTextColor={colors.textMuted}
          value={endDate}
          onChangeText={onChangeEnd}
        />
      </View>
      <View style={s.quickRow}>
        <Pressable style={s.quickBtn} onPress={() => setQuick(todayStr, todayStr)}>
          <Text style={s.quickText}>Hoy</Text>
        </Pressable>
        <Pressable style={s.quickBtn} onPress={() => setQuick(weekStart, todayStr)}>
          <Text style={s.quickText}>Esta semana</Text>
        </Pressable>
        <Pressable style={s.quickBtn} onPress={() => setQuick(monthStart, todayStr)}>
          <Text style={s.quickText}>Este mes</Text>
        </Pressable>
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
    quickRow: { flexDirection: 'row', gap: 8 },
    quickBtn: {
      paddingHorizontal: 12,
      paddingVertical: 7,
      borderRadius: 999,
      backgroundColor: colors.surfaceAlt,
    },
    quickText: { color: colors.text, fontSize: 11, fontWeight: '600' },
  });
