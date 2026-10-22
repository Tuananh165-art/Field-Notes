import { Tabs } from "expo-router";
import { BookOpen, Map, Settings2 } from "lucide-react-native";
import { View, type ColorValue } from "react-native";
import { useTheme } from "@/theme/useTheme";

export default function TabsLayout() {
  const { colors } = useTheme();
  const icon = (Icon: typeof BookOpen, color: ColorValue, focused: boolean) => <View className="h-8 min-w-[50px] items-center justify-center rounded-2xl px-3" style={{ backgroundColor: focused ? colors.brandSoft : "transparent" }}><Icon size={20} color={focused ? colors.brand : color} strokeWidth={focused ? 2.4 : 1.9} /></View>;
  return <Tabs screenOptions={{
    headerShown: false,
    tabBarActiveTintColor: colors.brand,
    tabBarInactiveTintColor: colors.muted,
    tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.line, borderTopWidth: 1, height: 78, paddingTop: 6, paddingBottom: 7, shadowColor: colors.shadow, shadowOpacity: 0.08, shadowRadius: 14, elevation: 10 },
    tabBarLabelStyle: { fontSize: 11, fontWeight: "700", marginTop: 1 },
    tabBarItemStyle: { paddingHorizontal: 4 },
  }}>
    <Tabs.Screen name="index" options={{ title: "Ghi chú", tabBarAccessibilityLabel: "Ghi chú", tabBarIcon: ({ color, focused }) => icon(BookOpen, color, focused) }} />
    <Tabs.Screen name="map" options={{ title: "Bản đồ", tabBarAccessibilityLabel: "Bản đồ", tabBarIcon: ({ color, focused }) => icon(Map, color, focused) }} />
    <Tabs.Screen name="settings" options={{ title: "Cài đặt", tabBarAccessibilityLabel: "Cài đặt", tabBarIcon: ({ color, focused }) => icon(Settings2, color, focused) }} />
  </Tabs>;
}
