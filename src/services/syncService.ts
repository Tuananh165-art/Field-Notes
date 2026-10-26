import * as Network from "expo-network";
import { queuedNotes, recoverOfflineFailures, setNoteStatus, updateQueueAttempts, listNotes, finishSync, retrySync, finishFailedSync } from "@/data/database";
import { useAppStore } from "@/store/appStore";
import { ApiError, noteApi } from "./noteApi";

let running = false;
let rerunRequested = false;
const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function isConnectivityFailure(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return /offline|fetch failed|network request failed|network error|no internet|failed to connect|failed host lookup|unable to resolve host|network is unreachable|connection (refused|reset|timed? out)/i.test(message);
}

async function isDeviceOffline() {
  try {
    return (await Network.getNetworkStateAsync()).isConnected === false;
  } catch {
    return false;
  }
}

export async function syncPendingNotes() {
  const ownerId = useAppStore.getState().accountId;
  if (running) {
    rerunRequested = true;
    return;
  }
  if (!useAppStore.getState().token || useAppStore.getState().sessionExpired || !ownerId) return;
  running = true;
  try {
    await recoverOfflineFailures(ownerId);
    if (await isDeviceOffline()) return;
    const items = await queuedNotes(ownerId);
    for (const item of items) {
      if (!useAppStore.getState().token || useAppStore.getState().sessionExpired || useAppStore.getState().accountId !== ownerId) break;
      if (await isDeviceOffline()) break;
      if (item.attempts >= 3) continue;
      let attempts = item.attempts;
      let complete = false;
      let stopQueue = false;

      while (!complete && attempts < 3 && useAppStore.getState().token && !useAppStore.getState().sessionExpired && useAppStore.getState().accountId === ownerId) {
        try {
          const result = await noteApi.sync(item.note);
          if (result.status === "conflict" && result.serverNote) {
            await finishSync(item.noteId, ownerId, "conflict", "Máy chủ có phiên bản mới hơn. Chọn cách xử lý trong chi tiết.", attempts, result.serverNote.version, result.serverNote);
          } else {
            await finishSync(item.noteId, ownerId, "synced", null, 0, result.note.version);
          }
          complete = true;
        } catch (error) {
          if (error instanceof ApiError && error.status === 401) {
            await setNoteStatus(item.noteId, ownerId, "queued", null, attempts);
            stopQueue = true;
            complete = true;
            break;
          }
          if (isConnectivityFailure(error) || await isDeviceOffline()) {
            await setNoteStatus(item.noteId, ownerId, "queued", null, attempts);
            stopQueue = true;
            complete = true;
            break;
          }
          attempts += 1;
          const message = error instanceof Error ? error.message : "Không thể đồng bộ lúc này";
          const permanent = error instanceof ApiError && error.status >= 400 && error.status < 500;
          await updateQueueAttempts(item.noteId, ownerId, attempts);
          if (permanent || attempts >= 3) {
            await finishFailedSync(item.noteId, ownerId, attempts >= 3 ? `Đã thử ${attempts} lần. ${message}` : message, attempts);
            complete = true;
          } else {
            await setNoteStatus(item.noteId, ownerId, "queued", `Lần thử ${attempts}/3 chưa thành công. Sẽ thử lại khi có kết nối.`, attempts);
            await pause(500 * 2 ** (attempts - 1));
          }
        }
      }
      if (stopQueue) break;
    }
  } finally {
    running = false;
    try { if (ownerId === useAppStore.getState().accountId) useAppStore.getState().setNotes(await listNotes(ownerId)); } catch { /* Refresh the local collection when the next screen opens. */ }
    if (rerunRequested) {
      rerunRequested = false;
      void syncPendingNotes();
    }
  }
}

export async function retryNote(id: string) {
  const ownerId = useAppStore.getState().accountId;
  if (!ownerId) return;
  await retrySync(id, ownerId);
  await syncPendingNotes();
}
