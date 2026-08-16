import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Image,
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, {
  FadeIn,
  FadeInDown,
  FadeInUp,
} from 'react-native-reanimated';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { GoogleLogo } from '../components/GoogleLogo';
import { useAuthStore } from '../store/useAuthStore';
import { ColorPalette } from '../theme/colors';
import { font } from '../theme/typography';
import { useTheme } from '../theme/ThemeContext';

const logo = require('../assets/logo_new.png');
const { height } = Dimensions.get('window');
const IS_IOS = Platform.OS === 'ios';

export function LoginScreen() {
  const { colors, isDark } = useTheme();
  const s = useStyles(colors, isDark);
  const { signInWithGoogle, signInWithApple } = useAuthStore();

  const [loadingGoogle, setLoadingGoogle] = useState(false);
  const [loadingApple, setLoadingApple] = useState(false);
  const loading = loadingGoogle || loadingApple;

  const handleGoogle = async () => {
    setLoadingGoogle(true);
    const error = await signInWithGoogle();
    setLoadingGoogle(false);
    if (error) Alert.alert('Error al iniciar sesión', error);
  };

  const handleApple = async () => {
    setLoadingApple(true);
    const error = await signInWithApple();
    setLoadingApple(false);
    if (error) Alert.alert('Error al iniciar sesión', error);
  };

  return (
    <SafeAreaView style={s.safe}>
      <KeyboardAvoidingView style={s.flex} behavior={IS_IOS ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={s.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Background glow */}
          <View style={s.glowTop} />

          {/* Hero */}
          <Animated.View entering={FadeInUp.delay(100).duration(600)} style={s.hero}>
            <View style={s.logoContainer}>
              <Image source={logo} style={s.logo} resizeMode="cover" />
            </View>
            <Text style={s.appName}>EXORA</Text>
            <Text style={s.tagline}>
              Finanzas inteligentes para{'\n'}profesionistas en México
            </Text>
          </Animated.View>

          {/* Buttons */}
          <Animated.View entering={FadeInDown.delay(300).duration(500)} style={s.buttons}>

            {/* Google */}
            <Pressable
              style={({ pressed }) => [s.btn, s.btnGoogle, pressed && s.pressed, loading && s.btnDisabled]}
              onPress={handleGoogle}
              disabled={loading}
            >
              {loadingGoogle ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <>
                  <GoogleLogo size={20} />
                  <Text style={s.btnTextGoogle}>Continuar con Google</Text>
                </>
              )}
            </Pressable>

            {/* Apple — solo iOS */}
            {IS_IOS && (
              <Pressable
                style={({ pressed }) => [s.btn, s.btnApple, pressed && s.pressed, loading && s.btnDisabled]}
                onPress={handleApple}
                disabled={loading}
              >
                {loadingApple ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <>
                    <Icon name="apple" size={20} color="#FFFFFF" />
                    <Text style={s.btnTextApple}>Continuar con Apple</Text>
                  </>
                )}
              </Pressable>
            )}

            {/* Divider */}
            <View style={s.dividerRow}>
              <View style={s.dividerLine} />
              <Text style={s.dividerText}>inicio seguro</Text>
              <View style={s.dividerLine} />
            </View>

            {/* Security badges */}
            <View style={s.badgeRow}>
              <View style={s.badge}>
                <Icon name="shield-check-outline" size={14} color={colors.primary} />
                <Text style={s.badgeText}>Cifrado end-to-end</Text>
              </View>
              <View style={s.badge}>
                <Icon name="bank-outline" size={14} color={colors.primary} />
                <Text style={s.badgeText}>Datos fiscales seguros</Text>
              </View>
            </View>
          </Animated.View>

          {/* Footer */}
          <Animated.View entering={FadeIn.delay(500).duration(400)} style={s.footer}>
            <Text style={s.terms}>Al continuar aceptas nuestros</Text>
            <View style={s.termsRow}>
              <Pressable onPress={() => Linking.openURL('https://www.exora.finance/terminos')}>
                <Text style={s.termsLink}>Términos de uso</Text>
              </Pressable>
              <Text style={s.terms}> y </Text>
              <Pressable onPress={() => Linking.openURL('https://www.exora.finance/privacidad')}>
                <Text style={s.termsLink}>Política de privacidad</Text>
              </Pressable>
            </View>
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const useStyles = (colors: ColorPalette, isDark: boolean) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.background },
    flex: { flex: 1 },
    scroll: {
      flexGrow: 1,
      paddingHorizontal: 24,
      paddingBottom: 32,
      justifyContent: 'space-between',
      minHeight: height * 0.85,
    },

    // Background glow
    glowTop: {
      position: 'absolute',
      top: -80,
      left: '50%',
      marginLeft: -150,
      width: 300,
      height: 300,
      borderRadius: 150,
      backgroundColor: isDark ? 'rgba(34,197,94,0.07)' : 'rgba(34,197,94,0.08)',
    },

    // Hero
    hero: {
      alignItems: 'center',
      paddingTop: 56,
      gap: 16,
    },
    logoContainer: {
      width: 88,
      height: 88,
      borderRadius: 22,
      overflow: 'hidden',
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
      shadowColor: colors.primary,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.25,
      shadowRadius: 16,
      elevation: 8,
    },
    logo: { width: 88, height: 88 },
    appName: {
      color: colors.text,
      fontSize: 32,
      fontFamily: font.black,
      letterSpacing: 6,
      marginTop: 4,
    },
    tagline: {
      color: colors.textMuted,
      fontSize: 15,
      textAlign: 'center',
      lineHeight: 23,
      fontFamily: font.regular,
    },

    // Buttons
    buttons: { gap: 12, paddingTop: 8 },
    btn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 12,
      paddingVertical: 17,
      borderRadius: 16,
    },
    pressed: { opacity: 0.85, transform: [{ scale: 0.985 }] },
    btnDisabled: { opacity: 0.55 },

    // Google button — white card style
    btnGoogle: {
      backgroundColor: '#FFFFFF',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.15,
      shadowRadius: 8,
      elevation: 4,
    },
    btnTextGoogle: {
      color: '#1F1F1F',
      fontSize: 16,
      fontWeight: '600',
    },

    // Apple button — solid black
    btnApple: {
      backgroundColor: '#000000',
      borderWidth: 1,
      borderColor: isDark ? 'rgba(255,255,255,0.15)' : 'transparent',
    },
    btnTextApple: {
      color: '#FFFFFF',
      fontSize: 16,
      fontWeight: '600',
    },

    // Divider
    dividerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      marginVertical: 4,
    },
    dividerLine: {
      flex: 1,
      height: 1,
      backgroundColor: colors.border,
    },
    dividerText: {
      color: colors.textMuted,
      fontSize: 11,
      fontWeight: '500',
      textTransform: 'uppercase',
      letterSpacing: 1,
    },

    // Badges
    badgeRow: {
      flexDirection: 'row',
      justifyContent: 'center',
      gap: 16,
    },
    badge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      backgroundColor: isDark ? 'rgba(34,197,94,0.08)' : 'rgba(34,197,94,0.06)',
      paddingHorizontal: 12,
      paddingVertical: 7,
      borderRadius: 20,
    },
    badgeText: {
      color: colors.textMuted,
      fontSize: 12,
      fontWeight: '500',
    },

    // Footer
    footer: { paddingTop: 16, alignItems: 'center' },
    termsRow: {
      flexDirection: 'row',
      alignItems: 'center',
      flexWrap: 'wrap',
      justifyContent: 'center',
      marginTop: 2,
    },
    terms: {
      color: colors.textMuted,
      fontSize: 12,
      textAlign: 'center',
      lineHeight: 18,
    },
    termsLink: { color: colors.primary, fontWeight: '600', fontSize: 12 },
  });
