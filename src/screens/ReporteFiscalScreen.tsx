import React, { useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { AnnualChart } from '../components/AnnualChart';
import { PaywallModal } from '../components/PaywallModal';
import { PieChart } from '../components/PieChart';
import { ScreenContainer } from '../components/ScreenContainer';
import { exportFiscalReportCsv, generateFiscalReport } from '../services/reportService';
import { exportMonthlyReport } from '../services/pdfExportService';
import { useExpenseStore } from '../store/useExpenseStore';
import { useIncomeStore } from '../store/useIncomeStore';
import { usePremiumStore } from '../store/usePremiumStore';
import { ColorPalette } from '../theme/colors';
import { font } from '../theme/typography';
import { useTheme } from '../theme/ThemeContext';
import { ExpenseCategory } from '../types/expense';
import { FISCAL_REGIME_DISPLAY } from '../types/fiscal';
import { formatCurrency } from '../utils/format';

const MONTHS = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

const CATEGORY_COLORS: Record<ExpenseCategory, string> = {
  Comida: '#22C55E',
  Transporte: '#3B82F6',
  Entretenimiento: '#F59E0B',
  Salud: '#EF4444',
  Educacion: '#8B5CF6',
  Otros: '#8E8E93',
};

function buildMonthPrefix(year: number, month: number) {
  return `${year}-${String(month + 1).padStart(2, '0')}`;
}

export function ReporteFiscalScreen() {
  const { colors, isDark } = useTheme();
  const s = useStyles(colors, isDark);
  const navigation = useNavigation();
  const expenses = useExpenseStore(state => state.expenses);
  const incomes = useIncomeStore(state => state.incomes);
  const fiscalRegime = usePremiumStore(state => state.fiscalRegime);
  const hasFullAccess = usePremiumStore(state => state.hasFullAccess);
  const isPremium = hasFullAccess();

  const now = new Date();
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth());
  const [paywallVisible, setPaywallVisible] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [sharing, setSharing] = useState(false);

  const monthPrefix = buildMonthPrefix(selectedYear, selectedMonth);

  // Override generateFiscalReport to work with arbitrary month
  const report = useMemo(() => {
    const monthExpenses = expenses.filter(e => e.date.startsWith(monthPrefix));
    const deductible = monthExpenses.filter(e => e.deductible);

    const byCategory: Record<string, { count: number; total: number; deductibleTotal: number }> = {};
    for (const e of monthExpenses) {
      if (!byCategory[e.category]) {
        byCategory[e.category] = { count: 0, total: 0, deductibleTotal: 0 };
      }
      byCategory[e.category].count++;
      byCategory[e.category].total += e.amount;
      if (e.deductible) {
        byCategory[e.category].deductibleTotal += e.amount;
      }
    }

    const totalAmount = monthExpenses.reduce((s, e) => s + e.amount, 0);
    const deductibleAmount = deductible.reduce((s, e) => s + e.amount, 0);

    // Tax rates
    const TAX_RATES: Record<string, number> = {
      resico: 0.025,
      actividad_empresarial: 0.30,
      sueldos_salarios: 0.20,
      arrendamiento: 0.35,
      plataformas_digitales: 0.04,
      honorarios: 0.30,
      regimen_general: 0.30,
      incorporacion_fiscal: 0.10,
      no_facturo: 0,
    };
    const rate = TAX_RATES[fiscalRegime] ?? 0;

    // Year-to-date (same year)
    const yearPrefix = `${selectedYear}-`;
    const yearlyDeductible = expenses
      .filter(e => e.deductible && e.date.startsWith(yearPrefix))
      .reduce((sum, e) => sum + e.amount, 0);

    const monthIncome = incomes
      .filter(i => i.date.startsWith(monthPrefix))
      .reduce((sum, i) => sum + i.amount, 0);

    return {
      totalExpenses: monthExpenses.length,
      totalAmount,
      deductibleCount: deductible.length,
      deductibleAmount,
      estimatedSaving: deductibleAmount * rate,
      yearToDate: yearlyDeductible * rate,
      deductibleRate: rate,
      byCategory,
      monthIncome,
      netFlow: monthIncome - totalAmount,
    };
  }, [expenses, incomes, fiscalRegime, monthPrefix, selectedYear]);

  const regimeDisplay = FISCAL_REGIME_DISPLAY.find(r => r.value === fiscalRegime);
  const isFiscalUser = fiscalRegime !== 'no_facturo';

  const handleShareContador = async () => {
    setSharing(true);
    try {
      const monthName = MONTHS[selectedMonth];
      if (isPremium) {
        // Premium: genera PDF y comparte
        const monthExpenses = expenses.filter(e => e.date.startsWith(monthPrefix));
        await exportMonthlyReport(monthExpenses, `${monthName} ${selectedYear}`);
      } else {
        // Free: comparte resumen en texto
        const msg =
          `📊 Reporte fiscal EXORA — ${monthName} ${selectedYear}\n\n` +
          `Régimen: ${regimeDisplay?.title ?? fiscalRegime}\n` +
          `Total gastado: ${formatCurrency(report.totalAmount)}\n` +
          `Gastos deducibles: ${formatCurrency(report.deductibleAmount)} (${report.deductibleCount} comprobantes)\n` +
          `Ahorro fiscal estimado: ${formatCurrency(report.estimatedSaving)}\n\n` +
          `Generado con EXORA`;
        await Share.share({ message: msg });
      }
    } catch (err: any) {
      if (err?.message !== 'User did not share') {
        Alert.alert('Error', 'No se pudo compartir el reporte.');
      }
    } finally {
      setSharing(false);
    }
  };

  const pieData = useMemo(() =>
    Object.entries(report.byCategory)
      .filter(([, d]) => d.total > 0)
      .map(([cat, d]) => ({
        category: cat,
        amount: d.total,
        color: CATEGORY_COLORS[cat as ExpenseCategory] || '#8E8E93',
      })),
    [report.byCategory],
  );

  const deductiblePieData = useMemo(() =>
    Object.entries(report.byCategory)
      .filter(([, d]) => d.deductibleTotal > 0)
      .map(([cat, d]) => ({
        category: cat,
        amount: d.deductibleTotal,
        color: CATEGORY_COLORS[cat as ExpenseCategory] || '#8E8E93',
      })),
    [report.byCategory],
  );

  const prevMonth = () => {
    if (selectedMonth === 0) {
      setSelectedMonth(11);
      setSelectedYear(y => y - 1);
    } else {
      setSelectedMonth(m => m - 1);
    }
  };

  const nextMonth = () => {
    const isCurrent = selectedYear === now.getFullYear() && selectedMonth === now.getMonth();
    if (isCurrent) return;
    if (selectedMonth === 11) {
      setSelectedMonth(0);
      setSelectedYear(y => y + 1);
    } else {
      setSelectedMonth(m => m + 1);
    }
  };

  const isCurrentMonth = selectedYear === now.getFullYear() && selectedMonth === now.getMonth();

  const handleExport = async () => {
    if (!isPremium) {
      setPaywallVisible(true);
      return;
    }
    setExporting(true);
    try {
      // exportFiscalReportCsv uses current month internally; we build our own CSV for the selected month
      const monthExpenses = expenses.filter(e => e.date.startsWith(monthPrefix));
      await exportFiscalReportCsv(monthExpenses, fiscalRegime);
    } catch (err) {
      Alert.alert('Error', 'No se pudo exportar el reporte.');
    } finally {
      setExporting(false);
    }
  };

  return (
    <ScreenContainer>
      {/* Month Selector */}
      <Animated.View entering={FadeInDown.duration(300)} style={s.monthSelector}>
        <Pressable onPress={prevMonth} style={s.arrowBtn} hitSlop={10}>
          <Icon name="chevron-left" size={24} color={colors.text} />
        </Pressable>
        <View style={s.monthCenter}>
          <Text style={s.monthText}>{MONTHS[selectedMonth]}</Text>
          <Text style={s.yearText}>{selectedYear}</Text>
        </View>
        <Pressable
          onPress={nextMonth}
          style={[s.arrowBtn, isCurrentMonth && s.arrowDisabled]}
          hitSlop={10}
          disabled={isCurrentMonth}
        >
          <Icon name="chevron-right" size={24} color={isCurrentMonth ? colors.border : colors.text} />
        </Pressable>
      </Animated.View>

      {/* Régimen badge */}
      {regimeDisplay && fiscalRegime !== 'no_facturo' ? (
        <Animated.View entering={FadeInDown.delay(40).duration(300)}>
          <View style={s.regimeBadge}>
            <Icon name={regimeDisplay.icon} size={14} color={colors.primary} />
            <Text style={s.regimeBadgeText}>{regimeDisplay.title}</Text>
            <Text style={s.regimeRate}>
              ISR {(report.deductibleRate * 100).toFixed(1)}%
            </Text>
          </View>
        </Animated.View>
      ) : null}

      {report.totalExpenses === 0 ? (
        <Animated.View entering={FadeInDown.delay(80).duration(300)} style={s.emptyWrap}>
          <Icon name="file-document-outline" size={48} color={colors.border} />
          <Text style={s.emptyTitle}>Sin gastos en este mes</Text>
          <Text style={s.emptyText}>Registra gastos para ver tu reporte fiscal.</Text>
        </Animated.View>
      ) : (
        <>
          {/* Summary Cards */}
          <Animated.View entering={FadeInDown.delay(60).duration(300)} style={s.cardsRow}>
            <View style={[s.statCard, { flex: 1 }]}>
              <Icon name="wallet-outline" size={18} color={colors.textMuted} />
              <Text style={s.statValue}>{formatCurrency(report.totalAmount)}</Text>
              <Text style={s.statLabel}>Total gastado</Text>
            </View>
            <View style={[s.statCard, { flex: 1 }]}>
              <Icon name="receipt" size={18} color={colors.primary} />
              <Text style={[s.statValue, { color: colors.primary }]}>
                {formatCurrency(report.deductibleAmount)}
              </Text>
              <Text style={s.statLabel}>Deducible</Text>
            </View>
          </Animated.View>

          {/* Ingresos y flujo neto */}
          {report.monthIncome > 0 ? (
            <Animated.View entering={FadeInDown.delay(65).duration(300)} style={s.cardsRow}>
              <View style={[s.statCard, { flex: 1 }]}>
                <Icon name="cash-plus" size={18} color={colors.success} />
                <Text style={[s.statValue, { color: colors.success }]}>
                  {formatCurrency(report.monthIncome)}
                </Text>
                <Text style={s.statLabel}>Ingresos</Text>
              </View>
              <View style={[s.statCard, { flex: 1 }]}>
                <Icon name="swap-vertical" size={18} color={report.netFlow >= 0 ? colors.success : colors.danger} />
                <Text style={[s.statValue, { color: report.netFlow >= 0 ? colors.success : colors.danger }]}>
                  {report.netFlow >= 0 ? '+' : ''}{formatCurrency(report.netFlow)}
                </Text>
                <Text style={s.statLabel}>Flujo neto</Text>
              </View>
            </Animated.View>
          ) : null}

          {/* Tax Saving — locked for free users */}
          <Animated.View entering={FadeInDown.delay(80).duration(300)}>
            <View style={s.savingCard}>
              <View style={s.savingHeader}>
                <Icon name="calculator-variant" size={20} color={colors.primary} />
                <Text style={s.savingTitle}>Ahorro fiscal estimado</Text>
              </View>
              {isPremium ? (
                <>
                  <Text style={s.savingAmount}>{formatCurrency(report.estimatedSaving)}</Text>
                  <View style={s.savingMeta}>
                    <Text style={s.savingMetaText}>
                      Acumulado {selectedYear}: {formatCurrency(report.yearToDate)}
                    </Text>
                    <Text style={s.savingMetaText}>
                      {report.deductibleCount} gasto{report.deductibleCount !== 1 ? 's' : ''} deducible{report.deductibleCount !== 1 ? 's' : ''}
                    </Text>
                  </View>
                </>
              ) : (
                <View style={s.lockedBlock}>
                  <View style={s.lockedRow}>
                    <Text style={s.lockedAmount}>$X,XXX</Text>
                    <Icon name="lock" size={18} color={colors.textMuted} />
                  </View>
                  <Pressable style={s.unlockBtn} onPress={() => setPaywallVisible(true)}>
                    <Text style={s.unlockText}>Desbloquear ahorro real</Text>
                  </Pressable>
                </View>
              )}
            </View>
          </Animated.View>

          {/* Pie Chart — total spending */}
          {pieData.length > 0 ? (
            <Animated.View entering={FadeInDown.delay(100).duration(300)}>
              <PieChart data={pieData} />
            </Animated.View>
          ) : null}

          {/* Deductible Pie — only if has deductibles */}
          {deductiblePieData.length > 0 ? (
            <Animated.View entering={FadeInDown.delay(120).duration(300)}>
              <View style={s.deductiblePieWrap}>
                <View style={s.deductiblePieHeader}>
                  <Icon name="check-circle-outline" size={16} color={colors.primary} />
                  <Text style={s.deductiblePieTitle}>Gastos deducibles por categoría</Text>
                </View>
                <PieChart data={deductiblePieData} />
              </View>
            </Animated.View>
          ) : null}

          {/* Category Breakdown Table */}
          <Animated.View entering={FadeInDown.delay(140).duration(300)}>
            <View style={s.table}>
              <Text style={s.tableTitle}>Desglose por categoría</Text>
              <View style={s.tableHeader}>
                <Text style={[s.tableHeaderCell, { flex: 2 }]}>Categoría</Text>
                <Text style={[s.tableHeaderCell, s.right]}>Total</Text>
                <Text style={[s.tableHeaderCell, s.right, { color: colors.primary }]}>Deducible</Text>
              </View>
              {Object.entries(report.byCategory).map(([cat, data], idx, arr) => (
                <View
                  key={cat}
                  style={[s.tableRow, idx === arr.length - 1 && s.tableRowLast]}
                >
                  <View style={s.catCell}>
                    <View style={[s.catDot, { backgroundColor: CATEGORY_COLORS[cat as ExpenseCategory] || '#8E8E93' }]} />
                    <Text style={s.catName}>{cat}</Text>
                    <Text style={s.catCount}>×{data.count}</Text>
                  </View>
                  <Text style={[s.tableCell, s.right]}>{formatCurrency(data.total)}</Text>
                  <Text style={[s.tableCell, s.right, { color: data.deductibleTotal > 0 ? colors.primary : colors.textMuted }]}>
                    {data.deductibleTotal > 0 ? formatCurrency(data.deductibleTotal) : '—'}
                  </Text>
                </View>
              ))}
            </View>
          </Animated.View>

          {/* Annual Chart */}
          <Animated.View entering={FadeInDown.delay(155).duration(300)}>
            <AnnualChart expenses={expenses} />
          </Animated.View>

          {/* Export Button */}
          <Animated.View entering={FadeInDown.delay(160).duration(300)} style={s.actionsRow}>
            <Pressable
              style={[s.exportBtn, exporting && s.exportBtnDisabled]}
              onPress={handleExport}
              disabled={exporting}
            >
              {isPremium ? (
                <Icon name="download" size={18} color={colors.white} />
              ) : (
                <Icon name="lock" size={18} color={colors.white} />
              )}
              <Text style={s.exportBtnText}>
                {exporting ? 'Exportando…' : isPremium ? 'Exportar CSV' : 'Exportar CSV (Premium)'}
              </Text>
            </Pressable>

            {isFiscalUser ? (
              <Pressable
                style={[s.shareBtn, sharing && s.exportBtnDisabled]}
                onPress={handleShareContador}
                disabled={sharing}
              >
                <Icon name="whatsapp" size={18} color={colors.primary} />
                <Text style={s.shareBtnText}>
                  {sharing ? 'Preparando…' : 'Enviar a mi contador'}
                </Text>
              </Pressable>
            ) : null}
          </Animated.View>
        </>
      )}

      <View style={{ height: 32 }} />

      <PaywallModal
        visible={paywallVisible}
        onClose={() => setPaywallVisible(false)}
        trigger="fiscal_report"
      />
    </ScreenContainer>
  );
}

