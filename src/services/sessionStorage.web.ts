// Browser sessions stay in this tab and are not stored in persistent localStorage.
const memory = new Map<string, string | null>();

export async function getSessionItem(key: string): Promise<string | null> {
  if (memory.has(key)) return memory.get(key) ?? null;
  try { return globalThis.sessionStorage?.getItem(key) ?? null; }
  catch { return null; }
}

export async function setSessionItem(key: string, value: string): Promise<void> {
  memory.set(key, value);
  try { globalThis.sessionStorage?.setItem(key, value); } catch { /* Keep the session in memory if browser storage is unavailable. */ }
}

export async function deleteSessionItem(key: string): Promise<void> {
  memory.set(key, null);
  try { globalThis.sessionStorage?.removeItem(key); } catch { /* The in-memory copy was already cleared. */ }
}
