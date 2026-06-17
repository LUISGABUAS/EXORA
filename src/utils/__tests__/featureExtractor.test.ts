import {
  extractFeatures,
  extractAllFeatures,
  hasPrice,
  LINE_CLASSES,
} from '../featureExtractor';

describe('featureExtractor', () => {
  // ═══════ hasPrice ═══════

  describe('hasPrice', () => {
    it('detecta $123.45', () => {
      expect(hasPrice('TOTAL  $123.45')).toBe(true);
    });

    it('detecta precio sin $', () => {
      expect(hasPrice('SUBTOTAL  123.45')).toBe(true);
    });

    it('detecta precio con comas', () => {
      expect(hasPrice('TV SAMSUNG  $12,499.00')).toBe(true);
    });

    it('detecta precio OCR con espacio', () => {
      expect(hasPrice('DORITOS $21 .50')).toBe(true);
    });

    it('no detecta en texto sin números', () => {
      expect(hasPrice('GRACIAS POR SU COMPRA')).toBe(false);
    });

    it('no detecta en línea de decoración', () => {
      expect(hasPrice('*************************')).toBe(false);
    });
  });

  // ═══════ extractFeatures ═══════

  describe('extractFeatures', () => {
    it('retorna exactamente 28 features', () => {
      const features = extractFeatures('TOTAL $52.78', 5, 20);
      expect(features).toHaveLength(28);
    });

    it('todos los valores son números', () => {
      const features = extractFeatures('OXXO S.A. DE C.V.', 1, 10);
      features.forEach(f => expect(typeof f).toBe('number'));
    });

    // Feature 1: linePosition
    it('linePosition = 0 para primera línea', () => {
      const f = extractFeatures('test', 0, 10);
      expect(f[0]).toBe(0);
    });

    it('linePosition = 1 para última línea', () => {
      const f = extractFeatures('test', 9, 10);
      expect(f[0]).toBe(1);
    });

    // Feature 2: lineLength
    it('lineLength normalizado correctamente', () => {
      const short = extractFeatures('abc', 0, 5);
      const long = extractFeatures('a'.repeat(80), 0, 5);
      expect(short[1]).toBeLessThan(long[1]);
      expect(long[1]).toBe(1);
    });

    // Feature 3: wordCount
    it('wordCount normalizado', () => {
      const one = extractFeatures('OXXO', 0, 5);
      const many = extractFeatures('CADENA COMERCIAL OXXO S.A. DE C.V.', 0, 5);
      expect(one[2]).toBeLessThan(many[2]);
    });

    // Feature 4: digitRatio
    it('digitRatio alto para línea numérica', () => {
      const f = extractFeatures('12345678', 0, 5);
      expect(f[3]).toBe(1);
    });

    it('digitRatio = 0 para texto puro', () => {
      const f = extractFeatures('OXXO', 0, 5);
      expect(f[3]).toBe(0);
    });

    // Feature 5: letterRatio
    it('letterRatio alto para texto puro', () => {
      const f = extractFeatures('OXXO', 0, 5);
      expect(f[4]).toBe(1);
    });

    // Feature 6: hasPrice
    it('hasPrice = 1 para línea con precio', () => {
      const f = extractFeatures('TOTAL $52.78', 0, 5);
      expect(f[5]).toBe(1);
    });

    it('hasPrice = 0 para línea sin precio', () => {
      const f = extractFeatures('GRACIAS POR SU COMPRA', 0, 5);
      expect(f[5]).toBe(0);
    });

    // Feature 7: hasDollarSign
    it('hasDollarSign = 1 cuando contiene $', () => {
      const f = extractFeatures('TOTAL $52.78', 0, 5);
      expect(f[6]).toBe(1);
    });

    // Feature 8: isAllCaps
    it('isAllCaps = 1 para texto en mayúsculas', () => {
      const f = extractFeatures('TOTAL A PAGAR', 0, 5);
      expect(f[7]).toBe(1);
    });

    it('isAllCaps = 0 para texto mixto', () => {
      const f = extractFeatures('Total a pagar', 0, 5);
      expect(f[7]).toBe(0);
    });

    // Feature 9: startsWithNumber
    it('startsWithNumber para "2 x Tacos"', () => {
      const f = extractFeatures('2 x Tacos pastor  $40.00', 0, 5);
      expect(f[8]).toBe(1);
    });

    // Feature 10: containsTotalKw
    it('containsTotalKw = 1 para TOTAL', () => {
      const f = extractFeatures('TOTAL  $52.78', 0, 5);
      expect(f[9]).toBe(1);
    });

    it('containsTotalKw = 0 para SUBTOTAL', () => {
      const f = extractFeatures('SUBTOTAL  $45.00', 0, 5);
      expect(f[9]).toBe(0);
    });

    // Feature 11: containsSubtotalKw
    it('containsSubtotalKw = 1 para SUBTOTAL', () => {
      const f = extractFeatures('SUBTOTAL  $45.00', 0, 5);
      expect(f[10]).toBe(1);
    });

    // Feature 12: containsTaxKw
    it('containsTaxKw = 1 para IVA', () => {
      const f = extractFeatures('IVA 16%  $7.28', 0, 5);
      expect(f[11]).toBe(1);
    });

    // Feature 13: containsPaymentKw
    it('containsPaymentKw = 1 para EFECTIVO', () => {
      const f = extractFeatures('EFECTIVO  $100.00', 0, 5);
      expect(f[12]).toBe(1);
    });

    // Feature 14: containsChangeKw
    it('containsChangeKw = 1 para CAMBIO', () => {
      const f = extractFeatures('CAMBIO  $47.22', 0, 5);
      expect(f[13]).toBe(1);
    });

    // Feature 15: containsDatePattern
    it('containsDatePattern = 1 para fecha', () => {
      const f = extractFeatures('FECHA: 15/03/2024', 0, 5);
      expect(f[14]).toBe(1);
    });

    // Feature 16: containsRfcPattern
    it('containsRfcPattern = 1 para RFC', () => {
      const f = extractFeatures('RFC: CCO8605231N4', 0, 5);
      expect(f[15]).toBe(1);
    });

    it('containsRfcPattern = 0 sin RFC', () => {
      const f = extractFeatures('GRACIAS', 0, 5);
      expect(f[15]).toBe(0);
    });

    // Feature 17: containsAddressKw
    it('containsAddressKw = 1 para dirección', () => {
      const f = extractFeatures('AV REFORMA 123 COL JUAREZ', 0, 5);
      expect(f[16]).toBe(1);
    });

    // Feature 18: hasDecorationChars
    it('hasDecorationChars = 1 para línea de asteriscos', () => {
      const f = extractFeatures('*'.repeat(40), 0, 5);
      expect(f[17]).toBe(1);
    });

    it('hasDecorationChars = 0 para texto normal', () => {
      const f = extractFeatures('OXXO', 0, 5);
      expect(f[17]).toBe(0);
    });

    // Feature 19: distanceFromEnd
    it('distanceFromEnd = 1 para primera línea', () => {
      const f = extractFeatures('test', 0, 10);
      expect(f[18]).toBeCloseTo(1);
    });

    it('distanceFromEnd = 0 para última línea', () => {
      const f = extractFeatures('test', 9, 10);
      expect(f[18]).toBeCloseTo(0);
    });

    // Feature 20: prevLineHasPrice
    it('prevLineHasPrice = 1 cuando línea anterior tiene precio', () => {
      const f = extractFeatures('CAMBIO $10.00', 5, 10, 'TOTAL $52.78');
      expect(f[19]).toBe(1);
    });

    it('prevLineHasPrice = 0 cuando no hay línea anterior', () => {
      const f = extractFeatures('OXXO', 0, 10);
      expect(f[19]).toBe(0);
    });
  });

  // ═══════ extractAllFeatures ═══════

  describe('extractAllFeatures', () => {
    it('retorna un vector por línea', () => {
      const text = 'Línea 1\nLínea 2\nLínea 3';
      const result = extractAllFeatures(text);
      expect(result).toHaveLength(3);
      result.forEach(r => expect(r).toHaveLength(28));
    });

    it('LINE_CLASSES tiene 12 clases', () => {
      expect(LINE_CLASSES).toHaveLength(12);
    });
  });
});
