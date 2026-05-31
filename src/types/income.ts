export type IncomeType =
  | 'honorarios'
  | 'nomina'
  | 'plataformas'
  | 'arrendamiento'
  | 'rendimientos'
  | 'otros';

export interface Income {
  id: number;
  amount: number;
  date: string;          // YYYY-MM-DD
  type: IncomeType;
  description: string;
  invoiced: boolean;     // ¿Emitiste CFDI por este ingreso?
  createdAt: string;
}

export type IncomeInput = Omit<Income, 'id' | 'createdAt'>;

export const INCOME_TYPE_LABELS: Record<IncomeType, string> = {
  honorarios:    'Honorarios / Facturas',
  nomina:        'Nómina / Salario',
  plataformas:   'Plataformas digitales',
  arrendamiento: 'Arrendamiento',
  rendimientos:  'Rendimientos / Intereses',
  otros:         'Otros ingresos',
};

export const INCOME_TYPE_ICONS: Record<IncomeType, string> = {
  honorarios:    'file-document-check-outline',
  nomina:        'office-building-outline',
  plataformas:   'cellphone',
  arrendamiento: 'home-outline',
  rendimientos:  'trending-up',
  otros:         'cash-plus',
};

export const INCOME_TYPE_COLORS: Record<IncomeType, string> = {
  honorarios:    '#22C55E',
  nomina:        '#3B82F6',
  plataformas:   '#F59E0B',
  arrendamiento: '#8B5CF6',
  rendimientos:  '#06B6D4',
  otros:         '#8E8E93',
};
