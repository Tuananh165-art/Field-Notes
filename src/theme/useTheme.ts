import { useColorScheme } from "react-native";
import { tokens } from "./tokens";
import { useAppStore } from "@/store/appStore";

export function useTheme() {
  const system = useColorScheme() === "dark" ? "dark" : "light";
  const preference = useAppStore((state) => state.themeMode);
  const mode = preference === "system" ? system : preference;
  return { mode, colors: tokens[mode] } as const;
}
