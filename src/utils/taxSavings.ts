import { Expense } from '../types/expense';
import { FiscalRegime } from '../store/usePremiumStore';

export interface TaxSavingsResult {
  monthlyDeductible: number;
  estimatedTaxSaving: number;
  yearToDate: number;
}

const TAX_RATES: Record<FiscalRegime, number> = {
  resico: 0.025,
  actividad_empresarial: 0.30,
  no_facturo: 0,
};

export function calculateTaxSavings(
  expenses: Expense[],
  regime: FiscalRegime,
): TaxSavingsResult {
  const rate = TAX_RATES[regime];
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const monthPrefix = `${y}-${m}`;
  const yearPrefix = `${y}-`;

  const monthlyDeductible = expenses
    .filter(e => e.deductible && e.date.startsWith(monthPrefix))
    .reduce((sum, e) => sum + e.amount, 0);

  const yearlyDeductible = expenses
    .filter(e => e.deductible && e.date.startsWith(yearPrefix))
    .reduce((sum, e) => sum + e.amount, 0);

  return {
    monthlyDeductible,
    estimatedTaxSaving: monthlyDeductible * rate,
    yearToDate: yearlyDeductible * rate,
  };
}
