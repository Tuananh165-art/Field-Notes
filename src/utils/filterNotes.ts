import type { Note, NoteFilter } from "@/types/note";

export function filterNotes(notes: Note[], query: string, filter: NoteFilter): Note[] {
  const normalized = query.trim().toLocaleLowerCase();
  return notes.filter((note) => {
    const matchesStatus = filter === "all" || note.status === filter;
    const matchesText = !normalized || `${note.title} ${note.body}`.toLocaleLowerCase().includes(normalized);
    return matchesStatus && matchesText;
  });
}

export function csvEscape(value: string): string {
	const safeValue = /^[\t\r ]*[=+\-@]/.test(value) ? `'${value}` : value;
	return `"${safeValue.replaceAll('"', '""')}"`;
}
