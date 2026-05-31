import React, { useRef, useState } from 'react';
import {
  Alert,
  Dimensions,
  FlatList,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  ViewToken,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, {
  FadeIn,
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useExpenseStore } from '../store/useExpenseStore';
import { FiscalRegime, usePremiumStore } from '../store/usePremiumStore';
import { ColorPalette } from '../theme/colors';
import { useTheme } from '../theme/ThemeContext';
import { parseSmartInput } from '../utils/smartInputParser';
import { estimateTaxSavings, savingsRateLabel } from '../utils/taxCalculator';
import { formatCurrency } from '../utils/format';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

type SlideKey = 'welcome' | 'regime' | 'savings_projection' | 'first_expense' | 'ready';

const REGIMES: Array<{ value: FiscalRegime; icon: string; title: string; desc: string }> = [
  { value: 'resico', icon: 'account-check', title: 'RESICO', desc: 'Régimen Simplificado de Confianza' },
  { value: 'actividad_empresarial', icon: 'briefcase-outline', title: 'Actividad Empresarial', desc: 'Freelancers y profesionistas independientes' },
  { value: 'honorarios', icon: 'file-document-outline', title: 'Honorarios', desc: 'Médicos, abogados, consultores' },
  { value: 'sueldos_salarios', icon: 'office-building-outline', title: 'Sueldos y Salarios', desc: 'Empleado con patrón' },
  { value: 'arrendamiento', icon: 'home-outline', title: 'Arrendamiento', desc: 'Renta de inmuebles' },
  { value: 'plataformas_digitales', icon: 'cellphone', title: 'Plataformas Digitales', desc: 'Uber, Airbnb, Rappi, etc.' },
  { value: 'incorporacion_fiscal', icon: 'store-outline', title: 'Incorporación Fiscal', desc: 'Pequeños negocios' },
  { value: 'regimen_general', icon: 'domain', title: 'Régimen General', desc: 'Personas morales y sociedades' },
  { value: 'no_facturo', icon: 'wallet-outline', title: 'No facturo', desc: 'Solo quiero controlar mis gastos' },
];

const FEATURES = [
  {
    icon: 'camera-outline',
    color: '#22C55E',
    title: 'Escanea tickets',
    desc: 'Captura gastos con la cámara. La app lee el ticket y extrae monto, fecha y comercio automáticamente.',
  },
  {
    icon: 'calculator-variant-outline',
    color: '#3B82F6',
    title: 'Ahorro fiscal real',
    desc: 'Calcula cuánto puedes deducir según tu régimen del SAT mes a mes.',
  },
  {
    icon: 'chart-pie',
    color: '#F59E0B',
    title: 'Reportes inteligentes',
    desc: 'Gráficas, presupuestos por categoría y reporte fiscal mensual en CSV.',
  },
];

export function OnboardingScreen() {
  const { colors } = useTheme();
  const s = useStyles(colors);
  const completeOnboarding = usePremiumStore(state => state.completeOnboarding);
  const setFiscalRegime = usePremiumStore(state => state.setFiscalRegime);
  const addExpense = useExpenseStore(state => state.addExpense);

  const [currentStep, setCurrentStep] = useState(0);
  const [selectedRegime, setSelectedRegime] = useState<FiscalRegime | null>(null);
  const [inputText, setInputText] = useState('');
  const flatRef = useRef<FlatList>(null);

  const SLIDES: SlideKey[] = ['welcome', 'regime', 'savings_projection', 'first_expense', 'ready'];
  const totalSteps = SLIDES.length;

  const goNext = () => {
    if (currentStep < totalSteps - 1) {
      const next = currentStep + 1;
      flatRef.current?.scrollToIndex({ index: next, animated: true });
      setCurrentStep(next);
    }
  };

  const handleRegimeNext = () => {
    if (!selectedRegime) {
      Alert.alert('Elige tu régimen', 'Selecciona cómo facturas para personalizar el cálculo fiscal.');
      return;
    }
    goNext();
  };

  const handleFinish = async () => {
    if (selectedRegime) await setFiscalRegime(selectedRegime);
    if (inputText.trim()) {
      const parsed = parseSmartInput(inputText);
      await addExpense({
        amount: parsed.amount ?? 0,
        date: parsed.date,
        category: parsed.category,
        description: parsed.description || inputText.trim(),
        merchantName: parsed.merchantName,
        conceptsText: '',
        ocrRawText: '',
        deductible: false,
        rfc: '',
        usoCFDI: '',
        source: 'manual',
      });
    }
    await completeOnboarding();
  };

  const handleSkipFirstExpense = async () => {
    if (selectedRegime) await setFiscalRegime(selectedRegime);
    await completeOnboarding();
  };

  const onViewableItemsChanged = useRef(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      if (viewableItems.length > 0 && viewableItems[0].index !== null) {
        setCurrentStep(viewableItems[0].index);
      }
    },
  );

  const renderSlide = ({ item }: { item: SlideKey }) => {
    switch (item) {
      case 'welcome':
        return <WelcomeSlide colors={colors} s={s} onNext={goNext} />;
      case 'regime':
        return (
          <RegimeSlide
            colors={colors}
            s={s}
            selected={selectedRegime}
            onSelect={setSelectedRegime}
            onNext={handleRegimeNext}
          />
        );
      case 'savings_projection':
        return (
          <SavingsProjectionSlide
            colors={colors}
            s={s}
            regime={selectedRegime}
            onNext={goNext}
          />
        );
      case 'first_expense':
        return (
          <FirstExpenseSlide
            colors={colors}
            s={s}
            value={inputText}
            onChange={setInputText}
            onNext={goNext}
            onSkip={handleSkipFirstExpense}
          />
        );
      case 'ready':
        return <ReadySlide colors={colors} s={s} onFinish={handleFinish} />;
      default:
        return null;
    }
  };

  return (
    <SafeAreaView style={s.container}>
      {/* Dots */}
      <View style={s.dotsRow}>
        {SLIDES.map((_, i) => (
          <View
            key={i}
            style={[s.dot, i === currentStep && s.dotActive]}
          />
        ))}
      </View>

      <FlatList
        ref={flatRef}
        data={SLIDES}
        keyExtractor={item => item}
        renderItem={renderSlide}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        scrollEnabled={false}
        onViewableItemsChanged={onViewableItemsChanged.current}
        viewabilityConfig={{ viewAreaCoveragePercentThreshold: 50 }}
      />
    </SafeAreaView>
  );
}

