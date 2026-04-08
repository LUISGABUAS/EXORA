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

  const toneColor = toneColors[tone];

  return (
    <View style={s.card}>
      {icon ? (
        <View style={[s.iconCircle, { backgroundColor: toneColor + '18' }]}>
          <Icon name={icon} size={20} color={toneColor} />
        </View>
      ) : null}
      <Text style={[s.value, { color: toneColor }]} numberOfLines={1}>
        {value}
      </Text>
      <Text style={s.label}>{label}</Text>
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
      padding: 14,
      alignItems: 'center',
      gap: 6,
    },
    iconCircle: {
      width: 44,
      height: 44,
      borderRadius: 22,
      alignItems: 'center',
      justifyContent: 'center',
    },
    value: {
      fontSize: 16,
      fontWeight: '800',
    },
    label: {
      color: colors.textMuted,
      fontSize: 11,
      fontWeight: '600',
    },
  });
