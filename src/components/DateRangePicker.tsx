import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { CalendarPicker } from './CalendarPicker';
import { ColorPalette } from '../theme/colors';
import { font } from '../theme/typography';
import { useTheme } from '../theme/ThemeContext';
import { localDateString } from '../utils/format';

interface DateRangePickerProps {
  startDate: string;
  endDate: string;
  onChangeStart: (val: string) => void;
  onChangeEnd: (val: string) => void;
}

function formatDisplay(date: string): string {
  if (!date) return '';
  const [y, m, d] = date.split('-');
  return `${d}/${m}/${y?.slice(2)}`;
}

export function DateRangePicker({
  startDate,
  endDate,
  onChangeStart,
  onChangeEnd,
}: DateRangePickerProps) {
  const { colors, isDark } = useTheme();
  const s = useStyles(colors, isDark);

  const [showStart, setShowStart] = useState(false);
  const [showEnd, setShowEnd] = useState(false);

  const now = new Date();
  const todayStr = localDateString(now);
  const weekStart = localDateString(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6));
  const monthStart = localDateString(new Date(now.getFullYear(), now.getMonth(), 1));
  const lastMonthStart = localDateString(new Date(now.getFullYear(), now.getMonth() - 1, 1));
  const lastMonthEnd = localDateString(new Date(now.getFullYear(), now.getMonth(), 0));

  const setQuick = (start: string, end: string) => {
    onChangeStart(start);
    onChangeEnd(end);
  };

  const handleStartSelect = (date: string) => {
    onChangeStart(date);
    if (endDate && date > endDate) onChangeEnd('');
    setShowStart(false);
  };

  const handleEndSelect = (date: string) => {
    onChangeEnd(date);
    setShowEnd(false);
  };

  const hasFilter = startDate || endDate;

  return (
    <View style={s.container}>
      <Text style={s.label}>Rango de fechas</Text>

      {/* Date buttons */}
      <View style={s.row}>
        <Pressable style={[s.dateBtn, startDate && s.dateBtnActive]} onPress={() => setShowStart(true)}>
          <Icon name="calendar-start" size={15} color={startDate ? colors.primary : colors.textMuted} />
          <Text style={[s.dateBtnText, startDate && s.dateBtnTextActive]}>
            {startDate ? formatDisplay(startDate) : 'Desde'}
          </Text>
        </Pressable>

        <Icon name="arrow-right" size={16} color={colors.textMuted} />

        <Pressable style={[s.dateBtn, endDate && s.dateBtnActive]} onPress={() => setShowEnd(true)}>
          <Icon name="calendar-end" size={15} color={endDate ? colors.primary : colors.textMuted} />
          <Text style={[s.dateBtnText, endDate && s.dateBtnTextActive]}>
            {endDate ? formatDisplay(endDate) : 'Hasta'}
          </Text>
        </Pressable>

        {hasFilter && (
          <Pressable style={s.clearBtn} onPress={() => { onChangeStart(''); onChangeEnd(''); }}>
            <Icon name="close-circle" size={18} color={colors.textMuted} />
          </Pressable>
        )}
      </View>

      {/* Quick picks */}
      <View style={s.quickRow}>
        {[
          { label: 'Hoy', start: todayStr, end: todayStr },
          { label: '7 días', start: weekStart, end: todayStr },
          { label: 'Este mes', start: monthStart, end: todayStr },
          { label: 'Mes pasado', start: lastMonthStart, end: lastMonthEnd },
        ].map(q => {
          const active = startDate === q.start && endDate === q.end;
          return (
            <Pressable
              key={q.label}
              style={[s.quickBtn, active && s.quickBtnActive]}
              onPress={() => setQuick(q.start, q.end)}
            >
              <Text style={[s.quickText, active && s.quickTextActive]}>{q.label}</Text>
            </Pressable>
          );
        })}
      </View>

      <CalendarPicker
        visible={showStart}
        onClose={() => setShowStart(false)}
        value={startDate}
        onSelect={handleStartSelect}
        title="Fecha desde"
      />
      <CalendarPicker
        visible={showEnd}
        onClose={() => setShowEnd(false)}
        value={endDate}
        onSelect={handleEndSelect}
        title="Fecha hasta"
        minDate={startDate}
      />
    </View>
  );
}

const useStyles = (colors: ColorPalette, isDark: boolean) =>
  StyleSheet.create({
    container: { gap: 10 },
    label: { color: colors.text, fontFamily: font.bold, fontSize: 14 },
    row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    dateBtn: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 12,
      paddingHorizontal: 12,
      paddingVertical: 11,
      backgroundColor: isDark ? colors.surfaceAlt : colors.white,
    },
    dateBtnActive: {
      borderColor: colors.primary,
      backgroundColor: colors.primary + '10',
    },
    dateBtnText: {
      color: colors.textMuted,
      fontSize: 13,
      fontFamily: font.medium,
    },
    dateBtnTextActive: {
      color: colors.primary,
      fontFamily: font.semibold,
    },
    clearBtn: { padding: 4 },
    quickRow: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
    quickBtn: {
      paddingHorizontal: 12,
      paddingVertical: 7,
      borderRadius: 999,
      backgroundColor: colors.surfaceAlt,
    },
    quickBtnActive: {
      backgroundColor: colors.primary,
    },
    quickText: {
      color: colors.text,
      fontSize: 11,
      fontFamily: font.semibold,
    },
    quickTextActive: {
      color: '#fff',
    },
  });
