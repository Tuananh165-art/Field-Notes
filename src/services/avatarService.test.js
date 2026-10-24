/* global jest, beforeEach, afterEach, it, expect */
const FileSystem = require("expo-file-system/legacy");
const ImagePicker = require("expo-image-picker");
const ImageManipulator = require("expo-image-manipulator");
const SecureStore = require("expo-secure-store");
const { chooseAvatar, loadAvatar } = require("./avatarService");

jest.mock("expo-file-system/legacy", () => ({
  documentDirectory: "file:///documents/",
  makeDirectoryAsync: jest.fn(), copyAsync: jest.fn(), deleteAsync: jest.fn(), getInfoAsync: jest.fn(),
}));
jest.mock("expo-image-picker", () => ({ launchImageLibraryAsync: jest.fn() }));
jest.mock("expo-image-manipulator", () => ({ manipulateAsync: jest.fn(), SaveFormat: { JPEG: "jpeg" } }));
jest.mock("expo-secure-store", () => ({ getItemAsync: jest.fn(), setItemAsync: jest.fn() }));

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(Date, "now").mockReturnValue(123456);
  jest.spyOn(Math, "random").mockReturnValue(0.5);
  ImagePicker.launchImageLibraryAsync.mockResolvedValue({ canceled: false, assets: [{ uri: "file:///selected.jpg" }] });
  ImageManipulator.manipulateAsync.mockResolvedValue({ uri: "file:///compressed.jpg" });
  FileSystem.makeDirectoryAsync.mockResolvedValue(undefined);
  FileSystem.copyAsync.mockResolvedValue(undefined);
  FileSystem.deleteAsync.mockResolvedValue(undefined);
  FileSystem.getInfoAsync.mockResolvedValue({ exists: true });
  SecureStore.getItemAsync.mockResolvedValue(null);
  SecureStore.setItemAsync.mockResolvedValue(undefined);
});
afterEach(() => { jest.restoreAllMocks(); });

it("copies the selected image into device storage under the current account", async () => {
  SecureStore.getItemAsync.mockResolvedValue("avatar-1-old.jpg");
  const uri = await chooseAvatar("account-1");
  expect(ImagePicker.launchImageLibraryAsync).toHaveBeenCalledWith(expect.objectContaining({ mediaTypes: ["images"], allowsEditing: true, aspect: [1, 1] }));
  expect(FileSystem.copyAsync).toHaveBeenCalledWith({ from: "file:///compressed.jpg", to: uri });
  expect(SecureStore.setItemAsync).toHaveBeenCalledWith("field-notes.avatar.account-1", "avatar-123456-i.jpg");
  expect(uri).toBe("file:///documents/profile-avatars/avatar-123456-i.jpg");
  expect(FileSystem.deleteAsync).toHaveBeenCalledWith("file:///documents/profile-avatars/avatar-1-old.jpg", { idempotent: true });
});

it("leaves the existing avatar untouched when selection is cancelled", async () => {
  ImagePicker.launchImageLibraryAsync.mockResolvedValue({ canceled: true, assets: null });
  expect(await chooseAvatar("account-1")).toBeNull();
  expect(SecureStore.setItemAsync).not.toHaveBeenCalled();
  expect(FileSystem.copyAsync).not.toHaveBeenCalled();
});

it("loads only the avatar associated with the requested account", async () => {
  SecureStore.getItemAsync.mockImplementation(async (key) => key.endsWith("account-1") ? "avatar-1-one.jpg" : "avatar-2-two.jpg");
  expect(await loadAvatar("account-1")).toBe("file:///documents/profile-avatars/avatar-1-one.jpg");
  expect(await loadAvatar("account-2")).toBe("file:///documents/profile-avatars/avatar-2-two.jpg");
  expect(SecureStore.getItemAsync).toHaveBeenCalledWith("field-notes.avatar.account-1");
  expect(SecureStore.getItemAsync).toHaveBeenCalledWith("field-notes.avatar.account-2");
});

it("keeps the previous avatar if saving the new reference fails", async () => {
  SecureStore.getItemAsync.mockResolvedValue("avatar-1-old.jpg");
  SecureStore.setItemAsync.mockRejectedValue(new Error("storage failed"));
  await expect(chooseAvatar("account-1")).rejects.toThrow("storage failed");
  expect(FileSystem.deleteAsync).toHaveBeenCalledWith("file:///documents/profile-avatars/avatar-123456-i.jpg", { idempotent: true });
  expect(FileSystem.deleteAsync).not.toHaveBeenCalledWith("file:///documents/profile-avatars/avatar-1-old.jpg", expect.anything());
});
