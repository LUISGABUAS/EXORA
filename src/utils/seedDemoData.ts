import { createExpense } from '../database/expenseRepository';
import { createIncome } from '../database/incomeRepository';

// Genera una fecha en el mes actual
function thisMonth(day: number): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}-${String(day).padStart(2, '0')}`;
}

// Genera una fecha X días atrás desde hoy
function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function lastMonth(day: number): string {
  const now = new Date();
  const d = new Date(now.getFullYear(), now.getMonth() - 1, day);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}-${String(day).padStart(2, '0')}`;
}

export async function seedDemoData() {
  // ── Gastos del mes actual ──
  const expenses = [
    // Comida
    { amount: 485, date: thisMonth(2), category: 'Comida', merchantName: 'El Bajío', description: 'Comida con cliente', deductible: true, rfc: 'EBA920301AA1', usoCFDI: 'G03' },
    { amount: 68, date: thisMonth(3), category: 'Comida', merchantName: 'Starbucks', description: 'Café de trabajo', deductible: true, rfc: '', usoCFDI: '' },
    { amount: 312, date: thisMonth(5), category: 'Comida', merchantName: 'Sushi Itto', description: 'Cena', deductible: false, rfc: '', usoCFDI: '' },
    { amount: 145, date: thisMonth(8), category: 'Comida', merchantName: 'OXXO', description: 'Snacks', deductible: false, rfc: '', usoCFDI: '' },
    { amount: 890, date: thisMonth(10), category: 'Comida', merchantName: 'La Docena', description: 'Cena de equipo', deductible: true, rfc: 'DOC800101XX0', usoCFDI: 'G03' },
    { amount: 58, date: thisMonth(12), category: 'Comida', merchantName: 'Tim Hortons', description: 'Café', deductible: false, rfc: '', usoCFDI: '' },
    { amount: 240, date: thisMonth(15), category: 'Comida', merchantName: 'McDonald\'s', description: 'Almuerzo', deductible: false, rfc: '', usoCFDI: '' },
    { amount: 620, date: thisMonth(18), category: 'Comida', merchantName: 'Pujol', description: 'Reunión de negocios', deductible: true, rfc: 'PUJ010101XX1', usoCFDI: 'G03' },

    // Transporte
    { amount: 185, date: thisMonth(1), category: 'Transporte', merchantName: 'Uber', description: 'Viaje a cliente', deductible: true, rfc: 'UBE180524KZ2', usoCFDI: 'G03' },
    { amount: 1200, date: thisMonth(4), category: 'Transporte', merchantName: 'BP Gasolina', description: 'Carga de gasolina', deductible: true, rfc: 'AMX060101XX9', usoCFDI: 'G03' },
    { amount: 95, date: thisMonth(9), category: 'Transporte', merchantName: 'DiDi', description: 'Traslado oficina', deductible: false, rfc: '', usoCFDI: '' },
    { amount: 320, date: thisMonth(14), category: 'Transporte', merchantName: 'COPSA Caseta', description: 'Autopista GDL-CDMX', deductible: true, rfc: 'COP900101XX3', usoCFDI: 'G03' },
    { amount: 85, date: thisMonth(20), category: 'Transporte', merchantName: 'Uber', description: 'Aeropuerto', deductible: true, rfc: 'UBE180524KZ2', usoCFDI: 'G03' },

    // Salud
    { amount: 1500, date: thisMonth(6), category: 'Salud', merchantName: 'Dr. Martínez', description: 'Consulta médica', deductible: true, rfc: 'MARL780901HH1', usoCFDI: 'D01' },
    { amount: 380, date: thisMonth(13), category: 'Salud', merchantName: 'Farmacia del Ahorro', description: 'Medicamentos', deductible: true, rfc: 'FDA890101XX5', usoCFDI: 'D01' },

    // Educación
    { amount: 2800, date: thisMonth(1), category: 'Educacion', merchantName: 'Platzi', description: 'Suscripción anual', deductible: true, rfc: 'PLT190101XX2', usoCFDI: 'D10' },
    { amount: 4500, date: thisMonth(7), category: 'Educacion', merchantName: 'AWS Training', description: 'Curso cloud computing', deductible: true, rfc: 'AWM180101XX0', usoCFDI: 'D10' },

    // Entretenimiento
    { amount: 219, date: thisMonth(2), category: 'Entretenimiento', merchantName: 'Netflix', description: 'Suscripción mensual', deductible: false, rfc: '', usoCFDI: '' },
    { amount: 115, date: thisMonth(2), category: 'Entretenimiento', merchantName: 'Spotify', description: 'Suscripción mensual', deductible: false, rfc: '', usoCFDI: '' },
    { amount: 899, date: thisMonth(16), category: 'Entretenimiento', merchantName: 'Cinemex', description: 'Cine con familia', deductible: false, rfc: '', usoCFDI: '' },

    // Otros / Software
    { amount: 850, date: thisMonth(1), category: 'Otros', merchantName: 'Notion', description: 'Plan Team anual', deductible: true, rfc: 'NOI190101XX9', usoCFDI: 'G03' },
    { amount: 1100, date: thisMonth(1), category: 'Otros', merchantName: 'Adobe Creative', description: 'Suscripción mensual', deductible: true, rfc: 'ACL190101XX4', usoCFDI: 'G03' },
    { amount: 650, date: thisMonth(11), category: 'Otros', merchantName: 'Amazon', description: 'Material de oficina', deductible: true, rfc: 'AMZ180101XX1', usoCFDI: 'G03' },
    { amount: 2300, date: thisMonth(17), category: 'Otros', merchantName: 'Office Depot', description: 'Escritorio ergonómico', deductible: true, rfc: 'ODE900101XX7', usoCFDI: 'G03' },
  ];

  // ── Gastos últimos 7 días (para que la gráfica semanal se vea poblada) ──
  const recentExpenses = [
    { amount: 320, date: daysAgo(0), category: 'Comida', merchantName: 'Toks', description: 'Desayuno de trabajo', deductible: true, rfc: 'TOK900101XX1', usoCFDI: 'G03' },
    { amount: 95, date: daysAgo(0), category: 'Transporte', merchantName: 'Uber', description: 'Al aeropuerto', deductible: true, rfc: 'UBE180524KZ2', usoCFDI: 'G03' },
    { amount: 540, date: daysAgo(1), category: 'Otros', merchantName: 'Liverpool', description: 'Artículos de oficina', deductible: true, rfc: 'LIV900101XX8', usoCFDI: 'G03' },
    { amount: 180, date: daysAgo(1), category: 'Comida', merchantName: 'Chipotle', description: 'Comida', deductible: false, rfc: '', usoCFDI: '' },
    { amount: 750, date: daysAgo(2), category: 'Salud', merchantName: 'Laboratorio Médico', description: 'Análisis de sangre', deductible: true, rfc: 'LAB800101XX3', usoCFDI: 'D01' },
    { amount: 420, date: daysAgo(2), category: 'Entretenimiento', merchantName: 'Cinépolis', description: 'Cine', deductible: false, rfc: '', usoCFDI: '' },
    { amount: 1100, date: daysAgo(3), category: 'Transporte', merchantName: 'Shell Gasolina', description: 'Carga completa', deductible: true, rfc: 'SHE900101XX6', usoCFDI: 'G03' },
    { amount: 265, date: daysAgo(3), category: 'Comida', merchantName: 'Subway', description: 'Almuerzo rápido', deductible: false, rfc: '', usoCFDI: '' },
    { amount: 890, date: daysAgo(4), category: 'Otros', merchantName: 'Papelería Lumen', description: 'Material presentación', deductible: true, rfc: 'LUM890101XX2', usoCFDI: 'G03' },
    { amount: 145, date: daysAgo(5), category: 'Comida', merchantName: 'Café Punta del Cielo', description: 'Café reunión', deductible: true, rfc: 'PDC010101XX4', usoCFDI: 'G03' },
    { amount: 680, date: daysAgo(5), category: 'Educacion', merchantName: 'Coursera', description: 'Certificación Google', deductible: true, rfc: 'COU190101XX7', usoCFDI: 'D10' },
    { amount: 390, date: daysAgo(6), category: 'Transporte', merchantName: 'DiDi', description: 'Visita cliente', deductible: true, rfc: 'DID180101XX0', usoCFDI: 'G03' },
    { amount: 210, date: daysAgo(6), category: 'Comida', merchantName: 'OXXO', description: 'Snacks viaje', deductible: false, rfc: '', usoCFDI: '' },
  ];

  // ── Gastos del mes anterior (para que la gráfica semanal tenga contexto) ──
  const lastMonthExpenses = [
    { amount: 420, date: lastMonth(25), category: 'Comida', merchantName: 'Restaurante', description: 'Comida', deductible: false, rfc: '', usoCFDI: '' },
    { amount: 1100, date: lastMonth(26), category: 'Transporte', merchantName: 'Gasolina', description: 'Gasolina', deductible: true, rfc: '', usoCFDI: '' },
    { amount: 340, date: lastMonth(27), category: 'Otros', merchantName: 'Amazon', description: 'Compra', deductible: false, rfc: '', usoCFDI: '' },
    { amount: 890, date: lastMonth(28), category: 'Educacion', merchantName: 'Udemy', description: 'Curso', deductible: true, rfc: '', usoCFDI: '' },
  ];

  // ── Ingresos del mes ──
  const incomes = [
    { amount: 32000, date: thisMonth(1), type: 'honorarios' as const, description: 'Proyecto diseño UX — Cliente A', invoiced: true, recurring: false, paymentMethod: 'transferencia' as const },
    { amount: 18500, date: thisMonth(10), type: 'honorarios' as const, description: 'Consultoría tecnológica — Startup B', invoiced: true, recurring: false, paymentMethod: 'transferencia' as const },
    { amount: 8000, date: thisMonth(15), type: 'plataformas' as const, description: 'Freelance Fiverr', invoiced: false, recurring: false, paymentMethod: 'transferencia' as const },
  ];

  // Insertar todo
  for (const exp of [...expenses, ...recentExpenses, ...lastMonthExpenses]) {
    await createExpense({
      ...exp,
      source: 'manual',
      ocrRawText: '',
      conceptsText: '',
    } as any);
  }

  for (const inc of incomes) {
    await createIncome(inc);
  }
}
