export type NoteStatus = "draft" | "queued" | "synced" | "failed" | "conflict";
export type Note = {
  id: string;
  title: string;
  body: string;
  status: NoteStatus;
  createdAt: string;
  updatedAt: string;
  photoUri?: string | null;
  lat?: number | null;
  lng?: number | null;
  syncError?: string | null;
  attempts: number;
  version: number;
};
export type NoteFilter = "all" | "draft" | "queued" | "synced" | "failed" | "conflict";
export type SyncQueueItem = { noteId: string; action: "upsert"; attempts: number; enqueuedAt: string };
