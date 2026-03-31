import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { ExpenseCategory, ExpenseInput } from '../types/expense';
import { ColorPalette } from '../theme/colors';
import { useTheme } from '../theme/ThemeContext';
import { categoryIcons } from '../theme/icons';
import { toInputDate } from '../utils/format';

const categories: ExpenseCategory[] = ['Comida', 'Transporte', 'Entretenimiento', 'Salud', 'Educacion', 'Otros'];

interface ExpenseFormProps {
  initialValues?: Partial<ExpenseInput>;
  submitLabel: string;
  onSubmit: (payload: ExpenseInput) => Promise<void> | void;
}

export function ExpenseForm({ initialValues, submitLabel, onSubmit }: ExpenseFormProps) {
  const { colors, isDark } = useTheme();
  const s = useStyles(colors, isDark);

  const [amount, setAmount] = useState(initialValues?.amount ? String(initialValues.amount) : '');
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
    if (!initialValues) {
      return;
    }
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

  const handleSubmit = () => {
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

    onSubmit({ amount: parsedAmount, date, category, description, merchantName, conceptsText, ocrRawText, deductible, rfc, usoCFDI, source });
  };

  return (
    <View style={s.card}>
      <Text style={s.title}>Registrar gasto</Text>

      <View style={s.inputGroup}>
        <TextInput keyboardType="decimal-pad" placeholder="Monto" placeholderTextColor={colors.textMuted} style={[s.input, errors.amount && s.inputError]} value={amount} onChangeText={t => { setAmount(t); setErrors(e => ({ ...e, amount: undefined })); }} />
        {errors.amount ? <Text style={s.errorText}>{errors.amount}</Text> : null}
      </View>

      <View style={s.inputGroup}>
        <TextInput placeholder="Fecha (YYYY-MM-DD)" placeholderTextColor={colors.textMuted} style={[s.input, errors.date && s.inputError]} value={date} onChangeText={t => { setDate(t); setErrors(e => ({ ...e, date: undefined })); }} />
        {errors.date ? <Text style={s.errorText}>{errors.date}</Text> : null}
      </View>

      <TextInput placeholder="Comercio" placeholderTextColor={colors.textMuted} style={s.input} value={merchantName} onChangeText={setMerchantName} />
      <TextInput placeholder="Descripcion" placeholderTextColor={colors.textMuted} style={s.input} value={description} onChangeText={setDescription} />
      <TextInput placeholder="Conceptos" placeholderTextColor={colors.textMuted} style={s.input} value={conceptsText} onChangeText={setConceptsText} />

      <View style={s.categoryRow}>
        {categories.map(item => (
          <Pressable key={item} style={[s.chip, category === item && s.chipActive]} onPress={() => setCategory(item)}>
            <Icon name={categoryIcons[item]} size={14} color={category === item ? colors.white : colors.text} />
            <Text style={[s.chipText, category === item && s.chipTextActive]}>{item}</Text>
          </Pressable>
        ))}
      </View>

      <View style={s.switchRow}>
        <Text style={s.label}>Gasto deducible</Text>
        <Switch value={deductible} onValueChange={setDeductible} trackColor={{ true: colors.primary }} />
      </View>

      <TextInput placeholder="RFC" placeholderTextColor={colors.textMuted} style={s.input} value={rfc} onChangeText={setRfc} autoCapitalize="characters" />
      <TextInput placeholder="Uso CFDI (ej. G03)" placeholderTextColor={colors.textMuted} style={s.input} value={usoCFDI} onChangeText={setUsoCFDI} autoCapitalize="characters" />
      <TextInput placeholder="Texto OCR original" placeholderTextColor={colors.textMuted} style={[s.input, s.multiline]} multiline value={ocrRawText} onChangeText={setOcrRawText} />

      <Pressable style={s.button} onPress={handleSubmit}>
        <Text style={s.buttonText}>{submitLabel}</Text>
      </Pressable>
    </View>
  );
}

const useStyles = (colors: ColorPalette, isDark: boolean) =>
  StyleSheet.create({
    card: { backgroundColor: colors.surface, borderRadius: 24, padding: 18, borderWidth: 1, borderColor: colors.border, gap: 12 },
    title: { fontSize: 20, fontWeight: '700', color: colors.text },
    inputGroup: { gap: 4 },
    input: { borderWidth: 1, borderColor: colors.border, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12, backgroundColor: isDark ? colors.surfaceAlt : colors.white, color: colors.text },
    inputError: { borderColor: colors.danger },
    errorText: { color: colors.danger, fontSize: 12, marginLeft: 4 },
    multiline: { minHeight: 100, textAlignVertical: 'top' },
    categoryRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    chip: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, backgroundColor: colors.surfaceAlt },
    chipActive: { backgroundColor: colors.primary },
    chipText: { color: colors.text, fontWeight: '600', fontSize: 12 },
    chipTextActive: { color: colors.white },
    switchRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    label: { color: colors.text, fontWeight: '600' },
    button: { backgroundColor: colors.text, paddingVertical: 14, alignItems: 'center', borderRadius: 16 },
    buttonText: { color: isDark ? colors.background : colors.white, fontSize: 15, fontWeight: '700' },
  });
