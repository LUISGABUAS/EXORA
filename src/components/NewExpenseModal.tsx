import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
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
import { useCustomCategoryStore } from '../store/useCustomCategoryStore';
import { useExpenseStore } from '../store/useExpenseStore';
import { ColorPalette } from '../theme/colors';
import { getCategoryIcon } from '../theme/icons';
import { useTheme } from '../theme/ThemeContext';
import { ExpenseCategory, ExpenseInput } from '../types/expense';
import { formatCurrency } from '../utils/format';
import { parseSmartInput, SmartParseResult } from '../utils/smartInputParser';
import { minimizeApp } from '../utils/appMinimizer';
import { QuickShortcuts } from './QuickShortcuts';
import { TemplateSheet } from './TemplateSheet';
import { VoiceInputSheet } from './VoiceInputSheet';

const BUILTIN_CATEGORIES: ExpenseCategory[] = [
  'Comida',
  'Transporte',
  'Entretenimiento',
  'Salud',
  'Educacion',
  'Otros',
];

const BUILTIN_COLORS: Record<ExpenseCategory, string> = {
  Comida: '#22C55E',
  Transporte: '#3B82F6',
  Entretenimiento: '#F59E0B',
  Salud: '#EF4444',
  Educacion: '#8B5CF6',
  Otros: '#8E8E93',
};

interface NewExpenseModalProps {
  visible: boolean;
  onClose: () => void;
  onSaved: (message: string, expenseId: number) => void;
  onScanPress?: () => void;
  quickMode?: boolean;
}

