import React, { useRef, useState } from 'react';
import { Keyboard, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useExpenseStore } from '../store/useExpenseStore';
import { ColorPalette } from '../theme/colors';
import { categoryIcons } from '../theme/icons';
import { shadows } from '../theme/spacing';
import { useTheme } from '../theme/ThemeContext';
import { ExpenseInput } from '../types/expense';
import { formatCurrency, localDateString } from '../utils/format';
import { parseSmartInput, SmartParseResult } from '../utils/smartInputParser';
import { VoiceInputSheet } from './VoiceInputSheet';

interface SmartInputBarProps {
  onSave: (expenseId: number, message: string) => void;
  onScanPress: () => void;
  onExpandPress: () => void;
}

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

export function SmartInputBar({ onSave, onScanPress, onExpandPress }: SmartInputBarProps) {
  const { colors, isDark } = useTheme();
  const s = useStyles(colors, isDark);
  const addExpense = useExpenseStore(state => state.addExpense);
  const inputRef = useRef<TextInput>(null);

  const [text, setText] = useState('');
  const [parsed, setParsed] = useState<SmartParseResult | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [voiceVisible, setVoiceVisible] = useState(false);

  const handleChangeText = (value: string) => {
    setText(value);
    if (value.trim()) {
      setParsed(parseSmartInput(value));
    } else {
      setParsed(null);
    }
  };

  const handleClear = () => {
    setText('');
    setParsed(null);
    inputRef.current?.focus();
  };

  const handleSave = async () => {
    if (isSaving || !parsed || parsed.amount === null) return;
    setIsSaving(true);

    const input: ExpenseInput = {
      amount: parsed.amount,
      date: parsed.date,
      category: parsed.category,
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

    const msg = `${formatCurrency(parsed.amount)} ${parsed.category} registrado`;
    setText('');
    setParsed(null);
    setIsSaving(false);
    Keyboard.dismiss();
    onSave(newId, msg);
  };

  const showPreview = parsed && parsed.amount !== null;
  const showFallback = !showPreview && parsed && text.trim().length > 0 && parsed.confidence === 'low';

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
            <Text style={s.previewAmount}>{formatCurrency(parsed!.amount!)}</Text>
            <Text style={s.previewDot}> · </Text>
            <Icon
              name={categoryIcons[parsed!.category]}
              size={14}
              color={colors.primary}
            />
            <Text style={s.previewCategory}>{parsed!.category}</Text>
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
          <Text style={s.fallbackText}>No se detectó monto. Toca para abrir formulario.</Text>
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
    previewCategory: {
      color: colors.text,
      fontSize: 13,
      fontWeight: '600',
      marginLeft: 3,
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
  });