/* ─── Slides ────────────────────────────────────── */

function WelcomeSlide({ colors, s, onNext }: { colors: ColorPalette; s: ReturnType<typeof useStyles>; onNext: () => void }) {
  return (
    <Animated.View entering={FadeIn.duration(500)} style={s.slide}>
      <View style={s.welcomeHero}>
        <Image
          source={require('../assets/logo_new.png')}
          style={s.logoImage}
          resizeMode="contain"
        />
        <Text style={s.appName}>EXPENSIA</Text>
        <Text style={s.tagline}>Tu contador inteligente{'\n'}en el bolsillo</Text>
      </View>

      <View style={s.welcomeBullets}>
        {[
          { icon: 'check-circle', text: 'Controla gastos personales y de negocio' },
          { icon: 'check-circle', text: 'Calcula deducciones del SAT automáticamente' },
          { icon: 'check-circle', text: 'Escanea tickets con la cámara' },
        ].map((item, i) => (
          <View key={i} style={s.bulletRow}>
            <Icon name={item.icon} size={18} color={colors.primary} />
            <Text style={s.bulletText}>{item.text}</Text>
          </View>
        ))}
      </View>

      <Pressable style={s.primaryButton} onPress={onNext}>
        <Text style={s.primaryButtonText}>Comenzar</Text>
        <Icon name="arrow-right" size={20} color={colors.white} />
      </Pressable>
    </Animated.View>
  );
}

