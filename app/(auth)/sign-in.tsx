import { useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, Text, View } from "react-native";
import { Alert } from "@/utils/appAlert";
import { Link, router } from "expo-router";
import { ArrowRight, BookOpen, CloudOff, Sparkles } from "lucide-react-native";
import { Button, Field, Page, ScreenIntro, Surface } from "@/components/ui";
import { authApi } from "@/services/noteApi";
import { refreshNotes } from "@/services/noteService";
import { syncPendingNotes } from "@/services/syncService";
import { recoverAuthFailures } from "@/data/database";
import { useAppStore } from "@/store/appStore";
import { useTheme } from "@/theme/useTheme";

export default function SignInScreen() {
  const { colors } = useTheme();
  const setToken = useAppStore((state) => state.setToken);
  const accountId = useAppStore((state) => state.accountId);
  const sessionExpired = useAppStore((state) => state.sessionExpired);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const signIn = async () => {
    if (!email.trim() || password.length < 8) { Alert.alert("Kiểm tra thông tin", "Nhập email và mật khẩu ít nhất 8 ký tự."); return; }
    setLoading(true);
    try {
      const result = await authApi.signIn(email.trim(), password);
      if (sessionExpired && accountId && result.user.id !== accountId) {
        Alert.alert("Cần đúng tài khoản", "Ghi chú trên thiết bị thuộc tài khoản khác. Hãy đăng nhập lại bằng tài khoản đã tạo các ghi chú này.");
        return;
      }
      await recoverAuthFailures(result.user.id);
      await setToken(result.token, result.user.id);
      await refreshNotes();
      void syncPendingNotes();
      router.replace("/(tabs)");
    }
    catch (error) { Alert.alert("Chưa thể đăng nhập", error instanceof Error ? `${error.message}. Ghi chú cục bộ vẫn dùng được sau khi đăng nhập.` : "Không kết nối được máy chủ."); }
    finally { setLoading(false); }
  };
  return <Page><KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
    <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} contentContainerStyle={{ flexGrow: 1, paddingHorizontal: 22, paddingTop: 24, paddingBottom: 30 }}>
      <ScreenIntro kicker="FIELD NOTES · OFFLINE FIRST" title="Chào mừng trở lại" subtitle="Ghi lại điều bạn nhìn thấy. Đồng bộ khi bạn trở lại vùng có sóng." accessory={<View className="h-[58px] w-[58px] items-center justify-center rounded-[21px]" style={{ backgroundColor: colors.brandSoft, borderWidth: 1, borderColor: colors.line }}><BookOpen color={colors.brand} size={27} strokeWidth={1.8} /></View>} />
      <Surface className="px-5 py-6">
        <View className="mb-5 flex-row items-center gap-2 rounded-full border px-3 py-2 self-start" style={{ backgroundColor: colors.raised, borderColor: colors.line }}><Sparkles size={14} color={colors.brand} /><Text className="text-[11px] font-extrabold uppercase tracking-[1px]" style={{ color: colors.brand }}>Sổ tay của bạn, luôn sẵn sàng</Text></View>
        <Field label="Email" placeholder="ten@email.com" autoCapitalize="none" autoCorrect={false} keyboardType="email-address" textContentType="username" value={email} onChangeText={setEmail} returnKeyType="next" />
        <Field label="Mật khẩu" placeholder="Ít nhất 8 ký tự" secureTextEntry textContentType="password" value={password} onChangeText={setPassword} onSubmitEditing={() => void signIn()} returnKeyType="go" />
        <Link href="/(auth)/forgot-password" accessibilityRole="link" style={{ color: colors.brand, fontWeight: "800", alignSelf: "flex-end", minHeight: 44, paddingVertical: 10 }}>Quên mật khẩu?</Link>
        <Button title={loading ? "Đang đăng nhập…" : "Đăng nhập"} onPress={() => void signIn()} disabled={loading} loading={loading} icon={<ArrowRight color={colors.paper} size={18} />} />
        {sessionExpired ? <View className="mt-4"><Button title="Quay lại ghi chú" variant="secondary" onPress={() => router.replace("/(tabs)")} /></View> : null}
        <View className="mt-5 flex-row flex-wrap items-center justify-center gap-1"><Text style={{ color: colors.muted }}>Chưa có tài khoản?</Text><Link href="/(auth)/sign-up" accessibilityRole="link" style={{ color: colors.brand, fontWeight: "800", minHeight: 44, paddingHorizontal: 8, paddingVertical: 12 }}>Đăng ký ngay</Link></View>
      </Surface>
      <View className="mt-5 flex-row items-center justify-center gap-2 px-3"><CloudOff size={16} color={colors.muted} /><Text className="flex-1 text-center text-[12px] leading-5" style={{ color: colors.muted }}>Ghi chú trên thiết bị luôn dùng được ngoại tuyến. Đăng nhập để đồng bộ giữa các thiết bị.</Text></View>
    </ScrollView>
  </KeyboardAvoidingView></Page>;
}
