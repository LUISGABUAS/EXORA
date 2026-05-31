// RESICO: 1% monthly on gross income
// ISR reduction: deductible expenses reduce taxable base
// Returns estimated monthly tax and potential savings

import { FiscalRegime } from '../store/usePremiumStore';

// Tasa efectiva de ahorro fiscal por régimen (conservadora)
const SAVINGS_RATE: Record<FiscalRegime, number> = {
  resico:                  0.01,   // 1% tasa RESICO sobre deducibles
  actividad_empresarial:   0.25,   // ISR ~25% sobre base reducida
  honorarios:              0.25,
  plataformas_digitales:   0.20,
  arrendamiento:           0.30,
  incorporacion_fiscal:    0.10,
  regimen_general:         0.30,
  sueldos_salarios:        0.10,
  no_facturo:              0,
};

export function estimateTaxSavings(deductibleAmount: number, regime: FiscalRegime): number {
  return deductibleAmount * (SAVINGS_RATE[regime] ?? 0);
}

// Descripción de la tasa para mostrarsela al usuario
export function savingsRateLabel(regime: FiscalRegime): string {
  const rate = SAVINGS_RATE[regime] ?? 0;
  if (rate === 0) return '';
  return `${(rate * 100).toFixed(0)}% de tus deducibles`;
}

export interface ResicoResult {
  grossIncome: number;
  deductibleExpenses: number;
  taxableBase: number;
  estimatedTax: number;       // 1% of grossIncome (simplified)
  potentialSaving: number;    // deductibleExpenses * 0.01 (simplified)
  effectiveRate: number;      // %
}

export function calculateResico(grossIncome: number, deductibleExpenses: number): ResicoResult {
  const taxableBase = Math.max(0, grossIncome - deductibleExpenses);
  const estimatedTax = grossIncome * 0.01; // 1% gross (RESICO simplified)
  const potentialSaving = deductibleExpenses * 0.01;
  const effectiveRate = grossIncome > 0 ? (estimatedTax / grossIncome) * 100 : 0;
  return { grossIncome, deductibleExpenses, taxableBase, estimatedTax, potentialSaving, effectiveRate };
}

// ISR table for other regimes (simplified brackets for 2024)
export function calculateISR(monthlyIncome: number): number {
  const annual = monthlyIncome * 12;
  if (annual <= 8952.49) return 0;
  if (annual <= 21181.26) return annual * 0.064;
  if (annual <= 37380.69) return annual * 0.1088;
  if (annual <= 75000) return annual * 0.16;
  if (annual <= 160000) return annual * 0.2152;
  if (annual <= 260000) return annual * 0.2352;
  if (annual <= 392841.97) return annual * 0.30;
  return annual * 0.32;
}
