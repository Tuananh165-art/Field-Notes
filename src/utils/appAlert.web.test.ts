import { Alert } from "./appAlert.web";

const originalAlert = Object.getOwnPropertyDescriptor(globalThis, "alert");
const originalConfirm = Object.getOwnPropertyDescriptor(globalThis, "confirm");

afterAll(() => {
  if (originalAlert) Object.defineProperty(globalThis, "alert", originalAlert);
  else delete (globalThis as { alert?: typeof alert }).alert;
  if (originalConfirm) Object.defineProperty(globalThis, "confirm", originalConfirm);
  else delete (globalThis as { confirm?: typeof confirm }).confirm;
});

it("displays an informational message and invokes its action", () => {
  const show = jest.fn();
  const action = jest.fn();
  Object.defineProperty(globalThis, "alert", { configurable: true, value: show });
  Alert.alert("Title", "Message", [{ text: "OK", onPress: action }]);
  expect(show).toHaveBeenCalledWith("Title\n\nMessage");
  expect(action).toHaveBeenCalledTimes(1);
});

it("only invokes the confirmed action when the user accepts", () => {
  const confirm = jest.fn().mockReturnValueOnce(false).mockReturnValueOnce(true);
  const action = jest.fn();
  const cancel = jest.fn();
  Object.defineProperty(globalThis, "alert", { configurable: true, value: jest.fn() });
  Object.defineProperty(globalThis, "confirm", { configurable: true, value: confirm });
  const buttons = [{ text: "Cancel", style: "cancel" as const, onPress: cancel }, { text: "OK", onPress: action }];
  Alert.alert("Title", "Message", buttons);
  expect(cancel).toHaveBeenCalledTimes(1);
  expect(action).not.toHaveBeenCalled();
  Alert.alert("Title", "Message", buttons);
  expect(action).toHaveBeenCalledTimes(1);
});
