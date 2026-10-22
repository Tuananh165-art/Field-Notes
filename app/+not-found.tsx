import { router } from "expo-router";
import Animated, { FadeInDown, useReducedMotion } from "react-native-reanimated";
import { ArrowLeft, Compass } from "lucide-react-native";
import { Text, View } from "react-native";
import { Button, Page, Surface } from "@/components/ui";
import { useTheme } from "@/theme/useTheme";

export default function NotFound() {
  const { colors } = useTheme();
  const reduceMotion = useReducedMotion();
  return <Page><View className="flex-1 justify-center px-6">
    <Animated.View entering={reduceMotion ? undefined : FadeInDown.duration(420)}>
      <Surface className="items-center px-6 py-9">
        <View className="mb-5 h-[82px] w-[82px] items-center justify-center rounded-[28px]" style={{ backgroundColor: colors.brandSoft, transform: [{ rotate: "-8deg" }] }}><Compass color={colors.brand} size={39} strokeWidth={1.7} /></View>
        <Text className="text-[12px] font-extrabold uppercase tracking-[2px]" style={{ color: colors.brand }}>404 · NOT IN YOUR JOURNAL</Text>
        <Text className="mt-3 text-center text-[24px] font-extrabold" style={{ color: colors.ink }}>Không tìm thấy trang</Text>
        <Text className="mt-2 text-center text-[14px] leading-6" style={{ color: colors.muted }}>Liên kết này không có trong sổ tay thực địa. Hãy quay lại danh sách quan sát của bạn.</Text>
        <View className="mt-6 w-full"><Button title="Về danh sách ghi chú" onPress={() => router.replace("/(tabs)")} icon={<ArrowLeft color={colors.paper} size={18} />} /></View>
      </Surface>
    </Animated.View>
  </View></Page>;
}
