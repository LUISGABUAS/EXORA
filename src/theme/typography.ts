import { Platform, TextStyle } from 'react-native';

const IS_IOS = Platform.OS === 'ios';

// En Android los nombres de familia deben coincidir con el nombre del archivo sin extensión
const INTER: Record<string, TextStyle['fontFamily']> = {
  regular:   IS_IOS ? 'Inter_400Regular' : 'Inter_400Regular',
  medium:    IS_IOS ? 'Inter_500Medium'  : 'Inter_500Medium',
  semibold:  IS_IOS ? 'Inter_600SemiBold': 'Inter_600SemiBold',
  bold:      IS_IOS ? 'Inter_700Bold'    : 'Inter_700Bold',
  extrabold: IS_IOS ? 'Inter_800ExtraBold': 'Inter_800ExtraBold',
  black:     IS_IOS ? 'Inter_900Black'   : 'Inter_900Black',
};

export const font = INTER;

// Estilos de texto reutilizables
export const type = {
  h1:      { fontFamily: INTER.black,     fontSize: 34, letterSpacing: -0.8 } as TextStyle,
  h2:      { fontFamily: INTER.extrabold, fontSize: 28, letterSpacing: -0.5 } as TextStyle,
  h3:      { fontFamily: INTER.bold,      fontSize: 22, letterSpacing: -0.3 } as TextStyle,
  h4:      { fontFamily: INTER.bold,      fontSize: 18, letterSpacing: -0.2 } as TextStyle,
  title:   { fontFamily: INTER.semibold,  fontSize: 16 } as TextStyle,
  body:    { fontFamily: INTER.regular,   fontSize: 15, lineHeight: 22 } as TextStyle,
  caption: { fontFamily: INTER.medium,    fontSize: 13 } as TextStyle,
  small:   { fontFamily: INTER.medium,    fontSize: 11 } as TextStyle,
  label:   { fontFamily: INTER.semibold,  fontSize: 13 } as TextStyle,
  button:  { fontFamily: INTER.bold,      fontSize: 16 } as TextStyle,
  number:  { fontFamily: INTER.black,     fontSize: 28, letterSpacing: -1 } as TextStyle,
};
