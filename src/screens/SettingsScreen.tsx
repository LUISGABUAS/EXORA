import { font } from '../theme/typography';
import React, { useEffect, useState } from 'react';
import {
  Alert,
  Linking,
  Pressable,
  Share,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
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
import { applyReferralCode, getOrCreateReferralCode, REFERRAL_ERROR_MESSAGES } from '../services/referralService';
import { cancelAllReminders, scheduleDailyReminder, scheduleWeeklySummary } from '../services/notificationService'; // eslint-disable-line @typescript-eslint/no-unused-vars
import { useAuthStore } from '../store/useAuthStore';
import { useExpenseStore } from '../store/useExpenseStore';
import { FiscalRegime, usePremiumStore } from '../store/usePremiumStore';
import { getPendingSyncItems } from '../database/syncQueue';
import { flushSyncQueue } from '../services/syncService';
import { ColorPalette } from '../theme/colors';
import { ThemeMode, useTheme } from '../theme/ThemeContext';
import { FISCAL_REGIME_DISPLAY } from '../types/fiscal';
import { localDateString } from '../utils/format';

const THEME_MODES: Array<{ mode: ThemeMode; label: string; icon: string }> = [
  { mode: 'light', label: 'Claro', icon: 'white-balance-sunny' },
  { mode: 'dark', label: 'Oscuro', icon: 'moon-waning-crescent' },
  { mode: 'system', label: 'Sistema', icon: 'cellphone' },
];


function SectionLabel({ label }: { label: string }) {
  const { colors } = useTheme();
  return <Text style={{ color: colors.textMuted, fontSize: 11, fontFamily: font.semibold, letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 6, marginLeft: 4 }}>{label}</Text>;
}

function NavRow({ icon, label, color, onPress, right }: {
  icon: string; label: string; color?: string; onPress: () => void; right?: React.ReactNode;
}) {
  const { colors, isDark } = useTheme();
  const c = color ?? colors.primary;
  return (
    <Pressable
      style={({ pressed }) => [navRowStyle(colors, isDark), pressed && { opacity: 0.6 }]}
      onPress={onPress}
    >
      <View style={[iconWrap(c), { marginRight: 12 }]}>
        <Icon name={icon} size={18} color={c} />
      </View>
      <Text style={{ color: colors.text, fontSize: 15, fontFamily: font.medium, flex: 1 }}>{label}</Text>
      {right ?? <Icon name="chevron-right" size={18} color={colors.textMuted} />}
    </Pressable>
  );
}

const navRowStyle = (colors: ColorPalette, isDark: boolean) => ({
  flexDirection: 'row' as const,
  alignItems: 'center' as const,
  paddingVertical: 13,
  paddingHorizontal: 16,
  backgroundColor: isDark ? '#111111' : colors.surface,
  borderBottomWidth: StyleSheet.hairlineWidth,
  borderBottomColor: isDark ? '#1E1E1E' : colors.border,
});

const iconWrap = (color: string) => ({
  width: 32,
  height: 32,
  borderRadius: 8,
  backgroundColor: color + '18',
  alignItems: 'center' as const,
  justifyContent: 'center' as const,
});

export function SettingsScreen() {
  const { colors, isDark, mode, setMode } = useTheme();
  const s = useStyles(colors, isDark);
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const expenses = useExpenseStore(state => state.expenses);
  const session = useAuthStore(state => state.session);
  const signOut = useAuthStore(state => state.signOut);
  const deleteAccount = useAuthStore(state => state.deleteAccount);
  const isPremium = usePremiumStore(state => state.isPremium);
  const plan = usePremiumStore(state => state.plan);
  const isFounder = usePremiumStore(state => state.isFounder);
  const redeemFounderCode = usePremiumStore(state => state.redeemFounderCode);
  const hasFullAccess = usePremiumStore(state => state.hasFullAccess);
  const fiscalRegime = usePremiumStore(state => state.fiscalRegime);
  const constanciaUri = usePremiumStore(state => state.constanciaUri);
  const biometricEnabled = usePremiumStore(state => state.biometricEnabled);
  const setBiometricEnabled = usePremiumStore(state => state.setBiometricEnabled);
  const trialEndsAt = usePremiumStore(state => state.trialEndsAt);
  const extendTrial = usePremiumStore(state => state.extendTrial);

  const [paywallVisible, setPaywallVisible] = useState(false);
  const [biometricType, setBiometricTypeLocal] = useState<string>('none');
  const [myCode, setMyCode] = useState('');
  const [referralInput, setReferralInput] = useState('');
  const [referralLoading, setReferralLoading] = useState(false);
  const [founderInput, setFounderInput] = useState('');
  const [founderLoading, setFounderLoading] = useState(false);
  const [showFounderInput, setShowFounderInput] = useState(false);

  const trialDaysLeft = trialEndsAt
    ? Math.max(0, Math.ceil((new Date(trialEndsAt).getTime() - Date.now()) / 86400000))
    : 0;
  const trialActive = trialDaysLeft > 0 && !isPremium;

  const userEmail = session?.user?.email || '';
  const isRelayEmail = userEmail.endsWith('@privaterelay.appleid.com');
  const userName =
    session?.user?.user_metadata?.full_name ||
    (!isRelayEmail && userEmail.split('@')[0]) ||
    'Usuario';

  useEffect(() => {
    getAvailableBiometric().then(t => setBiometricTypeLocal(t));
    if (session?.user?.id) {
      getOrCreateReferralCode(session.user.id).then(setMyCode).catch(() => {});
    }
  }, [session?.user?.id]);

  const handleShareReferral = async () => {
    if (!myCode) return;
    await Share.share({
      message:
        `¡Únete a EXORA y lleva tus gastos al SAT en automático! 🇲🇽\n` +
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

  const handleRedeemFounderCode = async () => {
    if (!founderInput.trim()) return;
    setFounderLoading(true);
    const result = await redeemFounderCode(founderInput);
    setFounderLoading(false);
    if (result === 'success') {
      setFounderInput('');
      setShowFounderInput(false);
      Alert.alert('✦ Bienvenido, Fundador', 'Tu acceso premium permanente ha sido activado.');
    } else if (result === 'already_used') {
      Alert.alert('Código ya canjeado', 'Este código ya fue utilizado por otro usuario.');
    } else if (result === 'invalid') {
      Alert.alert('Código inválido', 'El código que ingresaste no existe.');
    } else {
      Alert.alert('Error', 'No se pudo canjear el código. Verifica tu conexión.');
    }
  };

  const handleSignOut = async () => {
    const pending = await getPendingSyncItems();
    if (pending.length > 0) {
      Alert.alert(
        'Datos sin sincronizar',
        `Tienes ${pending.length} movimiento${pending.length > 1 ? 's' : ''} sin guardar en la nube.`,
        [
          { text: 'Cancelar', style: 'cancel' },
          { text: 'Sincronizar y salir', onPress: async () => { try { await flushSyncQueue(); } catch {} signOut(); } },
          { text: 'Salir sin sincronizar', style: 'destructive', onPress: () => signOut() },
        ],
      );
      return;
    }
    Alert.alert('Cerrar sesión', '¿Seguro que deseas cerrar tu sesión?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Cerrar sesión', style: 'destructive', onPress: () => signOut() },
    ]);
  };

  const planLabel = plan === 'founder' ? 'Fundador ✦' : plan === 'monthly' ? 'Pro Mensual' : plan === 'yearly' ? 'Pro Anual' : 'Gratuito';

  return (
    <ScreenContainer>
      {/* Profile */}
      <Pressable style={s.profileHeader} onPress={() => navigation.navigate('ProfileEdit')}>
        <Avatar size={68} name={userName} />
        <View style={s.profileInfo}>
          <Text style={s.userName}>{userName}</Text>
          {userEmail && !isRelayEmail ? <Text style={s.userEmail}>{userEmail}</Text> : null}
          <View style={s.profileMeta}>
            {constanciaUri && (
              <View style={s.verifiedBadge}>
                <Icon name="check-decagram" size={12} color={colors.primary} />
                <Text style={s.verifiedText}>Constancia verificada</Text>
              </View>
            )}
            <Text style={s.editHint}>Editar perfil →</Text>
          </View>
        </View>
      </Pressable>

      {/* Plan badge */}
      {(isPremium || isFounder || trialActive) && (
        <Pressable
          style={[s.planBadge, isFounder && s.planBadgeFounder]}
          onPress={() => !isFounder && setPaywallVisible(true)}
        >
          <Icon
            name={isFounder ? 'star-four-points' : trialActive ? 'clock-fast' : 'shield-crown-outline'}
            size={16}
            color={isFounder ? colors.warning : colors.primary}
          />
          <Text style={[s.planBadgeText, isFounder && { color: colors.warning }]}>
            {isFounder ? 'Miembro Fundador — Acceso permanente' :
             trialActive ? `Prueba gratis — ${trialDaysLeft} día${trialDaysLeft !== 1 ? 's' : ''} restante${trialDaysLeft !== 1 ? 's' : ''}` :
             planLabel}
          </Text>
          {!isFounder && <Icon name="chevron-right" size={14} color={colors.textMuted} />}
        </Pressable>
      )}

      {/* Ajustes */}
      <SectionLabel label="Ajustes" />
      <View style={s.card}>
        {/* Apariencia */}
        <View style={s.settingCol}>
          <View style={s.settingRow}>
            <View style={[iconWrap(colors.textMuted), { marginRight: 12 }]}>
              <Icon name="theme-light-dark" size={18} color={colors.textMuted} />
            </View>
            <Text style={s.settingLabel}>Apariencia</Text>
          </View>
          <View style={[s.chipRow, { justifyContent: 'flex-start', marginLeft: 44 }]}>
            {THEME_MODES.map(item => (
              <Pressable
                key={item.mode}
                style={[s.chip, mode === item.mode && s.chipActive]}
                onPress={() => setMode(item.mode)}
              >
                <Icon name={item.icon} size={13} color={mode === item.mode ? '#fff' : colors.textMuted} />
                <Text style={[s.chipText, mode === item.mode && s.chipTextActive]}>{item.label}</Text>
              </Pressable>
            ))}
          </View>
        </View>

        <View style={s.divider} />

        {/* Régimen fiscal */}
        <Pressable style={s.settingRow} onPress={() => navigation.navigate('ProfileEdit')}>
          <View style={[iconWrap('#8B5CF6'), { marginRight: 12 }]}>
            <Icon name="file-document-outline" size={18} color="#8B5CF6" />
          </View>
          <Text style={[s.settingLabel, { flex: 1 }]}>Régimen fiscal</Text>
          <Text style={s.regimeValue}>
            {FISCAL_REGIME_DISPLAY.find(r => r.value === fiscalRegime)?.title || fiscalRegime}
          </Text>
          <Icon name="chevron-right" size={16} color={colors.textMuted} style={{ marginLeft: 4 }} />
        </Pressable>

        <View style={s.divider} />

        {/* Notificaciones */}
        <Pressable style={s.settingRow} onPress={() => navigation.navigate('Notifications')}>
          <View style={[iconWrap('#F59E0B'), { marginRight: 12 }]}>
            <Icon name="bell-outline" size={18} color="#F59E0B" />
          </View>
          <Text style={[s.settingLabel, { flex: 1 }]}>Notificaciones</Text>
          <Icon name="chevron-right" size={16} color={colors.textMuted} />
        </Pressable>

        {/* Biométrico */}
        {biometricType !== 'none' && (
          <>
            <View style={s.divider} />
            <View style={s.settingRow}>
              <View style={[iconWrap('#06B6D4'), { marginRight: 12 }]}>
                <Icon name="fingerprint" size={18} color="#06B6D4" />
              </View>
              <Text style={[s.settingLabel, { flex: 1 }]}>{getBiometricLabel(biometricType as any)}</Text>
              <Switch value={biometricEnabled} onValueChange={setBiometricEnabled} trackColor={{ true: colors.primary }} />
            </View>
          </>
        )}
      </View>

      {/* Finanzas */}
      <SectionLabel label="Finanzas" />
      <View style={s.listCard}>
        <NavRow icon="cash-plus" label="Ingresos del mes" color={colors.success} onPress={() => navigation.navigate('Ingresos')} />
        <NavRow icon="repeat" label="Ingresos fijos" color={colors.success} onPress={() => navigation.navigate('IngresosRecurrentes')} />
        <NavRow icon="gauge" label="Presupuestos" color="#F59E0B" onPress={() => navigation.navigate('Presupuesto')} />
        <NavRow icon="piggy-bank-outline" label="Metas de ahorro" color="#8B5CF6" onPress={() => navigation.navigate('Ahorros')} />
        <NavRow icon="repeat-variant" label="Gastos recurrentes" color="#3B82F6" onPress={() => navigation.navigate('Recurrentes')} />
        <NavRow icon="calculator-variant" label="Calculadora RESICO" color="#06B6D4" onPress={() => navigation.navigate('ResicoCalculator')} />
        <NavRow icon="school-outline" label="Portal SAT" color={colors.textMuted} onPress={() => Linking.openURL('https://www.sat.gob.mx/personas/declaraciones')} right={<Icon name="open-in-new" size={16} color={colors.textMuted} />} />
      </View>

      {/* Herramientas */}
      <SectionLabel label="Herramientas" />
      <View style={s.listCard}>
        <NavRow icon="file-check-outline" label="Mis Facturas" color="#3B82F6" onPress={() => navigation.navigate('MisFacturas')} />
        <NavRow icon="chart-bar" label="Reporte Fiscal" color="#8B5CF6" onPress={() => navigation.navigate('ReporteFiscal')} />
        <NavRow icon="call-split" label="Dividir gastos" color="#F59E0B" onPress={() => navigation.navigate('Split')} />
        <NavRow icon="bank-transfer-in" label="Importar estado de cuenta" color="#06B6D4" onPress={() => navigation.navigate('BankImport')} />
        <NavRow icon="tag-plus" label="Categorías personalizadas" color={colors.primary} onPress={() => navigation.navigate('CustomCategories')} />
        <NavRow icon="currency-usd" label="Moneda y tipo de cambio" color={colors.primary} onPress={() => navigation.navigate('CurrencySettings')} />
        <NavRow icon="download" label="Exportar CSV" color={colors.primary} onPress={exportCsv} right={hasFullAccess() ? <Icon name="chevron-right" size={18} color={colors.textMuted} /> : <View style={s.proBadge}><Text style={s.proBadgeText}>30d</Text></View>} />
        <NavRow icon="database-export" label="Backup y restauración" color={colors.textMuted} onPress={() => navigation.navigate('Backup')} />
      </View>

      {/* Cuenta */}
      <SectionLabel label="Cuenta" />
      <View style={s.listCard}>
        {/* Membresía */}
        {!isPremium && !isFounder ? (
          <NavRow
            icon="shield-crown-outline"
            label="Actualizar a Premium"
            color={colors.primary}
            onPress={() => setPaywallVisible(true)}
            right={<View style={s.upgradeBadge}><Text style={s.upgradeBadgeText}>Pro</Text></View>}
          />
        ) : (
          <NavRow
            icon="shield-crown-outline"
            label={`Plan: ${planLabel}`}
            color={isFounder ? colors.warning : colors.primary}
            onPress={() => isFounder
              ? Alert.alert('Membresía Fundador', 'Tienes acceso permanente. No necesitas gestionar ninguna suscripción.')
              : Alert.alert('Gestionar membresía', 'Ve a Configuración → App Store → Suscripciones.')
            }
          />
        )}

        {/* Referidos */}
        {!isPremium && !isFounder && myCode ? (
          <>
            <View style={s.divider} />
            <Pressable style={s.referralRow} onPress={handleShareReferral}>
              <View style={[iconWrap(colors.primary), { marginRight: 12 }]}>
                <Icon name="gift-outline" size={18} color={colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.settingLabel}>Invita y gana 7 días Pro</Text>
                <Text style={[s.settingLabel, { fontSize: 16, color: colors.primary, fontFamily: font.black, letterSpacing: 2, marginTop: 2 }]}>{myCode}</Text>
              </View>
              <Icon name="share-variant" size={18} color={colors.primary} />
            </Pressable>
            <View style={s.divider} />
            <View style={s.codeInputRow}>
              <TextInput
                style={s.codeInput}
                placeholder="Código de un amigo"
                placeholderTextColor={colors.textMuted}
                value={referralInput}
                onChangeText={t => setReferralInput(t.toUpperCase())}
                autoCapitalize="characters"
                maxLength={12}
              />
              <Pressable
                style={[s.applyBtn, (!referralInput.trim() || referralLoading) && { opacity: 0.4 }]}
                onPress={handleApplyCode}
                disabled={!referralInput.trim() || referralLoading}
              >
                <Text style={s.applyBtnText}>{referralLoading ? '…' : 'Aplicar'}</Text>
              </Pressable>
            </View>
          </>
        ) : null}

        {/* Código fundador */}
        {!isPremium && !isFounder && (
          <>
            <View style={s.divider} />
            {showFounderInput ? (
              <View style={[s.codeInputRow, { padding: 12 }]}>
                <TextInput
                  style={s.codeInput}
                  placeholder="EXORA-FOUNDER-XXXX"
                  placeholderTextColor={colors.textMuted}
                  value={founderInput}
                  onChangeText={t => setFounderInput(t.toUpperCase())}
                  autoCapitalize="characters"
                  autoCorrect={false}
                  maxLength={24}
                  autoFocus
                />
                <Pressable
                  style={[s.applyBtn, (!founderInput.trim() || founderLoading) && { opacity: 0.4 }]}
                  onPress={handleRedeemFounderCode}
                  disabled={!founderInput.trim() || founderLoading}
                >
                  <Text style={s.applyBtnText}>{founderLoading ? '…' : 'Canjear'}</Text>
                </Pressable>
              </View>
            ) : (
              <NavRow
                icon="star-four-points"
                label="Código fundador"
                color={colors.warning}
                onPress={() => setShowFounderInput(true)}
              />
            )}
          </>
        )}
      </View>

      {/* Cerrar sesión */}
      <Pressable style={s.signOutButton} onPress={handleSignOut}>
        <Icon name="logout" size={18} color={colors.danger} />
        <Text style={s.signOutText}>Cerrar sesión</Text>
      </Pressable>

      {/* Eliminar cuenta */}
      <Pressable
        style={s.deleteAccountButton}
        onPress={() => {
          Alert.alert(
            'Eliminar cuenta',
            'Esta acción es permanente. Se eliminarán todos tus datos, gastos e historial. No se puede deshacer.',
            [
              { text: 'Cancelar', style: 'cancel' },
              {
                text: 'Eliminar mi cuenta',
                style: 'destructive',
                onPress: () => {
                  Alert.alert(
                    '¿Estás seguro?',
                    'Confirma que deseas eliminar permanentemente tu cuenta de EXORA.',
                    [
                      { text: 'Cancelar', style: 'cancel' },
                      {
                        text: 'Sí, eliminar',
                        style: 'destructive',
                        onPress: async () => {
                          const err = await deleteAccount();
                          if (err) Alert.alert('Error', err);
                        },
                      },
                    ],
                  );
                },
              },
            ],
          );
        }}
      >
        <Icon name="delete-forever-outline" size={16} color={colors.textMuted} />
        <Text style={s.deleteAccountText}>Eliminar cuenta</Text>
      </Pressable>

      <Text style={s.version}>EXORA v1.0.0</Text>

      {__DEV__ && (
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Pressable
            style={[s.devSeedBtn, { flex: 1 }]}
            onPress={async () => {
              try {
                const { seedDemoData } = require('../utils/seedDemoData');
                const { useExpenseStore } = require('../store/useExpenseStore');
                const { useIncomeStore } = require('../store/useIncomeStore');
                await seedDemoData();
                await useExpenseStore.getState().loadExpenses();
                await useIncomeStore.getState().loadIncomes();
                Alert.alert('✓ Demo', 'Datos ficticios cargados.');
              } catch (e: any) {
                Alert.alert('Error', e?.message ?? 'No se pudieron cargar los datos.');
              }
            }}
          >
            <Icon name="database-plus" size={16} color="#666" />
            <Text style={s.devSeedText}>Cargar demo</Text>
          </Pressable>

          <Pressable
            style={[s.devSeedBtn, { flex: 1 }]}
            onPress={() => {
              Alert.alert('Borrar todos los datos', '¿Seguro? Esto elimina gastos, ingresos y configuración.', [
                { text: 'Cancelar', style: 'cancel' },
                {
                  text: 'Borrar todo',
                  style: 'destructive',
                  onPress: async () => {
                    const { clearAllUserData } = require('../utils/clearUserData');
                    await clearAllUserData();
                    Alert.alert('✓ Listo', 'Todos los datos fueron eliminados.');
                  },
                },
              ]);
            }}
          >
            <Icon name="database-remove" size={16} color="#EF4444" />
            <Text style={[s.devSeedText, { color: '#EF4444' }]}>Borrar demo</Text>
          </Pressable>

          <Pressable
            style={[s.devSeedBtn, { flex: 1 }]}
            onPress={() => {
              const { NativeModules } = require('react-native');
              const bridge = NativeModules.WidgetDataBridge;
              if (!bridge) {
                Alert.alert('Widget Debug', '❌ WidgetDataBridge NO encontrado.\nEl native module no está cargado.');
                return;
              }
              const { useExpenseStore } = require('../store/useExpenseStore');
              const { useIncomeStore } = require('../store/useIncomeStore');
              const { syncWidgetData } = require('../utils/widgetBridge');
              const expenses = useExpenseStore.getState().expenses;
              const incomes = useIncomeStore.getState().incomes;
              syncWidgetData(expenses, incomes);
              Alert.alert('Widget Debug', `✓ WidgetDataBridge encontrado.\nSe enviaron ${expenses.length} gastos y ${incomes.length} ingresos al widget.`);
            }}
          >
            <Icon name="widgets-outline" size={16} color="#06B6D4" />
            <Text style={[s.devSeedText, { color: '#06B6D4' }]}>Sync widget</Text>
          </Pressable>
        </View>
      )}

      <PaywallModal visible={paywallVisible} onClose={() => setPaywallVisible(false)} trigger="export" />
    </ScreenContainer>
  );
}

const useStyles = (colors: ColorPalette, isDark: boolean) =>
  StyleSheet.create({
    // Profile
    profileHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 14,
      paddingVertical: 8,
    },
    profileInfo: { flex: 1, gap: 3 },
    userName: { color: colors.text, fontSize: 20, fontFamily: font.extrabold },
    userEmail: { color: colors.textMuted, fontSize: 13 },
    profileMeta: { flexDirection: 'row', alignItems: 'center', gap: 10, flexWrap: 'wrap' },
    verifiedBadge: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    verifiedText: { color: colors.primary, fontSize: 11, fontFamily: font.semibold },
    editHint: { color: colors.primary, fontSize: 12, fontFamily: font.semibold },

    // Plan badge
    planBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      backgroundColor: colors.primary + '12',
      borderWidth: 1,
      borderColor: colors.primary + '30',
      borderRadius: 14,
      paddingHorizontal: 14,
      paddingVertical: 10,
    },
    planBadgeFounder: {
      backgroundColor: colors.warning + '12',
      borderColor: colors.warning + '30',
    },
    planBadgeText: {
      color: colors.primary,
      fontSize: 13,
      fontFamily: font.semibold,
      flex: 1,
    },

    // Cards
    card: {
      backgroundColor: isDark ? '#111111' : colors.surface,
      borderRadius: 18,
      overflow: 'hidden',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: isDark ? 0.2 : 0.05,
      shadowRadius: 6,
      elevation: 2,
      padding: 16,
      gap: 12,
    },
    listCard: {
      backgroundColor: isDark ? '#111111' : colors.surface,
      borderRadius: 18,
      overflow: 'hidden',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: isDark ? 0.2 : 0.05,
      shadowRadius: 6,
      elevation: 2,
    },
    divider: {
      height: StyleSheet.hairlineWidth,
      backgroundColor: isDark ? '#1E1E1E' : colors.border,
    },

    // Settings rows
    settingRow: { flexDirection: 'row', alignItems: 'center' },
    settingCol: { gap: 10 },
    settingLabel: { color: colors.text, fontSize: 15, fontFamily: font.medium },
    regimeValue: { color: colors.textMuted, fontSize: 13, fontFamily: font.medium },

    // Chips
    chipRow: { flexDirection: 'row', gap: 6, flex: 1, justifyContent: 'flex-end' },
    chip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 10,
      backgroundColor: isDark ? '#1E1E1E' : colors.background,
    },
    chipActive: { backgroundColor: colors.primary },
    chipText: { color: colors.textMuted, fontSize: 12, fontFamily: font.medium },
    chipTextActive: { color: '#fff', fontFamily: font.semibold },

    // Referral
    referralRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 13,
      paddingHorizontal: 16,
    },
    codeInputRow: {
      flexDirection: 'row',
      gap: 8,
      paddingHorizontal: 16,
      paddingVertical: 10,
    },
    codeInput: {
      flex: 1,
      backgroundColor: isDark ? '#1E1E1E' : colors.background,
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
    applyBtnText: { color: '#fff', fontFamily: font.bold, fontSize: 14 },

    // Badges
    proBadge: {
      backgroundColor: colors.textMuted + '20',
      borderRadius: 6,
      paddingHorizontal: 7,
      paddingVertical: 2,
    },
    proBadgeText: { color: colors.textMuted, fontSize: 11, fontFamily: font.bold },
    upgradeBadge: {
      backgroundColor: colors.primary,
      borderRadius: 8,
      paddingHorizontal: 8,
      paddingVertical: 3,
    },
    upgradeBadgeText: { color: '#fff', fontSize: 11, fontFamily: font.bold },

    // Sign out
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

    deleteAccountButton: {
      flexDirection: 'row',
      gap: 6,
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 10,
    },
    deleteAccountText: { color: colors.textMuted, fontFamily: font.medium, fontSize: 13 },

    version: { color: colors.textMuted, fontSize: 12, textAlign: 'center' },
    devSeedBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      paddingVertical: 10,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: '#333',
      borderStyle: 'dashed',
    },
    devSeedText: { color: '#666', fontSize: 12, fontFamily: font.medium },
  });
