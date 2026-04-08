import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { Insight } from '../services/insightService';
import { ColorPalette } from '../theme/colors';
import { useTheme } from '../theme/ThemeContext';

interface InsightCardProps {
  insight: Insight;
  index: number;
  onPremiumPress?: () => void;
}

const TYPE_COLORS: Record<Insight['type'], string> = {
  warning: '#F59E0B',
  tip: '#3B82F6',
  saving: '#22C55E',
};

export function InsightCard({ insight, index, onPremiumPress }: InsightCardProps) {
  const { colors } = useTheme();
  const s = useStyles(colors);
  const accentColor = TYPE_COLORS[insight.type] || colors.primary;

  return (
    <Animated.View entering={FadeInDown.delay(index * 80).duration(300)}>
      <View style={[s.card, { borderLeftColor: accentColor }]}>
        <View style={[s.iconCircle, { backgroundColor: accentColor + '18' }]}>
          <Icon name={insight.icon} size={18} color={accentColor} />
        </View>
        <View style={s.content}>
          <Text style={s.title}>{insight.title}</Text>
          <Text style={s.message}>{insight.message}</Text>
        </View>
        {insight.isPremium && onPremiumPress ? (
          <Pressable style={s.premiumBadge} onPress={onPremiumPress} hitSlop={8}>
            <Icon name="lock" size={12} color={colors.white} />
          </Pressable>
        ) : null}
      </View>
    </Animated.View>
  );
}

const useStyles = (colors: ColorPalette) =>
  StyleSheet.create({
    card: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 10,
      backgroundColor: colors.surface,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.border,
      borderLeftWidth: 3,
      padding: 14,
    },
    iconCircle: {
      width: 34,
      height: 34,
      borderRadius: 17,
      alignItems: 'center',
      justifyContent: 'center',
    },
    content: {
      flex: 1,
      gap: 2,
    },
    title: {
      color: colors.text,
      fontSize: 14,
      fontWeight: '700',
    },
    message: {
      color: colors.textMuted,
      fontSize: 12,
      lineHeight: 17,
    },
    premiumBadge: {
      width: 24,
      height: 24,
      borderRadius: 12,
      backgroundColor: colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
  });
