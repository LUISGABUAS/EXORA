import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { ColorPalette } from '../theme/colors';
import { useTheme } from '../theme/ThemeContext';

interface EmptyStateProps {
  icon: string;
  title: string;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
}

export function EmptyState({ icon, title, message, actionLabel, onAction }: EmptyStateProps) {
  const { colors } = useTheme();
  const s = useStyles(colors);

  return (
    <View style={s.container}>
      <View style={s.iconCircle}>
        <Icon name={icon} size={36} color={colors.primary} />
      </View>
      <Text style={s.title}>{title}</Text>
      <Text style={s.message}>{message}</Text>
      {actionLabel && onAction ? (
        <Pressable style={s.button} onPress={onAction}>
          <Icon name="plus" size={18} color={colors.white} />
          <Text style={s.buttonText}>{actionLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const useStyles = (colors: ColorPalette) =>
  StyleSheet.create({
    container: {
      alignItems: 'center',
      paddingVertical: 40,
      gap: 10,
    },
    iconCircle: {
      width: 72,
      height: 72,
      borderRadius: 36,
      backgroundColor: colors.primary + '12',
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 4,
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
    button: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      backgroundColor: colors.primary,
      borderRadius: 14,
      paddingHorizontal: 20,
      paddingVertical: 12,
      marginTop: 8,
    },
    buttonText: {
      color: colors.white,
      fontSize: 15,
      fontWeight: '700',
    },
  });
