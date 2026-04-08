/**
 * Extractor de features para clasificación de líneas de tickets.
 * 20 features numéricas por línea (0-1 o binarias).
 *
 * IMPORTANTE: Debe producir valores idénticos al mirror Python
 * en training/feature_extractor.py
 */

// ── Patterns ──

const PRICE_PATTERN =
  /\$?\s*\d{1,3}(?:,\d{3})*(?:\.\d{1,2})|\$?\s*\d+(?:\.\d{1,2})/;

const DATE_PATTERN =
  /\d{1,2}[/-]\d{1,2}[/-]\d{2,4}|\d{4}[/-]\d{2}[/-]\d{2}|\d{1,2}\s+de\s+\w+|(?:ene|feb|mar|abr|may|jun|jul|ago|sep|oct|nov|dic)/i;

const RFC_PATTERN = /[A-Z&Ñ]{3,4}\d{6}[A-Z0-9]{3}/i;

const TOTAL_KW = /\btotal\b/i;
const SUBTOTAL_KW = /\bsub\s*total\b/i;
const TAX_KW = /\biva\b|\bi\.v\.a\b|\bimpuesto\b/i;
const PAYMENT_KW =
  /\befectivo\b|\btarjeta\b|\bvisa\b|\bmastercard\b|\bdebito\b|\bcredito\b|\bpago\b/i;
const CHANGE_KW = /\bcambio\b|\bvuelto\b/i;
const ADDRESS_KW =
  /\bcalle\b|\bav\b|\bavenida\b|\bblvd\b|\bboulevard\b|\bcol\b|\bcolonia\b|\bc\.?\s*p\.?\s*\d/i;
const DECORATION_PATTERN = /^[\s*=\-_#.]{3,}$/;

/**
 * Las 12 clases de línea que el modelo clasifica.
 */
export const LINE_CLASSES = [
  'MERCHANT',
  'ADDRESS',
  'RFC_LINE',
  'DATE',
  'PRODUCT',
  'SUBTOTAL',
  'TAX',
  'TOTAL',
  'PAYMENT',
  'CHANGE',
  'DECORATION',
  'NOISE',
] as const;

export type LineClass = (typeof LINE_CLASSES)[number];

/**
 * Verifica si un texto contiene un patrón de precio.
 */
export function hasPrice(text: string): boolean {
  const cleaned = text
    .replace(/(\d)\s+\.(\d)/g, '$1.$2')
    .replace(/\.\s+(\d)/g, '.$1');
  return PRICE_PATTERN.test(cleaned);
}

/**
 * Extrae 20 features numéricas de una línea de texto.
 *
 * @param line - Texto de la línea
 * @param lineIndex - Índice de la línea (0-based)
 * @param totalLines - Número total de líneas
 * @param prevLine - Texto de la línea anterior (vacío para la primera)
 * @returns Array de 20 números
 */
export function extractFeatures(
  line: string,
  lineIndex: number,
  totalLines: number,
  prevLine: string = '',
): number[] {
  const text = line.trim();
  const maxIdx = Math.max(totalLines - 1, 1);
  const features: number[] = [];

  // 1. linePosition
  features.push(lineIndex / maxIdx);

  // 2. lineLength (normalized, max 80)
  features.push(Math.min(text.length / 80, 1));

  // 3. wordCount (normalized, max 10)
  const words = text.split(/\s+/).filter(w => w.length > 0);
  features.push(Math.min(words.length / 10, 1));

  // 4. digitRatio
  let digits = 0;
  let letters = 0;
  for (const c of text) {
    if (c >= '0' && c <= '9') digits++;
    if ((c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z')) letters++;
  }
  const len = Math.max(text.length, 1);
  features.push(digits / len);

  // 5. letterRatio
  features.push(letters / len);

  // 6. hasPrice
  features.push(hasPrice(text) ? 1 : 0);

  // 7. hasDollarSign
  features.push(text.includes('$') ? 1 : 0);

  // 8. isAllCaps
  const alphaChars = text.split('').filter(
    c => (c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z'),
  );
  const allCaps =
    alphaChars.length > 0 &&
    alphaChars.every(c => c >= 'A' && c <= 'Z');
  features.push(allCaps ? 1 : 0);

  // 9. startsWithNumber
  features.push(text.length > 0 && text[0] >= '0' && text[0] <= '9' ? 1 : 0);

  // 10. containsTotalKw (but NOT subtotal)
  const hasTotalKw = TOTAL_KW.test(text);
  const hasSubtotalKw = SUBTOTAL_KW.test(text);
  features.push(hasTotalKw && !hasSubtotalKw ? 1 : 0);

  // 11. containsSubtotalKw
  features.push(hasSubtotalKw ? 1 : 0);

  // 12. containsTaxKw
  features.push(TAX_KW.test(text) ? 1 : 0);

  // 13. containsPaymentKw
  features.push(PAYMENT_KW.test(text) ? 1 : 0);

  // 14. containsChangeKw
  features.push(CHANGE_KW.test(text) ? 1 : 0);

  // 15. containsDatePattern
  features.push(DATE_PATTERN.test(text) ? 1 : 0);

  // 16. containsRfcPattern
  features.push(RFC_PATTERN.test(text) ? 1 : 0);

  // 17. containsAddressKw
  features.push(ADDRESS_KW.test(text) ? 1 : 0);

  // 18. hasDecorationChars
  features.push(DECORATION_PATTERN.test(text) ? 1 : 0);

  // 19. distanceFromEnd (1 = at top, 0 = at bottom)
  features.push(1 - lineIndex / maxIdx);

  // 20. prevLineHasPrice
  features.push(hasPrice(prevLine) ? 1 : 0);

  return features;
}

/**
 * Extrae features para todas las líneas de un texto OCR.
 */
export function extractAllFeatures(ocrText: string): number[][] {
  const lines = ocrText.split('\n');
  const total = lines.length;
  return lines.map((line, i) => {
    const prev = i > 0 ? lines[i - 1] : '';
    return extractFeatures(line, i, total, prev);
  });
}
