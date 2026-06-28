import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { PurchasesPackage } from 'react-native-purchases';
import {
  getOfferings,
  purchasePackage,
  restorePurchases,
} from '../services/revenuecatService';
import { track } from '../services/analyticsService';
import { usePremiumStore } from '../store/usePremiumStore';
import { ColorPalette } from '../theme/colors';
import { font } from '../theme/typography';
import { useTheme } from '../theme/ThemeContext';

type PaywallTrigger =
  | 'ocr_limit'
  | 'history'
  | 'fiscal_report'
  | 'export'
  | 'tax_detail';

interface Props {
  visible: boolean;
  onClose: () => void;
  trigger?: PaywallTrigger;
}

const BENEFITS = [
  { icon: 'camera-iris', text: 'Escaneos de tickets ilimitados' },
  { icon: 'bank-transfer-in', text: 'Importar estados de cuenta' },
  { icon: 'file-chart-outline', text: 'Reporte fiscal en PDF y CSV' },
  { icon: 'shield-check-outline', text: 'Detecta deducciones al escanear' },
  { icon: 'lightbulb-on-outline', text: 'Todos los insights personalizados' },
  { icon: 'headset', text: 'Soporte prioritario por email' },
];

interface PackageInfo {
  pkg: PurchasesPackage;
  label: string;
  price: string;
  period: string;
  isAnnual: boolean;
}

