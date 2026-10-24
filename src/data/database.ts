import * as SQLite from "expo-sqlite";
import type { Note, SyncQueueItem } from "@/types/note";
import { localDayBounds } from "@/utils/dates";

let dbPromise: Promise<SQLite.SQLiteDatabase> | undefined;
export function database() {
  dbPromise ??= SQLite.openDatabaseAsync("field-notes.db");
  return dbPromise;
}

export async function initializeDatabase() {
  const db = await database();
  await db.execAsync(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS notes (
      id TEXT PRIMARY KEY NOT NULL, title TEXT NOT NULL, body TEXT NOT NULL,
      owner_id TEXT,
      status TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
      photo_uri TEXT, lat REAL, lng REAL, sync_error TEXT, attempts INTEGER NOT NULL DEFAULT 0,
      version INTEGER NOT NULL DEFAULT 1, server_snapshot TEXT
    );
    CREATE TABLE IF NOT EXISTS sync_queue (
      note_id TEXT PRIMARY KEY NOT NULL, action TEXT NOT NULL, attempts INTEGER NOT NULL DEFAULT 0,
      enqueued_at TEXT NOT NULL, FOREIGN KEY(note_id) REFERENCES notes(id) ON DELETE CASCADE
    );
  `);
  const columns = await db.getAllAsync<{ name: string }>("PRAGMA table_info(notes)");
  if (!columns.some((column) => column.name === "owner_id")) await db.execAsync("ALTER TABLE notes ADD COLUMN owner_id TEXT");
  await db.execAsync("CREATE INDEX IF NOT EXISTS notes_owner_created_idx ON notes(owner_id, created_at DESC)");
}

function fromRow(row: Record<string, unknown>): Note {
  return {
    id: String(row.id), title: String(row.title), body: String(row.body), status: row.status as Note["status"],
    createdAt: String(row.created_at), updatedAt: String(row.updated_at), photoUri: row.photo_uri as string | null,
    lat: row.lat as number | null, lng: row.lng as number | null, syncError: row.sync_error as string | null,
    attempts: Number(row.attempts), version: Number(row.version),
  };
}

export async function adoptUnownedNotes(ownerId: string) {
  const db = await database();
  await db.withTransactionAsync(async () => {
    await db.runAsync("UPDATE notes SET owner_id=? WHERE owner_id IS NULL", ownerId);
  });
}
export async function countUnownedNotes(): Promise<number> {
  const db = await database();
  const row = await db.getFirstAsync<{ count: number }>("SELECT COUNT(*) AS count FROM notes WHERE owner_id IS NULL");
  return Number(row?.count ?? 0);
}
export async function listNotes(ownerId: string): Promise<Note[]> {
  const db = await database();
  return (await db.getAllAsync<Record<string, unknown>>("SELECT * FROM notes WHERE owner_id=? ORDER BY created_at DESC", ownerId)).map(fromRow);
}
export async function getNote(id: string, ownerId: string): Promise<Note | null> {
  const db = await database();
  const row = await db.getFirstAsync<Record<string, unknown>>("SELECT * FROM notes WHERE id = ? AND owner_id=?", id, ownerId);
  return row ? fromRow(row) : null;
}
export async function saveNote(note: Note, ownerId: string, queue = true) {
  const db = await database();
  await db.withTransactionAsync(async () => {
    await db.runAsync(
      `INSERT INTO notes (id,title,body,owner_id,status,created_at,updated_at,photo_uri,lat,lng,sync_error,attempts,version)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET
       title=excluded.title,body=excluded.body,status=excluded.status,updated_at=excluded.updated_at,
       photo_uri=excluded.photo_uri,lat=excluded.lat,lng=excluded.lng,sync_error=excluded.sync_error,
       attempts=excluded.attempts,version=excluded.version WHERE notes.owner_id=excluded.owner_id`,
      note.id,note.title,note.body,ownerId,note.status,note.createdAt,note.updatedAt,note.photoUri ?? null,
      note.lat ?? null,note.lng ?? null,note.syncError ?? null,note.attempts,note.version,
    );
    if (queue) await db.runAsync("INSERT INTO sync_queue(note_id,action,attempts,enqueued_at) SELECT id,'upsert',0,? FROM notes WHERE id=? AND owner_id=? ON CONFLICT(note_id) DO UPDATE SET action='upsert', enqueued_at=excluded.enqueued_at, attempts=0", new Date().toISOString(),note.id,ownerId);
  });
}
export async function enqueue(noteId: string, ownerId: string) {
  const db = await database();
  await db.runAsync("INSERT INTO sync_queue(note_id,action,attempts,enqueued_at) SELECT id, 'upsert', 0, ? FROM notes WHERE id=? AND owner_id=? ON CONFLICT(note_id) DO UPDATE SET action='upsert', enqueued_at=excluded.enqueued_at", new Date().toISOString(), noteId, ownerId);
}
export async function queuedNotes(ownerId: string): Promise<(SyncQueueItem & { note: Note })[]> {
  const db = await database();
  const rows = await db.getAllAsync<Record<string, unknown>>(`SELECT q.note_id,q.action,q.attempts,q.enqueued_at,n.* FROM sync_queue q JOIN notes n ON n.id=q.note_id WHERE n.owner_id=? ORDER BY q.enqueued_at`, ownerId);
  return rows.map((row) => ({ noteId: String(row.note_id), action: "upsert", attempts: Number(row.attempts), enqueuedAt: String(row.enqueued_at), note: fromRow(row) }));
}
export async function recoverOfflineFailures(ownerId: string) {
  const db = await database();
  const failed = await db.getAllAsync<{ id: string; sync_error: string | null }>(
    "SELECT id,sync_error FROM notes WHERE owner_id=? AND status='failed'",
    ownerId,
  );
  const offlineMarkers = ["offline", "fetch failed", "network request failed", "network error", "no internet", "failed to connect", "failed host lookup", "unable to resolve host", "network is unreachable"];
  const recoverable = failed.filter(({ sync_error }) => {
    const message = sync_error?.toLowerCase() ?? "";
    return offlineMarkers.some((marker) => message.includes(marker));
  });
  if (recoverable.length === 0) return;

  const now = new Date().toISOString();
  await db.withTransactionAsync(async () => {
    for (const note of recoverable) {
      await db.runAsync(
        "UPDATE notes SET status='queued',sync_error=NULL,attempts=0,updated_at=? WHERE id=? AND owner_id=? AND status='failed'",
        now, note.id, ownerId,
      );
      await db.runAsync(
        "INSERT INTO sync_queue(note_id,action,attempts,enqueued_at) SELECT id,'upsert',0,? FROM notes WHERE id=? AND owner_id=? AND status='queued' ON CONFLICT(note_id) DO UPDATE SET action='upsert',attempts=0,enqueued_at=excluded.enqueued_at",
        now, note.id, ownerId,
      );
    }
  });
}
export async function setNoteStatus(id: string, ownerId: string, status: Note["status"], error: string | null, attempts: number, version?: number) {
  const db = await database();
  await db.runAsync("UPDATE notes SET status=?,sync_error=?,attempts=?,version=COALESCE(?,version),updated_at=? WHERE id=? AND owner_id=?", status,error,attempts,version ?? null,new Date().toISOString(),id,ownerId);
}
export async function finishSync(id: string, ownerId: string, status: "synced" | "conflict", error: string | null, attempts: number, version?: number, snapshot?: Note) {
  const db = await database();
  await db.withTransactionAsync(async () => {
    await db.runAsync("UPDATE notes SET status=?,sync_error=?,attempts=?,version=COALESCE(?,version),updated_at=? WHERE id=? AND owner_id=?", status,error,attempts,version ?? null,new Date().toISOString(),id,ownerId);
    if (snapshot) await db.runAsync("UPDATE notes SET server_snapshot=? WHERE id=? AND owner_id=?", JSON.stringify(snapshot),id,ownerId);
    await db.runAsync("DELETE FROM sync_queue WHERE note_id IN (SELECT id FROM notes WHERE id=? AND owner_id=?)",id,ownerId);
  });
}
export async function retrySync(id: string, ownerId: string) {
  const db = await database();
  await db.withTransactionAsync(async () => {
    await db.runAsync("UPDATE notes SET status='queued',sync_error=NULL,attempts=0 WHERE id=? AND owner_id=?",id,ownerId);
    await db.runAsync("INSERT INTO sync_queue(note_id,action,attempts,enqueued_at) SELECT id,'upsert',0,? FROM notes WHERE id=? AND owner_id=? ON CONFLICT(note_id) DO UPDATE SET action='upsert', attempts=0, enqueued_at=excluded.enqueued_at",new Date().toISOString(),id,ownerId);
  });
}
export async function recoverAuthFailures(ownerId: string) {
  const db = await database();
  const failed = await db.getAllAsync<{ id: string; sync_error: string | null }>(
    "SELECT id,sync_error FROM notes WHERE owner_id=? AND status='failed'",
    ownerId,
  );
  for (const note of failed) {
    if (/invalid or expired token|bearer token required|request failed \(401\)/i.test(note.sync_error ?? "")) {
      await retrySync(note.id, ownerId);
    }
  }
}
export async function finishFailedSync(id: string, ownerId: string, error: string, attempts: number) {
  const db = await database();
  await db.withTransactionAsync(async () => {
    await db.runAsync("UPDATE notes SET status='failed',sync_error=?,attempts=?,updated_at=? WHERE id=? AND owner_id=?",error,attempts,new Date().toISOString(),id,ownerId);
    await db.runAsync("DELETE FROM sync_queue WHERE note_id IN (SELECT id FROM notes WHERE id=? AND owner_id=?)",id,ownerId);
  });
}
export async function removeFromQueue(id: string, ownerId: string) {
  const db = await database();
  await db.runAsync("DELETE FROM sync_queue WHERE note_id IN (SELECT id FROM notes WHERE id=? AND owner_id=?)", id, ownerId);
}
export async function updateQueueAttempts(id: string, ownerId: string, attempts: number) {
  const db = await database();
  await db.runAsync("UPDATE sync_queue SET attempts=? WHERE note_id IN (SELECT id FROM notes WHERE id=? AND owner_id=?)", attempts,id,ownerId);
}
export async function setServerSnapshot(id: string, ownerId: string, snapshot: Note) {
  const db = await database();
  await db.runAsync("UPDATE notes SET server_snapshot=? WHERE id=? AND owner_id=?", JSON.stringify(snapshot),id,ownerId);
}
export async function getServerSnapshot(id: string, ownerId: string): Promise<Note | null> {
  const db = await database();
  const row = await db.getFirstAsync<{ server_snapshot: string | null }>("SELECT server_snapshot FROM notes WHERE id=? AND owner_id=?",id,ownerId);
  return row?.server_snapshot ? JSON.parse(row.server_snapshot) as Note : null;
}
export async function pauseSyncQueue(ownerId: string) {
  const db = await database();
  await db.withTransactionAsync(async () => {
    await db.runAsync("UPDATE notes SET status='draft', sync_error=NULL, attempts=0 WHERE owner_id=? AND status IN ('queued','failed')",ownerId);
    await db.runAsync("DELETE FROM sync_queue WHERE note_id IN (SELECT id FROM notes WHERE owner_id=?)",ownerId);
  });
}
export async function exportNotesForDay(day: string, ownerId: string): Promise<Note[]> {
  const bounds = localDayBounds(day);
  if (!bounds) return [];
  const db = await database();
  return (await db.getAllAsync<Record<string, unknown>>("SELECT * FROM notes WHERE owner_id=? AND created_at>=? AND created_at<? ORDER BY created_at",ownerId,bounds.start,bounds.end)).map(fromRow);
}
