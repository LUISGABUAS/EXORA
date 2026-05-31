/**
 * Converts Spanish number words to digits within a string.
 * e.g. "ciento cincuenta pesos uber" → "150 pesos uber"
 */

const ONES: Record<string, number> = {
  cero: 0, un: 1, uno: 1, una: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5,
  seis: 6, siete: 7, ocho: 8, nueve: 9, diez: 10, once: 11, doce: 12,
  trece: 13, catorce: 14, quince: 15, dieciséis: 16, dieciseis: 16,
  diecisiete: 17, dieciocho: 18, diecinueve: 19, veinte: 20,
  veintiuno: 21, veintiuna: 21, veintidós: 22, veintidos: 22,
  veintitrés: 23, veintitres: 23, veinticuatro: 24, veinticinco: 25,
  veintiséis: 26, veintiseis: 26, veintisiete: 27, veintiocho: 28,
  veintinueve: 29,
};

const TENS: Record<string, number> = {
  treinta: 30, cuarenta: 40, cincuenta: 50, sesenta: 60,
  setenta: 70, ochenta: 80, noventa: 90,
};

const HUNDREDS: Record<string, number> = {
  cien: 100, ciento: 100,
  doscientos: 200, doscientas: 200,
  trescientos: 300, trescientas: 300,
  cuatrocientos: 400, cuatrocientas: 400,
  quinientos: 500, quinientas: 500,
  seiscientos: 600, seiscientas: 600,
  setecientos: 700, setecientas: 700,
  ochocientos: 800, ochocientas: 800,
  novecientos: 900, novecientas: 900,
};

/**
 * Parses a sequence of Spanish number words from `tokens` starting at `pos`.
 * Returns { value, consumed } or null if no number found.
 */
function parseNumber(tokens: string[], pos: number): { value: number; consumed: number } | null {
  let value = 0;
  let consumed = 0;
  let i = pos;

  // Thousands: "X mil"
  let milMultiplier = 0;
  let milConsumed = 0;

  // Try to get a pre-"mil" number
  const preMillResult = parseUpTo999(tokens, i);
  if (preMillResult && tokens[i + preMillResult.consumed] === 'mil') {
    milMultiplier = preMillResult.value === 0 ? 1 : preMillResult.value;
    milConsumed = preMillResult.consumed + 1; // +1 for "mil"
  } else if (tokens[i] === 'mil') {
    milMultiplier = 1;
    milConsumed = 1;
  }

  if (milMultiplier > 0) {
    value += milMultiplier * 1000;
    consumed += milConsumed;
    i += milConsumed;
  }

  // Remainder (0-999)
  const rest = parseUpTo999(tokens, i);
  if (rest && rest.value > 0) {
    value += rest.value;
    consumed += rest.consumed;
  }

  if (consumed === 0) return null;
  return { value, consumed };
}

function parseUpTo999(tokens: string[], pos: number): { value: number; consumed: number } | null {
  let value = 0;
  let consumed = 0;
  let i = pos;

  // Hundreds
  if (tokens[i] && HUNDREDS[tokens[i]] !== undefined) {
    value += HUNDREDS[tokens[i]];
    consumed++;
    i++;
  }

  // Tens
  if (tokens[i] && TENS[tokens[i]] !== undefined) {
    value += TENS[tokens[i]];
    consumed++;
    i++;
    // "y" connector: "treinta y uno"
    if (tokens[i] === 'y' && tokens[i + 1] && ONES[tokens[i + 1]] !== undefined) {
      value += ONES[tokens[i + 1]];
      consumed += 2;
      i += 2;
    }
  } else if (tokens[i] && ONES[tokens[i]] !== undefined) {
    value += ONES[tokens[i]];
    consumed++;
    i++;
  }

  if (consumed === 0) return null;
  return { value, consumed };
}

/**
 * Converts Spanish number words to digits in a string.
 * Non-number words are preserved as-is.
 */
export function convertSpanishNumbers(text: string): string {
  // Normalize: remove accents for matching, but preserve original
  const normalized = text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

  const originalTokens = text.split(/\s+/);
  const tokens = normalized.split(/\s+/);

  const result: string[] = [];
  let i = 0;

  while (i < tokens.length) {
    const parsed = parseNumber(tokens, i);
    if (parsed && parsed.consumed > 0) {
      result.push(String(parsed.value));
      i += parsed.consumed;
    } else {
      result.push(originalTokens[i]);
      i++;
    }
  }

  return result.join(' ');
}
