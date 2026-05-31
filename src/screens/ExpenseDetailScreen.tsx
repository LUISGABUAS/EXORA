import React, { useState } from 'react';
import { Alert, Image, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import Animated, { FadeInDown } from 'react-native-reanimated';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { ExpenseForm } from '../components/ExpenseForm';
import { ScreenContainer } from '../components/ScreenContainer';
import { RootStackParamList } from '../navigation/AppNavigator';
import { useExpenseStore } from '../store/useExpenseStore';
import { ColorPalette } from '../theme/colors';
import { categoryIcons } from '../theme/icons';
import { useTheme } from '../theme/ThemeContext';
import { ExpenseCategory, ExpenseInput } from '../types/expense';
import { formatCurrency, formatDate } from '../utils/format';

type Props = NativeStackScreenProps<RootStackParamList, 'ExpenseDetail'>;

function InfoRow({ label, value, icon, colors }: { label: string; value: string; icon?: string; colors: ColorPalette }) {
  return (
    <View style={infoStyles.row}>
      <View style={infoStyles.labelRow}>
        {icon ? (
          <View style={[infoStyles.iconDot, { backgroundColor: colors.primary + '15' }]}>
            <Icon name={icon} size={14} color={colors.primary} />
          </View>
        ) : null}
        <Text style={[infoStyles.label, { color: colors.textMuted }]}>{label}</Text>
      </View>
      <Text style={[infoStyles.value, { color: colors.text }]} numberOfLines={2}>
        {value || '-'}
      </Text>
    </View>
  );
}

const infoStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
  },
  labelRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  iconDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: { fontSize: 13, fontWeight: '600' },
  value: { fontSize: 14, fontWeight: '600', textAlign: 'right', maxWidth: '50%' },
});

export function ExpenseDetailScreen({ route, navigation }: Props) {
  const { colors, isDark } = useTheme();
  const s = useStyles(colors, isDark);
  const { expenseId } = route.params;
  const getExpense = useExpenseStore(state => state.getExpense);
  const editExpense = useExpenseStore(state => state.editExpense);
  const removeExpense = useExpenseStore(state => state.removeExpense);
  const expense = getExpense(expenseId);
  const [editing, setEditing] = useState(false);
  const [imageFullscreen, setImageFullscreen] = useState(false);

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
    Alert.alert('Actualizado', 'El gasto se actualizó correctamente.');
  };

  const handleDelete = () => {
    Alert.alert('Eliminar gasto', '¿Estás seguro de que quieres eliminar este gasto?', [
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
          <Text style={s.cancelText}>Cancelar edición</Text>
        </Pressable>
      </ScreenContainer>
    );
  }

  const catIcon = categoryIcons[expense.category as ExpenseCategory] || 'dots-horizontal-circle-outline';

  return (
    <ScreenContainer>
      {/* Hero — amount + category */}
      <Animated.View entering={FadeInDown.duration(350)} style={s.hero}>
        <View style={s.heroIconCircle}>
          <Icon name={catIcon} size={28} color={colors.primary} />
        </View>
        <Text style={s.heroAmount}>{formatCurrency(expense.amount)}</Text>
        <Text style={s.heroMeta}>
          {expense.merchantName || expense.description || expense.category}
        </Text>
        <View style={s.heroBadge}>
          <Text style={s.heroBadgeText}>{expense.category}</Text>
        </View>
      </Animated.View>

      {/* General info */}
      <Animated.View entering={FadeInDown.delay(100).duration(350)} style={s.section}>
        <View style={s.sectionHeader}>
          <Icon name="information-outline" size={18} color={colors.text} />
          <Text style={s.sectionTitle}>Datos generales</Text>
        </View>
        <View style={s.divider} />
        <InfoRow label="Fecha" value={formatDate(expense.date)} icon="calendar" colors={colors} />
        <InfoRow label="Categoría" value={expense.category} icon="tag" colors={colors} />
        <InfoRow label="Descripción" value={expense.description} icon="text" colors={colors} />
        {expense.conceptsText ? (
          <InfoRow label="Conceptos" value={expense.conceptsText} icon="format-list-bulleted" colors={colors} />
        ) : null}
        <InfoRow
          label="Origen"
          value={expense.source === 'ocr' ? 'Escaneo OCR' : 'Manual'}
          icon="source-branch"
          colors={colors}
        />
      </Animated.View>

      {/* Fiscal info */}
      <Animated.View entering={FadeInDown.delay(200).duration(350)} style={s.section}>
        <View style={s.sectionHeader}>
          <Icon name="shield-check-outline" size={18} color={colors.text} />
          <Text style={s.sectionTitle}>Datos fiscales</Text>
        </View>
        <View style={s.divider} />
        <InfoRow
          label="Deducible"
          value={expense.deductible ? 'Sí' : 'No'}
          icon="check-circle-outline"
          colors={colors}
        />
        {expense.rfc ? (
          <InfoRow label="RFC" value={expense.rfc} icon="card-account-details-outline" colors={colors} />
        ) : null}
        {expense.usoCFDI ? (
          <InfoRow label="Uso CFDI" value={expense.usoCFDI} icon="file-document-outline" colors={colors} />
        ) : null}
      </Animated.View>

      {/* Receipt image */}
      {expense.receiptImageUri ? (
        <Animated.View entering={FadeInDown.delay(250).duration(350)}>
          <Pressable onPress={() => setImageFullscreen(true)} style={s.receiptImageWrap}>
            <Image
              source={{ uri: expense.receiptImageUri }}
              style={s.receiptImage}
              resizeMode="cover"
            />
            <View style={s.receiptImageOverlay}>
              <Icon name="magnify-plus-outline" size={20} color="#fff" />
              <Text style={s.receiptImageHint}>Toca para ampliar</Text>
            </View>
          </Pressable>
        </Animated.View>
      ) : null}

      {/* Fullscreen image viewer */}
      <Modal visible={imageFullscreen} transparent animationType="fade" onRequestClose={() => setImageFullscreen(false)}>
        <Pressable style={s.fullscreenOverlay} onPress={() => setImageFullscreen(false)}>
          <Image
            source={{ uri: expense.receiptImageUri }}
            style={s.fullscreenImage}
            resizeMode="contain"
          />
          <Pressable style={s.fullscreenClose} onPress={() => setImageFullscreen(false)} hitSlop={12}>
            <Icon name="close-circle" size={32} color="#fff" />
          </Pressable>
        </Pressable>
      </Modal>

      {/* Texto escaneado */}
      {expense.ocrRawText ? (
        <Animated.View entering={FadeInDown.delay(300).duration(350)} style={s.section}>
          <View style={s.sectionHeader}>
            <Icon name="text-recognition" size={18} color={colors.text} />
            <Text style={s.sectionTitle}>Texto del ticket</Text>
          </View>
          <View style={s.divider} />
          <Text style={s.ocrText}>{expense.ocrRawText}</Text>
        </Animated.View>
      ) : null}

      {/* Actions */}
      <Animated.View entering={FadeInDown.delay(350).duration(300)} style={s.actions}>
        <Pressable style={s.editButton} onPress={() => setEditing(true)}>
          <Icon name="pencil-outline" size={18} color={colors.white} />
          <Text style={s.actionText}>Editar</Text>
        </Pressable>
        <Pressable style={s.deleteButton} onPress={handleDelete}>
          <Icon name="trash-can-outline" size={18} color={colors.danger} />
          <Text style={[s.actionText, { color: colors.danger }]}>Eliminar</Text>
        </Pressable>
      </Animated.View>
    </ScreenContainer>
  );
}

