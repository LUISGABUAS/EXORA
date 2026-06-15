import React, { useRef, useState } from 'react';
import {
  Alert,
  Dimensions,
  FlatList,
  Image,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  ViewToken,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useExpenseStore } from '../store/useExpenseStore';
import { FinancialGoal, FiscalRegime, usePremiumStore } from '../store/usePremiumStore';
import { ColorPalette } from '../theme/colors';
import { font } from '../theme/typography';
import { useTheme } from '../theme/ThemeContext';
import { parseSmartInput } from '../utils/smartInputParser';
import { readPdfText, validateIsConstancia, parseConstanciaText } from '../services/constanciaService';
import { estimateTaxSavings, savingsRateLabel } from '../utils/taxCalculator';
import { formatCurrency } from '../utils/format';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

type SlideKey = 'welcome' | 'name' | 'age' | 'goals' | 'regime' | 'recommendations' | 'widget' | 'first_expense' | 'ready';

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

const GOALS: Array<{ value: FinancialGoal; icon: string; label: string }> = [
  { value: 'ahorrar_mas', icon: '🏦', label: 'Ahorrar más dinero' },
  { value: 'maximizar_deducciones', icon: '🧾', label: 'Maximizar deducciones fiscales' },
  { value: 'reducir_gastos_hormiga', icon: '☕', label: 'Reducir gastos hormiga' },
  { value: 'pagar_menos_impuestos', icon: '📉', label: 'Pagar menos impuestos' },
  { value: 'liquidar_deudas', icon: '💳', label: 'Liquidar deudas' },
  { value: 'fondo_emergencia', icon: '🛡️', label: 'Crear fondo de emergencia' },
  { value: 'meta_especifica', icon: '🎯', label: 'Ahorrar para una meta específica' },
  { value: 'entender_finanzas', icon: '📊', label: 'Entender mejor mis finanzas' },
];

const AGE_RANGES = [
  { label: '18 – 24', icon: '🎓', desc: 'Estudiante o inicio de carrera' },
  { label: '25 – 34', icon: '🚀', desc: 'Crecimiento profesional' },
  { label: '35 – 44', icon: '💼', desc: 'Consolidación profesional' },
  { label: '45 – 54', icon: '🏆', desc: 'Experiencia y estabilidad' },
  { label: '55+', icon: '🌟', desc: 'Trayectoria establecida' },
];

const REGIME_DEDUCTIBLES: Partial<Record<FiscalRegime, string[]>> = {
  resico: ['Gasolina y transporte', 'Comidas de negocio', 'Renta de oficina', 'Equipo y software'],
  actividad_empresarial: ['Gastos de operación', 'Honorarios pagados', 'Arrendamiento', 'Publicidad'],
  honorarios: ['Material de trabajo', 'Transporte profesional', 'Capacitación', 'Software profesional'],
  plataformas_digitales: ['Gasolina', 'Mantenimiento de vehículo', 'Celular y datos', 'Seguro'],
  arrendamiento: ['Mantenimiento del inmueble', 'Predial', 'Seguros', 'Servicios'],
  sueldos_salarios: ['Honorarios médicos', 'Colegiaturas', 'Intereses hipotecarios', 'Donativos'],
};

const REGIME_LABELS: Partial<Record<FiscalRegime, string>> = {
  resico: 'RESICO',
  actividad_empresarial: 'Actividad Empresarial',
  honorarios: 'Honorarios',
  plataformas_digitales: 'Plataformas Digitales',
  arrendamiento: 'Arrendamiento',
  incorporacion_fiscal: 'Incorporación Fiscal',
  regimen_general: 'Régimen General',
  sueldos_salarios: 'Sueldos y Salarios',
  no_facturo: 'Sin facturar',
};

