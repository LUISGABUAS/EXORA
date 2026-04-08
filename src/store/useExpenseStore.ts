import { create } from 'zustand';
import {
  getAllExpenses,
  createExpense,
  updateExpense,
  deleteExpense,
} from '../database/expenseRepository';
import { addToSyncQueue } from '../database/syncQueue';
import { Expense, ExpenseInput } from '../types/expense';

interface ExpenseState {
  expenses: Expense[];
  loading: boolean;
  loadExpenses: () => Promise<void>;
  addExpense: (expense: ExpenseInput) => Promise<void>;
  editExpense: (id: number, expense: ExpenseInput) => Promise<void>;
  removeExpense: (id: number) => Promise<void>;
  getExpense: (id: number) => Expense | undefined;
}

export const useExpenseStore = create<ExpenseState>((set, get) => ({
  expenses: [],
  loading: false,

  loadExpenses: async () => {
    set({ loading: true });
    try {
      const expenses = await getAllExpenses();
      set({ expenses });
    } finally {
      set({ loading: false });
    }
  },

  addExpense: async (expense) => {
    const id = await createExpense(expense);
    await addToSyncQueue('insert', id, expense as Record<string, any>);
    const expenses = await getAllExpenses();
    set({ expenses });
  },

  editExpense: async (id, expense) => {
    await updateExpense(id, expense);
    await addToSyncQueue('update', id, expense as Record<string, any>);
    const expenses = await getAllExpenses();
    set({ expenses });
  },

  removeExpense: async (id) => {
    await deleteExpense(id);
    await addToSyncQueue('delete', id);
    set((state) => ({ expenses: state.expenses.filter((e) => e.id !== id) }));
  },

  getExpense: (id) => get().expenses.find((e) => e.id === id),
}));
