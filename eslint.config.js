const { defineConfig, globalIgnores } = require("eslint/config");
const expoConfig = require("eslint-config-expo/flat");
const globals = require("globals");

module.exports = defineConfig([
  globalIgnores(["dist/*", ".expo/*", "coverage/*", "node_modules/*"]),
  expoConfig,
  {
    files: ["*.config.js", "babel.config.js", "jest.config.js"],
    languageOptions: { globals: globals.node },
  },
  {
    files: ["**/*.test.ts", "**/*.test.tsx"],
    languageOptions: { globals: globals.jest },
  },
]);
