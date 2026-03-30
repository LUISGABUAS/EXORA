import React, { useMemo, useState } from 'react';
import { Alert, FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ExpenseCard } from '../components/ExpenseCard';
import { ExpenseForm } from '../components/ExpenseForm';
import { ScreenContainer } from '../components/ScreenContainer';
import { RootStackParamList } from '../navigation/AppNavigator';
import { useExpenseStore } from '../store/useExpenseStore';
import { colors } from '../theme/colors';
import { ExpenseCategory, ExpenseInput } from '../types/expense';

const categories: Array<ExpenseCategory | 'Todas'> = ['Todas', 'Comida', 'Transporte', 'Entretenimiento', 'Salud', 'Educacion', 'Otros'];

export function HistoryScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const expenses = useExpenseStore((state) => state.expenses);
  const addExpense = useExpenseStore((state) => state.addExpense);
  const [showForm, setShowForm] = useState(false);
  const [query, setQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<ExpenseCategory | 'Todas'>('Todas');

  const filteredExpenses = useMemo(() => {
    return expenses.filter((e) => {
      const matchesQuery =
        !query ||
        `${e.merchantName} ${e.description} ${e.conceptsText}`.toLowerCase().includes(query.toLowerCase());
      const matchesCategory = selectedCategory === 'Todas' || e.category === selectedCategory;
      return matchesQuery && matchesCategory;
    });
  }, [expenses, query, selectedCategory]);

  const saveManualExpense = async (payload: ExpenseInput) => {
    await addExpense({ ...payload, source: 'manual' });
    setShowForm(false);
    Alert.alert('Guardado', 'El gasto manual fue registrado.');
  };

  return (
    <ScreenContainer>
      <View style={styles.header}>
        <Text style={styles.title}>Historial de gastos</Text>
        <Pressable style={styles.addButton} onPress={() => setShowForm((v) => !v)}>
          <Text style={styles.addButtonText}>{showForm ? 'Cerrar' : 'Nuevo gasto'}</Text>
        </Pressable>
      </View>

      <TextInput
        placeholder="Buscar por comercio o descripcion"
        placeholderTextColor={colors.textMuted}
        style={styles.search}
        value={query}
        onChangeText={setQuery}
      />

      <View style={styles.filters}>
        {categories.map((cat) => (
          <Pressable
            key={cat}
            style={[styles.chip, selectedCategory === cat && styles.chipActive]}
            onPress={() => setSelectedCategory(cat)}
          >
            <Text style={[styles.chipText, selectedCategory === cat && styles.chipTextActive]}>{cat}</Text>
          </Pressable>
        ))}
      </View>

      {showForm ? <ExpenseForm submitLabel="Guardar gasto manual" onSubmit={saveManualExpense} /> : null}

      <FlatList
        data={filteredExpenses}
        keyExtractor={(item) => String(item.id)}
        renderItem={({ item }) => (
          <ExpenseCard
            expense={item}
            onPress={() => navigation.navigate('ExpenseDetail', { expenseId: item.id })}
          />
        )}
        ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
        ListEmptyComponent={<Text style={styles.empty}>Aun no hay gastos para este filtro.</Text>}
        scrollEnabled={false}
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 },
  title: { flex: 1, color: colors.text, fontSize: 28, fontWeight: '800' },
  addButton: { backgroundColor: colors.secondary, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 999 },
  addButtonText: { color: colors.white, fontWeight: '700' },
  search: { borderWidth: 1, borderColor: colors.border, borderRadius: 16, backgroundColor: colors.surface, paddingHorizontal: 14, paddingVertical: 12, color: colors.text },
  filters: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: colors.surfaceAlt },
  chipActive: { backgroundColor: colors.accent },
  chipText: { color: colors.text, fontSize: 12, fontWeight: '600' },
  chipTextActive: { color: colors.white },
  empty: { color: colors.textMuted, textAlign: 'center', paddingVertical: 24 },
});
