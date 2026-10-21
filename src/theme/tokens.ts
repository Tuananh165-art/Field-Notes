import palette from "./tokens.json";

export const tokens = palette;
export type ThemeMode = "light" | "dark";
export type Palette = typeof palette.light;
