import React, { useState } from 'react';
import {
  Alert,
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { ScreenContainer } from '../components/ScreenContainer';
import { useExpenseStore } from '../store/useExpenseStore';
import { RecurringExpense, useRecurringStore } from '../store/useRecurringStore';
import { ExpenseCategory } from '../types/expense';
import { ColorPalette } from '../theme/colors';
import { font } from '../theme/typography';
import { useTheme } from '../theme/ThemeContext';
import { formatCurrency, localDateString } from '../utils/format';

const CATEGORIES: ExpenseCategory[] = [
  'Comida', 'Transporte', 'Entretenimiento', 'Salud', 'Educacion', 'Otros',
];

const CATEGORY_ICONS: Record<ExpenseCategory, string> = {
  Comida: 'food-outline',
  Transporte: 'car-outline',
  Entretenimiento: 'television-play',
  Salud: 'heart-pulse',
  Educacion: 'school-outline',
  Otros: 'dots-horizontal-circle-outline',
};

const DAYS = Array.from({ length: 28 }, (_, i) => i + 1);

export function RecurringScreen() {
  const { colors } = useTheme();
  const s = useStyles(colors);
  const { items, add, update, remove } = useRecurringStore();
  const addExpense = useExpenseStore(state => state.addExpense);
  const [registering, setRegistering] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);

  // Form state
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState<ExpenseCategory>('Otros');
  const [merchantName, setMerchantName] = useState('');
  const [dayOfMonth, setDayOfMonth] = useState(1);
  const [deductible, setDeductible] = useState(false);

  const resetForm = () => {
    setDescription(''); setAmount(''); setCategory('Otros');
    setMerchantName(''); setDayOfMonth(1); setDeductible(false);
    setShowForm(false);
  };

  const handleAdd = async () => {
    const amt = parseFloat(amount.replace(',', '.'));
    if (!description.trim()) { Alert.alert('Falta descripción'); return; }
    if (!amt || amt <= 0) { Alert.alert('Monto inválido'); return; }
    await add({
      description: description.trim(),
      amount: amt,
      category,
      merchantName: merchantName.trim() || description.trim(),
      dayOfMonth,
      active: true,
      deductible,
    });
    resetForm();
  };

  const handleToggle = async (item: RecurringExpense) => {
    await update(item.id, { active: !item.active });
  };

  const handleRegisterNow = async (item: RecurringExpense) => {
    setRegistering(item.id);
    try {
      await addExpense({
        amount: item.amount,
        date: localDateString(new Date()),
        category: item.category,
        description: item.description,
        merchantName: item.merchantName,
        conceptsText: '',
        ocrRawText: '',
        deductible: item.deductible,
        rfc: '',
        usoCFDI: '',
        source: 'manual',
      });
      Alert.alert('Registrado', `${item.description} por ${formatCurrency(item.amount)} registrado hoy.`);
    } catch {
      Alert.alert('Error', 'No se pudo registrar el gasto.');
    } finally {
      setRegistering(null);
    }
  };

  const handleDelete = (item: RecurringExpense) => {
    Alert.alert(
      'Eliminar gasto recurrente',
      `¿Eliminar "${item.description}"?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Eliminar', style: 'destructive', onPress: () => remove(item.id) },
      ],
    );
  };

  const renderItem = ({ item }: { item: RecurringExpense }) => (
    <View style={[s.card, !item.active && s.cardInactive]}>
      <View style={[s.iconBox, { backgroundColor: colors.primary + '18' }]}>
        <Icon name={CATEGORY_ICONS[item.category]} size={22} color={item.active ? colors.primary : colors.textMuted} />
      </View>
      <View style={s.cardInfo}>
        <Text style={[s.cardTitle, !item.active && s.textMuted]}>{item.description}</Text>
        <Text style={s.cardSub}>Día {item.dayOfMonth} de cada mes · {item.category}</Text>
      </View>
      <View style={s.cardRight}>
        <Text style={[s.cardAmount, !item.active && s.textMuted]}>{formatCurrency(item.amount)}</Text>
        <View style={s.cardActions}>
          <Switch
            value={item.active}
            onValueChange={() => handleToggle(item)}
            trackColor={{ true: colors.primary, false: colors.border }}
            thumbColor={colors.white}
            style={{ transform: [{ scaleX: 0.8 }, { scaleY: 0.8 }] }}
          />
          <Pressable
            onPress={() => handleRegisterNow(item)}
            hitSlop={8}
            disabled={registering === item.id}
          >
            <Icon
              name={registering === item.id ? 'loading' : 'check-circle-outline'}
              size={18}
              color={colors.primary}
            />
          </Pressable>
          <Pressable onPress={() => handleDelete(item)} hitSlop={8}>
            <Icon name="trash-can-outline" size={18} color={colors.danger} />
          </Pressable>
        </View>
      </View>
    </View>
  );

  return (
    <ScreenContainer>
      <View style={s.header}>
        <View>
          <Text style={s.headerTitle}>Gastos recurrentes</Text>
          <Text style={s.headerSub}>{items.length} configurados</Text>
        </View>
        <Pressable style={s.addBtn} onPress={() => setShowForm(v => !v)}>
          <Icon name={showForm ? 'close' : 'plus'} size={20} color={colors.white} />
        </Pressable>
      </View>

      {showForm && (
        <View style={s.form}>
          <Text style={s.formTitle}>Nuevo gasto recurrente</Text>

          <TextInput
            style={s.input}
            placeholder="Descripción (ej: Netflix, Renta)"
            placeholderTextColor={colors.textMuted}
            value={description}
            onChangeText={setDescription}
          />
          <TextInput
            style={s.input}
            placeholder="Monto (MXN)"
            placeholderTextColor={colors.textMuted}
            value={amount}
            onChangeText={setAmount}
            keyboardType="decimal-pad"
          />
          <TextInput
            style={s.input}
            placeholder="Comercio / proveedor (opcional)"
            placeholderTextColor={colors.textMuted}
            value={merchantName}
            onChangeText={setMerchantName}
          />

          <Text style={s.label}>Categoría</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.catRow}>
            {CATEGORIES.map(cat => (
              <Pressable
                key={cat}
                style={[s.catChip, category === cat && s.catChipActive]}
                onPress={() => setCategory(cat)}
              >
                <Icon name={CATEGORY_ICONS[cat]} size={14} color={category === cat ? colors.white : colors.primary} />
                <Text style={[s.catChipText, category === cat && s.catChipTextActive]}>{cat}</Text>
              </Pressable>
            ))}
          </ScrollView>

          <Text style={s.label}>Día del mes</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.dayRow}>
            {DAYS.map(d => (
              <Pressable
                key={d}
                style={[s.dayChip, dayOfMonth === d && s.dayChipActive]}
                onPress={() => setDayOfMonth(d)}
              >
                <Text style={[s.dayChipText, dayOfMonth === d && s.dayChipTextActive]}>{d}</Text>
              </Pressable>
            ))}
          </ScrollView>

          <View style={s.deductibleRow}>
            <Text style={s.label}>Deducible</Text>
            <Switch
              value={deductible}
              onValueChange={setDeductible}
              trackColor={{ true: colors.primary, false: colors.border }}
              thumbColor={colors.white}
            />
          </View>

          <View style={s.formButtons}>
            <Pressable style={s.cancelBtn} onPress={resetForm}>
              <Text style={s.cancelBtnText}>Cancelar</Text>
            </Pressable>
            <Pressable style={s.saveBtn} onPress={handleAdd}>
              <Text style={s.saveBtnText}>Guardar</Text>
            </Pressable>
          </View>
        </View>
      )}

      {items.length === 0 && !showForm ? (
        <View style={s.empty}>
          <Icon name="repeat" size={52} color={colors.textMuted} />
          <Text style={s.emptyTitle}>Sin gastos recurrentes</Text>
          <Text style={s.emptySub}>Agrega renta, Netflix, Spotify y más para que se registren solos cada mes.</Text>
          <Pressable style={s.addBtn} onPress={() => setShowForm(true)}>
            <Icon name="plus" size={20} color={colors.white} />
            <Text style={s.addBtnText}>Agregar</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={i => i.id}
          renderItem={renderItem}
          contentContainerStyle={s.list}
          showsVerticalScrollIndicator={false}
        />
      )}
    </ScreenContainer>
  );
}

const useStyles = (colors: ColorPalette) =>
  StyleSheet.create({
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 16,
    },
    headerTitle: { color: colors.text, fontSize: 22, fontFamily: font.extrabold },
    headerSub: { color: colors.textMuted, fontSize: 13, marginTop: 2 },
    addBtn: {
      backgroundColor: colors.primary,
      borderRadius: 12,
      padding: 10,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    addBtnText: { color: colors.white, fontFamily: font.bold, fontSize: 14 },
    // Form
    form: {
      backgroundColor: colors.surface,
      borderRadius: 18,
      padding: 18,
      marginBottom: 16,
      gap: 12,
      borderWidth: 1,
      borderColor: colors.border,
    },
    formTitle: { color: colors.text, fontSize: 16, fontFamily: font.extrabold },
    input: {
      backgroundColor: colors.background,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 13,
      fontSize: 15,
      color: colors.text,
    },
    label: { color: colors.textMuted, fontSize: 12, fontFamily: font.semibold, marginBottom: -4 },
    catRow: { marginHorizontal: -4 },
    catChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      backgroundColor: colors.background,
      borderRadius: 20,
      paddingVertical: 7,
      paddingHorizontal: 12,
      marginHorizontal: 4,
      borderWidth: 1,
      borderColor: colors.border,
    },
    catChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
    catChipText: { color: colors.primary, fontSize: 12, fontFamily: font.semibold },
    catChipTextActive: { color: colors.white },
    dayRow: { marginHorizontal: -3 },
    dayChip: {
      width: 36,
      height: 36,
      borderRadius: 10,
      alignItems: 'center',
      justifyContent: 'center',
      marginHorizontal: 3,
      backgroundColor: colors.background,
      borderWidth: 1,
      borderColor: colors.border,
    },
    dayChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
    dayChipText: { color: colors.text, fontSize: 13, fontFamily: font.semibold },
    dayChipTextActive: { color: colors.white },
    deductibleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    formButtons: { flexDirection: 'row', gap: 10, marginTop: 4 },
    cancelBtn: {
      flex: 1,
      padding: 14,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: 'center',
    },
    cancelBtnText: { color: colors.textMuted, fontFamily: font.bold },
    saveBtn: {
      flex: 2,
      padding: 14,
      borderRadius: 14,
      backgroundColor: colors.primary,
      alignItems: 'center',
    },
    saveBtnText: { color: colors.white, fontFamily: font.extrabold, fontSize: 15 },
    // List
    list: { gap: 10, paddingBottom: 40 },
    card: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      backgroundColor: colors.surface,
      borderRadius: 16,
      padding: 14,
      borderWidth: 1,
      borderColor: colors.border,
    },
    cardInactive: { opacity: 0.5 },
    iconBox: {
      width: 44,
      height: 44,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
    },
    cardInfo: { flex: 1 },
    cardTitle: { color: colors.text, fontSize: 15, fontFamily: font.bold },
    cardSub: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
    cardRight: { alignItems: 'flex-end', gap: 4 },
    cardAmount: { color: colors.text, fontSize: 15, fontFamily: font.extrabold },
    cardActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    textMuted: { color: colors.textMuted },
    // Empty
    empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 14, paddingHorizontal: 32 },
    emptyTitle: { color: colors.text, fontSize: 20, fontFamily: font.extrabold, textAlign: 'center' },
    emptySub: { color: colors.textMuted, fontSize: 14, textAlign: 'center', lineHeight: 20 },
  });
