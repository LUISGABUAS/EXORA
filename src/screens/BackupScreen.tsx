import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { useEffect, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { ScreenContainer } from '../components/ScreenContainer';
import { exportBackup, importBackup } from '../services/backupService';
import { useExpenseStore } from '../store/useExpenseStore';
import { ColorPalette } from '../theme/colors';
import { useTheme } from '../theme/ThemeContext';
import { formatDate } from '../utils/format';

const LAST_EXPORT_KEY = '@expensia_last_export';

export function BackupScreen() {
  const { colors, isDark } = useTheme();
  const s = useStyles(colors, isDark);
  const loadExpenses = useExpenseStore(state => state.loadExpenses);

  const [lastExport, setLastExport] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(LAST_EXPORT_KEY).then(val => {
      if (val) setLastExport(val);
    });
  }, []);

  const handleExport = async () => {
    setExporting(true);
    try {
      await exportBackup();
      const now = new Date().toISOString();
      await AsyncStorage.setItem(LAST_EXPORT_KEY, now);
      setLastExport(now);
      Alert.alert('Backup exportado', 'Tu backup se exportó correctamente.');
    } catch (err: any) {
      if (err?.message !== 'User did not share') {
        Alert.alert(
          'Error',
          err instanceof Error ? err.message : 'No se pudo exportar el backup.',
        );
      }
    } finally {
      setExporting(false);
    }
  };

  const handleImport = async () => {
    setImporting(true);
    try {
      const result = await importBackup();
      await loadExpenses();
      Alert.alert(
        'Importación completada',
        `Se importaron ${result.imported} gasto${result.imported !== 1 ? 's' : ''} correctamente.${
          result.errors > 0
            ? `\n${result.errors} gasto${result.errors !== 1 ? 's' : ''} no pudo${result.errors !== 1 ? 'ron' : ''} importarse.`
            : ''
        }`,
      );
    } catch (err: any) {
      if (err?.message === 'CANCELLED') {
        // User cancelled — do nothing
      } else {
        Alert.alert(
          'Error al importar',
          err instanceof Error ? err.message : 'No se pudo importar el backup.',
        );
      }
    } finally {
      setImporting(false);
    }
  };

  const lastExportLabel = lastExport
    ? formatDate(lastExport.slice(0, 10))
    : null;

  return (
    <ScreenContainer>
      <View style={s.card}>
        <View style={s.cardHeader}>
          <Icon name="database-export-outline" size={22} color={colors.text} />
          <Text style={s.cardTitle}>Exportar datos</Text>
        </View>
        <Text style={s.cardText}>
          Genera un archivo JSON con todos tus gastos registrados. Puedes guardarlo en iCloud,
          Google Drive o compartirlo por cualquier app.
        </Text>

        {lastExportLabel ? (
          <View style={s.infoRow}>
            <Icon name="clock-outline" size={16} color={colors.textMuted} />
            <Text style={s.infoText}>Último backup: {lastExportLabel}</Text>
          </View>
        ) : (
          <View style={s.infoRow}>
            <Icon name="information-outline" size={16} color={colors.textMuted} />
            <Text style={s.infoText}>Nunca has exportado un backup.</Text>
          </View>
        )}

        <View style={s.detailsBox}>
          <View style={s.detailRow}>
            <Icon name="check-circle-outline" size={14} color={colors.primary} />
            <Text style={s.detailText}>Todos tus gastos</Text>
          </View>
          <View style={s.detailRow}>
            <Icon name="check-circle-outline" size={14} color={colors.primary} />
            <Text style={s.detailText}>Comercio, categoría, RFC y monto</Text>
          </View>
          <View style={s.detailRow}>
            <Icon name="check-circle-outline" size={14} color={colors.primary} />
            <Text style={s.detailText}>Fechas y estado de deducibilidad</Text>
          </View>
        </View>

        <Pressable
          style={[s.button, exporting && s.buttonDisabled]}
          onPress={handleExport}
          disabled={exporting}
        >
          <Icon name="download" size={18} color={colors.white} />
          <Text style={s.buttonText}>
            {exporting ? 'Exportando…' : 'Exportar datos'}
          </Text>
        </Pressable>
      </View>

      <View style={s.card}>
        <View style={s.cardHeader}>
          <Icon name="database-import-outline" size={22} color={colors.text} />
          <Text style={s.cardTitle}>Importar backup</Text>
        </View>
        <Text style={s.cardText}>
          Selecciona un archivo JSON previamente exportado desde Expensia para restaurar tus gastos.
        </Text>

        <View style={s.warningBox}>
          <Icon name="alert-circle-outline" size={18} color={colors.warning} />
          <Text style={s.warningText}>
            Los gastos del backup se agregarán a los actuales. No se borrará ningún dato existente.
          </Text>
        </View>

        <Pressable
          style={[s.buttonOutline, importing && s.buttonDisabled]}
          onPress={handleImport}
          disabled={importing}
        >
          <Icon name="upload" size={18} color={colors.primary} />
          <Text style={s.buttonOutlineText}>
            {importing ? 'Importando…' : 'Importar backup'}
          </Text>
        </Pressable>
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
    cardTitle: { color: colors.text, fontSize: 18, fontWeight: '700' },
    cardText: { color: colors.textMuted, lineHeight: 22 },
    infoRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    infoText: { color: colors.textMuted, fontSize: 13 },
    detailsBox: {
      backgroundColor: colors.primary + '10',
      borderRadius: 14,
      padding: 14,
      gap: 8,
    },
    detailRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    detailText: { color: colors.text, fontSize: 13, fontWeight: '600' },
    warningBox: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 10,
      backgroundColor: colors.warning + '18',
      borderRadius: 14,
      padding: 14,
    },
    warningText: {
      flex: 1,
      color: colors.text,
      fontSize: 13,
      lineHeight: 20,
    },
    button: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      backgroundColor: colors.primary,
      paddingVertical: 14,
      borderRadius: 16,
    },
    buttonOutline: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      borderWidth: 1.5,
      borderColor: colors.primary,
      paddingVertical: 14,
      borderRadius: 16,
    },
    buttonDisabled: { opacity: 0.6 },
    buttonText: { color: colors.white, fontWeight: '700', fontSize: 15 },
    buttonOutlineText: { color: colors.primary, fontWeight: '700', fontSize: 15 },
  });
