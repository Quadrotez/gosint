import { create } from 'zustand';
import type { Entity } from '../types';
import { getPersonDisplayName } from '../utils';

interface SearchStore {
  isSearchOpen: boolean;
  openSearch: () => void;
  closeSearch: () => void;
}

export const useSearchStore = create<SearchStore>((set) => ({
  isSearchOpen: false,
  openSearch: () => set({ isSearchOpen: true }),
  closeSearch: () => set({ isSearchOpen: false }),
}));

interface SelectionStore {
  selectedEntity: Entity | null;
  setSelectedEntity: (entity: Entity | null) => void;
}

export const useSelectionStore = create<SelectionStore>((set) => ({
  selectedEntity: null,
  setSelectedEntity: (entity) => set({ selectedEntity: entity }),
}));

export { getPersonDisplayName };
