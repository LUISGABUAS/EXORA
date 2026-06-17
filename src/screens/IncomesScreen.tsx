import React, { useEffect, useMemo, useRef, useState } from 'react';
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
import { useDeepLinkStore } from '../store/useDeepLinkStore';
import { useIncomeStore } from '../store/useIncomeStore';
import { ColorPalette } from '../theme/colors';
import { font } from '../theme/typography';
import { useTheme } from '../theme/ThemeContext';
import {
  Income,
  IncomeInput,
  IncomeType,
  PaymentMethod,
  INCOME_TYPE_COLORS,
  INCOME_TYPE_ICONS,
  INCOME_TYPE_LABELS,
  PAYMENT_METHOD_ICONS,
  PAYMENT_METHOD_LABELS,
} from '../types/income';
import { formatCurrency, localDateString } from '../utils/format';

const INCOME_TYPES = Object.keys(INCOME_TYPE_LABELS) as IncomeType[];
const PAYMENT_METHODS = Object.keys(PAYMENT_METHOD_LABELS) as PaymentMethod[];
const MONTHS = [
  'Ene',
  'Feb',
  'Mar',
  'Abr',
  'May',
  'Jun',
  'Jul',
  'Ago',
  'Sep',
  'Oct',
  'Nov',
  'Dic',
];

