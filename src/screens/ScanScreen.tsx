import React, { useRef, useState } from 'react';
import { ActivityIndicator, Alert, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Camera, useCameraDevice } from 'react-native-vision-camera';
import Animated, { FadeInDown } from 'react-native-reanimated';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { ExpenseForm } from '../components/ExpenseForm';
import { PaywallModal } from '../components/PaywallModal';
import { ScreenContainer } from '../components/ScreenContainer';
import { recognizeReceiptDetailed, OcrResult } from '../services/ocr/ocrService';
import { pickXMLFile, pickImageFromGallery } from '../services/fileService';
import { saveReceiptImage } from '../services/receiptImageService';
import { parseCFDIXml, readXmlFile } from '../services/xmlService';
import { useExpenseStore } from '../store/useExpenseStore';
import { usePremiumStore } from '../store/usePremiumStore';
import { ColorPalette } from '../theme/colors';
import { useTheme } from '../theme/ThemeContext';
import { ExpenseInput, ParsedLineItem } from '../types/expense';
import { parseReceiptText } from '../utils/receiptParser';

type Mode = 'idle' | 'camera' | 'preview' | 'options';

const CONFIDENCE_LABELS: Record<OcrResult['confidence'], string> = {
  high: 'Alta precisión',
  medium: 'Precisión media',
  low: 'Baja precisión',
};
const CONFIDENCE_ICONS: Record<OcrResult['confidence'], string> = {
  high: 'check-circle',
  medium: 'alert-circle',
  low: 'alert',
};

