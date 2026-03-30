import React, { useEffect, useState } from 'react';
import { Alert, Pressable, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { ExpenseCategory, ExpenseInput } from '../types/expense';
import { colors } from '../theme/colors';
import { toInputDate } from '../utils/format';

const categories: ExpenseCategory[] = ['Comida', 'Transporte', 'Entretenimiento', 'Salud', 'Educacion', 'Otros'];

interface ExpenseFormProps {
  initialValues?: Partial<ExpenseInput>;
  submitLabel: string;
  onSubmit: (payload: ExpenseInput) => Promise<void> | void;
}

export function ExpenseForm({ initialValues, submitLabel, onSubmit }: ExpenseFormProps) {
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
    const parsedAmount = Number(amount);
    if (!amount || isNaN(parsedAmount) || parsedAmount <= 0) {
      Alert.alert('Monto invalido', 'Ingresa un monto mayor a cero.');
      return;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      Alert.alert('Fecha invalida', 'Usa el formato YYYY-MM-DD.');
      return;
    }
    onSubmit({ amount: parsedAmount, date, category, description, merchantName, conceptsText, ocrRawText, deductible, rfc, usoCFDI, source });
  };

  return (
    <View style={styles.card}>
      <Text style={styles.title}>Registrar gasto</Text>
      <TextInput keyboardType="decimal-pad" placeholder="Monto" placeholderTextColor={colors.textMuted} style={styles.input} value={amount} onChangeText={setAmount} />
      <TextInput placeholder="Fecha (YYYY-MM-DD)" placeholderTextColor={colors.textMuted} style={styles.input} value={date} onChangeText={setDate} />
      <TextInput placeholder="Comercio" placeholderTextColor={colors.textMuted} style={styles.input} value={merchantName} onChangeText={setMerchantName} />
      <TextInput placeholder="Descripcion" placeholderTextColor={colors.textMuted} style={styles.input} value={description} onChangeText={setDescription} />
      <TextInput placeholder="Conceptos" placeholderTextColor={colors.textMuted} style={styles.input} value={conceptsText} onChangeText={setConceptsText} />

      <View style={styles.categoryRow}>
        {categories.map((item) => (
          <Pressable key={item} style={[styles.chip, category === item && styles.chipActive]} onPress={() => setCategory(item)}>
            <Text style={[styles.chipText, category === item && styles.chipTextActive]}>{item}</Text>
          </Pressable>
        ))}
      </View>

      <View style={styles.switchRow}>
        <Text style={styles.label}>Gasto deducible</Text>
        <Switch value={deductible} onValueChange={setDeductible} trackColor={{ true: colors.primary }} />
      </View>

      <TextInput placeholder="RFC" placeholderTextColor={colors.textMuted} style={styles.input} value={rfc} onChangeText={setRfc} autoCapitalize="characters" />
      <TextInput placeholder="Uso CFDI (ej. G03)" placeholderTextColor={colors.textMuted} style={styles.input} value={usoCFDI} onChangeText={setUsoCFDI} autoCapitalize="characters" />
      <TextInput placeholder="Texto OCR original" placeholderTextColor={colors.textMuted} style={[styles.input, styles.multiline]} multiline value={ocrRawText} onChangeText={setOcrRawText} />

      <Pressable style={styles.button} onPress={handleSubmit}>
        <Text style={styles.buttonText}>{submitLabel}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.surface, borderRadius: 24, padding: 18, borderWidth: 1, borderColor: colors.border, gap: 12 },
  title: { fontSize: 20, fontWeight: '700', color: colors.text },
  input: { borderWidth: 1, borderColor: colors.border, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12, backgroundColor: colors.white, color: colors.text },
  multiline: { minHeight: 100, textAlignVertical: 'top' },
  categoryRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, backgroundColor: colors.surfaceAlt },
  chipActive: { backgroundColor: colors.primary },
  chipText: { color: colors.text, fontWeight: '600', fontSize: 12 },
  chipTextActive: { color: colors.white },
  switchRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  label: { color: colors.text, fontWeight: '600' },
  button: { backgroundColor: colors.text, paddingVertical: 14, alignItems: 'center', borderRadius: 16 },
  buttonText: { color: colors.white, fontSize: 15, fontWeight: '700' },
});
