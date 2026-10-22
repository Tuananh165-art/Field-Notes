import { useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, Text, View } from "react-native";
import { Alert } from "@/utils/appAlert";
import { Link, router } from "expo-router";
import { ArrowLeft, ArrowRight, Cloud, UserRoundPlus } from "lucide-react-native";
import { Button, Field, IconButton, Page, ScreenIntro, Surface } from "@/components/ui";
import { authApi } from "@/services/noteApi";
import { refreshNotes } from "@/services/noteService";
import { syncPendingNotes } from "@/services/syncService";
import { useAppStore } from "@/store/appStore";
import { useTheme } from "@/theme/useTheme";

export default function SignUpScreen() {
  const { colors } = useTheme();
  const setToken = useAppStore((state) => state.setToken);
  const accountId = useAppStore((state) => state.accountId);
  const sessionExpired = useAppStore((state) => state.sessionExpired);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const signUp = async () => {
    if (!email.trim() || password.length < 8) { Alert.alert("Kiểm tra thông tin", "Nhập email hợp lệ và mật khẩu ít nhất 8 ký tự."); return; }
    setLoading(true);
    try { const result = await authApi.signUp(email.trim(), password); await setToken(result.token, result.user.id); await refreshNotes(); void syncPendingNotes(); router.replace("/(tabs)"); }
    catch (error) { Alert.alert("Chưa thể tạo tài khoản", error instanceof Error ? error.message : "Không kết nối được máy chủ."); }
    finally { setLoading(false); }
  };
  return <Page><KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
    <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} contentContainerStyle={{ flexGrow: 1, paddingHorizontal: 22, paddingTop: 14, paddingBottom: 30 }}>
      <View className="mb-4"><IconButton label="Quay lại đăng nhập" onPress={() => router.back()}><ArrowLeft color={colors.ink} size={20} /></IconButton></View>
      <ScreenIntro kicker="FIELD NOTES · NEW ACCOUNT" title="Bắt đầu lưu lại" subtitle="Tạo tài khoản để đồng bộ sổ tay giữa các thiết bị." accessory={<View className="h-[58px] w-[58px] items-center justify-center rounded-[21px]" style={{ backgroundColor: colors.brandSoft, borderWidth: 1, borderColor: colors.line }}><UserRoundPlus color={colors.brand} size={27} strokeWidth={1.8} /></View>} />
      <Surface className="px-5 py-6">
        {sessionExpired && accountId ? <Text className="mb-4 text-[13px] leading-5" style={{ color: colors.warning }}>Ghi chú hiện có vẫn thuộc tài khoản cũ. Tài khoản mới sẽ có sổ tay riêng; hãy đăng nhập lại tài khoản cũ để đồng bộ các ghi chú đó.</Text> : null}
        <View className="mb-5 flex-row items-center gap-3 rounded-2xl border px-3.5 py-3" style={{ backgroundColor: colors.raised, borderColor: colors.line }}><View className="h-9 w-9 items-center justify-center rounded-xl" style={{ backgroundColor: colors.brandSoft }}><Cloud color={colors.brand} size={18} /></View><Text className="flex-1 text-[13px] leading-5" style={{ color: colors.muted }}>Ghi chú vẫn được lưu trên máy trước khi đồng bộ.</Text></View>
        <Field label="Email" placeholder="ten@email.com" autoCapitalize="none" autoCorrect={false} keyboardType="email-address" textContentType="emailAddress" value={email} onChangeText={setEmail} returnKeyType="next" />
        <Field label="Mật khẩu" placeholder="Tạo mật khẩu, ít nhất 8 ký tự" secureTextEntry textContentType="newPassword" value={password} onChangeText={setPassword} onSubmitEditing={() => void signUp()} returnKeyType="go" />
        <Button title={loading ? "Đang tạo tài khoản…" : "Tạo tài khoản"} onPress={() => void signUp()} disabled={loading} loading={loading} icon={<ArrowRight color={colors.paper} size={18} />} />
        <View className="mt-5 flex-row flex-wrap items-center justify-center gap-1"><Text style={{ color: colors.muted }}>Đã có tài khoản?</Text><Link href="/(auth)/sign-in" accessibilityRole="link" style={{ color: colors.brand, fontWeight: "800", minHeight: 44, paddingHorizontal: 8, paddingVertical: 12 }}>Đăng nhập</Link></View>
      </Surface>
    </ScrollView>
  </KeyboardAvoidingView></Page>;
}