const REGIME_SAVINGS_EXAMPLE = 5000; // MXN/mes en deducibles como ejemplo

const REGIME_LABELS: Partial<Record<FiscalRegime, string | null>> = {
  resico: 'RESICO',
  actividad_empresarial: 'Actividad Empresarial',
  honorarios: 'Honorarios',
  plataformas_digitales: 'Plataformas Digitales',
  arrendamiento: 'Arrendamiento',
  incorporacion_fiscal: 'Incorporación Fiscal',
  regimen_general: 'Régimen General',
  sueldos_salarios: 'Sueldos y Salarios',
  no_facturo: null,
};

const DEDUCTIBLE_EXAMPLES: Partial<Record<FiscalRegime, string[]>> = {
  resico: ['Gasolina y transporte', 'Comidas de negocio', 'Renta de oficina', 'Equipo y software'],
  actividad_empresarial: ['Gastos de operación', 'Honorarios pagados', 'Arrendamiento', 'Publicidad'],
  honorarios: ['Material de trabajo', 'Transporte profesional', 'Capacitación', 'Software profesional'],
  plataformas_digitales: ['Gasolina', 'Mantenimiento de vehículo', 'Celular y datos', 'Seguro'],
  arrendamiento: ['Mantenimiento del inmueble', 'Predial', 'Seguros', 'Servicios'],
  sueldos_salarios: ['Honorarios médicos', 'Colegiaturas', 'Intereses hipotecarios', 'Donativos'],
};

function SavingsProjectionSlide({
  colors, s, regime, onNext,
}: {
  colors: ColorPalette;
  s: ReturnType<typeof useStyles>;
  regime: FiscalRegime | null;
  onNext: () => void;
}) {
  const isTaxPayer = regime && regime !== 'no_facturo';
  const annualSaving = regime ? estimateTaxSavings(REGIME_SAVINGS_EXAMPLE * 12, regime) : 0;
  const rateLabel = regime ? savingsRateLabel(regime) : '';
  const regimeLabel = regime ? REGIME_LABELS[regime] : '';
  const examples = regime ? (DEDUCTIBLE_EXAMPLES[regime] ?? DEDUCTIBLE_EXAMPLES.actividad_empresarial ?? []) : [];

  return (
    <Animated.View entering={FadeInDown.duration(400)} style={s.slide}>
      {isTaxPayer ? (
        <>
          <Animated.View entering={FadeInDown.delay(50).duration(400)} style={s.savingsHero}>
            <Icon name="cash-multiple" size={40} color={colors.primary} />
            <Text style={s.savingsTitle}>
              Podrías ahorrar hasta
            </Text>
            <Text style={s.savingsAmount}>{formatCurrency(annualSaving)}</Text>
            <Text style={s.savingsSubtitle}>al año en impuestos como {regimeLabel}</Text>
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(150).duration(400)} style={s.savingsBox}>
            <Text style={s.savingsBoxTitle}>¿Cómo funciona?</Text>
            <Text style={s.savingsBoxDesc}>
              EXPENSIA detecta automáticamente qué gastos son deducibles según tu régimen.
              Con {rateLabel}, cada ticket escaneado puede reducir lo que pagas al SAT.
            </Text>
          </Animated.View>

          {examples.length > 0 && (
            <Animated.View entering={FadeInDown.delay(250).duration(400)} style={s.examplesWrap}>
              <Text style={s.examplesTitle}>Gastos deducibles para ti</Text>
              <View style={s.examplesList}>
                {examples.map(ex => (
                  <View key={ex} style={s.exampleRow}>
                    <Icon name="check-circle-outline" size={15} color={colors.success} />
                    <Text style={s.exampleItem}>{ex}</Text>
                  </View>
                ))}
              </View>
            </Animated.View>
          )}
        </>
      ) : (
        <Animated.View entering={FadeIn.duration(400)} style={s.savingsHero}>
          <Icon name="wallet-outline" size={48} color={colors.primary} />
          <Text style={s.savingsTitle}>Control total de tus gastos</Text>
          <Text style={s.slideSubtitle}>
            Registra, categoriza y analiza en qué va tu dinero cada mes.
          </Text>
        </Animated.View>
      )}

      <Pressable style={[s.primaryButton, { marginTop: 8 }]} onPress={onNext}>
        <Text style={s.primaryButtonText}>Empezar a ahorrar</Text>
        <Icon name="arrow-right" size={20} color={colors.white} />
      </Pressable>
    </Animated.View>
  );
}

