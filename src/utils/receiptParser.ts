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
const KNOWN_BRANDS = [
  // Conveniencia
  'OXXO', '7-ELEVEN', 'SEVEN ELEVEN', 'CIRCLE K', 'EXTRA', 'KIOSKO',
  // Supermercados
  'WALMART SUPERCENTER', 'WALMART', 'WAL MART', 'WAL-MART',
  'MI BODEGA AURRERA', 'BODEGA AURRERA', 'AURRERA',
  'MEGA SORIANA', 'SORIANA', 'CHEDRAUI', 'HEB', 'H-E-B',
  'LA COMER', 'FRESKO', 'CITY MARKET', 'SUPERAMA', 'COSTCO WHOLESALE', 'COSTCO',
  "SAM'S CLUB", 'SAMS CLUB', "SAM'S", 'LA EUROPEA',
  // Restaurantes cadena
  'STARBUCKS', 'MCDONALDS', "MCDONALD'S", 'BURGER KING', 'SUBWAY',
  'DOMINOS', "DOMINO'S", 'LITTLE CAESARS', 'KFC', 'POLLO LOCO', 'EL POLLO FELIZ',
  'VIPS', 'SANBORNS', 'TOKS', 'ITALIANNIS', "APPLEBEE'S", 'APPLEBEES',
  "CHILI'S", 'CHILIS', "CARL'S JR", 'CARLS JR', 'BURGER INN',
  'LA CASA DE TONO', 'EL TIZONCITO', 'EL PORTÓN', 'EL PORTON',
  'EL FOGON', 'EL FOGÓN', 'WINGS ARMY', 'HOOTERS',
  'POTZOLLCALLI', 'EL CARDENAL', 'CONTRAMAR',
  // Cafés
  'CIELITO QUERIDO', 'PUNTA DEL CIELO', 'THE ITALIAN COFFEE', 'CAFE PUNTA',
  'EL PENDULO', 'EL PÉNDULO', 'BUNA CAFE', 'DOSIS CAFE', 'QUENTIN',
  // Farmacias
  'FARMACIA GUADALAJARA', 'FARMACIAS DEL AHORRO', 'FARMACIAS SIMILARES',
  'FARMACIA SAN PABLO', 'FARMACIAS CHEDRAUI', 'CRUZ VERDE',
  'BENAVIDES', 'FARMACIA EXPRESS', 'FARMACIA',
  // Gasolineras
  'HIDROSINA', 'PETRO 7', 'G500', 'BIOIL', 'ORSAN',
  'PEMEX', 'GASOLINERA', 'OXXO GAS', 'SHELL', 'BP', 'MOBIL', 'GULF',
  // Transporte
  'UBER', 'DIDI', 'CABIFY', 'BEAT', 'INDRIVER',
  // Entretenimiento
  'CINEPOLIS', 'CINÉPOLIS', 'CINEMEX', 'CINETECA',
  // Departamentales
  'LIVERPOOL', 'PALACIO DE HIERRO', 'SEARS', 'COPPEL', 'ELEKTRA', 'SUBURBIA',
  // Hogar y construcción
  'HOME DEPOT', 'SODIMAC', 'DO IT CENTER', 'CONSTRURAMA', 'TRUPER',
  // Oficina y tech
  'OFFICE DEPOT', 'OFFICE MAX', 'BEST BUY', 'RADIOSHACK', 'STEREN',
  'APPLE STORE', 'ISTORE', 'MIXUP',
  // Ropa
  'ZARA', 'H&M', 'PULL AND BEAR', 'BERSHKA', 'STRADIVARIUS', 'C&A', 'ANDREA', 'FLEXI',
  // Telecom y servicios
  'TOTALPLAY', 'MEGACABLE', 'IZZI', 'TELMEX', 'TELCEL', 'MOVISTAR',
  'CFE', 'NATURGY', 'GAS NATURAL',
  // Bancos
  'BBVA', 'BANAMEX', 'BANORTE', 'HSBC', 'SANTANDER', 'SCOTIABANK', 'INBURSA', 'BANCO AZTECA',
];