function monthPrefix(offset = 0): string {
  const d = new Date();
  d.setMonth(d.getMonth() - offset);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

const EMPTY_FORM = {
  amount: '',
  type: 'honorarios' as IncomeType,
  description: '',
  invoiced: false,
  recurring: false,
  paymentMethod: 'transferencia' as PaymentMethod,
  date: localDateString(new Date()),
};

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
  const [form, setForm] = useState(EMPTY_FORM);
  const amountInputRef = useRef<TextInput>(null);

  const pendingAction = useDeepLinkStore(state => state.pendingAction);
  const clearPendingAction = useDeepLinkStore(
    state => state.clearPendingAction,
  );

  useEffect(() => {
    if (pendingAction === 'add-income') {
      setEditing(null);
      setForm(EMPTY_FORM);
      setModalVisible(true);
      clearPendingAction();
    }
  }, [pendingAction, clearPendingAction]);

  // Fuerza el foco cuando abre el modal (incluye desde widget)
  useEffect(() => {
    if (modalVisible && !editing) {
      const timer = setTimeout(() => amountInputRef.current?.focus(), 150);
      return () => clearTimeout(timer);
    }
  }, [modalVisible, editing]);

  const prefix = monthPrefix(monthOffset);
  const monthDate = new Date(
    now.getFullYear(),
    now.getMonth() - monthOffset,
    1,
  );
  const monthLabel = `${
    MONTHS[monthDate.getMonth()]
  } ${monthDate.getFullYear()}`;
  const isCurrentMonth = monthOffset === 0;

  const monthIncomes = useMemo(
    () => incomes.filter(i => i.date.startsWith(prefix)),
    [incomes, prefix],
  );

  const totalMonth = monthIncomes.reduce((s, i) => s + i.amount, 0);
  const invoicedTotal = monthIncomes
    .filter(i => i.invoiced)
    .reduce((s, i) => s + i.amount, 0);
  const recurringTotal = monthIncomes
    .filter(i => i.recurring)
    .reduce((s, i) => s + i.amount, 0);

  const byType = useMemo(() => {
    const map: Partial<Record<IncomeType, number>> = {};
    for (const inc of monthIncomes) {
      map[inc.type] = (map[inc.type] ?? 0) + inc.amount;
    }
    return map;
  }, [monthIncomes]);

  const openNew = () => {
    setEditing(null);
    setForm({ ...EMPTY_FORM, date: localDateString(new Date()) });
    setModalVisible(true);
  };

  const openEdit = (inc: Income) => {
    setEditing(inc);
    setForm({
      amount: String(inc.amount),
      type: inc.type,
      description: inc.description,
      invoiced: inc.invoiced,
      recurring: inc.recurring,
      paymentMethod: inc.paymentMethod,
      date: inc.date,
    });
    setModalVisible(true);
  };

  const handleSave = async () => {
    const val = parseFloat(form.amount.replace(/,/g, '.'));
    if (!val || val <= 0) {
      Alert.alert('Monto inválido', 'Ingresa un monto mayor a 0.');
      return;
    }
    const input: IncomeInput = {
      amount: val,
      date: form.date,
      type: form.type,
      description: form.description,
      invoiced: form.invoiced,
      recurring: form.recurring,
      paymentMethod: form.paymentMethod,
    };
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
      `¿Eliminar ${formatCurrency(inc.amount)} de ${
        INCOME_TYPE_LABELS[inc.type]
      }?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: () => removeIncome(inc.id),
        },
      ],
    );
  };

  const set = (key: keyof typeof form, value: any) =>
    setForm(prev => ({ ...prev, [key]: value }));

  return (
    <View style={s.root}>
      <ScreenContainer>
        {/* Month selector */}
        <Animated.View entering={FadeIn.duration(300)} style={s.monthRow}>
          <Pressable
            onPress={() => setMonthOffset(o => o + 1)}
            style={s.arrowBtn}
            hitSlop={10}
          >
            <Icon name="chevron-left" size={24} color={colors.text} />
          </Pressable>
          <Text style={s.monthLabel}>{monthLabel}</Text>
          <Pressable
            onPress={() => setMonthOffset(o => Math.max(0, o - 1))}
            style={[s.arrowBtn, isCurrentMonth && s.arrowDisabled]}
            disabled={isCurrentMonth}
            hitSlop={10}
          >
            <Icon
              name="chevron-right"
              size={24}
              color={isCurrentMonth ? colors.border : colors.text}
            />
          </Pressable>
        </Animated.View>

        {/* Summary */}
        <Animated.View
          entering={FadeInDown.delay(60).duration(350)}
          style={s.summaryRow}
        >
          <View style={s.summaryCard}>
            <Icon name="cash-multiple" size={18} color={colors.success} />
            <Text style={s.summaryAmount}>{formatCurrency(totalMonth)}</Text>
            <Text style={s.summaryLabel}>Total</Text>
          </View>
          <View style={s.summaryCard}>
            <Icon name="file-sign" size={18} color={colors.primary} />
            <Text style={s.summaryAmount}>{formatCurrency(invoicedTotal)}</Text>
            <Text style={s.summaryLabel}>Facturado</Text>
          </View>
          <View style={s.summaryCard}>
            <Icon name="repeat" size={18} color="#8B5CF6" />
            <Text style={s.summaryAmount}>
              {formatCurrency(recurringTotal)}
            </Text>
            <Text style={s.summaryLabel}>Recurrente</Text>
          </View>
        </Animated.View>

        {/* Breakdown */}
        {Object.entries(byType).length > 0 ? (
          <Animated.View
            entering={FadeInDown.delay(100).duration(350)}
            style={s.card}
          >
            <Text style={s.cardTitle}>Por tipo</Text>
            {(Object.entries(byType) as [IncomeType, number][]).map(
              ([t, amt]) => (
                <View key={t} style={s.breakdownRow}>
                  <View
                    style={[
                      s.typeIcon,
                      { backgroundColor: INCOME_TYPE_COLORS[t] + '18' },
                    ]}
                  >
                    <Icon
                      name={INCOME_TYPE_ICONS[t]}
                      size={16}
                      color={INCOME_TYPE_COLORS[t]}
                    />
                  </View>
                  <Text style={s.breakdownLabel}>{INCOME_TYPE_LABELS[t]}</Text>
                  <Text style={s.breakdownAmount}>{formatCurrency(amt)}</Text>
                </View>
              ),
            )}
          </Animated.View>
        ) : null}

        {/* List */}
        <Animated.View entering={FadeInDown.delay(140).duration(350)}>
          <Text style={s.sectionTitle}>Registros</Text>
          {monthIncomes.length === 0 ? (
            <View style={s.empty}>
              <Icon name="cash-plus" size={44} color={colors.border} />
              <Text style={s.emptyTitle}>Sin ingresos este mes</Text>
              <Text style={s.emptyDesc}>Toca + para registrar un ingreso</Text>
            </View>
          ) : (
            <View style={s.card}>
              {monthIncomes.map((inc, idx) => (
                <View
                  key={inc.id}
                  style={[
                    s.listRow,
                    idx < monthIncomes.length - 1 && s.listBorder,
                  ]}
                >
                  {/* Icon */}
                  <View
                    style={[
                      s.typeIcon,
                      { backgroundColor: INCOME_TYPE_COLORS[inc.type] + '18' },
                    ]}
                  >
                    <Icon
                      name={INCOME_TYPE_ICONS[inc.type]}
                      size={18}
                      color={INCOME_TYPE_COLORS[inc.type]}
                    />
                  </View>

                  {/* Info */}
                  <Pressable style={s.listInfo} onPress={() => openEdit(inc)}>
                    <View style={s.listInfoTop}>
                      <Text style={s.listType}>
                        {INCOME_TYPE_LABELS[inc.type]}
                      </Text>
                      <Text
                        style={[
                          s.listAmount,
                          { color: INCOME_TYPE_COLORS[inc.type] },
                        ]}
                      >
                        +{formatCurrency(inc.amount)}
                      </Text>
                    </View>
                    <View style={s.listBadges}>
                      <Text style={s.listMeta}>
                        {inc.date.slice(5).replace('-', '/')}
                      </Text>
                      {inc.recurring ? (
                        <View style={s.badge}>
                          <Icon name="repeat" size={10} color="#8B5CF6" />
                          <Text style={[s.badgeText, { color: '#8B5CF6' }]}>
                            Recurrente
                          </Text>
                        </View>
                      ) : null}
                      {inc.invoiced ? (
                        <View
                          style={[
                            s.badge,
                            { backgroundColor: colors.primary + '15' },
                          ]}
                        >
                          <Icon
                            name="file-sign"
                            size={10}
                            color={colors.primary}
                          />
                          <Text
                            style={[s.badgeText, { color: colors.primary }]}
                          >
                            Facturado
                          </Text>
                        </View>
                      ) : null}
                      <View style={s.badge}>
                        <Icon
                          name={PAYMENT_METHOD_ICONS[inc.paymentMethod]}
                          size={10}
                          color={colors.textMuted}
                        />
                        <Text style={s.badgeText}>
                          {PAYMENT_METHOD_LABELS[inc.paymentMethod]}
                        </Text>
                      </View>
                    </View>
                  </Pressable>

                  {/* Delete */}
                  <Pressable
                    style={s.deleteBtn}
                    onPress={() => handleDelete(inc)}
                    hitSlop={8}
                  >
                    <Icon
                      name="trash-can-outline"
                      size={18}
                      color={colors.danger}
                    />
                  </Pressable>
                </View>
              ))}
            </View>
          )}
        </Animated.View>

        {/* Bottom spacer so FAB doesn't cover last item */}
        <View style={{ height: 90 }} />
      </ScreenContainer>

      {/* FAB */}
      <Pressable style={s.fab} onPress={openNew}>
        <Icon name="plus" size={26} color="#fff" />
      </Pressable>

      {/* Modal */}
      <Modal
        visible={modalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={s.modal}>
          <View style={s.modalHeader}>
            <Text style={s.modalTitle}>
              {editing ? 'Editar ingreso' : 'Nuevo ingreso'}
            </Text>
            <Pressable onPress={() => setModalVisible(false)} hitSlop={12}>
              <Icon name="close" size={22} color={colors.textMuted} />
            </Pressable>
          </View>

          <ScrollView
            contentContainerStyle={s.modalScroll}
            keyboardShouldPersistTaps="handled"
          >
            {/* Amount */}
            <Text style={s.fieldLabel}>Monto (MXN)</Text>
            <TextInput
              ref={amountInputRef}
              style={s.input}
              keyboardType="decimal-pad"
              placeholder="0.00"
              placeholderTextColor={colors.textMuted}
              value={form.amount}
              onChangeText={v => set('amount', v)}
              autoFocus={!editing}
            />

            {/* Date */}
            <Text style={s.fieldLabel}>Fecha</Text>
            <TextInput
              style={s.input}
              placeholder="YYYY-MM-DD"
              placeholderTextColor={colors.textMuted}
              value={form.date}
              onChangeText={v => set('date', v)}
            />

            {/* Type */}
            <Text style={s.fieldLabel}>Tipo de ingreso</Text>
            <View style={s.chipGrid}>
              {INCOME_TYPES.map(t => (
                <Pressable
                  key={t}
                  style={[
                    s.chip,
                    form.type === t && {
                      backgroundColor: INCOME_TYPE_COLORS[t],
                      borderColor: INCOME_TYPE_COLORS[t],
                    },
                  ]}
                  onPress={() => set('type', t)}
                >
                  <Icon
                    name={INCOME_TYPE_ICONS[t]}
                    size={14}
                    color={form.type === t ? '#fff' : colors.text}
                  />
                  <Text
                    style={[s.chipText, form.type === t && { color: '#fff' }]}
                  >
                    {INCOME_TYPE_LABELS[t]}
                  </Text>
                </Pressable>
              ))}
            </View>

            {/* Payment method */}
            <Text style={s.fieldLabel}>Método de pago</Text>
            <View style={s.paymentRow}>
              {PAYMENT_METHODS.map(m => (
                <Pressable
                  key={m}
                  style={[
                    s.paymentChip,
                    form.paymentMethod === m && s.paymentChipActive,
                  ]}
                  onPress={() => set('paymentMethod', m)}
                >
                  <Icon
                    name={PAYMENT_METHOD_ICONS[m]}
                    size={16}
                    color={form.paymentMethod === m ? '#fff' : colors.text}
                  />
                  <Text
                    style={[
                      s.paymentChipText,
                      form.paymentMethod === m && { color: '#fff' },
                    ]}
                  >
                    {PAYMENT_METHOD_LABELS[m]}
                  </Text>
                </Pressable>
              ))}
            </View>

            {/* Description */}
            <Text style={s.fieldLabel}>Descripción (opcional)</Text>
            <TextInput
              style={s.input}
              placeholder="Cliente, proyecto, empresa..."
              placeholderTextColor={colors.textMuted}
              value={form.description}
              onChangeText={v => set('description', v)}
            />

            {/* Recurring */}
            <View style={s.switchRow}>
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={s.fieldLabel}>
                  ¿Es un ingreso fijo/recurrente?
                </Text>
                <Text style={s.switchDesc}>
                  Salario mensual, renta cobrada, suscripción
                </Text>
              </View>
              <Switch
                value={form.recurring}
                onValueChange={v => set('recurring', v)}
                trackColor={{ true: '#8B5CF6' }}
              />
            </View>

            {/* Invoiced */}
            <View style={s.switchRow}>
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={s.fieldLabel}>¿Emitiste CFDI?</Text>
                <Text style={s.switchDesc}>Facturaste este ingreso al SAT</Text>
              </View>
              <Switch
                value={form.invoiced}
                onValueChange={v => set('invoiced', v)}
                trackColor={{ true: colors.primary }}
              />
            </View>

            <Pressable style={s.saveBtn} onPress={handleSave}>
              <Text style={s.saveBtnText}>
                {editing ? 'Guardar cambios' : 'Registrar ingreso'}
              </Text>
            </Pressable>

            {editing ? (
              <Pressable
                style={s.deleteFullBtn}
                onPress={() => {
                  setModalVisible(false);
                  handleDelete(editing);
                }}
              >
                <Icon
                  name="trash-can-outline"
                  size={18}
                  color={colors.danger}
                />
                <Text style={s.deleteFullBtnText}>Eliminar ingreso</Text>
              </Pressable>
            ) : null}
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

const useStyles = (colors: ColorPalette, isDark: boolean) =>
  StyleSheet.create({
    root: { flex: 1 },

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
    monthLabel: {
      color: colors.text,
      fontSize: 18,
      fontFamily: font.extrabold,
    },

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
    summaryAmount: {
      color: colors.text,
      fontSize: 15,
      fontFamily: font.extrabold,
      letterSpacing: -0.3,
    },
    summaryLabel: {
      color: colors.textMuted,
      fontSize: 11,
      fontFamily: font.medium,
    },

    card: {
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
    cardTitle: { color: colors.text, fontSize: 15, fontFamily: font.bold },

    sectionTitle: { color: colors.text, fontSize: 16, fontFamily: font.bold },

    breakdownRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    typeIcon: {
      width: 32,
      height: 32,
      borderRadius: 10,
      alignItems: 'center',
      justifyContent: 'center',
    },
    breakdownLabel: {
      flex: 1,
      color: colors.text,
      fontSize: 13,
      fontFamily: font.medium,
    },
    breakdownAmount: {
      color: colors.text,
      fontSize: 14,
      fontFamily: font.bold,
    },

    empty: { alignItems: 'center', gap: 8, paddingVertical: 48 },
    emptyTitle: { color: colors.text, fontSize: 16, fontFamily: font.semibold },
    emptyDesc: {
      color: colors.textMuted,
      fontSize: 13,
      fontFamily: font.regular,
    },

    listRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      paddingVertical: 12,
    },
    listBorder: { borderBottomWidth: 1, borderBottomColor: colors.border },
    listInfo: { flex: 1, gap: 4 },
    listInfoTop: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    listType: {
      color: colors.text,
      fontSize: 14,
      fontFamily: font.semibold,
      flex: 1,
      marginRight: 8,
    },
    listAmount: { fontSize: 15, fontFamily: font.bold },
    listBadges: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      flexWrap: 'wrap',
    },
    listMeta: {
      color: colors.textMuted,
      fontSize: 12,
      fontFamily: font.regular,
    },
    badge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 3,
      backgroundColor: colors.surfaceAlt,
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 6,
    },
    badgeText: {
      color: colors.textMuted,
      fontSize: 10,
      fontFamily: font.semibold,
    },
    deleteBtn: {
      width: 36,
      height: 36,
      borderRadius: 10,
      backgroundColor: colors.danger + '12',
      alignItems: 'center',
      justifyContent: 'center',
    },

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
    modalScroll: { padding: 20, paddingBottom: 48 },

    fieldLabel: {
      color: colors.text,
      fontSize: 13,
      fontFamily: font.semibold,
      marginBottom: 8,
      marginTop: 16,
    },
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

    chipGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    chip: {
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
    chipText: { color: colors.text, fontSize: 12, fontFamily: font.medium },

    paymentRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
    paymentChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 14,
      paddingVertical: 10,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surfaceAlt,
    },
    paymentChipActive: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    paymentChipText: {
      color: colors.text,
      fontSize: 13,
      fontFamily: font.medium,
    },

    switchRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      marginTop: 16,
    },
    switchDesc: {
      color: colors.textMuted,
      fontSize: 12,
      fontFamily: font.regular,
    },

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

    deleteFullBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      marginTop: 12,
      paddingVertical: 14,
      borderRadius: 16,
      backgroundColor: colors.danger + '12',
    },
    deleteFullBtnText: {
      color: colors.danger,
      fontSize: 15,
      fontFamily: font.semibold,
    },
  });
