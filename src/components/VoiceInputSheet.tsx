import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
  cancelAnimation,
  Easing,
} from 'react-native-reanimated';
import Voice, {
  SpeechResultsEvent,
  SpeechErrorEvent,
} from '@react-native-voice/voice';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useTheme } from '../theme/ThemeContext';
import { ColorPalette } from '../theme/colors';

interface VoiceInputSheetProps {
  visible: boolean;
  onResult: (text: string) => void;
  onClose: () => void;
}

export function VoiceInputSheet({ visible, onResult, onClose }: VoiceInputSheetProps) {
  const { colors } = useTheme();
  const s = useStyles(colors);
  const [isListening, setIsListening] = useState(false);
  const [partialResult, setPartialResult] = useState('');
  const [error, setError] = useState<string | null>(null);
  const mounted = useRef(true);

  const pulse = useSharedValue(1);

  const pulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulse.value }],
    opacity: 0.3 + (1 - pulse.value) * 2,
  }));

  const startPulse = useCallback(() => {
    pulse.value = 1;
    pulse.value = withRepeat(
      withTiming(1.4, { duration: 800, easing: Easing.inOut(Easing.ease) }),
      -1,
      true,
    );
  }, [pulse]);

  const stopPulse = useCallback(() => {
    cancelAnimation(pulse);
    pulse.value = 1;
  }, [pulse]);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  useEffect(() => {
    Voice.onSpeechPartialResults = (e: SpeechResultsEvent) => {
      if (!mounted.current) return;
      const text = e.value?.[0] || '';
      setPartialResult(text);
    };

    Voice.onSpeechResults = (e: SpeechResultsEvent) => {
      if (!mounted.current) return;
      const text = e.value?.[0] || '';
      if (text) {
        stopPulse();
        setIsListening(false);
        onResult(text);
      }
    };

    Voice.onSpeechError = (e: SpeechErrorEvent) => {
      if (!mounted.current) return;
      stopPulse();
      setIsListening(false);
      const msg = e.error?.message || 'Error de reconocimiento de voz';
      setError(msg);
    };

    return () => {
      Voice.destroy().then(Voice.removeAllListeners);
    };
  }, [onResult, stopPulse]);

  useEffect(() => {
    if (visible) {
      setPartialResult('');
      setError(null);
      startListening();
    } else {
      stopListening();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const startListening = async () => {
    try {
      setError(null);
      setPartialResult('');
      await Voice.start('es-MX');
      setIsListening(true);
      startPulse();
    } catch {
      setError('No se pudo iniciar el reconocimiento de voz');
    }
  };

  const stopListening = async () => {
    try {
      stopPulse();
      setIsListening(false);
      await Voice.stop();
      await Voice.destroy();
    } catch {
      // ignore cleanup errors
    }
  };

  const handleStop = async () => {
    await stopListening();
    if (partialResult) {
      onResult(partialResult);
    } else {
      onClose();
    }
  };

  const handleClose = async () => {
    await stopListening();
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={handleClose}
    >
      <View style={s.overlay}>
        <View style={s.sheet}>
          {/* Close button */}
          <Pressable style={s.closeButton} onPress={handleClose} hitSlop={12}>
            <Icon name="close" size={22} color={colors.textMuted} />
          </Pressable>

          <Text style={s.title}>Entrada por voz</Text>
          <Text style={s.subtitle}>
            Di tu gasto, por ejemplo: &quot;150 pesos uber&quot;
          </Text>

          {/* Pulsing mic circle */}
          <View style={s.micContainer}>
            {isListening ? (
              <Animated.View
                style={[
                  s.pulseRing,
                  { backgroundColor: colors.primary },
                  pulseStyle,
                ]}
              />
            ) : null}
            <View style={[s.micCircle, { backgroundColor: colors.primary }]}>
              <Icon
                name={isListening ? 'microphone' : 'microphone-off'}
                size={32}
                color={colors.white}
              />
            </View>
          </View>

          {/* Status text */}
          <Text style={s.statusText}>
            {isListening ? 'Escuchando...' : error ? error : 'Listo'}
          </Text>

          {/* Partial result */}
          {partialResult ? (
            <View style={s.resultBox}>
              <Text style={s.resultText}>{partialResult}</Text>
            </View>
          ) : null}

          {/* Actions */}
          <View style={s.actions}>
            {isListening ? (
              <Pressable style={s.stopButton} onPress={handleStop}>
                <Icon name="stop" size={18} color={colors.white} />
                <Text style={s.stopText}>Detener</Text>
              </Pressable>
            ) : (
              <Pressable style={s.retryButton} onPress={startListening}>
                <Icon name="microphone" size={18} color={colors.white} />
                <Text style={s.stopText}>Reintentar</Text>
              </Pressable>
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const useStyles = (colors: ColorPalette) =>
  StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.5)',
      justifyContent: 'flex-end',
    },
    sheet: {
      backgroundColor: colors.background,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      paddingHorizontal: 24,
      paddingTop: 20,
      paddingBottom: 40,
      alignItems: 'center',
      gap: 16,
    },
    closeButton: {
      position: 'absolute',
      top: 16,
      right: 16,
      zIndex: 10,
    },
    title: {
      color: colors.text,
      fontSize: 18,
      fontWeight: '800',
    },
    subtitle: {
      color: colors.textMuted,
      fontSize: 13,
      textAlign: 'center',
    },
    micContainer: {
      width: 96,
      height: 96,
      alignItems: 'center',
      justifyContent: 'center',
      marginVertical: 8,
    },
    pulseRing: {
      position: 'absolute',
      width: 96,
      height: 96,
      borderRadius: 48,
    },
    micCircle: {
      width: 72,
      height: 72,
      borderRadius: 36,
      alignItems: 'center',
      justifyContent: 'center',
    },
    statusText: {
      color: colors.textMuted,
      fontSize: 14,
      fontWeight: '600',
    },
    resultBox: {
      backgroundColor: colors.surface,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: 16,
      paddingVertical: 12,
      width: '100%',
    },
    resultText: {
      color: colors.text,
      fontSize: 16,
      textAlign: 'center',
    },
    actions: {
      flexDirection: 'row',
      gap: 12,
    },
    stopButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      backgroundColor: colors.danger,
      paddingHorizontal: 24,
      paddingVertical: 12,
      borderRadius: 14,
    },
    retryButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      backgroundColor: colors.primary,
      paddingHorizontal: 24,
      paddingVertical: 12,
      borderRadius: 14,
    },
    stopText: {
      color: colors.white,
      fontSize: 14,
      fontWeight: '700',
    },
  });