function RegimeSlide({
  colors, s, selected, onSelect, onNext,
}: {
  colors: ColorPalette;
  s: ReturnType<typeof useStyles>;
  selected: FiscalRegime | null;
  onSelect: (r: FiscalRegime) => void;
  onNext: () => void;
}) {
  return (
    <View style={s.slide}>
      <Text style={s.slideTitle}>¿Cómo facturas?</Text>
      <Text style={s.slideSubtitle}>Personalizamos el cálculo de deducciones según tu régimen</Text>

      <ScrollView style={s.regimeScroll} showsVerticalScrollIndicator={false}>
        <View style={s.regimeList}>
          {REGIMES.map(r => (
            <Pressable
              key={r.value}
              style={[s.regimeCard, selected === r.value && s.regimeCardActive]}
              onPress={() => onSelect(r.value)}
            >
              <Icon
                name={r.icon}
                size={22}
                color={selected === r.value ? colors.white : colors.primary}
              />
              <View style={s.regimeInfo}>
                <Text style={[s.regimeTitle, selected === r.value && s.textWhite]}>
                  {r.title}
                </Text>
                <Text style={[s.regimeDesc, selected === r.value && s.textWhiteOpacity]}>
                  {r.desc}
                </Text>
              </View>
              {selected === r.value && (
                <Icon name="check-circle" size={18} color={colors.white} />
              )}
            </Pressable>
          ))}
        </View>
      </ScrollView>

      <Pressable style={[s.primaryButton, { marginTop: 12 }]} onPress={onNext}>
        <Text style={s.primaryButtonText}>Continuar</Text>
        <Icon name="arrow-right" size={20} color={colors.white} />
      </Pressable>
    </View>
  );
}

function FirstExpenseSlide({
  colors, s, value, onChange, onNext, onSkip,
}: {
  colors: ColorPalette;
  s: ReturnType<typeof useStyles>;
  value: string;
  onChange: (t: string) => void;
  onNext: () => void;
  onSkip: () => void;
}) {
  return (
    <Animated.View entering={FadeInDown.duration(400)} style={s.slide}>
      <View style={s.heroIcon}>
        <Icon name="pencil-plus-outline" size={44} color={colors.primary} />
      </View>
      <Text style={s.slideTitle}>Registra tu primer gasto</Text>
      <Text style={s.slideSubtitle}>
        Escribe algo como <Text style={s.exampleText}>"150 uber ayer"</Text>{' '}
        o <Text style={s.exampleText}>"Netflix 250"</Text>
      </Text>

      <TextInput
        style={s.textInput}
        placeholder="Ej: 350 comida McDonald's"
        placeholderTextColor={colors.textMuted}
        value={value}
        onChangeText={onChange}
        autoFocus
        returnKeyType="done"
        onSubmitEditing={onNext}
      />

      <View style={s.hints}>
        {['💡 Detecta montos automáticamente', '📅 Entiende "ayer", "hoy"', '🏷️ Clasifica la categoría'].map(h => (
          <Text key={h} style={s.hintText}>{h}</Text>
        ))}
      </View>

      <Pressable style={s.primaryButton} onPress={onNext}>
        <Text style={s.primaryButtonText}>Registrar y continuar</Text>
      </Pressable>
      <Pressable style={s.skipButton} onPress={onSkip}>
        <Text style={s.skipText}>Omitir por ahora</Text>
      </Pressable>
    </Animated.View>
  );
}

