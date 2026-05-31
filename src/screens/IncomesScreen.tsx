import React, { useMemo, useState } from 'react';
import {
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { ScreenContainer } from '../components/ScreenContainer';
import { useIncomeStore } from '../store/useIncomeStore';
import { ColorPalette } from '../theme/colors';
import { font } from '../theme/typography';
import { useTheme } from '../theme/ThemeContext';
import {
  Income,
  IncomeInput,
  IncomeType,
  INCOME_TYPE_COLORS,
  INCOME_TYPE_ICONS,
  INCOME_TYPE_LABELS,
} from '../types/income';
import { formatCurrency, localDateString } from '../utils/format';

const INCOME_TYPES = Object.keys(INCOME_TYPE_LABELS) as IncomeType[];
const MONTHS = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];

function monthPrefix(offset = 0): string {
  const d = new Date();
  d.setMonth(d.getMonth() - offset);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export function IncomesScreen() {
  const { colors, isDark } = useTheme();
  const s = useStyles(colors, isDark);
  const incomes = useIncomeStore(state => state.incomes);
  const addIncome = useIncomeStore(state => state.addIncome);
  const editIncome = useIncomeStore(state => state.editIncome);
  const removeIncome = useIncomeStore(state => state.removeIncome);

  const now = new Date();
  const [monthOffset, setMonthOffset] = useState(0);
  const [modalVisible, setModalVisible] = useState(false);
  const [editing, setEditing] = useState<Income | null>(null);

  // Form state
  const [amount, setAmount] = useState('');
  const [type, setType] = useState<IncomeType>('honorarios');
  const [description, setDescription] = useState('');
  const [invoiced, setInvoiced] = useState(false);
  const [date, setDate] = useState(localDateString(new Date()));

  const prefix = monthPrefix(monthOffset);
  const monthDate = new Date(now.getFullYear(), now.getMonth() - monthOffset, 1);
  const monthLabel = `${MONTHS[monthDate.getMonth()]} ${monthDate.getFullYear()}`;

  const monthIncomes = useMemo(
    () => incomes.filter(i => i.date.startsWith(prefix)),
    [incomes, prefix],
  );

  const totalMonth = monthIncomes.reduce((s, i) => s + i.amount, 0);
  const invoicedTotal = monthIncomes.filter(i => i.invoiced).reduce((s, i) => s + i.amount, 0);

  const byType = useMemo(() => {
    const map: Partial<Record<IncomeType, number>> = {};
    for (const inc of monthIncomes) {
      map[inc.type] = (map[inc.type] ?? 0) + inc.amount;
    }
    return map;
  }, [monthIncomes]);

  const openNew = () => {
    setEditing(null);
    setAmount('');
    setType('honorarios');
    setDescription('');
    setInvoiced(false);
    setDate(localDateString(new Date()));
    setModalVisible(true);
  };

  const openEdit = (inc: Income) => {
    setEditing(inc);
    setAmount(String(inc.amount));
    setType(inc.type);
    setDescription(inc.description);
    setInvoiced(inc.invoiced);
    setDate(inc.date);
    setModalVisible(true);
  };

  const handleSave = async () => {
    const val = parseFloat(amount.replace(/,/g, '.'));
    if (!val || val <= 0) {
      Alert.alert('Monto inválido', 'Ingresa un monto mayor a 0.');
      return;
    }
    const input: IncomeInput = { amount: val, date, type, description, invoiced };
    if (editing) {
      await editIncome(editing.id, input);
    } else {
      await addIncome(input);
    }
    setModalVisible(false);
  };

  const handleDelete = (inc: Income) => {
    Alert.alert(
      'Eliminar ingreso',
      `¿Eliminar ${formatCurrency(inc.amount)} de ${INCOME_TYPE_LABELS[inc.type]}?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Eliminar', style: 'destructive', onPress: () => removeIncome(inc.id) },
      ],
    );
  };

  return (
    <ScreenContainer>
      {/* Month selector */}
      <Animated.View entering={FadeIn.duration(300)} style={s.monthRow}>
        <Pressable onPress={() => setMonthOffset(o => o + 1)} style={s.arrowBtn} hitSlop={10}>
          <Icon name="chevron-left" size={24} color={colors.text} />
        </Pressable>
        <Text style={s.monthLabel}>{monthLabel}</Text>
        <Pressable
          onPress={() => setMonthOffset(o => Math.max(0, o - 1))}
          style={[s.arrowBtn, monthOffset === 0 && s.arrowDisabled]}
          disabled={monthOffset === 0}
          hitSlop={10}
        >
          <Icon name="chevron-right" size={24} color={monthOffset === 0 ? colors.border : colors.text} />
        </Pressable>
      </Animated.View>

      {/* Summary cards */}
      <Animated.View entering={FadeInDown.delay(60).duration(350)} style={s.summaryRow}>
        <View style={s.summaryCard}>
          <Icon name="cash-plus" size={18} color={colors.success} />
          <Text style={s.summaryAmount}>{formatCurrency(totalMonth)}</Text>
          <Text style={s.summaryLabel}>Total ingresos</Text>
        </View>
        <View style={s.summaryCard}>
          <Icon name="file-document-check-outline" size={18} color={colors.primary} />
          <Text style={s.summaryAmount}>{formatCurrency(invoicedTotal)}</Text>
          <Text style={s.summaryLabel}>Facturado</Text>
        </View>
        <View style={s.summaryCard}>
          <Icon name="cash-minus" size={18} color={colors.secondary} />
          <Text style={s.summaryAmount}>{formatCurrency(totalMonth - invoicedTotal)}</Text>
          <Text style={s.summaryLabel}>Sin factura</Text>
        </View>
      </Animated.View>

      {/* Breakdown by type */}
      {Object.entries(byType).length > 0 ? (
        <Animated.View entering={FadeInDown.delay(100).duration(350)} style={s.breakdownCard}>
          <Text style={s.sectionTitle}>Por tipo</Text>
          {(Object.entries(byType) as [IncomeType, number][]).map(([t, amt]) => (
            <View key={t} style={s.breakdownRow}>
              <View style={[s.typeIcon, { backgroundColor: INCOME_TYPE_COLORS[t] + '18' }]}>
                <Icon name={INCOME_TYPE_ICONS[t]} size={16} color={INCOME_TYPE_COLORS[t]} />
              </View>
              <Text style={s.breakdownLabel}>{INCOME_TYPE_LABELS[t]}</Text>
              <Text style={s.breakdownAmount}>{formatCurrency(amt)}</Text>
            </View>
          ))}
        </Animated.View>
      ) : null}

      {/* List */}
      <Animated.View entering={FadeInDown.delay(140).duration(350)}>
        <Text style={s.sectionTitle}>Registros</Text>
        {monthIncomes.length === 0 ? (
          <View style={s.empty}>
            <Icon name="cash-plus" size={40} color={colors.border} />
            <Text style={s.emptyText}>Sin ingresos este mes</Text>
          </View>
        ) : (
          <View style={s.listCard}>
            {monthIncomes.map((inc, idx) => (
              <Pressable
                key={inc.id}
                style={[s.listRow, idx < monthIncomes.length - 1 && s.listBorder]}
                onPress={() => openEdit(inc)}
                onLongPress={() => handleDelete(inc)}
              >
                <View style={[s.typeIcon, { backgroundColor: INCOME_TYPE_COLORS[inc.type] + '18' }]}>
                  <Icon name={INCOME_TYPE_ICONS[inc.type]} size={18} color={INCOME_TYPE_COLORS[inc.type]} />
                </View>
                <View style={s.listInfo}>
                  <Text style={s.listType}>{INCOME_TYPE_LABELS[inc.type]}</Text>
                  <Text style={s.listMeta} numberOfLines={1}>
                    {inc.date.slice(5).replace('-', '/')}
                    {inc.invoiced ? ' · Facturado' : ''}
                    {inc.description ? ` · ${inc.description}` : ''}
                  </Text>
                </View>
                <Text style={[s.listAmount, { color: INCOME_TYPE_COLORS[inc.type] }]}>
                  +{formatCurrency(inc.amount)}
                </Text>
              </Pressable>
            ))}
          </View>
        )}
      </Animated.View>

      {/* FAB */}
      <Pressable style={s.fab} onPress={openNew}>
        <Icon name="plus" size={26} color="#fff" />
      </Pressable>

      {/* Modal */}
      <Modal visible={modalVisible} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setModalVisible(false)}>
        <View style={s.modal}>
          <View style={s.modalHeader}>
            <Text style={s.modalTitle}>{editing ? 'Editar ingreso' : 'Nuevo ingreso'}</Text>
            <Pressable onPress={() => setModalVisible(false)} hitSlop={12}>
              <Icon name="close" size={22} color={colors.textMuted} />
            </Pressable>
          </View>

          <ScrollView contentContainerStyle={s.modalScroll} keyboardShouldPersistTaps="handled">
            {/* Amount */}
            <Text style={s.fieldLabel}>Monto (MXN)</Text>
            <TextInput
              style={s.input}
              keyboardType="decimal-pad"
              placeholder="0.00"
              placeholderTextColor={colors.textMuted}
              value={amount}
              onChangeText={setAmount}
              autoFocus={!editing}
            />

            {/* Date */}
            <Text style={s.fieldLabel}>Fecha</Text>
            <TextInput
              style={s.input}
              placeholder="YYYY-MM-DD"
              placeholderTextColor={colors.textMuted}
              value={date}
              onChangeText={setDate}
            />

            {/* Type */}
            <Text style={s.fieldLabel}>Tipo de ingreso</Text>
            <View style={s.typeGrid}>
              {INCOME_TYPES.map(t => (
                <Pressable
                  key={t}
                  style={[s.typeChip, type === t && { backgroundColor: INCOME_TYPE_COLORS[t], borderColor: INCOME_TYPE_COLORS[t] }]}
                  onPress={() => setType(t)}
                >
                  <Icon name={INCOME_TYPE_ICONS[t]} size={15} color={type === t ? '#fff' : colors.text} />
                  <Text style={[s.typeChipText, type === t && { color: '#fff' }]}>
                    {INCOME_TYPE_LABELS[t]}
                  </Text>
                </Pressable>
              ))}
            </View>

            {/* Description */}
            <Text style={s.fieldLabel}>Descripción (opcional)</Text>
            <TextInput
              style={s.input}
              placeholder="Cliente, proyecto, etc."
              placeholderTextColor={colors.textMuted}
              value={description}
              onChangeText={setDescription}
            />

            {/* Invoiced */}
            <View style={s.switchRow}>
              <View style={{ flex: 1 }}>
                <Text style={s.fieldLabel}>¿Emitiste CFDI?</Text>
                <Text style={s.switchDesc}>Marca si facturaste este ingreso al SAT</Text>
              </View>
              <Switch
                value={invoiced}
                onValueChange={setInvoiced}
                trackColor={{ true: colors.primary }}
              />
            </View>

            <Pressable style={s.saveBtn} onPress={handleSave}>
              <Text style={s.saveBtnText}>{editing ? 'Guardar cambios' : 'Registrar ingreso'}</Text>
            </Pressable>
          </ScrollView>
        </View>
      </Modal>
    </ScreenContainer>
  );
}

const useStyles = (colors: ColorPalette, isDark: boolean) =>
  StyleSheet.create({
    monthRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: colors.surface,
      borderRadius: 18,
      paddingHorizontal: 8,
      paddingVertical: 10,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: isDark ? 0.2 : 0.05,
      shadowRadius: 6,
      elevation: 2,
    },
    arrowBtn: { padding: 8 },
    arrowDisabled: { opacity: 0.3 },
    monthLabel: { color: colors.text, fontSize: 18, fontFamily: font.extrabold },

    summaryRow: { flexDirection: 'row', gap: 10 },
    summaryCard: {
      flex: 1,
      backgroundColor: colors.surface,
      borderRadius: 18,
      padding: 14,
      gap: 4,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: isDark ? 0.2 : 0.05,
      shadowRadius: 6,
      elevation: 2,
    },
    summaryAmount: { color: colors.text, fontSize: 16, fontFamily: font.extrabold, letterSpacing: -0.3 },
    summaryLabel: { color: colors.textMuted, fontSize: 11, fontFamily: font.medium },

    sectionTitle: { color: colors.text, fontSize: 16, fontFamily: font.bold, marginBottom: 10 },

    breakdownCard: {
      backgroundColor: colors.surface,
      borderRadius: 18,
      padding: 16,
      gap: 12,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: isDark ? 0.2 : 0.05,
      shadowRadius: 6,
      elevation: 2,
    },
    breakdownRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    typeIcon: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
    breakdownLabel: { flex: 1, color: colors.text, fontSize: 13, fontFamily: font.medium },
    breakdownAmount: { color: colors.text, fontSize: 14, fontFamily: font.bold },

    empty: { alignItems: 'center', gap: 10, paddingVertical: 40 },
    emptyText: { color: colors.textMuted, fontSize: 14, fontFamily: font.medium },

    listCard: {
      backgroundColor: colors.surface,
      borderRadius: 18,
      overflow: 'hidden',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: isDark ? 0.2 : 0.05,
      shadowRadius: 6,
      elevation: 2,
    },
    listRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 },
    listBorder: { borderBottomWidth: 1, borderBottomColor: colors.border },
    listInfo: { flex: 1, gap: 2 },
    listType: { color: colors.text, fontSize: 14, fontFamily: font.semibold },
    listMeta: { color: colors.textMuted, fontSize: 12, fontFamily: font.regular },
    listAmount: { fontSize: 15, fontFamily: font.bold },

    fab: {
      position: 'absolute',
      bottom: 24,
      right: 24,
      width: 56,
      height: 56,
      borderRadius: 28,
      backgroundColor: colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
      shadowColor: colors.primary,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.4,
      shadowRadius: 10,
      elevation: 8,
    },

    modal: { flex: 1, backgroundColor: colors.background },
    modalHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: 20,
      paddingTop: 24,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    modalTitle: { color: colors.text, fontSize: 18, fontFamily: font.bold },
    modalScroll: { padding: 20, gap: 6, paddingBottom: 48 },

    fieldLabel: { color: colors.text, fontSize: 13, fontFamily: font.semibold, marginBottom: 6, marginTop: 14 },
    input: {
      backgroundColor: colors.surface,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: 14,
      paddingVertical: 12,
      color: colors.text,
      fontSize: 15,
      fontFamily: font.regular,
    },
    typeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    typeChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surfaceAlt,
    },
    typeChipText: { color: colors.text, fontSize: 12, fontFamily: font.medium },
    switchRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 14 },
    switchDesc: { color: colors.textMuted, fontSize: 12, fontFamily: font.regular, marginTop: 2 },
    saveBtn: {
      backgroundColor: colors.primary,
      borderRadius: 16,
      paddingVertical: 16,
      alignItems: 'center',
      marginTop: 24,
      shadowColor: colors.primary,
      shadowOffset: { width: 0, height: 3 },
      shadowOpacity: 0.3,
      shadowRadius: 8,
      elevation: 5,
    },
    saveBtnText: { color: '#fff', fontSize: 16, fontFamily: font.bold },
  });
