import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { ColorPalette } from '../theme/colors';
import { useTheme } from '../theme/ThemeContext';

interface EmptyStateProps {
  icon: string;
  title: string;
  message: string;
}

export function EmptyState({ icon, title, message }: EmptyStateProps) {
  const { colors } = useTheme();
  const s = useStyles(colors);

  return (
    <View style={s.container}>
      <Icon name={icon} size={48} color={colors.textMuted} />
      <Text style={s.title}>{title}</Text>
      <Text style={s.message}>{message}</Text>
    </View>
  );
}

const useStyles = (colors: ColorPalette) =>
  StyleSheet.create({
    container: {
      alignItems: 'center',
      paddingVertical: 40,
      gap: 8,
    },
    title: {
      color: colors.text,
      fontSize: 18,
      fontWeight: '700',
    },
    message: {
      color: colors.textMuted,
      textAlign: 'center',
      lineHeight: 20,
      paddingHorizontal: 24,
    },
  });
