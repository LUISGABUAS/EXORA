/**
 * Tests de entrenamiento del parser de tickets mexicanos.
 *
 * Cada test simula texto OCR real con errores típicos:
 * - Espacios extra, caracteres mal leídos
 * - Líneas separadas (TOTAL en una línea, monto en otra)
 * - Formatos variados de precios ($1,234.56, 1234.56, $ 1234)
 * - Nombres de comercios con decoraciones, RFC, direcciones
 */

import { parseReceiptText } from '../receiptParser';

// ─── TICKET 1: OXXO típico ───
const OXXO_TICKET = `
****************************************
CADENA COMERCIAL OXXO S.A. DE C.V.
RFC: CCO8605231N4
TIENDA 12345 - SUC REFORMA
AV REFORMA 123 COL JUAREZ
MEXICO D.F. C.P. 06600
TEL (55) 5555-1234
****************************************
FECHA: 15/03/2024  HORA: 14:32

COCA COLA 600ML         $18.00
SABRITAS SAL 45G        $15.50
GANSITO MARINELA        $12.00

SUBTOTAL                $45.50
IVA                      $7.28
TOTAL                   $52.78

EFECTIVO                $100.00
CAMBIO                   $47.22

GRACIAS POR SU COMPRA
`;

// ─── TICKET 2: Walmart con formato diferente ───
const WALMART_TICKET = `
=== NUEVA WAL MART DE MEXICO ===
   S.A. DE C.V.
RFC NWM9709244W4
WALMART SUPERCENTER #2580
BLVD ADOLFO LOPEZ MATEOS 1234
15/Mar/2024 10:25

LECHE LALA 1L          42.50
PAN BIMBO GRANDE       38.90
HUEVO BACH 12PZ        54.00
ARROZ 1KG              29.90
ACEITE 1L              45.60

SUBTOTAL              210.90
IVA 16%                33.74

TOTAL A PAGAR        $244.64

TARJETA VISA  ****4532
APROBADO

GRACIAS POR SU PREFERENCIA
`;

// ─── TICKET 3: Total en línea separada (problema reportado) ───
const SPLIT_TOTAL = `
CAFETERIA EL PENDULO
RFC CEP920115AB3
AV NUEVO LEON 115
CONDESA CDMX

CAPPUCCINO GRANDE    65.00
CROISSANT            45.00

SUBTOTAL           110.00
IVA                 17.60

TOTAL
$127.60

PROPINA SUGERIDA 15%: $19.14
EFECTIVO            $150.00
SU CAMBIO            $22.40
`;

// ─── TICKET 4: OCR con errores y espacios ───
const MESSY_OCR = `
  TAQUERIA LOS COMPADRES
 RFC TLC010203XY9
  Calle Sonora 45  Col Roma

2 x Tacos pastor       $40.00
3 x Tacos bistec       $75.00
1 x Agua horchata      $25.00
1 x Salsa extra         $5.00

  Sub Total   $ 145.00
  I.V.A.      $  23.20
  TOTAL       $ 168.20

  Pago efectivo  $  200.00
  Cambio         $   31.80
`;

// ─── TICKET 5: Gasolinera PEMEX ───
const PEMEX_TICKET = `
GASOLINERA DEL VALLE SA DE CV
EST. SERV. NO. 4521
RFC GVA980701QR5
AV DIVISION DEL NORTE 1530
CDMX 03100

FECHA 2024-03-15 16:45

BOMBA: 04 LITROS: 35.280
PRODUCTO: MAGNA
PRECIO/L: $22.56

IMPORTE:    $795.92

FORMA DE PAGO: EFECTIVO
`;

// ─── TICKET 6: Sam's Club / Costco (montos con comas) ───
const SAMS_TICKET = `
**** SAM'S CLUB ****
NUEVA WAL MART DE MEXICO
S.A. DE C.V.
RFC NWM9709244W4
CLUB 4835 INTERLOMAS
01/ABR/2024

TV SAMSUNG 55"       12,499.00
PAPEL HIGI 48R        289.50
ACEITE OLIV 2L        345.00
DETERGENTE 5KG        198.50

SUBTOTAL           $13,332.00
IVA                 $2,133.12

TOTAL             $15,465.12

PAGO TC MASTERCARD
`;

