export type ColorPalette = {
  background: string;
  surface: string;
  surfaceAlt: string;
  text: string;
  textMuted: string;
  textSecondary: string;
  primary: string;
  secondary: string;
  accent: string;
  danger: string;
  warning: string;
  success: string;
  border: string;
  white: string;
  cardBg: string;
  primaryGlow: string;
};

export const lightColors: ColorPalette = {
  background: '#F5F5F7',
  surface: '#FFFFFF',
  surfaceAlt: '#F0F0F2',
  text: '#1A1A1A',
  textMuted: '#8E8E93',
  textSecondary: '#6B6B70',
  primary: '#22C55E',
  secondary: '#3B82F6',
  accent: '#8B5CF6',
  danger: '#EF4444',
  warning: '#F59E0B',
  success: '#22C55E',
  border: '#E5E5EA',
  white: '#FFFFFF',
  cardBg: '#FFFFFF',
  primaryGlow: '#22C55E20',
};

export const colors = lightColors;
