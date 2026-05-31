import React, { useState } from 'react';
import {
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { ScreenContainer } from '../components/ScreenContainer';
import {
  DEFAULT_COLORS,
  DEFAULT_ICONS,
  useCustomCategoryStore,
} from '../store/useCustomCategoryStore';
import { ColorPalette } from '../theme/colors';
import { font } from '../theme/typography';
import { useTheme } from '../theme/ThemeContext';

export function CustomCategoriesScreen() {
  const { colors, isDark } = useTheme();
  const s = useStyles(colors, isDark);

  const categories = useCustomCategoryStore(state => state.categories);
  const addCategory = useCustomCategoryStore(state => state.addCategory);
  const removeCategory = useCustomCategoryStore(state => state.removeCategory);

  const [name, setName] = useState('');
  const [selectedIcon, setSelectedIcon] = useState(DEFAULT_ICONS[0]);
  const [selectedColor, setSelectedColor] = useState(DEFAULT_COLORS[0]);
  const [nameError, setNameError] = useState('');
  const [saving, setSaving] = useState(false);

  const handleAdd = async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      setNameError('El nombre es obligatorio.');
      return;
    }
    if (trimmed.length > 20) {
      setNameError('Máximo 20 caracteres.');
      return;
    }
    const dup = categories.some(c => c.name.toLowerCase() === trimmed.toLowerCase());
    if (dup) {
      setNameError('Ya existe una categoría con ese nombre.');
      return;
    }
    setSaving(true);
    await addCategory(trimmed, selectedIcon, selectedColor);
    setSaving(false);
    setName('');
    setNameError('');
    setSelectedIcon(DEFAULT_ICONS[0]);
    setSelectedColor(DEFAULT_COLORS[0]);
  };

  const handleDelete = (id: string, catName: string) => {
    Alert.alert(
      'Eliminar categoría',
      `¿Eliminar la categoría "${catName}"? Los gastos con esta categoría no se verán afectados.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: () => removeCategory(id),
        },
      ],
    );
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScreenContainer>
        {/* Existing categories */}
        <View style={s.card}>
          <View style={s.cardHeader}>
            <Icon name="tag-multiple-outline" size={22} color={colors.text} />
            <Text style={s.cardTitle}>Mis categorías</Text>
          </View>
          {categories.length === 0 ? (
            <Text style={s.empty}>
              Aún no tienes categorías personalizadas. ¡Crea la primera!
            </Text>
          ) : (
            categories.map(cat => (
              <View key={cat.id} style={s.catRow}>
                <View style={[s.catIconBox, { backgroundColor: cat.color + '22' }]}>
                  <Icon name={cat.icon} size={20} color={cat.color} />
                </View>
                <Text style={s.catName}>{cat.name}</Text>
                <Pressable
                  onPress={() => handleDelete(cat.id, cat.name)}
                  hitSlop={10}
                  style={s.deleteBtn}
                >
                  <Icon name="trash-can-outline" size={20} color={colors.danger} />
                </Pressable>
              </View>
            ))
          )}
        </View>

        {/* Add form */}
        <View style={s.card}>
          <View style={s.cardHeader}>
            <Icon name="tag-plus-outline" size={22} color={colors.primary} />
            <Text style={s.cardTitle}>Agregar categoría</Text>
          </View>

          {/* Name input */}
          <View style={s.inputGroup}>
            <Text style={s.label}>Nombre</Text>
            <TextInput
              style={[s.input, nameError ? s.inputError : null]}
              value={name}
              onChangeText={t => {
                setName(t);
                if (nameError) setNameError('');
              }}
              placeholder="Ej. Mascotas"
              placeholderTextColor={colors.textMuted}
              maxLength={20}
            />
            {nameError ? <Text style={s.errorText}>{nameError}</Text> : null}
            <Text style={s.charCount}>{name.length}/20</Text>
          </View>

          {/* Icon picker */}
          <View style={s.inputGroup}>
            <Text style={s.label}>Ícono</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={s.iconRow}
            >
              {DEFAULT_ICONS.map(icon => (
                <Pressable
                  key={icon}
                  style={[
                    s.iconOption,
                    selectedIcon === icon && {
                      backgroundColor: selectedColor + '33',
                      borderColor: selectedColor,
                    },
                  ]}
                  onPress={() => setSelectedIcon(icon)}
                >
                  <Icon
                    name={icon}
                    size={22}
                    color={selectedIcon === icon ? selectedColor : colors.textMuted}
                  />
                </Pressable>
              ))}
            </ScrollView>
          </View>

          {/* Color picker */}
          <View style={s.inputGroup}>
            <Text style={s.label}>Color</Text>
            <View style={s.colorRow}>
              {DEFAULT_COLORS.map(color => (
                <Pressable
                  key={color}
                  style={[
                    s.colorDot,
                    { backgroundColor: color },
                    selectedColor === color && s.colorDotActive,
                  ]}
                  onPress={() => setSelectedColor(color)}
                >
                  {selectedColor === color ? (
                    <Icon name="check" size={14} color="#FFFFFF" />
                  ) : null}
                </Pressable>
              ))}
            </View>
          </View>

          {/* Preview */}
          <View style={s.preview}>
            <View style={[s.catIconBox, { backgroundColor: selectedColor + '22' }]}>
              <Icon name={selectedIcon} size={20} color={selectedColor} />
            </View>
            <Text style={[s.previewName, name.trim() ? { color: colors.text } : { color: colors.textMuted }]}>
              {name.trim() || 'Vista previa'}
            </Text>
          </View>

          <Pressable
            style={[s.button, saving && s.buttonDisabled]}
            onPress={handleAdd}
            disabled={saving}
          >
            <Icon name="plus" size={18} color={colors.white} />
            <Text style={s.buttonText}>
              {saving ? 'Guardando…' : 'Agregar categoría'}
            </Text>
          </Pressable>
        </View>

        <View style={{ height: 24 }} />
      </ScreenContainer>
    </KeyboardAvoidingView>
  );
}

const useStyles = (colors: ColorPalette, isDark: boolean) =>
  StyleSheet.create({
    card: {
      backgroundColor: colors.surface,
      borderRadius: 20,
      padding: 18,
      borderWidth: 1,
      borderColor: colors.border,
      gap: 14,
    },
    cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    cardTitle: { color: colors.text, fontSize: 18, fontFamily: font.bold },
    empty: { color: colors.textMuted, lineHeight: 22, fontSize: 14 },
    catRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingVertical: 4,
    },
    catIconBox: {
      width: 40,
      height: 40,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
    },
    catName: {
      flex: 1,
      color: colors.text,
      fontSize: 15,
      fontFamily: font.semibold,
    },
    deleteBtn: { padding: 4 },
    inputGroup: { gap: 4 },
    label: { color: colors.textMuted, fontSize: 12, fontFamily: font.semibold },
    input: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 14,
      paddingHorizontal: 14,
      paddingVertical: 12,
      backgroundColor: isDark ? colors.surfaceAlt : colors.white,
      color: colors.text,
      fontSize: 15,
    },
    inputError: { borderColor: colors.danger },
    errorText: { color: colors.danger, fontSize: 12 },
    charCount: { color: colors.textMuted, fontSize: 11, textAlign: 'right' },
    iconRow: { gap: 8, paddingVertical: 4 },
    iconOption: {
      width: 44,
      height: 44,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.surfaceAlt,
      borderWidth: 2,
      borderColor: 'transparent',
    },
    colorRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
    colorDot: {
      width: 34,
      height: 34,
      borderRadius: 17,
      alignItems: 'center',
      justifyContent: 'center',
    },
    colorDotActive: {
      borderWidth: 3,
      borderColor: colors.white,
      shadowColor: '#000',
      shadowOpacity: 0.25,
      shadowRadius: 4,
      shadowOffset: { width: 0, height: 2 },
      elevation: 4,
    },
    preview: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      backgroundColor: colors.surfaceAlt,
      borderRadius: 14,
      padding: 12,
    },
    previewName: { fontSize: 15, fontFamily: font.bold },
    button: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      backgroundColor: colors.primary,
      paddingVertical: 14,
      borderRadius: 16,
    },
    buttonDisabled: { opacity: 0.6 },
    buttonText: { color: colors.white, fontFamily: font.bold, fontSize: 15 },
  });