function ReadySlide({ colors, s, onFinish }: { colors: ColorPalette; s: ReturnType<typeof useStyles>; onFinish: () => void }) {
  return (
    <Animated.View entering={FadeIn.duration(500)} style={[s.slide, s.readySlide]}>
      <Animated.View entering={FadeInDown.delay(100).duration(500)} style={s.readyCheck}>
        <Icon name="check-circle" size={72} color={colors.primary} />
      </Animated.View>
      <Animated.Text entering={FadeInDown.delay(200).duration(400)} style={s.readyTitle}>
        ¡Todo listo!
      </Animated.Text>
      <Animated.Text entering={FadeInDown.delay(300).duration(400)} style={s.readySubtitle}>
        Tu perfil fiscal está configurado.{'\n'}Empieza a registrar tus gastos y descubre cuánto puedes ahorrar.
      </Animated.Text>

      <Animated.View entering={FadeInDown.delay(400).duration(400)} style={s.readyStat}>
        <Icon name="lightning-bolt" size={20} color={colors.primary} />
        <Text style={s.readyStatText}>Usuarios ahorran en promedio <Text style={s.readyStatBold}>$4,200/año</Text> en deducciones</Text>
      </Animated.View>

      <Animated.View entering={FadeInDown.delay(500).duration(400)} style={{ width: '100%' }}>
        <Pressable style={s.primaryButton} onPress={onFinish}>
          <Text style={s.primaryButtonText}>Ir a Expensia</Text>
          <Icon name="rocket-launch-outline" size={20} color={colors.white} />
        </Pressable>
      </Animated.View>
    </Animated.View>
  );
}

/* ─── Styles ────────────────────────────────────── */

