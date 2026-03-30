import React, { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ExpenseForm } from '../components/ExpenseForm';
import { ScreenContainer } from '../components/ScreenContainer';
import { RootStackParamList } from '../navigation/AppNavigator';
import { useExpenseStore } from '../store/useExpenseStore';
import { colors } from '../theme/colors';
import { ExpenseInput } from '../types/expense';
import { formatCurrency, formatDate } from '../utils/format';

type Props = NativeStackScreenProps<RootStackParamList, 'ExpenseDetail'>;

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value || '-'}</Text>
    </View>
  );
}

export function ExpenseDetailScreen({ route, navigation }: Props) {
  const { expenseId } = route.params;
  const getExpense = useExpenseStore((state) => state.getExpense);
  const editExpense = useExpenseStore((state) => state.editExpense);
  const removeExpense = useExpenseStore((state) => state.removeExpense);
  const expense = getExpense(expenseId);
  const [editing, setEditing] = useState(false);

  if (!expense) {
    return (
      <ScreenContainer>
        <Text style={styles.loading}>Gasto no encontrado.</Text>
      </ScreenContainer>
    );
  }

  const handleEdit = async (payload: ExpenseInput) => {
    await editExpense(expenseId, payload);
    setEditing(false);
    Alert.alert('Actualizado', 'El gasto fue modificado correctamente.');
  };

  const handleDelete = () => {
    Alert.alert('Eliminar gasto', '¿Estas seguro de que quieres eliminar este gasto?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar',
        style: 'destructive',
        onPress: async () => {
          await removeExpense(expenseId);
          navigation.goBack();
        },
      },
    ]);
  };

  if (editing) {
    return (
      <ScreenContainer>
        <ExpenseForm
          initialValues={expense}
          submitLabel="Guardar cambios"
          onSubmit={handleEdit}
        />
        <Pressable style={styles.cancelButton} onPress={() => setEditing(false)}>
          <Text style={styles.cancelText}>Cancelar edicion</Text>
        </Pressable>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer>
      <View style={styles.hero}>
        <Text style={styles.heroLabel}>Monto</Text>
        <Text style={styles.heroValue}>{formatCurrency(expense.amount)}</Text>
        <Text style={styles.heroMeta}>{expense.merchantName || expense.description}</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Datos generales</Text>
        <InfoRow label="Fecha" value={formatDate(expense.date)} />
        <InfoRow label="Categoria" value={expense.category} />
        <InfoRow label="Descripcion" value={expense.description} />
        <InfoRow label="Conceptos" value={expense.conceptsText} />
        <InfoRow label="Origen" value={expense.source === 'ocr' ? 'Escaneo OCR' : 'Manual'} />
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Datos fiscales</Text>
        <InfoRow label="Deducible" value={expense.deductible ? 'Si' : 'No'} />
        <InfoRow label="RFC" value={expense.rfc} />
        <InfoRow label="Uso CFDI" value={expense.usoCFDI} />
      </View>

      {expense.ocrRawText ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Texto OCR</Text>
          <Text style={styles.ocrText}>{expense.ocrRawText}</Text>
        </View>
      ) : null}

      <View style={styles.actions}>
        <Pressable style={styles.editButton} onPress={() => setEditing(true)}>
          <Text style={styles.editButtonText}>Editar</Text>
        </Pressable>
        <Pressable style={styles.deleteButton} onPress={handleDelete}>
          <Text style={styles.deleteButtonText}>Eliminar</Text>
        </Pressable>
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  loading: { color: colors.textMuted },
  hero: { borderRadius: 26, padding: 22, backgroundColor: colors.accent, gap: 6 },
  heroLabel: { color: '#d7e5f0', fontSize: 13 },
  heroValue: { color: colors.white, fontSize: 34, fontWeight: '800' },
  heroMeta: { color: colors.white, fontSize: 15 },
  section: { borderRadius: 22, padding: 18, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, gap: 10 },
  sectionTitle: { color: colors.text, fontWeight: '800', fontSize: 18 },
  infoRow: { gap: 4 },
  infoLabel: { color: colors.textMuted, fontSize: 12 },
  infoValue: { color: colors.text, fontSize: 15, lineHeight: 22 },
  ocrText: { color: colors.text, lineHeight: 22 },
  actions: { flexDirection: 'row', gap: 12 },
  editButton: { flex: 1, backgroundColor: colors.primary, paddingVertical: 14, borderRadius: 16, alignItems: 'center' },
  editButtonText: { color: colors.white, fontWeight: '700', fontSize: 15 },
  deleteButton: { flex: 1, backgroundColor: colors.danger, paddingVertical: 14, borderRadius: 16, alignItems: 'center' },
  deleteButtonText: { color: colors.white, fontWeight: '700', fontSize: 15 },
  cancelButton: { paddingVertical: 14, alignItems: 'center' },
  cancelText: { color: colors.textMuted, fontWeight: '600' },
});
