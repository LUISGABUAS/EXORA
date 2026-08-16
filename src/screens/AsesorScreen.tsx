import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { PaywallModal } from '../components/PaywallModal';
import { ScreenContainer } from '../components/ScreenContainer';
import { useAuthStore } from '../store/useAuthStore';
import { useExpenseStore } from '../store/useExpenseStore';
import { useIncomeStore } from '../store/useIncomeStore';
import { usePremiumStore } from '../store/usePremiumStore';
import { useSavingsStore } from '../store/useSavingsStore';
import { useBudgetStore } from '../store/useBudgetStore';
import { useRecurringStore } from '../store/useRecurringStore';
import { supabase } from '../lib/supabase';
import { ColorPalette } from '../theme/colors';
import { font } from '../theme/typography';
import { useTheme } from '../theme/ThemeContext';
import { ExpenseCategory } from '../types/expense';
import { formatCurrency, localDateString } from '../utils/format';

const CACHE_KEY = '@exora_advisor_cache';
const CACHE_TTL = 6 * 60 * 60 * 1000; // 6 hours

const SUGGESTED_QUESTIONS_PERSONAL = [
  '¿En qué estoy gastando de más?',
  '¿Cuánto puedo deducir este mes?',
  '¿Cómo mejorar mi flujo de efectivo?',
  '¿Qué gastos puedo recortar?',
  '¿Estoy ahorrando suficiente?',
];

const SUGGESTED_QUESTIONS_EDUCATIONAL = [
  '¿Qué gastos son deducibles en México?',
  '¿Cómo funciona el régimen RESICO?',
  '¿Cuánto debería ahorrar de mi sueldo?',
  '¿Cómo empezar a controlar mis finanzas?',
  '¿Qué es el CFDI y para qué sirve?',
];

interface Section {
  icon: string;
  color: string;
  title: string;
  body: string;
  action?: string;
}

interface Analysis {
  headline?: string;
  score?: number;
  sections: Section[];
  topOpportunity?: string;
  fiscalAlert?: string | null;
  answer?: string;
  quickTips?: string[];
}

function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return localDateString(d);
}

