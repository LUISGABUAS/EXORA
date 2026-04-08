import React, { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { FadeInDown } from 'react-native-reanimated';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useExpenseStore } from '../store/useExpenseStore';
import { FiscalRegime, usePremiumStore } from '../store/usePremiumStore';
import { ColorPalette } from '../theme/colors';
import { useTheme } from '../theme/ThemeContext';
import { classifyExpense } from '../utils/classifier';
import { localDateString } from '../utils/format';
import { parseSmartInput } from '../utils/smartInputParser';

type Step = 1 | 2 | 3;

const REGIMES: Array<{ value: FiscalRegime; icon: string; title: string; desc: string }> = [
  { value: 'resico', icon: 'account-check', title: 'RESICO', desc: 'Régimen Simplificado de Confianza' },
  { value: 'actividad_empresarial', icon: 'briefcase-outline', title: 'Actividad Empresarial', desc: 'Freelancers y profesionistas independientes' },
  { value: 'no_facturo', icon: 'wallet-outline', title: 'No facturo', desc: 'Solo quiero controlar mis gastos' },
];

export function OnboardingScreen() {
  const { colors } = useTheme();
  const s = useStyles(colors);
  const completeOnboarding = usePremiumStore(state => state.completeOnboarding);
  const setFiscalRegime = usePremiumStore(state => state.setFiscalRegime);
  const addExpense = useExpenseStore(state => state.addExpense);

  const [step, setStep] = useState<Step>(1);
  const [selectedRegime, setSelectedRegime] = useState<FiscalRegime | null>(null);
  const [inputText, setInputText] = useState('');

  const finish = async () => {
    if (selectedRegime) {
      await setFiscalRegime(selectedRegime);
    }
    await completeOnboarding();
  };

  const handleNext = async () => {
    if (step === 1) {
      setStep(2);
    } else if (step === 2) {
      if (!selectedRegime) {
        Alert.alert('Selecciona un régimen', 'Elige cómo facturas para personalizar tu experiencia.');
        return;
      }
      setStep(3);
    } else if (step === 3) {
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
      await finish();
    }
  };

  const handleSkip = async () => {
    await finish();
  };

  return (
    <SafeAreaView style={s.container}>
      {/* Progress dots */}
      <View style={s.dotsRow}>
        {[1, 2, 3].map(i => (
          <View key={i} style={[s.dot, i === step && s.dotActive]} />
        ))}
      </View>

      {step === 1 ? (
        <Animated.View entering={FadeInDown.duration(350)} style={s.stepContainer}>
          <View style={s.heroIcon}>
            <Icon name="chart-line" size={48} color={colors.primary} />
          </View>
          <Text style={s.title}>Expensia te dice cuánto dinero estás dejando en el SAT</Text>
          <Text style={s.subtitle}>
            Registra tus gastos y descubre tu ahorro fiscal real cada mes.
          </Text>
          <Pressable style={s.primaryButton} onPress={handleNext}>
            <Text style={s.primaryButtonText}>Continuar</Text>
          </Pressable>
        </Animated.View>
      ) : null}

      {step === 2 ? (
        <Animated.View entering={FadeInDown.duration(350)} style={s.stepContainer}>
          <Text style={s.title}>¿Cómo facturas?</Text>
          <Text style={s.subtitle}>
            Esto nos ayuda a calcular tu ahorro fiscal.
          </Text>
          <View style={s.regimeList}>
            {REGIMES.map(r => (
              <Pressable
                key={r.value}
                style={[s.regimeCard, selectedRegime === r.value && s.regimeCardActive]}
                onPress={() => setSelectedRegime(r.value)}
              >
                <Icon
                  name={r.icon}
                  size={24}
                  color={selectedRegime === r.value ? colors.white : colors.primary}
                />
                <View style={s.regimeInfo}>
                  <Text style={[s.regimeTitle, selectedRegime === r.value && s.regimeTitleActive]}>
                    {r.title}
                  </Text>
                  <Text style={[s.regimeDesc, selectedRegime === r.value && s.regimeDescActive]}>
                    {r.desc}
                  </Text>
                </View>
              </Pressable>
            ))}
          </View>
          <Pressable style={s.primaryButton} onPress={handleNext}>
            <Text style={s.primaryButtonText}>Continuar</Text>
          </Pressable>
        </Animated.View>
      ) : null}

      {step === 3 ? (
        <Animated.View entering={FadeInDown.duration(350)} style={s.stepContainer}>
          <Text style={s.title}>Registra tu primer gasto</Text>
          <Text style={s.subtitle}>
            Escribe algo como "150 uber ayer" o "Netflix"
          </Text>
          <TextInput
            style={s.textInput}
            placeholder="Ej: 250 comida uber eats"
            placeholderTextColor={colors.textMuted}
            value={inputText}
            onChangeText={setInputText}
            autoFocus
          />
          <Pressable style={s.primaryButton} onPress={handleNext}>
            <Text style={s.primaryButtonText}>Comenzar</Text>
          </Pressable>
          <Pressable style={s.skipButton} onPress={handleSkip}>
            <Text style={s.skipText}>Omitir</Text>
          </Pressable>
        </Animated.View>
      ) : null}
    </SafeAreaView>
  );
}

const useStyles = (colors: ColorPalette) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
      paddingHorizontal: 24,
    },
    dotsRow: {
      flexDirection: 'row',
      justifyContent: 'center',
      gap: 8,
      paddingVertical: 16,
    },
    dot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: colors.border,
    },
    dotActive: {
      backgroundColor: colors.primary,
      width: 24,
    },
    stepContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      gap: 20,
      paddingBottom: 40,
    },
    heroIcon: {
      width: 96,
      height: 96,
      borderRadius: 48,
      backgroundColor: colors.primary + '15',
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 8,
    },
    title: {
      color: colors.text,
      fontSize: 24,
      fontWeight: '800',
      textAlign: 'center',
      lineHeight: 32,
    },
    subtitle: {
      color: colors.textMuted,
      fontSize: 15,
      textAlign: 'center',
      lineHeight: 22,
    },
    regimeList: {
      width: '100%',
      gap: 12,
    },
    regimeCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 14,
      backgroundColor: colors.surface,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 16,
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
      fontSize: 16,
      fontWeight: '700',
    },
    regimeTitleActive: {
      color: colors.white,
    },
    regimeDesc: {
      color: colors.textMuted,
      fontSize: 12,
    },
    regimeDescActive: {
      color: colors.white,
      opacity: 0.8,
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
    primaryButton: {
      width: '100%',
      backgroundColor: colors.primary,
      paddingVertical: 16,
      borderRadius: 16,
      alignItems: 'center',
    },
    primaryButtonText: {
      color: colors.white,
      fontSize: 16,
      fontWeight: '800',
    },
    skipButton: {
      paddingVertical: 8,
    },
    skipText: {
      color: colors.textMuted,
      fontSize: 14,
      fontWeight: '600',
    },
  });
