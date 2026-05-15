import { FiscalRegime } from '../store/usePremiumStore';

export interface ConstanciaParseResult {
  success: boolean;
  rfc?: string;
  razonSocial?: string;
  fiscalRegime?: FiscalRegime;
  regimeSatCode?: string;
  regimeLabel?: string;
  error?: string;
}

export const SAT_CODE_TO_REGIME: Record<string, FiscalRegime> = {
  '601': 'regimen_general',
  '605': 'sueldos_salarios',
  '606': 'arrendamiento',
  '612': 'honorarios',
  '621': 'incorporacion_fiscal',
  '625': 'actividad_empresarial',
  '626': 'resico',
};

export const SAT_CODE_LABELS: Record<string, string> = {
  '601': 'General de Ley Personas Morales',
  '605': 'Sueldos y Salarios e Ingresos Asimilados',
  '606': 'Arrendamiento',
  '612': 'Personas Físicas con Actividades Empresariales y Profesionales',
  '621': 'Incorporación Fiscal',
  '625': 'Régimen de las Actividades Empresariales con ingresos a través de Plataformas Tecnológicas',
  '626': 'Régimen Simplificado de Confianza',
};

export interface FiscalRegimeDisplay {
  value: FiscalRegime;
  icon: string;
  title: string;
  desc: string;
  satCode?: string;
  isPrimary: boolean;
}

export const FISCAL_REGIME_DISPLAY: FiscalRegimeDisplay[] = [
  {
    value: 'resico',
    icon: 'account-check',
    title: 'RESICO',
    desc: 'Régimen Simplificado de Confianza',
    satCode: '626',
    isPrimary: true,
  },
  {
    value: 'actividad_empresarial',
    icon: 'briefcase-outline',
    title: 'Actividad Empresarial',
    desc: 'Freelancers y profesionistas independientes',
    satCode: '625',
    isPrimary: true,
  },
  {
    value: 'no_facturo',
    icon: 'wallet-outline',
    title: 'No facturo',
    desc: 'Solo quiero controlar mis gastos',
    isPrimary: true,
  },
  {
    value: 'sueldos_salarios',
    icon: 'account-tie',
    title: 'Sueldos y Salarios',
    desc: 'Empleados con nómina',
    satCode: '605',
    isPrimary: false,
  },
  {
    value: 'arrendamiento',
    icon: 'home-city-outline',
    title: 'Arrendamiento',
    desc: 'Renta de inmuebles',
    satCode: '606',
    isPrimary: false,
  },
  {
    value: 'honorarios',
    icon: 'school-outline',
    title: 'Honorarios',
    desc: 'Personas físicas con actividad profesional',
    satCode: '612',
    isPrimary: false,
  },
  {
    value: 'plataformas_digitales',
    icon: 'cellphone-link',
    title: 'Plataformas Digitales',
    desc: 'Ingresos por apps y plataformas',
    satCode: '625',
    isPrimary: false,
  },
  {
    value: 'regimen_general',
    icon: 'domain',
    title: 'Régimen General',
    desc: 'Personas morales',
    satCode: '601',
    isPrimary: false,
  },
  {
    value: 'incorporacion_fiscal',
    icon: 'store-outline',
    title: 'Incorporación Fiscal',
    desc: 'RIF (régimen transitorio)',
    satCode: '621',
    isPrimary: false,
  },
];
