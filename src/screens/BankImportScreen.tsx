import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { PaywallModal } from '../components/PaywallModal';
import { ScreenContainer } from '../components/ScreenContainer';
import { BankTransaction, importBankStatement } from '../services/bankStatementService';
import { useExpenseStore } from '../store/useExpenseStore';
import { usePremiumStore } from '../store/usePremiumStore';
import { ColorPalette } from '../theme/colors';
import { useTheme } from '../theme/ThemeContext';
import { formatCurrency } from '../utils/format';
import { classifyExpense } from '../utils/classifier';

export function BankImportScreen() {
  const { colors, isDark } = useTheme();
  const s = useStyles(colors, isDark);
  const addExpense = useExpenseStore(state => state.addExpense);
  const hasFullAccess = usePremiumStore(state => state.hasFullAccess);

  const [loading, setLoading] = useState(false);
  const [transactions, setTransactions] = useState<BankTransaction[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [importing, setImporting] = useState(false);
  const [done, setDone] = useState(false);
  const [importedCount, setImportedCount] = useState(0);
  const [paywallVisible, setPaywallVisible] = useState(false);

  if (!hasFullAccess()) {
    return (
      <ScreenContainer>
        <View style={s.locked}>
          <Icon name="bank-transfer-in" size={56} color={colors.border} />
          <Text style={s.lockedTitle}>Función Premium</Text>
          <Text style={s.lockedDesc}>
            Importa tus estados de cuenta bancarios y detecta gastos automáticamente.
          </Text>
          <Pressable style={s.lockedBtn} onPress={() => setPaywallVisible(true)}>
            <Icon name="arrow-up-bold" size={18} color="#fff" />
            <Text style={s.lockedBtnText}>Desbloquear con Pro</Text>
          </Pressable>
        </View>
        <PaywallModal
          visible={paywallVisible}
          onClose={() => setPaywallVisible(false)}
          trigger="export"
        />
      </ScreenContainer>
    );
  }

  const handlePickPDF = async () => {
    setLoading(true);
    setTransactions([]);
    setSelected(new Set());
    setDone(false);
    try {
      const txs = await importBankStatement();
      // Pre-select only debits (expenses)
      const preSelected = new Set(
        txs.map((_, i) => i).filter(i => txs[i].isDebit),
      );
      setTransactions(txs);
      setSelected(preSelected);
    } catch (err: any) {
      if (err?.message !== 'CANCELLED') {
        Alert.alert('Error', err instanceof Error ? err.message : 'No se pudo leer el estado de cuenta.');
      }
    } finally {
      setLoading(false);
    }
  };

  const toggleSelect = (idx: number) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  };

  const selectAll = () => setSelected(new Set(transactions.map((_, i) => i)));
  const selectNone = () => setSelected(new Set());

  const handleImport = async () => {
    if (selected.size === 0) {
      Alert.alert('Sin selección', 'Selecciona al menos una transacción para importar.');
      return;
    }
    setImporting(true);
    let count = 0;
    for (const idx of selected) {
      const tx = transactions[idx];
      if (!tx) continue;
      try {
        await addExpense({
          amount: tx.amount,
          date: tx.date,
          category: classifyExpense(tx.description),
          description: tx.description,
          merchantName: '',
          conceptsText: '',
          ocrRawText: '',
          deductible: false,
          rfc: '',
          usoCFDI: '',
          source: 'manual',
          receiptImageUri: '',
        });
        count++;
      } catch {
        // continue
      }
    }
    setImportedCount(count);
    setImporting(false);
    setDone(true);
  };

  if (done) {
    return (
      <ScreenContainer>
        <View style={s.doneWrap}>
          <View style={s.doneIconCircle}>
            <Icon name="check-circle" size={48} color={colors.primary} />
          </View>
          <Text style={s.doneTitle}>¡Importación completa!</Text>
          <Text style={s.doneText}>
            Se importaron {importedCount} gasto{importedCount !== 1 ? 's' : ''} desde tu estado de cuenta.
          </Text>
          <Pressable style={s.doneBtn} onPress={() => {
            setTransactions([]);
            setSelected(new Set());
            setDone(false);
          }}>
            <Text style={s.doneBtnText}>Importar otro estado</Text>
          </Pressable>
        </View>
      </ScreenContainer>
    );
  }

  return (
    <View style={s.flex}>
      <ScreenContainer>
        {transactions.length === 0 ? (
          /* ── Landing / instructions ── */
          <>
            <View style={s.hero}>
              <View style={s.heroIcon}>
                <Icon name="bank-outline" size={36} color={colors.primary} />
              </View>
              <Text style={s.heroTitle}>Importar estado de cuenta</Text>
              <Text style={s.heroText}>
                Descarga el PDF de tu banco y súbelo aquí. Expensia detecta las transacciones
                automáticamente y las agrega a tus gastos.
              </Text>
            </View>

            <View style={s.bankList}>
              {['BBVA', 'Banamex', 'Banorte', 'HSBC', 'Santander', 'Scotiabank'].map(bank => (
                <View key={bank} style={s.bankChip}>
                  <Icon name="check" size={12} color={colors.primary} />
                  <Text style={s.bankChipText}>{bank}</Text>
                </View>
              ))}
            </View>

            <View style={s.stepsCard}>
              {[
                { n: '1', text: 'Abre la app de tu banco y descarga tu estado de cuenta en PDF' },
                { n: '2', text: 'Regresa aquí y toca "Seleccionar PDF"' },
                { n: '3', text: 'Revisa las transacciones detectadas y selecciona las que quieres importar' },
              ].map(step => (
                <View key={step.n} style={s.stepRow}>
                  <View style={s.stepNum}>
                    <Text style={s.stepNumText}>{step.n}</Text>
                  </View>
                  <Text style={s.stepText}>{step.text}</Text>
                </View>
              ))}
            </View>

            <Pressable style={[s.pickBtn, loading && s.btnDisabled]} onPress={handlePickPDF} disabled={loading}>
              {loading ? (
                <ActivityIndicator color={colors.white} size="small" />
              ) : (
                <Icon name="file-pdf-box" size={20} color={colors.white} />
              )}
              <Text style={s.pickBtnText}>
                {loading ? 'Procesando PDF…' : 'Seleccionar PDF'}
              </Text>
            </Pressable>

            {loading ? (
              <Text style={s.loadingHint}>
                Leyendo el PDF puede tardar 15-30 segundos dependiendo del tamaño.
              </Text>
            ) : null}
          </>
        ) : (
          /* ── Review list ── */
          <>
            <View style={s.reviewHeader}>
              <View>
                <Text style={s.reviewTitle}>
                  {transactions.length} transacciones detectadas
                </Text>
                <Text style={s.reviewSub}>
                  {selected.size} seleccionadas para importar
                </Text>
              </View>
              <Pressable style={s.changePdfBtn} onPress={handlePickPDF}>
                <Icon name="refresh" size={16} color={colors.primary} />
              </Pressable>
            </View>

            <View style={s.selectRow}>
              <Pressable onPress={selectAll} style={s.selBtn}>
                <Text style={s.selBtnText}>Todas</Text>
              </Pressable>
              <Pressable onPress={selectNone} style={s.selBtn}>
                <Text style={s.selBtnText}>Ninguna</Text>
              </Pressable>
              <Text style={s.selHint}>Solo débitos pre-seleccionados</Text>
            </View>

            <FlatList
              data={transactions}
              keyExtractor={(_, i) => String(i)}
              scrollEnabled={false}
              renderItem={({ item, index }) => {
                const isSelected = selected.has(index);
                return (
                  <Pressable
                    style={[s.txRow, isSelected && s.txRowSelected]}
                    onPress={() => toggleSelect(index)}
                  >
                    <View style={[s.checkbox, isSelected && s.checkboxOn]}>
                      {isSelected ? <Icon name="check" size={14} color={colors.white} /> : null}
                    </View>
                    <View style={s.txInfo}>
                      <Text style={s.txDesc} numberOfLines={2}>{item.description}</Text>
                      <Text style={s.txDate}>{item.date}</Text>
                    </View>
                    <Text style={[s.txAmt, { color: item.isDebit ? colors.danger : colors.success }]}>
                      {item.isDebit ? '-' : '+'}{formatCurrency(item.amount)}
                    </Text>
                  </Pressable>
                );
              }}
              ItemSeparatorComponent={() => <View style={s.separator} />}
            />

            <Pressable
              style={[s.importBtn, (importing || selected.size === 0) && s.btnDisabled]}
              onPress={handleImport}
              disabled={importing || selected.size === 0}
            >
              {importing ? (
                <ActivityIndicator color={colors.white} size="small" />
              ) : (
                <Icon name="download" size={20} color={colors.white} />
              )}
              <Text style={s.importBtnText}>
                {importing ? 'Importando…' : `Importar ${selected.size} gasto${selected.size !== 1 ? 's' : ''}`}
              </Text>
            </Pressable>

            <View style={{ height: 24 }} />
          </>
        )}
      </ScreenContainer>
    </View>
  );
}

