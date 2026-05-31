import { create } from 'zustand';
import { getAllIncomes, createIncome, updateIncome, deleteIncome } from '../database/incomeRepository';
import { Income, IncomeInput } from '../types/income';

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
    } finally {
      set({ loading: false });
    }
  },

  addIncome: async input => {
    const id = await createIncome(input);
    await get().loadIncomes();
    return id;
  },

  editIncome: async (id, input) => {
    await updateIncome(id, input);
    await get().loadIncomes();
  },

  removeIncome: async id => {
    await deleteIncome(id);
    await get().loadIncomes();
  },
}));
