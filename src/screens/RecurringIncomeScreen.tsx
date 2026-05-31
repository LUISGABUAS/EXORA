import React, { useState } from 'react';
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
import Animated, { FadeInDown } from 'react-native-reanimated';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { ScreenContainer } from '../components/ScreenContainer';
import { RecurringIncome, useRecurringIncomeStore } from '../store/useRecurringIncomeStore';
import { ColorPalette } from '../theme/colors';
import { font } from '../theme/typography';
import { useTheme } from '../theme/ThemeContext';
import {
  IncomeType,
  PaymentMethod,
  INCOME_TYPE_COLORS,
  INCOME_TYPE_ICONS,
  INCOME_TYPE_LABELS,
  PAYMENT_METHOD_ICONS,
  PAYMENT_METHOD_LABELS,
} from '../types/income';
import { formatCurrency } from '../utils/format';

const INCOME_TYPES = Object.keys(INCOME_TYPE_LABELS) as IncomeType[];
const PAYMENT_METHODS = Object.keys(PAYMENT_METHOD_LABELS) as PaymentMethod[];

const EMPTY = {
  amount: '',
  type: 'nomina' as IncomeType,
  description: '',
  paymentMethod: 'transferencia' as PaymentMethod,
  invoiced: false,
  dayOfMonth: 1,
  active: true,
};

