import React, { useCallback, useRef, useState } from 'react';
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
import { useExpenseStore } from '../store/useExpenseStore';
import { ColorPalette } from '../theme/colors';
import { categoryIcons } from '../theme/icons';
import { useTheme } from '../theme/ThemeContext';
import { ExpenseCategory, ExpenseInput } from '../types/expense';
import { formatCurrency } from '../utils/format';
import { parseSmartInput, SmartParseResult } from '../utils/smartInputParser';
import { QuickShortcuts } from './QuickShortcuts';
import { TemplateSheet } from './TemplateSheet';
import { VoiceInputSheet } from './VoiceInputSheet';

const ALL_CATEGORIES: ExpenseCategory[] = [
  'Comida', 'Transporte', 'Entretenimiento', 'Salud', 'Educacion', 'Otros',
];

interface NewExpenseModalProps {
  visible: boolean;
  onClose: () => void;
  onSaved: (message: string, expenseId: number) => void;
  onScanPress?: () => void;
}

export function NewExpenseModal({ visible, onClose, onSaved, onScanPress }: NewExpenseModalProps) {
  const { colors, isDark } = useTheme();
  const s = useStyles(colors, isDark);
  const addExpense = useExpenseStore(state => state.addExpense);
  const inputRef = useRef<TextInput>(null);

  const [inputText, setInputText] = useState('');
  const [parsed, setParsed] = useState<SmartParseResult | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<ExpenseCategory | null>(null);
  const [note, setNote] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [voiceVisible, setVoiceVisible] = useState(false);
  const [templateVisible, setTemplateVisible] = useState(false);

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

  const cycleCategory = () => {
    const current = selectedCategory || parsed?.category || 'Otros';
    const idx = ALL_CATEGORIES.indexOf(current);
    const next = ALL_CATEGORIES[(idx + 1) % ALL_CATEGORIES.length];
    setSelectedCategory(next);
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

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
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
          <Text style={s.tip}>Sugerencia: escribe monto + descripcion</Text>

          {/* Big Input */}
          <View style={s.inputContainer}>
            <TextInput
              ref={inputRef}
              style={s.bigInput}
              placeholder='120 tacos'
              placeholderTextColor={colors.textMuted + '80'}
              value={inputText}
              onChangeText={text => {
                setInputText(text);
                if (parsed) {
                  setParsed(null);
                  setSelectedCategory(null);
                }
              }}
              onSubmitEditing={handleSubmitInput}
              returnKeyType="done"
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
            <Animated.View entering={FadeInDown.duration(250)} style={s.detectionSection}>
              {/* Banner */}
              <View style={s.banner}>
                <Icon name="check-circle" size={18} color={colors.success} />
                <Text style={s.bannerText}>Detectado automaticamente</Text>
                <Icon name="chevron-right" size={18} color={colors.success} />
              </View>

              {/* Amount + Category cards */}
              <View style={s.fieldsRow}>
                <View style={s.fieldCard}>
                  <Text style={s.fieldValue}>{formatCurrency(parsed.amount!)}</Text>
                  <Text style={s.fieldLabel}>Monto</Text>
                </View>
                <Pressable style={s.fieldCard} onPress={cycleCategory}>
                  <View style={s.categoryRow}>
                    <Icon
                      name={categoryIcons[displayCategory]}
                      size={18}
                      color={colors.primary}
                    />
                    <Text style={s.fieldValue}>{displayCategory}</Text>
                    <Icon name="chevron-down" size={16} color={colors.textMuted} />
                  </View>
                  <Text style={s.fieldLabel}>Categoria</Text>
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
            <Pressable style={s.actionItem} onPress={() => setVoiceVisible(true)}>
              <View style={s.actionCircle}>
                <Icon name="microphone" size={22} color={colors.primary} />
              </View>
              <Text style={s.actionLabel}>Voz</Text>
            </Pressable>
            <Pressable style={s.actionItem} onPress={() => setTemplateVisible(true)}>
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
  });
