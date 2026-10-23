import { ActivityIndicator, Pressable, Text, TextInput, View, type StyleProp, type TextInputProps, type ViewStyle } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { ReactNode } from "react";
import Animated, { FadeInDown, useReducedMotion } from "react-native-reanimated";
import { AlertCircle, BookOpen, Compass, WifiOff } from "lucide-react-native";
import { useTheme } from "@/theme/useTheme";

export function Page({ children }: { children: ReactNode }) {
  const { colors } = useTheme();
  return <SafeAreaView className="flex-1" style={{ backgroundColor: colors.paper }}>{children}</SafeAreaView>;
}

export function ScreenIntro({ kicker, title, subtitle, accessory }: { kicker: string; title: string; subtitle: string; accessory?: ReactNode }) {
  const { colors } = useTheme();
  const reduceMotion = useReducedMotion();
  return <Animated.View entering={reduceMotion ? undefined : FadeInDown.duration(420).springify().damping(19)} className="mb-6 flex-row items-center justify-between gap-4">
    <View className="flex-1">
      <Text className="mb-2 text-[11px] font-extrabold uppercase tracking-[2.4px]" style={{ color: colors.brand }}>{kicker}</Text>
      <Text className="text-[30px] font-extrabold leading-9" style={{ color: colors.ink }}>{title}</Text>
      <Text className="mt-2 text-[15px] leading-6" style={{ color: colors.muted }}>{subtitle}</Text>
    </View>
    {accessory}
  </Animated.View>;
}

export function Surface({ children, className = "", style }: { children: ReactNode; className?: string; style?: StyleProp<ViewStyle> }) {
  const { colors } = useTheme();
  return <View className={`rounded-[26px] border p-5 ${className}`} style={[{ backgroundColor: colors.card, borderColor: colors.line, shadowColor: colors.shadow, shadowOpacity: 0.1, shadowRadius: 18, shadowOffset: { width: 0, height: 8 }, elevation: 2 }, style]}>{children}</View>;
}

export function IconButton({ label, onPress, children, tone = "soft" }: { label: string; onPress: () => void; children: ReactNode; tone?: "soft" | "surface" }) {
  const { colors } = useTheme();
  return <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} className="h-12 w-12 items-center justify-center rounded-2xl border" style={({ pressed }) => ({ backgroundColor: tone === "soft" ? colors.soft : colors.surface, borderColor: colors.line, opacity: pressed ? 0.78 : 1, transform: [{ scale: pressed ? 0.96 : 1 }] })}>
      {children}
    </Pressable>;
}

export function Button({ title, onPress, variant = "primary", disabled, loading, icon, accessibilityLabel }: { title: string; onPress: () => void; variant?: "primary" | "secondary" | "ghost" | "danger"; disabled?: boolean; loading?: boolean; icon?: ReactNode; accessibilityLabel?: string }) {
  const { colors } = useTheme();
  const backgroundColor = variant === "primary" ? colors.brand : variant === "danger" ? colors.danger : variant === "secondary" ? colors.surface : "transparent";
  const color = variant === "primary" || variant === "danger" ? colors.paper : colors.ink;
  const outlined = variant === "secondary" || variant === "ghost";
  return <Pressable accessibilityRole="button" accessibilityLabel={accessibilityLabel ?? title} accessibilityState={{ disabled: disabled || loading }} disabled={disabled || loading} onPress={onPress} className="min-h-[54px] flex-row items-center justify-center rounded-[18px] px-5" style={({ pressed }) => ({ backgroundColor, borderColor: colors.line, borderWidth: outlined ? 1 : 0, opacity: disabled || loading ? 0.62 : pressed ? 0.82 : 1, gap: 10, transform: [{ scale: pressed && !disabled && !loading ? 0.985 : 1 }] })}>
      {loading ? <ActivityIndicator size="small" color={color} /> : icon}
      <Text style={{ color, fontSize: 15, fontWeight: "800", letterSpacing: 0.1 }}>{title}</Text>
    </Pressable>;
}

export function Field({ label, error, multiline, ...props }: TextInputProps & { label: string; error?: string }) {
  const { colors } = useTheme();
  return <View className="mb-5 gap-2.5">
    <Text accessibilityRole="text" style={{ color: colors.ink, fontWeight: "700", fontSize: 14, letterSpacing: 0.2 }}>{label}</Text>
    <TextInput accessibilityLabel={label} placeholderTextColor={colors.muted} selectionColor={colors.brand} multiline={multiline} textAlignVertical={multiline ? "top" : "center"} className="rounded-[18px] px-4 py-4" style={{ color: colors.ink, backgroundColor: colors.surface, borderColor: error ? colors.danger : colors.line, borderWidth: 1, minHeight: multiline ? 158 : 58, fontSize: 16, lineHeight: 23 }} {...props} />
    {error ? <Text accessibilityRole="alert" style={{ color: colors.danger, fontSize: 13 }}>{error}</Text> : null}
  </View>;
}

export function StatePanel({ kind, title, message, retry }: { kind: "loading" | "empty" | "error"; title: string; message: string; retry?: () => void }) {
  const { colors } = useTheme();
  const Icon = kind === "error" ? AlertCircle : kind === "empty" ? BookOpen : Compass;
  return <View className="flex-1 items-center justify-center px-8" accessibilityLiveRegion="polite">
    {kind === "loading" ? <ActivityIndicator color={colors.brand} size="large" /> : <View className="mb-2 h-[68px] w-[68px] items-center justify-center rounded-[24px]" style={{ backgroundColor: colors.brandSoft }}><Icon color={kind === "error" ? colors.danger : colors.brand} size={30} strokeWidth={1.8} /></View>}
    <Text className="mt-4 text-center text-xl font-extrabold" style={{ color: colors.ink }}>{title}</Text>
    <Text className="mt-2 text-center leading-6" style={{ color: colors.muted }}>{message}</Text>
    {kind === "error" && retry ? <View className="mt-5 w-full"><Button title="Thử lại" onPress={retry} icon={<WifiOff color={colors.paper} size={17} />} /></View> : null}
  </View>;
}