export function ScanScreen() {
  const { colors, isDark } = useTheme();
  const s = useStyles(colors, isDark);
  const addExpense = useExpenseStore(state => state.addExpense);
  const canScanOCR = usePremiumStore(state => state.canScanOCR);
  const incrementScan = usePremiumStore(state => state.incrementScan);
  const weeklyScans = usePremiumStore(state => state.weeklyScans);
  const hasFullAccess = usePremiumStore(state => state.hasFullAccess);
  const fiscalRegime = usePremiumStore(state => state.fiscalRegime);
  const device = useCameraDevice('back');
  const camera = useRef<Camera>(null);
  const [mode, setMode] = useState<Mode>('options');
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [ocrLoading, setOcrLoading] = useState(false);
  const [prefill, setPrefill] = useState<Partial<ExpenseInput> | undefined>();
  const [flashActive, setFlashActive] = useState(false);
  const [lineItems, setLineItems] = useState<ParsedLineItem[]>([]);
  const [ocrConfidence, setOcrConfidence] = useState<OcrResult['confidence'] | null>(null);
  const [ocrError, setOcrError] = useState<string | null>(null);
  const [paywallVisible, setPaywallVisible] = useState(false);

  const openCamera = async () => {
    if (!canScanOCR()) { setPaywallVisible(true); return; }
    const permission = await Camera.requestCameraPermission();
    if (permission !== 'granted') {
      Alert.alert('Permiso requerido', 'Necesitamos acceso a la cámara para escanear tickets.');
      return;
    }
    setMode('camera');
  };

  const pickXML = async () => {
    // XML import is always free — no scan limit
    setOcrLoading(true);
    setOcrError(null);
    try {
      const file = await pickXMLFile();
      if (!file) {
        setOcrLoading(false);
        return;
      }

      const xmlContent = await readXmlFile(file.uri);
      const parsed = parseCFDIXml(xmlContent);

      setPrefill({
        amount: parsed.amount ?? 0,
        date: parsed.date ?? new Date().toISOString().slice(0, 10),
        category: parsed.suggestedCategory,
        description: `Factura de ${parsed.merchantName || 'proveedor'}`,
        merchantName: parsed.merchantName ?? '',
        conceptsText: parsed.conceptsText ?? '',
        ocrRawText: parsed.rawXml,
        deductible: parsed.deductible,
        rfc: parsed.rfc ?? '',
        usoCFDI: parsed.usoCFDI ?? '',
        source: 'ocr',
      });
      setOcrConfidence('high');
      setMode('preview');
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'No se pudo procesar la factura.';
      setOcrError(msg);
      Alert.alert('Error al importar XML', msg);
    } finally {
      setOcrLoading(false);
    }
  };

  const pickPhoto = async () => {
    if (!canScanOCR()) { setPaywallVisible(true); return; }
    setOcrLoading(true);
    setOcrError(null);
    try {
      const photo = await pickImageFromGallery();
      if (!photo) {
        setOcrLoading(false);
        return;
      }

      setImageUri(photo.uri);
      setMode('preview');
      await processImage(photo.uri);
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'No se pudo cargar la imagen.';
      setOcrError(msg);
      Alert.alert('Error al seleccionar foto', msg);
    } finally {
      setOcrLoading(false);
    }
  };

  const takePicture = async () => {
    if (!camera.current) return;
    setOcrError(null);
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
    setOcrError(null);
    setOcrConfidence(null);
    try {
      const ocrResult = await recognizeReceiptDetailed(uri);

      if (!ocrResult.text) {
        throw new Error('No se detectó texto en la imagen. Asegúrate de que el ticket sea legible.');
      }

      setOcrConfidence(ocrResult.confidence);
      const parsed = parseReceiptText(ocrResult.text, fiscalRegime);
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
      const msg = error instanceof Error
        ? error.message
        : 'No se pudo procesar el ticket.';
      setOcrError(msg);
      setOcrConfidence('low');
    } finally {
      setOcrLoading(false);
    }
  };

  const retryOcr = () => {
    if (imageUri) {
      processImage(imageUri);
    }
  };

  const doSave = async (payload: ExpenseInput) => {
    let receiptImageUri = payload.receiptImageUri;
    // Copy temp/gallery image to permanent storage
    if (imageUri && !receiptImageUri) {
      try {
        receiptImageUri = await saveReceiptImage(imageUri);
      } catch {
        // Non-fatal: save without image if copy fails
      }
    }
    await addExpense({ ...payload, source: 'ocr', receiptImageUri });
    await incrementScan();
    Alert.alert('Gasto guardado', 'El gasto se registró correctamente.');
    resetForm();
  };

  const saveScannedExpense = async (payload: ExpenseInput) => {
    if (payload.deductible && !hasFullAccess()) {
      Alert.alert(
        'Función Premium',
        'Las deducciones fiscales requieren el plan Premium. Tu gasto se guardará sin deducción.',
        [
          {
            text: 'Guardar sin deducción',
            onPress: () => doSave({ ...payload, deductible: false }),
          },
          { text: 'Ver planes', onPress: () => setPaywallVisible(true) },
        ],
      );
      return;
    }
    await doSave(payload);
  };

  const resetForm = () => {
    setPrefill(undefined);
    setLineItems([]);
    setImageUri(null);
    setOcrConfidence(null);
    setOcrError(null);
    setMode('options');
  };

  // ────── Options screen ──────
  if (mode === 'options') {
    return (
      <ScreenContainer>
        <Animated.View entering={FadeInDown.duration(350)}>
          <Text style={s.title}>Agregar gasto</Text>
          <Text style={s.subtitle}>Elige como registrar tu factura o gasto</Text>
        </Animated.View>

        <View style={s.optionsContainer}>
          <Animated.View entering={FadeInDown.delay(100).duration(300)}>
            <Pressable style={s.optionCard} onPress={openCamera} disabled={ocrLoading}>
              <View style={s.optionIcon}>
                <Icon name="camera" size={26} color={colors.primary} />
              </View>
              <View style={s.optionInfo}>
                <Text style={s.optionTitle}>Escanear ticket</Text>
                <Text style={s.optionDesc}>Toma una foto y extrae datos automáticamente</Text>
              </View>
              <Icon name="chevron-right" size={20} color={colors.textMuted} />
            </Pressable>
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(200).duration(300)}>
            <Pressable style={s.optionCard} onPress={pickXML} disabled={ocrLoading}>
              <View style={s.optionIcon}>
                {ocrLoading ? (
                  <ActivityIndicator color={colors.primary} />
                ) : (
                  <Icon name="file-xml-box" size={26} color={colors.primary} />
                )}
              </View>
              <View style={s.optionInfo}>
                <View style={s.optionTitleRow}>
                  <Text style={s.optionTitle}>Importar XML/CFDI</Text>
                  <View style={s.freeBadge}>
                    <Text style={s.freeBadgeText}>Gratis</Text>
                  </View>
                </View>
                <Text style={s.optionDesc}>Selecciona una factura XML del SAT</Text>
              </View>
              <Icon name="chevron-right" size={20} color={colors.textMuted} />
            </Pressable>
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(300).duration(300)}>
            <Pressable style={s.optionCard} onPress={pickPhoto} disabled={ocrLoading}>
              <View style={s.optionIcon}>
                <Icon name="image" size={26} color={colors.primary} />
              </View>
              <View style={s.optionInfo}>
                <Text style={s.optionTitle}>Seleccionar foto</Text>
                <Text style={s.optionDesc}>Elige una foto de tu galería</Text>
              </View>
              <Icon name="chevron-right" size={20} color={colors.textMuted} />
            </Pressable>
          </Animated.View>
        </View>

        {/* Scan counter (free users only) */}
        {!hasFullAccess() ? (
          <Animated.View entering={FadeInDown.delay(350).duration(300)}>
            <View style={s.scanCounter}>
              <Icon name="camera-iris" size={18} color={colors.primary} />
              <Text style={s.scanCounterText}>
                {Math.max(3 - weeklyScans, 0)} escaneos restantes esta semana
              </Text>
            </View>
          </Animated.View>
        ) : null}

        {/* Tips */}
        <Animated.View entering={FadeInDown.delay(400).duration(300)} style={s.tipsCard}>
          <View style={s.tipsHeader}>
            <Icon name="lightbulb-outline" size={16} color={colors.warning} />
            <Text style={s.tipsTitle}>Consejos para mejor resultado</Text>
          </View>
          <Text style={s.tipText}>• Buena iluminación, sin sombras</Text>
          <Text style={s.tipText}>• Ticket recto y completo en la foto</Text>
          <Text style={s.tipText}>• Evita fotos borrosas o movidas</Text>
        </Animated.View>

        <PaywallModal
          visible={paywallVisible}
          onClose={() => setPaywallVisible(false)}
          trigger="ocr_limit"
        />
      </ScreenContainer>
    );
  }

  // ────── Camera screen ──────
  if (mode === 'camera' && device) {
    return (
      <View style={s.cameraContainer}>
        <Camera ref={camera} style={s.camera} device={device} isActive photo />
        {flashActive ? <View style={s.flash} /> : null}

        {/* Guia visual — pointerEvents none para no bloquear botones */}
        <View style={s.cameraOverlay} pointerEvents="none">
          <View style={s.cameraGuide} />
          <Text style={s.cameraHint}>Centra el ticket dentro del recuadro</Text>
        </View>

        <View style={s.cameraControls}>
          <Pressable style={s.captureButton} onPress={takePicture}>
            <Icon name="camera" size={28} color={colors.primary} />
          </Pressable>
          <Pressable style={s.cameraCancelButton} onPress={resetForm}>
            <Text style={s.cameraCancelText}>Cancelar</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  // ────── Preview + form screen ──────
  return (
    <ScreenContainer>
      {imageUri ? (
        <Image source={{ uri: imageUri }} style={s.preview} resizeMode="cover" />
      ) : null}

      {/* Confidence badge */}
      {ocrConfidence && !ocrLoading ? (
        <Animated.View entering={FadeInDown.duration(250)} style={s.confidenceBadge}>
          <Icon
            name={CONFIDENCE_ICONS[ocrConfidence]}
            size={16}
            color={ocrConfidence === 'high' ? colors.success : ocrConfidence === 'medium' ? colors.warning : colors.danger}
          />
          <Text style={[
            s.confidenceText,
            { color: ocrConfidence === 'high' ? colors.success : ocrConfidence === 'medium' ? colors.warning : colors.danger },
          ]}>
            {CONFIDENCE_LABELS[ocrConfidence]}
          </Text>
        </Animated.View>
      ) : null}

      {/* OCR Error + retry */}
      {ocrError && !ocrLoading ? (
        <Animated.View entering={FadeInDown.duration(250)} style={s.errorCard}>
          <Icon name="alert-circle-outline" size={20} color={colors.danger} />
          <Text style={s.errorCardText}>{ocrError}</Text>
          {imageUri ? (
            <Pressable style={s.retryButton} onPress={retryOcr}>
              <Icon name="refresh" size={16} color={colors.white} />
              <Text style={s.retryText}>Reintentar</Text>
            </Pressable>
          ) : null}
        </Animated.View>
      ) : null}

      {lineItems.length > 0 ? (
        <View style={s.lineItemsCard}>
          <View style={s.lineItemsHeader}>
            <Icon name="receipt" size={18} color={colors.text} />
            <Text style={s.lineItemsTitle}>Productos detectados</Text>
            <Text style={s.lineItemsCount}>{lineItems.length}</Text>
          </View>
          <View style={s.lineItemsDivider} />
          <ScrollView style={s.lineItemsList} nestedScrollEnabled>
            {lineItems.map((item, idx) => (
              <View key={idx} style={s.lineItemRow}>
                <Text style={s.lineItemName} numberOfLines={1}>
                  {item.name}
                </Text>
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

      {prefill ? (
        <ExpenseForm
          initialValues={prefill}
          submitLabel="Guardar gasto"
          onSubmit={saveScannedExpense}
        />
      ) : null}

      {ocrLoading && !prefill ? (
        <View style={s.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={s.loadingText}>Procesando imagen...</Text>
          <Text style={s.loadingHint}>Esto puede tardar unos segundos</Text>
        </View>
      ) : null}

      {/* Back button */}
      {mode === 'preview' ? (
        <Pressable style={s.backButton} onPress={resetForm}>
          <Icon name="arrow-left" size={18} color={colors.white} />
          <Text style={s.backButtonText}>Volver</Text>
        </Pressable>
      ) : null}
    </ScreenContainer>
  );
}

const useStyles = (colors: ColorPalette, _isDark: boolean) =>
  StyleSheet.create({
    title: {
      color: colors.text,
      fontSize: 26,
      fontWeight: '800',
    },
    subtitle: {
      color: colors.textMuted,
      fontSize: 14,
      marginTop: 4,
      lineHeight: 20,
    },
    optionsContainer: { gap: 12 },
    optionCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 14,
      backgroundColor: colors.surface,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 16,
    },
    optionIcon: {
      width: 48,
      height: 48,
      borderRadius: 24,
      backgroundColor: colors.primary + '15',
      alignItems: 'center',
      justifyContent: 'center',
    },
    optionInfo: { flex: 1, gap: 2 },
    optionTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    optionTitle: { fontSize: 15, fontWeight: '700', color: colors.text },
    freeBadge: {
      backgroundColor: colors.success + '20',
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: 999,
    },
    freeBadgeText: {
      color: colors.success,
      fontSize: 10,
      fontWeight: '800',
    },
    optionDesc: { fontSize: 12, color: colors.textMuted },
    tipsCard: {
      backgroundColor: colors.warning + '10',
      borderRadius: 16,
      padding: 14,
      gap: 6,
    },
    tipsHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      marginBottom: 4,
    },
    tipsTitle: { fontSize: 13, fontWeight: '700', color: colors.text },
    tipText: { fontSize: 12, color: colors.textMuted, marginLeft: 22 },
    preview: {
      width: '100%',
      height: 200,
      borderRadius: 18,
    },
    confidenceBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      alignSelf: 'flex-start',
      gap: 6,
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 999,
      backgroundColor: colors.surfaceAlt,
    },
    confidenceText: {
      fontSize: 12,
      fontWeight: '700',
    },
    errorCard: {
      backgroundColor: colors.danger + '10',
      borderRadius: 16,
      padding: 14,
      gap: 8,
      alignItems: 'center',
    },
    errorCardText: {
      color: colors.danger,
      fontSize: 13,
      textAlign: 'center',
      lineHeight: 18,
    },
    retryButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      backgroundColor: colors.primary,
      paddingHorizontal: 16,
      paddingVertical: 8,
      borderRadius: 12,
      marginTop: 4,
    },
    retryText: { color: colors.white, fontSize: 13, fontWeight: '700' },
    lineItemsCard: {
      backgroundColor: colors.surface,
      borderRadius: 18,
      padding: 16,
      borderWidth: 1,
      borderColor: colors.border,
    },
    lineItemsHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    lineItemsTitle: {
      flex: 1,
      fontSize: 15,
      fontWeight: '700',
      color: colors.text,
    },
    lineItemsCount: {
      fontSize: 12,
      fontWeight: '700',
      color: colors.primary,
      backgroundColor: colors.primary + '15',
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: 999,
      overflow: 'hidden',
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
    loadingContainer: {
      alignItems: 'center',
      gap: 8,
      paddingVertical: 32,
    },
    loadingText: {
      color: colors.text,
      fontSize: 15,
      fontWeight: '600',
    },
    loadingHint: {
      color: colors.textMuted,
      fontSize: 12,
    },
    cameraContainer: { flex: 1, backgroundColor: '#000' },
    camera: { flex: 1 },
    flash: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: '#fff',
      opacity: 0.8,
      zIndex: 10,
    },
    cameraOverlay: {
      ...StyleSheet.absoluteFillObject,
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 5,
    },
    cameraGuide: {
      width: '80%',
      height: '60%',
      borderWidth: 2,
      borderColor: 'rgba(255,255,255,0.4)',
      borderRadius: 16,
      borderStyle: 'dashed',
    },
    cameraHint: {
      color: 'rgba(255,255,255,0.8)',
      fontSize: 13,
      fontWeight: '600',
      marginTop: 12,
    },
    cameraControls: {
      position: 'absolute',
      bottom: 48,
      left: 0,
      right: 0,
      alignItems: 'center',
      gap: 20,
    },
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
    cameraCancelButton: { paddingHorizontal: 24, paddingVertical: 10 },
    cameraCancelText: { color: colors.white, fontWeight: '700', fontSize: 16 },
    backButton: {
      flexDirection: 'row',
      borderRadius: 16,
      backgroundColor: colors.primary,
      paddingVertical: 14,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
    },
    backButtonText: { color: colors.white, fontSize: 15, fontWeight: '700' },
    scanCounter: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      backgroundColor: colors.primaryGlow,
      borderRadius: 14,
      paddingHorizontal: 14,
      paddingVertical: 10,
    },
    scanCounterText: {
      color: colors.primary,
      fontSize: 13,
      fontWeight: '700',
    },
  });
