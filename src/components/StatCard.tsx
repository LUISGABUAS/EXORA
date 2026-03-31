import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { ColorPalette } from '../theme/colors';
import { useTheme } from '../theme/ThemeContext';

type Tone = 'primary' | 'secondary' | 'accent';

interface StatCardProps {
  label: string;
  value: string;
  tone?: Tone;
  icon?: string;
}

export function StatCard({ label, value, tone = 'primary', icon }: StatCardProps) {
  const { colors } = useTheme();
  const s = useStyles(colors);

  const toneColors: Record<Tone, string> = {
    primary: colors.primary,
    secondary: colors.secondary,
    accent: colors.accent,
  };

  return (
    <View style={[s.card, { borderLeftColor: toneColors[tone] }]}>
      {icon ? (
        <Icon name={icon} size={18} color={toneColors[tone]} />
      ) : null}
      <Text style={s.label}>{label}</Text>
      <Text style={[s.value, { color: toneColors[tone] }]}>{value}</Text>
    </View>
  );
}

const useStyles = (colors: ColorPalette) =>
  StyleSheet.create({
    card: {
      flex: 1,
      backgroundColor: colors.surface,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: colors.border,
      borderLeftWidth: 4,
      padding: 14,
      gap: 4,
    },
    label: {
      color: colors.textMuted,
      fontSize: 12,
      fontWeight: '600',
    },
    value: {
      fontSize: 18,
      fontWeight: '800',
    },
  });
