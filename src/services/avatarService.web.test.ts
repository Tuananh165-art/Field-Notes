import * as ImagePicker from "expo-image-picker";
import * as ImageManipulator from "expo-image-manipulator";
import { chooseAvatar, loadAvatar } from "./avatarService.web";

jest.mock("expo-image-picker", () => ({ launchImageLibraryAsync: jest.fn() }));
jest.mock("expo-image-manipulator", () => ({ manipulateAsync: jest.fn(), SaveFormat: { JPEG: "jpeg" } }));

const originalStorage = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
const entries = new Map<string, string>();

beforeEach(() => {
  entries.clear();
  jest.clearAllMocks();
  Object.defineProperty(globalThis, "localStorage", { configurable: true, value: {
    getItem: (key: string) => entries.get(key) ?? null,
    setItem: (key: string, value: string) => entries.set(key, value),
  } });
});

afterAll(() => {
  if (originalStorage) Object.defineProperty(globalThis, "localStorage", originalStorage);
  else delete (globalThis as { localStorage?: Storage }).localStorage;
});

it("stores the selected avatar locally for only the chosen account", async () => {
  jest.mocked(ImagePicker.launchImageLibraryAsync).mockResolvedValue({ canceled: false, assets: [{ uri: "blob:photo" }] } as never);
  jest.mocked(ImageManipulator.manipulateAsync).mockResolvedValue({ base64: "photo-data" } as never);
  expect(await chooseAvatar("account-1")).toBe("data:image/jpeg;base64,photo-data");
  expect(await loadAvatar("account-1")).toBe("data:image/jpeg;base64,photo-data");
  expect(await loadAvatar("account-2")).toBeNull();
});

it("does not overwrite an avatar when selection is canceled", async () => {
  entries.set("field-notes.avatar.account-1", "data:image/jpeg;base64,old");
  jest.mocked(ImagePicker.launchImageLibraryAsync).mockResolvedValue({ canceled: true, assets: null });
  expect(await chooseAvatar("account-1")).toBeNull();
  expect(await loadAvatar("account-1")).toBe("data:image/jpeg;base64,old");
});