export function PaywallModal({ visible, onClose }: Props) {
  const { colors, isDark } = useTheme();
  const s = useStyles(colors, isDark);
  const setPlan = usePremiumStore(state => state.setPlan);
  const syncWithRevenueCat = usePremiumStore(state => state.syncWithRevenueCat);
  const trialEndsAt = usePremiumStore(state => state.trialEndsAt);

  const trialDaysLeft = trialEndsAt
    ? Math.max(
        0,
        Math.ceil((new Date(trialEndsAt).getTime() - Date.now()) / 86400000),
      )
    : 0;
  const isInTrial = trialDaysLeft > 0;

  const [loading, setLoading] = useState(false);
  const [purchasing, setPurchasing] = useState(false);
  const [packages, setPackages] = useState<PackageInfo[]>([]);
  const [selectedPlan, setSelectedPlan] = useState<'monthly' | 'yearly'>(
    'yearly',
  );

  useEffect(() => {
    if (visible) {
      loadOfferings();
      track('paywall_viewed');
    }
  }, [visible]);

  const loadOfferings = async () => {
    setLoading(true);
    try {
      const offering = await getOfferings();
      if (offering?.availablePackages) {
        const pkgs: PackageInfo[] = offering.availablePackages.map(pkg => {
          const isAnnual = pkg.packageType === 'ANNUAL';
          return {
            pkg,
            label: isAnnual ? 'Anual' : 'Mensual',
            price: pkg.product.priceString,
            period: isAnnual ? '/año' : '/mes',
            isAnnual,
          };
        });
        setPackages(pkgs);
      }
    } catch {
    } finally {
      setLoading(false);
    }
  };

  const handlePurchase = async () => {
    const isYearly = selectedPlan === 'yearly';
    const pkg = packages.find(p => p.isAnnual === isYearly) ?? packages[0];
    if (!pkg) {
      Alert.alert(
        'Próximamente',
        'Las suscripciones estarán disponibles pronto.',
      );
      return;
    }
    setPurchasing(true);
    try {
      const success = await purchasePackage(pkg.pkg);
      if (success) {
        await syncWithRevenueCat();
        Alert.alert(
          '¡Bienvenido a Pro!',
          'Tu suscripción se activó correctamente.',
        );
        onClose();
      }
    } catch {
      Alert.alert('Error', 'No se pudo completar la compra. Intenta de nuevo.');
    } finally {
      setPurchasing(false);
    }
  };

  const handleRestore = async () => {
    setPurchasing(true);
    try {
      const success = await restorePurchases();
      if (success) {
        await syncWithRevenueCat();
        Alert.alert(
          'Compra restaurada',
          'Tu suscripción Pro se restauró correctamente.',
        );
        onClose();
      } else {
        Alert.alert('Sin compras', 'No se encontraron compras anteriores.');
      }
    } catch {
      Alert.alert('Error', 'No se pudieron restaurar las compras.');
    } finally {
      setPurchasing(false);
    }
  };

  const yearlyPkg = packages.find(p => p.isAnnual);
  const monthlyPkg = packages.find(p => !p.isAnnual);
  const yearlyPrice = yearlyPkg?.price ?? '$599 MXN';
  const monthlyPrice = monthlyPkg?.price ?? '$79 MXN';

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={s.root}>
        <Pressable style={s.closeBtn} onPress={onClose} hitSlop={16}>
          <Icon name="close" size={20} color={colors.textMuted} />
        </Pressable>

        <ScrollView
          contentContainerStyle={s.scroll}
          showsVerticalScrollIndicator={false}
        >
          {/* Trial banner */}
          {isInTrial && (
            <Animated.View
              entering={FadeIn.duration(300)}
              style={s.trialBanner}
            >
              <Icon name="clock-outline" size={16} color={colors.warning} />
              <Text style={s.trialBannerText}>
                {trialDaysLeft === 1
                  ? 'Tu prueba gratuita termina mañana'
                  : `Te quedan ${trialDaysLeft} días de prueba gratuita`}
              </Text>
            </Animated.View>
          )}

          {/* Hero */}
          <Animated.View entering={FadeIn.duration(400)} style={s.hero}>
            <View style={s.heroIconWrap}>
              <Icon
                name="shield-crown-outline"
                size={44}
                color={colors.primary}
              />
            </View>
            <Text style={s.heroTitle}>EXORA Pro</Text>
            <Text style={s.heroSub}>
              Paga menos impuestos.{'\n'}Lleva tus finanzas en serio.
            </Text>
          </Animated.View>

          {/* Benefits */}
          <Animated.View
            entering={FadeInDown.delay(100).duration(350)}
            style={s.benefitsCard}
          >
            {BENEFITS.map((b, i) => (
              <View
                key={b.icon}
                style={[
                  s.benefitRow,
                  i < BENEFITS.length - 1 && s.benefitBorder,
                ]}
              >
                <View style={s.benefitIconWrap}>
                  <Icon name={b.icon} size={18} color={colors.primary} />
                </View>
                <Text style={s.benefitText}>{b.text}</Text>
                <Icon name="check" size={16} color={colors.primary} />
              </View>
            ))}
          </Animated.View>

          {/* Plan selector */}
          <Animated.View
            entering={FadeInDown.delay(200).duration(350)}
            style={s.plans}
          >
            {/* Anual */}
            <Pressable
              style={[
                s.planCard,
                selectedPlan === 'yearly' && s.planCardSelected,
              ]}
              onPress={() => setSelectedPlan('yearly')}
            >
              <View style={s.planTop}>
                <View style={s.popularBadge}>
                  <Text style={s.popularText}>MEJOR PRECIO</Text>
                </View>
                <View
                  style={[
                    s.radio,
                    selectedPlan === 'yearly' && s.radioSelected,
                  ]}
                >
                  {selectedPlan === 'yearly' && <View style={s.radioDot} />}
                </View>
              </View>
              <Text style={s.planName}>Anual</Text>
              <Text style={s.planPrice}>{yearlyPrice}</Text>
              <Text style={s.planEquiv}>$49.90/mes · Ahorra 37%</Text>
            </Pressable>

            {/* Mensual */}
            <Pressable
              style={[
                s.planCard,
                selectedPlan === 'monthly' && s.planCardSelected,
              ]}
              onPress={() => setSelectedPlan('monthly')}
            >
              <View style={s.planTop}>
                <View
                  style={[
                    s.radio,
                    selectedPlan === 'monthly' && s.radioSelected,
                  ]}
                >
                  {selectedPlan === 'monthly' && <View style={s.radioDot} />}
                </View>
              </View>
              <Text style={s.planName}>Mensual</Text>
              <Text style={s.planPrice}>{monthlyPrice}</Text>
              <Text style={s.planEquiv}>Sin compromiso anual</Text>
            </Pressable>
          </Animated.View>

          {/* CTA */}
          <Animated.View entering={FadeInDown.delay(280).duration(350)}>
            <Pressable
              style={[s.cta, purchasing && s.ctaDisabled]}
              onPress={handlePurchase}
              disabled={purchasing}
            >
              {purchasing ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={s.ctaText}>
                  Suscribirme{' '}
                  {selectedPlan === 'yearly' ? '· Anual' : '· Mensual'}
                </Text>
              )}
            </Pressable>

            <Text style={s.ctaNote}>
              Cancela cuando quieras · Sin compromisos
            </Text>
          </Animated.View>

          <Pressable
            style={s.restoreBtn}
            onPress={handleRestore}
            disabled={purchasing}
          >
            <Text style={s.restoreText}>Restaurar compra</Text>
          </Pressable>
        </ScrollView>
      </View>
    </Modal>
  );
}

