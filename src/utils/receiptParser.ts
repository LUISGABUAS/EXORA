import { ParsedLineItem, ParsedReceiptData } from '../types/expense';
import { classifyExpense } from './classifier';
import { parseWithAI, AIParseResult } from './receiptAI';
import { FiscalRegime } from '../store/usePremiumStore';
import { inferDeductibility, isValidMexicanRfc } from './tax';

// ═══════════════════════════════════════════
// ENTRENAMIENTO: Patrones de tickets mexicanos
// ═══════════════════════════════════════════

const GENERIC_RFCs = ['XAXX010101000', 'XEXX010101000'];

// ── Marcas conocidas de comercios mexicanos ──
// Se buscan en las primeras 10 líneas del ticket para detectar el comercio
const KNOWN_BRANDS = [
  // Tiendas de conveniencia
  'OXXO', '7-ELEVEN', 'SEVEN ELEVEN', 'CIRCLE K', 'EXTRA',
  // Supermercados
  'WALMART', 'WAL MART', 'WAL-MART', 'SORIANA', 'CHEDRAUI', 'HEB', 'H-E-B',
  'LA COMER', 'CITY MARKET', 'SUPERAMA', 'BODEGA AURRERA', 'COSTCO',
  "SAM'S CLUB", 'SAMS CLUB', "SAM'S", 'MEGA SORIANA',
  // Restaurantes cadena
  'STARBUCKS', 'MCDONALDS', "MCDONALD'S", 'BURGER KING', 'SUBWAY',
  'DOMINOS', "DOMINO'S", 'LITTLE CAESARS', 'KFC', 'POLLO LOCO',
  'VIPS', 'SANBORNS', 'TOKS', 'ITALIANNIS', "APPLEBEE'S", 'APPLEBEES',
  "CHILI'S", 'CHILIS', 'CARL\'S JR', 'CARLS JR',
  'LA CASA DE TONO', 'EL PORTÓN', 'EL PORTON', 'EL FOGON', 'EL FOGÓN',
  'WINGS', 'HOOTERS', 'SUSHI',
  // Cafeterías
  'EL PENDULO', 'EL PÉNDULO', 'CIELITO QUERIDO', 'PUNTA DEL CIELO',
  'THE ITALIAN COFFEE', 'CAFE PUNTA',
  // Farmacias
  'FARMACIA GUADALAJARA', 'FARMACIAS DEL AHORRO', 'FARMACIAS SIMILARES',
  'FARMACIA SAN PABLO', 'BENAVIDES', 'FARMACIA',
  // Gasolineras
  'PEMEX', 'GASOLINERA', 'OXXO GAS', 'SHELL', 'BP', 'MOBIL', 'GULF',
  // Transporte
  'UBER', 'DIDI', 'CABIFY', 'BEAT', 'INDRIVER',
  // Entretenimiento
  'CINEPOLIS', 'CINÉPOLIS', 'CINEMEX',
  // Tiendas departamentales
  'LIVERPOOL', 'PALACIO DE HIERRO', 'SEARS', 'COPPEL', 'ELEKTRA',
  'HOME DEPOT', 'OFFICE DEPOT', 'OFFICE MAX',
];

// ── Keywords que indican "esta línea es el total" ──
// Ordenados por prioridad (mayor = más confiable)
const TOTAL_KEYWORDS: { pattern: RegExp; priority: number; isNot?: RegExp }[] = [
  { pattern: /total\s*a\s*pagar/i, priority: 20 },
  { pattern: /gran\s*total/i, priority: 18 },
  { pattern: /total\s*(?:mxn|mn|pesos)?/i, priority: 15, isNot: /sub\s*total/i },
  { pattern: /importe\s*(?:total)?/i, priority: 12 },
  { pattern: /monto\s*(?:total)?/i, priority: 10 },
  { pattern: /neto\s*a?\s*pagar/i, priority: 14 },
];

// ── Keywords para excluir al detectar montos ──
// Estas líneas NO son el total del ticket
const NOT_TOTAL_KEYWORDS = /cambio|vuelto|efectivo|ef\s*vo|tarjeta|visa|master|debito|credito|propina|pago\s|recibido|aprobado|tc\b|td\b/i;

