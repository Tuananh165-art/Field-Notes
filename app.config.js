const base = {
  name: "Field Notes",
  slug: "field-notes-mobile",
  scheme: "fieldnotes",
  version: "1.0.0",
  orientation: "portrait",
  userInterfaceStyle: "automatic",
  web: { output: "server" },
  plugins: [
    ["expo-router", { headers: { "Cross-Origin-Embedder-Policy": "credentialless", "Cross-Origin-Opener-Policy": "same-origin" } }],
    ["expo-secure-store", { configureAndroidBackup: true }],
    ["expo-image-picker", {
      photosPermission: "Cho phép Field Notes chọn ảnh để đính kèm vào ghi chú.",
      cameraPermission: "Cho phép Field Notes chụp ảnh khảo sát.",
    }],
    ["expo-location", {
      locationWhenInUsePermission: "Cho phép Field Notes gắn vị trí hiện tại vào ghi chú.",
    }],
    ["expo-notifications", { defaultChannel: "sync" }],
    ["expo-sqlite", { enableFTS: true }],
  ],
  experiments: { typedRoutes: true },
  android: {
    package: "com.fieldnotes.mobile",
    permissions: ["CAMERA", "ACCESS_COARSE_LOCATION", "ACCESS_FINE_LOCATION", "POST_NOTIFICATIONS"],
  },
  ios: {
    bundleIdentifier: "com.fieldnotes.mobile",
    supportsTablet: true,
  },
};
const { resolveApiNetworkPolicy } = require("./app.config.utils");
const apiUrl = process.env.EXPO_PUBLIC_API_URL || "http://localhost:8080/api/v1";
const { usesLocalHttp } = resolveApiNetworkPolicy(apiUrl);
const localNetworkDescription = "Cho phép Field Notes kết nối tới API trên mạng cục bộ để đồng bộ ghi chú trong quá trình phát triển.";

module.exports = {
  expo: {
    ...base,
    ...(usesLocalHttp ? {
      ios: {
        ...base.ios,
        infoPlist: {
          ...base.ios?.infoPlist,
          NSLocalNetworkUsageDescription: localNetworkDescription,
          NSAppTransportSecurity: {
            ...base.ios?.infoPlist?.NSAppTransportSecurity,
            NSAllowsLocalNetworking: true,
          },
        },
      },
    } : {}),
    plugins: [
      ...base.plugins,
      ...(usesLocalHttp ? [["expo-build-properties", { android: { usesCleartextTraffic: true } }]] : []),
      ...(process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY
        ? [["react-native-maps", { androidGoogleMapsApiKey: process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY }]]
        : []),
    ],
  },
};