const useStyles = (colors: ColorPalette, isDark: boolean) =>
  StyleSheet.create({
    root: {
      flex: 1,
      backgroundColor: colors.background,
    },
    closeBtn: {
      position: 'absolute',
      top: 16,
      right: 16,
      zIndex: 10,
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: colors.surfaceAlt,
      alignItems: 'center',
      justifyContent: 'center',
    },
    scroll: {
      paddingHorizontal: 20,
      paddingTop: 56,
      paddingBottom: 48,
      gap: 20,
    },

    trialBanner: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      backgroundColor: colors.warning + '18',
      borderWidth: 1,
      borderColor: colors.warning + '40',
      borderRadius: 12,
      paddingHorizontal: 14,
      paddingVertical: 10,
    },
    trialBannerText: {
      color: colors.warning,
      fontSize: 13,
      fontFamily: font.semibold,
      flex: 1,
    },

    // Hero
    hero: {
      alignItems: 'center',
      gap: 10,
    },
    heroIconWrap: {
      width: 80,
      height: 80,
      borderRadius: 24,
      backgroundColor: colors.primary + '15',
      alignItems: 'center',
      justifyContent: 'center',
    },
    heroTitle: {
      color: colors.text,
      fontSize: 28,
      fontFamily: font.black,
      letterSpacing: -0.5,
    },
    heroSub: {
      color: colors.textMuted,
      fontSize: 15,
      fontFamily: font.regular,
      textAlign: 'center',
      lineHeight: 22,
    },

    // Benefits
    benefitsCard: {
      backgroundColor: colors.surface,
      borderRadius: 20,
      paddingHorizontal: 16,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: isDark ? 0.2 : 0.06,
      shadowRadius: 10,
      elevation: 3,
    },
    benefitRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingVertical: 14,
    },
    benefitBorder: {
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    benefitIconWrap: {
      width: 32,
      height: 32,
      borderRadius: 10,
      backgroundColor: colors.primary + '12',
      alignItems: 'center',
      justifyContent: 'center',
    },
    benefitText: {
      flex: 1,
      color: colors.text,
      fontSize: 14,
      fontFamily: font.medium,
    },

    // Plans
    plans: {
      flexDirection: 'row',
      gap: 12,
    },
    planCard: {
      flex: 1,
      backgroundColor: colors.surface,
      borderRadius: 20,
      borderWidth: 2,
      borderColor: colors.border,
      padding: 16,
      gap: 4,
    },
    planCardSelected: {
      borderColor: colors.primary,
      backgroundColor: isDark ? colors.surface : colors.primary + '08',
    },
    planTop: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 8,
      minHeight: 24,
    },
    popularBadge: {
      backgroundColor: colors.primary,
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 6,
    },
    popularText: {
      color: '#fff',
      fontSize: 9,
      fontFamily: font.black,
      letterSpacing: 0.5,
    },
    radio: {
      width: 20,
      height: 20,
      borderRadius: 10,
      borderWidth: 2,
      borderColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    radioSelected: {
      borderColor: colors.primary,
    },
    radioDot: {
      width: 10,
      height: 10,
      borderRadius: 5,
      backgroundColor: colors.primary,
    },
    planName: {
      color: colors.textMuted,
      fontSize: 12,
      fontFamily: font.semibold,
    },
    planPrice: {
      color: colors.text,
      fontSize: 22,
      fontFamily: font.black,
      letterSpacing: -0.5,
      marginTop: 2,
    },
    planEquiv: {
      color: colors.primary,
      fontSize: 11,
      fontFamily: font.semibold,
      marginTop: 2,
    },

    // CTA
    cta: {
      backgroundColor: colors.primary,
      paddingVertical: 18,
      borderRadius: 18,
      alignItems: 'center',
      justifyContent: 'center',
      shadowColor: colors.primary,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.35,
      shadowRadius: 12,
      elevation: 6,
    },
    ctaDisabled: { opacity: 0.6 },
    ctaText: {
      color: '#fff',
      fontSize: 17,
      fontFamily: font.bold,
    },
    ctaNote: {
      color: colors.textMuted,
      fontSize: 12,
      fontFamily: font.regular,
      textAlign: 'center',
      marginTop: 10,
    },
    restoreBtn: {
      alignItems: 'center',
      paddingVertical: 8,
    },
    restoreText: {
      color: colors.textMuted,
      fontSize: 13,
      fontFamily: font.medium,
    },
  });
