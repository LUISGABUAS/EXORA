import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import {
  CURRENCY_SYMBOLS,
  Currency,
  convertToMXN,
} from '../services/exchangeRateService';
import { useCurrencyStore } from '../store/useCurrencyStore';
import { ExpenseCategory, ExpenseInput } from '../types/expense';
import { ColorPalette } from '../theme/colors';
import { useTheme } from '../theme/ThemeContext';
import { categoryIcons } from '../theme/icons';
import { formatCurrency, toInputDate } from '../utils/format';

const categories: ExpenseCategory[] = ['Comida', 'Transporte', 'Entretenimiento', 'Salud', 'Educacion', 'Otros'];

interface ExpenseFormProps {
  initialValues?: Partial<ExpenseInput>;
  submitLabel: string;
  onSubmit: (payload: ExpenseInput) => Promise<void> | void;
}

// Currencies shown as quick-select pills (most common ones for Mexico)
const QUICK_CURRENCIES: Currency[] = ['MXN', 'USD', 'EUR'];

export function ExpenseForm({ initialValues, submitLabel, onSubmit }: ExpenseFormProps) {
  const { colors, isDark } = useTheme();
  const s = useStyles(colors, isDark);

  const defaultCurrency = useCurrencyStore(state => state.defaultCurrency);

  const [amount, setAmount] = useState(initialValues?.amount ? String(initialValues.amount) : '');
  const [currency, setCurrency] = useState<Currency>(defaultCurrency);
  const [convertedMXN, setConvertedMXN] = useState<number | null>(null);
  const [date, setDate] = useState(toInputDate(initialValues?.date));
  const [category, setCategory] = useState<ExpenseCategory>(initialValues?.category ?? 'Otros');
  const [description, setDescription] = useState(initialValues?.description ?? '');
  const [merchantName, setMerchantName] = useState(initialValues?.merchantName ?? '');
  const [conceptsText, setConceptsText] = useState(initialValues?.conceptsText ?? '');
  const [ocrRawText, setOcrRawText] = useState(initialValues?.ocrRawText ?? '');
  const [deductible, setDeductible] = useState(Boolean(initialValues?.deductible));
  const [rfc, setRfc] = useState(initialValues?.rfc ?? '');
  const [usoCFDI, setUsoCFDI] = useState(initialValues?.usoCFDI ?? '');
  const [source] = useState(initialValues?.source ?? 'manual');
  const [errors, setErrors] = useState<{ amount?: string; date?: string }>({});

  useEffect(() => {
    if (!initialValues) return;
    setAmount(initialValues.amount ? String(initialValues.amount) : '');
    setDate(toInputDate(initialValues.date));
    setCategory(initialValues.category ?? 'Otros');
    setDescription(initialValues.description ?? '');
    setMerchantName(initialValues.merchantName ?? '');
    setConceptsText(initialValues.conceptsText ?? '');
    setOcrRawText(initialValues.ocrRawText ?? '');
    setDeductible(Boolean(initialValues.deductible));
    setRfc(initialValues.rfc ?? '');
    setUsoCFDI(initialValues.usoCFDI ?? '');
  }, [initialValues]);

  // Recalculate converted amount whenever amount or currency changes
  useEffect(() => {
    const num = parseFloat(amount);
    if (!amount || isNaN(num) || num <= 0 || currency === 'MXN') {
      setConvertedMXN(null);
      return;
    }
    let cancelled = false;
    convertToMXN(num, currency).then(mxn => {
      if (!cancelled) setConvertedMXN(mxn);
    });
    return () => { cancelled = true; };
  }, [amount, currency]);

  const handleSubmit = async () => {
    const next: typeof errors = {};
    const parsedAmount = Number(amount);
    if (!amount || isNaN(parsedAmount) || parsedAmount <= 0) {
      next.amount = 'Ingresa un monto mayor a cero.';
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      next.date = 'Usa el formato YYYY-MM-DD.';
    }
    setErrors(next);
    if (Object.keys(next).length > 0) return;

    let finalAmount = parsedAmount;
    let finalDescription = description;

    if (currency !== 'MXN') {
      finalAmount = convertedMXN ?? (await convertToMXN(parsedAmount, currency));
      const originalLabel = `(${CURRENCY_SYMBOLS[currency]}${parsedAmount.toFixed(2)})`;
      finalDescription = finalDescription
        ? `${originalLabel} ${finalDescription}`
        : originalLabel;
    }

    onSubmit({
      amount: finalAmount,
      date,
      category,
      description: finalDescription,
      merchantName,
      conceptsText,
      ocrRawText,
      deductible,
      rfc,
      usoCFDI,
      source,
    });
  };

  return (
    <View style={s.card}>
      <View style={s.titleRow}>
        <Icon name="pencil-outline" size={18} color={colors.primary} />
        <Text style={s.title}>Registrar gasto</Text>
      </View>

      {/* Currency selector */}
      <View style={s.inputGroup}>
        <Text style={s.label}>Moneda</Text>
        <View style={s.currencyRow}>
          {QUICK_CURRENCIES.map(cur => (
            <Pressable
              key={cur}
              style={[s.currencyPill, currency === cur && s.currencyPillActive]}
              onPress={() => setCurrency(cur)}
            >
              <Text style={[s.currencyPillText, currency === cur && s.currencyPillTextActive]}>
                {CURRENCY_SYMBOLS[cur]} {cur}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      {/* Amount + Date row */}
      <View style={s.row}>
        <View style={s.inputGroupFlex}>
          <Text style={s.label}>Monto {currency !== 'MXN' ? `(${currency})` : ''}</Text>
          <TextInput
            keyboardType="decimal-pad"
            placeholder={currency === 'MXN' ? '$0.00' : '0.00'}
            placeholderTextColor={colors.textMuted}
            style={[s.input, errors.amount && s.inputError]}
            value={amount}
            onChangeText={t => { setAmount(t); setErrors(e => ({ ...e, amount: undefined })); }}
          />
          {errors.amount ? <Text style={s.errorText}>{errors.amount}</Text> : null}
          {currency !== 'MXN' && convertedMXN !== null ? (
            <Text style={s.convertedText}>≈ {formatCurrency(convertedMXN)} MXN</Text>
          ) : null}
        </View>
        <View style={s.inputGroupFlex}>
          <Text style={s.label}>Fecha</Text>
          <TextInput
            placeholder="YYYY-MM-DD"
            placeholderTextColor={colors.textMuted}
            style={[s.input, errors.date && s.inputError]}
            value={date}
            onChangeText={t => { setDate(t); setErrors(e => ({ ...e, date: undefined })); }}
          />
          {errors.date ? <Text style={s.errorText}>{errors.date}</Text> : null}
        </View>
      </View>

      <View style={s.inputGroup}>
        <Text style={s.label}>Comercio</Text>
        <TextInput placeholder="Nombre del comercio" placeholderTextColor={colors.textMuted} style={s.input} value={merchantName} onChangeText={setMerchantName} />
      </View>

      <View style={s.inputGroup}>
        <Text style={s.label}>Descripción</Text>
        <TextInput placeholder="Descripción del gasto" placeholderTextColor={colors.textMuted} style={s.input} value={description} onChangeText={setDescription} />
      </View>

      <View style={s.inputGroup}>
        <Text style={s.label}>Conceptos</Text>
        <TextInput placeholder="Conceptos" placeholderTextColor={colors.textMuted} style={s.input} value={conceptsText} onChangeText={setConceptsText} />
      </View>

      {/* Category */}
      <View style={s.inputGroup}>
        <Text style={s.label}>Categoría</Text>
        <View style={s.categoryRow}>
          {categories.map(item => (
            <Pressable key={item} style={[s.chip, category === item && s.chipActive]} onPress={() => setCategory(item)}>
              <Icon name={categoryIcons[item]} size={14} color={category === item ? colors.white : colors.text} />
              <Text style={[s.chipText, category === item && s.chipTextActive]}>{item}</Text>
            </Pressable>
          ))}
        </View>
      </View>

      {/* Deductible */}
      <View style={s.switchRow}>
        <View style={s.switchLabel}>
          <Icon name="shield-check-outline" size={16} color={colors.textMuted} />
          <Text style={s.label}>Gasto deducible</Text>
        </View>
        <Switch value={deductible} onValueChange={setDeductible} trackColor={{ true: colors.primary }} />
      </View>

      {/* Fiscal fields */}
      <View style={s.row}>
        <View style={s.inputGroupFlex}>
          <Text style={s.label}>RFC</Text>
          <TextInput placeholder="RFC" placeholderTextColor={colors.textMuted} style={s.input} value={rfc} onChangeText={setRfc} autoCapitalize="characters" />
        </View>
        <View style={s.inputGroupFlex}>
          <Text style={s.label}>Uso CFDI</Text>
          <TextInput placeholder="ej. G03" placeholderTextColor={colors.textMuted} style={s.input} value={usoCFDI} onChangeText={setUsoCFDI} autoCapitalize="characters" />
        </View>
      </View>

      <View style={s.inputGroup}>
        <Text style={s.label}>Texto del ticket</Text>
        <TextInput placeholder="Texto original del escaneo" placeholderTextColor={colors.textMuted} style={[s.input, s.multiline]} multiline value={ocrRawText} onChangeText={setOcrRawText} />
      </View>

      <Pressable style={s.button} onPress={handleSubmit}>
        <Icon name="check" size={18} color={colors.white} />
        <Text style={s.buttonText}>{submitLabel}</Text>
      </Pressable>
    </View>
  );
}

const useStyles = (colors: ColorPalette, isDark: boolean) =>
  StyleSheet.create({
    card: {
      backgroundColor: colors.surface,
      borderRadius: 20,
      padding: 18,
      borderWidth: 1,
      borderColor: colors.border,
      gap: 14,
    },
    titleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    title: { fontSize: 18, fontWeight: '700', color: colors.text },
    label: {
      color: colors.textMuted,
      fontSize: 12,
      fontWeight: '600',
      marginBottom: 4,
    },
    row: { flexDirection: 'row', gap: 10 },
    inputGroup: { gap: 2 },
    inputGroupFlex: { flex: 1, gap: 2 },
    input: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 16,
      paddingHorizontal: 14,
      paddingVertical: 12,
      backgroundColor: isDark ? colors.surfaceAlt : colors.white,
      color: colors.text,
      fontSize: 15,
    },
    inputError: { borderColor: colors.danger },
    errorText: { color: colors.danger, fontSize: 12, marginLeft: 4 },
    multiline: { minHeight: 80, textAlignVertical: 'top' },
    categoryRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    chip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 999,
      backgroundColor: colors.surfaceAlt,
    },
    chipActive: { backgroundColor: colors.primary },
    chipText: { color: colors.text, fontWeight: '600', fontSize: 12 },
    chipTextActive: { color: colors.white },
    switchRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    switchLabel: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    button: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      backgroundColor: colors.primary,
      paddingVertical: 14,
      borderRadius: 16,
    },
    buttonText: { color: colors.white, fontSize: 15, fontWeight: '700' },
    currencyRow: { flexDirection: 'row', gap: 8 },
    currencyPill: {
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: 999,
      backgroundColor: colors.surfaceAlt,
      borderWidth: 1.5,
      borderColor: 'transparent',
    },
    currencyPillActive: {
      backgroundColor: colors.primary + '18',
      borderColor: colors.primary,
    },
    currencyPillText: {
      color: colors.textMuted,
      fontWeight: '700',
      fontSize: 13,
    },
    currencyPillTextActive: { color: colors.primary },
    convertedText: {
      color: colors.primary,
      fontSize: 12,
      fontWeight: '600',
      marginTop: 4,
      marginLeft: 4,
    },
  });
