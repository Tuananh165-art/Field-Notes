/* global jest, afterAll, it, expect */
const { DatabaseSync } = require("node:sqlite");
const mockSqlite = new DatabaseSync(":memory:");

jest.mock("expo-sqlite", () => ({
  openDatabaseAsync: async () => ({
    execAsync: async (sql) => mockSqlite.exec(sql),
    getAllAsync: async (sql, ...args) => mockSqlite.prepare(sql).all(...args),
    getFirstAsync: async (sql, ...args) => mockSqlite.prepare(sql).get(...args),
    runAsync: async (sql, ...args) => mockSqlite.prepare(sql).run(...args),
    withTransactionAsync: async (callback) => {
      mockSqlite.exec("BEGIN");
      try { await callback(); mockSqlite.exec("COMMIT"); }
      catch (error) { mockSqlite.exec("ROLLBACK"); throw error; }
    },
  }),
}));

const { initializeDatabase, saveNote, getNote, queuedNotes, recoverAuthFailures } = require("./database");

afterAll(() => mockSqlite.close());

it("requeues only authentication failures belonging to the account that signed in", async () => {
  await initializeDatabase();
  const note = { title: "Local note", body: "Offline content", status: "failed", createdAt: "2026-10-27T00:00:00.000Z", updatedAt: "2026-10-27T00:00:00.000Z", attempts: 1, version: 1 };
  await saveNote({ ...note, id: "mine", syncError: "invalid or expired token" }, "account-1", false);
  await saveNote({ ...note, id: "other", syncError: "invalid or expired token" }, "account-2", false);
  await saveNote({ ...note, id: "forbidden", syncError: "permission denied" }, "account-1", false);

  await recoverAuthFailures("account-1");

  expect((await getNote("mine", "account-1")).status).toBe("queued");
  expect((await queuedNotes("account-1")).map((item) => item.noteId)).toEqual(["mine"]);
  expect((await getNote("other", "account-2")).status).toBe("failed");
  expect((await getNote("forbidden", "account-1")).status).toBe("failed");
  expect(await queuedNotes("account-2")).toEqual([]);
});
