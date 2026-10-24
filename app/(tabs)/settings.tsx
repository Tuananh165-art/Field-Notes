import { useEffect, useRef, useState } from "react";
import { Image, Platform, Pressable, ScrollView, Share, Text, View } from "react-native";
import { Alert } from "@/utils/appAlert";
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import { router } from "expo-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Camera, Check, ChevronDown, Cloud, Download, LogIn, LogOut, Moon, Smartphone, Sun, UserRound } from "lucide-react-native";
import { Button, Field, Page, ScreenIntro, StatePanel, Surface } from "@/components/ui";
import { useAppStore } from "@/store/appStore";
import { adoptUnownedNotes, countUnownedNotes, exportNotesForDay, listNotes } from "@/data/database";
import { refreshNotes } from "@/services/noteService";
import { syncPendingNotes } from "@/services/syncService";
import { chooseAvatar, loadAvatar } from "@/services/avatarService";
import { csvEscape } from "@/utils/filterNotes";
import { formatLocalDay, localDayBounds } from "@/utils/dates";
import { useTheme } from "@/theme/useTheme";

const themeOptions = [
  { key: "light" as const, label: "Sáng", Icon: Sun },
  { key: "dark" as const, label: "Tối", Icon: Moon },
  { key: "system" as const, label: "Tự động", Icon: Smartphone },
];

