import React from 'react';
import { StyleSheet, View } from 'react-native';
import { SkeletonBox } from './SkeletonBox';
import { useTheme } from '../theme/ThemeContext';
import { ColorPalette } from '../theme/colors';

function SkeletonExpenseRow() {
  const { colors } = useTheme();
  const s = useRowStyles(colors);
  return (
    <View style={s.row}>
      <SkeletonBox width={40} height={40} borderRadius={20} />
      <View style={s.info}>
        <SkeletonBox width="60%" height={13} borderRadius={6} />
        <SkeletonBox width="40%" height={11} borderRadius={6} style={s.subLine} />
      </View>
      <SkeletonBox width={56} height={14} borderRadius={6} />
    </View>
  );
}

export function DashboardSkeleton() {
  const { colors } = useTheme();
  const s = useStyles(colors);

  return (
    <View style={s.container}>
      {/* Header row: avatar + greeting + bell */}
      <View style={s.headerRow}>
        <SkeletonBox width={44} height={44} borderRadius={22} />
        <View style={s.greetingBlock}>
          <SkeletonBox width={120} height={16} borderRadius={8} />
          <SkeletonBox width={80} height={12} borderRadius={6} style={s.subLine} />
        </View>
        <SkeletonBox width={32} height={32} borderRadius={16} style={s.headerRight} />
        <SkeletonBox width={24} height={24} borderRadius={12} />
      </View>

      {/* Smart input bar */}
      <SkeletonBox width="100%" height={52} borderRadius={16} style={s.inputBar} />

      {/* Tax savings card */}
      <SkeletonBox width="100%" height={72} borderRadius={18} style={s.card} />

      {/* Monthly summary card */}
      <View style={s.summaryCard}>
        <SkeletonBox width={120} height={13} borderRadius={6} />
        <SkeletonBox width={180} height={36} borderRadius={10} style={s.subLine} />
        <SkeletonBox width="100%" height={4} borderRadius={2} style={s.subLine} />
        <SkeletonBox width={160} height={12} borderRadius={6} style={s.subLine} />
      </View>

      {/* Section header: Últimos movimientos */}
      <View style={s.sectionHeader}>
        <SkeletonBox width={160} height={16} borderRadius={8} />
        <SkeletonBox width={56} height={13} borderRadius={6} />
      </View>

      {/* Recent expense rows */}
      <View style={s.recentList}>
        <SkeletonExpenseRow />
        <View style={s.separator} />
        <SkeletonExpenseRow />
        <View style={s.separator} />
        <SkeletonExpenseRow />
        <View style={s.separator} />
        <SkeletonExpenseRow />
      </View>

      {/* Budget card placeholder */}
      <SkeletonBox width="100%" height={80} borderRadius={18} style={s.card} />
    </View>
  );
}

const useStyles = (colors: ColorPalette) =>
  StyleSheet.create({
    container: {
      gap: 16,
    },
    headerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    greetingBlock: {
      flex: 1,
      gap: 6,
    },
    headerRight: {
      marginLeft: 'auto',
    },
    subLine: {
      marginTop: 6,
    },
    inputBar: {
      marginTop: 0,
    },
    card: {
      marginTop: 0,
    },
    summaryCard: {
      backgroundColor: colors.surface,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 18,
      gap: 0,
    },
    sectionHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    recentList: {
      backgroundColor: colors.surface,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: colors.border,
      overflow: 'hidden',
      paddingHorizontal: 14,
    },
    separator: {
      height: 1,
      backgroundColor: colors.border,
    },
  });

const useRowStyles = (colors: ColorPalette) =>
  StyleSheet.create({
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingVertical: 14,
    },
    info: {
      flex: 1,
      gap: 0,
    },
    subLine: {
      marginTop: 6,
    },
  });
