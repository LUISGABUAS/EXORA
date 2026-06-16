import { Expense } from '../types/expense';
import { FiscalRegime } from '../store/usePremiumStore';

export function isValidMexicanRfc(rfc: string) {
  const clean = rfc.trim().toUpperCase();
  // Persona moral: 3 letras + 6 dígitos fecha + 3 alfanuméricos = 12
  // Persona física: 4 letras + 6 dígitos fecha + 3 alfanuméricos = 13
  return /^[A-Z&Ñ]{3,4}\d{6}[A-Z0-9]{3}$/.test(clean);
}

// ---------------------------------------------------------------------------
// Categorías siempre deducibles según el SAT (independiente de régimen)
// ---------------------------------------------------------------------------
const ALWAYS_DEDUCTIBLE_KEYWORDS = [
  'factura', 'cfdi', 'uuid', 'folio fiscal', 'regimen fiscal',
  'comprobante fiscal', 'xml', 'folio digital', 'sello digital',
  'certificado sat', 'comprobante de pago', 'nota de venta con cfdi',
];

// ---------------------------------------------------------------------------
// Deducciones personales — aplica a personas físicas (art. 151 ISR)
// Válidas para: resico, actividad_empresarial, sueldos_salarios,
//               arrendamiento, honorarios, incorporacion_fiscal
// ---------------------------------------------------------------------------
const PERSONAL_DEDUCTION_KEYWORDS: string[] = [
  // Salud
  'hospital', 'clinica', 'medico', 'doctor', 'consulta', 'consultorio',
  'farmacia', 'farmacia guadalajara', 'farmacias del ahorro', 'similares',
  'farmacias similares', 'benavides', 'salud digna', 'chopo', 'cruz verde',
  'laboratorio', 'dentista', 'dental', 'optica', 'lentes', 'oculista',
  'oftalmologo', 'psicologia', 'psiquiatra', 'nutriologo', 'terapia',
  'fisioterapia', 'medicamento', 'medicina', 'tratamiento', 'cirugia',
  'seguro de gastos medicos', 'seguro medico', 'imss', 'issste',
  'medica sur', 'medica abc', 'star medica', 'hospital angeles',
  'centro medico', 'ortodoncia', 'aparato dental', 'protesis',
  'audiologia', 'audifono', 'silla de ruedas', 'muleta',
  'analisis clinico', 'estudio medico', 'resonancia', 'tomografia', 'ultrasonido',
  'vacuna', 'vacunacion', 'pediatria', 'ginecologo', 'dermatologo',
  // Educación (colegiaturas — límites por nivel)
  'colegiatura', 'inscripcion escolar', 'matricula escolar',
  'kinder', 'preescolar', 'primaria', 'secundaria', 'preparatoria',
  'bachillerato', 'universidad', 'transporte escolar', 'guarderia',
  'estancia infantil', 'tec de monterrey', 'unam', 'ibero', 'anahuac',
  // Funerales
  'funeraria', 'funerales', 'servicio funerario',
  // Donativos
  'donativo', 'donacion',
  // Intereses hipotecarios
  'hipoteca', 'credito hipotecario', 'infonavit', 'fovissste',
  // Planes de retiro
  'afore', 'plan de retiro', 'pension', 'plan personal de retiro',
  // Primas de seguros
  'prima de seguro', 'seguro de vida', 'seguro de auto', 'seguro de gastos',
];

