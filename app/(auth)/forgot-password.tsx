import { useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, Text, View } from "react-native";
import { Alert } from "@/utils/appAlert";
import { router } from "expo-router";
import { ArrowLeft, KeyRound, Mail } from "lucide-react-native";
import { Button, Field, IconButton, Page, ScreenIntro, Surface } from "@/components/ui";
import { ApiError, authApi } from "@/services/noteApi";
import { useTheme } from "@/theme/useTheme";

export default function ForgotPasswordScreen() {
  const { colors } = useTheme();
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  const sendCode = async () => {
    if (!email.trim()) { Alert.alert("Thiếu email", "Nhập email đã dùng để đăng ký tài khoản."); return; }
    setLoading(true);
    try { await authApi.requestPasswordReset(email.trim()); setSent(true); }
    catch (error) {
      const message = error instanceof ApiError && error.status === 503 ? "Máy chủ chưa sẵn sàng gửi email đặt lại mật khẩu." : error instanceof ApiError && error.status === 429 ? "Bạn đã thử quá nhiều lần. Hãy thử lại sau." : "Không gửi được yêu cầu. Hãy kiểm tra kết nối và thử lại.";
      Alert.alert("Chưa thể gửi yêu cầu", message);
    } finally { setLoading(false); }
  };
  const resetPassword = async () => {
    if (!code.trim() || password.length < 8 || password !== confirmation) { Alert.alert("Kiểm tra thông tin", "Dán mã từ email và nhập hai mật khẩu giống nhau, ít nhất 8 ký tự."); return; }
    setLoading(true);
    try {
      await authApi.confirmPasswordReset(code.trim(), password);
      Alert.alert("Đã đổi mật khẩu", "Hãy đăng nhập lại bằng tài khoản và mật khẩu mới.", [{ text: "Đăng nhập", onPress: () => router.replace("/(auth)/sign-in") }]);
    } catch (error) {
      const message = error instanceof ApiError && error.status === 429 ? "Bạn đã thử quá nhiều lần. Hãy thử lại sau." : error instanceof ApiError && error.status === 400 ? "Mã không hợp lệ hoặc đã hết hạn. Hãy yêu cầu mã mới và kiểm tra mật khẩu." : "Không thể đổi mật khẩu lúc này. Hãy thử lại.";
      Alert.alert("Chưa thể đổi mật khẩu", message);
    } finally { setLoading(false); }
  };

  return <Page><KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ flexGrow: 1, paddingHorizontal: 22, paddingTop: 14, paddingBottom: 30 }}>
      <View className="mb-4"><IconButton label="Quay lại đăng nhập" onPress={() => router.back()}><ArrowLeft color={colors.ink} size={20} /></IconButton></View>
      <ScreenIntro kicker="FIELD NOTES · ACCOUNT" title="Quên mật khẩu?" subtitle="Nhận mã qua email đã đăng ký, sau đó đặt mật khẩu mới." accessory={<View className="h-[58px] w-[58px] items-center justify-center rounded-[21px]" style={{ backgroundColor: colors.brandSoft }}><KeyRound color={colors.brand} size={27} /></View>} />
      <Surface className="px-5 py-6">
        <Field label="Email đã đăng ký" placeholder="ten@email.com" autoCapitalize="none" autoCorrect={false} keyboardType="email-address" value={email} onChangeText={setEmail} />
        <Button title={loading && !sent ? "Đang gửi…" : sent ? "Gửi lại mã" : "Gửi mã qua email"} onPress={() => void sendCode()} disabled={loading} loading={loading && !sent} icon={<Mail color={colors.paper} size={18} />} />
        {sent ? <View className="mt-5">
          <Text className="mb-4 text-[13px] leading-5" style={{ color: colors.muted }}>Nếu email đã đăng ký, mã sẽ được gửi tới hộp thư. Kiểm tra cả thư rác; mã có hiệu lực 15 phút.</Text>
          <Field label="Mã đặt lại từ email" placeholder="Dán toàn bộ mã tại đây" multiline autoCapitalize="none" autoCorrect={false} value={code} onChangeText={setCode} />
          <Field label="Mật khẩu mới" placeholder="Ít nhất 8 ký tự" secureTextEntry value={password} onChangeText={setPassword} />
          <Field label="Nhập lại mật khẩu mới" placeholder="Nhập lại mật khẩu" secureTextEntry value={confirmation} onChangeText={setConfirmation} />
          <Button title={loading ? "Đang cập nhật…" : "Đổi mật khẩu"} onPress={() => void resetPassword()} disabled={loading} loading={loading} />
        </View> : null}
      </Surface>
    </ScrollView>
  </KeyboardAvoidingView></Page>;
}
