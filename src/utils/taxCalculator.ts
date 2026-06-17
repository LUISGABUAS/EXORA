import { FiscalRegime } from '../store/usePremiumStore';

// ── Tasa efectiva de ahorro fiscal por régimen ──────────────────────────────
const SAVINGS_RATE: Record<FiscalRegime, number> = {
  resico:                0.01,
  actividad_empresarial: 0.25,
  honorarios:            0.25,
  plataformas_digitales: 0.20,
  arrendamiento:         0.30,
  incorporacion_fiscal:  0.10,
  regimen_general:       0.30,
  sueldos_salarios:      0.10,
  no_facturo:            0,
};

export function estimateTaxSavings(deductibleAmount: number, regime: FiscalRegime): number {
  return deductibleAmount * (SAVINGS_RATE[regime] ?? 0);
}

export function savingsRateLabel(regime: FiscalRegime): string {
  const rate = SAVINGS_RATE[regime] ?? 0;
  if (rate === 0) return '';
  return `${(rate * 100).toFixed(0)}% de tus deducibles`;
}

// ── Tabla ISR mensual 2024 (personas físicas) ───────────────────────────────
interface ISRBracket {
  lower: number;
  upper: number;
  fixedFee: number;
  rate: number;
}

const ISR_MONTHLY_TABLE: ISRBracket[] = [
  { lower: 0.01,      upper: 746.04,    fixedFee: 0,       rate: 0.0192 },
  { lower: 746.05,    upper: 6332.05,   fixedFee: 14.32,   rate: 0.0640 },
  { lower: 6332.06,   upper: 11128.01,  fixedFee: 371.83,  rate: 0.1088 },
  { lower: 11128.02,  upper: 12935.82,  fixedFee: 893.63,  rate: 0.1600 },
  { lower: 12935.83,  upper: 15487.71,  fixedFee: 1182.88, rate: 0.1792 },
  { lower: 15487.72,  upper: 31236.49,  fixedFee: 1640.18, rate: 0.2136 },
  { lower: 31236.50,  upper: 49233.00,  fixedFee: 5004.12, rate: 0.2352 },
  { lower: 49233.01,  upper: 93993.90,  fixedFee: 9236.89, rate: 0.3000 },
  { lower: 93993.91,  upper: 125325.20, fixedFee: 22665.17,rate: 0.3200 },
  { lower: 125325.21, upper: 375975.61, fixedFee: 32691.18,rate: 0.3400 },
  { lower: 375975.62, upper: Infinity,  fixedFee: 117912.32,rate: 0.3500 },
];

export function calculateISRMonthly(monthlyIncome: number): number {
  for (const bracket of ISR_MONTHLY_TABLE) {
    if (monthlyIncome >= bracket.lower && monthlyIncome <= bracket.upper) {
      const excess = monthlyIncome - bracket.lower;
      return bracket.fixedFee + (excess * bracket.rate);
    }
  }
  return 0;
}

// ── Resultado unificado ──────────────────────────────────────────────────────
export interface TaxResult {
  regime: FiscalRegime;
  grossIncome: number;
  deductibleExpenses: number;
  taxableBase: number;
  estimatedTax: number;
  potentialSaving: number;
  effectiveRate: number;
  breakdown: Array<{ label: string; value: number; isHighlight?: boolean; isGreen?: boolean }>;
  tip: string;
}