export function AsesorScreen() {
  const { colors, isDark } = useTheme();
  const s = useStyles(colors, isDark);
  const session = useAuthStore(state => state.session);
  const hasFullAccess = usePremiumStore(state => state.hasFullAccess);
  const canAccess = hasFullAccess();
  const fiscalRegime = usePremiumStore(state => state.fiscalRegime);
  const razonSocial = usePremiumStore(state => state.razonSocial);
  const actividadEconomica = usePremiumStore(state => state.actividadEconomica);
  const financialGoals = usePremiumStore(state => state.financialGoals);
  const ageRange = usePremiumStore(state => state.ageRange);
  const expenses = useExpenseStore(state => state.expenses);
  const incomes = useIncomeStore(state => state.incomes);
  const hasFinancialData = expenses.length > 0 || incomes.length > 0;
  const savings = useSavingsStore(state => state.goals);
  const budgets = useBudgetStore(state => state.budgets);
  const recurring = useRecurringStore(state => state.items);

  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [question, setQuestion] = useState('');
  const [askMode, setAskMode] = useState(false);
  const [paywallVisible, setPaywallVisible] = useState(false);
  const inputRef = useRef<TextInput>(null);

  const buildPayload = useCallback((q?: string) => {
    const now = new Date();
    const today = localDateString(now);
    const thirtyAgo = daysAgo(30);
    const sixtyAgo = daysAgo(60);

    const recent = expenses.filter(e => e.date >= thirtyAgo && e.date <= today);
    const prev = expenses.filter(e => e.date >= sixtyAgo && e.date < thirtyAgo);

    const byCat = (list: typeof expenses) => {
      const map: Record<string, number> = {};
      list.forEach(e => { map[e.category] = (map[e.category] || 0) + e.amount; });
      return Object.entries(map).sort((a, b) => b[1] - a[1])
        .map(([cat, amt]) => `${cat}: ${formatCurrency(amt)}`).join(', ');
    };

    const byMerchant: Record<string, number> = {};
    recent.forEach(e => {
      const k = e.merchantName || e.description || e.category;
      byMerchant[k] = (byMerchant[k] || 0) + e.amount;
    });
    const topMerchants = Object.entries(byMerchant)
      .sort((a, b) => b[1] - a[1]).slice(0, 5)
      .map(([n, a]) => `${n}: ${formatCurrency(a)}`).join(', ');

    const monthPrefix = today.slice(0, 7);
    const prevPrefix = new Date(now.getFullYear(), now.getMonth() - 1, 1)
      .toISOString().slice(0, 7);

    const monthTotal = recent.reduce((s, e) => s + e.amount, 0);
    const prevMonthTotal = prev.reduce((s, e) => s + e.amount, 0);
    const monthIncome = incomes
      .filter(i => i.date.startsWith(monthPrefix))
      .reduce((s, i) => s + i.amount, 0);

    const deductibleTotal = recent.filter(e => e.deductible).reduce((s, e) => s + e.amount, 0);
    const nonDeductibleTotal = monthTotal - deductibleTotal;

    const recurringTotal = recurring.reduce((s, r) => s + r.amount, 0);

    const savingsGoals = savings.length > 0
      ? savings.map(g => `${g.emoji} ${g.title}: ${formatCurrency(g.currentAmount)}/${formatCurrency(g.targetAmount)}`).join(', ')
      : null;

    const budgetStr = Object.keys(budgets).length > 0
      ? Object.entries(budgets as Record<string, number>)
          .filter(([, v]) => (v as number) > 0)
          .map(([cat, limit]) => {
            const spent = recent.filter(e => e.category === cat).reduce((sum, e) => sum + e.amount, 0);
            return `${cat}: ${formatCurrency(spent)}/${formatCurrency(limit as number)}`;
          }).join(', ')
      : null;

    return {
      question: q,
      catSummary: byCat(recent),
      catPrevSummary: byCat(prev),
      topMerchants,
      monthTotal: monthTotal.toFixed(0),
      prevMonthTotal: prevMonthTotal.toFixed(0),
      monthIncome: monthIncome.toFixed(0),
      deductibleTotal: deductibleTotal.toFixed(0),
      nonDeductibleTotal: nonDeductibleTotal.toFixed(0),
      totalExpenses: recent.length,
      savingsGoals,
      budgets: budgetStr,
      recurringTotal: recurringTotal.toFixed(0),
      regime: fiscalRegime,
      razonSocial,
      actividadEconomica: actividadEconomica || null,
      financialGoals: financialGoals.length > 0 ? financialGoals.join(', ') : null,
      ageRange: ageRange || null,
    };
  }, [expenses, incomes, savings, budgets, recurring, fiscalRegime, razonSocial, actividadEconomica, financialGoals, ageRange]);

  const fetchAnalysis = useCallback(async (q?: string) => {
    if (!canAccess) { setPaywallVisible(true); return; }
    if (!session?.access_token) {
      setErrorMsg('Inicia sesión para usar el asesor.');
      return;
    }

    // Check cache for full analysis (not for questions)
    if (!q) {
      try {
        const cached = await AsyncStorage.getItem(CACHE_KEY);
        if (cached) {
          const { data, timestamp } = JSON.parse(cached);
          if (Date.now() - timestamp < CACHE_TTL) {
            setAnalysis(data);
            setErrorMsg(null);
            return;
          }
        }
      } catch {}
    }

    setLoading(true);
    setErrorMsg(null);
    try {
      const payload = buildPayload(q);
      const { data: json, error: fnError } = await supabase.functions.invoke(
        'financial-advisor',
        { body: payload },
      );

      if (fnError) {
        const raw = (fnError.message ?? '').toLowerCase();
        if (raw.includes('529') || raw.includes('overloaded')) {
          throw new Error('El servicio de IA está saturado. Intenta en unos minutos.');
        }
        if (raw.includes('402') || raw.includes('credit') || raw.includes('billing')) {
          throw new Error('El servicio de IA no está disponible por el momento.');
        }
        if (raw.includes('401') || raw.includes('unauthorized')) {
          throw new Error('Sesión expirada. Cierra sesión y vuelve a entrar.');
        }
        throw new Error('Sin conexión con el asesor. Verifica tu internet e intenta de nuevo.');
      }
      if (json?.analysis) {
        setAnalysis(json.analysis);
        setErrorMsg(null);
        if (!q) {
          await AsyncStorage.setItem(CACHE_KEY, JSON.stringify({
            data: json.analysis,
            timestamp: Date.now(),
          }));
        }
      } else {
        throw new Error('No se recibió análisis del servidor.');
      }
    } catch (e: any) {
      const msg = e?.message ?? 'Error al conectar con el asesor.';
      setErrorMsg(msg);
      console.warn('[Asesor]', e);
    } finally {
      setLoading(false);
    }
  }, [session, canAccess, buildPayload]);

  useEffect(() => {
    if (canAccess && expenses.length >= 3) {
      fetchAnalysis();
    }
  }, [canAccess]);

  const handleAsk = () => {
    if (!question.trim()) return;
    fetchAnalysis(question.trim());
    setQuestion('');
    setAskMode(false);
  };

  const scoreColor = (score?: number) => {
    if (!score) return colors.textMuted;
    if (score >= 8) return '#22C55E';
    if (score >= 6) return '#F59E0B';
    return '#EF4444';
  };

  if (!canAccess) {
    return (
      <ScreenContainer>
        <Animated.View entering={FadeIn.duration(400)} style={s.lockedWrap}>
          <View style={s.lockedGlow}>
            <Icon name="brain" size={48} color={colors.primary} />
          </View>
          <Text style={s.lockedTitle}>Asesor Financiero IA</Text>
          <Text style={s.lockedSub}>
            Análisis estratégico real basado en{'\n'}tus gastos, ingresos y régimen fiscal.
          </Text>

          <View style={s.featureList}>
            {[
              { icon: 'chart-line', text: '¿En qué gastas de más?' },
              { icon: 'cash-minus', text: 'Oportunidades de ahorro' },
              { icon: 'file-percent-outline', text: 'Optimización fiscal' },
              { icon: 'message-question-outline', text: 'Pregunta lo que quieras' },
            ].map(f => (
              <View key={f.icon} style={s.featureRow}>
                <Icon name={f.icon} size={18} color={colors.primary} />
                <Text style={s.featureText}>{f.text}</Text>
              </View>
            ))}
          </View>

          <Pressable style={s.unlockBtn} onPress={() => setPaywallVisible(true)}>
            <Icon name="arrow-up-bold" size={18} color="#fff" />
            <Text style={s.unlockBtnText}>Desbloquear con Pro</Text>
          </Pressable>

          <Text style={s.lockedNote}>
            Los usuarios Free pueden ver esta pantalla{'\n'}pero necesitan Pro para acceder al análisis.
          </Text>
        </Animated.View>

        <PaywallModal
          visible={paywallVisible}
          onClose={() => setPaywallVisible(false)}
          trigger="fiscal_report"
        />
      </ScreenContainer>
    );
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScreenContainer>
        {/* Header */}
        <Animated.View entering={FadeIn.duration(300)} style={s.header}>
          <View style={s.headerLeft}>
            <Icon name="brain" size={22} color={colors.primary} />
            <Text style={s.headerTitle}>Asesor Financiero</Text>
          </View>
          <Pressable style={s.refreshBtn} onPress={() => {
            AsyncStorage.removeItem(CACHE_KEY);
            fetchAnalysis();
          }}>
            <Icon name="refresh" size={18} color={colors.textMuted} />
          </Pressable>
        </Animated.View>

        {loading ? (
          <View style={s.loadingWrap}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={s.loadingText}>Analizando tus finanzas...</Text>
            <Text style={s.loadingSubtext}>Esto puede tardar unos segundos</Text>
          </View>
        ) : errorMsg ? (
          <View style={s.errorWrap}>
            <View style={s.errorIconWrap}>
              <Icon name="wifi-off" size={36} color={colors.danger} />
            </View>
            <Text style={s.errorTitle}>Asesor no disponible</Text>
            <Text style={s.errorText}>{errorMsg}</Text>
            <Pressable style={s.analyzeBtn} onPress={() => fetchAnalysis()}>
              <Icon name="refresh" size={16} color="#fff" />
              <Text style={s.analyzeBtnText}>Reintentar</Text>
            </Pressable>
          </View>
        ) : analysis ? (
          <>
            {/* Headline + Score */}
            {analysis.headline && (
              <Animated.View entering={FadeInDown.delay(50).duration(350)} style={s.headlineCard}>
                {analysis.score !== undefined && (
                  <View style={[s.scoreBadge, { backgroundColor: scoreColor(analysis.score) + '20' }]}>
                    <Text style={[s.scoreNum, { color: scoreColor(analysis.score) }]}>
                      {analysis.score}/10
                    </Text>
                    <Text style={[s.scoreLabel, { color: scoreColor(analysis.score) }]}>
                      salud financiera
                    </Text>
                  </View>
                )}
                <Text style={s.headline}>{analysis.headline}</Text>
              </Animated.View>
            )}

            {/* Answer (when question was asked) */}
            {analysis.answer && (
              <Animated.View entering={FadeInDown.delay(80).duration(350)} style={s.answerCard}>
                <Icon name="message-reply-text-outline" size={18} color={colors.primary} />
                <Text style={s.answerText}>{analysis.answer}</Text>
              </Animated.View>
            )}

            {/* Sections */}
            {analysis.sections?.map((sec, i) => (
              <Animated.View
                key={i}
                entering={FadeInDown.delay(100 + i * 60).duration(350)}
                style={[s.sectionCard, { borderLeftColor: sec.color, borderLeftWidth: 3 }]}
              >
                <View style={s.sectionHeader}>
                  <View style={[s.sectionIconWrap, { backgroundColor: sec.color + '18' }]}>
                    <Icon name={sec.icon} size={18} color={sec.color} />
                  </View>
                  <Text style={s.sectionTitle}>{sec.title}</Text>
                </View>
                <Text style={s.sectionBody}>{sec.body}</Text>
                {sec.action && (
                  <View style={s.actionChip}>
                    <Icon name="arrow-right-circle-outline" size={14} color={colors.primary} />
                    <Text style={s.actionText}>{sec.action}</Text>
                  </View>
                )}
              </Animated.View>
            ))}

            {/* Top Opportunity */}
            {analysis.topOpportunity && (
              <Animated.View entering={FadeInDown.delay(400).duration(350)} style={s.opportunityCard}>
                <Icon name="star-shooting-outline" size={20} color="#F59E0B" />
                <View style={{ flex: 1 }}>
                  <Text style={s.opportunityLabel}>Oportunidad esta semana</Text>
                  <Text style={s.opportunityText}>{analysis.topOpportunity}</Text>
                </View>
              </Animated.View>
            )}

            {/* Fiscal Alert */}
            {analysis.fiscalAlert && (
              <Animated.View entering={FadeInDown.delay(450).duration(350)} style={s.fiscalCard}>
                <Icon name="file-percent-outline" size={20} color="#8B5CF6" />
                <View style={{ flex: 1 }}>
                  <Text style={s.fiscalLabel}>Alerta fiscal</Text>
                  <Text style={s.fiscalText}>{analysis.fiscalAlert}</Text>
                </View>
              </Animated.View>
            )}

            {/* Quick Tips */}
            {analysis.quickTips && analysis.quickTips.length > 0 && (
              <Animated.View entering={FadeInDown.delay(500).duration(350)} style={s.tipsCard}>
                <Text style={s.tipsTitle}>Tips rápidos</Text>
                {analysis.quickTips.map((tip, i) => (
                  <View key={i} style={s.tipRow}>
                    <View style={s.tipDot} />
                    <Text style={s.tipText}>{tip}</Text>
                  </View>
                ))}
              </Animated.View>
            )}

            <View style={{ height: 24 }} />
          </>
        ) : (
          <View style={s.emptyWrap}>
            <Icon name={hasFinancialData ? 'chart-line' : 'school-outline'} size={48} color={colors.border} />
            <Text style={s.emptyText}>
              {!hasFinancialData
                ? 'Aún no tienes datos registrados.\nPuedes preguntarme sobre finanzas personales, deducciones fiscales y más.'
                : expenses.length < 3
                ? 'Registra al menos 3 gastos para obtener tu análisis personalizado.'
                : 'Toca el botón para analizar tus finanzas.'}
            </Text>
            {expenses.length >= 3 && (
              <Pressable style={s.analyzeBtn} onPress={() => fetchAnalysis()}>
                <Icon name="brain" size={18} color="#fff" />
                <Text style={s.analyzeBtnText}>Analizar mis finanzas</Text>
              </Pressable>
            )}
          </View>
        )}
      </ScreenContainer>

      {/* Ask bar */}
      <View style={[s.askBar, { backgroundColor: isDark ? '#111' : colors.surface }]}>
        {askMode ? (
          <View style={s.askInputRow}>
            <TextInput
              ref={inputRef}
              style={s.askInput}
              placeholder="¿Qué quieres saber?"
              placeholderTextColor={colors.textMuted}
              value={question}
              onChangeText={setQuestion}
              returnKeyType="send"
              onSubmitEditing={handleAsk}
              autoFocus
            />
            <Pressable style={s.sendBtn} onPress={handleAsk} disabled={!question.trim()}>
              <Icon name="send" size={18} color="#fff" />
            </Pressable>
            <Pressable onPress={() => setAskMode(false)} hitSlop={8} style={{ marginLeft: 6 }}>
              <Icon name="close" size={20} color={colors.textMuted} />
            </Pressable>
          </View>
        ) : (
          <>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.suggestionsScroll}>
              {(hasFinancialData ? SUGGESTED_QUESTIONS_PERSONAL : SUGGESTED_QUESTIONS_EDUCATIONAL).map(q => (
                <Pressable
                  key={q}
                  style={s.suggestionChip}
                  onPress={() => { setQuestion(q); fetchAnalysis(q); }}
                >
                  <Text style={s.suggestionText}>{q}</Text>
                </Pressable>
              ))}
            </ScrollView>
            <Pressable style={s.askBtn} onPress={() => { setAskMode(true); setTimeout(() => inputRef.current?.focus(), 100); }}>
              <Icon name="message-question-outline" size={18} color="#fff" />
            </Pressable>
          </>
        )}
      </View>

      <PaywallModal
        visible={paywallVisible}
        onClose={() => setPaywallVisible(false)}
        trigger="fiscal_report"
      />
    </KeyboardAvoidingView>
  );
}

