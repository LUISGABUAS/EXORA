/**
 * Motor de inferencia ML para clasificación de líneas de tickets.
 * Usa regresión logística multinomial entrenada con 1000 recibos sintéticos.
 *
 * Costo: ~7,200 multiplicaciones para un ticket de 30 líneas = < 5ms en móvil.
 * 100% offline, sin dependencias externas.
 */

import { extractFeatures, LineClass } from './featureExtractor';
import {
  extractPrices,
  cleanMerchantName,
  extractDateFromText,
  extractRfc,
} from './receiptExtractors';
import modelWeights from './modelWeights.json';

// ═══════════════════════════════════════════
// TIPOS
// ═══════════════════════════════════════════

export interface ClassifiedLine {
  text: string;
  lineClass: LineClass;
  confidence: number;
  probabilities: Record<LineClass, number>;
}

export interface AIParseResult {
  lines: ClassifiedLine[];
  amount?: number;
  amountConfidence: number;
  date?: string;
  dateConfidence: number;
  merchantName?: string;
  merchantConfidence: number;
  rfc?: string;
  rfcConfidence: number;
  overallConfidence: number;
}

// ═══════════════════════════════════════════
// MODELO — Softmax inference
// ═══════════════════════════════════════════

const { weights, biases, classes } = modelWeights;

/**
 * Calcula softmax de un vector de scores.
 */
function softmax(scores: number[]): number[] {
  const maxScore = Math.max(...scores);
  const exps = scores.map(s => Math.exp(s - maxScore));
  const sumExps = exps.reduce((a, b) => a + b, 0);
  return exps.map(e => e / sumExps);
}

/**
 * Clasifica una línea usando el modelo.
 * score[clase] = sum(weights[clase][i] * features[i]) + bias[clase]
 */
function classifyLine(features: number[]): {
  lineClass: LineClass;
  confidence: number;
  probabilities: Record<LineClass, number>;
} {
  const scores: number[] = [];

  for (let c = 0; c < classes.length; c++) {
    let score = biases[c];
    for (let f = 0; f < features.length; f++) {
      score += weights[c][f] * features[f];
    }
    scores.push(score);
  }

  const probs = softmax(scores);
  let maxIdx = 0;
  for (let i = 1; i < probs.length; i++) {
    if (probs[i] > probs[maxIdx]) maxIdx = i;
  }

  const probRecord: Record<string, number> = {};
  for (let i = 0; i < classes.length; i++) {
    probRecord[classes[i]] = probs[i];
  }

  return {
    lineClass: classes[maxIdx] as LineClass,
    confidence: probs[maxIdx],
    probabilities: probRecord as Record<LineClass, number>,
  };
}

// ═══════════════════════════════════════════
// CLASIFICACIÓN DE TODAS LAS LÍNEAS
// ═══════════════════════════════════════════

function classifyAllLines(ocrText: string): ClassifiedLine[] {
  const lines = ocrText.split('\n');
  const total = lines.length;
  const result: ClassifiedLine[] = [];

  for (let i = 0; i < total; i++) {
    const prev = i > 0 ? lines[i - 1] : '';
    const next = i < total - 1 ? lines[i + 1] : '';
    const features = extractFeatures(lines[i], i, total, prev, next);
    const { lineClass, confidence, probabilities } = classifyLine(features);

    result.push({
      text: lines[i],
      lineClass,
      confidence,
      probabilities,
    });
  }

  return result;
}

// ═══════════════════════════════════════════
// EXTRACCIÓN DE CAMPOS
// ═══════════════════════════════════════════

/**
 * Extrae el monto total del ticket usando las líneas clasificadas.
 * Busca la línea TOTAL con mayor confianza y extrae su precio.
 */
function extractAmount(lines: ClassifiedLine[]): {
  value?: number;
  confidence: number;
} {
  // Collect all TOTAL candidates, sorted by confidence
  const totalLines = lines
    .filter(l => l.lineClass === 'TOTAL' || l.probabilities.TOTAL > 0.3)
    .sort((a, b) => b.probabilities.TOTAL - a.probabilities.TOTAL);

  for (const totalLine of totalLines) {
    // Try extracting price from this line
    const prices = extractPrices(totalLine.text);
    if (prices.length > 0) {
      return {
        value: prices[prices.length - 1], // Last price is most likely the total
        confidence: totalLine.probabilities.TOTAL,
      };
    }

    // Check next line (OCR may have split "TOTAL\n$123.45")
    const idx = lines.indexOf(totalLine);
    if (idx + 1 < lines.length) {
      const nextLine = lines[idx + 1];
      const nextPrices = extractPrices(nextLine.text);
      if (
        nextPrices.length > 0 &&
        nextLine.lineClass !== 'CHANGE' &&
        nextLine.lineClass !== 'PAYMENT'
      ) {
        return {
          value: nextPrices[0],
          confidence: totalLine.probabilities.TOTAL * 0.9,
        };
      }
    }
  }

  // Fallback: largest price from PRODUCT or SUBTOTAL lines
  const allPriceLines = lines.filter(
    l => l.lineClass === 'PRODUCT' || l.lineClass === 'SUBTOTAL',
  );
  let maxPrice = 0;
  for (const pl of allPriceLines) {
    const prices = extractPrices(pl.text);
    for (const p of prices) {
      if (p > maxPrice) maxPrice = p;
    }
  }

  if (maxPrice > 0) {
    return { value: maxPrice, confidence: 0.3 };
  }

  return { confidence: 0 };
}

