import { parseConstanciaText, validateIsConstancia } from '../constanciaService';

// ═══════════════════════════════════════════
// FIXTURES
// ═══════════════════════════════════════════

const SAMPLE_CONSTANCIA = `
SERVICIO DE ADMINISTRACIÓN TRIBUTARIA
Constancia de Situación Fiscal
Régimen Fiscal

RFC: GALL850101ABC
Nombre(s): LUIS FELIPE
Apellido Paterno: GARCIA
Apellido Materno: LOPEZ
Nombre, denominación o razón social: LUIS FELIPE GARCIA LOPEZ

Régimen: 626 - Régimen Simplificado de Confianza
CURP: GALL850101HDFRLS01
`.trim();

const SAMPLE_CONSTANCIA_EMPRESA = `
SERVICIO DE ADMINISTRACIÓN TRIBUTARIA
Constancia de Situación Fiscal

RFC: ABC120315XY9
Nombre, denominación o razón social: EMPRESA MEXICANA SA DE CV

Régimen: 601 - General de Ley Personas Morales
Domicilio fiscal: Ciudad de México
`.trim();

const SAMPLE_CONSTANCIA_SUELDOS = `
Servicio de Administración Tributaria
Constancia de Situación Fiscal
Registro Federal de Contribuyentes

RFC: MAPE900520QR3
Nombre(s): MARIA
Apellido Paterno: PEREZ
Apellido Materno: MARTINEZ

Régimen: 605 - Sueldos y Salarios e Ingresos Asimilados a Salarios
`.trim();

const SAMPLE_CONSTANCIA_ARRENDAMIENTO = `
Servicio de Administración Tributaria
Constancia de Situación Fiscal
Registro Federal

RFC: ROCA880101AB1
Razón social: ROBERTO CASTILLO AVILA
Régimen: 606 - Arrendamiento
`.trim();

const SAMPLE_CONSTANCIA_HONORARIOS = `
Servicio de Administración Tributaria
Constancia de Situación Fiscal

RFC: LOHJ790215CD2
Nombre(s): JORGE
Apellido Paterno: LOPEZ
Apellido Materno: HERNANDEZ
612 - Personas Físicas con Actividades Empresariales y Profesionales
`.trim();

const SAMPLE_CONSTANCIA_RIF = `
Servicio de Administración Tributaria
Situación Fiscal
Régimen

RFC: SARM860101EF3
Razón social: SANDRA RAMIREZ MORENO
621 - Incorporación Fiscal
`.trim();

const SAMPLE_CONSTANCIA_PLATAFORMAS = `
Servicio de Administración Tributaria
Constancia de Situación Fiscal

RFC: GOHM950101GH4
Nombre(s): MIGUEL
Apellido Paterno: GONZALEZ
625 - Régimen de las Actividades Empresariales con ingresos a través de Plataformas Tecnológicas
`.trim();

const NOT_A_CONSTANCIA = `
Factura electrónica CFDI
Folio: 12345
Total: $500.00
`;

const RANDOM_TEXT = 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt.';

// ═══════════════════════════════════════════
// validateIsConstancia
// ═══════════════════════════════════════════

describe('validateIsConstancia', () => {
  it('returns true for valid SAT constancia text', () => {
    expect(validateIsConstancia(SAMPLE_CONSTANCIA)).toBe(true);
  });

  it('returns true for empresa constancia', () => {
    expect(validateIsConstancia(SAMPLE_CONSTANCIA_EMPRESA)).toBe(true);
  });

  it('returns false for empty text', () => {
    expect(validateIsConstancia('')).toBe(false);
  });

  it('returns false for short text', () => {
    expect(validateIsConstancia('RFC: ABC')).toBe(false);
  });

  it('returns false for random text without SAT keywords', () => {
    expect(validateIsConstancia(RANDOM_TEXT)).toBe(false);
  });

  it('returns false for CFDI that is not a constancia', () => {
    expect(validateIsConstancia(NOT_A_CONSTANCIA)).toBe(false);
  });

  it('returns true when text has accent variants', () => {
    const text = 'Servicio de Administracion Tributaria - situacion fiscal del contribuyente con regimen fiscal activo en el SAT';
    expect(validateIsConstancia(text)).toBe(true);
  });
});

// ═══════════════════════════════════════════
// parseConstanciaText — RFC extraction
// ═══════════════════════════════════════════

describe('parseConstanciaText — RFC', () => {
  it('extracts RFC from labeled line', () => {
    const result = parseConstanciaText(SAMPLE_CONSTANCIA);
    expect(result.success).toBe(true);
    expect(result.rfc).toBe('GALL850101ABC');
  });

  it('extracts RFC from empresa constancia', () => {
    const result = parseConstanciaText(SAMPLE_CONSTANCIA_EMPRESA);
    expect(result.success).toBe(true);
    expect(result.rfc).toBe('ABC120315XY9');
  });

  it('extracts 4-letter RFC (persona moral)', () => {
    const result = parseConstanciaText(SAMPLE_CONSTANCIA_EMPRESA);
    expect(result.rfc).toMatch(/^[A-Z&Ñ]{3}\d{6}[A-Z0-9]{3}$/i);
  });

  it('extracts RFC from sueldos constancia', () => {
    const result = parseConstanciaText(SAMPLE_CONSTANCIA_SUELDOS);
    expect(result.rfc).toBe('MAPE900520QR3');
  });

  it('extracts RFC with label "RFC:"', () => {
    const text = 'Situación Fiscal\nRégimen\nRFC: XAXX010101000\nNombre: Test';
    const result = parseConstanciaText(text);
    expect(result.rfc).toBe('XAXX010101000');
  });

  it('returns success false for empty text', () => {
    const result = parseConstanciaText('');
    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });

  it('returns success false for text without RFC or regime', () => {
    const result = parseConstanciaText('Just some random text here with no useful data at all');
    expect(result.success).toBe(false);
  });
});

