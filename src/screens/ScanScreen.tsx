import React, { useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Camera, useCameraDevice } from 'react-native-vision-camera';
import Animated, { FadeInDown } from 'react-native-reanimated';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { ExpenseForm } from '../components/ExpenseForm';
import { PaywallModal } from '../components/PaywallModal';
import { ScreenContainer } from '../components/ScreenContainer';
import {
  recognizeReceiptDetailed,
  OcrResult,
} from '../services/ocr/ocrService';
import { pickXMLFile, pickImageFromGallery } from '../services/fileService';
import { saveReceiptImage } from '../services/receiptImageService';
import { parseCFDIXml, readXmlFile } from '../services/xmlService';
import { useExpenseStore } from '../store/useExpenseStore';
import { usePremiumStore } from '../store/usePremiumStore';
import { ColorPalette } from '../theme/colors';
import { font } from '../theme/typography';
import { useTheme } from '../theme/ThemeContext';
import { ExpenseInput, ParsedLineItem } from '../types/expense';
import { parseReceiptText } from '../utils/receiptParser';
import { track } from '../services/analyticsService';
import { captureError } from '../services/crashReporting';

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
  const [ocrConfidence, setOcrConfidence] = useState<
    OcrResult['confidence'] | null
  >(null);
  const [ocrError, setOcrError] = useState<string | null>(null);
  const [paywallVisible, setPaywallVisible] = useState(false);

  const openCamera = async () => {
    if (!canScanOCR()) {
      setPaywallVisible(true);
      return;
    }
    const permission = await Camera.requestCameraPermission();
    if (permission !== 'granted') {
      Alert.alert(
        'Permiso requerido',
        'Necesitamos acceso a la cámara para escanear tickets.',
      );
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
      const msg = error instanceof Error ? error.message : '';
      // Silently ignore user cancellation
      const isCancelled =
        msg.includes('cancel') ||
        msg.includes('Cancel') ||
        msg.includes('3072') ||
        msg.includes('dismissed');
      if (!isCancelled) {
        setOcrError(msg || 'No se pudo procesar la factura.');
        Alert.alert(
          'Error al importar XML',
          msg || 'No se pudo procesar la factura.',
        );
      }
    } finally {
      setOcrLoading(false);
    }
  };

  const pickPhoto = async () => {
    if (!canScanOCR()) {
      setPaywallVisible(true);
      return;
    }
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
      const msg =
        error instanceof Error ? error.message : 'No se pudo cargar la imagen.';
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
    track('scan_started');
    try {
      const ocrResult = await recognizeReceiptDetailed(uri);

      if (!ocrResult.text) {
        throw new Error(
          'No se detectó texto en la imagen. Asegúrate de que el ticket sea legible.',
        );
      }

      setOcrConfidence(ocrResult.confidence);
      const parsed = parseReceiptText(ocrResult.text, fiscalRegime);

      // Filter out total/tax/subtotal lines misclassified as products
      const NOISE_PATTERN =
        /total|subtotal|iva|impuesto|importe|cambio|descuento|efectivo|tarjeta|pago|v\.?\s*a\.?/i;
      const productItems = (parsed.lineItems ?? []).filter(
        item => !NOISE_PATTERN.test(item.name),
      );
      setLineItems(productItems);
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
      track('scan_completed', {
        confidence: ocrResult.confidence,
        hasAmount: !!parsed.amount,
      });
    } catch (error) {
      const msg =
        error instanceof Error
          ? error.message
          : 'No se pudo procesar el ticket.';
      setOcrError(msg);
      setOcrConfidence('low');
      captureError(error, { context: 'processImage' });
      track('scan_failed', { reason: msg });
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
        {/* Header */}
        <Animated.View entering={FadeInDown.duration(350)}>
          <Text style={s.title}>Captura tu gasto</Text>
        </Animated.View>

        {/* Hero — Escanear ticket */}
        <Animated.View entering={FadeInDown.delay(80).duration(320)}>
          <Pressable style={s.heroCard} onPress={openCamera} disabled={ocrLoading}>
            <View style={s.heroIconWrap}>
              <Icon name="camera" size={36} color="#fff" />
            </View>
            <Text style={s.heroTitle}>Escanear ticket</Text>
            <Text style={s.heroDesc}>
              Apunta la cámara y extrae los datos al instante
            </Text>
            {!hasFullAccess() ? (
              <View style={s.heroCounter}>
                <Icon name="camera-iris" size={13} color="rgba(255,255,255,0.9)" />
                <Text style={s.heroCounterText}>
                  {Math.max(3 - weeklyScans, 0)} escaneos restantes esta semana
                </Text>
              </View>
            ) : null}
          </Pressable>
        </Animated.View>

        {/* Scan hint */}
        <Animated.View entering={FadeInDown.delay(140).duration(300)}>
          <Text style={s.scanHint}>
            Buena iluminación · ticket recto · sin sombras
          </Text>
        </Animated.View>

        {/* Secondary options */}
        <Animated.View entering={FadeInDown.delay(200).duration(300)}>
          <View style={s.secondaryRow}>
            <Pressable style={s.secondaryCard} onPress={pickPhoto} disabled={ocrLoading}>
              <View style={[s.secondaryIcon, { backgroundColor: '#3B82F615' }]}>
                <Icon name="image" size={22} color="#3B82F6" />
              </View>
              <Text style={s.secondaryTitle}>Desde galería</Text>
              <Text style={s.secondaryDesc}>Elige una foto existente</Text>
            </Pressable>

            <Pressable style={s.secondaryCard} onPress={pickXML} disabled={ocrLoading}>
              <View style={[s.secondaryIcon, { backgroundColor: '#8B5CF615' }]}>
                {ocrLoading ? (
                  <ActivityIndicator color="#8B5CF6" size="small" />
                ) : (
                  <Icon name="file-xml-box" size={22} color="#8B5CF6" />
                )}
              </View>
              <View style={s.secondaryTitleRow}>
                <Text style={s.secondaryTitle}>XML / CFDI</Text>
                <View style={s.freeBadge}>
                  <Text style={s.freeBadgeText}>Gratis</Text>
                </View>
              </View>
              <Text style={s.secondaryDesc}>Factura del SAT</Text>
            </Pressable>
          </View>
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
        <Image
          source={{ uri: imageUri }}
          style={s.preview}
          resizeMode="cover"
        />
      ) : null}

      {/* Confidence badge */}
      {ocrConfidence && !ocrLoading ? (
        <Animated.View
          entering={FadeInDown.duration(250)}
          style={s.confidenceBadge}
        >
          <Icon
            name={CONFIDENCE_ICONS[ocrConfidence]}
            size={16}
            color={
              ocrConfidence === 'high'
                ? colors.success
                : ocrConfidence === 'medium'
                ? colors.warning
                : colors.danger
            }
          />
          <Text
            style={[
              s.confidenceText,
              {
                color:
                  ocrConfidence === 'high'
                    ? colors.success
                    : ocrConfidence === 'medium'
                    ? colors.warning
                    : colors.danger,
              },
            ]}
          >
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
              ${(prefill?.amount ?? 0).toFixed(2)}
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
      fontFamily: font.extrabold,
    },
    subtitle: {
      color: colors.textMuted,
      fontSize: 14,
      marginTop: 4,
      lineHeight: 20,
    },
    // Hero card
    heroCard: {
      backgroundColor: colors.primary,
      borderRadius: 28,
      padding: 28,
      alignItems: 'center',
      gap: 8,
      shadowColor: colors.primary,
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.35,
      shadowRadius: 20,
      elevation: 10,
    },
    heroIconWrap: {
      width: 76,
      height: 76,
      borderRadius: 38,
      backgroundColor: 'rgba(255,255,255,0.18)',
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 4,
    },
    heroTitle: {
      color: '#fff',
      fontSize: 22,
      fontFamily: font.extrabold,
      letterSpacing: -0.5,
    },
    heroDesc: {
      color: 'rgba(255,255,255,0.72)',
      fontSize: 13,
      fontFamily: font.medium,
      textAlign: 'center',
      lineHeight: 18,
    },
    heroCounter: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      backgroundColor: 'rgba(255,255,255,0.15)',
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 999,
      marginTop: 4,
    },
    heroCounterText: {
      color: 'rgba(255,255,255,0.9)',
      fontSize: 12,
      fontFamily: font.semibold,
    },
    // Scan hint
    scanHint: {
      color: colors.textMuted,
      fontSize: 12,
      fontFamily: font.medium,
      textAlign: 'center',
    },
    // Secondary row
    secondaryRow: { flexDirection: 'row', gap: 12 },
    secondaryCard: {
      flex: 1,
      backgroundColor: colors.surface,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 16,
      gap: 4,
    },
    secondaryIcon: {
      width: 44,
      height: 44,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 4,
    },
    secondaryTitleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      flexWrap: 'wrap',
    },
    secondaryTitle: {
      color: colors.text,
      fontSize: 14,
      fontFamily: font.bold,
    },
    secondaryDesc: {
      color: colors.textMuted,
      fontSize: 12,
      fontFamily: font.medium,
    },
    freeBadge: {
      backgroundColor: colors.success + '20',
      paddingHorizontal: 7,
      paddingVertical: 2,
      borderRadius: 999,
    },
    freeBadgeText: {
      color: colors.success,
      fontSize: 10,
      fontFamily: font.extrabold,
    },
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
      fontFamily: font.bold,
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
    retryText: { color: colors.white, fontSize: 13, fontFamily: font.bold },
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
      fontFamily: font.bold,
      color: colors.text,
    },
    lineItemsCount: {
      fontSize: 12,
      fontFamily: font.bold,
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
    lineItemName: {
      flex: 1,
      fontSize: 14,
      color: colors.text,
      marginRight: 12,
    },
    lineItemPrice: {
      fontSize: 14,
      fontFamily: font.semibold,
      color: colors.primary,
    },
    lineItemsDivider: {
      height: 1,
      backgroundColor: colors.border,
      marginVertical: 8,
    },
    lineItemsTotal: {
      fontSize: 15,
      fontFamily: font.extrabold,
      color: colors.text,
    },
    loadingContainer: {
      alignItems: 'center',
      gap: 8,
      paddingVertical: 32,
    },
    loadingText: {
      color: colors.text,
      fontSize: 15,
      fontFamily: font.semibold,
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
      fontFamily: font.semibold,
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
    cameraCancelText: {
      color: colors.white,
      fontFamily: font.bold,
      fontSize: 16,
    },
    backButton: {
      flexDirection: 'row',
      borderRadius: 16,
      backgroundColor: colors.primary,
      paddingVertical: 14,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
    },
    backButtonText: {
      color: colors.white,
      fontSize: 15,
      fontFamily: font.bold,
    },
  });
