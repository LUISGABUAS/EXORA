import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { FadeInDown } from 'react-native-reanimated';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { updateProfile } from '../lib/supabase';
import { useAuthStore } from '../store/useAuthStore';
import { ColorPalette } from '../theme/colors';
import { useTheme } from '../theme/ThemeContext';
import { isValidMexicanRfc } from '../utils/tax';

type Tab = 'login' | 'signup';
type PhoneStep = 'idle' | 'input' | 'otp';

export function LoginScreen() {
  const { colors, isDark } = useTheme();
  const s = useStyles(colors, isDark);
  const { signInWithEmail, signUpWithEmail, signInWithPhone, verifyOtp, signInWithGoogle } =
    useAuthStore();

  const [tab, setTab] = useState<Tab>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [phoneStep, setPhoneStep] = useState<PhoneStep>('idle');
  const [phone, setPhone] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [errors, setErrors] = useState<{ email?: string; password?: string; rfc?: string }>({});
  const [isAdult, setIsAdult] = useState(false);
  const [rfc, setRfc] = useState('');

  const validate = () => {
    const next: typeof errors = {};
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      next.email = 'Ingresa un correo valido.';
    }
    if (password.length < 6) {
      next.password = 'Minimo 6 caracteres.';
    }
    if (tab === 'signup' && isAdult && rfc.trim() && !isValidMexicanRfc(rfc)) {
      next.rfc = 'RFC invalido. Formato: XXXX000000XXX';
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleEmailAuth = async () => {
    if (!validate()) return;
    setLoading(true);
    if (tab === 'login') {
      const error = await signInWithEmail(email, password);
      setLoading(false);
      if (error) Alert.alert('Error', error);
    } else {
      const error = await signUpWithEmail(email, password);
      setLoading(false);
      if (error) {
        Alert.alert('Error', error);
      } else {
        if (isAdult && rfc.trim()) {
          const session = useAuthStore.getState().session;
          if (session?.user?.id) {
            await updateProfile(session.user.id, {
              rfc: rfc.trim().toUpperCase(),
              is_adult: isAdult,
            });
          }
        }
        Alert.alert('Cuenta creada', 'Revisa tu correo para confirmar tu cuenta.');
      }
    }
  };

  const handleGoogleSignIn = async () => {
    setLoading(true);
    const error = await signInWithGoogle();
    setLoading(false);
    if (error) Alert.alert('Error', error);
  };

  const handleSendOtp = async () => {
    if (!phone.trim()) {
      Alert.alert('Error', 'Ingresa tu numero de telefono.');
      return;
    }
    setLoading(true);
    const error = await signInWithPhone(phone);
    setLoading(false);
    if (error) {
      Alert.alert('Error', error);
    } else {
      setPhoneStep('otp');
    }
  };

  const handleVerifyOtp = async () => {
    if (otpCode.length < 6) {
      Alert.alert('Error', 'Ingresa el codigo de 6 digitos.');
      return;
    }
    setLoading(true);
    const error = await verifyOtp(phone, otpCode);
    setLoading(false);
    if (error) Alert.alert('Error', error);
  };

  return (
    <SafeAreaView style={s.safe}>
      <KeyboardAvoidingView
        style={s.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={s.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Animated.View entering={FadeInDown.duration(500).springify()} style={s.hero}>
            <Icon name="wallet-outline" size={48} color={colors.primary} />
            <Text style={s.title}>Expensia</Text>
            <Text style={s.subtitle}>
              Controla tus gastos, tickets y deducciones fiscales.
            </Text>
          </Animated.View>

          {/* Tabs */}
          <View style={s.tabs}>
            <Pressable
              style={[s.tab, tab === 'login' && s.tabActive]}
              onPress={() => setTab('login')}
            >
              <Text style={[s.tabText, tab === 'login' && s.tabTextActive]}>
                Iniciar sesion
              </Text>
            </Pressable>
            <Pressable
              style={[s.tab, tab === 'signup' && s.tabActive]}
              onPress={() => setTab('signup')}
            >
              <Text style={[s.tabText, tab === 'signup' && s.tabTextActive]}>
                Crear cuenta
              </Text>
            </Pressable>
          </View>

          {/* Email form */}
          <View style={s.card}>
            <View style={s.inputGroup}>
              <TextInput
                placeholder="Correo electronico"
                placeholderTextColor={colors.textMuted}
                style={[s.input, errors.email && s.inputError]}
                value={email}
                onChangeText={t => {
                  setEmail(t);
                  setErrors(e => ({ ...e, email: undefined }));
                }}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
              />
              {errors.email ? (
                <Text style={s.errorText}>{errors.email}</Text>
              ) : null}
            </View>

            <View style={s.inputGroup}>
              <TextInput
                placeholder="Contrasena"
                placeholderTextColor={colors.textMuted}
                style={[s.input, errors.password && s.inputError]}
                value={password}
                onChangeText={t => {
                  setPassword(t);
                  setErrors(e => ({ ...e, password: undefined }));
                }}
                secureTextEntry
              />
              {errors.password ? (
                <Text style={s.errorText}>{errors.password}</Text>
              ) : null}
            </View>

            {tab === 'signup' ? (
              <>
                <Pressable
                  style={s.checkboxRow}
                  onPress={() => setIsAdult(v => !v)}
                >
                  <Icon
                    name={isAdult ? 'checkbox-marked' : 'checkbox-blank-outline'}
                    size={22}
                    color={isAdult ? colors.primary : colors.textMuted}
                  />
                  <Text style={s.checkboxLabel}>Soy mayor de 18 anos</Text>
                </Pressable>

                {isAdult ? (
                  <View style={s.inputGroup}>
                    <TextInput
                      placeholder="RFC (opcional)"
                      placeholderTextColor={colors.textMuted}
                      style={[s.input, errors.rfc && s.inputError]}
                      value={rfc}
                      onChangeText={t => {
                        setRfc(t);
                        setErrors(e => ({ ...e, rfc: undefined }));
                      }}
                      autoCapitalize="characters"
                      maxLength={13}
                    />
                    {errors.rfc ? (
                      <Text style={s.errorText}>{errors.rfc}</Text>
                    ) : null}
                  </View>
                ) : null}
              </>
            ) : null}

            <Pressable
              style={s.primaryButton}
              onPress={handleEmailAuth}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color={colors.white} />
              ) : (
                <Text style={s.primaryButtonText}>
                  {tab === 'login' ? 'Iniciar sesion' : 'Crear cuenta'}
                </Text>
              )}
            </Pressable>
          </View>

          {/* Separator */}
          <View style={s.separator}>
            <View style={s.separatorLine} />
            <Text style={s.separatorText}>o continua con</Text>
            <View style={s.separatorLine} />
          </View>

          {/* Google button */}
          <Pressable
            style={s.googleButton}
            onPress={handleGoogleSignIn}
            disabled={loading}
          >
            <Icon name="google" size={20} color={colors.white} />
            <Text style={s.googleButtonText}>Continuar con Google</Text>
          </Pressable>

          {/* Phone button */}
          <Pressable
            style={s.phoneButton}
            onPress={() => setPhoneStep('input')}
            disabled={loading}
          >
            <Icon name="phone" size={20} color={colors.white} />
            <Text style={s.phoneButtonText}>Telefono (SMS)</Text>
          </Pressable>

          {/* Phone OTP flow */}
          {phoneStep !== 'idle' ? (
            <View style={s.card}>
              {phoneStep === 'input' ? (
                <>
                  <Text style={s.cardTitle}>Ingresa tu numero</Text>
                  <TextInput
                    placeholder="+52 1234567890"
                    placeholderTextColor={colors.textMuted}
                    style={s.input}
                    value={phone}
                    onChangeText={setPhone}
                    keyboardType="phone-pad"
                  />
                  <Pressable
                    style={s.primaryButton}
                    onPress={handleSendOtp}
                    disabled={loading}
                  >
                    {loading ? (
                      <ActivityIndicator color={colors.white} />
                    ) : (
                      <Text style={s.primaryButtonText}>
                        Enviar codigo
                      </Text>
                    )}
                  </Pressable>
                </>
              ) : (
                <>
                  <Text style={s.cardTitle}>
                    Codigo enviado a {phone}
                  </Text>
                  <TextInput
                    placeholder="Codigo de 6 digitos"
                    placeholderTextColor={colors.textMuted}
                    style={s.input}
                    value={otpCode}
                    onChangeText={setOtpCode}
                    keyboardType="number-pad"
                    maxLength={6}
                  />
                  <Pressable
                    style={s.primaryButton}
                    onPress={handleVerifyOtp}
                    disabled={loading}
                  >
                    {loading ? (
                      <ActivityIndicator color={colors.white} />
                    ) : (
                      <Text style={s.primaryButtonText}>Verificar</Text>
                    )}
                  </Pressable>
                </>
              )}
              <Pressable
                onPress={() => {
                  setPhoneStep('idle');
                  setOtpCode('');
                }}
              >
                <Text style={s.cancelLink}>Cancelar</Text>
              </Pressable>
            </View>
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const useStyles = (colors: ColorPalette, isDark: boolean) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.background },
    flex: { flex: 1 },
    scroll: { padding: 24, gap: 20 },
    hero: { alignItems: 'center', gap: 8, paddingVertical: 24 },
    title: { fontSize: 30, fontWeight: '800', color: colors.text },
    subtitle: {
      color: colors.textMuted,
      textAlign: 'center',
      lineHeight: 22,
      paddingHorizontal: 16,
    },
    tabs: {
      flexDirection: 'row',
      backgroundColor: colors.surfaceAlt,
      borderRadius: 16,
      padding: 4,
    },
    tab: { flex: 1, paddingVertical: 12, alignItems: 'center', borderRadius: 14 },
    tabActive: { backgroundColor: isDark ? colors.surface : colors.white },
    tabText: { color: colors.textMuted, fontWeight: '600' },
    tabTextActive: { color: colors.text, fontWeight: '700' },
    card: {
      backgroundColor: colors.surface,
      borderRadius: 24,
      padding: 18,
      borderWidth: 1,
      borderColor: colors.border,
      gap: 14,
    },
    cardTitle: { color: colors.text, fontSize: 16, fontWeight: '700' },
    inputGroup: { gap: 4 },
    input: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 14,
      paddingHorizontal: 14,
      paddingVertical: 12,
      backgroundColor: isDark ? colors.surfaceAlt : colors.white,
      color: colors.text,
      fontSize: 15,
    },
    inputError: { borderColor: colors.danger },
    errorText: { color: colors.danger, fontSize: 12, marginLeft: 4 },
    checkboxRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    checkboxLabel: { color: colors.text, fontWeight: '600' },
    primaryButton: {
      backgroundColor: colors.primary,
      paddingVertical: 14,
      borderRadius: 16,
      alignItems: 'center',
    },
    primaryButtonText: { color: colors.white, fontWeight: '700', fontSize: 15 },
    separator: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    separatorLine: { flex: 1, height: 1, backgroundColor: colors.border },
    separatorText: { color: colors.textMuted, fontSize: 13 },
    googleButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      paddingVertical: 14,
      borderRadius: 16,
      backgroundColor: '#4285F4',
    },
    googleButtonText: { color: colors.white, fontWeight: '700', fontSize: 15 },
    phoneButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      paddingVertical: 14,
      borderRadius: 16,
      backgroundColor: colors.success,
    },
    phoneButtonText: { color: colors.white, fontWeight: '700', fontSize: 15 },
    cancelLink: {
      color: colors.textMuted,
      fontWeight: '600',
      textAlign: 'center',
    },
  });