// ── Keywords que indican "esta línea es el total" ──
const TOTAL_KEYWORDS: { pattern: RegExp; priority: number; isNot?: RegExp }[] = [
  { pattern: /total\s*a\s*pagar/i, priority: 22 },
  { pattern: /importe\s*a\s*pagar/i, priority: 22 },
  { pattern: /monto\s*a\s*pagar/i, priority: 22 },
  { pattern: /a\s*cobrar/i, priority: 20 },
  { pattern: /gran\s*total/i, priority: 20 },
  { pattern: /total\s*de\s*la\s*venta/i, priority: 19 },
  { pattern: /total\s*venta/i, priority: 18 },
  { pattern: /cargo\s*total/i, priority: 18 },
  { pattern: /su\s*total/i, priority: 17 },
  { pattern: /total\s*ticket/i, priority: 17 },
  { pattern: /total\s*cuenta/i, priority: 17 },
  { pattern: /neto\s*a?\s*pagar/i, priority: 16 },
  { pattern: /total\s*(?:mxn|mn|pesos|usd)?/i, priority: 15, isNot: /sub\s*total/i },
  { pattern: /importe\s*(?:total)?/i, priority: 12 },
  { pattern: /monto\s*(?:total|cobrado)?/i, priority: 10 },
];

// ── Keywords para excluir al detectar montos ──
const NOT_TOTAL_KEYWORDS = /cambio|vuelto|su\s*cambio|efectivo|ef\s*vo|tarjeta|visa|master|debito|credito|propina|pago\s|recibido|aprobado|tc\b|td\b|entregado|deposito/i;

