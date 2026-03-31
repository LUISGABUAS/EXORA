import React, { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { ExpenseForm } from '../components/ExpenseForm';
import { ScreenContainer } from '../components/ScreenContainer';
import { RootStackParamList } from '../navigation/AppNavigator';
import { useExpenseStore } from '../store/useExpenseStore';
import { ColorPalette } from '../theme/colors';
import { useTheme } from '../theme/ThemeContext';
import { shadows } from '../theme/spacing';
import { ExpenseInput } from '../types/expense';
import { formatCurrency, formatDate } from '../utils/format';

type Props = NativeStackScreenProps<RootStackParamList, 'ExpenseDetail'>;

function InfoRow({ label, value, icon, colors }: { label: string; value: string; icon?: string; colors: ColorPalette }) {
  return (
    <View style={infoStyles.infoRow}>
      <View style={infoStyles.infoLabelRow}>
        {icon ? <Icon name={icon} size={14} color={colors.textMuted} /> : null}
        <Text style={[infoStyles.infoLabel, { color: colors.textMuted }]}>{label}</Text>
      </View>
      <Text style={[infoStyles.infoValue, { color: colors.text }]}>{value || '-'}</Text>
    </View>
  );
}

const infoStyles = StyleSheet.create({
  infoRow: { gap: 4 },
  infoLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  infoLabel: { fontSize: 12 },
  infoValue: { fontSize: 15, lineHeight: 22 },
});

export function ExpenseDetailScreen({ route, navigation }: Props) {
  const { colors, isDark } = useTheme();
  const s = useStyles(colors, isDark);
  const { expenseId } = route.params;
  const getExpense = useExpenseStore((state) => state.getExpense);
  const editExpense = useExpenseStore((state) => state.editExpense);
  const removeExpense = useExpenseStore((state) => state.removeExpense);
  const expense = getExpense(expenseId);
  const [editing, setEditing] = useState(false);

  if (!expense) {
    return (
      <ScreenContainer>
        <Text style={s.loading}>Gasto no encontrado.</Text>
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
        <Pressable style={s.cancelButton} onPress={() => setEditing(false)}>
          <Text style={s.cancelText}>Cancelar edicion</Text>
        </Pressable>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer>
      <View style={s.hero}>
        <Text style={s.heroLabel}>Monto</Text>
        <Text style={s.heroValue}>{formatCurrency(expense.amount)}</Text>
        <Text style={s.heroMeta}>{expense.merchantName || expense.description}</Text>
      </View>

      <View style={s.section}>
        <View style={s.sectionHeader}>
          <Icon name="information-outline" size={20} color={colors.text} />
          <Text style={s.sectionTitle}>Datos generales</Text>
        </View>
        <InfoRow label="Fecha" value={formatDate(expense.date)} icon="calendar" colors={colors} />
        <InfoRow label="Categoria" value={expense.category} icon="tag" colors={colors} />
        <InfoRow label="Descripcion" value={expense.description} icon="text" colors={colors} />
        <InfoRow label="Conceptos" value={expense.conceptsText} icon="format-list-bulleted" colors={colors} />
        <InfoRow label="Origen" value={expense.source === 'ocr' ? 'Escaneo OCR' : 'Manual'} icon="source-branch" colors={colors} />
      </View>

      <View style={s.section}>
        <View style={s.sectionHeader}>
          <Icon name="shield-check-outline" size={20} color={colors.text} />
          <Text style={s.sectionTitle}>Datos fiscales</Text>
        </View>
        <InfoRow label="Deducible" value={expense.deductible ? 'Si' : 'No'} icon="check-circle-outline" colors={colors} />
        <InfoRow label="RFC" value={expense.rfc} icon="card-account-details-outline" colors={colors} />
        <InfoRow label="Uso CFDI" value={expense.usoCFDI} icon="file-document-outline" colors={colors} />
      </View>

      {expense.ocrRawText ? (
        <View style={s.section}>
          <View style={s.sectionHeader}>
            <Icon name="text-recognition" size={20} color={colors.text} />
            <Text style={s.sectionTitle}>Texto OCR</Text>
          </View>
          <Text style={s.ocrText}>{expense.ocrRawText}</Text>
        </View>
      ) : null}

      <View style={s.actions}>
        <Pressable style={s.editButton} onPress={() => setEditing(true)}>
          <Icon name="pencil-outline" size={18} color={colors.white} />
          <Text style={s.editButtonText}>Editar</Text>
        </Pressable>
        <Pressable style={s.deleteButton} onPress={handleDelete}>
          <Icon name="trash-can-outline" size={18} color={colors.white} />
          <Text style={s.deleteButtonText}>Eliminar</Text>
        </Pressable>
      </View>
    </ScreenContainer>
  );
}

const useStyles = (colors: ColorPalette, isDark: boolean) =>
  StyleSheet.create({
    loading: { color: colors.textMuted },
    hero: { borderRadius: 26, padding: 22, backgroundColor: colors.accent, gap: 6, ...shadows.cardLg },
    heroLabel: { color: isDark ? '#aac5dc' : '#d7e5f0', fontSize: 13 },
    heroValue: { color: colors.white, fontSize: 34, fontWeight: '800' },
    heroMeta: { color: colors.white, fontSize: 15 },
    section: { borderRadius: 22, padding: 18, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, gap: 10, ...shadows.card },
    sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    sectionTitle: { color: colors.text, fontWeight: '800', fontSize: 18 },
    ocrText: { color: colors.text, lineHeight: 22 },
    actions: { flexDirection: 'row', gap: 12 },
    editButton: { flex: 1, flexDirection: 'row', gap: 6, backgroundColor: colors.primary, paddingVertical: 14, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
    editButtonText: { color: colors.white, fontWeight: '700', fontSize: 15 },
    deleteButton: { flex: 1, flexDirection: 'row', gap: 6, backgroundColor: colors.danger, paddingVertical: 14, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
    deleteButtonText: { color: colors.white, fontWeight: '700', fontSize: 15 },
    cancelButton: { paddingVertical: 14, alignItems: 'center' },
    cancelText: { color: colors.textMuted, fontWeight: '600' },
  });
