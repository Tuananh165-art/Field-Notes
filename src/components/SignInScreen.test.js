/* global jest, afterEach, it, expect */
const React = require("react");
const { render, cleanup } = require("@testing-library/react-native");

jest.mock("expo-router", () => {
  const mockReact = require("react");
  const { Text } = require("react-native");
  return { router: { replace: jest.fn() }, Link: ({ children, href }) => mockReact.createElement(Text, { accessibilityLabel: href }, children) };
});
jest.mock("expo-secure-store", () => ({ getItemAsync: jest.fn(), setItemAsync: jest.fn(), deleteItemAsync: jest.fn() }));
jest.mock("react-native-reanimated", () => {
  const { View } = require("react-native");
  return { __esModule: true, default: { View }, FadeInDown: {}, useReducedMotion: () => true };
});
jest.mock("lucide-react-native", () => {
  const mockReact = require("react");
  const { View } = require("react-native");
  const icon = () => mockReact.createElement(View);
  return { ArrowRight: icon, BookOpen: icon, CloudOff: icon, Sparkles: icon, AlertCircle: icon, Compass: icon, WifiOff: icon };
});
jest.mock("@/services/noteApi", () => ({ authApi: { signIn: jest.fn() } }));
jest.mock("@/services/noteService", () => ({ refreshNotes: jest.fn() }));
jest.mock("@/services/syncService", () => ({ syncPendingNotes: jest.fn() }));
jest.mock("@/data/database", () => ({ recoverAuthFailures: jest.fn() }));

const { useAppStore } = require("@/store/appStore");
const SignInScreen = require("../../app/(auth)/sign-in").default;

afterEach(async () => { await cleanup(); });

it.each([false, true])("shows registration and password recovery links when sessionExpired=%s", async (sessionExpired) => {
  useAppStore.setState({ token: sessionExpired ? "old-token" : null, accountId: sessionExpired ? "old-account" : null, sessionExpired });
  const view = await render(React.createElement(SignInScreen));
  expect(view.getByLabelText("/(auth)/sign-up")).toBeTruthy();
  expect(view.getByLabelText("/(auth)/forgot-password")).toBeTruthy();
});
