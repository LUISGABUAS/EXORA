import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors } from '../theme/colors';

type Tone = 'primary' | 'secondary' | 'accent';

const toneColors: Record<Tone, string> = {
  primary: colors.primary,
  secondary: colors.secondary,
  accent: colors.accent,
};

interface StatCardProps {
  label: string;
  value: string;
  tone?: Tone;
}

export function StatCard({ label, value, tone = 'primary' }: StatCardProps) {
  return (
    <View style={[styles.card, { borderLeftColor: toneColors[tone] }]}>
      <Text style={styles.label}>{label}</Text>
      <Text style={[styles.value, { color: toneColors[tone] }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
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
