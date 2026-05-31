import { create } from 'zustand';
import { getAllIncomes, createIncome, updateIncome, deleteIncome } from '../database/incomeRepository';
import { supabase } from '../lib/supabase';
import { Income, IncomeInput } from '../types/income';

async function getUserId(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return data.session?.user.id ?? null;
}

async function syncAdd(localId: number, input: IncomeInput, userId: string) {
  await supabase.from('incomes').upsert({
    user_id: userId,
    local_id: localId,
    amount: input.amount,
    date: input.date,
    type: input.type,
    description: input.description,
    invoiced: input.invoiced,
    recurring: input.recurring,
    payment_method: input.paymentMethod,
  }, { onConflict: 'user_id,local_id' });
}

async function syncUpdate(localId: number, input: IncomeInput, userId: string) {
  await supabase.from('incomes')
    .update({
      amount: input.amount,
      date: input.date,
      type: input.type,
      description: input.description,
      invoiced: input.invoiced,
      recurring: input.recurring,
      payment_method: input.paymentMethod,
    })
    .eq('user_id', userId)
    .eq('local_id', localId);
}

async function syncDelete(localId: number, userId: string) {
  await supabase.from('incomes')
    .delete()
    .eq('user_id', userId)
    .eq('local_id', localId);
}

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
    getUserId().then(uid => { if (uid) syncAdd(id, input, uid).catch(() => {}); });
    return id;
  },

  editIncome: async (id, input) => {
    await updateIncome(id, input);
    await get().loadIncomes();
    getUserId().then(uid => { if (uid) syncUpdate(id, input, uid).catch(() => {}); });
  },

  removeIncome: async id => {
    await deleteIncome(id);
    await get().loadIncomes();
    getUserId().then(uid => { if (uid) syncDelete(id, uid).catch(() => {}); });
  },
}));
