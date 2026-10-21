const tokens = require("./src/theme/tokens.json");

module.exports = {
  content: ["./app/**/*.{js,jsx,ts,tsx}", "./src/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        ink: tokens.light.ink,
        paper: tokens.light.paper,
        surface: tokens.light.surface,
        brand: tokens.light.brand,
        accent: tokens.light.accent,
        muted: tokens.light.muted,
        line: tokens.light.line,
        positive: tokens.light.positive,
        warning: tokens.light.warning,
        danger: tokens.light.danger,
      },
    },
  },
  plugins: [],
};