function getRecommendations(regime: FiscalRegime | null, ageRange: string, goals: FinancialGoal[] = []): string[] {
  const base: string[] = [];
  if (!regime) return base;

  if (regime === 'resico') base.push('Con RESICO puedes deducir hasta el 25% de tus ingresos. Escanea cada ticket.');
  if (regime === 'honorarios') base.push('Como honorarios, guarda facturas de tu equipo y herramientas de trabajo.');
  if (regime === 'plataformas_digitales') base.push('Tu vehículo es deducible. Registra gasolina y mantenimiento siempre.');
  if (regime === 'sueldos_salarios') base.push('Aprovecha deducciones personales: médico, dental, óptica y colegiaturas.');
  if (regime === 'no_facturo') base.push('Llevar control de gastos te ayuda a identificar en qué gastas más y ahorrar.');

  // Goal-based recommendations
  if (goals.includes('ahorrar_mas')) base.push('Activa metas de ahorro en EXPENSIA y sigue tu progreso semana a semana.');
  if (goals.includes('maximizar_deducciones')) base.push('Escanea cada ticket. Cada comprobante cuenta para reducir lo que pagas al SAT.');
  if (goals.includes('reducir_gastos_hormiga')) base.push('Usa los presupuestos por categoría — el Asesor IA te avisa cuando te pasas.');
  if (goals.includes('pagar_menos_impuestos')) base.push('El Asesor IA calcula cuánto puedes deducir cada mes para que pagues menos.');
  if (goals.includes('liquidar_deudas')) base.push('Registra tus deudas en gastos recurrentes para visualizar cuánto queda por pagar.');
  if (goals.includes('fondo_emergencia')) base.push('Crea una meta de ahorro llamada "Fondo de emergencia" con tu objetivo en meses.');
  if (goals.includes('meta_especifica')) base.push('Las metas de ahorro te muestran el avance y te motivan a llegar al objetivo.');

  if (ageRange === '18 – 24') base.push('Empieza desde joven. Cada peso ahorrado ahora vale más en el futuro.');
  if (ageRange === '25 – 34') base.push('Es el mejor momento para configurar metas de ahorro. Úsalas en EXPENSIA.');
  if (ageRange === '35 – 44') base.push('Con ingresos más altos, las deducciones se vuelven más valiosas. No las ignores.');
  if (ageRange === '45 – 54' || ageRange === '55+') base.push('Considera registrar también seguros y planes de retiro como deducciones.');

  if (base.length === 0) base.push('Activa el presupuesto mensual para que te avise cuando te acercas al límite.');

  return base.slice(0, 3);
}

