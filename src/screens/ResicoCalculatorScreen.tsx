import React, { useMemo, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { ScreenContainer } from '../components/ScreenContainer';
import { useExpenseStore } from '../store/useExpenseStore';
import { useIncomeStore } from '../store/useIncomeStore';
import { ColorPalette } from '../theme/colors';
import { font } from '../theme/typography';
import { useTheme } from '../theme/ThemeContext';
import { formatCurrency, localDateString } from '../utils/format';
import { calculateResico } from '../utils/taxCalculator';

export function ResicoCalculatorScreen() {
  const { colors, isDark } = useTheme();
  const s = useStyles(colors, isDark);
  const expenses = useExpenseStore(state => state.expenses);
  const incomes = useIncomeStore(state => state.incomes);

  const now = new Date();
  const monthPrefix = localDateString(now).slice(0, 7);

  const { monthlyDeductible, monthlyTotal, autoIncome } = useMemo(() => {
    const monthExpenses = expenses.filter(e => e.date.startsWith(monthPrefix));
    const deductible = monthExpenses
      .filter(e => e.deductible)
      .reduce((sum, e) => sum + e.amount, 0);
    const total = monthExpenses.reduce((sum, e) => sum + e.amount, 0);
    const income = incomes
      .filter(i => i.date.startsWith(monthPrefix))
      .reduce((sum, i) => sum + i.amount, 0);
    return { monthlyDeductible: deductible, monthlyTotal: total, autoIncome: income };
  }, [expenses, incomes, monthPrefix]);

  const [incomeInput, setIncomeInput] = useState('');
  const grossIncome = parseFloat(incomeInput.replace(/,/g, '.')) || autoIncome;
  const result = calculateResico(grossIncome, monthlyDeductible);

  const MONTHS = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
  ];
  const monthLabel = `${MONTHS[now.getMonth()]} ${now.getFullYear()}`;

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScreenContainer>
        {/* Header */}
        <Animated.View entering={FadeInDown.duration(300)} style={s.headerCard}>
          <View style={s.headerIcon}>
            <Icon name="calculator-variant" size={28} color={colors.primary} />
          </View>
          <View style={s.headerText}>
            <Text style={s.headerTitle}>Calculadora RESICO</Text>
            <Text style={s.headerSub}>Régimen Simplificado de Confianza · 1% mensual</Text>
          </View>
        </Animated.View>

        {/* Income Input */}
        <Animated.View entering={FadeInDown.delay(40).duration(300)}>
          <View style={s.inputCard}>
            <Text style={s.inputLabel}>Ingreso mensual bruto</Text>
            <Text style={s.inputHint}>
              {autoIncome > 0
                ? `Calculado de tus ingresos registrados este mes`
                : 'Ingresa tus ingresos antes de impuestos'}
            </Text>
            <View style={s.inputRow}>
              <Text style={s.currencySymbol}>$</Text>
              <TextInput
                style={s.input}
                value={incomeInput}
                onChangeText={setIncomeInput}
                keyboardType="decimal-pad"
                placeholder={autoIncome > 0 ? String(autoIncome) : '0.00'}
                placeholderTextColor={autoIncome > 0 ? colors.primary : colors.textMuted}
                returnKeyType="done"
              />
              <Text style={s.inputSuffix}>MXN</Text>
            </View>
          </View>
        </Animated.View>

        {/* Month Summary */}
        <Animated.View entering={FadeInDown.delay(80).duration(300)}>
          <View style={s.summaryCard}>
            <Text style={s.summaryTitle}>Resumen de {monthLabel}</Text>
            <View style={s.summaryRow}>
              <View style={s.summaryItem}>
                <Icon name="wallet-outline" size={16} color={colors.textMuted} />
                <Text style={s.summaryValue}>{formatCurrency(monthlyTotal)}</Text>
                <Text style={s.summaryLabel}>Total de gastos</Text>
              </View>
              <View style={s.summaryDivider} />
              <View style={s.summaryItem}>
                <Icon name="receipt" size={16} color={colors.primary} />
                <Text style={[s.summaryValue, { color: colors.primary }]}>
                  {formatCurrency(monthlyDeductible)}
                </Text>
                <Text style={s.summaryLabel}>Gastos deducibles</Text>
              </View>
            </View>
          </View>
        </Animated.View>

        {/* Results */}
        <Animated.View entering={FadeInDown.delay(120).duration(300)}>
          <View style={s.resultsCard}>
            <Text style={s.resultsTitle}>Resultados fiscales</Text>

            <View style={s.resultRow}>
              <View style={s.resultLeft}>
                <Icon name="cash-multiple" size={18} color={colors.textMuted} />
                <Text style={s.resultLabel}>Ingreso bruto declarado</Text>
              </View>
              <Text style={s.resultValue}>{formatCurrency(result.grossIncome)}</Text>
            </View>

            <View style={s.divider} />

            <View style={s.resultRow}>
              <View style={s.resultLeft}>
                <Icon name="minus-circle-outline" size={18} color={colors.textMuted} />
                <Text style={s.resultLabel}>Gastos deducibles este mes</Text>
              </View>
              <Text style={[s.resultValue, { color: colors.primary }]}>
                {formatCurrency(result.deductibleExpenses)}
              </Text>
            </View>

            <View style={s.divider} />

            <View style={s.resultRow}>
              <View style={s.resultLeft}>
                <Icon name="equal-box" size={18} color={colors.textMuted} />
                <Text style={s.resultLabel}>Base imponible</Text>
              </View>
              <Text style={s.resultValue}>{formatCurrency(result.taxableBase)}</Text>
            </View>

            <View style={s.divider} />

            <View style={[s.resultRow, s.resultHighlight]}>
              <View style={s.resultLeft}>
                <Icon name="calculator-variant" size={18} color={colors.primary} />
                <Text style={[s.resultLabel, { color: colors.primary, fontFamily: font.bold }]}>
                  Impuesto estimado RESICO
                </Text>
              </View>
              <Text style={[s.resultValue, s.resultValueBig, { color: colors.primary }]}>
                {formatCurrency(result.estimatedTax)}
              </Text>
            </View>

            <View style={s.divider} />

            <View style={s.resultRow}>
              <View style={s.resultLeft}>
                <Icon name="piggy-bank-outline" size={18} color="#22C55E" />
                <Text style={[s.resultLabel, { color: '#22C55E' }]}>Ahorro potencial</Text>
              </View>
              <Text style={[s.resultValue, { color: '#22C55E', fontFamily: font.extrabold }]}>
                {formatCurrency(result.potentialSaving)}
              </Text>
            </View>

            <View style={s.divider} />

            <View style={s.resultRow}>
              <View style={s.resultLeft}>
                <Icon name="percent" size={18} color={colors.textMuted} />
                <Text style={s.resultLabel}>Tasa efectiva</Text>
              </View>
              <Text style={s.resultValue}>{result.effectiveRate.toFixed(2)}%</Text>
            </View>
          </View>
        </Animated.View>

        {/* Tip Card */}
        <Animated.View entering={FadeInDown.delay(160).duration(300)}>
          <View style={s.tipCard}>
            <Icon name="lightbulb-outline" size={20} color="#F59E0B" />
            <Text style={s.tipText}>
              Con RESICO pagas 1% sobre ingresos. Cada factura deducible reduce tu base imponible y te genera un ahorro equivalente al 1% del monto deducido.
            </Text>
          </View>
        </Animated.View>

        <View style={{ height: 32 }} />
      </ScreenContainer>
    </KeyboardAvoidingView>
  );
}