// ── Líneas que NO son el nombre del comercio ──
const MERCHANT_SKIP = /^[\s*=\-_#.]+$|^RFC\b|^R\.?F\.?C|^TEL\b|^TELEFONO|^CALLE |^AV\b|^AVE\b|^AVENIDA|^BLVD|^BOULEVARD|^COL\b|^COL\.|^COLONIA|^C\.?P\.?\s*\d|^DOMICILIO|^SUCURSAL|^SUC\b|^TDA\b|^TIENDA\s*\d|^EST\.\s*SERV|^NO\.\s*DE|^FOLIO|^TICKET|^NOTA DE|^FECHA|^\d{1,2}[/-]\d{1,2}[/-]\d{2,4}|^\d{4}[/-]\d{2}|^HORA\b|^[\d$.,\s/-]+$/i;

// ── Patrón para detectar razón social (S.A. DE C.V., etc) ──
const LEGAL_ENTITY = /\b(?:S\.?\s*A\.?\s*(?:DE\s*)?C\.?\s*V\.?|S\.?\s*(?:DE\s*)?R\.?\s*L\.?\s*(?:DE\s*)?C\.?\s*V\.?|S\.?\s*C\.?)\b/i;

// ═══════════════════════════════════════════
// AMOUNT — Detección de monto total
// ═══════════════════════════════════════════

function findAmount(rawText: string): number | undefined {
  const lines = rawText.split('\n').map(l => l.trim());
  const candidates: { value: number; priority: number; lineIdx: number }[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line) continue;

    // Saltar líneas de cambio/efectivo/propina
    if (NOT_TOTAL_KEYWORDS.test(line)) continue;

    // Revisar si esta línea contiene keyword de total
    for (const { pattern, priority, isNot } of TOTAL_KEYWORDS) {
      if (!pattern.test(line)) continue;
      if (isNot && isNot.test(line)) continue;

      // Caso 1: El precio está en LA MISMA línea
      const pricesInLine = extractPrices(line);
      if (pricesInLine.length > 0) {
        // Tomar el último precio de la línea (más probable que sea el total)
        const price = pricesInLine[pricesInLine.length - 1];
        candidates.push({ value: price, priority, lineIdx: i });
      }

      // Caso 2: El precio está en la SIGUIENTE línea (OCR separó "TOTAL\n$123.45")
      if (i + 1 < lines.length) {
        const nextLine = lines[i + 1];
        if (nextLine && !NOT_TOTAL_KEYWORDS.test(nextLine)) {
          const pricesNext = extractPrices(nextLine);
          if (pricesNext.length > 0 && pricesInLine.length === 0) {
            // Solo si no había precio en la línea del keyword
            candidates.push({ value: pricesNext[0], priority: priority - 1, lineIdx: i });
          }
        }
      }
    }

    // Caso especial: línea fragmentada OCR "TOT AL", "T0TAL", "TOTAI"
    const fuzzyTotal = /t[o0][t7]\s*a\s*l/i;
    if (fuzzyTotal.test(line.replace(/\s/g, '')) && !NOT_TOTAL_KEYWORDS.test(line)) {
      const prices = extractPrices(line);
      if (prices.length > 0) {
        candidates.push({ value: prices[prices.length - 1], priority: 8, lineIdx: i });
      } else if (i + 1 < lines.length) {
        const nextPrices = extractPrices(lines[i + 1]);
        if (nextPrices.length > 0) {
          candidates.push({ value: nextPrices[0], priority: 7, lineIdx: i });
        }
      }
    }
  }

  if (candidates.length > 0) {
    // Prioridad más alta gana; si empatan, el que aparece más abajo en el ticket
    candidates.sort((a, b) => b.priority - a.priority || b.lineIdx - a.lineIdx);
    return candidates[0].value;
  }

  // Fallback: el número más grande (excluyendo líneas de cambio/efectivo)
  const safeLines = lines.filter(l => !NOT_TOTAL_KEYWORDS.test(l));
  const allPrices = extractPrices(safeLines.join('\n'));
  if (allPrices.length === 0) return undefined;
  return Math.max(...allPrices);
}

