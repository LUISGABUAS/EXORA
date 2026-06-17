import React, { useMemo, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ScreenContainer } from '../components/ScreenContainer';
import { useExpenseStore } from '../store/useExpenseStore';
import { useIncomeStore } from '../store/useIncomeStore';
import { usePremiumStore, FiscalRegime } from '../store/usePremiumStore';
import { ColorPalette } from '../theme/colors';
import { font } from '../theme/typography';
import { useTheme } from '../theme/ThemeContext';
import { formatCurrency, localDateString } from '../utils/format';
import { calculateTax } from '../utils/taxCalculator';
import { FISCAL_REGIME_DISPLAY } from '../types/fiscal';
import { RootStackParamList } from '../navigation/AppNavigator';

const MONTHS = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

const REGIME_LABELS: Partial<Record<FiscalRegime, { title: string; subtitle: string; icon: string }>> = {
  resico:                { title: 'RESICO', subtitle: 'Régimen Simplificado de Confianza · 1%', icon: 'account-check' },
  honorarios:            { title: 'Honorarios', subtitle: 'Actividad Profesional · Tabla ISR', icon: 'school-outline' },
  actividad_empresarial: { title: 'Actividad Empresarial', subtitle: 'ISR con deducciones · Tabla 2024', icon: 'briefcase-outline' },
  arrendamiento:         { title: 'Arrendamiento', subtitle: 'Renta de inmuebles · Deducción ciega 35%', icon: 'home-city-outline' },
  plataformas_digitales: { title: 'Plataformas Digitales', subtitle: 'Uber, Airbnb, etc. · Retención + ISR', icon: 'cellphone-link' },
  sueldos_salarios:      { title: 'Sueldos y Salarios', subtitle: 'ISR retenido por patrón · Tabla 2024', icon: 'account-tie' },
  incorporacion_fiscal:  { title: 'Incorporación Fiscal', subtitle: 'RIF · Reducción progresiva', icon: 'store-outline' },
  regimen_general:       { title: 'Régimen General', subtitle: 'Personas morales · 30%', icon: 'domain' },
  no_facturo:            { title: 'Sin régimen fiscal', subtitle: 'Configura tu régimen para calcular', icon: 'wallet-outline' },
};