export function RecurringIncomeScreen() {
  const { colors, isDark } = useTheme();
  const s = useStyles(colors, isDark);
  const items = useRecurringIncomeStore(state => state.items);
  const add = useRecurringIncomeStore(state => state.add);
  const update = useRecurringIncomeStore(state => state.update);
  const remove = useRecurringIncomeStore(state => state.remove);

  const [modalVisible, setModalVisible] = useState(false);
  const [editing, setEditing] = useState<RecurringIncome | null>(null);
  const [form, setForm] = useState(EMPTY);

  const set_ = (key: keyof typeof EMPTY, value: any) =>
    setForm(prev => ({ ...prev, [key]: value }));

  const openNew = () => {
    setEditing(null);
    setForm(EMPTY);
    setModalVisible(true);
  };

  const openEdit = (item: RecurringIncome) => {
    setEditing(item);
    setForm({
      amount: String(item.amount),
      type: item.type,
      description: item.description,
      paymentMethod: item.paymentMethod,
      invoiced: item.invoiced,
      dayOfMonth: item.dayOfMonth,
      active: item.active,
    });
    setModalVisible(true);
  };

  const handleSave = async () => {
    const val = parseFloat(form.amount.replace(/,/g, '.'));
    if (!val || val <= 0) {
      Alert.alert('Monto inválido', 'Ingresa un monto mayor a 0.');
      return;
    }
    const data = {
      amount: val,
      type: form.type,
      description: form.description,
      paymentMethod: form.paymentMethod,
      invoiced: form.invoiced,
      dayOfMonth: form.dayOfMonth,
      active: form.active,
    };
    if (editing) {
      await update(editing.id, data);
    } else {
      await add(data);
    }
    setModalVisible(false);
  };

  const handleDelete = (item: RecurringIncome) => {
    Alert.alert(
      'Eliminar ingreso fijo',
      `¿Eliminar ${item.description || INCOME_TYPE_LABELS[item.type]}?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Eliminar', style: 'destructive', onPress: () => remove(item.id) },
      ],
    );
  };

  return (
    <View style={s.root}>
      <ScreenContainer>
        {items.length === 0 ? (
          <Animated.View entering={FadeInDown.duration(400)} style={s.empty}>
            <Icon name="repeat" size={52} color={colors.border} />
            <Text style={s.emptyTitle}>Sin ingresos fijos</Text>
            <Text style={s.emptyDesc}>
              Agrega tu salario, renta cobrada u otros ingresos que recibes cada mes. EXPENSIA los registrará automáticamente.
            </Text>
            <Pressable style={s.emptyBtn} onPress={openNew}>
              <Icon name="plus" size={18} color="#fff" />
              <Text style={s.emptyBtnText}>Agregar ingreso fijo</Text>
            </Pressable>
          </Animated.View>
        ) : (
          <>
            <Animated.View entering={FadeInDown.duration(300)} style={s.infoCard}>
              <Icon name="information-outline" size={16} color={colors.primary} />
              <Text style={s.infoText}>
                EXPENSIA registra estos ingresos automáticamente cada mes en la fecha indicada.
              </Text>
            </Animated.View>

            {items.map((item, idx) => (
              <Animated.View key={item.id} entering={FadeInDown.delay(idx * 60).duration(300)}>
                <Pressable style={s.itemCard} onPress={() => openEdit(item)}>
                  <View style={[s.typeIcon, { backgroundColor: INCOME_TYPE_COLORS[item.type] + '18' }]}>
                    <Icon name={INCOME_TYPE_ICONS[item.type]} size={22} color={INCOME_TYPE_COLORS[item.type]} />
                  </View>

                  <View style={s.itemInfo}>
                    <View style={s.itemRow}>
                      <Text style={s.itemDesc} numberOfLines={1}>
                        {item.description || INCOME_TYPE_LABELS[item.type]}
                      </Text>
                      <Text style={[s.itemAmount, { color: INCOME_TYPE_COLORS[item.type] }]}>
                        {formatCurrency(item.amount)}
                      </Text>
                    </View>
                    <View style={s.itemMeta}>
                      <Icon name="calendar-clock" size={12} color={colors.textMuted} />
                      <Text style={s.itemMetaText}>
                        Día {item.dayOfMonth} de cada mes
                      </Text>
                      <Icon name={PAYMENT_METHOD_ICONS[item.paymentMethod]} size={12} color={colors.textMuted} />
                      <Text style={s.itemMetaText}>{PAYMENT_METHOD_LABELS[item.paymentMethod]}</Text>
                    </View>
                  </View>

                  <View style={s.itemActions}>
                    <Switch
                      value={item.active}
                      onValueChange={v => update(item.id, { active: v })}
                      trackColor={{ true: INCOME_TYPE_COLORS[item.type] }}
                      style={{ transform: [{ scaleX: 0.8 }, { scaleY: 0.8 }] }}
                    />
                    <Pressable onPress={() => handleDelete(item)} hitSlop={8}>
                      <Icon name="trash-can-outline" size={18} color={colors.danger} />
                    </Pressable>
                  </View>
                </Pressable>
              </Animated.View>
            ))}

            <View style={{ height: 90 }} />
          </>
        )}
      </ScreenContainer>

      {items.length > 0 ? (
        <Pressable style={s.fab} onPress={openNew}>
          <Icon name="plus" size={26} color="#fff" />
        </Pressable>
      ) : null}

      <Modal visible={modalVisible} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setModalVisible(false)}>
        <View style={s.modal}>
          <View style={s.modalHeader}>
            <Text style={s.modalTitle}>{editing ? 'Editar ingreso fijo' : 'Nuevo ingreso fijo'}</Text>
            <Pressable onPress={() => setModalVisible(false)} hitSlop={12}>
              <Icon name="close" size={22} color={colors.textMuted} />
            </Pressable>
          </View>

          <ScrollView contentContainerStyle={s.modalScroll} keyboardShouldPersistTaps="handled">

            <Text style={s.fieldLabel}>Monto mensual (MXN)</Text>
            <TextInput
              style={s.input}
              keyboardType="decimal-pad"
              placeholder="0.00"
              placeholderTextColor={colors.textMuted}
              value={form.amount}
              onChangeText={v => set_('amount', v)}
              autoFocus={!editing}
            />

            <Text style={s.fieldLabel}>Tipo de ingreso</Text>
            <View style={s.chipGrid}>
              {INCOME_TYPES.map(t => (
                <Pressable
                  key={t}
                  style={[s.chip, form.type === t && { backgroundColor: INCOME_TYPE_COLORS[t], borderColor: INCOME_TYPE_COLORS[t] }]}
                  onPress={() => set_('type', t)}
                >
                  <Icon name={INCOME_TYPE_ICONS[t]} size={14} color={form.type === t ? '#fff' : colors.text} />
                  <Text style={[s.chipText, form.type === t && { color: '#fff' }]}>
                    {INCOME_TYPE_LABELS[t]}
                  </Text>
                </Pressable>
              ))}
            </View>

            <Text style={s.fieldLabel}>Día del mes en que lo recibes</Text>
            <View style={s.dayRow}>
              {[1, 5, 10, 15, 17, 20, 25, 28].map(d => (
                <Pressable
                  key={d}
                  style={[s.dayChip, form.dayOfMonth === d && s.dayChipActive]}
                  onPress={() => set_('dayOfMonth', d)}
                >
                  <Text style={[s.dayChipText, form.dayOfMonth === d && { color: '#fff' }]}>{d}</Text>
                </Pressable>
              ))}
            </View>

            <Text style={s.fieldLabel}>Método de pago</Text>
            <View style={s.paymentRow}>
              {PAYMENT_METHODS.map(m => (
                <Pressable
                  key={m}
                  style={[s.paymentChip, form.paymentMethod === m && s.paymentChipActive]}
                  onPress={() => set_('paymentMethod', m)}
                >
                  <Icon name={PAYMENT_METHOD_ICONS[m]} size={15} color={form.paymentMethod === m ? '#fff' : colors.text} />
                  <Text style={[s.chipText, form.paymentMethod === m && { color: '#fff' }]}>
                    {PAYMENT_METHOD_LABELS[m]}
                  </Text>
                </Pressable>
              ))}
            </View>

            <Text style={s.fieldLabel}>Descripción (opcional)</Text>
            <TextInput
              style={s.input}
              placeholder="Empresa, cliente, concepto..."
              placeholderTextColor={colors.textMuted}
              value={form.description}
              onChangeText={v => set_('description', v)}
            />

            <View style={s.switchRow}>
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={s.fieldLabel}>¿Emites CFDI por este ingreso?</Text>
                <Text style={s.switchDesc}>Lo marcará automáticamente como facturado</Text>
              </View>
              <Switch
                value={form.invoiced}
                onValueChange={v => set_('invoiced', v)}
                trackColor={{ true: colors.primary }}
              />
            </View>

            <Pressable style={s.saveBtn} onPress={handleSave}>
              <Text style={s.saveBtnText}>{editing ? 'Guardar cambios' : 'Agregar ingreso fijo'}</Text>
            </Pressable>

            {editing ? (
              <Pressable style={s.deleteBtn} onPress={() => { setModalVisible(false); handleDelete(editing); }}>
                <Icon name="trash-can-outline" size={18} color={colors.danger} />
                <Text style={s.deleteBtnText}>Eliminar ingreso fijo</Text>
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

    empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 14, padding: 32, paddingTop: 60 },
    emptyTitle: { color: colors.text, fontSize: 20, fontFamily: font.bold, textAlign: 'center' },
    emptyDesc: { color: colors.textMuted, fontSize: 14, fontFamily: font.regular, textAlign: 'center', lineHeight: 22 },
    emptyBtn: {
      flexDirection: 'row', alignItems: 'center', gap: 8,
      backgroundColor: colors.primary, paddingHorizontal: 24, paddingVertical: 14, borderRadius: 16, marginTop: 8,
    },
    emptyBtnText: { color: '#fff', fontFamily: font.bold, fontSize: 15 },

    infoCard: {
      flexDirection: 'row', alignItems: 'center', gap: 10,
      backgroundColor: colors.primary + '12', borderRadius: 14, padding: 14,
      borderWidth: 1, borderColor: colors.primary + '25',
    },
    infoText: { flex: 1, color: colors.text, fontSize: 13, fontFamily: font.regular, lineHeight: 18 },

    itemCard: {
      flexDirection: 'row', alignItems: 'center', gap: 12,
      backgroundColor: colors.surface, borderRadius: 18, padding: 16,
      shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
      shadowOpacity: isDark ? 0.2 : 0.05, shadowRadius: 6, elevation: 2,
    },
    typeIcon: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
    itemInfo: { flex: 1, gap: 6 },
    itemRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    itemDesc: { color: colors.text, fontSize: 15, fontFamily: font.semibold, flex: 1, marginRight: 8 },
    itemAmount: { fontSize: 16, fontFamily: font.bold },
    itemMeta: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    itemMetaText: { color: colors.textMuted, fontSize: 11, fontFamily: font.medium, marginRight: 6 },
    itemActions: { alignItems: 'center', gap: 8 },

    fab: {
      position: 'absolute', bottom: 24, right: 24, width: 56, height: 56,
      borderRadius: 28, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center',
      shadowColor: colors.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4,
      shadowRadius: 10, elevation: 8,
    },

    modal: { flex: 1, backgroundColor: colors.background },
    modalHeader: {
      flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
      padding: 20, paddingTop: 24, borderBottomWidth: 1, borderBottomColor: colors.border,
    },
    modalTitle: { color: colors.text, fontSize: 18, fontFamily: font.bold },
    modalScroll: { padding: 20, paddingBottom: 48 },

    fieldLabel: { color: colors.text, fontSize: 13, fontFamily: font.semibold, marginBottom: 8, marginTop: 16 },
    input: {
      backgroundColor: colors.surface, borderRadius: 14, borderWidth: 1,
      borderColor: colors.border, paddingHorizontal: 14, paddingVertical: 12,
      color: colors.text, fontSize: 15, fontFamily: font.regular,
    },

    chipGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    chip: {
      flexDirection: 'row', alignItems: 'center', gap: 6,
      paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12,
      borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surfaceAlt,
    },
    chipText: { color: colors.text, fontSize: 12, fontFamily: font.medium },

    dayRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    dayChip: {
      width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center',
      backgroundColor: colors.surfaceAlt, borderWidth: 1, borderColor: colors.border,
    },
    dayChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
    dayChipText: { color: colors.text, fontSize: 14, fontFamily: font.bold },

    paymentRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
    paymentChip: {
      flexDirection: 'row', alignItems: 'center', gap: 6,
      paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12,
      borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surfaceAlt,
    },
    paymentChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },

    switchRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 16 },
    switchDesc: { color: colors.textMuted, fontSize: 12, fontFamily: font.regular },

    saveBtn: {
      backgroundColor: colors.primary, borderRadius: 16, paddingVertical: 16,
      alignItems: 'center', marginTop: 24,
      shadowColor: colors.primary, shadowOffset: { width: 0, height: 3 },
      shadowOpacity: 0.3, shadowRadius: 8, elevation: 5,
    },
    saveBtnText: { color: '#fff', fontSize: 16, fontFamily: font.bold },
    deleteBtn: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
      gap: 8, marginTop: 12, paddingVertical: 14, borderRadius: 16,
      backgroundColor: colors.danger + '12',
    },
    deleteBtnText: { color: colors.danger, fontSize: 15, fontFamily: font.semibold },
  });
