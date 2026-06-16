/**
 * Helpers compartidos para extracción de datos de tickets.
 * Usados tanto por receiptParser (regex) como por receiptAI (ML).
 */

// ── Precios ──

/**
 * Extrae todos los precios de un texto.
 * Soporta OCR sucio: espacios entre dígitos, $ pegado o separado,
 * comas de miles, puntos decimales opcionales.
 */
export function extractPrices(text: string): number[] {
  // Normalize common OCR artifacts before parsing
  const cleaned = text
    .replace(/(\d)\s+\.(\d)/g, '$1.$2') // "21 .50" → "21.50"
    .replace(/\.\s+(\d)/g, '.$1') // ". 50"   → ".50"
    .replace(/(\d)\s+,\s*(\d)/g, '$1,$2') // "1 ,234" → "1,234"
    .replace(/(\d)\s+(\d{3})\b/g, '$1,$2') // "1 234"  → "1,234" (space thousands)
    .replace(/[Oo](?=\d)/g, '0') // OCR O→0 before digit
    .replace(/(?<=\d)[Oo]/g, '0') // OCR O→0 after digit
    .replace(/[lI](?=\d)/g, '1') // OCR l/I→1 before digit
    .replace(/(?<=\d)[lI]/g, '1'); // OCR l/I→1 after digit

  const matches = cleaned.match(
    /\$\s*\d{1,3}(?:,\d{3})*(?:\.\d{1,2})?|\$\s*\d+(?:\.\d{1,2})?|\d{1,3}(?:,\d{3})+(?:\.\d{1,2})?|\d+\.\d{1,2}/g,
  );
  if (!matches) return [];

  return matches
    .map(m => {
      const num = m.replace(/[$\s,]/g, '');
      return Number(num);
    })
    .filter(v => !Number.isNaN(v) && v > 0 && v < 1_000_000);
}

// ── Nombre del comercio ──

const LEGAL_ENTITY =
  /\b(?:S\.?\s*A\.?\s*(?:DE\s*)?C\.?\s*V\.?|S\.?\s*(?:DE\s*)?R\.?\s*L\.?\s*(?:DE\s*)?C\.?\s*V\.?|S\.?\s*C\.?)\b/i;

/**
 * Limpia un nombre de comercio: quita decoraciones, razón social, etc.
 */
