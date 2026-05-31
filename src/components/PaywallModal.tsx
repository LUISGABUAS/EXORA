import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { PurchasesPackage } from 'react-native-purchases';
import {
  getOfferings,
  purchasePackage,
  restorePurchases,
} from '../services/revenuecatService';
import { usePremiumStore } from '../store/usePremiumStore';
import { ColorPalette } from '../theme/colors';
import { useTheme } from '../theme/ThemeContext';

type PaywallTrigger = 'ocr_limit' | 'history' | 'fiscal_report' | 'export' | 'tax_detail';

interface Props {
  visible: boolean;
  onClose: () => void;
  trigger: PaywallTrigger;
}

const BENEFITS = [
  { icon: 'camera-iris', text: 'Escaneos de tickets ilimitados' },
  { icon: 'bank-transfer-in', text: 'Importar estados de cuenta bancarios' },
  { icon: 'file-chart-outline', text: 'Exportar reporte fiscal en PDF y CSV' },
  { icon: 'calculator-variant', text: 'Cálculo de ahorro fiscal automático' },
  { icon: 'lightbulb-on-outline', text: 'Todos los insights personalizados' },
  { icon: 'shield-check-outline', text: 'Detecta deducciones al escanear tickets' },
];

interface PackageInfo {
  pkg: PurchasesPackage;
  label: string;
  price: string;
  period: string;
}

