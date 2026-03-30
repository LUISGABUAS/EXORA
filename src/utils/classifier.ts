import { ExpenseCategory } from '../types/expense';

const categoryKeywords: Record<ExpenseCategory, string[]> = {
  Comida: ['restaurante', 'taqueria', 'cafe', 'uber eats', 'didi food', 'pizza', 'comida', 'oxxo', 'super', 'walmart', 'starbucks', 'mcdonalds', 'burger'],
  Transporte: ['uber', 'didi', 'gasolina', 'caseta', 'metro', 'autobus', 'taxi', 'pemex', 'mobil', 'shell', 'bp'],
  Entretenimiento: ['cine', 'netflix', 'spotify', 'bar', 'teatro', 'steam', 'xbox', 'ticketmaster', 'cinepolis', 'cinemex'],
  Salud: ['farmacia', 'doctor', 'hospital', 'clinica', 'medico', 'similares', 'laboratorio', 'dentista', 'optica'],
  Educacion: ['curso', 'colegiatura', 'universidad', 'udemy', 'platzi', 'libros', 'escuela', 'instituto'],
  Otros: [],
};

export function classifyExpense(text: string): ExpenseCategory {
  const normalized = text.toLowerCase();
  for (const [category, keywords] of Object.entries(categoryKeywords) as [ExpenseCategory, string[]][]) {
    if (keywords.some((keyword) => normalized.includes(keyword))) {
      return category;
    }
  }
  return 'Otros';
}
