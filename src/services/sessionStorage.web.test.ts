import { deleteSessionItem, getSessionItem, setSessionItem } from "./sessionStorage.web";

const originalStorage = Object.getOwnPropertyDescriptor(globalThis, "sessionStorage");
const entries = new Map<string, string>();

beforeEach(() => {
  entries.clear();
  Object.defineProperty(globalThis, "sessionStorage", { configurable: true, value: {
    getItem: (key: string) => entries.get(key) ?? null,
    setItem: (key: string, value: string) => entries.set(key, value),
    removeItem: (key: string) => entries.delete(key),
  } });
});
afterAll(() => {
  if (originalStorage) Object.defineProperty(globalThis, "sessionStorage", originalStorage);
  else delete (globalThis as { sessionStorage?: Storage }).sessionStorage;
});

it("stores a web session in sessionStorage and removes it on sign-out", async () => {
  await setSessionItem("test-session-token", "sample-token");
  expect(entries.get("test-session-token")).toBe("sample-token");
  expect(await getSessionItem("test-session-token")).toBe("sample-token");
  await deleteSessionItem("test-session-token");
  expect(entries.has("test-session-token")).toBe(false);
  expect(await getSessionItem("test-session-token")).toBeNull();
});

it("uses the current in-memory session when browser storage rejects writes", async () => {
  entries.set("test-blocked-token", "stale-token");
  Object.defineProperty(globalThis, "sessionStorage", { configurable: true, value: {
    getItem: (key: string) => entries.get(key) ?? null,
    setItem: () => { throw new Error("storage blocked"); },
    removeItem: () => { throw new Error("storage blocked"); },
  } });
  await setSessionItem("test-blocked-token", "new-token");
  expect(await getSessionItem("test-blocked-token")).toBe("new-token");
  await deleteSessionItem("test-blocked-token");
  expect(await getSessionItem("test-blocked-token")).toBeNull();
});
