import * as SecureStore from "expo-secure-store";
import { useAppStore } from "@/store/appStore";
import { authApi, noteApi } from "./noteApi";

jest.mock("expo-secure-store", () => ({
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
}));
jest.mock("expo-file-system/legacy", () => ({ readAsStringAsync: jest.fn(), EncodingType: { Base64: "base64" } }));

const originalFetch = globalThis.fetch;
const rejectedResponse = () => ({ ok: false, status: 401, json: async () => ({ error: "invalid or expired token" }) }) as Response;

beforeEach(() => {
  jest.clearAllMocks();
  useAppStore.setState({ token: "old-token", accountId: "account-1", sessionExpired: false });
  (SecureStore.getItemAsync as jest.Mock).mockResolvedValue("old-token");
  globalThis.fetch = jest.fn();
});
afterAll(() => { globalThis.fetch = originalFetch; });

it("marks the active session expired when a protected request receives 401", async () => {
  (globalThis.fetch as jest.Mock).mockResolvedValue(rejectedResponse());
  await expect(noteApi.list()).rejects.toMatchObject({ status: 401 });
  expect(useAppStore.getState().sessionExpired).toBe(true);
  expect(useAppStore.getState().accountId).toBe("account-1");
});

it("does not invalidate a newer session when an old request returns 401", async () => {
  let respond!: (response: Response) => void;
  (globalThis.fetch as jest.Mock).mockImplementation(() => new Promise<Response>((resolve) => { respond = resolve; }));
  const request = noteApi.list();
  await Promise.resolve();
  useAppStore.setState({ token: "new-token", sessionExpired: false });
  respond(rejectedResponse());
  await expect(request).rejects.toMatchObject({ status: 401 });
  expect(useAppStore.getState().sessionExpired).toBe(false);
});

it("does not mark the current session expired when sign-in credentials are rejected", async () => {
  (globalThis.fetch as jest.Mock).mockResolvedValue(rejectedResponse());
  await expect(authApi.signIn("user@example.com", "password")).rejects.toMatchObject({ status: 401 });
  expect(useAppStore.getState().sessionExpired).toBe(false);
});