/**
 * Extrae el nombre del comercio usando las líneas MERCHANT.
 * Si ninguna línea fue clasificada como MERCHANT, busca candidatos
 * con probabilidad > 0.15 en las primeras 5 líneas no vacías.
 */
function extractMerchant(lines: ClassifiedLine[]): {
  value?: string;
  confidence: number;
} {
  // Primary: lines classified as MERCHANT
  const merchantLines = lines
    .filter(l => l.lineClass === 'MERCHANT')
    .sort((a, b) => b.probabilities.MERCHANT - a.probabilities.MERCHANT);

  for (const ml of merchantLines) {
    const name = cleanMerchantName(ml.text);
    if (name.length >= 2) {
      return { value: name, confidence: ml.probabilities.MERCHANT };
    }
  }

  // Fallback: lines with MERCHANT probability > 0.15 in the first 8 non-empty lines
  const nonEmpty = lines.filter(l => l.text.trim().length > 1);
  const topLines = nonEmpty.slice(0, 8);
  const candidates = topLines
    .filter(
      l =>
        l.probabilities.MERCHANT > 0.15 &&
        l.lineClass !== 'DECORATION' &&
        l.lineClass !== 'RFC_LINE',
    )
    .sort((a, b) => b.probabilities.MERCHANT - a.probabilities.MERCHANT);

  for (const c of candidates) {
    const name = cleanMerchantName(c.text);
    if (name.length >= 2) {
      return { value: name, confidence: c.probabilities.MERCHANT };
    }
  }

  return { confidence: 0 };
}

/**
 * Extrae la fecha usando las líneas DATE.
 * Si no se encuentra en líneas DATE, busca en todas las líneas.
 */
function extractDate(lines: ClassifiedLine[]): {
  value?: string;
  confidence: number;
} {
  // Primary: lines classified as DATE or with high DATE probability
  const dateLines = lines
    .filter(l => l.lineClass === 'DATE' || l.probabilities.DATE > 0.2)
    .sort((a, b) => b.probabilities.DATE - a.probabilities.DATE);

  for (const dl of dateLines) {
    const date = extractDateFromText(dl.text);
    if (date) {
      return { value: date, confidence: dl.probabilities.DATE };
    }
  }

  // Fallback: try all lines
  for (const l of lines) {
    if (l.text.trim().length < 4) continue;
    const date = extractDateFromText(l.text);
    if (date) {
      return { value: date, confidence: 0.3 };
    }
  }

  return { confidence: 0 };
}

/**
 * Extrae el RFC usando las líneas RFC_LINE.
 * Prefiere RFCs no genéricos (XAXX, XEXX).
 */
function extractRfcFromLines(lines: ClassifiedLine[]): {
  value?: string;
  confidence: number;
} {
  const GENERIC_RFCS = ['XAXX010101000', 'XEXX010101000'];
  const rfcLines = lines
    .filter(l => l.lineClass === 'RFC_LINE' || l.probabilities.RFC_LINE > 0.3)
    .sort((a, b) => b.probabilities.RFC_LINE - a.probabilities.RFC_LINE);

  let genericResult: { value: string; confidence: number } | null = null;

  for (const rl of rfcLines) {
    const rfc = extractRfc(rl.text);
    if (rfc) {
      if (!GENERIC_RFCS.includes(rfc.toUpperCase())) {
        return { value: rfc, confidence: rl.probabilities.RFC_LINE };
      }
      if (!genericResult) {
        genericResult = { value: rfc, confidence: rl.probabilities.RFC_LINE };
      }
    }
  }

  // Also search all lines for RFC patterns (fallback)
  for (const l of lines) {
    if (l.text.trim().length < 10) continue;
    const rfc = extractRfc(l.text);
    if (rfc && !GENERIC_RFCS.includes(rfc.toUpperCase())) {
      return { value: rfc, confidence: 0.3 };
    }
  }

  if (genericResult) return genericResult;
  return { confidence: 0 };
}

// ═══════════════════════════════════════════
// API PÚBLICA
// ═══════════════════════════════════════════

/**
 * Parsea texto OCR de un ticket usando el modelo ML.
 * Clasifica cada línea y extrae campos clave.
 */
export function parseWithAI(ocrText: string): AIParseResult {
  const lines = classifyAllLines(ocrText);

  const amount = extractAmount(lines);
  const date = extractDate(lines);
  const merchant = extractMerchant(lines);
  const rfc = extractRfcFromLines(lines);

  // Overall confidence: weighted average of key fields
  const fieldConfidences = [
    amount.confidence * 2, // Amount is most important
    merchant.confidence,
    date.confidence,
    rfc.confidence,
  ];
  const totalWeight = 2 + 1 + 1 + 1;
  const overallConfidence =
    fieldConfidences.reduce((a, b) => a + b, 0) / totalWeight;

  return {
    lines,
    amount: amount.value,
    amountConfidence: amount.confidence,
    date: date.value,
    dateConfidence: date.confidence,
    merchantName: merchant.value,
    merchantConfidence: merchant.confidence,
    rfc: rfc.value,
    rfcConfidence: rfc.confidence,
    overallConfidence,
  };
}