const useStyles = (colors: ColorPalette, _isDark: boolean) =>
  StyleSheet.create({
    monthSelector: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: colors.surface,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: 8,
      paddingVertical: 10,
    },
    arrowBtn: {
      padding: 8,
    },
    arrowDisabled: {
      opacity: 0.3,
    },
    monthCenter: {
      alignItems: 'center',
      gap: 2,
    },
    monthText: {
      color: colors.text,
      fontSize: 18,
      fontFamily: font.extrabold,
    },
    yearText: {
      color: colors.textMuted,
      fontSize: 13,
    },
    regimeBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      alignSelf: 'center',
      backgroundColor: colors.primary + '15',
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 999,
    },
    regimeBadgeText: {
      color: colors.primary,
      fontSize: 13,
      fontFamily: font.bold,
    },
    regimeRate: {
      color: colors.primary,
      fontSize: 12,
      fontFamily: font.semibold,
      opacity: 0.8,
    },
    emptyWrap: {
      alignItems: 'center',
      justifyContent: 'center',
      gap: 12,
      paddingTop: 64,
    },
    emptyTitle: {
      color: colors.text,
      fontSize: 18,
      fontFamily: font.bold,
    },
    emptyText: {
      color: colors.textMuted,
      fontSize: 14,
      textAlign: 'center',
    },
    cardsRow: {
      flexDirection: 'row',
      gap: 12,
    },
    statCard: {
      backgroundColor: colors.surface,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 14,
      gap: 6,
      alignItems: 'flex-start',
    },
    statValue: {
      color: colors.text,
      fontSize: 20,
      fontFamily: font.extrabold,
    },
    statLabel: {
      color: colors.textMuted,
      fontSize: 12,
    },
    savingCard: {
      backgroundColor: colors.surface,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 18,
      gap: 10,
    },
    savingHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    savingTitle: {
      color: colors.text,
      fontSize: 15,
      fontFamily: font.bold,
    },
    savingAmount: {
      color: colors.primary,
      fontSize: 36,
      fontFamily: font.extrabold,
    },
    savingMeta: {
      gap: 2,
    },
    savingMetaText: {
      color: colors.textMuted,
      fontSize: 13,
    },
    lockedBlock: {
      alignItems: 'center',
      gap: 12,
    },
    lockedRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    lockedAmount: {
      color: colors.textMuted,
      fontSize: 36,
      fontFamily: font.extrabold,
      opacity: 0.4,
    },
    unlockBtn: {
      backgroundColor: colors.primary,
      paddingHorizontal: 24,
      paddingVertical: 12,
      borderRadius: 14,
    },
    unlockText: {
      color: colors.white,
      fontFamily: font.bold,
      fontSize: 14,
    },
    deductiblePieWrap: {
      gap: 10,
    },
    deductiblePieHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    deductiblePieTitle: {
      color: colors.text,
      fontSize: 15,
      fontFamily: font.bold,
    },
    table: {
      backgroundColor: colors.surface,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: colors.border,
      overflow: 'hidden',
      padding: 16,
      gap: 0,
    },
    tableTitle: {
      color: colors.text,
      fontSize: 15,
      fontFamily: font.bold,
      marginBottom: 12,
    },
    tableHeader: {
      flexDirection: 'row',
      paddingBottom: 8,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      marginBottom: 4,
    },
    tableHeaderCell: {
      color: colors.textMuted,
      fontSize: 12,
      fontFamily: font.semibold,
      flex: 1,
    },
    tableRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 10,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    tableRowLast: {
      borderBottomWidth: 0,
    },
    tableCell: {
      color: colors.text,
      fontSize: 13,
      fontFamily: font.semibold,
      flex: 1,
    },
    catCell: {
      flex: 2,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    catDot: {
      width: 10,
      height: 10,
      borderRadius: 5,
    },
    catName: {
      color: colors.text,
      fontSize: 13,
      fontFamily: font.semibold,
      flex: 1,
    },
    catCount: {
      color: colors.textMuted,
      fontSize: 11,
    },
    right: {
      textAlign: 'right',
    },
    actionsRow: {
      gap: 10,
    },
    exportBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      backgroundColor: colors.primary,
      paddingVertical: 16,
      borderRadius: 18,
    },
    exportBtnDisabled: {
      opacity: 0.6,
    },
    exportBtnText: {
      color: colors.white,
      fontSize: 15,
      fontFamily: font.bold,
    },
    shareBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      backgroundColor: colors.primary + '15',
      borderWidth: 1,
      borderColor: colors.primary + '40',
      paddingVertical: 14,
      borderRadius: 18,
    },
    shareBtnText: {
      color: colors.primary,
      fontSize: 15,
      fontFamily: font.bold,
    },
  });