const useStyles = (colors: ColorPalette) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    dotsRow: {
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
      gap: 6,
      paddingVertical: 14,
    },
    dot: {
      width: 6,
      height: 6,
      borderRadius: 3,
      backgroundColor: colors.border,
    },
    dotActive: {
      backgroundColor: colors.primary,
      width: 20,
      borderRadius: 3,
    },
    slide: {
      width: SCREEN_WIDTH,
      flex: 1,
      paddingHorizontal: 24,
      paddingBottom: 24,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 16,
    },
    // Welcome
    welcomeHero: {
      alignItems: 'center',
      gap: 12,
      marginBottom: 8,
    },
    logoImage: {
      width: 130,
      height: 130,
      marginBottom: 4,
    },
    appName: {
      color: colors.primary,
      fontSize: 32,
      fontWeight: '900',
      letterSpacing: 4,
    },
    tagline: {
      color: colors.text,
      fontSize: 22,
      fontWeight: '700',
      textAlign: 'center',
      lineHeight: 30,
    },
    welcomeBullets: {
      width: '100%',
      backgroundColor: colors.surface,
      borderRadius: 18,
      padding: 18,
      gap: 12,
    },
    bulletRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    bulletText: {
      color: colors.text,
      fontSize: 14,
      fontWeight: '500',
      flex: 1,
    },
    // Features
    slideTitle: {
      color: colors.text,
      fontSize: 26,
      fontWeight: '800',
      textAlign: 'center',
    },
    slideSubtitle: {
      color: colors.textMuted,
      fontSize: 14,
      textAlign: 'center',
      lineHeight: 20,
    },
    featureList: {
      width: '100%',
      gap: 12,
    },
    featureCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 14,
      backgroundColor: colors.surface,
      borderRadius: 18,
      padding: 16,
      borderWidth: 1,
      borderColor: colors.border,
    },
    featureIcon: {
      width: 52,
      height: 52,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
    },
    featureText: {
      flex: 1,
      gap: 3,
    },
    featureTitle: {
      color: colors.text,
      fontSize: 15,
      fontWeight: '700',
    },
    featureDesc: {
      color: colors.textMuted,
      fontSize: 12,
      lineHeight: 17,
    },
    // Regime
    regimeScroll: {
      width: '100%',
      maxHeight: 360,
    },
    regimeList: {
      gap: 8,
      paddingBottom: 8,
    },
    regimeCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      backgroundColor: colors.surface,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 14,
    },
    regimeCardActive: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    regimeInfo: {
      flex: 1,
      gap: 2,
    },
    regimeTitle: {
      color: colors.text,
      fontSize: 14,
      fontWeight: '700',
    },
    regimeDesc: {
      color: colors.textMuted,
      fontSize: 11,
    },
    textWhite: {
      color: '#fff',
    },
    textWhiteOpacity: {
      color: 'rgba(255,255,255,0.8)',
    },
    // First expense
    heroIcon: {
      width: 90,
      height: 90,
      borderRadius: 45,
      backgroundColor: colors.primary + '18',
      alignItems: 'center',
      justifyContent: 'center',
    },
    exampleText: {
      color: colors.primary,
      fontWeight: '700',
    },
    textInput: {
      width: '100%',
      backgroundColor: colors.surface,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 16,
      fontSize: 16,
      color: colors.text,
    },
    hints: {
      width: '100%',
      backgroundColor: colors.surface,
      borderRadius: 14,
      padding: 14,
      gap: 6,
    },
    hintText: {
      color: colors.textMuted,
      fontSize: 12,
    },
    // Savings projection
    savingsHero: {
      alignItems: 'center',
      gap: 6,
      backgroundColor: colors.surface,
      borderRadius: 20,
      padding: 24,
      width: '100%',
      borderWidth: 1,
      borderColor: colors.border,
    },
    savingsTitle: {
      color: colors.textMuted,
      fontSize: 14,
      fontWeight: '600',
      textAlign: 'center',
    },
    savingsAmount: {
      color: colors.primary,
      fontSize: 42,
      fontWeight: '900',
      letterSpacing: -1,
    },
    savingsSubtitle: {
      color: colors.textMuted,
      fontSize: 13,
      textAlign: 'center',
    },
    savingsBox: {
      backgroundColor: colors.surface,
      borderRadius: 16,
      padding: 16,
      width: '100%',
      gap: 6,
      borderWidth: 1,
      borderColor: colors.border,
    },
    savingsBoxTitle: {
      color: colors.text,
      fontSize: 14,
      fontWeight: '700',
    },
    savingsBoxDesc: {
      color: colors.textMuted,
      fontSize: 13,
      lineHeight: 19,
    },
    examplesWrap: {
      width: '100%',
      gap: 8,
    },
    examplesTitle: {
      color: colors.text,
      fontSize: 13,
      fontWeight: '700',
    },
    examplesList: {
      gap: 6,
    },
    exampleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    exampleItem: {
      color: colors.textMuted,
      fontSize: 13,
    },
    // Ready
    readySlide: {
      justifyContent: 'center',
    },
    readyCheck: {
      marginBottom: 8,
    },
    readyTitle: {
      color: colors.text,
      fontSize: 32,
      fontWeight: '900',
      textAlign: 'center',
    },
    readySubtitle: {
      color: colors.textMuted,
      fontSize: 15,
      textAlign: 'center',
      lineHeight: 22,
    },
    readyStat: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      backgroundColor: colors.primary + '15',
      borderRadius: 14,
      padding: 14,
      width: '100%',
    },
    readyStatText: {
      color: colors.text,
      fontSize: 13,
      flex: 1,
      lineHeight: 18,
    },
    readyStatBold: {
      color: colors.primary,
      fontWeight: '800',
    },
    // Shared
    primaryButton: {
      width: '100%',
      backgroundColor: colors.primary,
      paddingVertical: 16,
      borderRadius: 16,
      alignItems: 'center',
      flexDirection: 'row',
      justifyContent: 'center',
      gap: 8,
    },
    primaryButtonText: {
      color: '#fff',
      fontSize: 16,
      fontWeight: '800',
    },
    skipButton: {
      paddingVertical: 10,
    },
    skipText: {
      color: colors.textMuted,
      fontSize: 14,
      fontWeight: '600',
    },
  });
