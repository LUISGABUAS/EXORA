import RNFS from 'react-native-fs';
import { FiscalRegime } from '../store/usePremiumStore';
import { ConstanciaParseResult, SAT_CODE_TO_REGIME, SAT_CODE_LABELS } from '../types/fiscal';
import { isValidMexicanRfc } from '../utils/tax';

/**
 * Lee un archivo PDF y extrae texto accesible (no comprimido).
 * Decodifica base64 → busca operadores de texto PDF (Tj/TJ) entre BT/ET.
 * Retorna null si el texto extraído es insuficiente.
 */
export async function readPdfText(filePath: string): Promise<string | null> {
  try {
    const base64 = await RNFS.readFile(filePath, 'base64');
    const binary = Buffer.from(base64, 'base64').toString('binary');
    const lines: string[] = [];

    // Extraer texto de operadores Tj y TJ
    let inText = false;
    for (let i = 0; i < binary.length; i++) {
      if (binary[i] === 'B' && binary[i + 1] === 'T') {
        inText = true;
        continue;
      }
      if (binary[i] === 'E' && binary[i + 1] === 'T' && inText) {
        inText = false;
        continue;
      }
      if (!inText) continue;

      // (texto) Tj
      if (binary[i] === '(') {
        let text = '';
        let j = i + 1;
        let depth = 1;
        while (j < binary.length && depth > 0) {
          if (binary[j] === '(' && binary[j - 1] !== '\\') depth++;
          else if (binary[j] === ')' && binary[j - 1] !== '\\') depth--;
          if (depth > 0) text += binary[j];
          j++;
        }
        if (text.trim()) lines.push(text.trim());
        i = j;
      }
    }

    // También escanear por secuencias legibles (RFC, palabras clave SAT)
    const asciiChunks = binary.match(/[\x20-\x7E\xC0-\xFF]{4,}/g);
    if (asciiChunks) {
      for (const chunk of asciiChunks) {
        if (/RFC|CURP|SAT|[A-Z&Ñ]{3,4}\d{6}/i.test(chunk)) {
          lines.push(chunk.trim());
        }
      }
    }

    const fullText = lines.join('\n');
    return fullText.length >= 50 ? fullText : null;
  } catch {
    return null;
  }
}

const CONSTANCIA_KEYWORDS = [
  'situaci\u00f3n fiscal',
  'situacion fiscal',
  'servicio de administraci\u00f3n tributaria',
  'servicio de administracion tributaria',
  'registro federal',
  'r\u00e9gimen',
  'regimen',
];

/**
 * Valida que el texto extraído parezca una constancia del SAT.
 * Requiere al menos 2 coincidencias de palabras clave.
 */
export function validateIsConstancia(text: string): boolean {
  if (!text || text.length < 50) return false;
  const lower = text.toLowerCase();
  let matches = 0;
  for (const kw of CONSTANCIA_KEYWORDS) {
    if (lower.includes(kw)) matches++;
  }
  return matches >= 2;
}

/**
 * Parsea el texto de una constancia para extraer RFC, razón social y régimen fiscal.
 */
export function parseConstanciaText(text: string): ConstanciaParseResult {
  if (!text || text.trim().length === 0) {
    return { success: false, error: 'Texto vacío o no legible.' };
  }

  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  let rfc: string | undefined;
  let razonSocial: string | undefined;
  let fiscalRegime: FiscalRegime | undefined;
  let regimeSatCode: string | undefined;
  let regimeLabel: string | undefined;

  // --- Extraer RFC ---
  for (const line of lines) {
    // Buscar cerca de etiquetas RFC
    const rfcLabelMatch = line.match(/RFC\s*[-:]?\s*([A-Z&Ñ]{3,4}\d{6}[A-Z0-9]{3})/i);
    if (rfcLabelMatch) {
      const candidate = rfcLabelMatch[1].toUpperCase();
      if (isValidMexicanRfc(candidate)) {
        rfc = candidate;
        break;
      }
    }
  }
  // Fallback: buscar patrón RFC en cualquier línea
  if (!rfc) {
    for (const line of lines) {
      const match = line.match(/\b([A-Z&Ñ]{3,4}\d{6}[A-Z0-9]{3})\b/i);
      if (match && isValidMexicanRfc(match[1])) {
        rfc = match[1].toUpperCase();
        break;
      }
    }
  }

  // --- Extraer Razón Social ---
  const fullText = lines.join(' ');

  // Intentar "Nombre, denominación o razón social:"
  const razonMatch = fullText.match(
    /(?:raz[oó]n\s+social|denominaci[oó]n)\s*[-:]\s*(.{3,80}?)(?:\s*RFC|\s*CURP|\s*R[eé]gimen|\n|$)/i,
  );
  if (razonMatch) {
    razonSocial = razonMatch[1].trim();
  }

  // Intentar Nombre(s) + Apellidos
  if (!razonSocial) {
    const nombreMatch = fullText.match(/Nombre\(?s?\)?\s*[-:]?\s*([A-ZÁÉÍÓÚÑ\s]{2,40})/i);
    const paternoMatch = fullText.match(/(?:Apellido\s+Paterno|Primer\s+Apellido)\s*[-:]?\s*([A-ZÁÉÍÓÚÑ\s]{2,30})/i);
    const maternoMatch = fullText.match(/(?:Apellido\s+Materno|Segundo\s+Apellido)\s*[-:]?\s*([A-ZÁÉÍÓÚÑ\s]{2,30})/i);
    if (nombreMatch) {
      const parts = [nombreMatch[1].trim()];
      if (paternoMatch) parts.push(paternoMatch[1].trim());
      if (maternoMatch) parts.push(maternoMatch[1].trim());
      razonSocial = parts.join(' ');
    }
  }

  // --- Extraer Régimen Fiscal ---
  // Primero intentar por descripción (más preciso, distingue 625 plataformas vs empresarial)
  const lowerText = fullText.toLowerCase();
  const descriptionMap: Array<[string, FiscalRegime, string]> = [
    ['simplificado de confianza', 'resico', '626'],
    ['sueldos y salarios', 'sueldos_salarios', '605'],
    ['arrendamiento', 'arrendamiento', '606'],
    ['actividades empresariales y profesionales', 'honorarios', '612'],
    ['plataformas tecnol', 'plataformas_digitales', '625'],
    ['incorporaci\u00f3n fiscal', 'incorporacion_fiscal', '621'],
    ['incorporacion fiscal', 'incorporacion_fiscal', '621'],
    ['general de ley', 'regimen_general', '601'],
  ];
  for (const [desc, regime, code] of descriptionMap) {
    if (lowerText.includes(desc)) {
      fiscalRegime = regime;
      regimeSatCode = code;
      regimeLabel = SAT_CODE_LABELS[code];
      break;
    }
  }

  // Fallback: buscar código SAT (3 dígitos)
  if (!fiscalRegime) {
    for (const line of lines) {
      const codeMatch = line.match(/\b(601|605|606|612|621|625|626)\b/);
      if (codeMatch) {
        const code = codeMatch[1];
        if (SAT_CODE_TO_REGIME[code]) {
          regimeSatCode = code;
          fiscalRegime = SAT_CODE_TO_REGIME[code];
          regimeLabel = SAT_CODE_LABELS[code];
          break;
        }
      }
    }
  }

  if (!rfc && !fiscalRegime) {
    return { success: false, error: 'No se encontró RFC ni régimen fiscal en el documento.' };
  }

  return {
    success: true,
    rfc,
    razonSocial,
    fiscalRegime,
    regimeSatCode,
    regimeLabel,
  };
}