export function NewExpenseModal({
  visible,
  onClose,
  onSaved,
  onScanPress,
  quickMode = false,
}: NewExpenseModalProps) {
  const { colors, isDark } = useTheme();
  const s = useStyles(colors, isDark);
  const addExpense = useExpenseStore(state => state.addExpense);
  const inputRef = useRef<TextInput>(null);

  const [inputText, setInputText] = useState('');
  const [parsed, setParsed] = useState<SmartParseResult | null>(null);
  const [selectedCategory, setSelectedCategory] =
    useState<ExpenseCategory | null>(null);
  const [note, setNote] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [voiceVisible, setVoiceVisible] = useState(false);
  const [templateVisible, setTemplateVisible] = useState(false);
  const [categoryPickerVisible, setCategoryPickerVisible] = useState(false);
  const customCategories = useCustomCategoryStore(state => state.categories);

  const resetState = useCallback(() => {
    setInputText('');
    setParsed(null);
    setSelectedCategory(null);
    setNote('');
    setIsSaving(false);
  }, []);

  const handleClose = () => {
    resetState();
    onClose();
  };

  const handleSubmitInput = () => {
    if (!inputText.trim()) return;
    const result = parseSmartInput(inputText);
    if (result.amount === null && !result.usedKnownPrice) return;
    setParsed(result);
    setSelectedCategory(result.category);
  };

  const openCategoryPicker = () => setCategoryPickerVisible(true);

  const handleSelectCategory = (cat: string) => {
    setSelectedCategory(cat as ExpenseCategory);
    setCategoryPickerVisible(false);
  };

  const handleSave = async () => {
    if (isSaving || !parsed || parsed.amount === null) return;
    setIsSaving(true);

    const category = selectedCategory || parsed.category;
    const input: ExpenseInput = {
      amount: parsed.amount,
      date: parsed.date,
      category,
      description: note || parsed.description,
      merchantName: parsed.merchantName,
      conceptsText: '',
      ocrRawText: '',
      deductible: false,
      rfc: '',
      usoCFDI: '',
      source: 'manual',
    };

    await addExpense(input);
    const allExpenses = useExpenseStore.getState().expenses;
    const newId = Math.max(...allExpenses.map(e => e.id));

    const msg = `${formatCurrency(parsed.amount)} ${category} registrado`;
    resetState();
    onClose();
    onSaved(msg, newId);
    if (quickMode) {
      setTimeout(() => minimizeApp(), 300);
    }
  };

  const handleShortcutSelect = async (input: ExpenseInput) => {
    if (isSaving) return;
    setIsSaving(true);

    await addExpense(input);
    const allExpenses = useExpenseStore.getState().expenses;
    const newId = Math.max(...allExpenses.map(e => e.id));

    const msg = `${formatCurrency(input.amount)} ${input.category} registrado`;
    resetState();
    onClose();
    onSaved(msg, newId);
  };

  const handleScanPress = () => {
    if (onScanPress) {
      resetState();
      onClose();
      onScanPress();
    }
  };

  const handleTemplateSelect = async (input: ExpenseInput) => {
    setTemplateVisible(false);
    await handleShortcutSelect(input);
  };

  const handleVoiceResult = (text: string) => {
    setInputText(text);
    setVoiceVisible(false);
    const result = parseSmartInput(text);
    if (result.amount !== null) {
      setParsed(result);
      setSelectedCategory(result.category);
    }
  };

  const displayCategory = selectedCategory || parsed?.category || 'Comida';

  // Fuerza el foco del input cuando el modal se abre (incluye desde widget)
  useEffect(() => {
    if (visible) {
      const timer = setTimeout(() => inputRef.current?.focus(), 150);
      return () => clearTimeout(timer);
    }
  }, [visible]);

  // ── Quick Mode (desde widget) ──────────────────────────────────
  if (quickMode) {
    return (
      <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
        <KeyboardAvoidingView
          style={[s.root, { justifyContent: 'flex-end' }]}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={s.quickWrap}>
            {/* Handle */}
            <View style={s.quickHandle} />

            {/* Input grande */}
            <TextInput
              ref={inputRef}
              style={s.quickInput}
              placeholder="100 uber, 50 tacos..."
              placeholderTextColor={colors.textMuted + '80'}
              value={inputText}
              onChangeText={text => {
                setInputText(text);
                const result = parseSmartInput(text);
                if (result.amount !== null || result.usedKnownPrice) {
                  setParsed(result);
                  setSelectedCategory(result.category);
                } else {
                  setParsed(null);
                  setSelectedCategory(null);
                }
              }}
              onSubmitEditing={parsed?.amount !== null ? handleSave : handleSubmitInput}
              returnKeyType={parsed?.amount !== null ? 'send' : 'done'}
              autoFocus
            />

            {/* Preview resultado */}
            {parsed && parsed.amount !== null ? (
              <Animated.View entering={FadeInDown.duration(200)} style={s.quickPreview}>
                <Text style={s.quickAmount}>{formatCurrency(parsed.amount)}</Text>
                <Pressable style={s.quickCatChip} onPress={openCategoryPicker}>
                  <Icon name={getCategoryIcon(displayCategory)} size={16} color={colors.primary} />
                  <Text style={s.quickCatText}>{displayCategory}</Text>
                  <Icon name="chevron-down" size={14} color={colors.primary} />
                </Pressable>
              </Animated.View>
            ) : null}

            {/* Botones */}
            <View style={s.quickActions}>
              <Pressable style={s.quickCancel} onPress={handleClose}>
                <Text style={s.quickCancelText}>Cancelar</Text>
              </Pressable>
              <Pressable
                style={[s.quickSave, (!parsed || parsed.amount === null || isSaving) && s.quickSaveDisabled]}
                onPress={handleSave}
                disabled={!parsed || parsed.amount === null || isSaving}
              >
                <Icon name="check" size={20} color="#fff" />
                <Text style={s.quickSaveText}>{isSaving ? 'Guardando...' : 'Guardar'}</Text>
              </Pressable>
            </View>
          </View>

          {/* Category picker */}
          <Modal
            visible={categoryPickerVisible}
            transparent
            animationType="slide"
            onRequestClose={() => setCategoryPickerVisible(false)}
          >
            <Pressable style={s.pickerOverlay} onPress={() => setCategoryPickerVisible(false)}>
              <Pressable style={s.pickerSheet} onPress={e => e.stopPropagation()}>
                <View style={s.pickerHandle} />
                <Text style={s.pickerTitle}>Categoría</Text>
                <View style={s.pickerGrid}>
                  {BUILTIN_CATEGORIES.map(cat => {
                    const isSelected = displayCategory === cat;
                    return (
                      <Pressable
                        key={cat}
                        style={[s.pickerItem, isSelected && { borderColor: BUILTIN_COLORS[cat], backgroundColor: BUILTIN_COLORS[cat] + '18' }]}
                        onPress={() => handleSelectCategory(cat)}
                      >
                        <Icon name={getCategoryIcon(cat)} size={22} color={isSelected ? BUILTIN_COLORS[cat] : colors.textMuted} />
                        <Text style={[s.pickerItemText, isSelected && { color: BUILTIN_COLORS[cat] }]}>{cat}</Text>
                      </Pressable>
                    );
                  })}
                </View>
                {customCategories.length > 0 && (
                  <>
                    <Text style={s.pickerSectionLabel}>Mis categorías</Text>
                    <View style={s.pickerGrid}>
                      {customCategories.map(cat => {
                        const isSelected = displayCategory === cat.name;
                        return (
                          <Pressable
                            key={cat.id}
                            style={[s.pickerItem, isSelected && { borderColor: cat.color, backgroundColor: cat.color + '18' }]}
                            onPress={() => handleSelectCategory(cat.name)}
                          >
                            <Icon name={cat.icon} size={22} color={isSelected ? cat.color : colors.textMuted} />
                            <Text style={[s.pickerItemText, isSelected && { color: cat.color }]}>{cat.name}</Text>
                          </Pressable>
                        );
                      })}
                    </View>
                  </>
                )}
              </Pressable>
            </Pressable>
          </Modal>
        </KeyboardAvoidingView>
      </Modal>
    );
  }

  // ── Modal completo (modo normal) ────────────────────────────────
  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
    >
      <KeyboardAvoidingView
        style={s.root}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* Header */}
        <View style={s.header}>
          <Pressable onPress={handleClose} hitSlop={12}>
            <Icon name="close" size={24} color={colors.text} />
          </Pressable>
          <Text style={s.headerTitle}>Nuevo gasto</Text>
          <View style={s.headerSpacer} />
        </View>

        <ScrollView
          style={s.body}
          contentContainerStyle={s.bodyContent}
          keyboardShouldPersistTaps="handled"
        >
          {/* Tip */}
          <Text style={s.tip}>Sugerencia: escribe monto + descripción</Text>

          {/* Big Input */}
          <View style={s.inputContainer}>
            <TextInput
              ref={inputRef}
              style={s.bigInput}
              placeholder="120 tacos"
              placeholderTextColor={colors.textMuted + '80'}
              value={inputText}
              onChangeText={text => {
                setInputText(text);
                // Parsea en tiempo real para respuesta inmediata
                const result = parseSmartInput(text);
                if (result.amount !== null || result.usedKnownPrice) {
                  setParsed(result);
                  setSelectedCategory(result.category);
                } else {
                  setParsed(null);
                  setSelectedCategory(null);
                }
              }}
              onSubmitEditing={parsed && parsed.amount !== null ? handleSave : handleSubmitInput}
              returnKeyType={parsed && parsed.amount !== null ? 'send' : 'done'}
              autoFocus
            />
            {inputText.length > 0 ? (
              <Pressable
                style={s.clearButton}
                onPress={() => {
                  setInputText('');
                  setParsed(null);
                  setSelectedCategory(null);
                }}
                hitSlop={8}
              >
                <Icon name="close-circle" size={20} color={colors.textMuted} />
              </Pressable>
            ) : null}
          </View>

          {/* FAB submit */}
          {!parsed && inputText.trim().length > 0 ? (
            <View style={s.fabRow}>
              <Pressable style={s.fab} onPress={handleSubmitInput}>
                <Icon name="check" size={26} color={colors.white} />
              </Pressable>
            </View>
          ) : null}

          {/* Detection banner + fields */}
          {parsed && parsed.amount !== null ? (
            <Animated.View
              entering={FadeInDown.duration(250)}
              style={s.detectionSection}
            >
              {/* Banner */}
              <View style={s.banner}>
                <Icon name="check-circle" size={18} color={colors.success} />
                <Text style={s.bannerText}>Detectado automáticamente</Text>
                <Icon name="chevron-right" size={18} color={colors.success} />
              </View>

              {/* Amount + Category cards */}
              <View style={s.fieldsRow}>
                <View style={s.fieldCard}>
                  <Text style={s.fieldValue}>
                    {formatCurrency(parsed.amount!)}
                  </Text>
                  <Text style={s.fieldLabel}>Monto</Text>
                </View>
                <Pressable style={s.fieldCard} onPress={openCategoryPicker}>
                  <View style={s.categoryRow}>
                    <Icon
                      name={getCategoryIcon(displayCategory)}
                      size={18}
                      color={colors.primary}
                    />
                    <Text style={s.fieldValue} numberOfLines={1}>
                      {displayCategory}
                    </Text>
                    <Icon
                      name="chevron-down"
                      size={16}
                      color={colors.textMuted}
                    />
                  </View>
                  <Text style={s.fieldLabel}>Categoría</Text>
                </Pressable>
              </View>

              {/* Note input */}
              <View style={s.noteRow}>
                <Icon name="chat-outline" size={18} color={colors.textMuted} />
                <TextInput
                  style={s.noteInput}
                  placeholder="Agregar nota (opcional)"
                  placeholderTextColor={colors.textMuted}
                  value={note}
                  onChangeText={setNote}
                />
              </View>

              {/* Save button */}
              <Pressable
                style={[s.saveButton, isSaving && s.saveButtonDisabled]}
                onPress={handleSave}
                disabled={isSaving}
              >
                <Icon name="check" size={20} color={colors.white} />
                <Text style={s.saveButtonText}>Guardar gasto</Text>
              </Pressable>
            </Animated.View>
          ) : null}

          {/* Action buttons */}
          <View style={s.actionsRow}>
            <Pressable style={s.actionItem} onPress={handleScanPress}>
              <View style={s.actionCircle}>
                <Icon name="camera" size={22} color={colors.primary} />
              </View>
              <Text style={s.actionLabel}>Escanear</Text>
            </Pressable>
            <Pressable
              style={s.actionItem}
              onPress={() => setVoiceVisible(true)}
            >
              <View style={s.actionCircle}>
                <Icon name="microphone" size={22} color={colors.primary} />
              </View>
              <Text style={s.actionLabel}>Voz</Text>
            </Pressable>
            <Pressable
              style={s.actionItem}
              onPress={() => setTemplateVisible(true)}
            >
              <View style={s.actionCircle}>
                <Icon name="star-outline" size={22} color={colors.primary} />
              </View>
              <Text style={s.actionLabel}>Plantillas</Text>
            </Pressable>
          </View>

          {/* Quick shortcuts */}
          <QuickShortcuts onSelect={handleShortcutSelect} />
        </ScrollView>

        <VoiceInputSheet
          visible={voiceVisible}
          onResult={handleVoiceResult}
          onClose={() => setVoiceVisible(false)}
        />

        <TemplateSheet
          visible={templateVisible}
          onSelect={handleTemplateSelect}
          onClose={() => setTemplateVisible(false)}
        />

        {/* Category Picker */}
        <Modal
          visible={categoryPickerVisible}
          transparent
          animationType="slide"
          onRequestClose={() => setCategoryPickerVisible(false)}
        >
          <Pressable
            style={s.pickerOverlay}
            onPress={() => setCategoryPickerVisible(false)}
          >
            <Pressable style={s.pickerSheet} onPress={e => e.stopPropagation()}>
              <View style={s.pickerHandle} />
              <Text style={s.pickerTitle}>Seleccionar categoría</Text>

              {/* Built-in categories */}
              <View style={s.pickerGrid}>
                {BUILTIN_CATEGORIES.map(cat => {
                  const isSelected =
                    (selectedCategory || parsed?.category) === cat;
                  return (
                    <Pressable
                      key={cat}
                      style={[
                        s.pickerItem,
                        isSelected && {
                          borderColor: BUILTIN_COLORS[cat],
                          backgroundColor: BUILTIN_COLORS[cat] + '18',
                        },
                      ]}
                      onPress={() => handleSelectCategory(cat)}
                    >
                      <Icon
                        name={getCategoryIcon(cat)}
                        size={22}
                        color={
                          isSelected ? BUILTIN_COLORS[cat] : colors.textMuted
                        }
                      />
                      <Text
                        style={[
                          s.pickerItemText,
                          isSelected && { color: BUILTIN_COLORS[cat] },
                        ]}
                      >
                        {cat}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              {/* Custom categories */}
              {customCategories.length > 0 && (
                <>
                  <Text style={s.pickerSectionLabel}>Mis categorías</Text>
                  <View style={s.pickerGrid}>
                    {customCategories.map(cat => {
                      const isSelected = selectedCategory === cat.name;
                      return (
                        <Pressable
                          key={cat.id}
                          style={[
                            s.pickerItem,
                            isSelected && {
                              borderColor: cat.color,
                              backgroundColor: cat.color + '18',
                            },
                          ]}
                          onPress={() => handleSelectCategory(cat.name)}
                        >
                          <Icon
                            name={cat.icon}
                            size={22}
                            color={isSelected ? cat.color : colors.textMuted}
                          />
                          <Text
                            style={[
                              s.pickerItemText,
                              isSelected && { color: cat.color },
                            ]}
                          >
                            {cat.name}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </>
              )}
            </Pressable>
          </Pressable>
        </Modal>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const useStyles = (colors: ColorPalette, _isDark: boolean) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.background },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 20,
      paddingTop: Platform.OS === 'ios' ? 16 : 20,
      paddingBottom: 12,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    headerTitle: {
      color: colors.text,
      fontSize: 17,
      fontWeight: '700',
    },
    headerSpacer: { width: 24 },
    body: { flex: 1 },
    bodyContent: {
      padding: 20,
      gap: 20,
    },
    tip: {
      color: colors.textMuted,
      fontSize: 13,
      fontStyle: 'italic',
      textAlign: 'center',
    },
    inputContainer: {
      position: 'relative',
    },
    bigInput: {
      color: colors.text,
      fontSize: 32,
      fontWeight: '800',
      textAlign: 'center',
      paddingVertical: 16,
      paddingHorizontal: 40,
    },
    clearButton: {
      position: 'absolute',
      right: 8,
      top: 24,
    },
    fabRow: {
      alignItems: 'center',
    },
    fab: {
      width: 56,
      height: 56,
      borderRadius: 28,
      backgroundColor: colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
      shadowColor: colors.primary,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 8,
      elevation: 6,
    },
    detectionSection: { gap: 14 },
    banner: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      backgroundColor: colors.success + '15',
      borderRadius: 12,
      paddingHorizontal: 14,
      paddingVertical: 12,
    },
    bannerText: {
      flex: 1,
      color: colors.success,
      fontSize: 14,
      fontWeight: '600',
    },
    fieldsRow: {
      flexDirection: 'row',
      gap: 10,
    },
    fieldCard: {
      flex: 1,
      backgroundColor: colors.surface,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 14,
      alignItems: 'center',
      gap: 4,
    },
    fieldValue: {
      color: colors.text,
      fontSize: 16,
      fontWeight: '800',
    },
    fieldLabel: {
      color: colors.textMuted,
      fontSize: 11,
      fontWeight: '600',
    },
    categoryRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    noteRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      backgroundColor: colors.surface,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: 14,
      paddingVertical: 10,
    },
    noteInput: {
      flex: 1,
      color: colors.text,
      fontSize: 14,
    },
    saveButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      backgroundColor: colors.primary,
      borderRadius: 16,
      paddingVertical: 16,
    },
    saveButtonDisabled: { opacity: 0.5 },
    saveButtonText: {
      color: colors.white,
      fontSize: 16,
      fontWeight: '700',
    },
    actionsRow: {
      flexDirection: 'row',
      justifyContent: 'center',
      gap: 32,
      paddingTop: 8,
    },
    actionItem: {
      alignItems: 'center',
      gap: 6,
    },
    actionCircle: {
      width: 52,
      height: 52,
      borderRadius: 26,
      backgroundColor: colors.primary + '15',
      alignItems: 'center',
      justifyContent: 'center',
    },
    actionLabel: {
      color: colors.textMuted,
      fontSize: 12,
      fontWeight: '600',
    },
    pickerOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.5)',
      justifyContent: 'flex-end',
    },
    pickerSheet: {
      backgroundColor: colors.surface,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      paddingHorizontal: 20,
      paddingBottom: Platform.OS === 'ios' ? 36 : 24,
      paddingTop: 12,
    },
    pickerHandle: {
      width: 40,
      height: 4,
      borderRadius: 2,
      backgroundColor: colors.border,
      alignSelf: 'center',
      marginBottom: 16,
    },
    pickerTitle: {
      color: colors.text,
      fontSize: 17,
      fontWeight: '700',
      marginBottom: 16,
    },
    pickerGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 10,
    },
    pickerItem: {
      width: '30%',
      alignItems: 'center',
      gap: 6,
      paddingVertical: 14,
      borderRadius: 16,
      borderWidth: 1.5,
      borderColor: colors.border,
      backgroundColor: colors.surfaceAlt,
    },
    pickerItemText: {
      color: colors.textSecondary,
      fontSize: 11,
      fontWeight: '600',
      textAlign: 'center',
    },
    pickerSectionLabel: {
      color: colors.textMuted,
      fontSize: 12,
      fontWeight: '600',
      marginTop: 16,
      marginBottom: 10,
    },

    // ── Quick Mode styles ──
    quickWrap: {
      backgroundColor: colors.surface,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      padding: 20,
      paddingBottom: Platform.OS === 'ios' ? 36 : 24,
      gap: 16,
    },
    quickHandle: {
      width: 40,
      height: 4,
      borderRadius: 2,
      backgroundColor: colors.border,
      alignSelf: 'center',
    },
    quickInput: {
      fontSize: 32,
      fontWeight: '800',
      color: colors.text,
      paddingVertical: 12,
      minHeight: 60,
    },
    quickPreview: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    quickAmount: {
      fontSize: 22,
      fontWeight: '800',
      color: colors.primary,
    },
    quickCatChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      backgroundColor: colors.primary + '15',
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 999,
    },
    quickCatText: {
      color: colors.primary,
      fontSize: 14,
      fontWeight: '700',
    },
    quickActions: {
      flexDirection: 'row',
      gap: 12,
      marginTop: 4,
    },
    quickCancel: {
      flex: 1,
      alignItems: 'center',
      paddingVertical: 16,
      borderRadius: 16,
      backgroundColor: colors.surfaceAlt,
    },
    quickCancelText: {
      color: colors.textMuted,
      fontSize: 16,
      fontWeight: '600',
    },
    quickSave: {
      flex: 2,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      paddingVertical: 16,
      borderRadius: 16,
      backgroundColor: colors.primary,
    },
    quickSaveDisabled: { opacity: 0.4 },
    quickSaveText: {
      color: '#fff',
      fontSize: 16,
      fontWeight: '800',
    },
  });