const useStyles = (colors: ColorPalette, _isDark: boolean) =>
  StyleSheet.create({
    headerCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 14,
      backgroundColor: colors.surface,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 18,
    },
    headerIcon: {
      width: 52,
      height: 52,
      borderRadius: 16,
      backgroundColor: colors.primary + '18',
      alignItems: 'center',
      justifyContent: 'center',
    },
    headerText: {
      flex: 1,
      gap: 4,
    },
    headerTitle: {
      color: colors.text,
      fontSize: 18,
      fontFamily: font.extrabold,
    },
    headerSub: {
      color: colors.textMuted,
      fontSize: 12,
    },
    inputCard: {
      backgroundColor: colors.surface,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 18,
      gap: 8,
    },
    inputLabel: {
      color: colors.text,
      fontSize: 15,
      fontFamily: font.bold,
    },
    inputHint: {
      color: colors.textMuted,
      fontSize: 12,
    },
    inputRow: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.surfaceAlt,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.primary,
      paddingHorizontal: 14,
      marginTop: 4,
    },
    currencySymbol: {
      color: colors.primary,
      fontSize: 20,
      fontFamily: font.extrabold,
      marginRight: 4,
    },
    input: {
      flex: 1,
      color: colors.text,
      fontSize: 24,
      fontFamily: font.extrabold,
      paddingVertical: 14,
    },
    inputSuffix: {
      color: colors.textMuted,
      fontSize: 14,
      fontFamily: font.semibold,
      marginLeft: 6,
    },
    summaryCard: {
      backgroundColor: colors.surface,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 18,
      gap: 14,
    },
    summaryTitle: {
      color: colors.textMuted,
      fontSize: 13,
      fontFamily: font.semibold,
    },
    summaryRow: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    summaryItem: {
      flex: 1,
      gap: 4,
      alignItems: 'flex-start',
    },
    summaryDivider: {
      width: 1,
      height: 40,
      backgroundColor: colors.border,
      marginHorizontal: 16,
    },
    summaryValue: {
      color: colors.text,
      fontSize: 18,
      fontFamily: font.extrabold,
    },
    summaryLabel: {
      color: colors.textMuted,
      fontSize: 11,
    },
    resultsCard: {
      backgroundColor: colors.surface,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 18,
      gap: 0,
    },
    resultsTitle: {
      color: colors.text,
      fontSize: 15,
      fontFamily: font.bold,
      marginBottom: 14,
    },
    resultRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: 12,
    },
    resultHighlight: {
      backgroundColor: colors.primary + '0D',
      borderRadius: 12,
      paddingHorizontal: 10,
      marginHorizontal: -10,
    },
    resultLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      flex: 1,
    },
    resultLabel: {
      color: colors.textMuted,
      fontSize: 13,
      fontFamily: font.semibold,
      flex: 1,
    },
    resultValue: {
      color: colors.text,
      fontSize: 14,
      fontFamily: font.bold,
    },
    resultValueBig: {
      fontSize: 17,
    },
    divider: {
      height: 1,
      backgroundColor: colors.border,
    },
    tipCard: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 12,
      backgroundColor: '#F59E0B' + '18',
      borderRadius: 16,
      padding: 16,
      borderWidth: 1,
      borderColor: '#F59E0B' + '44',
    },
    tipText: {
      flex: 1,
      color: colors.text,
      fontSize: 13,
      lineHeight: 20,
    },
  });