const useStyles = (colors: ColorPalette, isDark: boolean) =>
  StyleSheet.create({
    // Locked
    lockedWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 28, gap: 16 },
    lockedGlow: { width: 88, height: 88, borderRadius: 24, backgroundColor: colors.primary + '15', alignItems: 'center', justifyContent: 'center' },
    lockedTitle: { color: colors.text, fontSize: 24, fontFamily: font.black, textAlign: 'center' },
    lockedSub: { color: colors.textMuted, fontSize: 14, textAlign: 'center', lineHeight: 22 },
    featureList: { alignSelf: 'stretch', gap: 10, marginTop: 4 },
    featureRow: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: isDark ? '#111' : colors.surfaceAlt, borderRadius: 12, padding: 12 },
    featureText: { color: colors.text, fontSize: 14, fontFamily: font.medium },
    unlockBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.primary, paddingVertical: 14, paddingHorizontal: 28, borderRadius: 16, marginTop: 8 },
    unlockBtnText: { color: '#fff', fontFamily: font.extrabold, fontSize: 15 },
    lockedNote: { color: colors.textMuted, fontSize: 11, textAlign: 'center', lineHeight: 18 },

    // Header
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
    headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    headerTitle: { color: colors.text, fontSize: 20, fontFamily: font.extrabold },
    refreshBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.surfaceAlt, alignItems: 'center', justifyContent: 'center' },

    // Loading
    loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16 },
    loadingText: { color: colors.textMuted, fontSize: 14, fontFamily: font.medium },
    loadingSubtext: { color: colors.textMuted, fontSize: 12, fontFamily: font.regular },
    errorWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, paddingHorizontal: 32 },
    errorIconWrap: { width: 72, height: 72, borderRadius: 36, backgroundColor: colors.danger + '15', alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
    errorTitle: { color: colors.text, fontFamily: font.bold, fontSize: 17, textAlign: 'center' },
    errorText: { color: colors.textMuted, fontSize: 14, textAlign: 'center', lineHeight: 22 },

    // Headline
    headlineCard: { backgroundColor: isDark ? '#111' : colors.surface, borderRadius: 20, padding: 16, gap: 10, borderWidth: 1, borderColor: colors.border, marginBottom: 8 },
    scoreBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
    scoreNum: { fontSize: 15, fontFamily: font.black },
    scoreLabel: { fontSize: 12, fontFamily: font.semibold },
    headline: { color: colors.text, fontSize: 16, fontFamily: font.bold, lineHeight: 24 },

    // Answer
    answerCard: { flexDirection: 'row', gap: 10, backgroundColor: colors.primary + '10', borderRadius: 16, padding: 14, marginBottom: 8, alignItems: 'flex-start' },
    answerText: { flex: 1, color: colors.text, fontSize: 14, fontFamily: font.medium, lineHeight: 22 },

    // Sections
    sectionCard: { backgroundColor: isDark ? '#111' : colors.surface, borderRadius: 20, padding: 16, gap: 10, borderWidth: 1, borderColor: colors.border, marginBottom: 8 },
    sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    sectionIconWrap: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
    sectionTitle: { color: colors.text, fontSize: 15, fontFamily: font.bold, flex: 1 },
    sectionBody: { color: colors.textSecondary, fontSize: 13, lineHeight: 21 },
    actionChip: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.primary + '12', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, alignSelf: 'flex-start' },
    actionText: { color: colors.primary, fontSize: 12, fontFamily: font.semibold },

    // Opportunity
    opportunityCard: { flexDirection: 'row', gap: 12, backgroundColor: '#F59E0B12', borderRadius: 16, padding: 14, borderWidth: 1, borderColor: '#F59E0B30', marginBottom: 8, alignItems: 'flex-start' },
    opportunityLabel: { color: '#F59E0B', fontSize: 11, fontFamily: font.bold, marginBottom: 2 },
    opportunityText: { color: colors.text, fontSize: 13, fontFamily: font.medium, lineHeight: 20 },

    // Fiscal
    fiscalCard: { flexDirection: 'row', gap: 12, backgroundColor: '#8B5CF612', borderRadius: 16, padding: 14, borderWidth: 1, borderColor: '#8B5CF630', marginBottom: 8, alignItems: 'flex-start' },
    fiscalLabel: { color: '#8B5CF6', fontSize: 11, fontFamily: font.bold, marginBottom: 2 },
    fiscalText: { color: colors.text, fontSize: 13, fontFamily: font.medium, lineHeight: 20 },

    // Tips
    tipsCard: { backgroundColor: isDark ? '#111' : colors.surface, borderRadius: 16, padding: 14, gap: 8, borderWidth: 1, borderColor: colors.border, marginBottom: 8 },
    tipsTitle: { color: colors.text, fontSize: 13, fontFamily: font.bold, marginBottom: 2 },
    tipRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
    tipDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: colors.primary, marginTop: 7 },
    tipText: { flex: 1, color: colors.textSecondary, fontSize: 13, lineHeight: 20 },

    // Empty
    emptyWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16 },
    emptyText: { color: colors.textMuted, fontSize: 14, textAlign: 'center', lineHeight: 22 },
    analyzeBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.primary, paddingVertical: 14, paddingHorizontal: 24, borderRadius: 14 },
    analyzeBtnText: { color: '#fff', fontFamily: font.bold, fontSize: 15 },

    // Ask bar
    askBar: { borderTopWidth: 1, borderTopColor: colors.border, paddingHorizontal: 16, paddingVertical: 10, paddingBottom: Platform.OS === 'ios' ? 28 : 10, flexDirection: 'row', alignItems: 'center', gap: 8 },
    suggestionsScroll: { flex: 1 },
    suggestionChip: { backgroundColor: colors.surfaceAlt, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7, marginRight: 8, borderWidth: 1, borderColor: colors.border },
    suggestionText: { color: colors.text, fontSize: 12, fontFamily: font.medium },
    askBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
    askInputRow: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 },
    askInput: { flex: 1, backgroundColor: colors.surfaceAlt, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, color: colors.text, fontSize: 14 },
    sendBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  });
