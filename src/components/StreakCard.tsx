import React, { useCallback, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { useTheme } from '../theme/ThemeContext';
import { font } from '../theme/typography';
import { Expense } from '../types/expense';
import { formatCurrency } from '../utils/format';

interface Milestone {
  min: number;
  max: number;
  badge: string;
  label: string;
  color: string;
}

const MILESTONES: Milestone[] = [
  { min: 1,   max: 2,   badge: '🌱', label: 'Empezando',  color: '#22C55E' },
  { min: 3,   max: 6,   badge: '⚡', label: '3 días',     color: '#F59E0B' },
  { min: 7,   max: 13,  badge: '🔥', label: '1 semana',   color: '#F97316' },
  { min: 14,  max: 29,  badge: '💪', label: '2 semanas',  color: '#EF4444' },
  { min: 30,  max: 59,  badge: '🏅', label: '1 mes',      color: '#8B5CF6' },
  { min: 60,  max: 99,  badge: '🥈', label: '2 meses',    color: '#06B6D4' },
  { min: 100, max: 364, badge: '🏆', label: '100 días',   color: '#3B82F6' },
  { min: 365, max: Infinity, badge: '👑', label: '1 año', color: '#F59E0B' },
];

function getMilestone(streak: number): Milestone | null {
  return MILESTONES.find(m => streak >= m.min && streak <= m.max) ?? null;
}

function getNextMilestoneMin(streak: number): number {
  return MILESTONES.find(m => m.min > streak)?.min ?? 365;
}

type Insight = { icon: string; text: string };

function buildInsights(streak: number, expenses: Expense[]): Insight[] {
  const items: Insight[] = [];

  // Compute streak-period stats
  const since = new Date();
  since.setDate(since.getDate() - streak + 1);
  const sinceStr = `${since.getFullYear()}-${String(since.getMonth() + 1).padStart(2, '0')}-${String(since.getDate()).padStart(2, '0')}`;
  const streakExp = expenses.filter(e => e.date >= sinceStr);
  const count = streakExp.length;
  const total = streakExp.reduce((s, e) => s + e.amount, 0);
  const deductible = streakExp.filter(e => e.deductible).reduce((s, e) => s + e.amount, 0);
  const avgDaily = streak > 1 && total > 0 ? total / streak : 0;

  // 1. Social comparison based on streak tier
  if (streak >= 100) {
    items.push({ icon: '🏆', text: 'Top 1% de constancia en EXORA.' });
  } else if (streak >= 60) {
    items.push({ icon: '🥈', text: 'Top 5% — casi nadie llega tan lejos.' });
  } else if (streak >= 30) {
    items.push({ icon: '🏅', text: 'Top 10% — llevas más que casi todos.' });
  } else if (streak >= 14) {
    items.push({ icon: '💪', text: 'Más constante que el 70% de usuarios.' });
  } else if (streak >= 7) {
    items.push({ icon: '🔥', text: 'Top 30% de constancia en EXORA.' });
  } else if (streak >= 3) {
    items.push({ icon: '⚡', text: 'Más constante que el 40% de usuarios.' });
  } else {
    items.push({ icon: '🌱', text: '¡Buen comienzo! Cada día cuenta.' });
  }

  // 2. Gastos registrados en la racha
  if (count === 1) {
    items.push({ icon: '📊', text: '1 gasto registrado en tu racha.' });
  } else if (count > 1) {
    items.push({ icon: '📊', text: `${count} gastos registrados en tu racha.` });
  }

  // 3. Total controlado
  if (total > 0 && streak >= 3) {
    items.push({ icon: '💰', text: `Controlaste ${formatCurrency(total)} en tu racha.` });
  }

  // 4. Deducciones detectadas
  if (deductible > 0) {
    items.push({ icon: '🧾', text: `${formatCurrency(deductible)} en deducciones detectadas.` });
  }

  // 5. Promedio diario
  if (avgDaily > 0) {
    items.push({ icon: '📅', text: `Promedio diario esta racha: ${formatCurrency(avgDaily)}.` });
  }

  return items;
}

interface Props {
  streak: number;
  expenses: Expense[];
}

export function StreakCard({ streak, expenses }: Props) {
  const { colors, isDark } = useTheme();
  const s = useStyles(colors, isDark);
  const [idx, setIdx] = useState(0);

  if (streak <= 0) return null;

  const milestone = getMilestone(streak);
  const nextMilestone = getNextMilestoneMin(streak);
  const accentColor = milestone?.color ?? colors.primary;

  const milestoneMax = milestone?.max === Infinity ? nextMilestone - 1 : (milestone?.max ?? nextMilestone - 1);
  const progress = milestone
    ? (streak - milestone.min) / (Math.max(milestoneMax - milestone.min + 1, 1))
    : 1;
  const daysToNext = nextMilestone - streak;

  const insights = useMemo(() => buildInsights(streak, expenses), [streak, expenses]);
  const currentInsight = insights[idx % insights.length];
  const hasMultiple = insights.length > 1;

  const handlePress = useCallback(() => {
    if (hasMultiple) setIdx(i => (i + 1) % insights.length);
  }, [hasMultiple, insights.length]);

  return (
    <Animated.View entering={FadeInDown.delay(170).duration(350)}>
      <Pressable
        style={[s.card, { borderColor: accentColor + '30' }]}
        onPress={handlePress}
        android_ripple={{ color: accentColor + '18', borderless: false }}
      >
        {/* Left: badge + number */}
        <View style={[s.flameBg, { backgroundColor: accentColor + '18' }]}>
          <Text style={s.flameEmoji}>{milestone?.badge ?? '🔥'}</Text>
          <Text style={[s.streakNum, { color: accentColor }]}>{streak}</Text>
          <Text style={[s.streakUnit, { color: accentColor }]}>{streak === 1 ? 'día' : 'días'}</Text>
        </View>

        {/* Right: info */}
        <View style={s.info}>
          {/* Header row */}
          <View style={s.headerRow}>
            <View style={[s.badgePill, { backgroundColor: accentColor + '20' }]}>
              <Text style={[s.badgeText, { color: accentColor }]}>{milestone?.label ?? 'Racha'}</Text>
            </View>
            <Text style={s.rachaLabel}>Racha activa</Text>
          </View>

          {/* Cycling insight */}
          <Animated.View key={idx} entering={FadeIn.duration(250)} style={s.insightRow}>
            <Text style={s.insightIcon}>{currentInsight.icon}</Text>
            <Text style={[s.insightText, { color: colors.text }]} numberOfLines={2}>
              {currentInsight.text}
            </Text>
          </Animated.View>

          {/* Progress bar */}
          {daysToNext > 0 && daysToNext < 365 && (
            <View style={s.progressWrap}>
              <View style={[s.progressBg, { backgroundColor: colors.border }]}>
                <View
                  style={[
                    s.progressFill,
                    {
                      width: `${Math.min(progress * 100, 100)}%` as any,
                      backgroundColor: accentColor,
                    },
                  ]}
                />
              </View>
              <Text style={[s.progressLabel, { color: colors.textMuted }]}>
                {daysToNext}d para el siguiente logro
              </Text>
            </View>
          )}

          {/* Dots — only when there are multiple insights */}
          {hasMultiple && (
            <View style={s.dots}>
              {insights.map((_, i) => (
                <View
                  key={i}
                  style={[
                    s.dot,
                    {
                      backgroundColor:
                        i === idx % insights.length ? accentColor : accentColor + '35',
                      width: i === idx % insights.length ? 14 : 5,
                    },
                  ]}
                />
              ))}
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

    headerRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    badgePill: {
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 8,
    },
    badgeText: { fontSize: 11, fontFamily: font.extrabold },
    rachaLabel: { color: colors.textMuted, fontSize: 11, fontFamily: font.medium },

    insightRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 6 },
    insightIcon: { fontSize: 13, lineHeight: 18 },
    insightText: { flex: 1, fontSize: 12, fontFamily: font.medium, lineHeight: 17 },

    progressWrap: { gap: 4, marginTop: 2 },
    progressBg: {
      height: 4,
      borderRadius: 2,
      overflow: 'hidden',
    },
    progressFill: { height: 4, borderRadius: 2 },
    progressLabel: { fontSize: 10, fontFamily: font.medium },

    dots: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
    dot: { height: 5, borderRadius: 3 },
  });