// ─── TICKET 7: Uber/DiDi (digital, formato limpio) ───
const UBER_TICKET = `
Uber
Tu viaje del 15 de marzo

De: Polanco, CDMX
A: Santa Fe, CDMX

Tarifa base         $25.00
Distancia           $42.30
Tiempo              $18.50
Peaje               $15.00

Subtotal           $100.80
IVA                 $16.13

Total              $116.93

Pago: Visa ****8821
`;

// ─── TICKET 8: Farmacia Guadalajara ───
const FARMACIA_TICKET = `
FARMACIA GUADALAJARA
S.A. DE C.V.
RFC FGU830930PD2
SUC 1580 - GUADALAJARA
AV VALLARTA 2345

20-MAR-2024 09:15

PARACETAMOL 500MG        $45.00
VITAMINA C 1000MG        $89.00
SUERO ORAL               $32.50

SUBTOTAL               $166.50
TOTAL                  $166.50

EFECTIVO               $200.00
CAMBIO                  $33.50

*** GRACIAS ***
`;

// ─── TICKET 9: Texto OCR muy fragmentado ───
const FRAGMENTED_OCR = `
O X X O
CCO8605231N4
TDA 09876

DORITOS $21 .50
BOING $12. 00

TOT AL
$ 33.50

EF VO $50 .00
CAM BIO $16.50
`;

// ─── TICKET 10: Starbucks ───
const STARBUCKS_TICKET = `
OPERADORA DE ALIMENTOS Y
BEBIDAS STARBUCKS S DE RL DE CV
RFC OAB160317A37
STARBUCKS REFORMA 222
PASEO DE LA REFORMA 222

FECHA: 15/03/2024 08:30

1 CARAMEL MACCHIATO GDE  89.00
1 CROISSANT JAMON        65.00

  Subtotal             154.00
  IVA 16%               24.64
  Total                178.64

TARJETA DEBITO
****1234
APROBADO
`;

