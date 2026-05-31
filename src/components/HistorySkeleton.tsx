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
      <SkeletonBox width={44} height={44} borderRadius={22} />
      <View style={s.info}>
        <SkeletonBox width="55%" height={14} borderRadius={7} />
        <SkeletonBox width="35%" height={11} borderRadius={5} style={s.subLine} />
      </View>
      <View style={s.right}>
        <SkeletonBox width={64} height={15} borderRadius={7} />
        <SkeletonBox width={44} height={11} borderRadius={5} style={s.subLine} />
      </View>
    </View>
  );
}

export function HistorySkeleton() {
  const { colors } = useTheme();
  const s = useStyles(colors);

  return (
    <View style={s.container}>
      {/* Header: title + button */}
      <View style={s.header}>
        <SkeletonBox width={160} height={28} borderRadius={10} />
        <SkeletonBox width={120} height={38} borderRadius={999} />
      </View>

      {/* Search bar */}
      <SkeletonBox width="100%" height={48} borderRadius={16} />

      {/* Category filter chips */}
      <View style={s.chips}>
        {[72, 60, 96, 72, 56, 80].map((w, i) => (
          <SkeletonBox key={i} width={w} height={34} borderRadius={999} />
        ))}
      </View>

      {/* Advanced filters toggle */}
      <SkeletonBox width={160} height={16} borderRadius={8} />

      {/* Expense rows */}
      <View style={s.list}>
        {Array.from({ length: 6 }).map((_, i) => (
          <React.Fragment key={i}>
            <SkeletonExpenseRow />
            {i < 5 ? <View style={s.separator} /> : null}
          </React.Fragment>
        ))}
      </View>
    </View>
  );
}

const useStyles = (colors: ColorPalette) =>
  StyleSheet.create({
    container: {
      gap: 16,
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      gap: 12,
    },
    chips: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    list: {
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

const useRowStyles = (_colors: ColorPalette) =>
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
    right: {
      alignItems: 'flex-end',
      gap: 0,
    },
    subLine: {
      marginTop: 6,
    },
  });
