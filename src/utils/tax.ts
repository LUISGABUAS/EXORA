import { Expense } from '../types/expense';

export function isValidMexicanRfc(rfc: string) {
  return /^[A-Z&Ñ]{3,4}\d{6}[A-Z0-9]{3}$/i.test(rfc.trim());
}

export function inferDeductibility(payload: {
  rawText: string;
  rfc?: string;
  usoCFDI?: string;
  merchantName?: string;
}) {
  const text = `${payload.rawText} ${payload.merchantName || ''}`.toLowerCase();
  const hasInvoiceKeywords = ['factura', 'cfdi', 'iva', 'regimen fiscal', 'uuid', 'folio fiscal'].some(
    (keyword) => text.includes(keyword),
  );
  const hasRfc = Boolean(payload.rfc && isValidMexicanRfc(payload.rfc));
  const hasUsoCfdi = Boolean(payload.usoCFDI?.trim());
  return hasInvoiceKeywords || (hasRfc && hasUsoCfdi);
}

export function monthlyDeductibleTotal(expenses: Expense[]) {
  const now = new Date();
  const month = now.getMonth();
  const year = now.getFullYear();
  return expenses
    .filter((e) => {
      const [y, m] = e.date.slice(0, 7).split('-').map(Number);
      return e.deductible && m - 1 === month && y === year;
    })
    .reduce((sum, e) => sum + e.amount, 0);
}
