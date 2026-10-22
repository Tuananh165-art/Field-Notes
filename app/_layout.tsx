import "../global.css";
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, AppState, Platform, Text, View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { Stack, router } from "expo-router";
import { onlineManager, QueryClient, QueryClientProvider } from "@tanstack/react-query";
import * as Notifications from "expo-notifications";
import * as Network from "expo-network";
import { StatusBar } from "expo-status-bar";
import Animated, { FadeIn, FadeInDown } from "react-native-reanimated";
import { BookOpen } from "lucide-react-native";
import { useAppStore } from "@/store/appStore";
import { initializeDatabase } from "@/data/database";
import { refreshNotes } from "@/services/noteService";
import { syncPendingNotes } from "@/services/syncService";
import { useTheme } from "@/theme/useTheme";
import { tokens } from "@/theme/tokens";

const queryClient = new QueryClient({ defaultOptions: { queries: { retry: 1, staleTime: 15_000 } } });

if (Platform.OS !== "web" || typeof window !== "undefined") onlineManager.setEventListener((setOnline) => {
  let receivedNetworkEvent = false;
  const network = Network.addNetworkStateListener((state) => {
    receivedNetworkEvent = true;
    setOnline(state.isConnected ?? false);
  });
  void Network.getNetworkStateAsync()
    .then((state) => { if (!receivedNetworkEvent) setOnline(state.isConnected ?? true); })
    .catch(() => { if (!receivedNetworkEvent) setOnline(true); });
  return () => network.remove();
});

function RootStack() {
  const restoreSession = useAppStore((state) => state.restoreSession);
  const ready = useAppStore((state) => state.ready);
  const { colors, mode } = useTheme();
  const [booted, setBooted] = useState(false);
  const lastNotificationId = useRef<string | null>(null);
  useEffect(() => {
    void Promise.all([initializeDatabase(), restoreSession()]).then(async () => {
      await refreshNotes();
      if (useAppStore.getState().token) void syncPendingNotes();
    }).finally(() => setBooted(true));
  }, [restoreSession]);
  useEffect(() => {
    if (!booted || !ready) return;
    const openNotificationRoute = (response: Notifications.NotificationResponse | null) => {
      if (!response) return;
      const id = response.notification.request.identifier;
      if (lastNotificationId.current === id) return;
      lastNotificationId.current = id;
      setTimeout(() => { if (lastNotificationId.current === id) lastNotificationId.current = null; }, 1000);
      void Notifications.clearLastNotificationResponseAsync().catch(() => undefined);
      const url = response.notification.request.content.data?.url;
      if (typeof url === "string" && /^\/notes\/[^/?#]+$/.test(url)) router.push(url as never);
    };
    const notification = Platform.OS === "web" ? null : Notifications.addNotificationResponseReceivedListener(openNotificationRoute);
    if (Platform.OS !== "web") void Notifications.getLastNotificationResponseAsync().then(openNotificationRoute).catch(() => undefined);
    const appState = AppState.addEventListener("change", (state) => { if (state === "active") void syncPendingNotes(); });
    const network = Network.addNetworkStateListener((state) => { if (state.isConnected) void syncPendingNotes(); });
    return () => { notification?.remove(); appState.remove(); network.remove(); };
  }, [booted, ready]);
  if (!booted || !ready) {
    // The server cannot know the browser's system theme during hydration.
    const bootColors = Platform.OS === "web" ? tokens.light : colors;
    return <View className="flex-1 items-center justify-center" style={{ backgroundColor: bootColors.paper }}>
      <StatusBar style={Platform.OS === "web" ? "dark" : mode === "dark" ? "light" : "dark"} />
      <Animated.View entering={FadeIn.duration(450)} className="h-[82px] w-[82px] items-center justify-center rounded-[28px] border" style={{ backgroundColor: bootColors.brandSoft, borderColor: bootColors.line, transform: [{ rotate: "-6deg" }] }}><BookOpen size={37} color={bootColors.brand} strokeWidth={1.7} /></Animated.View>
      <Animated.View entering={FadeInDown.delay(100).duration(420)} className="mt-5 items-center"><Text className="text-[19px] font-extrabold" style={{ color: bootColors.ink }}>Field Notes</Text><Text className="mt-1 text-[12px]" style={{ color: bootColors.muted }}>Đang mở sổ tay của bạn</Text><ActivityIndicator className="mt-5" size="small" color={bootColors.brand} /></Animated.View>
    </View>;
  }
  return <>
    <StatusBar style={mode === "dark" ? "light" : "dark"} />
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.paper } }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="notes/[id]" options={{ animation: "slide_from_right" }} />
      <Stack.Screen name="notes/new" options={{ presentation: "modal", animation: "slide_from_bottom" }} />
      <Stack.Screen name="+not-found" />
    </Stack>
  </>;
}

export default function RootLayout() {
  return <QueryClientProvider client={queryClient}><SafeAreaProvider><RootStack /></SafeAreaProvider></QueryClientProvider>;
}
