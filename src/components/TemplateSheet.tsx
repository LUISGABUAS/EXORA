import React, { useState } from 'react';
import {
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useTemplateStore, Template } from '../store/useTemplateStore';
import { categoryIcons } from '../theme/icons';
import { ColorPalette } from '../theme/colors';
import { useTheme } from '../theme/ThemeContext';
import { ExpenseCategory, ExpenseInput } from '../types/expense';
import { formatCurrency, localDateString } from '../utils/format';

const ALL_CATEGORIES: ExpenseCategory[] = [
  'Comida', 'Transporte', 'Entretenimiento', 'Salud', 'Educacion', 'Otros',
];

interface TemplateSheetProps {
  visible: boolean;
  onSelect: (input: ExpenseInput) => void;
  onClose: () => void;
}

function templateToInput(t: Template): ExpenseInput {
  return {
    amount: t.amount,
    date: localDateString(new Date()),
    category: t.category,
    description: t.description,
    merchantName: t.merchantName,
    conceptsText: '',
    ocrRawText: '',
    deductible: false,
    rfc: '',
    usoCFDI: '',
    source: 'manual',
  };
}

export function TemplateSheet({ visible, onSelect, onClose }: TemplateSheetProps) {
  const { colors } = useTheme();
  const s = useStyles(colors);
  const templates = useTemplateStore(state => state.templates);
  const addTemplate = useTemplateStore(state => state.addTemplate);
  const removeTemplate = useTemplateStore(state => state.removeTemplate);

  const [showForm, setShowForm] = useState(false);
  const [newName, setNewName] = useState('');
  const [newAmount, setNewAmount] = useState('');
  const [newCategory, setNewCategory] = useState<ExpenseCategory>('Otros');

  const defaults = templates.filter(t => t.isDefault);
  const custom = templates.filter(t => !t.isDefault);

  const handleSelect = (t: Template) => {
    onSelect(templateToInput(t));
  };

  const handleLongPress = (t: Template) => {
    if (t.isDefault) return;
    Alert.alert('Eliminar plantilla', `¿Eliminar "${t.name}"?`, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Eliminar', style: 'destructive', onPress: () => removeTemplate(t.id) },
    ]);
  };

  const handleAddTemplate = async () => {
    const amount = parseFloat(newAmount);
    if (!newName.trim() || isNaN(amount) || amount <= 0) {
      Alert.alert('Error', 'Ingresa un nombre y monto valido.');
      return;
    }
    await addTemplate({
      name: newName.trim(),
      amount,
      category: newCategory,
      merchantName: '',
      description: newName.trim(),
    });
    setNewName('');
    setNewAmount('');
    setNewCategory('Otros');
    setShowForm(false);
  };

  const renderItem = (t: Template) => (
    <Pressable
      key={t.id}
      style={s.item}
      onPress={() => handleSelect(t)}
      onLongPress={() => handleLongPress(t)}
    >
      <View style={s.itemIcon}>
        <Icon
          name={categoryIcons[t.category] || 'dots-horizontal-circle-outline'}
          size={20}
          color={colors.primary}
        />
      </View>
      <View style={s.itemInfo}>
        <Text style={s.itemName}>{t.name}</Text>
        <Text style={s.itemCategory}>{t.category}</Text>
      </View>
      <Text style={s.itemAmount}>{formatCurrency(t.amount)}</Text>
    </Pressable>
  );

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={s.overlay}>
        <View style={s.sheet}>
          {/* Header */}
          <View style={s.header}>
            <Text style={s.title}>Plantillas</Text>
            <Pressable onPress={onClose} hitSlop={12}>
              <Icon name="close" size={22} color={colors.textMuted} />
            </Pressable>
          </View>

          <ScrollView
            style={s.list}
            contentContainerStyle={s.listContent}
            showsVerticalScrollIndicator={false}
          >
            {/* Default templates */}
            <Text style={s.sectionLabel}>Plantillas predefinidas</Text>
            {defaults.map(renderItem)}

            {/* Custom templates */}
            {custom.length > 0 ? (
              <>
                <Text style={s.sectionLabel}>Mis plantillas</Text>
                {custom.map(renderItem)}
                <Text style={s.hint}>Manten presionada para eliminar</Text>
              </>
            ) : null}

            {/* Add new template */}
            {showForm ? (
              <View style={s.formCard}>
                <TextInput
                  style={s.formInput}
                  placeholder="Nombre"
                  placeholderTextColor={colors.textMuted}
                  value={newName}
                  onChangeText={setNewName}
                />
                <TextInput
                  style={s.formInput}
                  placeholder="Monto"
                  placeholderTextColor={colors.textMuted}
                  value={newAmount}
                  onChangeText={setNewAmount}
                  keyboardType="numeric"
                />
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={s.catRow}
                >
                  {ALL_CATEGORIES.map(cat => (
                    <Pressable
                      key={cat}
                      style={[s.catChip, newCategory === cat && s.catChipActive]}
                      onPress={() => setNewCategory(cat)}
                    >
                      <Text
                        style={[s.catChipText, newCategory === cat && s.catChipTextActive]}
                      >
                        {cat}
                      </Text>
                    </Pressable>
                  ))}
                </ScrollView>
                <View style={s.formActions}>
                  <Pressable style={s.formCancel} onPress={() => setShowForm(false)}>
                    <Text style={s.formCancelText}>Cancelar</Text>
                  </Pressable>
                  <Pressable style={s.formSave} onPress={handleAddTemplate}>
                    <Text style={s.formSaveText}>Guardar</Text>
                  </Pressable>
                </View>
              </View>
            ) : (
              <Pressable style={s.addButton} onPress={() => setShowForm(true)}>
                <Icon name="plus" size={18} color={colors.primary} />
                <Text style={s.addButtonText}>Crear nueva plantilla</Text>
              </Pressable>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const useStyles = (colors: ColorPalette) =>
  StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.5)',
      justifyContent: 'flex-end',
    },
    sheet: {
      backgroundColor: colors.background,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      maxHeight: '80%',
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: 20,
      paddingTop: 20,
      paddingBottom: 12,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    title: {
      color: colors.text,
      fontSize: 18,
      fontWeight: '800',
    },
    list: { flex: 1 },
    listContent: {
      paddingHorizontal: 20,
      paddingVertical: 16,
      gap: 8,
      paddingBottom: 40,
    },
    sectionLabel: {
      color: colors.textMuted,
      fontSize: 12,
      fontWeight: '700',
      marginTop: 8,
      marginBottom: 4,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    item: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      backgroundColor: colors.surface,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 14,
    },
    itemIcon: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: colors.primary + '15',
      alignItems: 'center',
      justifyContent: 'center',
    },
    itemInfo: {
      flex: 1,
      gap: 2,
    },
    itemName: {
      color: colors.text,
      fontSize: 15,
      fontWeight: '700',
    },
    itemCategory: {
      color: colors.textMuted,
      fontSize: 12,
    },
    itemAmount: {
      color: colors.text,
      fontSize: 15,
      fontWeight: '800',
    },
    hint: {
      color: colors.textMuted,
      fontSize: 11,
      textAlign: 'center',
      marginTop: 4,
    },
    addButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      paddingVertical: 14,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.primary,
      borderStyle: 'dashed',
      marginTop: 8,
    },
    addButtonText: {
      color: colors.primary,
      fontSize: 14,
      fontWeight: '700',
    },
    formCard: {
      backgroundColor: colors.surface,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 14,
      gap: 10,
      marginTop: 8,
    },
    formInput: {
      backgroundColor: colors.surfaceAlt,
      borderRadius: 10,
      paddingHorizontal: 12,
      paddingVertical: 10,
      fontSize: 14,
      color: colors.text,
    },
    catRow: {
      gap: 6,
      paddingVertical: 4,
    },
    catChip: {
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 999,
      backgroundColor: colors.surfaceAlt,
    },
    catChipActive: {
      backgroundColor: colors.primary,
    },
    catChipText: {
      color: colors.text,
      fontSize: 12,
      fontWeight: '600',
    },
    catChipTextActive: {
      color: colors.white,
    },
    formActions: {
      flexDirection: 'row',
      gap: 10,
    },
    formCancel: {
      flex: 1,
      paddingVertical: 10,
      borderRadius: 10,
      alignItems: 'center',
      backgroundColor: colors.surfaceAlt,
    },
    formCancelText: {
      color: colors.textMuted,
      fontWeight: '700',
      fontSize: 13,
    },
    formSave: {
      flex: 1,
      paddingVertical: 10,
      borderRadius: 10,
      alignItems: 'center',
      backgroundColor: colors.primary,
    },
    formSaveText: {
      color: colors.white,
      fontWeight: '700',
      fontSize: 13,
    },
  });
