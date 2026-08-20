import React, { useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useTheme } from '../theme/ThemeContext';
import { font } from '../theme/typography';

const MONTHS = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
const MONTH_DAYS = [31,28,31,30,31,30,31,31,30,31,30,31];

function isLeapYear(y: number) {
  return (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
}

function daysInMonth(month: number, year: number) {
  if (month === 1) return isLeapYear(year) ? 29 : 28;
  return MONTH_DAYS[month];
}

function formatDisplay(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  if (!y || !m || !d) return dateStr;
  return `${d} de ${MONTHS[m - 1]} de ${y}`;
}

function parseDate(dateStr: string): { year: number; month: number; day: number } {
  const [y, m, d] = dateStr.split('-').map(Number);
  const now = new Date();
  return {
    year:  y || now.getFullYear(),
    month: m ? m - 1 : now.getMonth(),
    day:   d || now.getDate(),
  };
}

function toISO(year: number, month: number, day: number): string {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

interface Props {
  value: string;
  onChange: (date: string) => void;
  placeholder?: string;
  optional?: boolean;
}

export function DateField({ value, onChange, placeholder = 'Seleccionar fecha', optional = false }: Props) {
  const { colors } = useTheme();
  const s = useStyles(colors);
  const [open, setOpen] = useState(false);

  const hasValue = Boolean(value);
  const parsed = hasValue ? parseDate(value) : (() => {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth(), day: now.getDate() };
  })();

  const [year, setYear]   = useState(parsed.year);
  const [month, setMonth] = useState(parsed.month);
  const [day, setDay]     = useState(parsed.day);

  const maxDay = daysInMonth(month, year);
  const safeDay = Math.min(day, maxDay);

  const handleMonthSelect = (m: number) => {
    setMonth(m);
    const max = daysInMonth(m, year);
    if (day > max) setDay(max);
  };

  const handleYearSelect = (y: number) => {
    setYear(y);
    const max = daysInMonth(month, y);
    if (day > max) setDay(max);
  };

  const handleConfirm = () => {
    onChange(toISO(year, month, safeDay));
    setOpen(false);
  };

  const handleClear = () => {
    onChange('');
    setOpen(false);
  };

  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 8 }, (_, i) => currentYear - 1 + i);
  const days  = Array.from({ length: maxDay }, (_, i) => i + 1);

  return (
    <View>
      <Pressable style={s.field} onPress={() => setOpen(v => !v)}>
        <Icon name="calendar-outline" size={16} color={hasValue ? colors.text : colors.textMuted} />
        <Text style={[s.fieldText, !hasValue && s.placeholder]}>
          {hasValue ? formatDisplay(value) : placeholder}
        </Text>
        <Icon
          name={open ? 'chevron-up' : 'chevron-down'}
          size={16}
          color={colors.textMuted}
        />
      </Pressable>

      {open && (
        <Animated.View entering={FadeInDown.duration(220)} style={s.picker}>
          {/* Month */}
          <Text style={s.pickerLabel}>Mes</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.row}>
            {MONTHS.map((m, i) => (
              <Pressable
                key={m}
                style={[s.chip, month === i && s.chipActive]}
                onPress={() => handleMonthSelect(i)}
              >
                <Text style={[s.chipText, month === i && s.chipTextActive]}>{m}</Text>
              </Pressable>
            ))}
          </ScrollView>

          {/* Day */}
          <Text style={s.pickerLabel}>Día</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.row}>
            {days.map(d => (
              <Pressable
                key={d}
                style={[s.chip, s.chipDay, safeDay === d && s.chipActive]}
                onPress={() => setDay(d)}
              >
                <Text style={[s.chipText, safeDay === d && s.chipTextActive]}>{d}</Text>
              </Pressable>
            ))}
          </ScrollView>

          {/* Year */}
          <Text style={s.pickerLabel}>Año</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.row}>
            {years.map(y => (
              <Pressable
                key={y}
                style={[s.chip, s.chipYear, year === y && s.chipActive]}
                onPress={() => handleYearSelect(y)}
              >
                <Text style={[s.chipText, year === y && s.chipTextActive]}>{y}</Text>
              </Pressable>
            ))}
          </ScrollView>

          <View style={s.actions}>
            {optional && (
              <Pressable style={s.clearBtn} onPress={handleClear}>
                <Text style={s.clearText}>Sin fecha</Text>
              </Pressable>
            )}
            <Pressable style={s.confirmBtn} onPress={handleConfirm}>
              <Icon name="check" size={16} color="#fff" />
              <Text style={s.confirmText}>Listo</Text>
            </Pressable>
          </View>
        </Animated.View>
      )}
    </View>
  );
}

const useStyles = (colors: any) =>
  StyleSheet.create({
    field: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      backgroundColor: colors.surface,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: 14,
      paddingVertical: 13,
    },
    fieldText: { flex: 1, color: colors.text, fontSize: 15, fontFamily: font.regular },
    placeholder: { color: colors.textMuted },

    picker: {
      backgroundColor: colors.surface,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 14,
      gap: 6,
      marginTop: 6,
    },
    pickerLabel: {
      color: colors.textMuted,
      fontSize: 11,
      fontFamily: font.semibold,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
      marginTop: 6,
    },
    row: { flexGrow: 0 },
    chip: {
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 10,
      backgroundColor: colors.surfaceAlt,
      borderWidth: 1,
      borderColor: colors.border,
      marginRight: 6,
      marginTop: 6,
    },
    chipDay:  { minWidth: 38, alignItems: 'center' },
    chipYear: { minWidth: 60, alignItems: 'center' },
    chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
    chipText: { color: colors.text, fontSize: 13, fontFamily: font.medium },
    chipTextActive: { color: '#fff', fontFamily: font.bold },

    actions: { flexDirection: 'row', gap: 8, marginTop: 12, justifyContent: 'flex-end' },
    clearBtn: {
      paddingHorizontal: 14,
      paddingVertical: 10,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
    },
    clearText: { color: colors.textMuted, fontSize: 13, fontFamily: font.medium },
    confirmBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      backgroundColor: colors.primary,
      paddingHorizontal: 18,
      paddingVertical: 10,
      borderRadius: 12,
    },
    confirmText: { color: '#fff', fontSize: 14, fontFamily: font.bold },
  });
