import { csvEscape, filterNotes } from "./filterNotes";
import { formatLocalDay, localDayBounds } from "./dates";
import type { Note } from "@/types/note";

const notes: Note[] = [
  { id: "1", title: "River bank", body: "Layer of red clay", status: "queued", createdAt: "2026-10-20T10:00:00.000Z", updatedAt: "2026-10-20T10:00:00.000Z", attempts: 0, version: 1 },
  { id: "2", title: "Forest edge", body: "Bird calls at dawn", status: "synced", createdAt: "2026-10-20T11:00:00.000Z", updatedAt: "2026-10-20T11:00:00.000Z", attempts: 0, version: 1 },
];

describe("filterNotes", () => {
  it("searches case-insensitively through title and body while filtering status", () => {
    expect(filterNotes(notes, "CLAY", "queued").map((note) => note.id)).toEqual(["1"]);
    expect(filterNotes(notes, "river", "synced")).toEqual([]);
    expect(filterNotes(notes, "", "all")).toHaveLength(2);
  });
});

describe("csvEscape", () => {
	it("quotes cells and doubles embedded quote characters", () => {
		expect(csvEscape('Observed "red" clay')).toBe('"Observed ""red"" clay"');
	});

	it("neutralizes spreadsheet formula prefixes from user-entered notes", () => {
		expect(csvEscape("=HYPERLINK(\"https://example.test\")")).toBe("\"'=HYPERLINK(\"\"https://example.test\"\")\"");
		expect(csvEscape("  @SUM(A1:A2)")).toBe('"\'  @SUM(A1:A2)"');
		expect(csvEscape("ordinary field note")).toBe('"ordinary field note"');
	});
});

describe("local day export bounds", () => {
	it("uses local midnight and the next local midnight", () => {
		const bounds = localDayBounds("2026-10-23");
		expect(bounds).not.toBeNull();
		expect(formatLocalDay(new Date(bounds!.start))).toBe("2026-10-23");
		expect(formatLocalDay(new Date(new Date(bounds!.end).getTime() - 1))).toBe("2026-10-23");
	});

	it("rejects malformed and impossible calendar dates", () => {
		expect(localDayBounds("2026-2-3")).toBeNull();
		expect(localDayBounds("2026-02-30")).toBeNull();
		expect(localDayBounds("not-a-date")).toBeNull();
	});
});