export function PaywallModal({ visible, onClose }: Props) {
  const { colors } = useTheme();
  const s = useStyles(colors);
  const setPlan = usePremiumStore(state => state.setPlan);
  const syncWithRevenueCat = usePremiumStore(state => state.syncWithRevenueCat);

  const [loading, setLoading] = useState(false);
  const [purchasing, setPurchasing] = useState(false);
  const [packages, setPackages] = useState<PackageInfo[]>([]);

  useEffect(() => {
    if (visible) {
      loadOfferings();
    }
  }, [visible]);

  const loadOfferings = async () => {
    setLoading(true);
    try {
      const offering = await getOfferings();
      if (offering?.availablePackages) {
        const pkgs: PackageInfo[] = offering.availablePackages.map(pkg => {
          const product = pkg.product;
          const isAnnual = pkg.packageType === 'ANNUAL';
          return {
            pkg,
            label: isAnnual ? 'Anual' : 'Mensual',
            price: product.priceString,
            period: isAnnual ? '/año' : '/mes',
          };
        });
        setPackages(pkgs);
      }
    } catch {
      // Fallback to hardcoded prices
    } finally {
      setLoading(false);
    }
  };

  const handlePurchase = async (pkgInfo?: PackageInfo) => {
    if (pkgInfo) {
      setPurchasing(true);
      try {
        const success = await purchasePackage(pkgInfo.pkg);
        if (success) {
          await syncWithRevenueCat();
          Alert.alert('Bienvenido a Premium', 'Tu suscripción se activó correctamente.');
          onClose();
        }
      } catch (error) {
        Alert.alert('Error', 'No se pudo completar la compra. Intenta de nuevo.');
      } finally {
        setPurchasing(false);
      }
    } else {
      // Fallback if no RC packages available
      Alert.alert('Próximamente', 'Las suscripciones estarán disponibles pronto.');
    }
  };

  const handleRestore = async () => {
    setPurchasing(true);
    try {
      const success = await restorePurchases();
      if (success) {
        await syncWithRevenueCat();
        Alert.alert('Compra restaurada', 'Tu suscripción Premium se restauró correctamente.');
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

  const monthlyPkg = packages.find(p => p.label === 'Mensual');
  const yearlyPkg = packages.find(p => p.label === 'Anual');

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={s.container}>
        <Pressable style={s.closeButton} onPress={onClose} hitSlop={12}>
          <Icon name="close" size={24} color={colors.textMuted} />
        </Pressable>

        <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
          {/* Hero */}
          <View style={s.heroSection}>
            <View style={s.heroIcon}>
              <Icon name="shield-crown-outline" size={48} color={colors.primary} />
            </View>
            <Text style={s.heroTitle}>
              Podrías estar ahorrando en impuestos y no lo sabes
            </Text>
          </View>

          {/* Benefits */}
          <View style={s.benefitsList}>
            {BENEFITS.map(b => (
              <View key={b.icon} style={s.benefitRow}>
                <Icon name={b.icon} size={20} color={colors.primary} />
                <Text style={s.benefitText}>{b.text}</Text>
              </View>
            ))}
          </View>

          {/* Loading */}
          {loading ? (
            <ActivityIndicator size="small" color={colors.primary} />
          ) : null}

          {/* Pricing Cards */}
          <View style={s.pricingRow}>
            {/* Monthly */}
            <Pressable
              style={s.pricingCard}
              onPress={() => handlePurchase(monthlyPkg)}
              disabled={purchasing}
            >
              <Text style={s.pricingPeriod}>Mensual</Text>
              <Text style={s.pricingPrice}>{monthlyPkg?.price || '$79 MXN'}</Text>
              <Text style={s.pricingUnit}>/mes</Text>
            </Pressable>

            {/* Yearly (highlighted) */}
            <Pressable
              style={[s.pricingCard, s.pricingCardHighlight]}
              onPress={() => handlePurchase(yearlyPkg)}
              disabled={purchasing}
            >
              <View style={s.saveBadge}>
                <Text style={s.saveBadgeText}>Ahorra 37%</Text>
              </View>
              <Text style={s.pricingPeriod}>Anual</Text>
              <Text style={s.pricingPrice}>{yearlyPkg?.price || '$599 MXN'}</Text>
              <Text style={s.pricingUnit}>/año</Text>
              <Text style={s.pricingEquiv}>$49.90 MXN/mes</Text>
            </Pressable>
          </View>

          {/* CTA */}
          <Pressable
            style={[s.ctaButton, purchasing && s.ctaDisabled]}
            onPress={() => handlePurchase(yearlyPkg || monthlyPkg)}
            disabled={purchasing}
          >
            {purchasing ? (
              <ActivityIndicator size="small" color={colors.white} />
            ) : (
              <>
                <Icon name="lock-open-outline" size={20} color={colors.white} />
                <Text style={s.ctaText}>Desbloquear ahorro</Text>
              </>
            )}
          </Pressable>

          {/* Restore */}
          <Pressable style={s.restoreButton} onPress={handleRestore} disabled={purchasing}>
            <Text style={s.restoreText}>Restaurar compra</Text>
          </Pressable>
        </ScrollView>
      </View>
    </Modal>
  );
}

const useStyles = (colors: ColorPalette) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    closeButton: {
      position: 'absolute',
      top: 16,
      right: 16,
      zIndex: 10,
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: colors.surfaceAlt,
      alignItems: 'center',
      justifyContent: 'center',
    },
    content: {
      paddingHorizontal: 24,
      paddingTop: 60,
      paddingBottom: 40,
      gap: 28,
    },
    heroSection: {
      alignItems: 'center',
      gap: 16,
    },
    heroIcon: {
      width: 88,
      height: 88,
      borderRadius: 44,
      backgroundColor: colors.primary + '15',
      alignItems: 'center',
      justifyContent: 'center',
    },
    heroTitle: {
      color: colors.text,
      fontSize: 22,
      fontWeight: '800',
      textAlign: 'center',
      lineHeight: 30,
    },
    benefitsList: {
      gap: 14,
    },
    benefitRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    benefitText: {
      color: colors.text,
      fontSize: 15,
      fontWeight: '600',
      flex: 1,
    },
    pricingRow: {
      flexDirection: 'row',
      gap: 12,
    },
    pricingCard: {
      flex: 1,
      backgroundColor: colors.surface,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 18,
      alignItems: 'center',
      gap: 4,
    },
    pricingCardHighlight: {
      borderColor: colors.primary,
      borderWidth: 2,
    },
    saveBadge: {
      backgroundColor: colors.primary,
      paddingHorizontal: 10,
      paddingVertical: 3,
      borderRadius: 999,
      marginBottom: 4,
    },
    saveBadgeText: {
      color: colors.white,
      fontSize: 11,
      fontWeight: '800',
    },
    pricingPeriod: {
      color: colors.textMuted,
      fontSize: 13,
      fontWeight: '600',
    },
    pricingPrice: {
      color: colors.text,
      fontSize: 28,
      fontWeight: '800',
    },
    pricingUnit: {
      color: colors.textMuted,
      fontSize: 13,
    },
    pricingEquiv: {
      color: colors.primary,
      fontSize: 12,
      fontWeight: '700',
      marginTop: 2,
    },
    ctaButton: {
      flexDirection: 'row',
      backgroundColor: colors.primary,
      paddingVertical: 16,
      borderRadius: 16,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
    },
    ctaDisabled: {
      opacity: 0.6,
    },
    ctaText: {
      color: colors.white,
      fontSize: 16,
      fontWeight: '800',
    },
    restoreButton: {
      alignItems: 'center',
      paddingVertical: 8,
    },
    restoreText: {
      color: colors.textMuted,
      fontSize: 13,
      fontWeight: '600',
    },
  });
