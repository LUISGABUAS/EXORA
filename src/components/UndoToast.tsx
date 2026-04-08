import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { SlideInDown, SlideOutDown } from 'react-native-reanimated';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { ColorPalette } from '../theme/colors';
import { useTheme } from '../theme/ThemeContext';

interface UndoToastProps {
  visible: boolean;
  message: string;
  onUndo: () => void;
  onDismiss: () => void;
  duration?: number;
}

export function UndoToast({ visible, message, onUndo, onDismiss, duration = 4000 }: UndoToastProps) {
  const { colors, isDark } = useTheme();
  const s = useStyles(colors, isDark);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [undone, setUndone] = useState(false);

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (visible && !undone) {
      clearTimer();
      timerRef.current = setTimeout(onDismiss, duration);
    }
    return clearTimer;
  }, [visible, undone, duration, onDismiss, clearTimer]);

  useEffect(() => {
    if (!visible) setUndone(false);
  }, [visible]);

  const handleUndo = () => {
    clearTimer();
    onUndo();
    setUndone(true);
    setTimeout(onDismiss, 800);
  };

  if (!visible) return null;

  return (
    <Animated.View
      entering={SlideInDown.springify().damping(18)}
      exiting={SlideOutDown.duration(250)}
      style={s.container}
    >
      <View style={s.pill}>
        <Icon
          name={undone ? 'close-circle' : 'check-circle'}
          size={20}
          color={undone ? colors.danger : colors.success}
        />
        <Text style={s.message} numberOfLines={1}>
          {undone ? 'Gasto eliminado' : message}
        </Text>
        {!undone ? (
          <Pressable onPress={handleUndo} hitSlop={8}>
            <Text style={s.undoButton}>Deshacer</Text>
          </Pressable>
        ) : null}
      </View>
    </Animated.View>
  );
}

const useStyles = (colors: ColorPalette, isDark: boolean) =>
  StyleSheet.create({
    container: {
      position: 'absolute',
      bottom: 16,
      left: 16,
      right: 16,
      zIndex: 999,
    },
    pill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      backgroundColor: isDark ? colors.surface : colors.text,
      borderRadius: 16,
      paddingHorizontal: 16,
      paddingVertical: 14,
    },
    message: {
      flex: 1,
      color: isDark ? colors.text : colors.white,
      fontSize: 14,
      fontWeight: '600',
    },
    undoButton: {
      color: colors.secondary,
      fontWeight: '700',
      fontSize: 14,
    },
  });
