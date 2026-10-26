import * as Linking from "expo-linking";

export function createNoteDeepLink(noteId: string): string {
  return Linking.createURL(`notes/${encodeURIComponent(noteId)}`);
}