export function calculateTax(
  grossIncome: number,
  deductibleExpenses: number,
  regime: FiscalRegime,
): TaxResult {
  switch (regime) {

    case 'resico': {
      const taxableBase = Math.max(0, grossIncome - deductibleExpenses);
      const estimatedTax = grossIncome * 0.01;
      const potentialSaving = deductibleExpenses * 0.01;
      return {
        regime, grossIncome, deductibleExpenses, taxableBase,
        estimatedTax, potentialSaving,
        effectiveRate: grossIncome > 0 ? (estimatedTax / grossIncome) * 100 : 0,
        breakdown: [
          { label: 'Ingreso bruto', value: grossIncome },
          { label: 'Deducibles', value: deductibleExpenses },
          { label: 'Base imponible', value: taxableBase },
          { label: 'ISR RESICO (1%)', value: estimatedTax, isHighlight: true },
          { label: 'Ahorro por deducibles', value: potentialSaving, isGreen: true },
        ],
        tip: 'RESICO aplica una tasa del 1% sobre tus ingresos brutos. Cada $100 deducible te ahorra $1 en impuestos.',
      };
    }

    case 'honorarios':
    case 'actividad_empresarial': {
      const taxableBase = Math.max(0, grossIncome - deductibleExpenses);
      const isrBase = calculateISRMonthly(taxableBase);
      // Pago provisional: 100% del ISR calculado
      const estimatedTax = isrBase;
      const isrFull = calculateISRMonthly(grossIncome);
      const potentialSaving = Math.max(0, isrFull - isrBase);
      return {
        regime, grossIncome, deductibleExpenses, taxableBase,
        estimatedTax, potentialSaving,
        effectiveRate: grossIncome > 0 ? (estimatedTax / grossIncome) * 100 : 0,
        breakdown: [
          { label: 'Ingreso bruto', value: grossIncome },
          { label: 'Gastos deducibles', value: deductibleExpenses },
          { label: 'Base gravable', value: taxableBase },
          { label: 'Pago provisional ISR', value: estimatedTax, isHighlight: true },
          { label: 'Ahorro por deducciones', value: potentialSaving, isGreen: true },
        ],
        tip: regime === 'honorarios'
          ? 'Como honorarios, tu pago provisional ISR se calcula sobre ingresos menos gastos estrictamente indispensables.'
          : 'En Actividad Empresarial puedes deducir todos los gastos relacionados con tu negocio para reducir tu base gravable.',
      };
    }

    case 'arrendamiento': {
      // Opción ciega: 35% de deducción sobre ingresos sin comprobar gastos
      const blindDeduction = grossIncome * 0.35;
      const taxableBase = Math.max(0, grossIncome - Math.max(deductibleExpenses, blindDeduction));
      const estimatedTax = calculateISRMonthly(taxableBase);
      const taxWithoutDeduction = calculateISRMonthly(grossIncome);
      const potentialSaving = Math.max(0, taxWithoutDeduction - estimatedTax);
      const usedDeduction = Math.max(deductibleExpenses, blindDeduction);
      return {
        regime, grossIncome, deductibleExpenses, taxableBase,
        estimatedTax, potentialSaving,
        effectiveRate: grossIncome > 0 ? (estimatedTax / grossIncome) * 100 : 0,
        breakdown: [
          { label: 'Ingreso por renta', value: grossIncome },
          { label: deductibleExpenses > blindDeduction ? 'Gastos comprobados' : 'Deducción ciega (35%)', value: usedDeduction },
          { label: 'Base gravable', value: taxableBase },
          { label: 'Pago provisional ISR', value: estimatedTax, isHighlight: true },
          { label: 'Ahorro vs sin deducción', value: potentialSaving, isGreen: true },
        ],
        tip: 'En arrendamiento puedes usar la deducción ciega del 35% sin comprobar gastos, o deducir gastos reales si son mayores.',
      };
    }

    case 'plataformas_digitales': {
      // Tasa de retención promedio plataformas: 2.1% - 10%
      const retencion = grossIncome * 0.04; // promedio aproximado
      const taxableBase = Math.max(0, grossIncome - deductibleExpenses);
      const isrEstimado = calculateISRMonthly(taxableBase);
      const estimatedTax = Math.max(retencion, isrEstimado * 0.5);
      const potentialSaving = deductibleExpenses * 0.10;
      return {
        regime, grossIncome, deductibleExpenses, taxableBase,
        estimatedTax, potentialSaving,
        effectiveRate: grossIncome > 0 ? (estimatedTax / grossIncome) * 100 : 0,
        breakdown: [
          { label: 'Ingreso por plataformas', value: grossIncome },
          { label: 'Gastos deducibles', value: deductibleExpenses },
          { label: 'Retención estimada (4%)', value: retencion },
          { label: 'ISR a pagar estimado', value: estimatedTax, isHighlight: true },
          { label: 'Ahorro por deducciones', value: potentialSaving, isGreen: true },
        ],
        tip: 'Las plataformas retienen entre 2.1% y 10% dependiendo del servicio. Puedes compensar esa retención con gastos deducibles.',
      };
    }

    case 'sueldos_salarios': {
      const estimatedTax = calculateISRMonthly(grossIncome);
      const potentialSaving = 0; // El patrón retiene, no hay deducibles directos
      return {
        regime, grossIncome, deductibleExpenses: 0, taxableBase: grossIncome,
        estimatedTax, potentialSaving,
        effectiveRate: grossIncome > 0 ? (estimatedTax / grossIncome) * 100 : 0,
        breakdown: [
          { label: 'Salario bruto mensual', value: grossIncome },
          { label: 'ISR estimado retenido', value: estimatedTax, isHighlight: true },
          { label: 'Salario neto estimado', value: Math.max(0, grossIncome - estimatedTax), isGreen: true },
        ],
        tip: 'Tu patrón retiene el ISR automáticamente. Puedes recuperar parte con la declaración anual si tienes deducciones personales (médicos, colegiaturas, etc.).',
      };
    }

    case 'incorporacion_fiscal': {
      // RIF: reducción del 100% año 1, 90% año 2... hasta 10% año 10
      const taxableBase = Math.max(0, grossIncome - deductibleExpenses);
      const isrBase = calculateISRMonthly(taxableBase);
      // Asumimos año promedio con 50% de reducción
      const estimatedTax = isrBase * 0.50;
      const potentialSaving = isrBase * 0.50;
      return {
        regime, grossIncome, deductibleExpenses, taxableBase,
        estimatedTax, potentialSaving,
        effectiveRate: grossIncome > 0 ? (estimatedTax / grossIncome) * 100 : 0,
        breakdown: [
          { label: 'Ingreso bruto', value: grossIncome },
          { label: 'Deducciones', value: deductibleExpenses },
          { label: 'ISR sin reducción', value: isrBase },
          { label: 'ISR con reducción RIF (est.)', value: estimatedTax, isHighlight: true },
          { label: 'Beneficio por reducción RIF', value: potentialSaving, isGreen: true },
        ],
        tip: 'El RIF aplica una reducción del ISR que va del 100% en el año 1 hasta el 10% en el año 10. Verifica tu porcentaje actual en el SAT.',
      };
    }

    case 'regimen_general': {
      const taxableBase = Math.max(0, grossIncome - deductibleExpenses);
      const estimatedTax = taxableBase * 0.30; // ISR personas morales 30%
      const potentialSaving = deductibleExpenses * 0.30;
      return {
        regime, grossIncome, deductibleExpenses, taxableBase,
        estimatedTax, potentialSaving,
        effectiveRate: grossIncome > 0 ? (estimatedTax / grossIncome) * 100 : 0,
        breakdown: [
          { label: 'Ingresos', value: grossIncome },
          { label: 'Gastos deducibles', value: deductibleExpenses },
          { label: 'Utilidad fiscal', value: taxableBase },
          { label: 'ISR (30%)', value: estimatedTax, isHighlight: true },
          { label: 'Ahorro por deducciones', value: potentialSaving, isGreen: true },
        ],
        tip: 'Personas morales pagan 30% sobre utilidad fiscal. Maximiza deducciones para reducir la base gravable.',
      };
    }

    default: {
      return {
        regime, grossIncome, deductibleExpenses, taxableBase: grossIncome,
        estimatedTax: 0, potentialSaving: 0, effectiveRate: 0,
        breakdown: [],
        tip: 'Configura tu régimen fiscal en Perfil → Configuración para calcular tus impuestos.',
      };
    }
  }
}

// Mantener compatibilidad con código existente
export interface ResicoResult {
  grossIncome: number;
  deductibleExpenses: number;
  taxableBase: number;
  estimatedTax: number;
  potentialSaving: number;
  effectiveRate: number;
}

export function calculateResico(grossIncome: number, deductibleExpenses: number): ResicoResult {
  const result = calculateTax(grossIncome, deductibleExpenses, 'resico');
  return {
    grossIncome: result.grossIncome,
    deductibleExpenses: result.deductibleExpenses,
    taxableBase: result.taxableBase,
    estimatedTax: result.estimatedTax,
    potentialSaving: result.potentialSaving,
    effectiveRate: result.effectiveRate,
  };
}

export function calculateISR(monthlyIncome: number): number {
  return calculateISRMonthly(monthlyIncome);
}
