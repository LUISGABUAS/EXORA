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

    // Extraer texto de operadores Tj y TJ (PDFs sin comprimir)
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

    // Extraer metadatos del diccionario Info del PDF (siempre sin comprimir,
    // incluso en PDFs con streams comprimidos — constancias SAT modernas caen aquí)
    const infoPattern = /\/(?:Title|Subject|Author|Keywords|Creator|Producer)\s*\(([^)]{2,200})\)/g;
    let infoMatch: RegExpExecArray | null;
    while ((infoMatch = infoPattern.exec(binary)) !== null) {
      const val = infoMatch[1].trim();
      if (val) lines.push(val);
    }

    // Escaneo amplio de cadenas ASCII legibles (captura texto en streams no comprimidos
    // y strings de estructura PDF que no están en BT/ET)
    const asciiChunks = binary.match(/[\x20-\x7E\xC0-\xFF]{6,}/g);
    if (asciiChunks) {
      for (const chunk of asciiChunks) {
        // Solo cadenas con letras — descartar líneas de sólo números/símbolos PDF
        if (/[a-záéíóúñA-ZÁÉÍÓÚÑ]{3,}/.test(chunk)) {
          lines.push(chunk.trim());
        }
      }
    }

    const fullText = lines.join('\n');
    return fullText.length >= 20 ? fullText : null;
  } catch {
    return null;
  }
}

const CONSTANCIA_KEYWORDS = [
  'situación fiscal',
  'situacion fiscal',
  'servicio de administración tributaria',
  'servicio de administracion tributaria',
  'registro federal',
  'régimen fiscal',
  'regimen fiscal',
  'régimen',
  'regimen',
  'contribuyente',
  'constancia',
  'hacienda',
  'cff',
  'sat',
];

/**
 * Valida que el texto extraído parezca una constancia del SAT.
 * Requiere al menos 1 coincidencia de palabras clave (PDFs modernos del SAT
 * usan streams comprimidos; el texto legible queda en los metadatos Info).
 */
export function validateIsConstancia(text: string): boolean {
  if (!text || text.length < 20) return false;
  const lower = text.toLowerCase();
  for (const kw of CONSTANCIA_KEYWORDS) {
    if (lower.includes(kw)) return true;
  }
  return false;
}

/**
 * Parsea el texto de una constancia para extraer RFC, razón social y todos los regímenes fiscales.
 * Una constancia puede listar múltiples regímenes simultáneos (ej. Sueldos + RESICO).
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

  // --- Extraer Régimen(es) Fiscal(es) ---
  // Detectar TODOS los regímenes presentes (una constancia puede listar varios)
  const lowerText = fullText.toLowerCase();
  const descriptionMap: Array<[string, FiscalRegime, string]> = [
    ['simplificado de confianza', 'resico', '626'],
    ['sueldos y salarios', 'sueldos_salarios', '605'],
    ['arrendamiento', 'arrendamiento', '606'],
    ['actividades empresariales y profesionales', 'honorarios', '612'],
    ['plataformas tecnol', 'plataformas_digitales', '625'],
    ['incorporación fiscal', 'incorporacion_fiscal', '621'],
    ['incorporacion fiscal', 'incorporacion_fiscal', '621'],
    ['general de ley', 'regimen_general', '601'],
  ];

  const allFiscalRegimes: FiscalRegime[] = [];
  for (const [desc, regime, code] of descriptionMap) {
    if (lowerText.includes(desc) && !allFiscalRegimes.includes(regime)) {
      allFiscalRegimes.push(regime);
      if (!fiscalRegime) {
        fiscalRegime = regime;
        regimeSatCode = code;
        regimeLabel = SAT_CODE_LABELS[code];
      }
    }
  }

  // Fallback: buscar códigos SAT (3 dígitos) si no se encontró nada por texto
  if (allFiscalRegimes.length === 0) {
    for (const line of lines) {
      const codeMatch = line.match(/\b(601|605|606|612|621|625|626)\b/);
      if (codeMatch) {
        const code = codeMatch[1];
        const regime = SAT_CODE_TO_REGIME[code];
        if (regime && !allFiscalRegimes.includes(regime)) {
          allFiscalRegimes.push(regime);
          if (!fiscalRegime) {
            regimeSatCode = code;
            fiscalRegime = regime;
            regimeLabel = SAT_CODE_LABELS[code];
          }
        }
      }
    }
  }

  if (!rfc && !fiscalRegime) {
    return { success: false, error: 'No se encontró RFC ni régimen fiscal en el documento.' };
  }

  // --- Extraer Actividad Económica ---
  let actividadEconomica: string | undefined;

  // Estrategia 1: etiqueta explícita "Actividad económica: DESCRIPCION"
  const actividadLabelMatch = fullText.match(
    /actividad(?:es)?\s+econ[oó]mica[s]?\s*[-:]\s*([A-ZÁÉÍÓÚÑ0-9 ,./&()-]{4,80}?)(?:\s*\d+%|\s*RFC|\s*R[eé]gimen|\s*Clave|\n|$)/i,
  );
  if (actividadLabelMatch) {
    actividadEconomica = actividadLabelMatch[1].trim();
  }

  // Estrategia 2: buscar en líneas que siguen a "Actividad" o "ACTIVIDAD" una descripción en mayúsculas
  if (!actividadEconomica) {
    let foundSection = false;
    for (const line of lines) {
      if (/actividad(?:es)?\s+econ[oó]mica/i.test(line)) {
        foundSection = true;
        continue;
      }
      if (foundSection) {
        // La descripción de actividad suele estar en mayúsculas, ignorar líneas de porcentaje/clave
        const clean = line.replace(/\d{1,3}%/, '').replace(/^\d{3,4}\s+/, '').trim();
        if (clean.length >= 4 && /[A-ZÁÉÍÓÚÑ]{3,}/.test(clean) && !/RFC|CURP|R[eé]gimen/i.test(clean)) {
          actividadEconomica = clean;
          break;
        }
        // Salir si llegamos a otra sección
        if (/RFC|CURP|domicilio|r[eé]gimen fiscal/i.test(line)) break;
      }
    }
  }

  // Estrategia 3: líneas con patrón "DESCRIPCION EN MAYUSCULAS   100%"
  if (!actividadEconomica) {
    for (const line of lines) {
      const m = line.match(/^([A-ZÁÉÍÓÚÑ][A-ZÁÉÍÓÚÑ\s,./&()-]{5,70}?)\s+\d{1,3}%/);
      if (m && !/RFC|SAT|CURP|R[EÉ]GIMEN/i.test(m[1])) {
        actividadEconomica = m[1].trim();
        break;
      }
    }
  }

  return {
    success: true,
    rfc,
    razonSocial,
    fiscalRegime,
    allFiscalRegimes: allFiscalRegimes.length > 0 ? allFiscalRegimes : undefined,
    regimeSatCode,
    regimeLabel,
    actividadEconomica,
  };
}
