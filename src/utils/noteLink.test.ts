import { createNoteDeepLink } from "@/utils/noteLink";

jest.mock("expo-linking", () => ({
  createURL: (path: string) => `exp://test/--/${path}`,
}));

describe("createNoteDeepLink", () => {
  it("uses the current runtime URL base for the note route", () => {
    expect(createNoteDeepLink("note-123")).toBe("exp://test/--/notes/note-123");
  });

  it("encodes note ids as one route segment", () => {
    expect(createNoteDeepLink("note/with space")).toBe("exp://test/--/notes/note%2Fwith%20space");
  });
});
