import React, { useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { ColorPalette } from '../theme/colors';
import { font } from '../theme/typography';
import { useTheme } from '../theme/ThemeContext';

const MONTHS = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];
const DAYS = ['L', 'M', 'Mi', 'J', 'V', 'S', 'D'];

function toDate(str: string): Date | null {
  if (!str || str.length < 10) return null;
  const [y, m, d] = str.split('-').map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
}

function toStr(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfMonth(year: number, month: number): number {
  // 0=Sun…6=Sat → convert to Mon=0…Sun=6
  const day = new Date(year, month, 1).getDay();
  return day === 0 ? 6 : day - 1;
}

interface CalendarProps {
  selectedDate: string;
  onSelect: (date: string) => void;
  startDate?: string;
  endDate?: string;
}

function MonthCalendar({ year, month, selectedDate, onSelect, startDate, endDate, colors, s }: CalendarProps & {
  year: number; month: number; colors: ColorPalette; s: any;
}) {
  const totalDays = getDaysInMonth(year, month);
  const firstDay = getFirstDayOfMonth(year, month);

  const cells: (number | null)[] = [
    ...Array(firstDay).fill(null),
    ...Array.from({ length: totalDays }, (_, i) => i + 1),
  ];

  while (cells.length % 7 !== 0) cells.push(null);

  const rows: (number | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) rows.push(cells.slice(i, i + 7));

  const startD = toDate(startDate ?? '');
  const endD = toDate(endDate ?? '');
  const selD = toDate(selectedDate);

  const isInRange = (day: number): boolean => {
    if (!startD || !endD) return false;
    const d = new Date(year, month, day);
    return d > startD && d < endD;
  };

  const isStart = (day: number): boolean => {
    if (!startD) return false;
    return toStr(new Date(year, month, day)) === startDate;
  };

  const isEnd = (day: number): boolean => {
    if (!endD) return false;
    return toStr(new Date(year, month, day)) === endDate;
  };

  const isSelected = (day: number): boolean =>
    toStr(new Date(year, month, day)) === selectedDate;

  return (
    <>
      {rows.map((row, ri) => (
        <View key={ri} style={s.row}>
          {row.map((day, ci) => {
            if (!day) return <View key={ci} style={s.cell} />;
            const dateStr = toStr(new Date(year, month, day));
            const selected = isSelected(day);
            const start = isStart(day);
            const end = isEnd(day);
            const inRange = isInRange(day);
            const isToday = dateStr === toStr(new Date());
            const highlighted = selected || start || end;

            return (
              <Pressable
                key={ci}
                style={[
                  s.cell,
                  inRange && { backgroundColor: colors.primary + '20' },
                  highlighted && { backgroundColor: colors.primary, borderRadius: 10 },
                ]}
                onPress={() => onSelect(dateStr)}
              >
                <Text style={[
                  s.dayText,
                  inRange && { color: colors.primary },
                  highlighted && { color: '#fff', fontFamily: font.bold },
                  isToday && !highlighted && { color: colors.primary, fontFamily: font.bold },
                ]}>
                  {day}
                </Text>
              </Pressable>
            );
          })}
        </View>
      ))}
    </>
  );
}

interface CalendarPickerProps {
  visible: boolean;
  onClose: () => void;
  value: string;
  onSelect: (date: string) => void;
  title?: string;
  minDate?: string;
}

export function CalendarPicker({ visible, onClose, value, onSelect, title = 'Seleccionar fecha', minDate }: CalendarPickerProps) {
  const { colors, isDark } = useTheme();
  const s = useStyles(colors, isDark);

  const initial = toDate(value) ?? new Date();
  const [year, setYear] = useState(initial.getFullYear());
  const [month, setMonth] = useState(initial.getMonth());

  const prevMonth = () => {
    if (month === 0) { setMonth(11); setYear(y => y - 1); }
    else setMonth(m => m - 1);
  };

  const nextMonth = () => {
    if (month === 11) { setMonth(0); setYear(y => y + 1); }
    else setMonth(m => m + 1);
  };

  const handleSelect = (date: string) => {
    onSelect(date);
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={s.overlay} onPress={onClose} />
      <View style={s.sheet}>
        {/* Header */}
        <View style={s.sheetHeader}>
          <Text style={s.sheetTitle}>{title}</Text>
          <Pressable onPress={onClose} style={s.closeBtn}>
            <Icon name="close" size={20} color={colors.textMuted} />
          </Pressable>
        </View>

        {/* Month nav */}
        <View style={s.monthNav}>
          <Pressable onPress={prevMonth} style={s.navBtn}>
            <Icon name="chevron-left" size={22} color={colors.text} />
          </Pressable>
          <Text style={s.monthLabel}>{MONTHS[month]} {year}</Text>
          <Pressable onPress={nextMonth} style={s.navBtn}>
            <Icon name="chevron-right" size={22} color={colors.text} />
          </Pressable>
        </View>

        {/* Day headers */}
        <View style={s.row}>
          {DAYS.map(d => (
            <View key={d} style={s.cell}>
              <Text style={s.dayHeader}>{d}</Text>
            </View>
          ))}
        </View>

        {/* Calendar grid */}
        <MonthCalendar
          year={year}
          month={month}
          selectedDate={value}
          onSelect={handleSelect}
          colors={colors}
          s={s}
        />

        {/* Quick picks */}
        <View style={s.quickRow}>
          {[
            { label: 'Hoy', date: toStr(new Date()) },
            { label: 'Ayer', date: toStr(new Date(Date.now() - 86400000)) },
            { label: 'Hace 7 días', date: toStr(new Date(Date.now() - 7 * 86400000)) },
          ].map(q => (
            <Pressable key={q.label} style={s.quickBtn} onPress={() => handleSelect(q.date)}>
              <Text style={s.quickText}>{q.label}</Text>
            </Pressable>
          ))}
        </View>
      </View>
    </Modal>
  );
}

const useStyles = (colors: ColorPalette, isDark: boolean) =>
  StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.5)',
    },
    sheet: {
      backgroundColor: colors.surface,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      padding: 20,
      paddingBottom: 40,
      gap: 4,
    },
    sheetHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 8,
    },
    sheetTitle: {
      color: colors.text,
      fontFamily: font.bold,
      fontSize: 17,
    },
    closeBtn: {
      padding: 4,
    },
    monthNav: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: 8,
    },
    navBtn: {
      padding: 8,
      borderRadius: 10,
      backgroundColor: colors.surfaceAlt,
    },
    monthLabel: {
      color: colors.text,
      fontFamily: font.bold,
      fontSize: 16,
    },
    row: {
      flexDirection: 'row',
    },
    cell: {
      flex: 1,
      aspectRatio: 1,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 10,
    },
    dayHeader: {
      color: colors.textMuted,
      fontSize: 11,
      fontFamily: font.semibold,
    },
    dayText: {
      color: colors.text,
      fontSize: 14,
      fontFamily: font.medium,
    },
    quickRow: {
      flexDirection: 'row',
      gap: 8,
      marginTop: 12,
    },
    quickBtn: {
      flex: 1,
      paddingVertical: 10,
      backgroundColor: colors.surfaceAlt,
      borderRadius: 10,
      alignItems: 'center',
    },
    quickText: {
      color: colors.text,
      fontSize: 12,
      fontFamily: font.semibold,
    },
  });