export function ResicoCalculatorScreen() {
  const { colors, isDark } = useTheme();
  const s = useStyles(colors, isDark);
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const expenses = useExpenseStore(state => state.expenses);
  const incomes = useIncomeStore(state => state.incomes);
  const storedRegime = usePremiumStore(state => state.fiscalRegime);
  const allFiscalRegimes = usePremiumStore(state => state.allFiscalRegimes);
  const constanciaUri = usePremiumStore(state => state.constanciaUri);

  // Si hay múltiples regímenes detectados de la constancia, permitir selección
  const availableRegimes = allFiscalRegimes.length > 1 ? allFiscalRegimes : null;
  const [selectedRegime, setSelectedRegime] = useState<FiscalRegime>(storedRegime);
  const fiscalRegime = selectedRegime;

  const now = new Date();
  const monthPrefix = localDateString(now).slice(0, 7);
  const monthLabel = `${MONTHS[now.getMonth()]} ${now.getFullYear()}`;

  const { monthlyDeductible, monthlyTotal, autoIncome } = useMemo(() => {
    const monthExpenses = expenses.filter(e => e.date.startsWith(monthPrefix));
    const deductible = monthExpenses.filter(e => e.deductible).reduce((s, e) => s + e.amount, 0);
    const total = monthExpenses.reduce((s, e) => s + e.amount, 0);
    const income = incomes.filter(i => i.date.startsWith(monthPrefix)).reduce((s, i) => s + i.amount, 0);
    return { monthlyDeductible: deductible, monthlyTotal: total, autoIncome: income };
  }, [expenses, incomes, monthPrefix]);

  const [incomeInput, setIncomeInput] = useState('');
  const grossIncome = parseFloat(incomeInput.replace(/,/g, '.')) || autoIncome;
  const result = calculateTax(grossIncome, monthlyDeductible, fiscalRegime);

  const regimeInfo = REGIME_LABELS[fiscalRegime] ?? REGIME_LABELS.no_facturo!;
  const isNoRegime = fiscalRegime === 'no_facturo';
  const fromConstancia = !!constanciaUri;

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScreenContainer>

        {/* Header — Régimen detectado */}
        <Animated.View entering={FadeInDown.duration(300)} style={s.headerCard}>
          <View style={[s.headerIcon, { backgroundColor: colors.primary + '18' }]}>
            <Icon name={regimeInfo.icon} size={28} color={colors.primary} />
          </View>
          <View style={s.headerText}>
            <Text style={s.headerTitle}>Calculadora Fiscal</Text>
            <Text style={s.headerRegime}>{regimeInfo.title}</Text>
            <Text style={s.headerSub}>{regimeInfo.subtitle}</Text>
          </View>
          {fromConstancia && (
            <View style={s.constanciaBadge}>
              <Icon name="shield-check" size={12} color={colors.primary} />
              <Text style={s.constanciaBadgeText}>Verificado</Text>
            </View>
          )}
        </Animated.View>

        {/* Selector de régimen cuando hay múltiples en la constancia */}
        {availableRegimes && (
          <Animated.View entering={FadeInDown.delay(20).duration(300)}>
            <View style={s.regimeSelectorCard}>
              <Text style={s.regimeSelectorTitle}>
                <Icon name="file-document-check-outline" size={13} color={colors.textMuted} />
                {'  '}Regímenes detectados en tu constancia
              </Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.regimeTabs}>
                {availableRegimes.map(r => {
                  const info = REGIME_LABELS[r] ?? REGIME_LABELS.no_facturo!;
                  const isActive = r === selectedRegime;
                  return (
                    <Pressable
                      key={r}
                      style={[s.regimeTab, isActive && { backgroundColor: colors.primary, borderColor: colors.primary }]}
                      onPress={() => setSelectedRegime(r)}
                    >
                      <Icon name={info.icon} size={14} color={isActive ? '#fff' : colors.textMuted} />
                      <Text style={[s.regimeTabText, isActive && { color: '#fff' }]}>{info.title}</Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
            </View>
          </Animated.View>
        )}

        {/* Si no tiene régimen configurado */}
        {isNoRegime ? (
          <Animated.View entering={FadeInDown.delay(40).duration(300)} style={s.noRegimeCard}>
            <Icon name="alert-circle-outline" size={32} color={colors.warning} />
            <Text style={s.noRegimeTitle}>Régimen no configurado</Text>
            <Text style={s.noRegimeText}>
              Para calcular tus impuestos correctamente, configura tu régimen fiscal en tu perfil.
            </Text>
            <Pressable style={s.noRegimeBtn} onPress={() => navigation.navigate('ProfileEdit')}>
              <Icon name="account-edit-outline" size={16} color="#fff" />
              <Text style={s.noRegimeBtnText}>Configurar régimen</Text>
            </Pressable>
          </Animated.View>
        ) : (
          <>
            {/* Income Input */}
            <Animated.View entering={FadeInDown.delay(40).duration(300)}>
              <View style={s.inputCard}>
                <Text style={s.inputLabel}>Ingreso mensual bruto</Text>
                <Text style={s.inputHint}>
                  {autoIncome > 0
                    ? `Tomado de tus ingresos de ${monthLabel}`
                    : 'Ingresa tus ingresos antes de impuestos'}
                </Text>
                <View style={s.inputRow}>
                  <Text style={s.currencySymbol}>$</Text>
                  <TextInput
                    style={s.input}
                    value={incomeInput}
                    onChangeText={setIncomeInput}
                    keyboardType="decimal-pad"
                    placeholder={autoIncome > 0 ? autoIncome.toFixed(0) : '0.00'}
                    placeholderTextColor={autoIncome > 0 ? colors.primary : colors.textMuted}
                    returnKeyType="done"
                  />
                  <Text style={s.inputSuffix}>MXN</Text>
                </View>
              </View>
            </Animated.View>

            {/* Resumen del mes */}
            <Animated.View entering={FadeInDown.delay(80).duration(300)}>
              <View style={s.summaryCard}>
                <Text style={s.summaryTitle}>Resumen de {monthLabel}</Text>
                <View style={s.summaryRow}>
                  <View style={s.summaryItem}>
                    <Icon name="wallet-outline" size={16} color={colors.textMuted} />
                    <Text style={s.summaryValue}>{formatCurrency(monthlyTotal)}</Text>
                    <Text style={s.summaryLabel}>Total gastos</Text>
                  </View>
                  <View style={s.summaryDivider} />
                  <View style={s.summaryItem}>
                    <Icon name="receipt" size={16} color={colors.primary} />
                    <Text style={[s.summaryValue, { color: colors.primary }]}>
                      {formatCurrency(monthlyDeductible)}
                    </Text>
                    <Text style={s.summaryLabel}>Deducibles</Text>
                  </View>
                  <View style={s.summaryDivider} />
                  <View style={s.summaryItem}>
                    <Icon name="cash-multiple" size={16} color="#22C55E" />
                    <Text style={[s.summaryValue, { color: '#22C55E' }]}>
                      {formatCurrency(autoIncome)}
                    </Text>
                    <Text style={s.summaryLabel}>Ingresos</Text>
                  </View>
                </View>
              </View>
            </Animated.View>

            {/* Resultados */}
            {grossIncome > 0 && (
              <Animated.View entering={FadeInDown.delay(120).duration(300)}>
                <View style={s.resultsCard}>
                  <Text style={s.resultsTitle}>Resultado fiscal estimado</Text>

                  {result.breakdown.map((item, idx) => (
                    <View key={idx}>
                      {idx > 0 && <View style={s.divider} />}
                      <View style={[s.resultRow, item.isHighlight && s.resultHighlight]}>
                        <Text style={[
                          s.resultLabel,
                          item.isHighlight && { color: colors.primary, fontFamily: font.bold },
                          item.isGreen && { color: '#22C55E' },
                        ]}>
                          {item.label}
                        </Text>
                        <Text style={[
                          s.resultValue,
                          item.isHighlight && { color: colors.primary, fontSize: 17, fontFamily: font.extrabold },
                          item.isGreen && { color: '#22C55E', fontFamily: font.extrabold },
                        ]}>
                          {item.label.toLowerCase().includes('tasa') || item.label.toLowerCase().includes('rate')
                            ? `${item.value.toFixed(2)}%`
                            : formatCurrency(item.value)}
                        </Text>
                      </View>
                    </View>
                  ))}

                  {/* Tasa efectiva */}
                  <View style={s.divider} />
                  <View style={s.resultRow}>
                    <Text style={s.resultLabel}>Tasa efectiva</Text>
                    <Text style={s.resultValue}>{result.effectiveRate.toFixed(2)}%</Text>
                  </View>
                </View>
              </Animated.View>
            )}

            {/* Tip del régimen */}
            <Animated.View entering={FadeInDown.delay(160).duration(300)}>
              <View style={s.tipCard}>
                <Icon name="lightbulb-outline" size={20} color="#F59E0B" />
                <Text style={s.tipText}>{result.tip}</Text>
              </View>
            </Animated.View>

            {/* Nota de estimación */}
            <Animated.View entering={FadeInDown.delay(180).duration(300)}>
              <Text style={s.disclaimer}>
                * Cálculo estimado con tarifas 2024. Consulta a un contador para cifras exactas.
              </Text>
            </Animated.View>
          </>
        )}

        <View style={{ height: 32 }} />
      </ScreenContainer>
    </KeyboardAvoidingView>
  );
}

const useStyles = (colors: ColorPalette, isDark: boolean) =>
  StyleSheet.create({
    headerCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 14,
      backgroundColor: isDark ? '#111111' : colors.surface,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 18,
    },
    headerIcon: {
      width: 56,
      height: 56,
      borderRadius: 16,
      alignItems: 'center',
      justifyContent: 'center',
    },
    headerText: { flex: 1, gap: 2 },
    headerTitle: { color: colors.textMuted, fontSize: 12, fontFamily: font.semibold },
    headerRegime: { color: colors.text, fontSize: 18, fontFamily: font.extrabold },
    headerSub: { color: colors.textMuted, fontSize: 12 },
    constanciaBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      backgroundColor: colors.primary + '18',
      borderRadius: 8,
      paddingHorizontal: 8,
      paddingVertical: 4,
      alignSelf: 'flex-start',
    },
    constanciaBadgeText: { color: colors.primary, fontSize: 11, fontFamily: font.bold },
    regimeSelectorCard: {
      backgroundColor: isDark ? '#111111' : colors.surface,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 14,
      gap: 10,
    },
    regimeSelectorTitle: { color: colors.textMuted, fontSize: 12, fontFamily: font.semibold },
    regimeTabs: { flexDirection: 'row' },
    regimeTab: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 10,
      paddingHorizontal: 12,
      paddingVertical: 8,
      marginRight: 8,
    },
    regimeTabText: { color: colors.textMuted, fontSize: 13, fontFamily: font.semibold },

    noRegimeCard: {
      backgroundColor: colors.warning + '10',
      borderRadius: 20,
      borderWidth: 1,
      borderColor: colors.warning + '40',
      padding: 24,
      alignItems: 'center',
      gap: 12,
    },
    noRegimeTitle: { color: colors.text, fontSize: 17, fontFamily: font.bold, textAlign: 'center' },
    noRegimeText: { color: colors.textMuted, fontSize: 14, textAlign: 'center', lineHeight: 22 },
    noRegimeBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      backgroundColor: colors.primary,
      paddingVertical: 12,
      paddingHorizontal: 20,
      borderRadius: 14,
      marginTop: 4,
    },
    noRegimeBtnText: { color: '#fff', fontFamily: font.bold, fontSize: 14 },

    inputCard: {
      backgroundColor: isDark ? '#111111' : colors.surface,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 18,
      gap: 8,
    },
    inputLabel: { color: colors.text, fontSize: 15, fontFamily: font.bold },
    inputHint: { color: colors.textMuted, fontSize: 12 },
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
    currencySymbol: { color: colors.primary, fontSize: 20, fontFamily: font.extrabold, marginRight: 4 },
    input: { flex: 1, color: colors.text, fontSize: 24, fontFamily: font.extrabold, paddingVertical: 14 },
    inputSuffix: { color: colors.textMuted, fontSize: 14, fontFamily: font.semibold, marginLeft: 6 },

    summaryCard: {
      backgroundColor: isDark ? '#111111' : colors.surface,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 18,
      gap: 14,
    },
    summaryTitle: { color: colors.textMuted, fontSize: 13, fontFamily: font.semibold },
    summaryRow: { flexDirection: 'row', alignItems: 'center' },
    summaryItem: { flex: 1, gap: 4, alignItems: 'flex-start' },
    summaryDivider: { width: 1, height: 40, backgroundColor: colors.border, marginHorizontal: 12 },
    summaryValue: { color: colors.text, fontSize: 16, fontFamily: font.extrabold },
    summaryLabel: { color: colors.textMuted, fontSize: 11 },

    resultsCard: {
      backgroundColor: isDark ? '#111111' : colors.surface,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 18,
    },
    resultsTitle: { color: colors.text, fontSize: 15, fontFamily: font.bold, marginBottom: 14 },
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
    resultLabel: { color: colors.textMuted, fontSize: 13, fontFamily: font.semibold, flex: 1 },
    resultValue: { color: colors.text, fontSize: 14, fontFamily: font.bold },
    divider: { height: 1, backgroundColor: colors.border },

    tipCard: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 12,
      backgroundColor: '#F59E0B18',
      borderRadius: 16,
      padding: 16,
      borderWidth: 1,
      borderColor: '#F59E0B44',
    },
    tipText: { flex: 1, color: colors.text, fontSize: 13, lineHeight: 20 },
    disclaimer: {
      color: colors.textMuted,
      fontSize: 11,
      textAlign: 'center',
      lineHeight: 17,
    },
  });
