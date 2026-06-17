import { create } from 'zustand';

type DeepLinkAction = 'add-expense' | 'add-income' | null;

interface DeepLinkState {
  pendingAction: DeepLinkAction;
  setPendingAction: (action: DeepLinkAction) => void;
  clearPendingAction: () => void;
}

export const useDeepLinkStore = create<DeepLinkState>(set => ({
  pendingAction: null,
  setPendingAction: action => set({ pendingAction: action }),
  clearPendingAction: () => set({ pendingAction: null }),
}));
