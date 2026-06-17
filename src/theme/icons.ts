import { ExpenseCategory } from '../types/expense';

export const categoryIcons: Record<ExpenseCategory, string> = {
  Comida: 'food-fork-drink',
  Transporte: 'car',
  Entretenimiento: 'movie-open-outline',
  Salud: 'heart-pulse',
  Educacion: 'school-outline',
  Otros: 'dots-horizontal-circle-outline',
};

export function getCategoryIcon(category: string): string {
  return (categoryIcons as Record<string, string>)[category] ?? 'tag-outline';
}

export const tabIcons: Record<string, string> = {
  Inicio: 'home',
  Movimientos: 'swap-horizontal',
  Perfil: 'account-circle-outline',
};
