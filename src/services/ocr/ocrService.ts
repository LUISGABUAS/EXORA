import { Platform, NativeModules } from 'react-native';
import { Camera } from 'react-native-vision-camera';
import TextRecognition from '@react-native-ml-kit/text-recognition';

const { AppleVisionOCR } = NativeModules;

const MIN_TEXT_LENGTH = 10;

export async function requestCameraPermission(): Promise<boolean> {
  const status = await Camera.requestCameraPermission();
  return status === 'granted';
}

export interface OcrResult {
  text: string;
  confidence: 'high' | 'medium' | 'low';
  blockCount: number;
}

function assessConfidence(text: string, blockCount: number): OcrResult['confidence'] {
  if (blockCount >= 5 && text.length > 100) return 'high';
  if (blockCount >= 2 && text.length > 40) return 'medium';
  return 'low';
}

async function recognizeIOS(imageUri: string): Promise<OcrResult> {
  if (!AppleVisionOCR?.recognizeText) {
    // Fallback a ML Kit si el módulo nativo no está disponible
    return recognizeMLKit(imageUri);
  }
  const text: string = await AppleVisionOCR.recognizeText(imageUri);
  const clean = cleanOcrText(text);
  const lines = clean.split('\n').filter(Boolean).length;
  return {
    text: clean,
    confidence: assessConfidence(clean, lines),
    blockCount: lines,
  };
}

async function recognizeMLKit(imageUri: string): Promise<OcrResult> {
  const result = await TextRecognition.recognize(imageUri);
  const text = cleanOcrText(result.text);
  const blockCount = result.blocks?.length ?? 0;
  return {
    text,
    confidence: assessConfidence(text, blockCount),
    blockCount,
  };
}

async function recognizeWithRetry(imageUri: string): Promise<OcrResult> {
  const recognize = Platform.OS === 'ios' ? recognizeIOS : recognizeMLKit;

  let bestResult: OcrResult = { text: '', confidence: 'low', blockCount: 0 };

  for (let attempt = 0; attempt <= 1; attempt++) {
    try {
      const result = await recognize(imageUri);
      if (result.text.length >= MIN_TEXT_LENGTH) return result;
      if (result.text.length > bestResult.text.length) bestResult = result;
    } catch (err) {
      if (attempt === 1) throw err;
    }
  }

  if (bestResult.text.length > 0) return bestResult;
  throw new Error('No se pudo extraer texto de la imagen. Intenta con mejor iluminación o más cerca del ticket.');
}

export async function recognizeReceiptText(imageUri: string): Promise<string> {
  const result = await recognizeWithRetry(imageUri);
  return result.text;
}

export async function recognizeReceiptDetailed(imageUri: string): Promise<OcrResult> {
  return recognizeWithRetry(imageUri);
}

function cleanOcrText(raw: string): string {
  return raw
    .replace(/[^\S\n]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/^[\s\n]+|[\s\n]+$/g, '')
    .replace(/[^\x20-\x7EáéíóúÁÉÍÓÚñÑüÜ¿¡$%.,;:()/\n@#&-]/g, '');
}
