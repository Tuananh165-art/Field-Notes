import type { Note } from "@/types/note";
import { syncPendingNotes } from "./syncService";
import { ApiError, noteApi } from "./noteApi";
import { finishFailedSync, setNoteStatus, updateQueueAttempts } from "@/data/database";

const mockNote: Note = { id: "n1", title: "Sample", body: "Offline note", status: "queued", createdAt: "2026-10-20T10:00:00.000Z", updatedAt: "2026-10-20T10:00:00.000Z", attempts: 0, version: 1 };
let mockAttempts = 0;
let mockQueued = true;
jest.mock("./noteApi", () => ({ noteApi: { sync: jest.fn() }, ApiError: class ApiError extends Error { status = 401; } }));
jest.mock("expo-network", () => ({ getNetworkStateAsync: jest.fn(async () => ({ isConnected: true })) }));
jest.mock("@/store/appStore", () => ({ useAppStore: { getState: () => ({ token: "session-token", accountId: "user-1", setNotes: jest.fn() }) } }));
jest.mock("@/data/database", () => ({
  queuedNotes: jest.fn(async () => mockQueued ? [{ noteId: "n1", action: "upsert", attempts: mockAttempts, enqueuedAt: mockNote.createdAt, note: { ...mockNote, attempts: mockAttempts } }] : []),
  recoverOfflineFailures: jest.fn(),
  removeFromQueue: jest.fn(async () => { mockQueued = false; }),
  setNoteStatus: jest.fn(async (_id: string, _owner: string, _status: string, _error: string | null, next: number) => { mockAttempts = next; }),
  updateQueueAttempts: jest.fn(async (_id: string, _owner: string, next: number) => { mockAttempts = next; }),
  setServerSnapshot: jest.fn(),
  listNotes: jest.fn(async () => []),
  finishSync: jest.fn(),
  retrySync: jest.fn(),
  finishFailedSync: jest.fn(async (_id: string, _owner: string, _error: string, next: number) => { mockAttempts = next; mockQueued = false; }),
  enqueue: jest.fn(),
}));
describe("syncPendingNotes critical path", () => {
  beforeEach(() => { mockAttempts = 0; mockQueued = true; jest.clearAllMocks(); (noteApi.sync as jest.Mock).mockRejectedValue(new Error("API unavailable")); });
  it("shows a failed state and removes the item after three unsuccessful attempts", async () => {
    await syncPendingNotes();
    expect(noteApi.sync).toHaveBeenCalledTimes(3);
    expect(finishFailedSync).toHaveBeenCalledWith("n1", "user-1", "Đã thử 3 lần. API unavailable", 3);
  });
  it("keeps an unauthorized note queued without consuming retries", async () => {
    (noteApi.sync as jest.Mock).mockRejectedValue(new ApiError("invalid or expired token", 401));
    await syncPendingNotes();
    expect(noteApi.sync).toHaveBeenCalledTimes(1);
    expect(setNoteStatus).toHaveBeenCalledWith("n1", "user-1", "queued", null, 0);
    expect(updateQueueAttempts).not.toHaveBeenCalled();
    expect(finishFailedSync).not.toHaveBeenCalled();
    expect(mockQueued).toBe(true);
  });
});
