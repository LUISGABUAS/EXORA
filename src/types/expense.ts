export type ExpenseCategory =
  | 'Comida'
  | 'Transporte'
  | 'Entretenimiento'
  | 'Salud'
  | 'Educacion'
  | 'Otros';

export type ExpenseSource = 'manual' | 'ocr';

export interface Expense {
  id: number;
  amount: number;
  date: string;
  category: ExpenseCategory;
  description: string;
  merchantName: string;
  conceptsText: string;
  ocrRawText: string;
  deductible: boolean;
  rfc: string;
  usoCFDI: string;
  source: ExpenseSource;
  createdAt: string;
}

export interface ExpenseInput {
  amount: number;
  date: string;
  category: ExpenseCategory;
  description: string;
  merchantName: string;
  conceptsText: string;
  ocrRawText: string;
  deductible: boolean;
  rfc: string;
  usoCFDI: string;
  source: ExpenseSource;
}

export interface ParsedReceiptData {
  amount?: number;
  date?: string;
  merchantName?: string;
  conceptsText?: string;
  rawText: string;
  suggestedCategory: ExpenseCategory;
  deductible: boolean;
  rfc?: string;
  usoCFDI?: string;
}
