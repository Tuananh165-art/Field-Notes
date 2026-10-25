import * as FileSystem from "expo-file-system/legacy";
import type { Note } from "@/types/note";
import { useAppStore } from "@/store/appStore";
import { getSessionItem } from "./sessionStorage";

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:8080/api/v1";
export class ApiError extends Error {
  constructor(message: string, public readonly status: number) { super(message); }
}
async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = await getSessionItem("field-notes.jwt");
  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}), ...init.headers },
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => ({})) as { error?: string };
    if (response.status === 401 && token && path.startsWith("/notes")) useAppStore.getState().markSessionExpired(token);
    throw new ApiError(payload.error ?? `Request failed (${response.status})`, response.status);
  }
  return response.json() as Promise<T>;
}

export type AuthResponse = { token: string; user: { id: string; email: string } };
export const authApi = {
  signIn: (email: string, password: string) => request<AuthResponse>("/auth/login", { method: "POST", body: JSON.stringify({ email,password }) }),
  signUp: (email: string, password: string) => request<AuthResponse>("/auth/register", { method: "POST", body: JSON.stringify({ email,password }) }),
  requestPasswordReset: (email: string) => request<{ message: string }>("/auth/password-reset/request", { method: "POST", body: JSON.stringify({ email }) }),
  confirmPasswordReset: (code: string, password: string) => request<{ message: string }>("/auth/password-reset/confirm", { method: "POST", body: JSON.stringify({ code, password }) }),
};
export type SyncResult = { note: Note; status: "synced" | "conflict"; serverNote?: Note };
export const noteApi = {
  sync: async (note: Note) => {
    let photoUri = note.photoUri;
    if (photoUri?.startsWith("file://")) {
      const base64 = await FileSystem.readAsStringAsync(photoUri, { encoding: FileSystem.EncodingType.Base64 });
      photoUri = `data:image/jpeg;base64,${base64}`;
    }
    return request<SyncResult>("/notes/sync", { method: "POST", body: JSON.stringify({ note: { ...note, photoUri } }) });
  },
  list: () => request<{ notes: Note[] }>("/notes"),
  get: (id: string) => request<{ note: Note }>(`/notes/${encodeURIComponent(id)}`),
};
