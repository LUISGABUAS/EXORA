import React, { useRef, useState } from 'react';
import { ActivityIndicator, Alert, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Camera, useCameraDevice } from 'react-native-vision-camera';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { ExpenseForm } from '../components/ExpenseForm';
import { ScreenContainer } from '../components/ScreenContainer';
import { recognizeReceiptText } from '../services/ocr/ocrService';
import { useExpenseStore } from '../store/useExpenseStore';
import { ColorPalette } from '../theme/colors';
import { useTheme } from '../theme/ThemeContext';
import { ExpenseInput, ParsedLineItem } from '../types/expense';
import { parseReceiptText } from '../utils/receiptParser';

type Mode = 'idle' | 'camera' | 'preview';

export function ScanScreen() {
  const { colors, isDark } = useTheme();
  const s = useStyles(colors, isDark);
  const addExpense = useExpenseStore((state) => state.addExpense);
  const device = useCameraDevice('back');
  const camera = useRef<Camera>(null);
  const [mode, setMode] = useState<Mode>('idle');
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [ocrLoading, setOcrLoading] = useState(false);
  const [prefill, setPrefill] = useState<Partial<ExpenseInput> | undefined>();
  const [flashActive, setFlashActive] = useState(false);
  const [lineItems, setLineItems] = useState<ParsedLineItem[]>([]);

  const openCamera = async () => {
    const permission = await Camera.requestCameraPermission();
    if (permission !== 'granted') {
      Alert.alert('Permiso requerido', 'Necesitamos acceso a la camara para escanear tickets.');
      return;
    }
    setMode('camera');
  };

  const takePicture = async () => {
    if (!camera.current) {
      return;
    }
    setFlashActive(true);
    const photo = await camera.current.takePhoto({ flash: 'off' });
    setTimeout(() => setFlashActive(false), 150);
    const uri = `file://${photo.path}`;
    setImageUri(uri);
    setMode('preview');
    await processImage(uri);
  };

  const processImage = async (uri: string) => {
    setOcrLoading(true);
    try {
      const rawText = await recognizeReceiptText(uri);
      if (!rawText) {
        throw new Error('No fue posible extraer texto de la imagen.');
      }

      const parsed = parseReceiptText(rawText);
      setLineItems(parsed.lineItems ?? []);
      setPrefill({
        amount: parsed.amount ?? 0,
        date: parsed.date ?? new Date().toISOString().slice(0, 10),
        category: parsed.suggestedCategory,
        description: `Ticket de ${parsed.merchantName || 'comercio'}`,
        merchantName: parsed.merchantName ?? '',
        conceptsText: parsed.conceptsText ?? '',
        ocrRawText: parsed.rawText,
        deductible: parsed.deductible,
        rfc: parsed.rfc ?? '',
        usoCFDI: parsed.usoCFDI ?? '',
        source: 'ocr',
      });
    } catch (error) {
      Alert.alert('OCR no disponible', error instanceof Error ? error.message : 'No se pudo procesar el ticket.');
    } finally {
      setOcrLoading(false);
    }
  };

  const saveScannedExpense = async (payload: ExpenseInput) => {
    await addExpense({ ...payload, source: 'ocr' });
    Alert.alert('Gasto guardado', 'El ticket fue registrado correctamente.');
    setPrefill(undefined);
    setLineItems([]);
    setImageUri(null);
    setMode('idle');
  };

  if (mode === 'camera' && device) {
    return (
      <View style={s.cameraContainer}>
        <Camera ref={camera} style={s.camera} device={device} isActive photo />
        {flashActive ? <View style={s.flash} /> : null}
        <View style={s.cameraControls}>
          <Pressable style={s.captureButton} onPress={takePicture}>
            <Icon name="camera" size={28} color={colors.primary} />
          </Pressable>
          <Pressable style={s.cancelButton} onPress={() => setMode('idle')}>
            <Text style={s.cancelText}>Cancelar</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <ScreenContainer>
      <View style={s.hero}>
        <Text style={s.title}>Escaneo OCR</Text>
        <Text style={s.subtitle}>Toma una foto del ticket o factura y completa el registro automaticamente.</Text>
      </View>

      <Pressable style={s.scanButton} onPress={openCamera} disabled={ocrLoading}>
        {ocrLoading ? (
          <ActivityIndicator color={colors.white} />
        ) : (
          <>
            <Icon name="camera-outline" size={20} color={isDark ? colors.background : colors.white} />
            <Text style={s.scanButtonText}>Abrir camara</Text>
          </>
        )}
      </Pressable>

      {imageUri ? <Image source={{ uri: imageUri }} style={s.preview} /> : null}

      {lineItems.length > 0 ? (
        <View style={s.lineItemsCard}>
          <Text style={s.lineItemsTitle}>Productos detectados</Text>
          <ScrollView style={s.lineItemsList} nestedScrollEnabled>
            {lineItems.map((item, idx) => (
              <View key={idx} style={s.lineItemRow}>
                <Text style={s.lineItemName} numberOfLines={1}>{item.name}</Text>
                <Text style={s.lineItemPrice}>${item.price.toFixed(2)}</Text>
              </View>
            ))}
          </ScrollView>
          <View style={s.lineItemsDivider} />
          <View style={s.lineItemRow}>
            <Text style={s.lineItemsTotal}>Total</Text>
            <Text style={s.lineItemsTotal}>
              ${lineItems.reduce((sum, i) => sum + i.price, 0).toFixed(2)}
            </Text>
          </View>
        </View>
      ) : null}

      {prefill ? <ExpenseForm initialValues={prefill} submitLabel="Guardar gasto escaneado" onSubmit={saveScannedExpense} /> : null}
    </ScreenContainer>
  );
}

const useStyles = (colors: ColorPalette, isDark: boolean) =>
  StyleSheet.create({
    hero: { backgroundColor: isDark ? colors.surface : '#d8f0ea', borderRadius: 28, padding: 22, gap: 8 },
    title: { color: colors.text, fontSize: 28, fontWeight: '800' },
    subtitle: { color: colors.textMuted, lineHeight: 22 },
    scanButton: {
      flexDirection: 'row',
      borderRadius: 18,
      backgroundColor: colors.text,
      paddingVertical: 16,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
    },
    scanButtonText: { color: isDark ? colors.background : colors.white, fontSize: 15, fontWeight: '700' },
    preview: { width: '100%', height: 220, borderRadius: 24 },
    lineItemsCard: {
      backgroundColor: colors.surface,
      borderRadius: 18,
      padding: 16,
      borderWidth: 1,
      borderColor: colors.border,
    },
    lineItemsTitle: {
      fontSize: 16,
      fontWeight: '700',
      color: colors.text,
      marginBottom: 12,
    },
    lineItemsList: { maxHeight: 200 },
    lineItemRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: 6,
    },
    lineItemName: { flex: 1, fontSize: 14, color: colors.text, marginRight: 12 },
    lineItemPrice: { fontSize: 14, fontWeight: '600', color: colors.primary },
    lineItemsDivider: {
      height: 1,
      backgroundColor: colors.border,
      marginVertical: 8,
    },
    lineItemsTotal: { fontSize: 15, fontWeight: '800', color: colors.text },
    cameraContainer: { flex: 1, backgroundColor: '#000' },
    camera: { flex: 1 },
    flash: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: '#fff',
      opacity: 0.8,
      zIndex: 10,
    },
    cameraControls: { position: 'absolute', bottom: 48, left: 0, right: 0, alignItems: 'center', gap: 20 },
    captureButton: {
      width: 72,
      height: 72,
      borderRadius: 36,
      backgroundColor: colors.white,
      borderWidth: 4,
      borderColor: colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    cancelButton: { paddingHorizontal: 24, paddingVertical: 10 },
    cancelText: { color: colors.white, fontWeight: '700', fontSize: 16 },
  });