describe('receiptParser — Entrenamiento OCR', () => {
  // ═══════ DETECCIÓN DE MONTO ═══════

  describe('findAmount', () => {
    it('detecta total en OXXO ($52.78)', () => {
      const r = parseReceiptText(OXXO_TICKET);
      expect(r.amount).toBe(52.78);
    });

    it('detecta "TOTAL A PAGAR" en Walmart ($244.64)', () => {
      const r = parseReceiptText(WALMART_TICKET);
      expect(r.amount).toBe(244.64);
    });

    it('detecta total en línea separada ($127.60)', () => {
      const r = parseReceiptText(SPLIT_TOTAL);
      expect(r.amount).toBe(127.60);
    });

    it('detecta total con espacios extra ($168.20)', () => {
      const r = parseReceiptText(MESSY_OCR);
      expect(r.amount).toBe(168.20);
    });

    it('detecta IMPORTE en gasolinera ($795.92)', () => {
      const r = parseReceiptText(PEMEX_TICKET);
      expect(r.amount).toBe(795.92);
    });

    it('detecta montos con comas de miles ($15,465.12)', () => {
      const r = parseReceiptText(SAMS_TICKET);
      expect(r.amount).toBe(15465.12);
    });

    it('detecta total en Uber ($116.93)', () => {
      const r = parseReceiptText(UBER_TICKET);
      expect(r.amount).toBe(116.93);
    });

    it('detecta total sin IVA en farmacia ($166.50)', () => {
      const r = parseReceiptText(FARMACIA_TICKET);
      expect(r.amount).toBe(166.50);
    });

    it('detecta total OCR fragmentado ($33.50)', () => {
      const r = parseReceiptText(FRAGMENTED_OCR);
      expect(r.amount).toBe(33.50);
    });

    it('detecta total Starbucks (178.64)', () => {
      const r = parseReceiptText(STARBUCKS_TICKET);
      expect(r.amount).toBe(178.64);
    });

    it('NO confunde CAMBIO con TOTAL', () => {
      const r = parseReceiptText(OXXO_TICKET);
      expect(r.amount).not.toBe(47.22); // cambio
      expect(r.amount).not.toBe(100.00); // efectivo
    });
  });

  // ═══════ DETECCIÓN DE COMERCIO ═══════

  describe('findMerchant', () => {
    it('detecta OXXO (no el RFC ni la dirección)', () => {
      const r = parseReceiptText(OXXO_TICKET);
      expect(r.merchantName?.toUpperCase()).toContain('OXXO');
    });

    it('detecta Walmart', () => {
      const r = parseReceiptText(WALMART_TICKET);
      expect(r.merchantName?.toUpperCase()).toContain('WAL');
    });

    it('detecta cafetería', () => {
      const r = parseReceiptText(SPLIT_TOTAL);
      expect(r.merchantName?.toUpperCase()).toContain('PENDULO');
    });

    it('detecta taquería', () => {
      const r = parseReceiptText(MESSY_OCR);
      expect(r.merchantName?.toUpperCase()).toContain('COMPADRES');
    });

    it('detecta gasolinera', () => {
      const r = parseReceiptText(PEMEX_TICKET);
      expect(r.merchantName?.toUpperCase()).toContain('GASOLINERA');
    });

    it('detecta Sam\'s Club', () => {
      const r = parseReceiptText(SAMS_TICKET);
      expect(r.merchantName?.toUpperCase()).toContain('SAM');
    });

    it('detecta Uber', () => {
      const r = parseReceiptText(UBER_TICKET);
      expect(r.merchantName?.toUpperCase()).toContain('UBER');
    });

    it('detecta Farmacia Guadalajara', () => {
      const r = parseReceiptText(FARMACIA_TICKET);
      expect(r.merchantName?.toUpperCase()).toContain('FARMACIA');
    });

    it('detecta OXXO fragmentado', () => {
      const r = parseReceiptText(FRAGMENTED_OCR);
      // OCR fragmentado "O X X O" — el parser debe limpiar
      expect(r.merchantName).toBeTruthy();
    });

    it('detecta Starbucks', () => {
      const r = parseReceiptText(STARBUCKS_TICKET);
      expect(r.merchantName?.toUpperCase()).toContain('STARBUCKS');
    });
  });

  // ═══════ DETECCIÓN DE FECHA ═══════

  describe('findDate', () => {
    it('OXXO DD/MM/YYYY', () => {
      expect(parseReceiptText(OXXO_TICKET).date).toBe('2024-03-15');
    });

    it('Walmart DD/Mon/YYYY', () => {
      expect(parseReceiptText(WALMART_TICKET).date).toBe('2024-03-15');
    });

    it('PEMEX ISO YYYY-MM-DD', () => {
      expect(parseReceiptText(PEMEX_TICKET).date).toBe('2024-03-15');
    });

    it('Sam\'s DD/MON/YYYY', () => {
      expect(parseReceiptText(SAMS_TICKET).date).toBe('2024-04-01');
    });

    it('Uber texto "15 de marzo" (usa año actual)', () => {
      const year = new Date().getFullYear();
      expect(parseReceiptText(UBER_TICKET).date).toBe(`${year}-03-15`);
    });

    it('Farmacia DD-MON-YYYY', () => {
      expect(parseReceiptText(FARMACIA_TICKET).date).toBe('2024-03-20');
    });
  });

  // ═══════ LINE ITEMS ═══════

  describe('findLineItems', () => {
    it('detecta 3 productos OXXO', () => {
      const r = parseReceiptText(OXXO_TICKET);
      expect(r.lineItems?.length).toBeGreaterThanOrEqual(3);
    });

    it('detecta items con cantidad "2 x Tacos"', () => {
      const r = parseReceiptText(MESSY_OCR);
      expect(r.lineItems?.length).toBeGreaterThanOrEqual(3);
    });

    it('detecta items con comas de miles', () => {
      const r = parseReceiptText(SAMS_TICKET);
      const tv = r.lineItems?.find(i => i.name.toUpperCase().includes('TV') || i.name.toUpperCase().includes('SAMSUNG'));
      expect(tv?.price).toBe(12499);
    });
  });

  // ═══════ RFC ═══════

  describe('findRfc', () => {
    it('OXXO RFC', () => {
      expect(parseReceiptText(OXXO_TICKET).rfc).toBe('CCO8605231N4');
    });

    it('Walmart RFC', () => {
      expect(parseReceiptText(WALMART_TICKET).rfc).toBe('NWM9709244W4');
    });
  });

  // ═══════ CATEGORÍA ═══════

  describe('classifyExpense', () => {
    it('OXXO → Comida', () => {
      expect(parseReceiptText(OXXO_TICKET).suggestedCategory).toBe('Comida');
    });

    it('PEMEX → Transporte', () => {
      expect(parseReceiptText(PEMEX_TICKET).suggestedCategory).toBe('Transporte');
    });

    it('Uber → Transporte', () => {
      expect(parseReceiptText(UBER_TICKET).suggestedCategory).toBe('Transporte');
    });

    it('Farmacia → Salud', () => {
      expect(parseReceiptText(FARMACIA_TICKET).suggestedCategory).toBe('Salud');
    });
  });

  // ═══════ INTEGRACIÓN AI + REGEX ═══════

  describe('AI + regex integration', () => {
    it('parseReceiptText retorna ParsedReceiptData válido', () => {
      const r = parseReceiptText(OXXO_TICKET);
      expect(r).toHaveProperty('amount');
      expect(r).toHaveProperty('date');
      expect(r).toHaveProperty('merchantName');
      expect(r).toHaveProperty('rawText');
      expect(r).toHaveProperty('suggestedCategory');
      expect(r).toHaveProperty('deductible');
    });

    it('retorna rawText original', () => {
      const r = parseReceiptText(OXXO_TICKET);
      expect(r.rawText).toBe(OXXO_TICKET);
    });

    it('suggestedCategory es un valor válido', () => {
      const validCats = ['Comida', 'Transporte', 'Entretenimiento', 'Salud', 'Educacion', 'Otros'];
      const r = parseReceiptText(OXXO_TICKET);
      expect(validCats).toContain(r.suggestedCategory);
    });
  });

  // ═══════ TESTS ADICIONALES DE MONTOS ═══════

  describe('findAmount — casos extra', () => {
    it('detecta "Gran Total"', () => {
      const text = `TIENDA XYZ\nProducto $100.00\nGran Total $116.00\nGRACIAS`;
      const r = parseReceiptText(text);
      expect(r.amount).toBe(116.00);
    });

    it('detecta "Monto total"', () => {
      const text = `COMERCIO\nServicio $500.00\nMonto total $580.00`;
      const r = parseReceiptText(text);
      expect(r.amount).toBe(580.00);
    });

    it('detecta "Neto a pagar"', () => {
      const text = `TIENDA\nArtículo $200.00\nIVA $32.00\nNeto a pagar $232.00`;
      const r = parseReceiptText(text);
      expect(r.amount).toBe(232.00);
    });

    it('maneja ticket con solo un precio', () => {
      const text = `TIENDA SIMPLE\n$99.99`;
      const r = parseReceiptText(text);
      expect(r.amount).toBe(99.99);
    });

    it('maneja total sin $ sign', () => {
      const text = `TIENDA\nProducto 150.00\nTotal 150.00`;
      const r = parseReceiptText(text);
      expect(r.amount).toBe(150.00);
    });
  });

  // ═══════ TESTS ADICIONALES DE FECHA ═══════

  describe('findDate — formatos extra', () => {
    it('detecta fecha con mes abreviado DD/ABR/YYYY', () => {
      const text = `TIENDA\n15/ABR/2024\nProducto $50.00\nTotal $50.00`;
      const r = parseReceiptText(text);
      expect(r.date).toBe('2024-04-15');
    });

    it('detecta fecha texto "20 de noviembre de 2024"', () => {
      const text = `COMERCIO\n20 de noviembre de 2024\nServicio $100.00\nTotal $100.00`;
      const r = parseReceiptText(text);
      expect(r.date).toBe('2024-11-20');
    });

    it('maneja fecha DD-MM-YYYY', () => {
      const text = `TIENDA\n01-06-2024\nProducto $30.00\nTotal $30.00`;
      const r = parseReceiptText(text);
      expect(r.date).toBe('2024-06-01');
    });
  });

  // ═══════ TESTS ADICIONALES DE MERCHANT ═══════

  describe('findMerchant — marcas extra', () => {
    it('detecta Cinépolis', () => {
      const text = `CINEPOLIS\nRFC CIN710401JK3\nBoleto Cine $120.00\nTotal $120.00`;
      const r = parseReceiptText(text);
      expect(r.merchantName?.toUpperCase()).toContain('CINEPOLIS');
    });

    it('detecta Liverpool', () => {
      const text = `LIVERPOOL\nRFC ELI780915AB7\nCamisa $800.00\nTotal $800.00`;
      const r = parseReceiptText(text);
      expect(r.merchantName?.toUpperCase()).toContain('LIVERPOOL');
    });

    it('detecta Home Depot', () => {
      const text = `HOME DEPOT MEXICO\nRFC HDM001017AB2\nPintura $350.00\nTotal $350.00`;
      const r = parseReceiptText(text);
      expect(r.merchantName?.toUpperCase()).toContain('HOME DEPOT');
    });

    it('detecta Dominos', () => {
      const text = `DOMINOS PIZZA\nRFC DAL920305FG6\nPizza Grande $199.00\nTotal $199.00`;
      const r = parseReceiptText(text);
      expect(r.merchantName?.toUpperCase()).toContain('DOMINOS');
    });
  });

  // ═══════ TESTS DE RFC EXTRA ═══════

  describe('findRfc — casos extra', () => {
    it('detecta RFC sin prefijo "RFC:"', () => {
      const text = `TIENDA\nCCO8605231N4\nProducto $50.00\nTotal $50.00`;
      const r = parseReceiptText(text);
      expect(r.rfc).toBe('CCO8605231N4');
    });

    it('no incluye RFC genérico XAXX', () => {
      const text = `TIENDA\nXAXX010101000\nOAB160317A37\nProducto $50.00\nTotal $50.00`;
      const r = parseReceiptText(text);
      expect(r.rfc).toBe('OAB160317A37');
    });

    it('Starbucks RFC', () => {
      expect(parseReceiptText(STARBUCKS_TICKET).rfc).toBe('OAB160317A37');
    });

    it('Sam\'s RFC', () => {
      expect(parseReceiptText(SAMS_TICKET).rfc).toBe('NWM9709244W4');
    });

    it('Farmacia RFC', () => {
      expect(parseReceiptText(FARMACIA_TICKET).rfc).toBe('FGU830930PD2');
    });
  });

  // ═══════ TESTS DE DEDUCIBILIDAD ═══════

  describe('deductible', () => {
    it('ticket con RFC y CFDI es deducible', () => {
      const text = `TIENDA\nRFC OAB160317A37\nUso CFDI G03\nFactura fiscal\nTotal $100.00`;
      const r = parseReceiptText(text);
      expect(r.deductible).toBe(true);
    });

    it('ticket simple sin factura no es deducible', () => {
      const text = `TIENDITA\nProducto $50.00\nTotal $50.00`;
      const r = parseReceiptText(text);
      expect(r.deductible).toBe(false);
    });
  });
});