export default function SettingsScreen() {
  const { colors } = useTheme();
  const token = useAppStore((state) => state.token);
  const accountId = useAppStore((state) => state.accountId);
  const sessionExpired = useAppStore((state) => state.sessionExpired);
  const preference = useAppStore((state) => state.themeMode);
  const setThemeMode = useAppStore((state) => state.setThemeMode);
  const signOut = useAppStore((state) => state.signOut);
  const queryClient = useQueryClient();
  const [day, setDay] = useState(formatLocalDay(new Date()));
  const [openAccountId, setOpenAccountId] = useState<string | null | undefined>(undefined);
  const [avatar, setAvatar] = useState<{ ownerId: string; uri: string | null } | null>(null);
  const avatarRevision = useRef(0);
  const accountOpen = openAccountId === accountId;
  const avatarUri = avatar?.ownerId === accountId ? avatar.uri : null;
  const [avatarLoading, setAvatarLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const notesQuery = useQuery({ queryKey: ["local-notes", accountId], queryFn: () => accountId ? listNotes(accountId) : Promise.resolve([]) });
  const legacyQuery = useQuery({ queryKey: ["unowned-local-notes"], queryFn: countUnownedNotes });
  useEffect(() => {
    let active = true;
    const revision = avatarRevision.current;
    if (accountId) void loadAvatar(accountId).then((uri) => { if (active && avatarRevision.current === revision) setAvatar({ ownerId: accountId, uri }); }).catch(() => undefined);
    return () => { active = false; };
  }, [accountId]);
  if (notesQuery.isLoading && !notesQuery.data) return <Page><StatePanel kind="loading" title="Đang tải cài đặt" message="Đọc trạng thái lưu trữ trên thiết bị…" /></Page>;
  if (notesQuery.isError && !notesQuery.data) return <Page><StatePanel kind="error" title="Không tải được trạng thái" message="Thử đọc lại dữ liệu trên thiết bị." retry={() => void notesQuery.refetch()} /></Page>;

  const exportDay = async () => {
    if (!localDayBounds(day)) { Alert.alert("Ngày chưa hợp lệ", "Nhập một ngày có thật theo định dạng YYYY-MM-DD."); return; }
    setExporting(true);
    try {
      if (!accountId) { Alert.alert("Đăng nhập để xuất", "Phiên đăng nhập không còn hoạt động."); return; }
      const notes = await exportNotesForDay(day, accountId);
      if (!notes.length) { Alert.alert("Chưa có ghi chú", `Không có ghi chú nào vào ngày ${day}.`); return; }
      const rows = [["id", "title", "body", "status", "createdAt", "lat", "lng"], ...notes.map((note) => [note.id, note.title, note.body, note.status, note.createdAt, String(note.lat ?? ""), String(note.lng ?? "")])];
      const csv = `\uFEFF${rows.map((row) => row.map(csvEscape).join(",")).join("\r\n")}`;
      if (Platform.OS === "web") {
        const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
        const link = document.createElement("a");
        link.href = url;
        link.download = `field-notes-${day}.csv`;
        document.body.appendChild(link);
        link.click();
        link.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
        return;
      }
      if (!FileSystem.cacheDirectory) throw new Error("Thiết bị không có thư mục tạm để tạo tệp CSV.");
      const path = `${FileSystem.cacheDirectory}field-notes-${day}.csv`;
      await FileSystem.writeAsStringAsync(path, csv);
      if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(path, { mimeType: "text/csv", dialogTitle: `Ghi chú ${day}` });
      else await Share.share({ message: csv, title: `Ghi chú ${day}` });
    } catch (error) { Alert.alert("Không thể xuất", error instanceof Error ? error.message : "Vui lòng thử lại."); }
    finally { setExporting(false); }
  };
  const selectAvatar = async () => {
    if (!accountId || avatarLoading) return;
    const ownerId = accountId;
    setAvatarLoading(true);
    try {
      const uri = await chooseAvatar(ownerId);
      if (uri && useAppStore.getState().accountId === ownerId) {
        avatarRevision.current += 1;
        setAvatar({ ownerId, uri });
      }
    } catch (error) {
      Alert.alert("Không thể chọn ảnh", error instanceof Error ? error.message : "Hãy kiểm tra quyền truy cập ảnh và thử lại.");
    } finally { setAvatarLoading(false); }
  };
  const confirmSignOut = () => Alert.alert("Đăng xuất khỏi thiết bị?", "Ghi chú và hàng đợi đồng bộ được giữ riêng cho tài khoản này. Chúng sẽ tiếp tục đồng bộ khi bạn đăng nhập lại bằng cùng tài khoản.", [
    { text: "Hủy", style: "cancel" },
    { text: "Đăng xuất", style: "destructive", onPress: () => { void signOut().then(() => { setOpenAccountId(undefined); queryClient.clear(); }).catch(() => Alert.alert("Không thể đăng xuất", "Vui lòng thử lại.")); } },
  ]);
  const importLegacyNotes = () => {
    if (!accountId) return;
    Alert.alert("Nhập ghi chú cục bộ cũ?", `Tìm thấy ${legacyQuery.data ?? 0} ghi chú chưa gắn tài khoản từ phiên bản ứng dụng cũ. Chúng sẽ được chuyển toàn bộ vào tài khoản đang đăng nhập; phiên bản cũ không lưu đủ dữ liệu để tách chúng theo từng tài khoản.`, [
      { text: "Để sau", style: "cancel" },
      { text: "Nhập vào tài khoản này", onPress: () => { void adoptUnownedNotes(accountId).then(async () => { await refreshNotes(); await queryClient.invalidateQueries({ queryKey: ["local-notes", accountId] }); await legacyQuery.refetch(); void syncPendingNotes(); }); } },
    ]);
  };

  return <Page><ScrollView className="flex-1" showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 20, paddingBottom: 32 }}>
    <ScreenIntro kicker="YOUR FIELD KIT" title="Cài đặt" subtitle="Điều chỉnh trải nghiệm và quản lý sổ tay của bạn." accessory={<View className="h-[54px] w-[54px] items-center justify-center rounded-[20px]" style={{ backgroundColor: colors.brandSoft, borderWidth: 1, borderColor: colors.line }}><Smartphone color={colors.brand} size={25} strokeWidth={1.8} /></View>} />

    <Surface className="mb-5 p-4" style={{ backgroundColor: colors.raised }}>
      <Pressable accessibilityRole="button" accessibilityLabel="Mở tùy chọn tài khoản và ảnh đại diện" accessibilityState={{ expanded: accountOpen }} onPress={() => setOpenAccountId((current) => current === accountId ? undefined : accountId)} style={{ flexDirection: "row", alignItems: "center", gap: 14, minHeight: 60 }}>
        <View style={{ width: 58, height: 58, borderRadius: 19, backgroundColor: colors.brandSoft, alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
          {avatarUri ? <Image source={{ uri: avatarUri }} accessibilityLabel="Ảnh đại diện" style={{ width: "100%", height: "100%" }} /> : <UserRound size={25} color={colors.brand} />}
        </View>
        <View style={{ flex: 1 }}><Text className="text-base font-extrabold" style={{ color: colors.ink }}>{sessionExpired ? "Cần đăng nhập lại" : token ? "Tài khoản đã kết nối" : "Sổ tay trên thiết bị"}</Text><Text className="mt-1 text-[13px] leading-5" style={{ color: colors.muted }}>Chạm để quản lý tài khoản và ảnh đại diện</Text></View>
        <View style={{ alignItems: "flex-end", gap: 2 }}><Text style={{ color: colors.brand, fontSize: 18, fontWeight: "800" }}>{notesQuery.data?.length ?? 0}</Text><Text style={{ color: colors.muted, fontSize: 10, fontWeight: "700" }}>GHI CHÚ</Text><ChevronDown size={16} color={colors.muted} /></View>
      </Pressable>
      {accountOpen ? <View testID="account-actions" style={{ marginTop: 16, gap: 10 }}>
        {accountId ? <Pressable accessibilityRole="button" accessibilityLabel="Chọn ảnh đại diện từ thiết bị" disabled={avatarLoading} onPress={() => void selectAvatar()} style={{ minHeight: 52, borderRadius: 16, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 9, opacity: avatarLoading ? 0.6 : 1 }}><Camera size={18} color={colors.brand} /><Text style={{ color: colors.ink, fontSize: 14, fontWeight: "800" }}>{avatarLoading ? "Đang lưu ảnh…" : "Chọn ảnh đại diện"}</Text></Pressable> : null}
        {accountId ? <Text style={{ color: colors.muted, fontSize: 12, lineHeight: 18 }}>Ảnh được lưu trên thiết bị này cho tài khoản hiện tại.</Text> : null}
        {!token || sessionExpired ? <Pressable accessibilityRole="button" accessibilityLabel="Đăng nhập" onPress={() => router.push("/(auth)/sign-in")} style={{ minHeight: 52, borderRadius: 16, backgroundColor: colors.brand, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 9 }}><LogIn size={18} color={colors.paper} /><Text style={{ color: colors.paper, fontSize: 14, fontWeight: "800" }}>{sessionExpired ? "Đăng nhập lại" : "Đăng nhập"}</Text></Pressable> : null}
        {token ? <Pressable accessibilityRole="button" accessibilityLabel="Đăng xuất" onPress={confirmSignOut} style={{ minHeight: 52, borderRadius: 16, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 9 }}><LogOut size={18} color={colors.danger} /><Text style={{ color: colors.danger, fontSize: 14, fontWeight: "800" }}>Đăng xuất</Text></Pressable> : null}
      </View> : null}
    </Surface>

    <Surface className="mb-5">
      <View className="mb-4 flex-row items-center justify-between"><View><Text className="text-[17px] font-extrabold" style={{ color: colors.ink }}>Giao diện</Text><Text className="mt-1 text-[13px]" style={{ color: colors.muted }}>Chọn cách sổ tay xuất hiện</Text></View><Sun color={colors.brand} size={21} /></View>
      <View className="flex-row gap-2">
        {themeOptions.map(({ key, label, Icon }) => {
          const active = preference === key;
          return <Pressable key={key} accessibilityRole="button" accessibilityLabel={`Dùng giao diện ${label}`} accessibilityState={{ selected: active }} onPress={() => setThemeMode(key)} className="h-[68px] flex-1 items-center justify-center rounded-2xl border" style={{ backgroundColor: active ? colors.brand : colors.surface, borderColor: active ? colors.brand : colors.line, gap: 5 }}>
            {active ? <Check color={colors.paper} size={16} strokeWidth={3} /> : <Icon color={colors.muted} size={17} />}
            <Text numberOfLines={1} style={{ color: active ? colors.paper : colors.ink, fontSize: 12, fontWeight: "800" }}>{label}</Text>
          </Pressable>;
        })}
      </View>
    </Surface>

    {token && (legacyQuery.data ?? 0) > 0 ? <Surface className="mb-5" style={{ backgroundColor: colors.soft }}>
      <Text className="text-base font-extrabold" style={{ color: colors.ink }}>Ghi chú từ phiên bản cũ</Text>
      <Text className="mb-4 mt-2 text-[14px] leading-6" style={{ color: colors.muted }}>{legacyQuery.data} ghi chú chưa được gắn tài khoản. Phiên bản cũ không lưu đủ dữ liệu để phân chia chúng theo người dùng.</Text>
      <Button title="Nhập vào tài khoản này" variant="secondary" onPress={importLegacyNotes} />
    </Surface> : null}

    <Surface className="mb-5">
      <View className="mb-4 flex-row items-center gap-3"><View className="h-10 w-10 items-center justify-center rounded-[14px]" style={{ backgroundColor: colors.brandSoft }}><Download color={colors.brand} size={19} /></View><View className="flex-1"><Text className="text-[17px] font-extrabold" style={{ color: colors.ink }}>Xuất sổ tay</Text><Text className="mt-1 text-[13px] leading-5" style={{ color: colors.muted }}>{Platform.OS === "web" ? "Chọn ngày tạo ghi chú để tải tệp CSV về trình duyệt." : "Chọn ngày tạo ghi chú. Ứng dụng sẽ tạo tệp CSV và mở bảng chia sẻ để bạn lưu vào Tệp hoặc gửi đi."}</Text></View></View>
      {!notesQuery.data?.length ? <Text accessibilityRole="text" className="mb-4 rounded-2xl border px-4 py-3 text-[13px] leading-5" style={{ backgroundColor: colors.raised, borderColor: colors.line, color: colors.muted }}>Tạo ghi chú đầu tiên để xuất dữ liệu tại đây.</Text> : null}
      <Field label="Ngày cần xuất" value={day} onChangeText={setDay} placeholder="YYYY-MM-DD" accessibilityLabel="Ngày cần xuất theo định dạng năm-tháng-ngày" />
      <Pressable accessibilityRole="button" accessibilityLabel={Platform.OS === "web" ? "Tải tệp CSV" : "Tạo tệp CSV và chia sẻ"} accessibilityState={{ disabled: exporting }} disabled={exporting} onPress={() => void exportDay()} style={{ minHeight: 58, borderRadius: 18, backgroundColor: colors.brand, opacity: exporting ? 0.65 : 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, paddingHorizontal: 16 }}><Download color={colors.paper} size={19} /><Text style={{ color: colors.paper, fontSize: 15, fontWeight: "800" }}>{exporting ? "Đang tạo tệp…" : Platform.OS === "web" ? "Tải tệp CSV" : "Tạo tệp CSV và chia sẻ"}</Text></Pressable>
      {Platform.OS !== "web" ? <Text className="mt-3 text-center text-[12px] leading-5" style={{ color: colors.muted }}>Chọn “Lưu vào Tệp” hoặc một ứng dụng trong bảng chia sẻ.</Text> : null}
    </Surface>

    <View className="gap-3">
      {token ? <Button title="Đăng xuất khỏi thiết bị" variant="danger" onPress={confirmSignOut} icon={<LogOut color={colors.paper} size={18} />} /> : <Button title="Đăng nhập" variant="secondary" onPress={() => router.replace("/(auth)/sign-in")} icon={<Cloud color={colors.ink} size={18} />} />}
      <Text className="px-5 text-center text-[12px] leading-5" style={{ color: colors.muted }}>Field Notes · Dữ liệu luôn được lưu trên thiết bị trước khi đồng bộ.</Text>
    </View>
  </ScrollView></Page>;
}