/**
 * Extrae todos los precios de un texto.
 * Entrenado para OCR sucio: espacios entre dígitos, $ pegado o separado,
 * comas de miles, puntos decimales opcionales.
 *
 * Formatos soportados:
 *   $1,234.56  →  1234.56
 *   $ 1,234.56 →  1234.56
 *   1234.56    →  1234.56
 *   $1234      →  1234
 *   $21 .50    →  21.50  (OCR con espacio antes del punto)
 *   $ 33.50    →  33.50
 *   12,499.00  →  12499
 */
function extractPrices(text: string): number[] {
  // Normalizar: quitar espacios alrededor de puntos decimales y comas
  // "$ 33.50" → "$33.50", "$21 .50" → "$21.50", "1 ,234" → "1,234"
  const cleaned = text
    .replace(/(\d)\s+\.(\d)/g, '$1.$2')   // "21 .50" → "21.50"
    .replace(/\.\s+(\d)/g, '.$1')          // ". 50" → ".50"
    .replace(/(\d)\s+,\s*(\d)/g, '$1,$2'); // "1 ,234" → "1,234"

  // Patrón principal: precio con $ opcional, comas de miles, decimal opcional
  const matches = cleaned.match(/\$?\s*\d{1,3}(?:,\d{3})*(?:\.\d{1,2})|\$?\s*\d+(?:\.\d{1,2})/g);
  if (!matches) return [];

  return matches
    .map(m => {
      const num = m.replace(/[$\s,]/g, '');
      return Number(num);
    })
    .filter(v => !Number.isNaN(v) && v > 0 && v < 1000000); // max razonable: 1M
}

// ═══════════════════════════════════════════
// DATE — Detección de fecha
// ═══════════════════════════════════════════

const MONTHS_ES: Record<string, string> = {
  enero: '01', ene: '01', en: '01',
  febrero: '02', feb: '02',
  marzo: '03', mar: '03',
  abril: '04', abr: '04',
  mayo: '05', may: '05',
  junio: '06', jun: '06',
  julio: '07', jul: '07',
  agosto: '08', ago: '08',
  septiembre: '09', sep: '09', sept: '09',
  octubre: '10', oct: '10',
  noviembre: '11', nov: '11',
  diciembre: '12', dic: '12',
};

function findDate(rawText: string): string | undefined {
  // 1) ISO: YYYY-MM-DD o YYYY/MM/DD (ej: "2024-03-15")
  const isoMatch = rawText.match(/(\d{4})[/-](\d{2})[/-](\d{2})/);
  if (isoMatch) {
    const [, year, month, day] = isoMatch;
    if (isValidDate(Number(year), Number(month), Number(day))) {
      return `${year}-${month}-${day}`;
    }
  }

  // 2) Texto español: "15 de marzo de 2024", "15/Mar/2024", "15-MAR-2024", "01/ABR/2024"
  const allMonthNames = Object.keys(MONTHS_ES).join('|');
  const textDateRegex = new RegExp(
    `(\\d{1,2})\\s*(?:de\\s+|[/-])\\s*(${allMonthNames})\\s*(?:de\\s+|[/-])\\s*(\\d{2,4})`,
    'i',
  );
  const textDateMatch = rawText.match(textDateRegex);
  if (textDateMatch) {
    const day = textDateMatch[1].padStart(2, '0');
    const monthKey = textDateMatch[2].toLowerCase();
    const month = MONTHS_ES[monthKey];
    const year = textDateMatch[3].length === 2 ? `20${textDateMatch[3]}` : textDateMatch[3];
    if (month && isValidDate(Number(year), Number(month), Number(day))) {
      return `${year}-${month}-${day}`;
    }
  }

  // 3) Texto sin año: "15 de marzo" o "del 15 de marzo" — usar año actual
  const noYearRegex = new RegExp(
    `(?:del?\\s+)?(\\d{1,2})\\s+de\\s+(${allMonthNames})(?!\\s*(?:de\\s+)?\\d)`,
    'i',
  );
  const noYearMatch = rawText.match(noYearRegex);
  if (noYearMatch) {
    const day = noYearMatch[1].padStart(2, '0');
    const monthKey = noYearMatch[2].toLowerCase();
    const month = MONTHS_ES[monthKey];
    const year = String(new Date().getFullYear());
    if (month && isValidDate(Number(year), Number(month), Number(day))) {
      return `${year}-${month}-${day}`;
    }
  }

  // 4) DD/MM/YYYY o DD-MM-YYYY numérico (formato mexicano estándar)
  const numericMatch = rawText.match(/(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})/);
  if (numericMatch) {
    const [, part1, part2, yearRaw] = numericMatch;
    const year = yearRaw.length === 2 ? `20${yearRaw}` : yearRaw;
    const a = Number(part1);
    const b = Number(part2);

    // Si part2 > 12, asumir MM/DD/YYYY (raro en MX pero posible)
    if (b > 12 && a <= 12) {
      if (isValidDate(Number(year), a, b)) {
        return `${year}-${String(a).padStart(2, '0')}-${String(b).padStart(2, '0')}`;
      }
    }
    // Default DD/MM/YYYY
    if (isValidDate(Number(year), b, a)) {
      return `${year}-${String(b).padStart(2, '0')}-${String(a).padStart(2, '0')}`;
    }
  }

  return undefined;
}

