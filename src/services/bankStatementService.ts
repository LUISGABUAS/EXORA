import RNFS from 'react-native-fs';

const DocumentPicker = require('react-native-document-picker').default;

const OCR_API_KEY = 'K86586803988957';
const OCR_ENDPOINT = 'https://api.ocr.space/parse/image';

export interface BankTransaction {
  date: string;       // YYYY-MM-DD
  description: string;
  amount: number;     // always positive; isDebit tells direction
  isDebit: boolean;
  rawLine: string;
}

// ── Date helpers ──────────────────────────────────────────────────────────────

const MONTH_MAP: Record<string, string> = {
  ene: '01', feb: '02', mar: '03', abr: '04', may: '05', jun: '06',
  jul: '07', ago: '08', sep: '09', oct: '10', nov: '11', dic: '12',
  jan: '01', apr: '04', aug: '08',
};

function parseDate(raw: string): string | null {
  // DD/MM/YYYY or DD/MM/YY or DD-MM-YYYY
  const slash = raw.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/);
  if (slash) {
    const d = slash[1].padStart(2, '0');
    const m = slash[2].padStart(2, '0');
    const y = slash[3].length === 2 ? `20${slash[3]}` : slash[3];
    if (parseInt(m, 10) <= 12 && parseInt(d, 10) <= 31) {
      return `${y}-${m}-${d}`;
    }
  }
  // DD MMM YYYY or DD MMM YY  (15 MAY 26)
  const textDate = raw.match(/(\d{1,2})\s+([a-zA-ZáéíóúÁÉÍÓÚ]{3})\s+(\d{2,4})/i);
  if (textDate) {
    const d = textDate[1].padStart(2, '0');
    const mKey = textDate[2].toLowerCase().slice(0, 3);
    const m = MONTH_MAP[mKey];
    const y = textDate[3].length === 2 ? `20${textDate[3]}` : textDate[3];
    if (m) return `${y}-${m}-${d}`;
  }
  return null;
}

function parseAmount(raw: string): number | null {
  // Remove currency symbols and keep digits, commas, dots
  const cleaned = raw.replace(/[$\s]/g, '').replace(/,/g, '');
  const n = parseFloat(cleaned);
  return isNaN(n) || n <= 0 ? null : n;
}

// ── Main parser ───────────────────────────────────────────────────────────────

/**
 * Lines that look like transactions typically follow one of:
 *  DD/MM/YYYY  DESCRIPTION  AMOUNT
 *  DD/MM/YY    DESCRIPTION  AMOUNT  BALANCE
 *
 * Strategy: scan each line for a leading date + trailing amount.
 * If both present → transaction. Sign heuristic: "abono", "deposito", "CR" → credit.
 */
function parseTransactions(text: string): BankTransaction[] {
  const results: BankTransaction[] = [];
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);

  // Amount pattern at end-of-line (possibly followed by a balance)
  const amountRx = /([\d,]+\.\d{2})\s*(?:CR|DB|[\d,]+\.\d{2})?\s*$/i;
  const creditWords = /abono|deposito|depósito|nómina|nomina|pago recibido|transferencia recibida|\bCR\b/i;
  const skipWords = /saldo|balance|total|periodo|fecha|descripci[oó]n|monto|retiro|cargo|abono/i;

  for (const line of lines) {
    // Must have a date somewhere in the line
    const dateMatch = line.match(/\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}|\d{1,2}\s+[a-zA-Z]{3}\s+\d{2,4}/i);
    if (!dateMatch) continue;

    // Skip header/summary rows
    if (skipWords.test(line) && line.length < 60) continue;

    const date = parseDate(dateMatch[0]);
    if (!date) continue;

    // Amount at end
    const amtMatch = line.match(amountRx);
    if (!amtMatch) continue;
    const amount = parseAmount(amtMatch[1]);
    if (!amount || amount > 999_999) continue; // sanity cap

    // Description = everything between date and amount
    const afterDate = line.slice(dateMatch.index! + dateMatch[0].length);
    const amtIdx = afterDate.search(amountRx);
    const description = afterDate.slice(0, amtIdx).replace(/\s+/g, ' ').trim();
    if (!description || description.length < 2) continue;

    const isDebit = !creditWords.test(line);

    results.push({ date, description, amount, isDebit, rawLine: line });
  }

  // Deduplicate exact duplicates
  const seen = new Set<string>();
  return results.filter(t => {
    const key = `${t.date}|${t.description}|${t.amount}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// ── OCR via OCR.Space ─────────────────────────────────────────────────────────

async function extractTextFromPdf(fileUri: string): Promise<string> {
  const path = fileUri.startsWith('file://') ? fileUri.slice(7) : fileUri;
  const base64 = await RNFS.readFile(path, 'base64');

  const formData = new FormData();
  formData.append('base64Image', `data:application/pdf;base64,${base64}`);
  formData.append('isTable', 'false');
  formData.append('OCREngine', '2');
  formData.append('scale', 'true');
  formData.append('isCreateSearchablePdf', 'false');

  const response = await fetch(OCR_ENDPOINT, {
    method: 'POST',
    headers: { apikey: OCR_API_KEY },
    body: formData,
  });

  if (!response.ok) {
    throw new Error(`OCR falló: ${response.status}`);
  }

  const json = await response.json();
  if (json.IsErroredOnProcessing) {
    throw new Error(json.ErrorMessage?.[0] ?? 'Error al procesar PDF');
  }

  return (json.ParsedResults ?? [])
    .map((r: any) => r.ParsedText ?? '')
    .join('\n');
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Opens a document picker, extracts text via OCR.Space, returns parsed transactions.
 * Throws 'CANCELLED' if user cancels the picker.
 */
export async function importBankStatement(): Promise<BankTransaction[]> {
  let result: any;
  try {
    result = await DocumentPicker.pickSingle({
      type: DocumentPicker.types.pdf,
    });
  } catch (err: any) {
    if (
      DocumentPicker.isCancel(err) ||
      err?.code === 'DOCUMENT_PICKER_CANCELED' ||
      err?.message?.toLowerCase().includes('cancel')
    ) {
      throw new Error('CANCELLED');
    }
    throw err;
  }

  const text = await extractTextFromPdf(result.uri);
  if (!text.trim()) {
    throw new Error('No se pudo extraer texto del PDF. Asegúrate de que el estado de cuenta sea digital (no escaneado).');
  }

  const transactions = parseTransactions(text);
  if (transactions.length === 0) {
    throw new Error('No se detectaron transacciones. El formato del estado de cuenta puede no ser compatible aún.');
  }

  return transactions;
}
