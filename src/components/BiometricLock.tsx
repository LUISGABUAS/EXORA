import React, { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import {
  authenticateWithBiometrics,
  BiometricType,
  getBiometricIcon,
  getBiometricLabel,
} from '../services/biometricService';
import { useTheme } from '../theme/ThemeContext';

interface BiometricLockProps {
  biometricType: BiometricType;
  onUnlocked: () => void;
}

export function BiometricLock({ biometricType, onUnlocked }: BiometricLockProps) {
  const { colors, isDark } = useTheme();
  const [failed, setFailed] = useState(false);
  const [loading, setLoading] = useState(false);

  const prompt = useCallback(async () => {
    setLoading(true);
    setFailed(false);
    const ok = await authenticateWithBiometrics();
    setLoading(false);
    if (ok) {
      onUnlocked();
    } else {
      setFailed(true);
    }
  }, [onUnlocked]);

  // Auto-prompt on mount
  useEffect(() => {
    const t = setTimeout(prompt, 300);
    return () => clearTimeout(t);
  }, [prompt]);

  const label = getBiometricLabel(biometricType);
  const iconName = getBiometricIcon(biometricType);

  return (
    <Animated.View entering={FadeIn.duration(300)} style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Background circle decoration */}
      <View style={[styles.bgCircle, { backgroundColor: colors.primary + '08' }]} />

      <View style={styles.content}>
        {/* App name */}
        <Text style={[styles.appName, { color: colors.primary }]}>EXPENSIA</Text>

        {/* Lock icon */}
        <Pressable
          style={[
            styles.iconCircle,
            { backgroundColor: failed ? '#EF444418' : colors.primary + '15' },
          ]}
          onPress={prompt}
          disabled={loading}
        >
          <Icon
            name={failed ? 'lock-alert-outline' : iconName}
            size={48}
            color={failed ? '#EF4444' : colors.primary}
          />
        </Pressable>

        <Text style={[styles.title, { color: colors.text }]}>
          {failed ? 'Autenticación fallida' : 'App bloqueada'}
        </Text>
        <Text style={[styles.subtitle, { color: colors.textMuted }]}>
          {failed
            ? 'No se pudo verificar tu identidad'
            : `Usa ${label} para acceder a Expensia`}
        </Text>

        {/* Retry button */}
        <Pressable
          style={[styles.btn, { backgroundColor: colors.primary }, loading && styles.btnDisabled]}
          onPress={prompt}
          disabled={loading}
        >
          <Icon name={iconName} size={18} color="#fff" />
          <Text style={styles.btnText}>
            {loading ? 'Verificando…' : failed ? `Reintentar con ${label}` : `Continuar con ${label}`}
          </Text>
        </Pressable>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 999,
  },
  bgCircle: {
    position: 'absolute',
    width: 400,
    height: 400,
    borderRadius: 200,
    top: -100,
    right: -100,
  },
  content: {
    alignItems: 'center',
    gap: 16,
    paddingHorizontal: 40,
    width: '100%',
  },
  appName: {
    fontSize: 28,
    fontWeight: '900',
    letterSpacing: 4,
    marginBottom: 8,
  },
  iconCircle: {
    width: 110,
    height: 110,
    borderRadius: 55,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    width: '100%',
    paddingVertical: 16,
    borderRadius: 18,
    marginTop: 8,
  },
  btnDisabled: { opacity: 0.6 },
  btnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
});
