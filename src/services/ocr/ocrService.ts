import { Camera } from 'react-native-vision-camera';
import TextRecognition from '@react-native-ml-kit/text-recognition';

const MAX_RETRIES = 2;
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

/**
 * Reconoce texto de una imagen de ticket/factura.
 * Reintenta hasta MAX_RETRIES veces si el resultado es muy corto.
 */
export async function recognizeReceiptText(imageUri: string): Promise<string> {
  const result = await recognizeWithRetry(imageUri);
  return result.text;
}

/**
 * Versión extendida que devuelve confianza y bloques detectados.
 */
export async function recognizeReceiptDetailed(imageUri: string): Promise<OcrResult> {
  return recognizeWithRetry(imageUri);
}

async function recognizeWithRetry(imageUri: string): Promise<OcrResult> {
  let lastError: Error | null = null;
  let bestResult: OcrResult = { text: '', confidence: 'low', blockCount: 0 };

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const result = await TextRecognition.recognize(imageUri);
      const text = cleanOcrText(result.text);
      const blockCount = result.blocks?.length ?? 0;
      const confidence = assessConfidence(text, blockCount);

      if (text.length >= MIN_TEXT_LENGTH) {
        return { text, confidence, blockCount };
      }

      // Guardar el mejor resultado parcial
      if (text.length > bestResult.text.length) {
        bestResult = { text, confidence, blockCount };
      }
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
    }
  }

  // Si tenemos algo de texto, devolverlo
  if (bestResult.text.length > 0) {
    return bestResult;
  }

  throw lastError ?? new Error('No se pudo extraer texto de la imagen. Intenta con mejor iluminacion o mas cerca del ticket.');
}

/**
 * Limpia el texto OCR: elimina lineas vacias duplicadas,
 * normaliza espacios y quita caracteres basura.
 */
function cleanOcrText(raw: string): string {
  return raw
    .replace(/[^\S\n]+/g, ' ')       // colapsar espacios (no newlines)
    .replace(/\n{3,}/g, '\n\n')       // max 2 newlines seguidos
    .replace(/^[\s\n]+|[\s\n]+$/g, '') // trim
    .replace(/[^\x20-\x7EáéíóúÁÉÍÓÚñÑüÜ¿¡$%.,;:()/\n@#&-]/g, ''); // quitar basura unicode
}