export function cleanMerchantName(raw: string): string {
  let name = raw.replace(/^[*=\-_#\s]+|[*=\-_#\s]+$/g, '').trim();

  const withoutLegal = name.replace(LEGAL_ENTITY, '').trim();
  if (withoutLegal.length >= 3) {
    name = withoutLegal;
  }

  // Remove trailing punctuation
  name = name.replace(/[.,;:]+$/, '').trim();

  return name;
}

// ── Fecha ──

const MONTHS_ES: Record<string, string> = {
  enero: '01',
  ene: '01',
  en: '01',
  febrero: '02',
  feb: '02',
  marzo: '03',
  mar: '03',
  abril: '04',
  abr: '04',
  mayo: '05',
  may: '05',
  junio: '06',
  jun: '06',
  julio: '07',
  jul: '07',
  agosto: '08',
  ago: '08',
  septiembre: '09',
  sep: '09',
  sept: '09',
  octubre: '10',
  oct: '10',
  noviembre: '11',
  nov: '11',
  diciembre: '12',
  dic: '12',
};

function isValidDate(year: number, month: number, day: number): boolean {
  if (year < 2000 || year > 2100) return false;
  if (month < 1 || month > 12) return false;
  if (day < 1 || day > 31) return false;
  const d = new Date(year, month - 1, day);
  return (
    d.getFullYear() === year &&
    d.getMonth() === month - 1 &&
    d.getDate() === day
  );
}

/**
 * Extrae una fecha de texto libre (una sola línea o varias).
 * Retorna formato YYYY-MM-DD o undefined.
 */
export function extractDateFromText(text: string): string | undefined {
  // ISO: YYYY-MM-DD
  const isoMatch = text.match(/(\d{4})[/-](\d{2})[/-](\d{2})/);
  if (isoMatch) {
    const [, year, month, day] = isoMatch;
    if (isValidDate(Number(year), Number(month), Number(day))) {
      return `${year}-${month}-${day}`;
    }
  }

  // Spanish text: "15 de marzo de 2024", "15/Mar/2024"
  const allMonthNames = Object.keys(MONTHS_ES).join('|');
  const textDateRegex = new RegExp(
    `(\\d{1,2})\\s*(?:de\\s+|[/-])\\s*(${allMonthNames})\\s*(?:de\\s+|[/-])\\s*(\\d{2,4})`,
    'i',
  );
  const textDateMatch = text.match(textDateRegex);
  if (textDateMatch) {
    const day = textDateMatch[1].padStart(2, '0');
    const monthKey = textDateMatch[2].toLowerCase();
    const month = MONTHS_ES[monthKey];
    const year =
      textDateMatch[3].length === 2
        ? `20${textDateMatch[3]}`
        : textDateMatch[3];
    if (month && isValidDate(Number(year), Number(month), Number(day))) {
      return `${year}-${month}-${day}`;
    }
  }

  // Spanish text without year: "15 de marzo"
  const noYearRegex = new RegExp(
    `(?:del?\\s+)?(\\d{1,2})\\s+de\\s+(${allMonthNames})(?!\\s*(?:de\\s+)?\\d)`,
    'i',
  );
  const noYearMatch = text.match(noYearRegex);
  if (noYearMatch) {
    const day = noYearMatch[1].padStart(2, '0');
    const monthKey = noYearMatch[2].toLowerCase();
    const month = MONTHS_ES[monthKey];
    const year = String(new Date().getFullYear());
    if (month && isValidDate(Number(year), Number(month), Number(day))) {
      return `${year}-${month}-${day}`;
    }
  }

  // Fecha con hora pegada: "16/06/2024 14:32:05" — extraer solo fecha
  const dateTimeMatch = text.match(/(\d{1,2})[/-](\d{1,2})[/-](\d{4})\s+\d{1,2}:\d{2}/);
  if (dateTimeMatch) {
    const [, d, m, y] = dateTimeMatch;
    if (isValidDate(Number(y), Number(m), Number(d))) {
      return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
    }
  }

  // Numeric DD/MM/YYYY
  const numericMatch = text.match(/(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})/);
  if (numericMatch) {
    const [, part1, part2, yearRaw] = numericMatch;
    const year = yearRaw.length === 2 ? `20${yearRaw}` : yearRaw;
    const a = Number(part1);
    const b = Number(part2);

    if (b > 12 && a <= 12) {
      if (isValidDate(Number(year), a, b)) {
        return `${year}-${String(a).padStart(2, '0')}-${String(b).padStart(2, '0')}`;
      }
    }
    if (isValidDate(Number(year), b, a)) {
      return `${year}-${String(b).padStart(2, '0')}-${String(a).padStart(2, '0')}`;
    }
  }

  // Compacto sin separadores: "15JUN2024", "15JUN24"
  const allMonthNamesC = 'ene|feb|mar|abr|may|jun|jul|ago|sep|oct|nov|dic|enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre';
  const compactMatch = text.match(new RegExp(`(\\d{1,2})(${allMonthNamesC})(\\d{2,4})`, 'i'));
  if (compactMatch) {
    const MONTHS: Record<string, string> = {
      enero:'01',ene:'01',febrero:'02',feb:'02',marzo:'03',mar:'03',
      abril:'04',abr:'04',mayo:'05',may:'05',junio:'06',jun:'06',
      julio:'07',jul:'07',agosto:'08',ago:'08',septiembre:'09',sep:'09',
      octubre:'10',oct:'10',noviembre:'11',nov:'11',diciembre:'12',dic:'12',
    };
    const day = compactMatch[1].padStart(2, '0');
    const month = MONTHS[compactMatch[2].toLowerCase()];
    const year = compactMatch[3].length === 2 ? `20${compactMatch[3]}` : compactMatch[3];
    if (month && isValidDate(Number(year), Number(month), Number(day))) {
      return `${year}-${month}-${day}`;
    }
  }

  // Etiquetas: "DIA 16 MES 06 ANO 2024"
  const labeledMatch = text.match(/d[ií]a\s*[:=]?\s*(\d{1,2})\s+mes\s*[:=]?\s*(\d{1,2})\s+a[ñn]o\s*[:=]?\s*(\d{2,4})/i);
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

// ── RFC ──

/**
 * Extrae un RFC mexicano de un texto.
 * Maneja fragmentación OCR: "RFC: ABC 123456 XY3" → "ABC123456XY3"
 */
export function extractRfc(text: string): string | undefined {
  const GENERIC_RFCS = ['XAXX010101000', 'XEXX010101000'];

  // Normalizar tokens fragmentados cerca de etiqueta RFC
  const normalized = text.replace(
    /\bRFC\s*[:=]?\s*([A-Z&Ñ0-9\s-]{10,20})/gi,
    (_m, candidate) => `RFC:${candidate.replace(/[\s-]/g, '')}`,
  );

  const allMatches = normalized.match(/[A-Z&Ñ]{3,4}\d{6}[A-Z0-9]{3}/gi) ?? [];
  const filtered = allMatches.filter(rfc => !GENERIC_RFCS.includes(rfc.toUpperCase()));
  const best = filtered[0] ?? allMatches[0];
  return best?.toUpperCase();
}
