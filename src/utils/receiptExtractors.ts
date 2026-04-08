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
  const cleaned = text
    .replace(/(\d)\s+\.(\d)/g, '$1.$2')
    .replace(/\.\s+(\d)/g, '.$1')
    .replace(/(\d)\s+,\s*(\d)/g, '$1,$2');

  const matches = cleaned.match(
    /\$?\s*\d{1,3}(?:,\d{3})*(?:\.\d{1,2})|\$?\s*\d+(?:\.\d{1,2})/g,
  );
  if (!matches) return [];

  return matches
    .map(m => {
      const num = m.replace(/[$\s,]/g, '');
      return Number(num);
    })
    .filter(v => !Number.isNaN(v) && v > 0 && v < 1000000);
}

// ── Nombre del comercio ──

const LEGAL_ENTITY =
  /\b(?:S\.?\s*A\.?\s*(?:DE\s*)?C\.?\s*V\.?|S\.?\s*(?:DE\s*)?R\.?\s*L\.?\s*(?:DE\s*)?C\.?\s*V\.?|S\.?\s*C\.?)\b/i;

/**
 * Limpia un nombre de comercio: quita decoraciones, razón social, etc.
 */
export function cleanMerchantName(raw: string): string {
  let name = raw
    .replace(/^[*=\-_#\s]+|[*=\-_#\s]+$/g, '')
    .trim();

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

  return undefined;
}

// ── RFC ──

/**
 * Extrae un RFC mexicano de un texto.
 */
export function extractRfc(text: string): string | undefined {
  const GENERIC_RFCS = ['XAXX010101000', 'XEXX010101000'];
  const allMatches = text.match(/[A-Z&Ñ]{3,4}\d{6}[A-Z0-9]{3}/gi);
  if (!allMatches) return undefined;

  const filtered = allMatches.filter(
    rfc => !GENERIC_RFCS.includes(rfc.toUpperCase()),
  );
  const best = filtered[0] ?? allMatches[0];
  return best?.toUpperCase();
}
