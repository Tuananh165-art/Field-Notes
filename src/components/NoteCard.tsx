import { Pressable, Text, View } from "react-native";
import Animated, { FadeInDown, useAnimatedStyle, useReducedMotion, useSharedValue, withSpring } from "react-native-reanimated";
import { ChevronRight, FileText, MapPin } from "lucide-react-native";
import type { Note } from "@/types/note";
import { useTheme } from "@/theme/useTheme";
import { StatusPill } from "./StatusPill";

export function NoteCard({ note, onPress, index = 0 }: { note: Note; onPress: () => void; index?: number }) {
  const { colors } = useTheme();
  const reduceMotion = useReducedMotion();
  const tilt = useSharedValue(0);
  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ perspective: 900 }, { rotateX: `${tilt.value * -0.45}deg` }, { rotateY: `${tilt.value}deg` }, { translateY: withSpring(tilt.value ? -2 : 0, { damping: 18, stiffness: 170 }) }] }));
  return <Animated.View entering={reduceMotion ? undefined : FadeInDown.delay(Math.min(index, 7) * 32).duration(360)} style={animatedStyle}>
    <Pressable accessibilityRole="button" accessibilityLabel={`Mở ghi chú ${note.title}. ${note.status}`} onPressIn={() => { if (!reduceMotion) tilt.value = 1.25; }} onPressOut={() => { tilt.value = 0; }} onPress={onPress} className="mb-3.5 overflow-hidden rounded-[25px] border p-[17px]" style={{ backgroundColor: colors.card, borderColor: colors.line, minHeight: 120, shadowColor: colors.shadow, shadowOpacity: 0.12, shadowRadius: 15, shadowOffset: { width: 0, height: 6 }, elevation: 2 }}>
      <View className="flex-row items-start gap-3">
        <View className="mt-0.5 h-10 w-10 items-center justify-center rounded-[14px]" style={{ backgroundColor: colors.brandSoft }}><FileText size={19} color={colors.brand} strokeWidth={1.9} /></View>
        <View className="flex-1 gap-1.5">
          <Text numberOfLines={1} className="text-[17px] font-extrabold leading-6" style={{ color: colors.ink }}>{note.title}</Text>
          <Text numberOfLines={2} className="text-[14px] leading-[21px]" style={{ color: colors.muted }}>{note.body}</Text>
        </View>
        <ChevronRight size={19} color={colors.muted} />
      </View>
      <View className="mt-4 flex-row items-center justify-between border-t pt-3" style={{ borderColor: colors.line }}>
        <StatusPill status={note.status} />
        <View className="flex-row items-center gap-1.5">{note.lat != null && note.lng != null ? <MapPin size={13} color={colors.brand} /> : null}<Text style={{ color: colors.muted, fontSize: 12, fontWeight: "600" }}>{new Date(note.createdAt).toLocaleDateString()}</Text></View>
      </View>
    </Pressable>
  </Animated.View>;
}
