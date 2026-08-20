import React, { useState } from 'react';
import {
  Alert,
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { ScreenContainer } from '../components/ScreenContainer';
import { SavingsGoal, useSavingsStore } from '../store/useSavingsStore';
import { ColorPalette } from '../theme/colors';
import { font } from '../theme/typography';
import { useTheme } from '../theme/ThemeContext';
import { DateField } from '../components/DateField';
import { formatCurrency } from '../utils/format';

const EMOJIS = ['🏠', '✈️', '🚗', '💻', '📱', '🎓', '👶', '💍', '🏋️', '🎸', '🌴', '💰'];

export function SavingsScreen() {
  const { colors } = useTheme();
  const s = useStyles(colors);
  const { goals, add, deposit, withdraw, remove } = useSavingsStore();

  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState('');
  const [target, setTarget] = useState('');
  const [emoji, setEmoji] = useState('💰');
  const [deadline, setDeadline] = useState('');

  // Deposit/withdraw modal
  const [actionGoal, setActionGoal] = useState<SavingsGoal | null>(null);
  const [actionAmount, setActionAmount] = useState('');
  const [actionType, setActionType] = useState<'deposit' | 'withdraw'>('deposit');

  const resetForm = () => {
    setTitle(''); setTarget(''); setEmoji('💰'); setDeadline('');
    setShowForm(false);
  };

  const handleAdd = async () => {
    const amt = parseFloat(target.replace(',', '.'));
    if (!title.trim()) { Alert.alert('Escribe un nombre para la meta'); return; }
    if (!amt || amt <= 0) { Alert.alert('Monto inválido'); return; }
    await add({
      title: title.trim(),
      targetAmount: amt,
      emoji,
      deadline: deadline || null,
    });
    resetForm();
  };

  const handleAction = async () => {
    if (!actionGoal) return;
    const amt = parseFloat(actionAmount.replace(',', '.'));
    if (!amt || amt <= 0) { Alert.alert('Monto inválido'); return; }
    if (actionType === 'deposit') {
      await deposit(actionGoal.id, amt);
    } else {
      await withdraw(actionGoal.id, amt);
    }
    setActionGoal(null);
    setActionAmount('');
  };

  const handleDelete = (goal: SavingsGoal) => {
    Alert.alert('Eliminar meta', `¿Eliminar "${goal.title}"?`, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Eliminar', style: 'destructive', onPress: () => remove(goal.id) },
    ]);
  };

  const totalSaved = goals.reduce((acc, g) => acc + g.currentAmount, 0);
  const completed = goals.filter(g => g.completed).length;

  const renderGoal = ({ item, index }: { item: SavingsGoal; index: number }) => {
    const pct = item.targetAmount > 0 ? item.currentAmount / item.targetAmount : 0;
    const pctDisplay = Math.round(pct * 100);
    const remaining = item.targetAmount - item.currentAmount;

    return (
      <Animated.View entering={FadeInDown.delay(index * 80).duration(350)} style={s.card}>
        <View style={s.cardTop}>
          <View style={s.cardLeft}>
            <Text style={s.cardEmoji}>{item.emoji}</Text>
            <View>
              <Text style={s.cardTitle}>{item.title}</Text>
              {item.deadline ? (
                <Text style={s.cardDeadline}>Meta: {item.deadline}</Text>
              ) : null}
            </View>
          </View>
          <View style={s.cardTopRight}>
            {item.completed && (
              <View style={s.completedBadge}>
                <Icon name="check-circle" size={14} color={colors.primary} />
                <Text style={s.completedText}>¡Lograda!</Text>
              </View>
            )}
            <Pressable onPress={() => handleDelete(item)} hitSlop={8}>
              <Icon name="trash-can-outline" size={18} color={colors.danger} />
            </Pressable>
          </View>
        </View>

        {/* Progress bar */}
        <View style={s.progressBg}>
          <View style={[s.progressFill, { width: `${Math.min(pctDisplay, 100)}%` as any,
            backgroundColor: item.completed ? colors.primary : pct > 0.7 ? colors.primary : pct > 0.4 ? '#F59E0B' : '#3B82F6' }]} />
        </View>

        <View style={s.cardAmounts}>
          <Text style={s.savedAmount}>{formatCurrency(item.currentAmount)}</Text>
          <Text style={s.pctText}>{pctDisplay}%</Text>
          <Text style={s.targetAmount}>de {formatCurrency(item.targetAmount)}</Text>
        </View>

        {!item.completed && (
          <Text style={s.remainingText}>Faltan {formatCurrency(remaining)}</Text>
        )}

        {!item.completed && (
          <View style={s.cardButtons}>
            <Pressable
              style={[s.actionBtn, s.depositBtn]}
              onPress={() => { setActionGoal(item); setActionType('deposit'); setActionAmount(''); }}
            >
              <Icon name="plus" size={16} color={colors.white} />
              <Text style={s.actionBtnText}>Abonar</Text>
            </Pressable>
            <Pressable
              style={[s.actionBtn, s.withdrawBtn]}
              onPress={() => { setActionGoal(item); setActionType('withdraw'); setActionAmount(''); }}
            >
              <Icon name="minus" size={16} color={colors.text} />
              <Text style={[s.actionBtnText, { color: colors.text }]}>Retirar</Text>
            </Pressable>
          </View>
        )}
      </Animated.View>
    );
  };

  return (
    <ScreenContainer>
      {/* Summary */}
      <View style={s.summary}>
        <View style={s.summaryItem}>
          <Text style={s.summaryValue}>{formatCurrency(totalSaved)}</Text>
          <Text style={s.summaryLabel}>Total ahorrado</Text>
        </View>
        <View style={s.summaryDivider} />
        <View style={s.summaryItem}>
          <Text style={s.summaryValue}>{goals.length}</Text>
          <Text style={s.summaryLabel}>Metas activas</Text>
        </View>
        <View style={s.summaryDivider} />
        <View style={s.summaryItem}>
          <Text style={[s.summaryValue, { color: colors.primary }]}>{completed}</Text>
          <Text style={s.summaryLabel}>Logradas</Text>
        </View>
      </View>

      {/* Add button */}
      <Pressable style={s.addBtn} onPress={() => setShowForm(v => !v)}>
        <Icon name={showForm ? 'close' : 'plus'} size={18} color={colors.white} />
        <Text style={s.addBtnText}>{showForm ? 'Cancelar' : 'Nueva meta'}</Text>
      </Pressable>

      {/* Form */}
      {showForm && (
        <Animated.View entering={FadeInDown.duration(300)} style={s.form}>
          <Text style={s.formTitle}>Nueva meta de ahorro</Text>

          <Text style={s.label}>Emoji</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.emojiRow}>
            {EMOJIS.map(e => (
              <Pressable
                key={e}
                style={[s.emojiBtn, emoji === e && s.emojiBtnActive]}
                onPress={() => setEmoji(e)}
              >
                <Text style={s.emojiText}>{e}</Text>
              </Pressable>
            ))}
          </ScrollView>

          <TextInput
            style={s.input}
            placeholder="Nombre de la meta (ej: Viaje a Japón)"
            placeholderTextColor={colors.textMuted}
            value={title}
            onChangeText={setTitle}
          />
          <TextInput
            style={s.input}
            placeholder="Monto objetivo (MXN)"
            placeholderTextColor={colors.textMuted}
            value={target}
            onChangeText={setTarget}
            keyboardType="decimal-pad"
          />
          <DateField
            value={deadline}
            onChange={setDeadline}
            placeholder="Fecha límite (opcional)"
            optional
          />

          <View style={s.formButtons}>
            <Pressable style={s.cancelBtn} onPress={resetForm}>
              <Text style={s.cancelText}>Cancelar</Text>
            </Pressable>
            <Pressable style={s.saveBtn} onPress={handleAdd}>
              <Text style={s.saveText}>Crear meta</Text>
            </Pressable>
          </View>
        </Animated.View>
      )}

      {/* Deposit/Withdraw modal */}
      {actionGoal && (
        <View style={s.actionModal}>
          <Text style={s.actionTitle}>
            {actionType === 'deposit' ? 'Abonar a' : 'Retirar de'} {actionGoal.emoji} {actionGoal.title}
          </Text>
          <TextInput
            style={s.input}
            placeholder="Monto (MXN)"
            placeholderTextColor={colors.textMuted}
            value={actionAmount}
            onChangeText={setActionAmount}
            keyboardType="decimal-pad"
            autoFocus
          />
          <View style={s.formButtons}>
            <Pressable style={s.cancelBtn} onPress={() => setActionGoal(null)}>
              <Text style={s.cancelText}>Cancelar</Text>
            </Pressable>
            <Pressable style={[s.saveBtn, actionType === 'withdraw' && s.withdrawSaveBtn]} onPress={handleAction}>
              <Text style={s.saveText}>{actionType === 'deposit' ? 'Abonar' : 'Retirar'}</Text>
            </Pressable>
          </View>
        </View>
      )}

      {/* Goals list */}
      {goals.length === 0 && !showForm ? (
        <View style={s.empty}>
          <Text style={s.emptyEmoji}>🎯</Text>
          <Text style={s.emptyTitle}>Sin metas de ahorro</Text>
          <Text style={s.emptySub}>Define una meta y lleva el control de tu ahorro mes a mes.</Text>
        </View>
      ) : (
        <FlatList
          data={goals}
          keyExtractor={g => g.id}
          renderItem={renderGoal}
          contentContainerStyle={s.list}
          showsVerticalScrollIndicator={false}
        />
      )}
    </ScreenContainer>
  );
}

