import { ParsedReceiptData } from '../types/expense';
import { classifyExpense } from './classifier';
import { inferDeductibility, isValidMexicanRfc } from './tax';

function findAmount(rawText: string) {
  const matches = rawText.match(/(?:total|importe|subtotal)[^\d]{0,8}(\d+[.,]\d{2})/gi);
  if (matches?.length) {
    const last = matches[matches.length - 1].match(/(\d+[.,]\d{2})/);
    return last ? Number(last[1].replace(',', '.')) : undefined;
  }
  const genericNumbers = rawText.match(/\d+[.,]\d{2}/g);
  if (!genericNumbers?.length) {
    return undefined;
  }
  const sorted = genericNumbers
    .map((v) => Number(v.replace(',', '.')))
    .filter((v) => !Number.isNaN(v))
    .sort((a, b) => b - a);
  return sorted[0];
}

function findDate(rawText: string) {
  // Try DD/MM/YYYY or DD-MM-YYYY first (common in MX receipts)
  const match = rawText.match(/(\d{2})[\/\-](\d{2})[\/\-](\d{2,4})/);
  if (!match) {
    return undefined;
  }
  const [, day, month, year] = match;
  const normalizedYear = year.length === 2 ? `20${year}` : year;
  // Validate day/month to detect MM/DD format
  const dayNum = Number(day);
  const monthNum = Number(month);
  if (monthNum > 12 && dayNum <= 12) {
    // Likely MM/DD — swap
    return `${normalizedYear}-${day.padStart(2, '0')}-${month.padStart(2, '0')}`;
  }
  return `${normalizedYear}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
}

function findMerchant(rawText: string) {
  const lines = rawText.split('\n').map((l) => l.trim()).filter(Boolean);
  return lines[0] ?? '';
}

function findRfc(rawText: string) {
  const match = rawText.match(/[A-Z&Ñ]{3,4}\d{6}[A-Z0-9]{3}/i);
  return match?.[0];
}

function findUsoCfdi(rawText: string) {
  const match = rawText.match(/(?:uso\s*cfdi|cfdi)[\s:]*([A-Z]\d{2})/i);
  return match?.[1]?.toUpperCase();
}

function findConcepts(rawText: string) {
  const lines = rawText.split('\n').map((l) => l.trim()).filter((l) => l.length > 3);
  return lines.slice(1, 5).join(', ');
}

export function parseReceiptText(rawText: string): ParsedReceiptData {
  const merchantName = findMerchant(rawText);
  const conceptsText = findConcepts(rawText);
  const rfc = findRfc(rawText) ?? '';
  const usoCFDI = findUsoCfdi(rawText) ?? '';
  const validRfc = isValidMexicanRfc(rfc) ? rfc : '';
  const suggestedCategory = classifyExpense(`${merchantName} ${conceptsText} ${rawText}`);
  const deductible = inferDeductibility({ rawText, merchantName, rfc: validRfc, usoCFDI });

  return {
    amount: findAmount(rawText),
    date: findDate(rawText),
    merchantName,
    conceptsText,
    rawText,
    suggestedCategory,
    deductible,
    rfc: validRfc,
    usoCFDI,
  };
}
