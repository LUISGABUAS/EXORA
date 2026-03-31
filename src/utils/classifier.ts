import { ExpenseCategory } from '../types/expense';

interface WeightedKeyword {
  term: string;
  weight: number;
}

const categoryKeywords: Record<ExpenseCategory, WeightedKeyword[]> = {
  Comida: [
    // General food terms
    { term: 'restaurante', weight: 8 },
    { term: 'taqueria', weight: 9 },
    { term: 'cafe', weight: 6 },
    { term: 'cafeteria', weight: 7 },
    { term: 'comida', weight: 7 },
    { term: 'alimentos', weight: 7 },
    { term: 'cocina', weight: 5 },
    { term: 'pizza', weight: 8 },
    { term: 'hamburguesa', weight: 8 },
    { term: 'tacos', weight: 9 },
    { term: 'torta', weight: 6 },
    { term: 'sushi', weight: 8 },
    { term: 'panaderia', weight: 8 },
    { term: 'carniceria', weight: 7 },
    { term: 'fruteria', weight: 7 },
    { term: 'verduleria', weight: 7 },
    { term: 'tortilleria', weight: 8 },
    { term: 'pasteleria', weight: 7 },
    // Delivery
    { term: 'uber eats', weight: 9 },
    { term: 'didi food', weight: 9 },
    { term: 'rappi', weight: 8 },
    // Brands
    { term: 'oxxo', weight: 7 },
    { term: 'starbucks', weight: 8 },
    { term: 'mcdonalds', weight: 9 },
    { term: 'burger king', weight: 9 },
    { term: 'subway', weight: 8 },
    { term: 'dominos', weight: 8 },
    { term: 'little caesars', weight: 8 },
    { term: 'kfc', weight: 8 },
    { term: 'pollo loco', weight: 8 },
    { term: 'church', weight: 5 },
    { term: 'carl', weight: 4 },
    { term: 'vips', weight: 8 },
    { term: 'sanborns', weight: 7 },
    { term: 'italiannis', weight: 8 },
    { term: 'chilis', weight: 8 },
    { term: 'applebees', weight: 8 },
    { term: 'toks', weight: 8 },
    { term: 'la casa de tono', weight: 9 },
    { term: 'el fogon', weight: 7 },
    { term: 'el portón', weight: 7 },
    // Supermarkets
    { term: 'walmart', weight: 6 },
    { term: 'soriana', weight: 6 },
    { term: 'chedraui', weight: 6 },
    { term: 'heb', weight: 6 },
    { term: 'la comer', weight: 6 },
    { term: 'city market', weight: 6 },
    { term: 'superama', weight: 6 },
    { term: 'super', weight: 4 },
    { term: 'bodega aurrera', weight: 6 },
    { term: 'costco', weight: 5 },
    { term: 'sams club', weight: 5 },
    { term: 'sam\'s', weight: 5 },
    // Convenience
    { term: '7-eleven', weight: 5 },
    { term: 'seven eleven', weight: 5 },
    { term: 'circle k', weight: 5 },
    { term: 'extra', weight: 3 },
  ],
  Transporte: [
    // Ride-hailing
    { term: 'uber', weight: 8 },
    { term: 'didi', weight: 8 },
    { term: 'cabify', weight: 8 },
    { term: 'beat', weight: 7 },
    { term: 'indriver', weight: 8 },
    { term: 'taxi', weight: 8 },
    // Gas
    { term: 'gasolina', weight: 9 },
    { term: 'pemex', weight: 9 },
    { term: 'mobil', weight: 7 },
    { term: 'shell', weight: 7 },
    { term: 'bp', weight: 6 },
    { term: 'gulf', weight: 6 },
    { term: 'oxxo gas', weight: 8 },
    { term: 'combustible', weight: 8 },
    { term: 'diesel', weight: 7 },
    { term: 'magna', weight: 8 },
    { term: 'premium', weight: 5 },
    // Public transit
    { term: 'metro', weight: 7 },
    { term: 'metrobus', weight: 8 },
    { term: 'autobus', weight: 8 },
    { term: 'camion', weight: 5 },
    { term: 'ruta', weight: 4 },
    // Tolls & parking
    { term: 'caseta', weight: 9 },
    { term: 'peaje', weight: 9 },
    { term: 'estacionamiento', weight: 8 },
    { term: 'parking', weight: 7 },
    // Bus companies
    { term: 'ado', weight: 8 },
    { term: 'primera plus', weight: 8 },
    { term: 'etn', weight: 8 },
    { term: 'estrella blanca', weight: 8 },
    { term: 'estrella roja', weight: 8 },
    { term: 'pullman', weight: 7 },
    { term: 'flecha amarilla', weight: 8 },
    // Airlines
    { term: 'volaris', weight: 9 },
    { term: 'aeromexico', weight: 9 },
    { term: 'vivaaerobus', weight: 9 },
    { term: 'viva aerobus', weight: 9 },
    { term: 'vuelo', weight: 6 },
    { term: 'avion', weight: 6 },
    { term: 'aeropuerto', weight: 5 },
    // Vehicle
    { term: 'verificacion', weight: 7 },
    { term: 'mecanico', weight: 7 },
    { term: 'taller', weight: 5 },
    { term: 'llantera', weight: 7 },
    { term: 'autozone', weight: 7 },
    { term: 'refaccion', weight: 6 },
  ],
  Entretenimiento: [
    // Cinema
    { term: 'cine', weight: 8 },
    { term: 'cinepolis', weight: 9 },
    { term: 'cinemex', weight: 9 },
    // Streaming
    { term: 'netflix', weight: 9 },
    { term: 'spotify', weight: 9 },
    { term: 'disney', weight: 8 },
    { term: 'hbo', weight: 8 },
    { term: 'amazon prime', weight: 8 },
    { term: 'apple tv', weight: 8 },
    { term: 'youtube premium', weight: 8 },
    // Gaming
    { term: 'steam', weight: 8 },
    { term: 'xbox', weight: 8 },
    { term: 'playstation', weight: 8 },
    { term: 'nintendo', weight: 8 },
    { term: 'videojuego', weight: 8 },
    // Events
    { term: 'ticketmaster', weight: 9 },
    { term: 'superboletos', weight: 8 },
    { term: 'concierto', weight: 8 },
    { term: 'teatro', weight: 8 },
    { term: 'museo', weight: 7 },
    { term: 'espectaculo', weight: 7 },
    { term: 'evento', weight: 5 },
    { term: 'parque', weight: 5 },
    { term: 'six flags', weight: 9 },
    { term: 'la feria', weight: 7 },
    // Nightlife
    { term: 'bar', weight: 7 },
    { term: 'antro', weight: 8 },
    { term: 'club', weight: 5 },
    { term: 'cerveza', weight: 5 },
    { term: 'bebida', weight: 4 },
    // Sports
    { term: 'gimnasio', weight: 7 },
    { term: 'sport city', weight: 8 },
    { term: 'smart fit', weight: 8 },
    { term: 'deportivo', weight: 6 },
    { term: 'estadio', weight: 7 },
  ],
  Salud: [
    // Pharmacies
    { term: 'farmacia', weight: 9 },
    { term: 'farmacia guadalajara', weight: 10 },
    { term: 'farmacias del ahorro', weight: 10 },
    { term: 'farmacias similares', weight: 10 },
    { term: 'similares', weight: 8 },
    { term: 'farmacia san pablo', weight: 10 },
    { term: 'benavides', weight: 8 },
    // Medical
    { term: 'doctor', weight: 9 },
    { term: 'medico', weight: 9 },
    { term: 'hospital', weight: 9 },
    { term: 'clinica', weight: 9 },
    { term: 'consultorio', weight: 8 },
    { term: 'consulta', weight: 7 },
    { term: 'salud digna', weight: 10 },
    { term: 'chopo', weight: 9 },
    { term: 'laboratorio', weight: 8 },
    { term: 'analisis', weight: 6 },
    { term: 'estudio', weight: 4 },
    // Dental
    { term: 'dentista', weight: 9 },
    { term: 'dental', weight: 8 },
    { term: 'odontologia', weight: 9 },
    // Vision
    { term: 'optica', weight: 8 },
    { term: 'lentes', weight: 7 },
    { term: 'oculista', weight: 9 },
    { term: 'oftalmologo', weight: 9 },
    // Misc
    { term: 'medicamento', weight: 8 },
    { term: 'medicina', weight: 7 },
    { term: 'receta', weight: 6 },
    { term: 'tratamiento', weight: 6 },
    { term: 'terapia', weight: 7 },
    { term: 'fisioterapia', weight: 8 },
    { term: 'psicologia', weight: 8 },
    { term: 'nutricion', weight: 7 },
    { term: 'seguro medico', weight: 8 },
    { term: 'imss', weight: 8 },
    { term: 'issste', weight: 8 },
  ],
  Educacion: [
    // Schools
    { term: 'escuela', weight: 8 },
    { term: 'universidad', weight: 9 },
    { term: 'colegiatura', weight: 10 },
    { term: 'inscripcion', weight: 7 },
    { term: 'matricula', weight: 8 },
    { term: 'instituto', weight: 7 },
    { term: 'colegio', weight: 7 },
    { term: 'preparatoria', weight: 8 },
    { term: 'secundaria', weight: 7 },
    { term: 'primaria', weight: 7 },
    { term: 'kinder', weight: 7 },
    // Online
    { term: 'curso', weight: 7 },
    { term: 'udemy', weight: 9 },
    { term: 'platzi', weight: 9 },
    { term: 'coursera', weight: 9 },
    { term: 'domestika', weight: 8 },
    { term: 'crehana', weight: 8 },
    { term: 'codecademy', weight: 8 },
    { term: 'capacitacion', weight: 7 },
    { term: 'certificacion', weight: 7 },
    // Materials
    { term: 'libros', weight: 6 },
    { term: 'libreria', weight: 6 },
    { term: 'gandhi', weight: 7 },
    { term: 'papeleria', weight: 6 },
    { term: 'material escolar', weight: 8 },
    { term: 'utiles', weight: 6 },
    { term: 'tesis', weight: 8 },
    // Language
    { term: 'idioma', weight: 7 },
    { term: 'ingles', weight: 5 },
    { term: 'duolingo', weight: 8 },
    { term: 'clase', weight: 5 },
    { term: 'tutorial', weight: 5 },
    { term: 'seminario', weight: 7 },
    { term: 'taller', weight: 4 },
    { term: 'diplomado', weight: 8 },
    { term: 'maestria', weight: 9 },
    { term: 'doctorado', weight: 9 },
  ],
  Otros: [],
};

function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

export function classifyExpense(text: string): ExpenseCategory {
  const normalized = normalize(text);
  const scores: Record<string, number> = {};

  for (const [category, keywords] of Object.entries(categoryKeywords) as [ExpenseCategory, WeightedKeyword[]][]) {
    if (keywords.length === 0) continue;
    let total = 0;
    for (const { term, weight } of keywords) {
      if (normalized.includes(normalize(term))) {
        total += weight;
      }
    }
    if (total > 0) {
      scores[category] = total;
    }
  }

  if (Object.keys(scores).length === 0) {
    return 'Otros';
  }

  return Object.entries(scores).reduce((best, [cat, score]) =>
    score > best[1] ? [cat, score] : best,
    ['Otros', 0],
  )[0] as ExpenseCategory;
}
