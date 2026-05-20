import { create } from "zustand";

interface FilterState {
  tool: string | null;
  query: string;
  setTool: (t: string | null) => void;
  setQuery: (q: string) => void;
  clear: () => void;
}

export const useFilters = create<FilterState>((set) => ({
  tool: null,
  query: "",
  setTool: (tool) => set({ tool }),
  setQuery: (query) => set({ query }),
  clear: () => set({ tool: null, query: "" }),
}));