// ── Líneas que NO son el nombre del comercio ──
const MERCHANT_SKIP = /^[\s*=\-_#.]+$|^RFC\b|^R\.?F\.?C|^TEL\b|^TELEFONO|^CALLE |^AV\b|^AVE\b|^AVENIDA|^BLVD|^BOULEVARD|^COL\b|^COL\.|^COLONIA|^C\.?P\.?\s*\d|^DOMICILIO|^SUCURSAL|^SUC\b|^TDA\b|^TIENDA\s*\d|^EST\.\s*SERV|^NO\.\s*DE|^FOLIO|^TICKET|^NOTA DE|^FECHA|^\d{1,2}[/-]\d{1,2}[/-]\d{2,4}|^\d{4}[/-]\d{2}|^HORA\b|^[\d$.,\s/-]+$/i;

// ── Patrón para detectar razón social (S.A. DE C.V., etc) ──
const LEGAL_ENTITY = /\b(?:S\.?\s*A\.?\s*(?:DE\s*)?C\.?\s*V\.?|S\.?\s*(?:DE\s*)?R\.?\s*L\.?\s*(?:DE\s*)?C\.?\s*V\.?|S\.?\s*C\.?)\b/i;

// ═══════════════════════════════════════════
// AMOUNT — Detección de monto total
// ═══════════════════════════════════════════

function findAmount(rawText: string): { value: number | undefined; foundViaKeyword: boolean } {
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
    candidates.sort((a, b) => b.priority - a.priority || b.lineIdx - a.lineIdx);
    // Saltar candidatos absurdos (< $1)
    const valid = candidates.find(c => c.value >= 1);
    if (valid) return { value: valid.value, foundViaKeyword: true };
  }

  // Gasolineras: buscar "IMPORTE" que es el total real
  for (let i = 0; i < lines.length; i++) {
    if (/\bimporte\b/i.test(lines[i]) && !NOT_TOTAL_KEYWORDS.test(lines[i])) {
      const prices = extractPrices(lines[i]);
      if (prices.length > 0) return { value: prices[prices.length - 1], foundViaKeyword: true };
      if (i + 1 < lines.length) {
        const next = extractPrices(lines[i + 1]);
        if (next.length > 0) return { value: next[0], foundViaKeyword: true };
      }
    }
  }

  // Fallback: precio más grande en la mitad inferior del ticket
  const lowerHalf = lines.slice(Math.floor(lines.length / 2));
  const lowerSafe = lowerHalf.filter(l => !NOT_TOTAL_KEYWORDS.test(l));
  const lowerPrices = extractPrices(lowerSafe.join('\n')).filter(p => p >= 1);
  if (lowerPrices.length > 0) return { value: Math.max(...lowerPrices), foundViaKeyword: false };

  // Último fallback: precio más grande de todo el ticket
  const safeLines = lines.filter(l => !NOT_TOTAL_KEYWORDS.test(l));
  const allPrices = extractPrices(safeLines.join('\n')).filter(p => p >= 1);
  if (allPrices.length === 0) return { value: undefined, foundViaKeyword: false };
  return { value: Math.max(...allPrices), foundViaKeyword: false };
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
    .replace(/(\d)\s+\.(\d)/g, '$1.$2')    // "21 .50" → "21.50"
    .replace(/\.\s+(\d)/g, '.$1')           // ". 50" → ".50"
    .replace(/(\d)\s+,\s*(\d)/g, '$1,$2')  // "1 ,234" → "1,234"
    .replace(/(\d) (\d{3})(?=\D|$)/g, '$1,$2'); // "1 234" → "1,234" (espacio como sep. de miles)

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
  // 0) Fecha con hora pegada — extraer solo la fecha: "16/06/2024 14:32:05"
  const dateTimeMatch = rawText.match(/(\d{1,2})[/-](\d{1,2})[/-](\d{4})\s+\d{1,2}:\d{2}/);
  if (dateTimeMatch) {
    const [, d, m, y] = dateTimeMatch;
    if (isValidDate(Number(y), Number(m), Number(d))) {
      return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
    }
  }

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

  // 5) Formato compacto sin separadores: "15JUN2024", "15JUN24", "15-JUN-24"
  const allMonthNamesCompact = Object.keys(MONTHS_ES).join('|');
  const compactMatch = rawText.match(
    new RegExp(`(\\d{1,2})[\\s-]?(${allMonthNamesCompact})[\\s-]?(\\d{2,4})`, 'i'),
  );
  if (compactMatch) {
    const day = compactMatch[1].padStart(2, '0');
    const monthKey = compactMatch[2].toLowerCase();
    const month = MONTHS_ES[monthKey];
    const year = compactMatch[3].length === 2 ? `20${compactMatch[3]}` : compactMatch[3];
    if (month && isValidDate(Number(year), Number(month), Number(day))) {
      return `${year}-${month}-${day}`;
    }
  }

  // 6) Etiquetas: "DIA 16 MES 06 ANO 2024" o "DIA:16 MES:06 AÑO:2024"
  const labeledMatch = rawText.match(
    /d[ií]a\s*[:=]?\s*(\d{1,2})\s+mes\s*[:=]?\s*(\d{1,2})\s+a[ñn]o\s*[:=]?\s*(\d{2,4})/i,
  );
  if (labeledMatch) {
    const day = labeledMatch[1].padStart(2, '0');
    const month = labeledMatch[2].padStart(2, '0');
    const year = labeledMatch[3].length === 2 ? `20${labeledMatch[3]}` : labeledMatch[3];
    if (isValidDate(Number(year), Number(month), Number(day))) {
      return `${year}-${month}-${day}`;
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

  // PASO 1: Buscar marca conocida en las primeras 12 líneas del header
  const headerSlice = lines.slice(0, 12);

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
  // Normalizar: juntar tokens fragmentados por OCR cerca de etiqueta RFC
  const normalized = rawText.replace(
    /\bRFC\s*[:=]?\s*([A-Z&Ñ0-9\s-]{10,20})/gi,
    (_match, candidate) => `RFC:${candidate.replace(/[\s-]/g, '')}`,
  );

  const allMatches: string[] = normalized.match(/[A-Z&Ñ]{3,4}\d{6}[A-Z0-9]{3}/gi) ?? [];

  // Fallback: corregir confusiones OCR comunes en RFCs (O↔0, l/I↔1)
  if (allMatches.length === 0) {
    const ocrFixed = rawText
      .replace(/RFC\s*[:=]?\s*/gi, 'RFC:')
      .replace(/(?<=RFC:[A-Z&Ñ]{3,4}\d*)O(?=\d)/gi, '0');
    const fixedMatches = ocrFixed.match(/[A-Z&Ñ]{3,4}\d{6}[A-Z0-9]{3}/gi) ?? [];
    allMatches.push(...fixedMatches);
  }

  const filtered = allMatches.filter(rfc => !GENERIC_RFCs.includes(rfc.toUpperCase()));
  const best = filtered[0] ?? allMatches[0];
  return best?.toUpperCase();
}

// ═══════════════════════════════════════════
// USO CFDI
// ═══════════════════════════════════════════

// Códigos de uso CFDI más comunes en tickets mexicanos
const CFDI_USE_CODES = new Set([
  'G01','G02','G03','I01','I02','I03','I04','I05','I06','I07','I08',
  'D01','D02','D03','D04','D05','D06','D07','D08','D09','D10',
  'P01','S01','CP01','CN01',
]);

function findUsoCfdi(rawText: string): string | undefined {
  // Patrón 1: etiqueta explícita "USO CFDI: G03" o "CFDI: G03"
  const labelMatch = rawText.match(/(?:uso\s*(?:de\s*)?cfdi|uso\s*cfdi)[\s:=]*([A-Z]{1,3}\d{2})/i);
  if (labelMatch) return labelMatch[1].toUpperCase();

  // Patrón 2: código solo al inicio de línea, precedido por "USO" en línea anterior
  const lines = rawText.split('\n');
  for (let i = 0; i < lines.length; i++) {
    if (/\buso\b/i.test(lines[i]) && i + 1 < lines.length) {
      const nextCode = lines[i + 1].trim().match(/^([A-Z]{1,3}\d{2})\b/);
      if (nextCode && CFDI_USE_CODES.has(nextCode[1].toUpperCase())) {
        return nextCode[1].toUpperCase();
      }
    }
    // Patrón 3: código conocido en la línea directamente (ej "G03 GASTOS GENERALES")
    const knownCode = lines[i].match(/\b([A-Z]{1,3}\d{2})\b/);
    if (knownCode && CFDI_USE_CODES.has(knownCode[1].toUpperCase())) {
      // Solo si está en contexto de CFDI (línea anterior o siguiente menciona CFDI)
      const ctx = (lines[i - 1] ?? '') + lines[i] + (lines[i + 1] ?? '');
      if (/cfdi|uso|comprobante/i.test(ctx)) {
        return knownCode[1].toUpperCase();
      }
    }
  }
  return undefined;
}

// ═══════════════════════════════════════════
// LINE ITEMS — Productos del ticket
// ═══════════════════════════════════════════

const SKIP_ITEMS = /^(sub\s*total|total|iva|i\.v\.a\.?|impuesto|cambio|efectivo|ef\s*vo|tarjeta|visa|master|pago|vuelto|propina|descuento|tc\b|td\b|no\.\s*de|folio|folio\s*fiscal|uuid|certificado|sello|cadena\s*orig|tipo\s*de\s*comprobante|metodo\s*de\s*pago|forma\s*de\s*pago|regimen\s*fiscal|codigo\s*postal|cp\s*emisor|no\.\s*aprobacion|referencia|num\s*emp|num\s*empleado|turno|caja\s*no|transaccion|caja|cajero|sucursal|tel[eé]?|rfc|domicilio|calle|col\.|c\.p\.|cp\s*\d|gracias|vuelva|aprobado|fecha|hora\b|bomba|litros|precio.l|entregado|recibido)/i;

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
    if (match) {
      const name = match[1].replace(/[\s.]+$/, '').trim();
      const price = Number(match[2].replace(/,/g, ''));
      if (name.length >= 2 && !Number.isNaN(price) && price > 0) {
        items.push({ name, price });
        continue;
      }
    }

    // Patrón 3: "Producto...........$12.50" (puntos de relleno en tickets impresos)
    const dotsMatch = normalized.match(
      /^(.+?)\.{3,}\$?\s*(\d{1,3}(?:,\d{3})*(?:\.\d{1,2})?)\s*$/,
    );
    if (dotsMatch) {
      const name = dotsMatch[1].replace(/[\s.]+$/, '').trim();
      const price = Number(dotsMatch[2].replace(/,/g, ''));
      if (name.length >= 2 && !Number.isNaN(price) && price > 0) {
        items.push({ name, price });
        continue;
      }
    }

    // Patrón 4: "$12.50  Producto" (precio al inicio)
    const priceFirstMatch = normalized.match(
      /^\$?\s*(\d{1,3}(?:,\d{3})*(?:\.\d{1,2})?)\s+(.{2,50})\s*$/,
    );
    if (priceFirstMatch) {
      const price = Number(priceFirstMatch[1].replace(/,/g, ''));
      const name = priceFirstMatch[2].trim();
      if (name.length >= 2 && !Number.isNaN(price) && price > 0 && !SKIP_ITEMS.test(name)) {
        items.push({ name, price });
      }
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

function parseWithRegex(rawText: string): ParsedReceiptData & { amountFoundViaKeyword: boolean } {
  const merchantName = findMerchant(rawText);
  const lineItems = findLineItems(rawText);
  const conceptsText = findConcepts(rawText, lineItems);
  const rfcRaw = findRfc(rawText) ?? '';
  const usoCFDI = findUsoCfdi(rawText) ?? '';
  const rfc = isValidMexicanRfc(rfcRaw) ? rfcRaw : '';
  const suggestedCategory = classifyExpense(`${merchantName} ${conceptsText} ${rawText}`);
  const deductible = inferDeductibility({ rawText, merchantName, rfc, usoCFDI });
  const { value: amount, foundViaKeyword: amountFoundViaKeyword } = findAmount(rawText);

  return {
    amount,
    amountFoundViaKeyword,
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
  const { amountFoundViaKeyword } = regexResult;

  // ── Amount ────────────────────────────────────────────────────────────────
  // Regla: si regex encontró keyword explícito → confiar en regex
  //        si regex solo usó fallback (precio máximo) → dar más peso a AI
  //        si ambos coinciden → muy alta confianza, usar regex
  let amount: number | undefined;
  if (regexResult.amount !== undefined && amountFoundViaKeyword) {
    // Regex encontró keyword explícito — es muy confiable
    if (ai.amount !== undefined && Math.abs(ai.amount - regexResult.amount) < 0.02) {
      amount = regexResult.amount; // acuerdo total
    } else if (ai.amount !== undefined && ai.amountConfidence > 0.85) {
      // AI muy segura y difiere — usar el que aparece más al fondo del ticket
      // (el total real siempre está cerca del final)
      amount = regexResult.amount; // regex keyword sigue ganando en caso de duda
    } else {
      amount = regexResult.amount;
    }
  } else if (ai.amount !== undefined && ai.amountConfidence > 0.7) {
    // AI confiada, regex solo tiene fallback
    amount = ai.amount;
  } else {
    // Ambos tienen baja confianza — usar lo que haya
    amount = regexResult.amount ?? ai.amount;
  }

  // ── Date ──────────────────────────────────────────────────────────────────
  // Si ambos encontraron fecha y coinciden → muy confiable
  // Si difieren → preferir regex (tiene más formatos)
  let date: string | undefined;
  if (regexResult.date && ai.date) {
    date = regexResult.date === ai.date ? regexResult.date : regexResult.date;
  } else {
    date = regexResult.date ?? (ai.dateConfidence > 0.5 ? ai.date : undefined);
  }

  // ── Merchant ──────────────────────────────────────────────────────────────
  // Regex brand DB gana si encontró algo; AI como fallback
  const merchantName = regexResult.merchantName || ai.merchantName || '';

  // ── RFC ───────────────────────────────────────────────────────────────────
  // Preferir RFC no-genérico; entre dos no-genéricos, el primero del ticket
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
// POST-PROCESADO — valida y normaliza resultado
// ═══════════════════════════════════════════

function postProcess(result: ParsedReceiptData): ParsedReceiptData {
  // Fecha: rechazar fechas futuras o anteriores a 2010
  if (result.date) {
    const d = new Date(result.date);
    const today = new Date();
    if (d > today || d.getFullYear() < 2010) {
      result.date = today.toISOString().slice(0, 10);
    }
  }

  // Monto: rechazar valores absurdos (< $1 o > $500,000)
  if (result.amount !== undefined) {
    if (result.amount < 1 || result.amount > 500000) {
      result.amount = undefined;
    }
  }

  // Merchant: title-case solo si no es una marca conocida (OXXO, WALMART, etc. se quedan igual)
  if (result.merchantName && result.merchantName === result.merchantName.toUpperCase()) {
    const upper = result.merchantName.toUpperCase();
    const isKnownBrand = KNOWN_BRANDS.some(b => b.toUpperCase() === upper || upper.includes(b.toUpperCase()));
    if (!isKnownBrand) {
      result.merchantName = result.merchantName
        .toLowerCase()
        .replace(/(?:^|\s)\S/g, c => c.toUpperCase())
        .trim();
    }
  }

  return result;
}

// ═══════════════════════════════════════════
// PRE-PROCESADO — corrige artefactos OCR
// ═══════════════════════════════════════════

function preprocessOcrText(text: string): string {
  return text
    // Fusionar palabras partidas por OCR en keywords clave
    .replace(/\bTOT\s+AL\b/gi, 'TOTAL')
    .replace(/\bSUB\s+TOTAL\b/gi, 'SUBTOTAL')
    .replace(/\bIM\s+PORTE\b/gi, 'IMPORTE')
    .replace(/\bFE\s+CHA\b/gi, 'FECHA')
    .replace(/\bF\s+OLIO\b/gi, 'FOLIO')
    .replace(/\bR\s+FC\b/gi, 'RFC')
    // O→0 y 0→O solo en contexto claramente numérico (rodeado de dígitos)
    .replace(/(\d)[Oo](\d)/g, '$10$2')
    // l/I→1 en contexto numérico
    .replace(/(\d)[lI](\d)/g, '$11$2')
    // Eliminar líneas de solo separadores
    .replace(/^[\s*=\-_#.]{3,}$/gm, '')
    // Normalizar múltiples espacios en una línea
    .replace(/[ \t]{2,}/g, ' ')
    // Quitar líneas en blanco duplicadas
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

// ═══════════════════════════════════════════
// MAIN — Función principal de parsing
// ═══════════════════════════════════════════

export function parseReceiptText(rawText: string, regime?: FiscalRegime): ParsedReceiptData {
  const processedText = preprocessOcrText(rawText);
  const aiResult = parseWithAI(processedText);
  const result = postProcess(mergeResults(aiResult, processedText));
  // Preservar el rawText original (sin pre-procesar) para almacenamiento y debug
  result.rawText = rawText;
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
