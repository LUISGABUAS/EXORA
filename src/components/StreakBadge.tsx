import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../theme/ThemeContext';

interface Props {
  streak: number;
}

export function StreakBadge({ streak }: Props) {
  const { colors } = useTheme();

  if (streak <= 0) return null;

  return (
    <View style={[styles.pill, { backgroundColor: colors.warning + '15' }]}>
      <Text style={[styles.text, { color: colors.warning }]}>
        {'\uD83D\uDD25'} {streak} {streak === 1 ? 'dia' : 'dias'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  text: {
    fontSize: 12,
    fontWeight: '700',
  },
});
