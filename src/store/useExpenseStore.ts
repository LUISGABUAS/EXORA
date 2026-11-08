import { create } from 'zustand';
import {
  getAllExpenses,
  createExpense,
  updateExpense,
  deleteExpense,
} from '../database/expenseRepository';
import { addToSyncQueue } from '../database/syncQueue';
import { trackExpenseForRating } from '../services/ratingService';
import { notifyBudgetAlert } from '../services/notificationService';
import { useBudgetStore } from './useBudgetStore';
import { Expense, ExpenseCategory, ExpenseInput } from '../types/expense';
import { localDateString } from '../utils/format';
import { syncWidgetData } from '../utils/widgetBridge';
import { useIncomeStore } from './useIncomeStore';
import { track } from '../services/analyticsService';

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
      syncWidgetData(expenses, useIncomeStore.getState().incomes);
    } finally {
      set({ loading: false });
    }
  },

  addExpense: async expense => {
    const id = await createExpense(expense);
    await addToSyncQueue('insert', id, expense as Record<string, any>);
    const expenses = await getAllExpenses();
    set({ expenses });
    syncWidgetData(expenses, useIncomeStore.getState().incomes);
    track('expense_created', {
      category: expense.category,
      source: expense.source,
    });
    trackExpenseForRating().catch(() => {});
    // Budget alert — check if category crossed 80% or 100%
    try {
      const budgets = useBudgetStore.getState().budgets;
      const limit = budgets[expense.category as ExpenseCategory];
      if (limit && limit > 0) {
        const now = new Date();
        const monthPrefix = localDateString(now).slice(0, 7);
        const spent = expenses
          .filter(
            e =>
              e.category === expense.category && e.date.startsWith(monthPrefix),
          )
          .reduce((sum, e) => sum + e.amount, 0);
        notifyBudgetAlert(expense.category, spent, limit);
      }
    } catch {
      // never block the main flow
    }
  },

  editExpense: async (id, expense) => {
    await updateExpense(id, expense);
    await addToSyncQueue('update', id, expense as Record<string, any>);
    const expenses = await getAllExpenses();
    set({ expenses });
    syncWidgetData(expenses, useIncomeStore.getState().incomes);
  },

  removeExpense: async id => {
    await deleteExpense(id);
    await addToSyncQueue('delete', id);
    const expenses = get().expenses.filter(e => e.id !== id);
    set({ expenses });
    syncWidgetData(expenses, useIncomeStore.getState().incomes);
  },

  getExpense: id => get().expenses.find(e => e.id === id),
}));
