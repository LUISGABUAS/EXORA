import { create } from 'zustand';
import {
  getAllIncomes,
  createIncome,
  updateIncome,
  deleteIncome,
} from '../database/incomeRepository';
import { addToSyncQueue } from '../database/syncQueue';
import { Income, IncomeInput } from '../types/income';
import { syncWidgetData } from '../utils/widgetBridge';
import { useExpenseStore } from './useExpenseStore';

interface IncomeState {
  incomes: Income[];
  loading: boolean;
  loadIncomes: () => Promise<void>;
  addIncome: (input: IncomeInput) => Promise<number>;
  editIncome: (id: number, input: IncomeInput) => Promise<void>;
  removeIncome: (id: number) => Promise<void>;
}

export const useIncomeStore = create<IncomeState>((set, get) => ({
  incomes: [],
  loading: false,

  loadIncomes: async () => {
    set({ loading: true });
    try {
      const incomes = await getAllIncomes();
      set({ incomes });
      syncWidgetData(useExpenseStore.getState().expenses, incomes);
    } finally {
      set({ loading: false });
    }
  },

  addIncome: async input => {
    const id = await createIncome(input);
    await addToSyncQueue('insert', id, input as Record<string, any>, 'income');
    await get().loadIncomes();
    return id;
  },

  editIncome: async (id, input) => {
    await updateIncome(id, input);
    await addToSyncQueue('update', id, input as Record<string, any>, 'income');
    await get().loadIncomes();
  },

  removeIncome: async id => {
    await deleteIncome(id);
    await addToSyncQueue('delete', id, {}, 'income');
    await get().loadIncomes();
  },
}));