// ---------------------------------------------------------------------------
// Gastos deducibles para actividad empresarial / honorarios / RESICO
// (art. 103, 105 ISR — gastos estrictamente indispensables)
// ---------------------------------------------------------------------------
const BUSINESS_DEDUCTION_KEYWORDS: string[] = [
  // Tecnología y software
  'software', 'licencia', 'suscripcion', 'hosting', 'dominio',
  'google workspace', 'microsoft 365', 'office 365', 'adobe',
  'aws', 'azure', 'dropbox', 'notion', 'slack', 'zoom', 'figma',
  'github', 'gitlab', 'shopify', 'stripe', 'twilio', 'sendgrid',
  'canva', 'chatgpt', 'openai', 'claude', 'anthropic',
  // Telecom
  'telefono', 'celular', 'internet', 'telcel', 'att', 'telmex',
  'movistar', 'izzi', 'megacable', 'totalplay', 'plan de datos',
  // Papelería y oficina
  'papeleria', 'oficina', 'material de oficina', 'impresora',
  'toner', 'cartucho', 'folder', 'cuaderno', 'office depot', 'office max',
  // Transporte de negocios
  'uber', 'didi', 'taxi', 'gasolina', 'combustible', 'caseta', 'peaje',
  'estacionamiento', 'parking', 'aerolinea', 'volaris', 'aeromexico', 'vivaaerobus',
  'hotel', 'hospedaje', 'airbnb', 'viaticos',
  'hidrosina', 'pemex', 'shell', 'oxxo gas', 'g500',
  // Publicidad
  'publicidad', 'marketing', 'facebook ads', 'google ads', 'instagram ads',
  'meta ads', 'tiktok ads', 'campana publicitaria',
  // Servicios profesionales
  'contador', 'abogado', 'notario', 'consultor', 'honorarios',
  'servicio profesional', 'asesoria', 'despacho',
  // Renta
  'renta de oficina', 'coworking', 'renta local', 'renta bodega',
  'arrendamiento local', 'local comercial',
  // Equipos
  'laptop', 'computadora', 'monitor', 'teclado', 'mouse', 'camara',
  'microfono', 'audifonos', 'tablet', 'ipad', 'iphone', 'celular empresa',
  // Capacitación
  'capacitacion', 'curso', 'certificacion', 'entrenamiento empresarial',
];

// ---------------------------------------------------------------------------
// Inferencia principal
// ---------------------------------------------------------------------------
export function inferDeductibility(payload: {
  rawText: string;
  rfc?: string;
  usoCFDI?: string;
  merchantName?: string;
  regime?: FiscalRegime;
}): boolean {
  const text = `${payload.rawText} ${payload.merchantName || ''}`.toLowerCase();

  // 1. Siempre deducible si tiene keywords de factura electrónica
  const hasInvoiceKeywords = ALWAYS_DEDUCTIBLE_KEYWORDS.some(k => text.includes(k));
  if (hasInvoiceKeywords) return true;

  // 2. RFC + uso CFDI válidos → deducible
  const hasRfc = Boolean(payload.rfc && isValidMexicanRfc(payload.rfc));
  const hasUsoCfdi = Boolean(payload.usoCFDI?.trim());
  if (hasRfc && hasUsoCfdi) return true;

  const regime = payload.regime ?? 'no_facturo';

  // 3. Sin régimen fiscal → no aplicar deducciones automáticas
  if (regime === 'no_facturo') return false;

  // 4. Personas morales (régimen general) — solo gastos con factura
  if (regime === 'regimen_general') return false;

  // 5. Deducciones personales — todos los regímenes de persona física
  const hasPersonalDeduction = PERSONAL_DEDUCTION_KEYWORDS.some(k => text.includes(k));
  if (hasPersonalDeduction) return true;

  // 6. Gastos de negocio — solo para regímenes empresariales
  const businessRegimes: FiscalRegime[] = [
    'resico',
    'actividad_empresarial',
    'honorarios',
    'plataformas_digitales',
    'incorporacion_fiscal',
  ];
  if (businessRegimes.includes(regime)) {
    const hasBusinessDeduction = BUSINESS_DEDUCTION_KEYWORDS.some(k => text.includes(k));
    if (hasBusinessDeduction) return true;
  }

  return false;
}

export function monthlyDeductibleTotal(expenses: Expense[]) {
  const now = new Date();
  const month = now.getMonth();
  const year = now.getFullYear();
  return expenses
    .filter(e => {
      const [y, m] = e.date.slice(0, 7).split('-').map(Number);
      return e.deductible && m - 1 === month && y === year;
    })
    .reduce((sum, e) => sum + e.amount, 0);
}