function isValidDate(year: number, month: number, day: number): boolean {
  if (year < 2000 || year > 2100) return false;
  if (month < 1 || month > 12) return false;
  if (day < 1 || day > 31) return false;
  const d = new Date(year, month - 1, day);
  return d.getFullYear() === year && d.getMonth() === month - 1 && d.getDate() === day;
}

// ═══════════════════════════════════════════
// MERCHANT — Detección de nombre del comercio
// ═══════════════════════════════════════════

function findMerchant(rawText: string): string {
  const lines = rawText
    .split('\n')
    .map(l => l.trim())
    .filter(l => l.length > 1);

  // PASO 1: Buscar marca conocida en las primeras 8 líneas del header
  const headerSlice = lines.slice(0, 8);

  // Priorizar marcas más largas primero para evitar que "WALMART" gane sobre "SAM'S CLUB"
  const sortedBrands = [...KNOWN_BRANDS].sort((a, b) => b.length - a.length);
  for (const brand of sortedBrands) {
    const brandUpper = brand.toUpperCase();
    const brandLen = brandUpper.length;

    for (const headerLine of headerSlice) {
      const lineUpper = headerLine.toUpperCase();
      const lineNoSpaces = lineUpper.replace(/\s/g, '');
      const brandNoSpaces = brandUpper.replace(/\s/g, '');

      // Match exacto en la línea (la marca debe ser parte principal, no un fragmento)
      // Para marcas cortas (< 6 chars), exigir que sea el inicio o la línea completa
      if (brandLen < 6) {
        // Marcas cortas: deben estar al inicio de la línea o ser la línea completa
        if (lineUpper.startsWith(brandUpper) || lineNoSpaces === brandNoSpaces) {
          return brand;
        }
      } else {
        // Marcas largas: basta con que estén contenidas
        if (lineNoSpaces.includes(brandNoSpaces) || lineUpper.includes(brandUpper)) {
          return brand;
        }
      }
    }
  }

  // PASO 2: Buscar la primera línea "significativa"
  // Saltamos: decoraciones, RFC, direcciones, fechas, líneas numéricas
  for (const line of lines) {
    if (MERCHANT_SKIP.test(line)) continue;
    if (LEGAL_ENTITY.test(line) && line.length < 30) continue; // "S.A. DE C.V." sola

    // Limpiar decoraciones
    const clean = line.replace(/^[*=\-_#\s]+|[*=\-_#\s]+$/g, '').trim();

    if (clean.length < 3 || clean.length > 80) continue;

    // Si tiene razón social, extraer solo el nombre
    const withoutLegal = clean.replace(LEGAL_ENTITY, '').trim();
    if (withoutLegal.length >= 3) {
      return withoutLegal;
    }
    return clean;
  }

  return lines[0]?.replace(/^[*=\-_#\s]+|[*=\-_#\s]+$/g, '').trim() ?? '';
}

// ═══════════════════════════════════════════
// RFC — Detección de RFC fiscal
// ═══════════════════════════════════════════

function findRfc(rawText: string): string | undefined {
  const allMatches = rawText.match(/[A-Z&Ñ]{3,4}\d{6}[A-Z0-9]{3}/gi);
  if (!allMatches) return undefined;

  // Filtrar genéricos del SAT
  const filtered = allMatches.filter(
    rfc => !GENERIC_RFCs.includes(rfc.toUpperCase()),
  );

  const best = filtered[0] ?? allMatches[0];
  return best?.toUpperCase();
}

// ═══════════════════════════════════════════
// USO CFDI
// ═══════════════════════════════════════════

function findUsoCfdi(rawText: string): string | undefined {
  const match = rawText.match(/(?:uso\s*(?:de\s*)?cfdi|cfdi)[\s:=]*([A-Z]\d{2})/i);
  return match?.[1]?.toUpperCase();
}

// ═══════════════════════════════════════════
// LINE ITEMS — Productos del ticket
// ═══════════════════════════════════════════

const SKIP_ITEMS = /^(sub\s*total|total|iva|i\.v\.a\.?|impuesto|cambio|efectivo|ef\s*vo|tarjeta|visa|master|pago|vuelto|propina|descuento|tc\b|td\b|no\.\s*de|folio|caja|cajero|sucursal|tel[eé]?|rfc|domicilio|calle|col\.|c\.p\.|cp\s*\d|gracias|vuelva|aprobado|fecha|hora\b|bomba|litros|precio.l)/i;

function findLineItems(rawText: string): ParsedLineItem[] {
  const lines = rawText
    .split('\n')
    .map(l => l.trim())
    .filter(l => l.length > 3);
  const items: ParsedLineItem[] = [];

  for (const line of lines) {
    if (SKIP_ITEMS.test(line)) continue;

    // Normalizar espacios alrededor de punto decimal OCR
    const normalized = line
      .replace(/(\d)\s+\.(\d)/g, '$1.$2')
      .replace(/\.\s+(\d)/g, '.$1');

    // Patrón 1: "2 x Producto  $12.50" o "2x Producto 12.50"
    const qtyMatch = normalized.match(
      /^(\d+)\s*[xX]\s+(.+?)\s+\$?\s*(\d{1,3}(?:,\d{3})*(?:\.\d{1,2})?)\s*$/,
    );
    if (qtyMatch) {
      const qty = Number(qtyMatch[1]);
      const name = qtyMatch[2].replace(/[\s.]+$/, '').trim();
      const unitPrice = Number(qtyMatch[3].replace(/,/g, ''));
      if (name.length >= 2 && !Number.isNaN(unitPrice) && unitPrice > 0) {
        items.push({ name: `${name} (x${qty})`, price: unitPrice * qty });
        continue;
      }
    }

    // Patrón 2: "Producto  $12.50" o "Producto  12,499.00"
    const match = normalized.match(
      /^(.+?)\s+\$?\s*(\d{1,3}(?:,\d{3})*(?:\.\d{1,2})?)\s*$/,
    );
    if (!match) continue;

    const name = match[1].replace(/[\s.]+$/, '').trim();
    const price = Number(match[2].replace(/,/g, ''));

    if (name.length >= 2 && !Number.isNaN(price) && price > 0) {
      items.push({ name, price });
    }
  }

  return items;
}

// ═══════════════════════════════════════════
// CONCEPTS
// ═══════════════════════════════════════════

function findConcepts(rawText: string, lineItems?: ParsedLineItem[]): string {
  if (lineItems?.length) {
    return lineItems.map(i => `${i.name} $${i.price.toFixed(2)}`).join(', ');
  }
  const lines = rawText
    .split('\n')
    .map(l => l.trim())
    .filter(l => l.length > 3);
  return lines.slice(1, 5).join(', ');
}

// ═══════════════════════════════════════════
// REGEX PARSER (fallback)
// ═══════════════════════════════════════════

function parseWithRegex(rawText: string): ParsedReceiptData {
  const merchantName = findMerchant(rawText);
  const lineItems = findLineItems(rawText);
  const conceptsText = findConcepts(rawText, lineItems);
  const rfcRaw = findRfc(rawText) ?? '';
  const usoCFDI = findUsoCfdi(rawText) ?? '';
  const rfc = isValidMexicanRfc(rfcRaw) ? rfcRaw : '';
  const suggestedCategory = classifyExpense(`${merchantName} ${conceptsText} ${rawText}`);
  const deductible = inferDeductibility({ rawText, merchantName, rfc, usoCFDI });

  return {
    amount: findAmount(rawText),
    date: findDate(rawText),
    merchantName,
    conceptsText,
    lineItems: lineItems.length ? lineItems : undefined,
    rawText,
    suggestedCategory,
    deductible,
    rfc,
    usoCFDI,
  };
}

// ═══════════════════════════════════════════
// MERGE — AI + Regex por campo, el mejor gana
// ═══════════════════════════════════════════

function mergeResults(ai: AIParseResult, rawText: string): ParsedReceiptData {
  const regexResult = parseWithRegex(rawText);

  // Amount: prefer AI when highly confident, else regex.
  // When both found amounts and they disagree, prefer regex (has more heuristics for edge cases).
  let amount: number | undefined;
  if (ai.amountConfidence > 0.7 && ai.amount !== undefined) {
    // High AI confidence: prefer AI unless regex found something different
    if (regexResult.amount !== undefined && Math.abs(ai.amount - regexResult.amount) > 0.02) {
      // They disagree — prefer regex (has fuzzy matching, priority system)
      amount = regexResult.amount;
    } else {
      amount = ai.amount;
    }
  } else {
    amount = regexResult.amount ?? ai.amount;
  }

  // Date: prefer AI when confident, else regex
  const date = ai.dateConfidence > 0.5 && ai.date !== undefined
    ? ai.date
    : regexResult.date;

  // Merchant: regex brand lookup is always superior (uses known brands database)
  const merchantName = regexResult.merchantName || ai.merchantName || '';

  // RFC: use whichever finds a valid non-generic RFC
  const GENERIC_RFCS = ['XAXX010101000', 'XEXX010101000'];
  let rfcRaw = regexResult.rfc ?? '';
  if (GENERIC_RFCS.includes(rfcRaw) && ai.rfc && !GENERIC_RFCS.includes(ai.rfc)) {
    rfcRaw = ai.rfc;
  } else if (!rfcRaw && ai.rfc) {
    rfcRaw = ai.rfc;
  }

  const lineItems = findLineItems(rawText);
  const conceptsText = findConcepts(rawText, lineItems);
  const usoCFDI = findUsoCfdi(rawText) ?? '';
  const rfc = isValidMexicanRfc(rfcRaw) ? rfcRaw : '';
  const suggestedCategory = classifyExpense(`${merchantName} ${conceptsText} ${rawText}`);
  const deductible = inferDeductibility({ rawText, merchantName, rfc, usoCFDI });

  return {
    amount,
    date,
    merchantName,
    conceptsText,
    lineItems: lineItems.length ? lineItems : undefined,
    rawText,
    suggestedCategory,
    deductible,
    rfc,
    usoCFDI,
  };
}

// ═══════════════════════════════════════════
// MAIN — Función principal de parsing
// ═══════════════════════════════════════════

export function parseReceiptText(rawText: string, regime?: FiscalRegime): ParsedReceiptData {
  const aiResult = parseWithAI(rawText);
  const result = mergeResults(aiResult, rawText);
  // Re-evaluar deducibilidad con el régimen del usuario si está disponible
  if (regime) {
    result.deductible = inferDeductibility({
      rawText,
      merchantName: result.merchantName,
      rfc: result.rfc,
      usoCFDI: result.usoCFDI,
      regime,
    });
  }
  return result;
}
