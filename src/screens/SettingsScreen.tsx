import React from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { ScreenContainer } from '../components/ScreenContainer';
import { exportExpensesToCsv } from '../services/exportService';
import { scheduleDailyReminder } from '../services/notificationService';
import { useExpenseStore } from '../store/useExpenseStore';
import { colors } from '../theme/colors';

export function SettingsScreen() {
  const expenses = useExpenseStore((state) => state.expenses);

  const exportCsv = async () => {
    try {
      await exportExpensesToCsv(expenses);
    } catch (error) {
      Alert.alert('Error', error instanceof Error ? error.message : 'No se pudo exportar.');
    }
  };

  const enableReminder = () => {
    scheduleDailyReminder();
    Alert.alert('Recordatorio activado', 'Recibiras un aviso diario a las 20:00.');
  };

  return (
    <ScreenContainer>
      <View style={styles.hero}>
        <Text style={styles.title}>Configuracion</Text>
        <Text style={styles.subtitle}>Herramientas utiles para mantener tu control financiero al dia.</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Exportar datos</Text>
        <Text style={styles.cardText}>Comparte tus gastos en formato CSV para analisis o respaldo.</Text>
        <Pressable style={styles.button} onPress={exportCsv}>
          <Text style={styles.buttonText}>Exportar CSV</Text>
        </Pressable>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Recordatorio diario</Text>
        <Text style={styles.cardText}>Programa una notificacion para no olvidar registrar tickets y gastos.</Text>
        <Pressable style={styles.secondaryButton} onPress={enableReminder}>
          <Text style={styles.buttonText}>Activar recordatorio</Text>
        </Pressable>
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  hero: { backgroundColor: '#f6ddce', borderRadius: 28, padding: 22, gap: 8 },
  title: { color: colors.text, fontSize: 28, fontWeight: '800' },
  subtitle: { color: colors.textMuted, lineHeight: 22 },
  card: { backgroundColor: colors.surface, borderRadius: 24, padding: 18, borderWidth: 1, borderColor: colors.border, gap: 12 },
  cardTitle: { color: colors.text, fontSize: 18, fontWeight: '700' },
  cardText: { color: colors.textMuted, lineHeight: 22 },
  button: { backgroundColor: colors.text, paddingVertical: 14, borderRadius: 16, alignItems: 'center' },
  secondaryButton: { backgroundColor: colors.primary, paddingVertical: 14, borderRadius: 16, alignItems: 'center' },
  buttonText: { color: colors.white, fontWeight: '700' },
});
