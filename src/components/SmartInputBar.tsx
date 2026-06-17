import React, { useRef, useState } from 'react';
import {
  Keyboard,
  Modal,
  Platform,
  Pressable,
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
import { shadows } from '../theme/spacing';
import { useTheme } from '../theme/ThemeContext';
import { ExpenseCategory, ExpenseInput } from '../types/expense';
import { formatCurrency, localDateString } from '../utils/format';
import { parseSmartInput, SmartParseResult } from '../utils/smartInputParser';
import { VoiceInputSheet } from './VoiceInputSheet';

interface SmartInputBarProps {
  onSave: (expenseId: number, message: string) => void;
  onScanPress: () => void;
  onExpandPress: () => void;
}

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

function formatPreviewDate(dateStr: string): string {
  const now = new Date();
  const todayStr = localDateString(now);
  const yesterdayStr = localDateString(
    new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1),
  );
  if (dateStr === todayStr) return 'Hoy';
  if (dateStr === yesterdayStr) return 'Ayer';
  const [, m, d] = dateStr.split('-');
  return `${d}/${m}`;
}

export function SmartInputBar({
  onSave,
  onScanPress,
  onExpandPress,
}: SmartInputBarProps) {
  const { colors, isDark } = useTheme();
  const s = useStyles(colors, isDark);
  const addExpense = useExpenseStore(state => state.addExpense);
  const customCategories = useCustomCategoryStore(state => state.categories);
  const inputRef = useRef<TextInput>(null);

  const [text, setText] = useState('');
  const [parsed, setParsed] = useState<SmartParseResult | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [voiceVisible, setVoiceVisible] = useState(false);
  const [categoryPickerVisible, setCategoryPickerVisible] = useState(false);

  const displayCategory = selectedCategory ?? parsed?.category ?? 'Otros';

  const handleChangeText = (value: string) => {
    setText(value);
    if (value.trim()) {
      const result = parseSmartInput(value);
      setParsed(result);
      setSelectedCategory(null);
    } else {
      setParsed(null);
      setSelectedCategory(null);
    }
  };

  const handleClear = () => {
    setText('');
    setParsed(null);
    setSelectedCategory(null);
    inputRef.current?.focus();
  };

  const handleSave = async () => {
    if (isSaving || !parsed || parsed.amount === null) return;
    setIsSaving(true);

    const input: ExpenseInput = {
      amount: parsed.amount,
      date: parsed.date,
      category: displayCategory as ExpenseCategory,
      description: parsed.description,
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

    const msg = `${formatCurrency(
      parsed.amount,
    )} ${displayCategory} registrado`;
    setText('');
    setParsed(null);
    setSelectedCategory(null);
    setIsSaving(false);
    Keyboard.dismiss();
    onSave(newId, msg);
  };

  const showPreview = parsed && parsed.amount !== null;
  const showFallback =
    !showPreview &&
    parsed &&
    text.trim().length > 0 &&
    parsed.confidence === 'low';

  return (
    <View style={s.container}>
      {/* Zone 1 — Input row */}
      <View style={s.inputRow}>
        <Icon name="auto-fix" size={20} color={colors.primary} />
        <TextInput
          ref={inputRef}
          style={s.input}
          placeholder="Escribe un gasto... (ej. 120 tacos)"
          placeholderTextColor={colors.textMuted}
          value={text}
          onChangeText={handleChangeText}
          returnKeyType="done"
          onSubmitEditing={showPreview ? handleSave : undefined}
        />
        {text.length > 0 ? (
          <Pressable onPress={handleClear} hitSlop={8}>
            <Icon name="close-circle" size={18} color={colors.textMuted} />
          </Pressable>
        ) : null}
        <Pressable onPress={() => setVoiceVisible(true)} hitSlop={8}>
          <Icon name="microphone-outline" size={20} color={colors.textMuted} />
        </Pressable>
        <Pressable onPress={onScanPress} hitSlop={8}>
          <Icon name="camera-outline" size={20} color={colors.textMuted} />
        </Pressable>
        <Pressable onPress={onExpandPress} hitSlop={8}>
          <Icon name="arrow-expand" size={20} color={colors.textMuted} />
        </Pressable>
      </View>

      {/* Zone 2 — Preview strip */}
      {showPreview ? (
        <Animated.View entering={FadeInDown.duration(200)} style={s.previewRow}>
          <View style={s.previewInfo}>
            <Text style={s.previewAmount}>
              {formatCurrency(parsed!.amount!)}
            </Text>
            <Text style={s.previewDot}> · </Text>
            {/* Category chip — tappable to change */}
            <Pressable
              style={s.categoryChip}
              onPress={() => setCategoryPickerVisible(true)}
              hitSlop={6}
            >
              <Icon
                name={getCategoryIcon(displayCategory)}
                size={13}
                color={colors.primary}
              />
              <Text style={s.previewCategory}>{displayCategory}</Text>
              <Icon name="chevron-down" size={12} color={colors.primary} />
            </Pressable>
            <Text style={s.previewDot}> · </Text>
            <Text style={s.previewDate}>{formatPreviewDate(parsed!.date)}</Text>
          </View>
          <Pressable
            style={[s.saveButton, isSaving && s.saveButtonDisabled]}
            onPress={handleSave}
            disabled={isSaving}
          >
            <Text style={s.saveButtonText}>Guardar</Text>
          </Pressable>
        </Animated.View>
      ) : null}

      {/* Zone 3 — Fallback */}
      {showFallback ? (
        <Pressable style={s.fallbackRow} onPress={onExpandPress}>
          <Text style={s.fallbackText}>
            No se detectó monto. Toca para abrir formulario.
          </Text>
        </Pressable>
      ) : null}

      <VoiceInputSheet
        visible={voiceVisible}
        onResult={voiceText => {
          setVoiceVisible(false);
          handleChangeText(voiceText);
        }}
        onClose={() => setVoiceVisible(false)}
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

            <View style={s.pickerGrid}>
              {BUILTIN_CATEGORIES.map(cat => {
                const isSelected = displayCategory === cat;
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
                    onPress={() => {
                      setSelectedCategory(cat);
                      setCategoryPickerVisible(false);
                    }}
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

            {customCategories.length > 0 && (
              <>
                <Text style={s.pickerSectionLabel}>Mis categorías</Text>
                <View style={s.pickerGrid}>
                  {customCategories.map(cat => {
                    const isSelected = displayCategory === cat.name;
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
                        onPress={() => {
                          setSelectedCategory(cat.name);
                          setCategoryPickerVisible(false);
                        }}
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
    </View>
  );
}

const useStyles = (colors: ColorPalette, _isDark: boolean) =>
  StyleSheet.create({
    container: {
      backgroundColor: colors.surface,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: colors.border,
      overflow: 'hidden',
      ...shadows.cardLg,
    },
    inputRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      paddingHorizontal: 16,
      paddingVertical: 14,
    },
    input: {
      flex: 1,
      color: colors.text,
      fontSize: 15,
      paddingVertical: 0,
    },
    previewRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingVertical: 10,
      backgroundColor: colors.primaryGlow,
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
    previewInfo: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      flexWrap: 'wrap',
    },
    previewAmount: {
      color: colors.text,
      fontSize: 14,
      fontWeight: '800',
    },
    previewDot: {
      color: colors.textMuted,
      fontSize: 14,
    },
    categoryChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 3,
      backgroundColor: colors.primary + '15',
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 999,
    },
    previewCategory: {
      color: colors.primary,
      fontSize: 12,
      fontWeight: '700',
    },
    previewDate: {
      color: colors.textMuted,
      fontSize: 13,
    },
    saveButton: {
      backgroundColor: colors.primary,
      borderRadius: 999,
      paddingHorizontal: 16,
      paddingVertical: 8,
    },
    saveButtonDisabled: { opacity: 0.5 },
    saveButtonText: {
      color: colors.white,
      fontSize: 13,
      fontWeight: '700',
    },
    fallbackRow: {
      paddingHorizontal: 16,
      paddingVertical: 10,
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
    fallbackText: {
      color: colors.textMuted,
      fontSize: 12,
      textAlign: 'center',
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
  });