// ═══════════════════════════════════════════
// parseConstanciaText — Razón Social
// ═══════════════════════════════════════════

describe('parseConstanciaText — Razón Social', () => {
  it('extracts razón social from labeled line', () => {
    const result = parseConstanciaText(SAMPLE_CONSTANCIA_EMPRESA);
    expect(result.razonSocial).toBe('EMPRESA MEXICANA SA DE CV');
  });

  it('builds name from Nombre + Apellidos', () => {
    const result = parseConstanciaText(SAMPLE_CONSTANCIA);
    expect(result.razonSocial).toContain('LUIS FELIPE');
    expect(result.razonSocial).toContain('GARCIA');
  });

  it('extracts razón social from arrendamiento constancia', () => {
    const result = parseConstanciaText(SAMPLE_CONSTANCIA_ARRENDAMIENTO);
    expect(result.razonSocial).toBe('ROBERTO CASTILLO AVILA');
  });
});

// ═══════════════════════════════════════════
// parseConstanciaText — Régimen detection
// ═══════════════════════════════════════════

describe('parseConstanciaText — Régimen', () => {
  it('detects RESICO (626)', () => {
    const result = parseConstanciaText(SAMPLE_CONSTANCIA);
    expect(result.fiscalRegime).toBe('resico');
    expect(result.regimeSatCode).toBe('626');
  });

  it('detects Régimen General (601)', () => {
    const result = parseConstanciaText(SAMPLE_CONSTANCIA_EMPRESA);
    expect(result.fiscalRegime).toBe('regimen_general');
    expect(result.regimeSatCode).toBe('601');
  });

  it('detects Sueldos y Salarios (605)', () => {
    const result = parseConstanciaText(SAMPLE_CONSTANCIA_SUELDOS);
    expect(result.fiscalRegime).toBe('sueldos_salarios');
    expect(result.regimeSatCode).toBe('605');
  });

  it('detects Arrendamiento (606)', () => {
    const result = parseConstanciaText(SAMPLE_CONSTANCIA_ARRENDAMIENTO);
    expect(result.fiscalRegime).toBe('arrendamiento');
    expect(result.regimeSatCode).toBe('606');
  });

  it('detects Honorarios (612)', () => {
    const result = parseConstanciaText(SAMPLE_CONSTANCIA_HONORARIOS);
    expect(result.fiscalRegime).toBe('honorarios');
    expect(result.regimeSatCode).toBe('612');
  });

  it('detects Incorporación Fiscal (621)', () => {
    const result = parseConstanciaText(SAMPLE_CONSTANCIA_RIF);
    expect(result.fiscalRegime).toBe('incorporacion_fiscal');
    expect(result.regimeSatCode).toBe('621');
  });

  it('detects Plataformas Digitales (625)', () => {
    const result = parseConstanciaText(SAMPLE_CONSTANCIA_PLATAFORMAS);
    expect(result.fiscalRegime).toBe('plataformas_digitales');
    expect(result.regimeSatCode).toBe('625');
  });

  it('falls back to description matching when no SAT code', () => {
    const text = 'Situación Fiscal\nRégimen\nRFC: GALL850101ABC\nRégimen Simplificado de Confianza';
    const result = parseConstanciaText(text);
    expect(result.fiscalRegime).toBe('resico');
  });

  it('includes regime label when detected', () => {
    const result = parseConstanciaText(SAMPLE_CONSTANCIA);
    expect(result.regimeLabel).toBeDefined();
    expect(result.regimeLabel).toContain('Simplificado');
  });
});

// ═══════════════════════════════════════════
// parseConstanciaText — Edge cases
// ═══════════════════════════════════════════

describe('parseConstanciaText — Edge cases', () => {
  it('handles text with only RFC (no regime)', () => {
    const text = 'Documento SAT\nRFC: XAXX010101000\nAlgunos datos';
    const result = parseConstanciaText(text);
    expect(result.success).toBe(true);
    expect(result.rfc).toBe('XAXX010101000');
    expect(result.fiscalRegime).toBeUndefined();
  });

  it('handles text with only regime (no RFC)', () => {
    const text = 'Constancia SAT\n626 - Régimen Simplificado de Confianza\nOtros datos aqui';
    const result = parseConstanciaText(text);
    expect(result.success).toBe(true);
    expect(result.fiscalRegime).toBe('resico');
  });

  it('handles garbled text gracefully', () => {
    const text = 'asdkjh@@##$$%%&&';
    const result = parseConstanciaText(text);
    expect(result.success).toBe(false);
  });

  it('handles multiple RFC patterns — picks first valid', () => {
    const text = 'RFC: GALL850101ABC\nOtro RFC: XAXX010101000';
    const result = parseConstanciaText(text);
    expect(result.rfc).toBe('GALL850101ABC');
  });
});