const useStyles = (colors: ColorPalette, _isDark: boolean) =>
  StyleSheet.create({
    loading: { color: colors.textMuted },
    hero: {
      alignItems: 'center',
      gap: 8,
      paddingVertical: 24,
    },
    heroIconCircle: {
      width: 56,
      height: 56,
      borderRadius: 28,
      backgroundColor: colors.primary + '15',
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 4,
    },
    heroAmount: {
      color: colors.text,
      fontSize: 36,
      fontWeight: '800',
    },
    heroMeta: {
      color: colors.textMuted,
      fontSize: 15,
    },
    heroBadge: {
      backgroundColor: colors.primary + '15',
      borderRadius: 999,
      paddingHorizontal: 14,
      paddingVertical: 6,
      marginTop: 4,
    },
    heroBadgeText: {
      color: colors.primary,
      fontSize: 12,
      fontWeight: '700',
    },
    section: {
      backgroundColor: colors.surface,
      borderRadius: 20,
      padding: 18,
      borderWidth: 1,
      borderColor: colors.border,
    },
    sectionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    sectionTitle: {
      color: colors.text,
      fontWeight: '700',
      fontSize: 16,
    },
    divider: {
      height: 1,
      backgroundColor: colors.border,
      marginTop: 12,
    },
    ocrText: {
      color: colors.text,
      lineHeight: 22,
      fontSize: 13,
      marginTop: 8,
    },
    receiptImageWrap: {
      borderRadius: 18,
      overflow: 'hidden',
      borderWidth: 1,
      borderColor: colors.border,
    },
    receiptImage: {
      width: '100%',
      height: 220,
    },
    receiptImageOverlay: {
      position: 'absolute',
      bottom: 10,
      right: 12,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      backgroundColor: 'rgba(0,0,0,0.5)',
      borderRadius: 10,
      paddingHorizontal: 10,
      paddingVertical: 5,
    },
    receiptImageHint: {
      color: '#fff',
      fontSize: 11,
      fontWeight: '600',
    },
    fullscreenOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.95)',
      justifyContent: 'center',
      alignItems: 'center',
    },
    fullscreenImage: {
      width: '100%',
      height: '85%',
    },
    fullscreenClose: {
      position: 'absolute',
      top: 52,
      right: 20,
    },
    actions: {
      flexDirection: 'row',
      gap: 12,
    },
    editButton: {
      flex: 1,
      flexDirection: 'row',
      gap: 8,
      backgroundColor: colors.primary,
      paddingVertical: 14,
      borderRadius: 16,
      alignItems: 'center',
      justifyContent: 'center',
    },
    deleteButton: {
      flex: 1,
      flexDirection: 'row',
      gap: 8,
      backgroundColor: colors.danger + '12',
      paddingVertical: 14,
      borderRadius: 16,
      alignItems: 'center',
      justifyContent: 'center',
    },
    actionText: {
      color: colors.white,
      fontWeight: '700',
      fontSize: 15,
    },
    cancelButton: {
      paddingVertical: 14,
      alignItems: 'center',
    },
    cancelText: {
      color: colors.textMuted,
      fontWeight: '600',
    },
  });
