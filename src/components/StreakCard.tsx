import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useTheme } from '../theme/ThemeContext';
import { font } from '../theme/typography';

interface Milestone {
  min: number;
  max: number;
  badge: string;
  label: string;
  color: string;
  percentile: string;
}

const MILESTONES: Milestone[] = [
  { min: 1,   max: 2,   badge: '🌱', label: 'Empezando',     color: '#22C55E', percentile: '¡Buen comienzo! Sigue así.' },
  { min: 3,   max: 6,   badge: '⚡', label: '3 días',        color: '#F59E0B', percentile: 'Ya llevas más constancia que el 40% de usuarios.' },
  { min: 7,   max: 13,  badge: '🔥', label: '1 semana',      color: '#F97316', percentile: 'Estás en el top 30% de constancia en EXORA.' },
  { min: 14,  max: 29,  badge: '💪', label: '2 semanas',     color: '#EF4444', percentile: 'Más constante que el 70% de los usuarios de EXORA.' },
  { min: 30,  max: 59,  badge: '🏅', label: '1 mes',         color: '#8B5CF6', percentile: 'Top 10% — llevas más que casi todos los usuarios.' },
  { min: 60,  max: 99,  badge: '🥈', label: '2 meses',       color: '#06B6D4', percentile: 'Top 5% — casi nadie llega tan lejos.' },
  { min: 100, max: 364, badge: '🏆', label: '100 días',      color: '#3B82F6', percentile: 'Top 1% — eres un ejemplo de disciplina financiera.' },
  { min: 365, max: Infinity, badge: '👑', label: '1 año',   color: '#F59E0B', percentile: 'Leyenda absoluta. Llevas un año sin parar.' },
];

function getMilestone(streak: number): Milestone | null {
  return MILESTONES.find(m => streak >= m.min && streak <= m.max) ?? null;
}

function getNextMilestone(streak: number): number {
  const next = MILESTONES.find(m => m.min > streak);
  return next ? next.min : 365;
}

interface Props {
  streak: number;
  onPress?: () => void;
}

export function StreakCard({ streak, onPress }: Props) {
  const { colors, isDark } = useTheme();
  const s = useStyles(colors, isDark);

  if (streak <= 0) return null;

  const milestone = getMilestone(streak);
  const nextMilestone = getNextMilestone(streak);
  const progress = milestone
    ? (streak - milestone.min) / (Math.min(milestone.max, nextMilestone - 1) - milestone.min + 1)
    : 1;
  const daysToNext = nextMilestone - streak;
  const accentColor = milestone?.color ?? colors.primary;

  return (
    <Animated.View entering={FadeInDown.delay(170).duration(350)}>
      <Pressable style={[s.card, { borderColor: accentColor + '30' }]} onPress={onPress}>
        {/* Left: flame + number */}
        <View style={[s.flameBg, { backgroundColor: accentColor + '18' }]}>
          <Text style={s.flameEmoji}>{milestone?.badge ?? '🔥'}</Text>
          <Text style={[s.streakNum, { color: accentColor }]}>{streak}</Text>
          <Text style={[s.streakUnit, { color: accentColor }]}>{streak === 1 ? 'día' : 'días'}</Text>
        </View>

        {/* Right: info */}
        <View style={s.info}>
          <View style={s.badgeRow}>
            <View style={[s.badgePill, { backgroundColor: accentColor + '20' }]}>
              <Text style={[s.badgeText, { color: accentColor }]}>{milestone?.label ?? 'Racha'}</Text>
            </View>
            <Text style={s.rachaLabel}>Racha activa</Text>
          </View>

          <Text style={s.percentile} numberOfLines={2}>
            {milestone?.percentile ?? '¡Sigue así!'}
          </Text>

          {/* Progress to next milestone */}
          {daysToNext > 0 && daysToNext < 365 && (
            <View style={s.progressWrap}>
              <View style={s.progressBg}>
                <View
                  style={[
                    s.progressFill,
                    { width: `${Math.min(progress * 100, 100)}%` as any, backgroundColor: accentColor },
                  ]}
                />
              </View>
              <Text style={s.progressLabel}>{daysToNext}d para el siguiente</Text>
            </View>
          )}
        </View>
      </Pressable>
    </Animated.View>
  );
}

const useStyles = (colors: any, isDark: boolean) =>
  StyleSheet.create({
    card: {
      flexDirection: 'row',
      gap: 14,
      backgroundColor: colors.surface,
      borderRadius: 20,
      borderWidth: 1,
      padding: 16,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: isDark ? 0.2 : 0.06,
      shadowRadius: 8,
      elevation: 3,
    },
    flameBg: {
      width: 68,
      borderRadius: 16,
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 10,
      gap: 2,
    },
    flameEmoji: { fontSize: 24 },
    streakNum: { fontSize: 26, fontFamily: font.black, lineHeight: 30 },
    streakUnit: { fontSize: 11, fontFamily: font.semibold, marginTop: -2 },

    info: { flex: 1, gap: 6, justifyContent: 'center' },
    badgeRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    badgePill: {
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 8,
    },
    badgeText: { fontSize: 11, fontFamily: font.extrabold },
    rachaLabel: { color: colors.textMuted, fontSize: 11, fontFamily: font.medium },

    percentile: { color: colors.text, fontSize: 12, fontFamily: font.medium, lineHeight: 17 },

    progressWrap: { gap: 4, marginTop: 2 },
    progressBg: {
      height: 4,
      backgroundColor: colors.border,
      borderRadius: 2,
      overflow: 'hidden',
    },
    progressFill: { height: 4, borderRadius: 2 },
    progressLabel: { color: colors.textMuted, fontSize: 10, fontFamily: font.medium },
  });
