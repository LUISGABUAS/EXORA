import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { ScreenContainer } from '../components/ScreenContainer';
import {
  CURRENCY_NAMES,
  CURRENCY_SYMBOLS,
  SUPPORTED_CURRENCIES,
} from '../services/exchangeRateService';
import { useCurrencyStore } from '../store/useCurrencyStore';
import { ColorPalette } from '../theme/colors';
import { font } from '../theme/typography';
import { useTheme } from '../theme/ThemeContext';

export function CurrencySettingsScreen() {
  const { colors, isDark } = useTheme();
  const s = useStyles(colors, isDark);

  const defaultCurrency = useCurrencyStore(state => state.defaultCurrency);
  const setDefaultCurrency = useCurrencyStore(state => state.setDefaultCurrency);

  return (
    <ScreenContainer>
      <View style={s.card}>
        <View style={s.cardHeader}>
          <Icon name="currency-usd" size={22} color={colors.text} />
          <Text style={s.cardTitle}>Moneda predeterminada</Text>
        </View>
        <Text style={s.cardText}>
          Elige la moneda que usarás al registrar gastos. Los montos siempre se guardan en MXN.
        </Text>

        <View style={s.list}>
          {SUPPORTED_CURRENCIES.map((cur, idx) => {
            const isSelected = defaultCurrency === cur;
            return (
              <Pressable
                key={cur}
                style={[
                  s.row,
                  idx === SUPPORTED_CURRENCIES.length - 1 && s.rowLast,
                  isSelected && s.rowSelected,
                ]}
                onPress={() => setDefaultCurrency(cur)}
              >
                <View style={[s.symbolBox, isSelected && s.symbolBoxActive]}>
                  <Text style={[s.symbol, isSelected && s.symbolActive]}>
                    {CURRENCY_SYMBOLS[cur]}
                  </Text>
                </View>
                <View style={s.info}>
                  <Text style={s.curCode}>{cur}</Text>
                  <Text style={s.curName}>{CURRENCY_NAMES[cur]}</Text>
                </View>
                <View
                  style={[
                    s.radio,
                    isSelected && s.radioSelected,
                  ]}
                >
                  {isSelected ? (
                    <Icon name="check" size={14} color={colors.white} />
                  ) : null}
                </View>
              </Pressable>
            );
          })}
        </View>
      </View>

      <View style={s.infoCard}>
        <Icon name="information-outline" size={20} color={colors.textMuted} />
        <Text style={s.infoText}>
          El tipo de cambio se obtiene automáticamente y se actualiza cada 6 horas. Cuando no hay
          conexión, se usan tasas de referencia.
        </Text>
      </View>

      <View style={{ height: 24 }} />
    </ScreenContainer>
  );
}

const useStyles = (colors: ColorPalette, _isDark: boolean) =>
  StyleSheet.create({
    card: {
      backgroundColor: colors.surface,
      borderRadius: 20,
      padding: 18,
      borderWidth: 1,
      borderColor: colors.border,
      gap: 14,
    },
    cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    cardTitle: { color: colors.text, fontSize: 18, fontFamily: font.bold },
    cardText: { color: colors.textMuted, lineHeight: 22 },
    list: {
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.border,
      overflow: 'hidden',
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 14,
      paddingHorizontal: 16,
      paddingVertical: 14,
      backgroundColor: colors.surface,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    rowLast: { borderBottomWidth: 0 },
    rowSelected: { backgroundColor: colors.primary + '08' },
    symbolBox: {
      width: 44,
      height: 44,
      borderRadius: 12,
      backgroundColor: colors.surfaceAlt,
      alignItems: 'center',
      justifyContent: 'center',
    },
    symbolBoxActive: { backgroundColor: colors.primary + '20' },
    symbol: {
      fontSize: 16,
      fontFamily: font.extrabold,
      color: colors.textMuted,
    },
    symbolActive: { color: colors.primary },
    info: { flex: 1, gap: 2 },
    curCode: {
      color: colors.text,
      fontSize: 16,
      fontFamily: font.bold,
    },
    curName: {
      color: colors.textMuted,
      fontSize: 12,
    },
    radio: {
      width: 24,
      height: 24,
      borderRadius: 12,
      borderWidth: 2,
      borderColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    radioSelected: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    infoCard: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 10,
      backgroundColor: colors.surface,
      borderRadius: 16,
      padding: 16,
      borderWidth: 1,
      borderColor: colors.border,
    },
    infoText: {
      flex: 1,
      color: colors.textMuted,
      fontSize: 13,
      lineHeight: 20,
    },
  });