const useStyles = (colors: ColorPalette) =>
  StyleSheet.create({
    summary: {
      flexDirection: 'row',
      backgroundColor: colors.surface,
      borderRadius: 18,
      padding: 16,
      marginBottom: 14,
      borderWidth: 1,
      borderColor: colors.border,
    },
    summaryItem: { flex: 1, alignItems: 'center', gap: 4 },
    summaryValue: { color: colors.text, fontSize: 20, fontFamily: font.extrabold },
    summaryLabel: { color: colors.textMuted, fontSize: 11 },
    summaryDivider: { width: 1, backgroundColor: colors.border, marginVertical: 4 },
    addBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      backgroundColor: colors.primary,
      borderRadius: 14,
      paddingVertical: 12,
      paddingHorizontal: 18,
      alignSelf: 'flex-start',
      marginBottom: 14,
    },
    addBtnText: { color: colors.white, fontFamily: font.bold, fontSize: 14 },
    form: {
      backgroundColor: colors.surface,
      borderRadius: 18,
      padding: 18,
      marginBottom: 14,
      gap: 12,
      borderWidth: 1,
      borderColor: colors.border,
    },
    formTitle: { color: colors.text, fontSize: 16, fontFamily: font.extrabold },
    label: { color: colors.textMuted, fontSize: 12, fontFamily: font.semibold },
    emojiRow: { marginHorizontal: -4 },
    emojiBtn: {
      width: 42,
      height: 42,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
      marginHorizontal: 4,
      backgroundColor: colors.background,
      borderWidth: 1,
      borderColor: colors.border,
    },
    emojiBtnActive: { borderColor: colors.primary, backgroundColor: colors.primary + '20' },
    emojiText: { fontSize: 22 },
    input: {
      backgroundColor: colors.background,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 13,
      fontSize: 15,
      color: colors.text,
    },
    formButtons: { flexDirection: 'row', gap: 10 },
    cancelBtn: {
      flex: 1,
      padding: 14,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: 'center',
    },
    cancelText: { color: colors.textMuted, fontFamily: font.bold },
    saveBtn: {
      flex: 2,
      padding: 14,
      borderRadius: 14,
      backgroundColor: colors.primary,
      alignItems: 'center',
    },
    withdrawSaveBtn: { backgroundColor: colors.danger },
    saveText: { color: colors.white, fontFamily: font.extrabold, fontSize: 15 },
    // Action modal
    actionModal: {
      backgroundColor: colors.surface,
      borderRadius: 18,
      padding: 18,
      marginBottom: 14,
      gap: 12,
      borderWidth: 1,
      borderColor: colors.primary + '40',
    },
    actionTitle: { color: colors.text, fontSize: 15, fontFamily: font.bold },
    // Card
    list: { gap: 12, paddingBottom: 40 },
    card: {
      backgroundColor: colors.surface,
      borderRadius: 18,
      padding: 16,
      gap: 10,
      borderWidth: 1,
      borderColor: colors.border,
    },
    cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    cardTopRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    cardLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    cardEmoji: { fontSize: 32 },
    cardTitle: { color: colors.text, fontSize: 16, fontFamily: font.bold },
    cardDeadline: { color: colors.textMuted, fontSize: 11, marginTop: 2 },
    completedBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      backgroundColor: colors.primary + '20',
      borderRadius: 20,
      paddingHorizontal: 10,
      paddingVertical: 4,
    },
    completedText: { color: colors.primary, fontSize: 12, fontFamily: font.bold },
    progressBg: {
      height: 8,
      backgroundColor: colors.border,
      borderRadius: 4,
      overflow: 'hidden',
    },
    progressFill: { height: '100%', borderRadius: 4 },
    cardAmounts: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    savedAmount: { color: colors.text, fontSize: 17, fontFamily: font.extrabold },
    pctText: { color: colors.textMuted, fontSize: 12 },
    targetAmount: { color: colors.textMuted, fontSize: 13, flex: 1, textAlign: 'right' },
    remainingText: { color: colors.textMuted, fontSize: 12 },
    cardButtons: { flexDirection: 'row', gap: 8 },
    actionBtn: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      paddingVertical: 10,
      borderRadius: 12,
    },
    depositBtn: { backgroundColor: colors.primary },
    withdrawBtn: { backgroundColor: colors.border },
    actionBtnText: { color: colors.white, fontFamily: font.bold, fontSize: 13 },
    // Empty
    empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, paddingHorizontal: 32 },
    emptyEmoji: { fontSize: 56 },
    emptyTitle: { color: colors.text, fontSize: 20, fontFamily: font.extrabold, textAlign: 'center' },
    emptySub: { color: colors.textMuted, fontSize: 14, textAlign: 'center', lineHeight: 20 },
  });
