import { ExpenseCategory } from '../types/expense';
import { classifyExpense } from '../utils/classifier';

export interface ParsedCFDI {
  amount?: number;
  date?: string;
  merchantName?: string;
  rfc?: string;
  usoCFDI?: string;
  uuid?: string;
  formaPago?: string;
  conceptsText?: string;
  deductible: boolean;
  suggestedCategory: ExpenseCategory;
  rawXml: string;
}

/**
 * Extrae un atributo XML de un tag, sin importar el orden de atributos.
 * Ej: extractAttr('<Emisor Nombre="OXXO" Rfc="AAA000">', 'Rfc') → 'AAA000'
 */
function extractAttr(tag: string, attr: string): string | undefined {
  const regex = new RegExp(`${attr}\\s*=\\s*"([^"]*)"`, 'i');
  const match = tag.match(regex);
  return match?.[1] || undefined;
}

/**
 * Extrae el contenido de un tag XML.
 * Ej: extractTag(xml, 'Emisor') → '<Emisor Nombre="OXXO" Rfc="AAA000" />'
 */
function extractTag(xml: string, tagName: string): string | undefined {
  // Self-closing: <Tag ... />
  const selfClose = new RegExp(`<(?:\\w+:)?${tagName}[^>]*\\/?>`, 'i');
  return xml.match(selfClose)?.[0];
}

/**
 * Extrae datos de una factura CFDI en formato XML.
 * Soporta CFDI 3.3 y 4.0, con o sin namespace.
 */
export function parseCFDIXml(xmlString: string): ParsedCFDI {
  const defaultCategory: ExpenseCategory = 'Otros';

  try {
    const xml = xmlString.trim();

    // --- Comprobante (tag raiz) ---
    const comprobanteTag = xml.match(/<(?:\w+:)?Comprobante[^>]*>/)?.[0] ?? '';
    const amount = parseFloat(extractAttr(comprobanteTag, 'Total') ?? '');
    const subtotal = parseFloat(extractAttr(comprobanteTag, 'SubTotal') ?? '');
    const formaPago = extractAttr(comprobanteTag, 'FormaPago');

    // Fecha: "2024-01-15T14:30:00"
    const fechaRaw = extractAttr(comprobanteTag, 'Fecha');
    const date = fechaRaw?.split('T')[0];

    // --- Emisor ---
    const emisorTag = extractTag(xml, 'Emisor') ?? '';
    const merchantName = extractAttr(emisorTag, 'Nombre');
    const rfc = extractAttr(emisorTag, 'Rfc');

    // --- Receptor ---
    const receptorTag = extractTag(xml, 'Receptor') ?? '';
    const usoCFDI = extractAttr(receptorTag, 'UsoCFDI') ?? '';

    // --- UUID (TimbreFiscalDigital) ---
    const timbreTag = extractTag(xml, 'TimbreFiscalDigital') ?? '';
    const uuid = extractAttr(timbreTag, 'UUID');

    // --- Conceptos ---
    const conceptMatches = xml.match(/<(?:\w+:)?Concepto[^>]*>/gi) ?? [];
    const concepts: string[] = [];
    for (const tag of conceptMatches) {
      const desc = extractAttr(tag, 'Descripcion');
      if (desc) concepts.push(desc);
    }
    const conceptsText = concepts.join(', ');

    // --- Deducible ---
    const GENERIC_RFCS = ['XAXX010101000', 'XEXX010101000'];
    const isGenericRfc = !rfc || GENERIC_RFCS.includes(rfc.toUpperCase());
    let deductible = false;
    if (!isGenericRfc) {
      const deductibleUsos = [
        'G01', 'G02', 'G03',
        'D01', 'D02', 'D03', 'D04', 'D05', 'D06', 'D07', 'D08', 'D09', 'D10',
        'I01', 'I02', 'I03', 'I04', 'I05', 'I06', 'I07', 'I08',
        'S01',
      ];
      deductible = deductibleUsos.includes(usoCFDI.toUpperCase());
    }

    // --- Categoria sugerida (usa classifier existente) ---
    const classifyText = `${merchantName ?? ''} ${conceptsText}`;
    const suggestedCategory = classifyExpense(classifyText) || defaultCategory;

    return {
      amount: !isNaN(amount) ? amount : (!isNaN(subtotal) ? subtotal : undefined),
      date,
      merchantName,
      rfc,
      usoCFDI: usoCFDI || undefined,
      uuid,
      formaPago,
      conceptsText,
      deductible,
      suggestedCategory,
      rawXml: xml,
    };
  } catch (error) {
    console.error('Error parsing CFDI:', error);
    return {
      deductible: false,
      suggestedCategory: defaultCategory,
      rawXml: xmlString,
    };
  }
}

/**
 * Lee un archivo XML y retorna su contenido como string
 */
export async function readXmlFile(filePath: string): Promise<string> {
  try {
    const RNFS = require('react-native-fs');
    const content = await RNFS.readFile(filePath, 'utf8');

    if (!content || content.trim().length < 10) {
      throw new Error('El archivo esta vacio o no contiene XML valido.');
    }

    // Verificar que parece ser un CFDI
    if (!content.includes('Comprobante') && !content.includes('comprobante')) {
      throw new Error('El archivo no parece ser una factura CFDI valida.');
    }

    return content;
  } catch (error) {
    if (error instanceof Error && error.message.startsWith('El archivo')) {
      throw error;
    }
    throw new Error(`No se pudo leer el archivo XML: ${error instanceof Error ? error.message : 'Error desconocido'}`);
  }
}
