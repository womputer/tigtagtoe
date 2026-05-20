import { create } from "zustand";

/** Tracks the active upload across pages. Persisted to localStorage so
 * navigating away and back keeps the user pointed at their data. */

interface UploadState {
  activeUploadId: string | null;
  setActiveUpload: (id: string | null) => void;
  clear: () => void;
}

const STORAGE_KEY = "tigtagtoe.activeUploadId";

function readInitial(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

function persist(id: string | null) {
  if (typeof window === "undefined") return;
  try {
    if (id) window.localStorage.setItem(STORAGE_KEY, id);
    else window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore storage errors (private mode, etc.)
  }
}

export const useUploadStore = create<UploadState>((set) => ({
  activeUploadId: readInitial(),
  setActiveUpload: (id) => {
    persist(id);
    set({ activeUploadId: id });
  },
  clear: () => {
    persist(null);
    set({ activeUploadId: null });
  },
}));
