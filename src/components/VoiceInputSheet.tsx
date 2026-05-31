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
import { convertSpanishNumbers } from '../utils/spanishNumbers';

interface VoiceInputSheetProps {
  visible: boolean;
  onResult: (text: string) => void;
  onClose: () => void;
}

type VoiceState = 'idle' | 'listening' | 'done' | 'error';

export function VoiceInputSheet({ visible, onResult, onClose }: VoiceInputSheetProps) {
  const { colors } = useTheme();
  const s = useStyles(colors);

  const [voiceState, setVoiceState] = useState<VoiceState>('idle');
  const [liveText, setLiveText] = useState('');      // partial while speaking (replaced each update)
  const [sessionText, setSessionText] = useState(''); // final result of current session (replaced, not appended)
  const [accumulated, setAccumulated] = useState(''); // confirmed text from previous sessions
  const [errorMsg, setErrorMsg] = useState('');
  const mounted = useRef(true);

  const pulse = useSharedValue(1);
  const pulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulse.value }],
    opacity: 0.3 + (1 - pulse.value) * 2,
  }));

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  // Register Voice callbacks once
  useEffect(() => {
    Voice.onSpeechPartialResults = (e: SpeechResultsEvent) => {
      if (!mounted.current) return;
      setLiveText(e.value?.[0] ?? '');
    };

    Voice.onSpeechResults = (e: SpeechResultsEvent) => {
      if (!mounted.current) return;
      const text = e.value?.[0] ?? '';
      // REPLACE session text — iOS fires this multiple times with refined results
      setSessionText(text);
      setLiveText('');
      setVoiceState('done');
      cancelAnimation(pulse);
      pulse.value = 1;
    };

    Voice.onSpeechError = (e: SpeechErrorEvent) => {
      if (!mounted.current) return;
      cancelAnimation(pulse);
      pulse.value = 1;
      const code = String((e.error as any)?.code ?? '');
      // code 203 / 7 = "No speech detected" — normal, just go to done state
      if (code === '203' || code === '7' || code === '1110') {
        setVoiceState('done');
        return;
      }
      setErrorMsg(e.error?.message ?? 'Error de reconocimiento');
      setVoiceState('error');
    };

    return () => {
      Voice.destroy().then(Voice.removeAllListeners).catch(() => {});
    };
  }, [pulse]);

  // Start/stop with visibility
  useEffect(() => {
    if (visible) {
      setAccumulated('');
      setSessionText('');
      setLiveText('');
      setErrorMsg('');
      setVoiceState('idle');
      doStart();
    } else {
      doStop();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const doStart = async () => {
    try {
      await Voice.destroy();
      await Voice.start('es-MX');
      if (!mounted.current) return;
      setVoiceState('listening');
      pulse.value = withRepeat(
        withTiming(1.4, { duration: 800, easing: Easing.inOut(Easing.ease) }),
        -1,
        true,
      );
    } catch {
      if (mounted.current) {
        setErrorMsg('No se pudo iniciar el micrófono');
        setVoiceState('error');
      }
    }
  };

  const doStop = useCallback(async () => {
    cancelAnimation(pulse);
    pulse.value = 1;
    try { await Voice.stop(); } catch { /* ignore */ }
    try { await Voice.destroy(); } catch { /* ignore */ }
  }, [pulse]);

  // Build the full confirmed text = previous sessions + current session
  const fullText = [accumulated, sessionText].filter(Boolean).join(' ');

  // "Agregar más" — commit session, start new one
  const handleContinue = async () => {
    // Commit current session to accumulated
    if (sessionText.trim()) {
      setAccumulated(fullText);
    }
    setSessionText('');
    setLiveText('');
    setErrorMsg('');
    await doStart();
  };

  // "Detener" while listening — stop, treat partial as session result
  const handleStopEarly = async () => {
    await doStop();
    const text = liveText.trim() || sessionText.trim();
    if (text) {
      setSessionText(text);
      setLiveText('');
    }
    setVoiceState('done');
  };

  // "Usar texto" — convert and send
  const handleUse = () => {
    const raw = fullText.trim();
    if (raw) onResult(convertSpanishNumbers(raw));
  };

  // "Reintentar" — clear everything
  const handleRetry = async () => {
    await doStop();
    setAccumulated('');
    setSessionText('');
    setLiveText('');
    setErrorMsg('');
    await doStart();
  };

  const handleClose = async () => {
    await doStop();
    onClose();
  };

  // What to show as the main text
  const displayText = voiceState === 'listening'
    ? [accumulated, sessionText, liveText].filter(Boolean).join(' ')
    : fullText;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={handleClose}>
      <View style={s.overlay}>
        <View style={s.sheet}>
          <Pressable style={s.closeBtn} onPress={handleClose} hitSlop={12}>
            <Icon name="close" size={22} color={colors.textMuted} />
          </Pressable>

          <Text style={s.title}>Entrada por voz</Text>
          <Text style={s.subtitle}>
            {voiceState === 'listening'
              ? 'Habla tu gasto... ("150 pesos uber")'
              : voiceState === 'done'
              ? '¿Agregar más o usar el texto?'
              : voiceState === 'error'
              ? errorMsg
              : 'Iniciando micrófono...'}
          </Text>

          {/* Mic circle */}
          <View style={s.micWrap}>
            {voiceState === 'listening' ? (
              <Animated.View style={[s.pulseRing, { backgroundColor: colors.primary }, pulseStyle]} />
            ) : null}
            <View style={[
              s.micCircle,
              { backgroundColor: voiceState === 'listening' ? colors.primary : colors.surfaceAlt },
            ]}>
              <Icon
                name={voiceState === 'listening' ? 'microphone' : voiceState === 'error' ? 'microphone-off' : 'microphone-outline'}
                size={32}
                color={voiceState === 'listening' ? colors.white : colors.textMuted}
              />
            </View>
          </View>

          {/* Live/final text */}
          {displayText ? (
            <View style={s.textBox}>
              <Text style={s.textResult}>{displayText}</Text>
            </View>
          ) : voiceState === 'listening' ? (
            <Text style={s.listeningHint}>Escuchando...</Text>
          ) : null}

          {/* Action buttons */}
          <View style={s.actions}>
            {voiceState === 'listening' ? (
              <Pressable style={s.btnStop} onPress={handleStopEarly}>
                <Icon name="stop-circle-outline" size={18} color={colors.white} />
                <Text style={s.btnText}>Detener</Text>
              </Pressable>
            ) : voiceState === 'done' ? (
              <>
                {fullText ? (
                  <Pressable style={s.btnUse} onPress={handleUse}>
                    <Icon name="check" size={18} color={colors.white} />
                    <Text style={s.btnText}>Usar texto</Text>
                  </Pressable>
                ) : null}
                <Pressable style={s.btnContinue} onPress={handleContinue}>
                  <Icon name="microphone-plus" size={18} color={colors.white} />
                  <Text style={s.btnText}>{fullText ? 'Agregar más' : 'Grabar'}</Text>
                </Pressable>
                <Pressable style={s.btnRetry} onPress={handleRetry}>
                  <Icon name="refresh" size={16} color={colors.textMuted} />
                </Pressable>
              </>
            ) : voiceState === 'error' ? (
              <Pressable style={s.btnContinue} onPress={handleRetry}>
                <Icon name="microphone" size={18} color={colors.white} />
                <Text style={s.btnText}>Reintentar</Text>
              </Pressable>
            ) : null}
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
      backgroundColor: 'rgba(0,0,0,0.55)',
      justifyContent: 'flex-end',
    },
    sheet: {
      backgroundColor: colors.background,
      borderTopLeftRadius: 28,
      borderTopRightRadius: 28,
      paddingHorizontal: 24,
      paddingTop: 24,
      paddingBottom: 44,
      alignItems: 'center',
      gap: 18,
    },
    closeBtn: {
      position: 'absolute',
      top: 18,
      right: 18,
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
      lineHeight: 18,
    },
    micWrap: {
      width: 96,
      height: 96,
      alignItems: 'center',
      justifyContent: 'center',
      marginVertical: 4,
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
    textBox: {
      backgroundColor: colors.surface,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: 18,
      paddingVertical: 14,
      width: '100%',
      minHeight: 52,
    },
    textResult: {
      color: colors.text,
      fontSize: 16,
      textAlign: 'center',
      lineHeight: 22,
    },
    listeningHint: {
      color: colors.primary,
      fontSize: 14,
      fontWeight: '600',
    },
    actions: {
      flexDirection: 'row',
      gap: 10,
      alignItems: 'center',
    },
    btnStop: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      backgroundColor: colors.danger,
      paddingHorizontal: 24,
      paddingVertical: 13,
      borderRadius: 14,
    },
    btnUse: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      backgroundColor: colors.primary,
      paddingHorizontal: 20,
      paddingVertical: 13,
      borderRadius: 14,
    },
    btnContinue: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      backgroundColor: colors.surfaceAlt,
      paddingHorizontal: 20,
      paddingVertical: 13,
      borderRadius: 14,
    },
    btnRetry: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: colors.surfaceAlt,
      alignItems: 'center',
      justifyContent: 'center',
    },
    btnText: {
      color: colors.white,
      fontSize: 14,
      fontWeight: '700',
    },
  });