export function OnboardingScreen() {
  const { colors } = useTheme();
  const s = useStyles(colors);
  const completeOnboarding = usePremiumStore(state => state.completeOnboarding);
  const setFiscalRegime = usePremiumStore(state => state.setFiscalRegime);
  const setFiscalProfile = usePremiumStore(state => state.setFiscalProfile);
  const setFinancialGoals = usePremiumStore(state => state.setFinancialGoals);
  const addExpense = useExpenseStore(state => state.addExpense);

  const [currentStep, setCurrentStep] = useState(0);
  const [name, setName] = useState('');
  const [ageRange, setAgeRange] = useState('');
  const [selectedGoals, setSelectedGoals] = useState<FinancialGoal[]>([]);
  const [selectedRegimes, setSelectedRegimes] = useState<FiscalRegime[]>([]);
  const [csfRfc, setCsfRfc] = useState<string | null>(null);
  const [csfRazonSocial, setCsfRazonSocial] = useState<string | null>(null);

  const toggleRegime = (r: FiscalRegime) => {
    if (r === 'no_facturo') {
      setSelectedRegimes(prev => prev.includes(r) ? [] : ['no_facturo']);
    } else {
      setSelectedRegimes(prev => {
        const sin = prev.filter(x => x !== 'no_facturo');
        return sin.includes(r) ? sin.filter(x => x !== r) : [...sin, r];
      });
    }
  };
  const [inputText, setInputText] = useState('');
  const flatRef = useRef<FlatList>(null);

  const SLIDES: SlideKey[] = ['welcome', 'name', 'age', 'goals', 'regime', 'recommendations', 'widget', 'first_expense', 'ready'];

  const goNext = () => {
    const next = currentStep + 1;
    if (next >= SLIDES.length) return;
    flatRef.current?.scrollToIndex({ index: next, animated: true });
    setCurrentStep(next);
  };

  const goBack = () => {
    const prev = currentStep - 1;
    if (prev < 0) return;
    flatRef.current?.scrollToIndex({ index: prev, animated: true });
    setCurrentStep(prev);
  };

  const handleNameNext = () => {
    if (!name.trim()) {
      Alert.alert('Escribe tu nombre', 'Necesitamos tu nombre para personalizar la app.');
      return;
    }
    goNext();
  };

  const handleAgeNext = () => {
    if (!ageRange) {
      Alert.alert('Selecciona tu rango de edad', 'Lo usamos para darte recomendaciones personalizadas.');
      return;
    }
    goNext();
  };

  const handleRegimeNext = () => {
    if (selectedRegimes.length === 0) {
      Alert.alert('Elige al menos un régimen', 'Selecciona cómo facturas para personalizar el cálculo fiscal.');
      return;
    }
    goNext();
  };

  const handleFinish = async () => {
    if (selectedRegimes.length > 0) await setFiscalRegime(selectedRegimes[0]);
    await setFiscalProfile({
      razonSocial: csfRazonSocial || name.trim() || null,
      allFiscalRegimes: selectedRegimes,
      ...(csfRfc ? { rfc: csfRfc } : {}),
    });
    await setFinancialGoals(selectedGoals, ageRange);
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

  const handleSkip = async () => {
    if (selectedRegimes.length > 0) await setFiscalRegime(selectedRegimes[0]);
    await setFiscalProfile({
      razonSocial: csfRazonSocial || name.trim() || null,
      allFiscalRegimes: selectedRegimes,
      ...(csfRfc ? { rfc: csfRfc } : {}),
    });
    await setFinancialGoals(selectedGoals, ageRange);
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
      case 'name':
        return <NameSlide colors={colors} s={s} value={name} onChange={setName} onNext={handleNameNext} />;
      case 'age':
        return <AgeSlide colors={colors} s={s} selected={ageRange} onSelect={setAgeRange} onNext={handleAgeNext} />;
      case 'goals':
        return <GoalsSlide colors={colors} s={s} selected={selectedGoals} onToggle={goal => setSelectedGoals(prev => prev.includes(goal) ? prev.filter(g => g !== goal) : [...prev, goal])} onNext={goNext} />;
      case 'regime':
        return (
          <RegimeSlide
            colors={colors} s={s}
            selected={selectedRegimes}
            onToggle={toggleRegime}
            onNext={handleRegimeNext}
            onCsfImport={(regimes, rfc, razonSocial) => {
              setSelectedRegimes(regimes);
              setCsfRfc(rfc);
              setCsfRazonSocial(razonSocial);
            }}
          />
        );
      case 'recommendations':
        return <RecommendationsSlide colors={colors} s={s} regime={selectedRegimes[0] ?? null} ageRange={ageRange} goals={selectedGoals} name={name} onNext={goNext} />;
      case 'widget':
        return <WidgetSlide colors={colors} s={s} onNext={goNext} />;
      case 'first_expense':
        return <FirstExpenseSlide colors={colors} s={s} value={inputText} onChange={setInputText} onNext={goNext} onSkip={handleSkip} />;
      case 'ready':
        return <ReadySlide colors={colors} s={s} name={name} regime={selectedRegimes[0] ?? null} onFinish={handleFinish} />;
      default:
        return null;
    }
  };

  return (
    <SafeAreaView style={s.container}>
      <View style={s.header}>
        {currentStep > 0 ? (
          <Pressable style={s.backButton} onPress={goBack} hitSlop={12}>
            <Icon name="arrow-left" size={22} color={colors.text} />
          </Pressable>
        ) : (
          <View style={s.backButton} />
        )}
        <View style={s.dotsRow}>
          {SLIDES.map((_, i) => (
            <View key={i} style={[s.dot, i === currentStep && s.dotActive]} />
          ))}
        </View>
        <View style={s.backButton} />
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

/* ─── Slides ─────────────────────────────────────── */

function WelcomeSlide({ colors, s, onNext }: { colors: ColorPalette; s: any; onNext: () => void }) {
  return (
    <Animated.View entering={FadeIn.duration(500)} style={s.slide}>
      <View style={s.welcomeHero}>
        <Image source={require('../assets/logo_new.png')} style={s.logoImage} resizeMode="contain" />
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
        <Icon name="arrow-right" size={20} color="#fff" />
      </Pressable>
    </Animated.View>
  );
}

function NameSlide({ colors, s, value, onChange, onNext }: { colors: ColorPalette; s: any; value: string; onChange: (v: string) => void; onNext: () => void }) {
  return (
    <Animated.View entering={FadeInDown.duration(400)} style={s.slide}>
      <View style={s.heroIcon}>
        <Icon name="account-outline" size={44} color={colors.primary} />
      </View>
      <Text style={s.slideTitle}>¿Cómo te llamas?</Text>
      <Text style={s.slideSubtitle}>Lo usamos para personalizar tu experiencia</Text>
      <TextInput
        style={s.textInput}
        placeholder="Tu nombre o apodo"
        placeholderTextColor={colors.textMuted}
        value={value}
        onChangeText={onChange}
        autoFocus
        returnKeyType="next"
        onSubmitEditing={onNext}
        autoCapitalize="words"
      />
      <Pressable style={s.primaryButton} onPress={onNext}>
        <Text style={s.primaryButtonText}>Continuar</Text>
        <Icon name="arrow-right" size={20} color="#fff" />
      </Pressable>
    </Animated.View>
  );
}

function AgeSlide({ colors, s, selected, onSelect, onNext }: { colors: ColorPalette; s: any; selected: string; onSelect: (v: string) => void; onNext: () => void }) {
  return (
    <Animated.View entering={FadeInDown.duration(400)} style={s.slide}>
      <Text style={s.slideTitle}>¿Cuántos años tienes?</Text>
      <Text style={s.slideSubtitle}>Personalizamos tus recomendaciones financieras según tu etapa de vida</Text>
      <View style={s.ageList}>
        {AGE_RANGES.map(range => (
          <Pressable
            key={range.label}
            style={[s.ageCard, selected === range.label && s.ageCardActive]}
            onPress={() => onSelect(range.label)}
          >
            <Text style={s.ageEmoji}>{range.icon}</Text>
            <View style={s.ageInfo}>
              <Text style={[s.ageLabel, selected === range.label && s.textWhite]}>{range.label}</Text>
              <Text style={[s.ageDesc, selected === range.label && s.textWhiteOpacity]}>{range.desc}</Text>
            </View>
            {selected === range.label && <Icon name="check-circle" size={18} color="#fff" />}
          </Pressable>
        ))}
      </View>
      <Pressable style={[s.primaryButton, { marginTop: 8 }]} onPress={onNext}>
        <Text style={s.primaryButtonText}>Continuar</Text>
        <Icon name="arrow-right" size={20} color="#fff" />
      </Pressable>
    </Animated.View>
  );
}

function GoalsSlide({ colors, s, selected, onToggle, onNext }: { colors: ColorPalette; s: any; selected: FinancialGoal[]; onToggle: (g: FinancialGoal) => void; onNext: () => void }) {
  return (
    <Animated.View entering={FadeInDown.duration(400)} style={s.slide}>
      <Text style={s.slideTitle}>¿Cuál es tu meta?</Text>
      <Text style={s.slideSubtitle}>Elige una o más. El Asesor IA aprenderá tu perfil y te dará recomendaciones personalizadas</Text>
      <View style={s.goalsGrid}>
        {GOALS.map(goal => {
          const active = selected.includes(goal.value);
          return (
            <Pressable
              key={goal.value}
              style={[s.goalCard, active && s.goalCardActive]}
              onPress={() => onToggle(goal.value)}
            >
              <Text style={s.goalEmoji}>{goal.icon}</Text>
              <Text style={[s.goalLabel, active && s.textWhite]}>{goal.label}</Text>
              {active && <Icon name="check-circle" size={14} color="#fff" style={{ marginTop: 4 }} />}
            </Pressable>
          );
        })}
      </View>
      <Pressable style={[s.primaryButton, { marginTop: 8 }]} onPress={onNext}>
        <Text style={s.primaryButtonText}>
          {selected.length === 0 ? 'Omitir' : `Continuar (${selected.length})`}
        </Text>
        <Icon name="arrow-right" size={20} color="#fff" />
      </Pressable>
    </Animated.View>
  );
}

function RegimeSlide({
  colors, s, selected, onToggle, onNext, onCsfImport,
}: {
  colors: ColorPalette;
  s: any;
  selected: FiscalRegime[];
  onToggle: (r: FiscalRegime) => void;
  onNext: () => void;
  onCsfImport: (regimes: FiscalRegime[], rfc: string | null, razonSocial: string | null) => void;
}) {
  const [csfLoading, setCsfLoading] = useState(false);
  const [csfSuccess, setCsfSuccess] = useState(false);

  const handleUploadCSF = async () => {
    try {
      const DocumentPicker = require('react-native-document-picker').default;
      const result = await DocumentPicker.pickSingle({ type: DocumentPicker.types.pdf });
      if (!result?.uri) return;

      setCsfLoading(true);
      setCsfSuccess(false);

      const uri = Platform.OS === 'ios' ? result.uri.replace('file://', '') : result.uri;
      const text = await readPdfText(uri);

      if (!text || !validateIsConstancia(text)) {
        Alert.alert(
          'Documento no reconocido',
          'El PDF no parece ser una Constancia de Situación Fiscal del SAT. Asegúrate de descargar el documento correcto desde el portal del SAT.',
        );
        setCsfLoading(false);
        return;
      }

      const parsed = parseConstanciaText(text);
      if (!parsed.success || !parsed.allFiscalRegimes?.length) {
        Alert.alert('No se encontraron regímenes', 'Revisa que el PDF esté completo o selecciónalos manualmente.');
        setCsfLoading(false);
        return;
      }

      onCsfImport(
        parsed.allFiscalRegimes,
        parsed.rfc ?? null,
        parsed.razonSocial ?? null,
      );
      setCsfSuccess(true);
    } catch (err: any) {
      if (!err?.message?.toLowerCase().includes('cancel')) {
        Alert.alert('Error', 'No se pudo leer el archivo. Intenta de nuevo.');
      }
    } finally {
      setCsfLoading(false);
    }
  };

  return (
    <View style={s.slide}>
      <Text style={s.slideTitle}>¿Cómo facturas?</Text>
      <Text style={s.slideSubtitle}>Puedes seleccionar varios — muchos contribuyentes tienen más de un régimen</Text>

      {/* Botón subir CSF */}
      <Pressable
        style={[s.csfButton, csfSuccess && s.csfButtonSuccess]}
        onPress={handleUploadCSF}
        disabled={csfLoading}
      >
        <Icon
          name={csfSuccess ? 'check-circle' : 'file-upload-outline'}
          size={20}
          color={csfSuccess ? '#22C55E' : colors.primary}
        />
        <View style={{ flex: 1 }}>
          <Text style={[s.csfButtonTitle, csfSuccess && { color: '#22C55E' }]}>
            {csfLoading ? 'Leyendo constancia…' : csfSuccess ? '¡Constancia cargada!' : 'Subir Constancia del SAT (PDF)'}
          </Text>
          <Text style={s.csfButtonDesc}>
            {csfSuccess
              ? `Se detectaron ${selected.length} régimen${selected.length !== 1 ? 'es' : ''} automáticamente`
              : 'Detectamos tus regímenes automáticamente'}
          </Text>
        </View>
        <Icon name="chevron-right" size={18} color={colors.textMuted} />
      </Pressable>

      {/* Divisor */}
      <View style={s.dividerRow}>
        <View style={s.dividerLine} />
        <Text style={s.dividerText}>o selecciona manualmente</Text>
        <View style={s.dividerLine} />
      </View>

      <ScrollView style={s.regimeScroll} showsVerticalScrollIndicator={false}>
        <View style={s.regimeList}>
          {REGIMES.map(r => {
            const active = selected.includes(r.value);
            return (
              <Pressable
                key={r.value}
                style={[s.regimeCard, active && s.regimeCardActive]}
                onPress={() => onToggle(r.value)}
              >
                <Icon name={r.icon} size={22} color={active ? '#fff' : colors.primary} />
                <View style={s.regimeInfo}>
                  <Text style={[s.regimeTitle, active && s.textWhite]}>{r.title}</Text>
                  <Text style={[s.regimeDesc, active && s.textWhiteOpacity]}>{r.desc}</Text>
                </View>
                {active && <Icon name="check-circle" size={18} color="#fff" />}
              </Pressable>
            );
          })}
        </View>
      </ScrollView>

      <Pressable
        style={s.satLink}
        onPress={() => Linking.openURL('https://www.sat.gob.mx/personas/declaraciones')}
      >
        <Icon name="school-outline" size={15} color={colors.primary} />
        <Text style={s.satLinkText}>¿No sabes cuál es el tuyo? Consulta el SAT</Text>
        <Icon name="open-in-new" size={13} color={colors.textMuted} />
      </Pressable>

      <Pressable style={[s.primaryButton, { marginTop: 4 }]} onPress={onNext}>
        <Text style={s.primaryButtonText}>
          {selected.length === 0 ? 'Continuar' : `Continuar (${selected.length} seleccionado${selected.length !== 1 ? 's' : ''})`}
        </Text>
        <Icon name="arrow-right" size={20} color="#fff" />
      </Pressable>
    </View>
  );
}

function RecommendationsSlide({ colors, s, regime, ageRange, goals, name, onNext }: { colors: ColorPalette; s: any; regime: FiscalRegime | null; ageRange: string; goals: FinancialGoal[]; name: string; onNext: () => void }) {
  const firstName = name.split(' ')[0] || 'tú';
  const recommendations = getRecommendations(regime, ageRange, goals);
  const annualSaving = regime ? estimateTaxSavings(5000 * 12, regime) : 0;
  const deductibles = regime ? (REGIME_DEDUCTIBLES[regime] ?? []) : [];
  const regimeLabel = regime ? REGIME_LABELS[regime] : '';
  const isTaxPayer = regime && regime !== 'no_facturo';

  return (
    <Animated.View entering={FadeInDown.duration(400)} style={s.slide}>
      <Text style={s.slideTitle}>Perfecto, {firstName} 👋</Text>
      <Text style={s.slideSubtitle}>Basado en tu perfil, esto es lo que EXPENSIA puede hacer por ti</Text>

      {isTaxPayer && (
        <Animated.View entering={FadeInDown.delay(100).duration(400)} style={s.savingsHero}>
          <Icon name="cash-multiple" size={32} color={colors.primary} />
          <Text style={s.savingsTitle}>Podrías ahorrar hasta</Text>
          <Text style={s.savingsAmount}>{formatCurrency(annualSaving)}</Text>
          <Text style={s.savingsSubtitle}>al año como {regimeLabel}</Text>
        </Animated.View>
      )}

      <View style={s.recoList}>
        {recommendations.map((reco, i) => (
          <Animated.View key={i} entering={FadeInDown.delay(150 + i * 80).duration(350)} style={s.recoRow}>
            <View style={s.recoIconWrap}>
              <Icon name="lightbulb-on-outline" size={16} color={colors.primary} />
            </View>
            <Text style={s.recoText}>{reco}</Text>
          </Animated.View>
        ))}
      </View>

      {deductibles.length > 0 && (
        <Animated.View entering={FadeInDown.delay(400).duration(350)} style={s.deductibleBox}>
          <Text style={s.deductibleTitle}>Gastos deducibles para ti</Text>
          <View style={s.deductibleList}>
            {deductibles.map(d => (
              <View key={d} style={s.deductibleRow}>
                <Icon name="check-circle-outline" size={13} color={colors.success} />
                <Text style={s.deductibleItem}>{d}</Text>
              </View>
            ))}
          </View>
        </Animated.View>
      )}

      <Pressable style={[s.primaryButton, { marginTop: 8 }]} onPress={onNext}>
        <Text style={s.primaryButtonText}>¡Empecemos!</Text>
        <Icon name="arrow-right" size={20} color="#fff" />
      </Pressable>
    </Animated.View>
  );
}

function WidgetSlide({ colors, s, onNext }: { colors: ColorPalette; s: any; onNext: () => void }) {
  const isIOS = Platform.OS === 'ios';

  const iosSteps = [
    'Mantén presionada la pantalla de inicio hasta que los íconos tiemblen',
    'Toca el botón "+" en la esquina superior izquierda',
    'Busca "EXPENSIA" en la lista',
    'Elige el tamaño de widget que prefieras y toca "Agregar widget"',
  ];

  const androidSteps = [
    'Mantén presionada la pantalla de inicio',
    'Toca "Widgets" en el menú que aparece',
    'Busca "EXPENSIA" en la lista de widgets',
    'Mantén presionado el widget y arrástralo a la pantalla de inicio',
  ];

  const steps = isIOS ? iosSteps : androidSteps;

  return (
    <Animated.View entering={FadeInDown.duration(400)} style={s.slide}>
      <View style={s.heroIcon}>
        <Icon name="view-grid-plus-outline" size={44} color={colors.primary} />
      </View>
      <Text style={s.slideTitle}>Activa el Widget</Text>
      <Text style={s.slideSubtitle}>
        Ve tus gastos del mes directamente en tu pantalla de inicio sin abrir la app
      </Text>

      {/* Widget preview mockup */}
      <View style={s.widgetPreview}>
        <View style={s.widgetHeader}>
          <Text style={s.widgetLogo}>◆ EXPENSIA</Text>
          <Text style={s.widgetMonth}>Junio</Text>
        </View>
        <Text style={s.widgetAmount}>$0.00</Text>
        <Text style={s.widgetLabel}>Gastos del mes</Text>
        <View style={s.widgetBar}>
          <View style={[s.widgetBarFill, { width: '30%' }]} />
        </View>
        <Text style={s.widgetSub}>30% del presupuesto</Text>
      </View>

      {/* Info — iOS no permite abrir el picker automáticamente */}
      <View style={s.widgetInfoBox}>
        <Icon name="information-outline" size={16} color={colors.textMuted} />
        <Text style={s.widgetInfoText}>
          iOS no permite agregar widgets automáticamente. Sigue estos pasos en tu pantalla de inicio:
        </Text>
      </View>

      <View style={s.widgetSteps}>
        {steps.map((step, i) => (
          <View key={i} style={s.widgetStep}>
            <View style={s.widgetStepNum}>
              <Text style={s.widgetStepNumText}>{i + 1}</Text>
            </View>
            <Text style={s.widgetStepText}>{step}</Text>
          </View>
        ))}
      </View>

      <Pressable style={s.primaryButton} onPress={onNext}>
        <Text style={s.primaryButtonText}>Ya lo agregué — Continuar</Text>
        <Icon name="arrow-right" size={20} color="#fff" />
      </Pressable>
      <Pressable style={s.skipButton} onPress={onNext}>
        <Text style={s.skipText}>Lo hago después</Text>
      </Pressable>
    </Animated.View>
  );
}

function FirstExpenseSlide({ colors, s, value, onChange, onNext, onSkip }: { colors: ColorPalette; s: any; value: string; onChange: (t: string) => void; onNext: () => void; onSkip: () => void }) {
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

function ReadySlide({ colors, s, name, regime, onFinish }: { colors: ColorPalette; s: any; name: string; regime: FiscalRegime | null; onFinish: () => void }) {
  const firstName = name.split(' ')[0] || '';
  return (
    <Animated.View entering={FadeIn.duration(500)} style={[s.slide, s.readySlide]}>
      <Animated.View entering={FadeInDown.delay(100).duration(500)} style={s.readyCheck}>
        <Icon name="check-circle" size={72} color={colors.primary} />
      </Animated.View>
      <Animated.Text entering={FadeInDown.delay(200).duration(400)} style={s.readyTitle}>
        {firstName ? `¡Listo, ${firstName}!` : '¡Todo listo!'}
      </Animated.Text>
      <Animated.Text entering={FadeInDown.delay(300).duration(400)} style={s.readySubtitle}>
        Tu perfil está configurado.{'\n'}Empieza a registrar y descubre cuánto puedes ahorrar.
      </Animated.Text>
      <Animated.View entering={FadeInDown.delay(400).duration(400)} style={s.readyStat}>
        <Icon name="lightning-bolt" size={20} color={colors.primary} />
        <Text style={s.readyStatText}>
          Usuarios ahorran en promedio <Text style={s.readyStatBold}>$4,200/año</Text> en deducciones
        </Text>
      </Animated.View>
      <Animated.View entering={FadeInDown.delay(500).duration(400)} style={{ width: '100%' }}>
        <Pressable style={s.primaryButton} onPress={onFinish}>
          <Text style={s.primaryButtonText}>Ir a EXPENSIA</Text>
          <Icon name="rocket-launch-outline" size={20} color="#fff" />
        </Pressable>
      </Animated.View>
    </Animated.View>
  );
}

/* ─── Styles ─────────────────────────────────────── */

const useStyles = (colors: ColorPalette) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 8 },
    backButton: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
    dotsRow: { flex: 1, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 5 },
    dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.border },
    dotActive: { backgroundColor: colors.primary, width: 20, borderRadius: 3 },
    slide: { width: SCREEN_WIDTH, flex: 1, paddingHorizontal: 24, paddingBottom: 24, alignItems: 'center', justifyContent: 'center', gap: 14 },
    welcomeHero: { alignItems: 'center', gap: 10, marginBottom: 4 },
    logoImage: { width: 120, height: 120, marginBottom: 4 },
    appName: { color: colors.primary, fontSize: 32, fontFamily: font.black, letterSpacing: 4 },
    tagline: { color: colors.text, fontSize: 20, fontFamily: font.bold, textAlign: 'center', lineHeight: 28 },
    welcomeBullets: { width: '100%', backgroundColor: colors.surface, borderRadius: 18, padding: 18, gap: 12 },
    bulletRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    bulletText: { color: colors.text, fontSize: 14, fontFamily: font.medium, flex: 1 },
    slideTitle: { color: colors.text, fontSize: 26, fontFamily: font.extrabold, textAlign: 'center' },
    slideSubtitle: { color: colors.textMuted, fontSize: 14, textAlign: 'center', lineHeight: 20 },
    heroIcon: { width: 88, height: 88, borderRadius: 44, backgroundColor: colors.primary + '18', alignItems: 'center', justifyContent: 'center' },
    textInput: { width: '100%', backgroundColor: colors.surface, borderRadius: 16, borderWidth: 1, borderColor: colors.border, padding: 16, fontSize: 16, color: colors.text },
    // Age
    ageList: { width: '100%', gap: 8 },
    ageCard: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.surface, borderRadius: 14, borderWidth: 1, borderColor: colors.border, padding: 14 },
    ageCardActive: { backgroundColor: colors.primary, borderColor: colors.primary },
    ageEmoji: { fontSize: 24 },
    ageInfo: { flex: 1 },
    ageLabel: { color: colors.text, fontSize: 15, fontFamily: font.bold },
    ageDesc: { color: colors.textMuted, fontSize: 11, marginTop: 2 },
    // Regime
    regimeScroll: { width: '100%', maxHeight: 340 },
    regimeList: { gap: 8, paddingBottom: 8 },
    regimeCard: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.surface, borderRadius: 14, borderWidth: 1, borderColor: colors.border, padding: 14 },
    regimeCardActive: { backgroundColor: colors.primary, borderColor: colors.primary },
    regimeInfo: { flex: 1, gap: 2 },
    regimeTitle: { color: colors.text, fontSize: 14, fontFamily: font.bold },
    regimeDesc: { color: colors.textMuted, fontSize: 11 },
    textWhite: { color: '#fff' },
    textWhiteOpacity: { color: 'rgba(255,255,255,0.8)' },
    // Recommendations
    savingsHero: { alignItems: 'center', gap: 4, backgroundColor: colors.surface, borderRadius: 20, padding: 20, width: '100%', borderWidth: 1, borderColor: colors.border },
    savingsTitle: { color: colors.textMuted, fontSize: 13, fontFamily: font.semibold },
    savingsAmount: { color: colors.primary, fontSize: 38, fontFamily: font.black, letterSpacing: -1 },
    savingsSubtitle: { color: colors.textMuted, fontSize: 12 },
    recoList: { width: '100%', gap: 10 },
    recoRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, backgroundColor: colors.surface, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: colors.border },
    recoIconWrap: { width: 28, height: 28, borderRadius: 14, backgroundColor: colors.primary + '18', alignItems: 'center', justifyContent: 'center', marginTop: 1 },
    recoText: { flex: 1, color: colors.text, fontSize: 13, lineHeight: 19 },
    deductibleBox: { width: '100%', backgroundColor: colors.surface, borderRadius: 16, padding: 14, gap: 8, borderWidth: 1, borderColor: colors.border },
    deductibleTitle: { color: colors.text, fontSize: 13, fontFamily: font.bold },
    deductibleList: { gap: 5 },
    deductibleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    deductibleItem: { color: colors.textMuted, fontSize: 12 },
    // SAT link
    satLink: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 10, paddingHorizontal: 14, backgroundColor: colors.primary + '10', borderRadius: 12, borderWidth: 1, borderColor: colors.primary + '30', width: '100%' },
    satLinkText: { flex: 1, color: colors.primary, fontSize: 12, fontFamily: font.semibold },
    // CSF upload button
    csfButton: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.surface, borderRadius: 14, borderWidth: 1, borderColor: colors.primary + '40', padding: 14, width: '100%', marginBottom: 4 },
    csfButtonSuccess: { borderColor: '#22C55E40', backgroundColor: '#22C55E08' },
    csfButtonTitle: { fontSize: 13, fontFamily: font.bold, color: colors.text },
    csfButtonDesc: { fontSize: 11, fontFamily: font.regular, color: colors.textMuted, marginTop: 2 },
    // Divider
    dividerRow: { flexDirection: 'row', alignItems: 'center', gap: 8, width: '100%', marginVertical: 8 },
    dividerLine: { flex: 1, height: 1, backgroundColor: colors.border },
    dividerText: { fontSize: 11, color: colors.textMuted, fontFamily: font.medium },
    // Goals
    goalsGrid: { width: '100%', flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    goalCard: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.surface, borderRadius: 14, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 12, paddingVertical: 10, width: '48%' },
    goalCardActive: { backgroundColor: colors.primary, borderColor: colors.primary },
    goalEmoji: { fontSize: 18 },
    goalLabel: { color: colors.text, fontSize: 12, fontFamily: font.semibold, flex: 1, lineHeight: 16 },
    // Widget
    widgetPreview: { width: '80%', backgroundColor: colors.surface, borderRadius: 20, padding: 16, gap: 6, borderWidth: 1, borderColor: colors.border, alignItems: 'flex-start' },
    widgetHeader: { flexDirection: 'row', justifyContent: 'space-between', width: '100%' },
    widgetLogo: { color: colors.primary, fontSize: 11, fontFamily: font.bold },
    widgetMonth: { color: colors.textMuted, fontSize: 11 },
    widgetAmount: { color: colors.text, fontSize: 28, fontFamily: font.black, marginTop: 4 },
    widgetLabel: { color: colors.textMuted, fontSize: 11 },
    widgetBar: { width: '100%', height: 4, backgroundColor: colors.border, borderRadius: 2, marginTop: 8 },
    widgetBarFill: { height: 4, backgroundColor: colors.primary, borderRadius: 2 },
    widgetSub: { color: colors.textMuted, fontSize: 10 },
    widgetInfoBox: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, backgroundColor: colors.surfaceAlt, borderRadius: 12, padding: 12, width: '100%' },
    widgetInfoText: { flex: 1, color: colors.textMuted, fontSize: 12, lineHeight: 17 },
    widgetSteps: { width: '100%', gap: 10 },
    widgetStep: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
    widgetStepNum: { width: 22, height: 22, borderRadius: 11, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', marginTop: 1 },
    widgetStepNumText: { color: '#fff', fontSize: 11, fontFamily: font.bold },
    widgetStepText: { flex: 1, color: colors.textMuted, fontSize: 13, lineHeight: 18 },
    // First expense
    exampleText: { color: colors.primary, fontFamily: font.bold },
    hints: { width: '100%', backgroundColor: colors.surface, borderRadius: 14, padding: 14, gap: 6 },
    hintText: { color: colors.textMuted, fontSize: 12 },
    // Ready
    readySlide: { justifyContent: 'center' },
    readyCheck: { marginBottom: 8 },
    readyTitle: { color: colors.text, fontSize: 30, fontFamily: font.black, textAlign: 'center' },
    readySubtitle: { color: colors.textMuted, fontSize: 15, textAlign: 'center', lineHeight: 22 },
    readyStat: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.primary + '15', borderRadius: 14, padding: 14, width: '100%' },
    readyStatText: { color: colors.text, fontSize: 13, flex: 1, lineHeight: 18 },
    readyStatBold: { color: colors.primary, fontFamily: font.extrabold },
    // Shared
    primaryButton: { width: '100%', backgroundColor: colors.primary, paddingVertical: 16, borderRadius: 16, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 8 },
    primaryButtonText: { color: '#fff', fontSize: 16, fontFamily: font.extrabold },
    skipButton: { paddingVertical: 10 },
    skipText: { color: colors.textMuted, fontSize: 14, fontFamily: font.semibold },
  });
