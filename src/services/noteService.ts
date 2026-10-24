import * as ImagePicker from "expo-image-picker";
import * as ImageManipulator from "expo-image-manipulator";
import * as Location from "expo-location";
import * as FileSystem from "expo-file-system/legacy";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import { initializeDatabase, listNotes, saveNote, getNote, removeFromQueue, enqueue, setServerSnapshot } from "@/data/database";
import { syncPendingNotes } from "./syncService";
import { useAppStore } from "@/store/appStore";
import type { Note } from "@/types/note";

async function persistCompressedImage(uri: string): Promise<string> {
  const compressed = await ImageManipulator.manipulateAsync(uri, [{ resize: { width: 1600 } }], { compress: 0.72, format: ImageManipulator.SaveFormat.JPEG, base64: Platform.OS === "web" });
  if (Platform.OS === "web") {
    if (!compressed.base64) throw new Error("Không thể đọc ảnh đã chọn trong trình duyệt.");
    return `data:image/jpeg;base64,${compressed.base64}`;
  }
  const directory = `${FileSystem.documentDirectory}note-images/`;
  await FileSystem.makeDirectoryAsync(directory, { intermediates: true });
  const target = `${directory}${Date.now()}-${Math.floor(Math.random() * 100000)}.jpg`;
  await FileSystem.copyAsync({ from: compressed.uri, to: target });
  return target;
}

export async function pickPhoto(): Promise<string | null> {
  if (Platform.OS !== "web") {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) return null;
  }
  const result = await ImagePicker.launchCameraAsync({ mediaTypes: ["images"], quality: 0.85 });
  if (result.canceled || !result.assets[0]) return null;
  return persistCompressedImage(result.assets[0].uri);
}

export async function pickFromLibrary(): Promise<string | null> {
  if (Platform.OS !== "web") {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) return null;
  }
  const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 0.85 });
  if (result.canceled || !result.assets[0]) return null;
  return persistCompressedImage(result.assets[0].uri);
}

export async function captureLocation() {
  const permission = await Location.requestForegroundPermissionsAsync();
  if (!permission.granted) return null;
  const point = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
  return { lat: point.coords.latitude, lng: point.coords.longitude };
}

export async function createNote(input: { title: string; body: string; photoUri?: string | null; lat?: number | null; lng?: number | null }) {
  const ownerId = useAppStore.getState().accountId;
  if (!ownerId) throw new Error("ÄÄƒng nháº­p Ä‘á»ƒ lÆ°u ghi chÃº trÃªn thiáº¿t bá»‹.");
  await initializeDatabase();
  const now = new Date().toISOString();
  const id = `${Date.now()}-${Math.floor(Math.random() * 1000000)}`;
  const note: Note = { id, title: input.title.trim(), body: input.body.trim(), status: useAppStore.getState().token ? "queued" : "draft", createdAt: now, updatedAt: now, photoUri: input.photoUri ?? null, lat: input.lat ?? null, lng: input.lng ?? null, syncError: null, attempts: 0, version: 1 };
  await saveNote(note, ownerId, note.status !== "draft");
  if (Platform.OS !== "web") {
    try {
      let permission = await Notifications.getPermissionsAsync();
      if (!permission.granted) permission = await Notifications.requestPermissionsAsync();
      if (permission.granted) {
        if (Platform.OS === "android") {
          // Expo re-exports this enum; eslint's import resolver does not follow that re-export.
          // eslint-disable-next-line import/namespace
          await Notifications.setNotificationChannelAsync("sync", { name: "Ghi chú hiện trường", importance: Notifications.AndroidImportance.DEFAULT });
        }
        await Notifications.scheduleNotificationAsync({ content: { title: "Ghi chú đã lưu", body: note.title, data: { url: `/notes/${note.id}` }, ...(Platform.OS === "android" ? { android: { channelId: "sync" } } : {}) }, trigger: null });
      }
    } catch { /* Notifications are optional; local save must remain successful. */ }
  }
  useAppStore.getState().setNotes(await listNotes(ownerId));
  if (note.status === "queued") void syncPendingNotes();
  return note;
}

export async function updateExistingNote(id: string, input: { title: string; body: string; photoUri?: string | null; lat?: number | null; lng?: number | null }) {
  const ownerId = useAppStore.getState().accountId;
  if (!ownerId) throw new Error("ÄÄƒng nháº­p Ä‘á»ƒ chá»‰nh sá»­a ghi chÃº.");
  const existing = await getNote(id, ownerId);
  if (!existing) throw new Error("Không tìm thấy ghi chú để cập nhật.");
  const updated: Note = {
    ...existing, title: input.title.trim(), body: input.body.trim(), photoUri: input.photoUri ?? null,
    lat: input.lat ?? null, lng: input.lng ?? null, updatedAt: new Date().toISOString(),
    status: useAppStore.getState().token ? "queued" : "draft", syncError: null, attempts: 0,
  };
  await saveNote(updated, ownerId, false);
  if (updated.status === "queued") { await enqueue(updated.id, ownerId); void syncPendingNotes(); }
  useAppStore.getState().setNotes(await listNotes(ownerId));
  return updated;
}

export async function refreshNotes() {
  await initializeDatabase();
  const ownerId = useAppStore.getState().accountId;
  if (!ownerId) { useAppStore.getState().setNotes([]); return []; }
  const notes = await listNotes(ownerId);
  useAppStore.getState().setNotes(notes);
  return notes;
}

export async function resolveConflict(id: string, choice: "server" | "local") {
  const ownerId = useAppStore.getState().accountId;
  if (!ownerId) return;
  const local = await getNote(id, ownerId);
  if (!local || local.status !== "conflict") return;
  const db = await import("@/data/database");
  const server = await db.getServerSnapshot(id, ownerId);
  if (choice === "server" && server) {
    await db.saveNote({ ...server, status: "synced", syncError: null, attempts: 0 }, ownerId, false);
    await removeFromQueue(id, ownerId);
  } else {
    if (server) await setServerSnapshot(id, ownerId, server);
    await db.setNoteStatus(id, ownerId, "queued", null, 0, server?.version);
    await db.enqueue(id, ownerId);
    void syncPendingNotes();
  }
  useAppStore.getState().setNotes(await listNotes(ownerId));
}
