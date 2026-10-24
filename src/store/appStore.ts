import { create } from "zustand";
import { deleteSessionItem, getSessionItem, setSessionItem } from "@/services/sessionStorage";
import type { Note, NoteFilter } from "@/types/note";
import type { ThemeMode } from "@/theme/tokens";

type ThemePreference = ThemeMode | "system";
type AppState = {
  token: string | null;
  accountId: string | null;
  sessionExpired: boolean;
  notes: Note[];
  filter: NoteFilter;
  search: string;
  themeMode: ThemePreference;
  ready: boolean;
  setNotes: (notes: Note[]) => void;
  setFilter: (filter: NoteFilter) => void;
  setSearch: (search: string) => void;
  setThemeMode: (mode: ThemePreference) => void;
  setToken: (token: string, accountId: string) => Promise<void>;
  markSessionExpired: (rejectedToken: string) => void;
  restoreSession: () => Promise<void>;
  signOut: () => Promise<void>;
};
const TOKEN_KEY = "field-notes.jwt";
const ACCOUNT_KEY = "field-notes.account-id";

export const useAppStore = create<AppState>((set) => ({
  token: null, accountId: null, sessionExpired: false, notes: [], filter: "all", search: "", themeMode: "system", ready: false,
  setNotes: (notes) => set({ notes }), setFilter: (filter) => set({ filter }), setSearch: (search) => set({ search }),
  setThemeMode: (themeMode) => set({ themeMode }),
  setToken: async (token, accountId) => { await setSessionItem(TOKEN_KEY, token); await setSessionItem(ACCOUNT_KEY, accountId); set({ token, accountId, sessionExpired: false, ready: true }); },
  markSessionExpired: (rejectedToken) => set((state) => state.token === rejectedToken ? { sessionExpired: true } : state),
  restoreSession: async () => { const [token, accountId] = await Promise.all([getSessionItem(TOKEN_KEY), getSessionItem(ACCOUNT_KEY)]); set({ token, accountId, sessionExpired: false, ready: true }); },
  signOut: async () => { await deleteSessionItem(TOKEN_KEY); await deleteSessionItem(ACCOUNT_KEY); set({ token: null, accountId: null, sessionExpired: false, notes: [], search: "", filter: "all" }); },
}));

export const selectToken = (state: AppState) => state.token;
export const selectNotes = (state: AppState) => state.notes;
