import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
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
import { ScreenContainer } from '../components/ScreenContainer';
import { SplitParticipant, useSplitStore } from '../store/useSplitStore';
import { ColorPalette } from '../theme/colors';
import { font } from '../theme/typography';
import { useTheme } from '../theme/ThemeContext';
import { formatCurrency, localDateString } from '../utils/format';

// ─────────────────────────────────────────────────────────
// New Split Modal
// ─────────────────────────────────────────────────────────

interface NewSplitModalProps {
  visible: boolean;
  onClose: () => void;
  colors: ColorPalette;
  isDark: boolean;
}

function NewSplitModal({ visible, onClose, colors, isDark }: NewSplitModalProps) {
  const s = useModalStyles(colors, isDark);
  const addSplit = useSplitStore(state => state.addSplit);

  const [description, setDescription] = useState('');
  const [totalInput, setTotalInput] = useState('');
  const [participantInput, setParticipantInput] = useState('');
  const [participants, setParticipants] = useState<string[]>([]);

  const total = parseFloat(totalInput.replace(/,/g, '.')) || 0;
  const sharePerPerson = participants.length > 0 ? total / participants.length : 0;

  const addParticipant = () => {
    const name = participantInput.trim();
    if (!name) return;
    if (participants.includes(name)) {
      Alert.alert('Duplicado', 'Ya existe un participante con ese nombre.');
      return;
    }
    setParticipants(prev => [...prev, name]);
    setParticipantInput('');
  };

  const removeParticipant = (name: string) => {
    setParticipants(prev => prev.filter(p => p !== name));
  };

  const handleSave = async () => {
    if (!description.trim()) {
      Alert.alert('Error', 'Agrega una descripción.');
      return;
    }
    if (total <= 0) {
      Alert.alert('Error', 'Ingresa un monto mayor a 0.');
      return;
    }
    if (participants.length < 2) {
      Alert.alert('Error', 'Agrega al menos 2 participantes.');
      return;
    }

    const participantList: SplitParticipant[] = participants.map(name => ({
      name,
      amount: sharePerPerson,
      paid: false,
    }));

    await addSplit({
      description: description.trim(),
      totalAmount: total,
      date: localDateString(new Date()),
      participants: participantList,
    });

    // Reset
    setDescription('');
    setTotalInput('');
    setParticipantInput('');
    setParticipants([]);
    onClose();
  };

  const handleClose = () => {
    setDescription('');
    setTotalInput('');
    setParticipantInput('');
    setParticipants([]);
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={handleClose}>
      <KeyboardAvoidingView
        style={s.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <Pressable style={s.backdrop} onPress={handleClose} />
        <View style={s.sheet}>
          {/* Header */}
          <View style={s.sheetHeader}>
            <Text style={s.sheetTitle}>Nuevo split</Text>
            <Pressable onPress={handleClose} hitSlop={10}>
              <Icon name="close" size={22} color={colors.textMuted} />
            </Pressable>
          </View>

          {/* Description */}
          <View style={s.field}>
            <Text style={s.fieldLabel}>Descripción</Text>
            <TextInput
              style={s.fieldInput}
              value={description}
              onChangeText={setDescription}
              placeholder="Ej. Cena de cumpleaños"
              placeholderTextColor={colors.textMuted}
            />
          </View>

          {/* Total */}
          <View style={s.field}>
            <Text style={s.fieldLabel}>Monto total</Text>
            <View style={s.amountRow}>
              <Text style={s.currencySign}>$</Text>
              <TextInput
                style={[s.fieldInput, s.amountInput]}
                value={totalInput}
                onChangeText={setTotalInput}
                keyboardType="decimal-pad"
                placeholder="0.00"
                placeholderTextColor={colors.textMuted}
              />
              <Text style={s.mxnLabel}>MXN</Text>
            </View>
          </View>

          {/* Participants */}
          <View style={s.field}>
            <Text style={s.fieldLabel}>Participantes</Text>
            <View style={s.participantInputRow}>
              <TextInput
                style={[s.fieldInput, { flex: 1 }]}
                value={participantInput}
                onChangeText={setParticipantInput}
                placeholder="Nombre del participante"
                placeholderTextColor={colors.textMuted}
                onSubmitEditing={addParticipant}
                returnKeyType="done"
              />
              <Pressable style={s.addBtn} onPress={addParticipant}>
                <Icon name="plus" size={18} color={colors.white} />
              </Pressable>
            </View>
            {participants.length > 0 ? (
              <View style={s.participantList}>
                {participants.map(name => (
                  <View key={name} style={s.participantChip}>
                    <Text style={s.participantName}>{name}</Text>
                    {total > 0 ? (
                      <Text style={s.participantShare}>{formatCurrency(sharePerPerson)}</Text>
                    ) : null}
                    <Pressable onPress={() => removeParticipant(name)} hitSlop={8}>
                      <Icon name="close-circle" size={16} color={colors.textMuted} />
                    </Pressable>
                  </View>
                ))}
              </View>
            ) : null}
          </View>

          {/* Share preview */}
          {participants.length >= 2 && total > 0 ? (
            <View style={s.previewRow}>
              <Icon name="equal-box" size={16} color={colors.primary} />
              <Text style={s.previewText}>
                Cada persona paga {formatCurrency(sharePerPerson)}
              </Text>
            </View>
          ) : null}

          {/* Save */}
          <Pressable style={s.saveBtn} onPress={handleSave}>
            <Icon name="content-save-outline" size={18} color={colors.white} />
            <Text style={s.saveBtnText}>Guardar split</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ─────────────────────────────────────────────────────────
// Main Screen
// ─────────────────────────────────────────────────────────

export function SplitScreen() {
  const { colors, isDark } = useTheme();
  const s = useStyles(colors, isDark);
  const splits = useSplitStore(state => state.splits);
  const hydrate = useSplitStore(state => state.hydrate);
  const loaded = useSplitStore(state => state.loaded);
  const removeSplit = useSplitStore(state => state.removeSplit);
  const markPaid = useSplitStore(state => state.markPaid);

  const [modalVisible, setModalVisible] = useState(false);

  useEffect(() => {
    if (!loaded) hydrate();
  }, [loaded, hydrate]);

  const handleDelete = (id: string, description: string) => {
    Alert.alert(
      'Eliminar split',
      `¿Eliminar "${description}"?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Eliminar', style: 'destructive', onPress: () => removeSplit(id) },
      ],
    );
  };

  const paidCount = (participants: { paid: boolean }[]) =>
    participants.filter(p => p.paid).length;

  return (
    <>
      <ScreenContainer>
        {/* Header */}
        <Animated.View entering={FadeInDown.duration(300)} style={s.topRow}>
          <View>
            <Text style={s.screenTitle}>Dividir gastos</Text>
            <Text style={s.screenSub}>Divide cuentas y lleva el control de quién pagó</Text>
          </View>
          <Pressable style={s.newBtn} onPress={() => setModalVisible(true)}>
            <Icon name="plus" size={18} color={colors.white} />
            <Text style={s.newBtnText}>Nuevo</Text>
          </Pressable>
        </Animated.View>

        {splits.length === 0 ? (
          <Animated.View entering={FadeInDown.delay(60).duration(300)} style={s.emptyWrap}>
            <Icon name="account-group-outline" size={56} color={colors.border} />
            <Text style={s.emptyTitle}>Sin splits activos</Text>
            <Text style={s.emptyText}>
              Toca "+ Nuevo" para dividir un gasto entre amigos o familia.
            </Text>
            <Pressable style={s.emptyBtn} onPress={() => setModalVisible(true)}>
              <Icon name="plus" size={18} color={colors.white} />
              <Text style={s.emptyBtnText}>Crear primer split</Text>
            </Pressable>
          </Animated.View>
        ) : (
          splits.map((split, idx) => {
            const paid = paidCount(split.participants);
            const allPaid = paid === split.participants.length;
            return (
              <Animated.View
                key={split.id}
                entering={FadeInDown.delay(idx * 50).duration(300)}
              >
                <View style={[s.splitCard, allPaid && s.splitCardDone]}>
                  {/* Card header */}
                  <View style={s.cardHeader}>
                    <View style={s.cardTitleRow}>
                      <Icon
                        name={allPaid ? 'check-circle' : 'account-group-outline'}
                        size={20}
                        color={allPaid ? '#22C55E' : colors.primary}
                      />
                      <View style={s.cardTitleBlock}>
                        <Text style={s.cardTitle}>{split.description}</Text>
                        <Text style={s.cardDate}>{split.date}</Text>
                      </View>
                    </View>
                    <View style={s.cardRight}>
                      <Text style={s.cardTotal}>{formatCurrency(split.totalAmount)}</Text>
                      <Pressable
                        onPress={() => handleDelete(split.id, split.description)}
                        hitSlop={10}
                      >
                        <Icon name="delete-outline" size={20} color={colors.danger} />
                      </Pressable>
                    </View>
                  </View>

                  {/* Progress */}
                  <View style={s.progressRow}>
                    <View style={s.progressTrack}>
                      <View
                        style={[
                          s.progressFill,
                          {
                            width: `${(paid / split.participants.length) * 100}%`,
                            backgroundColor: allPaid ? '#22C55E' : colors.primary,
                          },
                        ]}
                      />
                    </View>
                    <Text style={s.progressLabel}>
                      {paid}/{split.participants.length} pagaron
                    </Text>
                  </View>

                  {/* Participants */}
                  <View style={s.participantsBlock}>
                    {split.participants.map(participant => (
                      <Pressable
                        key={participant.name}
                        style={s.participantRow}
                        onPress={() => markPaid(split.id, participant.name)}
                      >
                        <View style={[s.checkbox, participant.paid && s.checkboxDone]}>
                          {participant.paid ? (
                            <Icon name="check" size={12} color={colors.white} />
                          ) : null}
                        </View>
                        <Text
                          style={[
                            s.participantNameText,
                            participant.paid && s.participantPaid,
                          ]}
                        >
                          {participant.name}
                        </Text>
                        <Text
                          style={[
                            s.participantAmountText,
                            participant.paid && s.participantPaid,
                          ]}
                        >
                          {formatCurrency(participant.amount)}
                        </Text>
                        <View
                          style={[
                            s.statusBadge,
                            { backgroundColor: participant.paid ? '#22C55E18' : colors.surfaceAlt },
                          ]}
                        >
                          <Text
                            style={[
                              s.statusBadgeText,
                              { color: participant.paid ? '#22C55E' : colors.textMuted },
                            ]}
                          >
                            {participant.paid ? 'Pagado' : 'Pendiente'}
                          </Text>
                        </View>
                      </Pressable>
                    ))}
                  </View>

                  {allPaid ? (
                    <View style={s.allPaidBanner}>
                      <Icon name="check-circle" size={14} color="#22C55E" />
                      <Text style={s.allPaidText}>Todos han pagado</Text>
                    </View>
                  ) : null}
                </View>
              </Animated.View>
            );
          })
        )}

        <View style={{ height: 32 }} />
      </ScreenContainer>

      <NewSplitModal
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
        colors={colors}
        isDark={isDark}
      />
    </>
  );
}

// ─────────────────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────────────────

const useStyles = (colors: ColorPalette, _isDark: boolean) =>
  StyleSheet.create({
    topRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
    },
    screenTitle: {
      color: colors.text,
      fontSize: 22,
      fontFamily: font.extrabold,
    },
    screenSub: {
      color: colors.textMuted,
      fontSize: 13,
      marginTop: 2,
    },
    newBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      backgroundColor: colors.primary,
      paddingHorizontal: 16,
      paddingVertical: 10,
      borderRadius: 14,
    },
    newBtnText: {
      color: colors.white,
      fontFamily: font.bold,
      fontSize: 14,
    },
    emptyWrap: {
      alignItems: 'center',
      gap: 12,
      paddingTop: 48,
      paddingBottom: 24,
    },
    emptyTitle: {
      color: colors.text,
      fontSize: 18,
      fontFamily: font.bold,
    },
    emptyText: {
      color: colors.textMuted,
      fontSize: 14,
      textAlign: 'center',
      lineHeight: 22,
      paddingHorizontal: 16,
    },
    emptyBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      backgroundColor: colors.primary,
      paddingHorizontal: 24,
      paddingVertical: 12,
      borderRadius: 14,
      marginTop: 8,
    },
    emptyBtnText: {
      color: colors.white,
      fontFamily: font.bold,
      fontSize: 14,
    },
    splitCard: {
      backgroundColor: colors.surface,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 16,
      gap: 12,
    },
    splitCardDone: {
      borderColor: '#22C55E44',
    },
    cardHeader: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
    },
    cardTitleRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 10,
      flex: 1,
    },
    cardTitleBlock: {
      flex: 1,
      gap: 2,
    },
    cardTitle: {
      color: colors.text,
      fontSize: 16,
      fontFamily: font.bold,
    },
    cardDate: {
      color: colors.textMuted,
      fontSize: 12,
    },
    cardRight: {
      alignItems: 'flex-end',
      gap: 8,
    },
    cardTotal: {
      color: colors.primary,
      fontSize: 16,
      fontFamily: font.extrabold,
    },
    progressRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    progressTrack: {
      flex: 1,
      height: 6,
      backgroundColor: colors.surfaceAlt,
      borderRadius: 3,
      overflow: 'hidden',
    },
    progressFill: {
      height: 6,
      borderRadius: 3,
    },
    progressLabel: {
      color: colors.textMuted,
      fontSize: 12,
      fontFamily: font.semibold,
    },
    participantsBlock: {
      gap: 2,
    },
    participantRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      paddingVertical: 8,
      borderRadius: 12,
    },
    checkbox: {
      width: 22,
      height: 22,
      borderRadius: 6,
      borderWidth: 2,
      borderColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    checkboxDone: {
      backgroundColor: '#22C55E',
      borderColor: '#22C55E',
    },
    participantNameText: {
      flex: 1,
      color: colors.text,
      fontSize: 14,
      fontFamily: font.semibold,
    },
    participantPaid: {
      opacity: 0.5,
      textDecorationLine: 'line-through',
    },
    participantAmountText: {
      color: colors.text,
      fontSize: 14,
      fontFamily: font.bold,
    },
    statusBadge: {
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 8,
    },
    statusBadgeText: {
      fontSize: 11,
      fontFamily: font.bold,
    },
    allPaidBanner: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      backgroundColor: '#22C55E18',
      borderRadius: 10,
      paddingHorizontal: 12,
      paddingVertical: 8,
    },
    allPaidText: {
      color: '#22C55E',
      fontSize: 13,
      fontFamily: font.bold,
    },
  });

const useModalStyles = (colors: ColorPalette, _isDark: boolean) =>
  StyleSheet.create({
    overlay: {
      flex: 1,
      justifyContent: 'flex-end',
    },
    backdrop: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: 'rgba(0,0,0,0.5)',
    },
    sheet: {
      backgroundColor: colors.surface,
      borderTopLeftRadius: 28,
      borderTopRightRadius: 28,
      padding: 24,
      paddingBottom: Platform.OS === 'ios' ? 40 : 24,
      gap: 16,
    },
    sheetHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    sheetTitle: {
      color: colors.text,
      fontSize: 20,
      fontFamily: font.extrabold,
    },
    field: {
      gap: 8,
    },
    fieldLabel: {
      color: colors.text,
      fontSize: 14,
      fontFamily: font.bold,
    },
    fieldInput: {
      backgroundColor: colors.surfaceAlt,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 12,
      paddingHorizontal: 14,
      paddingVertical: 12,
      color: colors.text,
      fontSize: 16,
    },
    amountRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    currencySign: {
      color: colors.primary,
      fontSize: 20,
      fontFamily: font.extrabold,
    },
    amountInput: {
      flex: 1,
      fontSize: 20,
      fontFamily: font.extrabold,
    },
    mxnLabel: {
      color: colors.textMuted,
      fontSize: 14,
      fontFamily: font.semibold,
    },
    participantInputRow: {
      flexDirection: 'row',
      gap: 8,
    },
    addBtn: {
      backgroundColor: colors.primary,
      width: 44,
      height: 44,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
    },
    participantList: {
      gap: 6,
    },
    participantChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      backgroundColor: colors.primary + '12',
      borderRadius: 10,
      paddingHorizontal: 12,
      paddingVertical: 8,
    },
    participantName: {
      flex: 1,
      color: colors.text,
      fontSize: 14,
      fontFamily: font.semibold,
    },
    participantShare: {
      color: colors.primary,
      fontSize: 14,
      fontFamily: font.bold,
    },
    previewRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      backgroundColor: colors.primary + '0F',
      borderRadius: 12,
      padding: 12,
    },
    previewText: {
      color: colors.primary,
      fontSize: 13,
      fontFamily: font.bold,
    },
    saveBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      backgroundColor: colors.primary,
      paddingVertical: 16,
      borderRadius: 16,
    },
    saveBtnText: {
      color: colors.white,
      fontSize: 15,
      fontFamily: font.bold,
    },
  });
