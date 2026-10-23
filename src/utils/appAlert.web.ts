import type { AlertButton, AlertOptions } from "react-native";

export const Alert = {
  alert(title: string, message?: string, buttons?: AlertButton[], _options?: AlertOptions) {
    const text = message ? `${title}\n\n${message}` : title;
    if (typeof globalThis.alert !== "function") return;
    if (!buttons || buttons.length <= 1) {
      globalThis.alert(text);
      buttons?.[0]?.onPress?.();
      return;
    }
    const accepted = globalThis.confirm(text);
    const action = accepted ? buttons.find((button) => button.style !== "cancel") : buttons.find((button) => button.style === "cancel");
    action?.onPress?.();
  },
};
