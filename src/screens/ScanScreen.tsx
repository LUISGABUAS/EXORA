import React, { useRef, useState } from 'react';
import { Alert, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { Camera, useCameraDevice } from 'react-native-vision-camera';
import { ExpenseForm } from '../components/ExpenseForm';
import { ScreenContainer } from '../components/ScreenContainer';
import { useExpenseStore } from '../store/useExpenseStore';
import { colors } from '../theme/colors';
import { ExpenseInput } from '../types/expense';
import { parseReceiptText } from '../utils/receiptParser';
import RNFS from 'react-native-fs';

type Mode = 'idle' | 'camera' | 'preview';

export function ScanScreen() {
  const addExpense = useExpenseStore((state) => state.addExpense);
  const device = useCameraDevice('back');
  const camera = useRef<Camera>(null);
  const [mode, setMode] = useState<Mode>('idle');
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [ocrLoading, setOcrLoading] = useState(false);
  const [prefill, setPrefill] = useState<Partial<ExpenseInput> | undefined>();

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
    const photo = await camera.current.takePhoto({ quality: 85 });
    const uri = `file://${photo.path}`;
    setImageUri(uri);
    setMode('preview');
    await processImage(uri);
  };

  const processImage = async (uri: string) => {
    setOcrLoading(true);
    try {
      // Read image as base64 and send to OCR.space
      const base64 = await RNFS.readFile(uri.replace('file://', ''), 'base64');
      const apiKey = process.env.OCR_SPACE_API_KEY ?? '';
      if (!apiKey) {
        throw new Error('Configura OCR_SPACE_API_KEY para usar OCR real.');
      }
      const formData = new FormData();
      formData.append('apikey', apiKey);
      formData.append('language', 'spa');
      formData.append('base64Image', `data:image/jpeg;base64,${base64}`);
      formData.append('isOverlayRequired', 'false');
      formData.append('detectOrientation', 'true');
      formData.append('scale', 'true');

      const response = await fetch('https://api.ocr.space/parse/image', { method: 'POST', body: formData });
      const payload = await response.json();
      const rawText = payload?.ParsedResults?.[0]?.ParsedText;
      if (!rawText) {
        throw new Error('No fue posible extraer texto de la imagen.');
      }

      const parsed = parseReceiptText(rawText);
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
    setImageUri(null);
    setMode('idle');
  };

  if (mode === 'camera' && device) {
    return (
      <View style={styles.cameraContainer}>
        <Camera ref={camera} style={styles.camera} device={device} isActive photo />
        <View style={styles.cameraControls}>
          <Pressable style={styles.captureButton} onPress={takePicture} />
          <Pressable style={styles.cancelButton} onPress={() => setMode('idle')}>
            <Text style={styles.cancelText}>Cancelar</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <ScreenContainer>
      <View style={styles.hero}>
        <Text style={styles.title}>Escaneo OCR</Text>
        <Text style={styles.subtitle}>Toma una foto del ticket o factura y completa el registro automaticamente.</Text>
      </View>

      <Pressable style={styles.scanButton} onPress={openCamera}>
        <Text style={styles.scanButtonText}>{ocrLoading ? 'Procesando ticket...' : 'Abrir camara'}</Text>
      </Pressable>

      {imageUri ? <Image source={{ uri: imageUri }} style={styles.preview} /> : null}
      {prefill ? <ExpenseForm initialValues={prefill} submitLabel="Guardar gasto escaneado" onSubmit={saveScannedExpense} /> : null}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  hero: { backgroundColor: '#d8f0ea', borderRadius: 28, padding: 22, gap: 8 },
  title: { color: colors.text, fontSize: 28, fontWeight: '800' },
  subtitle: { color: colors.textMuted, lineHeight: 22 },
  scanButton: { borderRadius: 18, backgroundColor: colors.text, paddingVertical: 16, alignItems: 'center' },
  scanButtonText: { color: colors.white, fontSize: 15, fontWeight: '700' },
  preview: { width: '100%', height: 220, borderRadius: 24 },
  cameraContainer: { flex: 1, backgroundColor: '#000' },
  camera: { flex: 1 },
  cameraControls: { position: 'absolute', bottom: 48, left: 0, right: 0, alignItems: 'center', gap: 20 },
  captureButton: { width: 72, height: 72, borderRadius: 36, backgroundColor: colors.white, borderWidth: 4, borderColor: colors.primary },
  cancelButton: { paddingHorizontal: 24, paddingVertical: 10 },
  cancelText: { color: colors.white, fontWeight: '700', fontSize: 16 },
});