const useStyles = (colors: ColorPalette, isDark: boolean) =>
  StyleSheet.create({
    locked: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 16,
      paddingHorizontal: 32,
    },
    lockedTitle: {
      color: colors.text,
      fontSize: 22,
      fontWeight: '800',
      textAlign: 'center',
    },
    lockedDesc: {
      color: colors.textMuted,
      fontSize: 14,
      textAlign: 'center',
      lineHeight: 21,
    },
    lockedBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      backgroundColor: colors.primary,
      paddingVertical: 14,
      paddingHorizontal: 28,
      borderRadius: 16,
      marginTop: 8,
    },
    lockedBtnText: { color: '#fff', fontWeight: '800', fontSize: 15 },
    flex: { flex: 1 },

    // Landing
    hero: { alignItems: 'center', gap: 12, paddingVertical: 8 },
    heroIcon: {
      width: 80,
      height: 80,
      borderRadius: 40,
      backgroundColor: colors.primary + '15',
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 4,
    },
    heroTitle: { color: colors.text, fontSize: 22, fontWeight: '800', textAlign: 'center' },
    heroText: { color: colors.textMuted, textAlign: 'center', lineHeight: 22, fontSize: 14 },

    bankList: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
      justifyContent: 'center',
    },
    bankChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      backgroundColor: colors.primary + '12',
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: 999,
    },
    bankChipText: { color: colors.primary, fontSize: 12, fontWeight: '600' },

    stepsCard: {
      backgroundColor: isDark ? '#111111' : colors.surface,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: isDark ? '#1E1E1E' : colors.border,
      padding: 18,
      gap: 16,
    },
    stepRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
    stepNum: {
      width: 26,
      height: 26,
      borderRadius: 13,
      backgroundColor: colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
    },
    stepNumText: { color: colors.white, fontSize: 13, fontWeight: '800' },
    stepText: { flex: 1, color: colors.textMuted, fontSize: 14, lineHeight: 20 },

    pickBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      backgroundColor: colors.primary,
      paddingVertical: 16,
      borderRadius: 18,
    },
    pickBtnText: { color: colors.white, fontSize: 16, fontWeight: '700' },
    loadingHint: {
      color: colors.textMuted,
      fontSize: 12,
      textAlign: 'center',
    },
    btnDisabled: { opacity: 0.6 },

    // Review
    reviewHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    reviewTitle: { color: colors.text, fontSize: 18, fontWeight: '800' },
    reviewSub: { color: colors.textMuted, fontSize: 13, marginTop: 2 },
    changePdfBtn: {
      width: 38,
      height: 38,
      borderRadius: 19,
      backgroundColor: colors.primary + '15',
      alignItems: 'center',
      justifyContent: 'center',
    },

    selectRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    selBtn: {
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 999,
      backgroundColor: colors.surfaceAlt,
    },
    selBtnText: { color: colors.text, fontSize: 12, fontWeight: '600' },
    selHint: { flex: 1, color: colors.textMuted, fontSize: 11 },

    txRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingVertical: 12,
      paddingHorizontal: 14,
      backgroundColor: isDark ? '#111111' : colors.surface,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: isDark ? '#1E1E1E' : colors.border,
    },
    txRowSelected: {
      borderColor: colors.primary + '60',
      backgroundColor: colors.primary + '08',
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
    checkboxOn: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    txInfo: { flex: 1 },
    txDesc: { color: colors.text, fontSize: 13, fontWeight: '600' },
    txDate: { color: colors.textMuted, fontSize: 11, marginTop: 2 },
    txAmt: { fontSize: 14, fontWeight: '700' },
    separator: { height: 8 },

    importBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      backgroundColor: colors.primary,
      paddingVertical: 16,
      borderRadius: 18,
      marginTop: 8,
    },
    importBtnText: { color: colors.white, fontSize: 16, fontWeight: '700' },

    // Done
    doneWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16 },
    doneIconCircle: {
      width: 96,
      height: 96,
      borderRadius: 48,
      backgroundColor: colors.primary + '15',
      alignItems: 'center',
      justifyContent: 'center',
    },
    doneTitle: { color: colors.text, fontSize: 24, fontWeight: '800' },
    doneText: { color: colors.textMuted, textAlign: 'center', fontSize: 15, lineHeight: 22 },
    doneBtn: {
      backgroundColor: colors.surfaceAlt,
      paddingHorizontal: 24,
      paddingVertical: 12,
      borderRadius: 14,
    },
    doneBtnText: { color: colors.text, fontWeight: '700' },
  });
