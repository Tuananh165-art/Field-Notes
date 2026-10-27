/* global jest, beforeEach, afterEach, it, expect */
const React = require("react");
const { render, fireEvent, waitFor, within, cleanup, act } = require("@testing-library/react-native");

jest.mock("expo-router", () => ({ router: { push: jest.fn(), replace: jest.fn() } }));
jest.mock("expo-secure-store", () => ({ getItemAsync: jest.fn(), setItemAsync: jest.fn(), deleteItemAsync: jest.fn() }));
jest.mock("react-native-reanimated", () => {
  const { View } = require("react-native");
  return { __esModule: true, default: { View }, FadeInDown: {}, useReducedMotion: () => true };
});
jest.mock("lucide-react-native", () => {
  const mockReact = require("react");
  const { View } = require("react-native");
  const icon = () => mockReact.createElement(View);
  return { Camera: icon, Check: icon, ChevronDown: icon, Cloud: icon, Download: icon, LogIn: icon, LogOut: icon, Moon: icon, Smartphone: icon, Sun: icon, UserRound: icon, AlertCircle: icon, BookOpen: icon, Compass: icon, WifiOff: icon };
});
jest.mock("@tanstack/react-query", () => ({
  useQuery: ({ queryKey }) => ({ data: queryKey[0] === "local-notes" ? [{ id: "note-1" }] : 0, isLoading: false, isError: false, refetch: jest.fn() }),
  useQueryClient: () => ({ clear: jest.fn(), invalidateQueries: jest.fn() }),
}));
jest.mock("expo-file-system/legacy", () => ({ cacheDirectory: "file:///cache/", writeAsStringAsync: jest.fn(async () => undefined) }));
jest.mock("expo-sharing", () => ({ isAvailableAsync: jest.fn(async () => true), shareAsync: jest.fn(async () => undefined) }));
jest.mock("@/data/database", () => ({
  adoptUnownedNotes: jest.fn(), countUnownedNotes: jest.fn(), listNotes: jest.fn(),
  exportNotesForDay: jest.fn(async () => [{ id: "note-1", title: "Ghi chú", body: "Nội dung", status: "queued", createdAt: "2026-10-27T01:00:00Z", lat: null, lng: null }]),
}));
jest.mock("@/services/noteService", () => ({ refreshNotes: jest.fn() }));
jest.mock("@/services/syncService", () => ({ syncPendingNotes: jest.fn() }));
jest.mock("@/services/avatarService", () => ({ loadAvatar: jest.fn(async () => null), chooseAvatar: jest.fn(async () => "file:///avatar.jpg") }));

const { useAppStore } = require("@/store/appStore");
const { chooseAvatar, loadAvatar } = require("@/services/avatarService");
const { exportNotesForDay } = require("@/data/database");
const FileSystem = require("expo-file-system/legacy");
const Sharing = require("expo-sharing");
const SettingsScreen = require("../../app/(tabs)/settings").default;

beforeEach(() => {
  jest.clearAllMocks();
  useAppStore.setState({ token: "token", accountId: "account-1", sessionExpired: false, themeMode: "light" });
});
afterEach(async () => { await cleanup(); });

it("opens account actions and selects a local avatar for the current account", async () => {
  const view = await render(React.createElement(SettingsScreen));
  await fireEvent.press(view.getByLabelText("Mở tùy chọn tài khoản và ảnh đại diện"));
  const actions = within(view.getByTestId("account-actions"));
  expect(actions.getByLabelText("Đăng xuất")).toBeTruthy();
  await fireEvent.press(actions.getByLabelText("Chọn ảnh đại diện từ thiết bị"));
  expect(chooseAvatar).toHaveBeenCalledWith("account-1");
  await waitFor(() => expect(view.getByLabelText("Ảnh đại diện").props.source.uri).toBe("file:///avatar.jpg"));
  await act(async () => { useAppStore.setState({ accountId: "account-2" }); });
  expect(view.queryByLabelText("Ảnh đại diện")).toBeNull();
});

it("offers sign-in in the avatar menu when signed out", async () => {
  useAppStore.setState({ token: null, accountId: null, sessionExpired: false });
  const view = await render(React.createElement(SettingsScreen));
  await fireEvent.press(view.getByLabelText("Mở tùy chọn tài khoản và ảnh đại diện"));
  const actions = within(view.getByTestId("account-actions"));
  expect(actions.getByLabelText("Đăng nhập")).toBeTruthy();
});

it("keeps the new avatar when an earlier saved-avatar read finishes late", async () => {
  let finishLoading;
  loadAvatar.mockImplementationOnce(() => new Promise((resolve) => { finishLoading = resolve; }));
  const view = await render(React.createElement(SettingsScreen));
  await fireEvent.press(view.getByLabelText("Mở tùy chọn tài khoản và ảnh đại diện"));
  await fireEvent.press(within(view.getByTestId("account-actions")).getByLabelText("Chọn ảnh đại diện từ thiết bị"));
  await waitFor(() => expect(view.getByLabelText("Ảnh đại diện").props.source.uri).toBe("file:///avatar.jpg"));
  await act(async () => { finishLoading("file:///older-avatar.jpg"); });
  expect(view.getByLabelText("Ảnh đại diện").props.source.uri).toBe("file:///avatar.jpg");
});

it("offers reauthentication and sign-out for an expired session", async () => {
  useAppStore.setState({ sessionExpired: true });
  const view = await render(React.createElement(SettingsScreen));
  await fireEvent.press(view.getByLabelText("Mở tùy chọn tài khoản và ảnh đại diện"));
  const actions = within(view.getByTestId("account-actions"));
  expect(actions.getByText("Đăng nhập lại")).toBeTruthy();
  expect(actions.getByLabelText("Đăng xuất")).toBeTruthy();
});

it("shows a contrasting CSV button and opens the file-sharing sheet", async () => {
  const view = await render(React.createElement(SettingsScreen));
  const button = view.getByLabelText("Tạo tệp CSV và chia sẻ");
  expect(button.props.style.backgroundColor).toBe("#17665F");
  await fireEvent.changeText(view.getByLabelText("Ngày cần xuất theo định dạng năm-tháng-ngày"), "2026-10-27");
  await fireEvent.press(button);
  await waitFor(() => expect(Sharing.shareAsync).toHaveBeenCalledWith("file:///cache/field-notes-2026-10-27.csv", expect.objectContaining({ mimeType: "text/csv" })));
  expect(exportNotesForDay).toHaveBeenCalledWith("2026-10-27", "account-1");
  expect(FileSystem.writeAsStringAsync).toHaveBeenCalledWith("file:///cache/field-notes-2026-10-27.csv", expect.stringContaining("Ghi chú"));
});

it("keeps the CSV action readable in dark mode", async () => {
  useAppStore.setState({ themeMode: "dark" });
  const view = await render(React.createElement(SettingsScreen));
  expect(view.getByLabelText("Tạo tệp CSV và chia sẻ").props.style.backgroundColor).toBe("#8DDED2");
  expect(view.getByText("Tạo tệp CSV và chia sẻ").props.style.color).toBe("#0B1518");
});
