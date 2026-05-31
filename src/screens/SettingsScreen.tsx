import { font } from '../theme/typography';
import React, { useEffect, useState } from 'react';
import { Alert, Pressable, Share, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { Avatar } from '../components/Avatar';
import { PaywallModal } from '../components/PaywallModal';
import { ScreenContainer } from '../components/ScreenContainer';
import { RootStackParamList } from '../navigation/AppNavigator';
import { exportExpensesToCsv } from '../services/exportService';
import { getAvailableBiometric, getBiometricLabel } from '../services/biometricService';
import {
  applyReferralCode,
  getOrCreateReferralCode,
  REFERRAL_ERROR_MESSAGES,
} from '../services/referralService';
import {
  cancelAllReminders,
  scheduleDailyReminder,
  scheduleWeeklySummary,
} from '../services/notificationService';
import { useAuthStore } from '../store/useAuthStore';
import { useExpenseStore } from '../store/useExpenseStore';
import { FiscalRegime, usePremiumStore } from '../store/usePremiumStore';
import { ColorPalette } from '../theme/colors';
import { ThemeMode, useTheme } from '../theme/ThemeContext';
import { FISCAL_REGIME_DISPLAY } from '../types/fiscal';
import { localDateString } from '../utils/format';

const REMINDER_KEY = '@smartexpense_reminders';

const themeModes: Array<{ mode: ThemeMode; label: string; icon: string }> = [
  { mode: 'light', label: 'Claro', icon: 'white-balance-sunny' },
  { mode: 'dark', label: 'Oscuro', icon: 'moon-waning-crescent' },
  { mode: 'system', label: 'Sistema', icon: 'cellphone' },
];

const fiscalModes: Array<{ value: FiscalRegime; label: string; icon: string }> = [
  { value: 'resico', label: 'RESICO', icon: 'account-check' },
  { value: 'actividad_empresarial', label: 'Act. Empresarial', icon: 'briefcase-outline' },
  { value: 'no_facturo', label: 'No facturo', icon: 'wallet-outline' },
];

export function SettingsScreen() {
  const { colors, isDark, mode, setMode } = useTheme();
  const s = useStyles(colors, isDark);
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const expenses = useExpenseStore((state) => state.expenses);
  const session = useAuthStore(state => state.session);
  const signOut = useAuthStore(state => state.signOut);
  const isPremium = usePremiumStore(state => state.isPremium);
  const plan = usePremiumStore(state => state.plan);
  const hasFullAccess = usePremiumStore(state => state.hasFullAccess);
  const fiscalRegime = usePremiumStore(state => state.fiscalRegime);
  const setFiscalRegime = usePremiumStore(state => state.setFiscalRegime);
  const constanciaUri = usePremiumStore(state => state.constanciaUri);
  const biometricEnabled = usePremiumStore(state => state.biometricEnabled);
  const setBiometricEnabled = usePremiumStore(state => state.setBiometricEnabled);
  const trialEndsAt = usePremiumStore(state => state.trialEndsAt);
  const extendTrial = usePremiumStore(state => state.extendTrial);
  const [remindersOn, setRemindersOn] = useState(false);
  const [paywallVisible, setPaywallVisible] = useState(false);
  const [biometricType, setBiometricTypeLocal] = useState<string>('none');
  const [referralCode, setReferralCode] = useState('');
  const [myCode, setMyCode] = useState('');
  const [referralInput, setReferralInput] = useState('');
  const [referralLoading, setReferralLoading] = useState(false);

  const trialDaysLeft = trialEndsAt
    ? Math.max(0, Math.ceil((new Date(trialEndsAt).getTime() - Date.now()) / 86400000))
    : 0;
  const trialActive = trialDaysLeft > 0 && !isPremium;

  const userName = session?.user?.user_metadata?.full_name
    || session?.user?.email?.split('@')[0]
    || 'Usuario';
  const userEmail = session?.user?.email || '';

  useEffect(() => {
    AsyncStorage.getItem(REMINDER_KEY).then(val => {
      if (val === 'true') setRemindersOn(true);
    });
    getAvailableBiometric().then(t => setBiometricTypeLocal(t));
    if (session?.user?.id) {
      getOrCreateReferralCode(session.user.id).then(setMyCode).catch(() => {});
    }
  }, [session?.user?.id]);

  const handleShareReferral = async () => {
    if (!myCode) return;
    await Share.share({
      message:
        `¡Únete a EXPENSIA y lleva tus gastos al SAT en automático! 🇲🇽\n` +
        `Usa mi código *${myCode}* y ambos obtenemos 7 días gratis de Pro.\n` +
        `Descárgala en App Store y Google Play.`,
    });
  };

  const handleApplyCode = async () => {
    if (!referralInput.trim()) return;
    setReferralLoading(true);
    try {
      const result = await applyReferralCode(referralInput.trim());
      if (result.ok) {
        await extendTrial(7);
        Alert.alert('¡Código aplicado!', '7 días de Pro agregados a tu cuenta.');
        setReferralInput('');
      } else {
        Alert.alert('Código inválido', REFERRAL_ERROR_MESSAGES[result.error] ?? 'Error desconocido.');
      }
    } catch {
      Alert.alert('Error', 'No se pudo aplicar el código. Intenta de nuevo.');
    } finally {
      setReferralLoading(false);
    }
  };

  const toggleReminders = async (value: boolean) => {
    setRemindersOn(value);
    await AsyncStorage.setItem(REMINDER_KEY, String(value));
    if (value) {
      scheduleDailyReminder();
      scheduleWeeklySummary();
    } else {
      cancelAllReminders();
    }
  };

  const exportCsv = async () => {
    try {
      let data = expenses;
      if (!hasFullAccess()) {
        const n = new Date();
        const cutoff = localDateString(new Date(n.getFullYear(), n.getMonth(), n.getDate() - 30));
        data = expenses.filter(e => e.date >= cutoff);
      }
      await exportExpensesToCsv(data);
    } catch (error) {
      Alert.alert('Error', error instanceof Error ? error.message : 'No se pudo exportar.');
    }
  };

  const planLabel = plan === 'monthly' ? 'Mensual' : plan === 'yearly' ? 'Anual' : 'Gratuito';

  const handleSignOut = () => {
    Alert.alert('Cerrar sesión', '¿Seguro que deseas cerrar tu sesión?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Cerrar sesión', style: 'destructive', onPress: () => signOut() },
    ]);
  };

  return (
    <ScreenContainer>
      {/* Profile Header */}
      <Pressable style={s.profileHeader} onPress={() => navigation.navigate('ProfileEdit')}>
        <Avatar size={72} name={userName} />
        <Text style={s.userName}>{userName}</Text>
        {userEmail ? <Text style={s.userEmail}>{userEmail}</Text> : null}
        {constanciaUri ? (
          <View style={s.constanciaBadge}>
            <Icon name="check-decagram" size={14} color={colors.primary} />
            <Text style={s.constanciaBadgeText}>Constancia verificada</Text>
          </View>
        ) : null}
        <Text style={s.editHint}>Toca para editar</Text>
      </Pressable>

      <View style={s.card}>
        <View style={s.cardHeader}>
          <Icon name="theme-light-dark" size={22} color={colors.text} />
          <Text style={s.cardTitle}>Apariencia</Text>
        </View>
        <Text style={s.cardText}>Selecciona el tema de la aplicación.</Text>
        <View style={s.themeRow}>
          {themeModes.map(item => (
            <Pressable
              key={item.mode}
              style={[s.themeChip, mode === item.mode && s.themeChipActive]}
              onPress={() => setMode(item.mode)}
            >
              <Icon name={item.icon} size={16} color={mode === item.mode ? colors.white : colors.text} />
              <Text style={[s.themeChipText, mode === item.mode && s.themeChipTextActive]}>
                {item.label}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      <View style={s.card}>
        <View style={s.cardHeader}>
          <Icon name="file-document-outline" size={22} color={colors.text} />
          <Text style={s.cardTitle}>Régimen fiscal</Text>
        </View>
        <Text style={s.cardText}>Selecciona cómo facturas para calcular tu ahorro fiscal.</Text>
        <View style={s.fiscalRow}>
          {fiscalModes.map(item => (
            <Pressable
              key={item.value}
              style={[s.fiscalChip, fiscalRegime === item.value && s.themeChipActive]}
              onPress={() => setFiscalRegime(item.value)}
            >
              <Icon name={item.icon} size={16} color={fiscalRegime === item.value ? colors.white : colors.text} />
              <Text style={[s.themeChipText, fiscalRegime === item.value && s.themeChipTextActive]}>
                {item.label}
              </Text>
            </Pressable>
          ))}
        </View>
        {!fiscalModes.some(fm => fm.value === fiscalRegime) ? (
          <View style={s.currentRegimeRow}>
            <Text style={s.currentRegimeLabel}>
              Régimen actual: {FISCAL_REGIME_DISPLAY.find(r => r.value === fiscalRegime)?.title || fiscalRegime}
            </Text>
            <Text style={s.currentRegimeHint}>(cambiar en editar perfil)</Text>
          </View>
        ) : null}
        <Pressable style={s.reportButton} onPress={() => navigation.navigate('Ingresos')}>
          <Icon name="cash-plus" size={18} color={colors.primary} />
          <Text style={s.reportButtonText}>Mis ingresos</Text>
          <Icon name="chevron-right" size={18} color={colors.primary} />
        </Pressable>
        <Pressable style={s.reportButton} onPress={() => navigation.navigate('ReporteFiscal')}>
          <Icon name="chart-bar" size={18} color={colors.primary} />
          <Text style={s.reportButtonText}>Ver Reporte Fiscal</Text>
          <Icon name="chevron-right" size={18} color={colors.primary} />
        </Pressable>
        <Pressable style={s.reportButton} onPress={() => navigation.navigate('Presupuesto')}>
          <Icon name="gauge" size={18} color={colors.primary} />
          <Text style={s.reportButtonText}>Presupuestos mensuales</Text>
          <Icon name="chevron-right" size={18} color={colors.primary} />
        </Pressable>
        <Pressable style={s.reportButton} onPress={() => navigation.navigate('Recurrentes')}>
          <Icon name="repeat" size={18} color={colors.primary} />
          <Text style={s.reportButtonText}>Gastos recurrentes</Text>
          <Icon name="chevron-right" size={18} color={colors.primary} />
        </Pressable>
        <Pressable style={s.reportButton} onPress={() => navigation.navigate('Ahorros')}>
          <Icon name="piggy-bank-outline" size={18} color={colors.primary} />
          <Text style={s.reportButtonText}>Metas de ahorro</Text>
          <Icon name="chevron-right" size={18} color={colors.primary} />
        </Pressable>
        <Pressable style={s.reportButton} onPress={() => navigation.navigate('ResicoCalculator')}>
          <Icon name="calculator-variant" size={18} color={colors.primary} />
          <Text style={s.reportButtonText}>Calculadora RESICO</Text>
          <Icon name="chevron-right" size={18} color={colors.primary} />
        </Pressable>
      </View>

      <View style={s.card}>
        <View style={s.cardHeader}>
          <Icon name="account-group-outline" size={22} color={colors.text} />
          <Text style={s.cardTitle}>Herramientas</Text>
        </View>
        <Pressable style={s.reportButton} onPress={() => navigation.navigate('Split')}>
          <Icon name="call-split" size={18} color={colors.primary} />
          <Text style={s.reportButtonText}>Dividir gastos</Text>
          <Icon name="chevron-right" size={18} color={colors.primary} />
        </Pressable>
        <Pressable style={s.reportButton} onPress={() => navigation.navigate('CustomCategories')}>
          <Icon name="tag-plus" size={18} color={colors.primary} />
          <Text style={s.reportButtonText}>Categorías personalizadas</Text>
          <Icon name="chevron-right" size={18} color={colors.primary} />
        </Pressable>
        <Pressable style={s.reportButton} onPress={() => navigation.navigate('Backup')}>
          <Icon name="database-export" size={18} color={colors.primary} />
          <Text style={s.reportButtonText}>Backup y restauración</Text>
          <Icon name="chevron-right" size={18} color={colors.primary} />
        </Pressable>
        <Pressable style={s.reportButton} onPress={() => navigation.navigate('CurrencySettings')}>
          <Icon name="currency-usd" size={18} color={colors.primary} />
          <Text style={s.reportButtonText}>Moneda y tipo de cambio</Text>
          <Icon name="chevron-right" size={18} color={colors.primary} />
        </Pressable>
        <Pressable style={s.reportButton} onPress={() => navigation.navigate('BankImport')}>
          <Icon name="bank-transfer-in" size={18} color={colors.primary} />
          <Text style={s.reportButtonText}>Importar estado de cuenta</Text>
          <Icon name="chevron-right" size={18} color={colors.primary} />
        </Pressable>
      </View>

      {/* Security Card */}
      {biometricType !== 'none' ? (
        <View style={s.card}>
          <View style={s.cardHeader}>
            <Icon name="shield-lock-outline" size={22} color={colors.text} />
            <Text style={s.cardTitle}>Seguridad</Text>
          </View>
          <View style={s.switchRow}>
            <View style={s.switchInfo}>
              <Text style={s.switchLabel}>
                Bloquear con {getBiometricLabel(biometricType as any)}
              </Text>
              <Text style={s.switchDesc}>
                Se pedirá autenticación al abrir la app
              </Text>
            </View>
            <Switch
              value={biometricEnabled}
              onValueChange={setBiometricEnabled}
              trackColor={{ true: colors.primary }}
            />
          </View>
        </View>
      ) : null}

      <View style={s.card}>
        <View style={s.cardHeader}>
          <Icon name="bell-ring-outline" size={22} color={colors.text} />
          <Text style={s.cardTitle}>Recordatorios</Text>
        </View>
        <Text style={s.cardText}>Diario a las 20:00 y resumen semanal los domingos a las 10:00.</Text>
        <View style={s.switchRow}>
          <Text style={s.switchLabel}>Activar recordatorios</Text>
          <Switch
            value={remindersOn}
            onValueChange={toggleReminders}
            trackColor={{ true: colors.primary }}
          />
        </View>
      </View>

      {/* Trial banner */}
      {trialActive ? (
        <View style={s.trialBanner}>
          <Icon name="clock-fast" size={20} color={colors.warning} />
          <View style={s.trialText}>
            <Text style={s.trialTitle}>Prueba gratis activa — {trialDaysLeft} día{trialDaysLeft !== 1 ? 's' : ''} restante{trialDaysLeft !== 1 ? 's' : ''}</Text>
            <Text style={s.trialSub}>Suscríbete antes de que termine para no perder el acceso.</Text>
          </View>
          <Pressable style={s.trialBtn} onPress={() => setPaywallVisible(true)}>
            <Text style={s.trialBtnText}>Ver planes</Text>
          </Pressable>
        </View>
      ) : null}

      {/* Referidos */}
      <View style={s.card}>
        <View style={s.cardHeader}>
          <Icon name="gift-outline" size={22} color={colors.secondary} />
          <Text style={s.cardTitle}>Invita y gana Pro</Text>
        </View>
        <Text style={s.cardText}>
          Comparte tu código. Cuando alguien lo use, ambos obtienen <Text style={{ color: colors.primary, fontFamily: font.bold }}>7 días gratis de Pro</Text>.
        </Text>

        {myCode ? (
          <Pressable style={s.codeBox} onPress={handleShareReferral}>
            <Text style={s.codeText}>{myCode}</Text>
            <View style={s.shareChip}>
              <Icon name="share-variant" size={14} color={colors.white} />
              <Text style={s.shareChipText}>Compartir</Text>
            </View>
          </Pressable>
        ) : null}

        <View style={s.codeInputRow}>
          <TextInput
            style={s.codeInput}
            placeholder="Ingresa un código (EXP-XXXXXX)"
            placeholderTextColor={colors.textMuted}
            value={referralInput}
            onChangeText={t => setReferralInput(t.toUpperCase())}
            autoCapitalize="characters"
            maxLength={12}
          />
          <Pressable
            style={[s.applyBtn, (!referralInput.trim() || referralLoading) && s.applyBtnDisabled]}
            onPress={handleApplyCode}
            disabled={!referralInput.trim() || referralLoading}
          >
            <Text style={s.applyBtnText}>{referralLoading ? '…' : 'Aplicar'}</Text>
          </Pressable>
        </View>
      </View>

      {/* Subscription Card */}
      <View style={s.card}>
        <View style={s.cardHeader}>
          <Icon name="shield-crown-outline" size={22} color={colors.primary} />
          <Text style={s.cardTitle}>Suscripción</Text>
        </View>
        {isPremium ? (
          <>
            <Text style={s.cardText}>Plan activo: {planLabel}</Text>
            <Pressable style={s.buttonOutline} onPress={() => Alert.alert('Próximamente', 'Gestión de suscripción disponible pronto.')}>
              <Text style={s.buttonOutlineText}>Gestionar suscripción</Text>
            </Pressable>
          </>
        ) : (
          <>
            <Text style={s.cardText}>Plan gratuito — funcionalidades limitadas</Text>
            <Pressable style={s.button} onPress={() => setPaywallVisible(true)}>
              <Icon name="arrow-up-bold" size={18} color={colors.white} />
              <Text style={s.buttonText}>Actualizar a Premium</Text>
            </Pressable>
          </>
        )}
      </View>

      <View style={s.card}>
        <View style={s.cardHeader}>
          <Icon name="file-export-outline" size={22} color={colors.text} />
          <Text style={s.cardTitle}>Exportar datos</Text>
        </View>
        <Text style={s.cardText}>
          {hasFullAccess()
            ? 'Comparte tus gastos en formato CSV para análisis o respaldo.'
            : 'Exporta los últimos 30 días en CSV. Actualiza a Premium para exportar todo.'}
        </Text>
        <Pressable style={s.button} onPress={exportCsv}>
          <Icon name="download" size={18} color={colors.white} />
          <Text style={s.buttonText}>Exportar CSV</Text>
        </Pressable>
      </View>

      <Pressable style={s.signOutButton} onPress={handleSignOut}>
        <Icon name="logout" size={18} color={colors.danger} />
        <Text style={s.signOutText}>Cerrar sesión</Text>
      </Pressable>

      <Text style={s.version}>EXPENSIA v0.0.1</Text>

      <PaywallModal
        visible={paywallVisible}
        onClose={() => setPaywallVisible(false)}
        trigger="export"
      />
    </ScreenContainer>
  );
}

const useStyles = (colors: ColorPalette, _isDark: boolean) =>
  StyleSheet.create({
    profileHeader: {
      alignItems: 'center',
      gap: 8,
      paddingVertical: 24,
    },
    userName: {
      color: colors.text,
      fontSize: 22,
      fontFamily: font.extrabold,
    },
    userEmail: {
      color: colors.textMuted,
      fontSize: 14,
    },
    editHint: {
      color: colors.primary,
      fontSize: 12,
      fontFamily: font.semibold,
      marginTop: 2,
    },
    card: {
      backgroundColor: colors.surface,
      borderRadius: 20,
      padding: 18,
      borderWidth: 1,
      borderColor: colors.border,
      gap: 12,
    },
    cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    cardTitle: { color: colors.text, fontSize: 18, fontFamily: font.bold },
    cardText: { color: colors.textMuted, lineHeight: 22 },
    themeRow: { flexDirection: 'row', gap: 8 },
    themeChip: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      paddingVertical: 12,
      borderRadius: 14,
      backgroundColor: colors.surfaceAlt,
    },
    fiscalRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    fiscalChip: {
      width: '47%',
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      paddingVertical: 12,
      paddingHorizontal: 10,
      borderRadius: 14,
      backgroundColor: colors.surfaceAlt,
    },
    themeChipActive: { backgroundColor: colors.primary },
    themeChipText: { color: colors.text, fontFamily: font.semibold, fontSize: 13 },
    themeChipTextActive: { color: colors.white },
    switchRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    switchInfo: { flex: 1, gap: 2 },
    trialBanner: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      backgroundColor: colors.warning + '15',
      borderWidth: 1,
      borderColor: colors.warning + '40',
      borderRadius: 16,
      padding: 14,
    },
    trialText: { flex: 1, gap: 2 },
    trialTitle: { color: colors.text, fontSize: 13, fontFamily: font.bold },
    trialSub: { color: colors.textMuted, fontSize: 11 },
    trialBtn: {
      backgroundColor: colors.warning,
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 10,
    },
    trialBtnText: { color: '#fff', fontSize: 12, fontFamily: font.extrabold },
    codeBox: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: colors.primary + '12',
      borderWidth: 1,
      borderColor: colors.primary + '30',
      borderRadius: 14,
      paddingHorizontal: 16,
      paddingVertical: 14,
    },
    codeText: {
      color: colors.primary,
      fontSize: 20,
      fontFamily: font.black,
      letterSpacing: 2,
    },
    shareChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      backgroundColor: colors.primary,
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 10,
    },
    shareChipText: { color: '#fff', fontSize: 12, fontFamily: font.bold },
    codeInputRow: { flexDirection: 'row', gap: 8 },
    codeInput: {
      flex: 1,
      backgroundColor: colors.surfaceAlt,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: 14,
      paddingVertical: 10,
      color: colors.text,
      fontSize: 14,
      fontFamily: font.semibold,
      letterSpacing: 1,
    },
    applyBtn: {
      backgroundColor: colors.primary,
      paddingHorizontal: 16,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
    },
    applyBtnDisabled: { opacity: 0.4 },
    applyBtnText: { color: '#fff', fontFamily: font.bold, fontSize: 14 },
    switchLabel: { color: colors.text, fontFamily: font.semibold },
    switchDesc: { color: colors.textMuted, fontSize: 12 },
    button: {
      flexDirection: 'row',
      gap: 8,
      backgroundColor: colors.primary,
      paddingVertical: 14,
      borderRadius: 16,
      alignItems: 'center',
      justifyContent: 'center',
    },
    buttonText: { color: colors.white, fontFamily: font.bold },
    buttonOutline: {
      flexDirection: 'row',
      gap: 8,
      borderWidth: 1,
      borderColor: colors.primary,
      paddingVertical: 14,
      borderRadius: 16,
      alignItems: 'center',
      justifyContent: 'center',
    },
    buttonOutlineText: { color: colors.primary, fontFamily: font.bold },
    signOutButton: {
      flexDirection: 'row',
      gap: 8,
      backgroundColor: colors.danger + '12',
      paddingVertical: 14,
      borderRadius: 16,
      alignItems: 'center',
      justifyContent: 'center',
    },
    signOutText: { color: colors.danger, fontFamily: font.bold, fontSize: 15 },
    constanciaBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      marginTop: 2,
    },
    constanciaBadgeText: {
      color: colors.primary,
      fontSize: 12,
      fontFamily: font.semibold,
    },
    currentRegimeRow: {
      paddingTop: 4,
    },
    currentRegimeLabel: {
      color: colors.text,
      fontSize: 13,
      fontFamily: font.semibold,
    },
    currentRegimeHint: {
      color: colors.textMuted,
      fontSize: 12,
    },
    reportButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      backgroundColor: colors.primary + '12',
      paddingVertical: 12,
      paddingHorizontal: 14,
      borderRadius: 14,
    },
    reportButtonText: {
      color: colors.primary,
      fontFamily: font.bold,
      fontSize: 14,
      flex: 1,
    },
    version: { color: colors.textMuted, fontSize: 12, textAlign: 'center' },
  });
