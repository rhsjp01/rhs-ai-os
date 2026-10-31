'use client';

import { create } from 'zustand';

export type ViewKey =
  | 'overview'
  | 'properties'
  | 'compliance'
  | 'invoices'
  | 'aeo'
  | 'billing'
  | 'admin'
  | 'wealth';

export interface UpgradePrompt {
  title: string;
  message: string;
}

interface RhsState {
  view: ViewKey;
  setView: (view: ViewKey) => void;
  upgrade: UpgradePrompt | null;
  setUpgrade: (prompt: UpgradePrompt | null) => void;
  tourActive: boolean;
  setTourActive: (active: boolean) => void;
}

export const useRhsStore = create<RhsState>((set) => ({
  view: 'overview',
  setView: (view) => set({ view }),
  upgrade: null,
  setUpgrade: (upgrade) => set({ upgrade }),
  tourActive: false,
  setTourActive: (tourActive) => set({ tourActive }),
}));
