import { useQuery } from "@tanstack/react-query";
import { Image, Linking, Pressable, ScrollView, Share, Text, View } from "react-native";
import { Alert } from "@/utils/appAlert";
import { router, useLocalSearchParams } from "expo-router";
import Animated, { FadeInDown, useReducedMotion } from "react-native-reanimated";
import { ArrowLeft, CalendarDays, CloudUpload, MapPin, Pencil, RotateCw, Share2 } from "lucide-react-native";
import { Button, IconButton, Page, StatePanel, Surface } from "@/components/ui";
import { StatusPill } from "@/components/StatusPill";
import { getNote, listNotes } from "@/data/database";
import { resolveConflict } from "@/services/noteService";
import { retryNote } from "@/services/syncService";
import { useAppStore } from "@/store/appStore";
import { useTheme } from "@/theme/useTheme";
import { createNoteDeepLink } from "@/utils/noteLink";

export default function NoteDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors } = useTheme();
  const reduceMotion = useReducedMotion();
  const setNotes = useAppStore((state) => state.setNotes);
  const accountId = useAppStore((state) => state.accountId);
  const liveNote = useAppStore((state) => state.notes.find((item) => item.id === id));
  const query = useQuery({ queryKey: ["note", accountId, id], queryFn: () => getNote(id, accountId!), enabled: Boolean(id && accountId) });
  if (query.isLoading && !liveNote) return <Page><StatePanel kind="loading" title="Đang mở ghi chú" message="Đọc nội dung đã lưu trên thiết bị…" /></Page>;
  if (query.isError && !liveNote) return <Page><StatePanel kind="error" title="Không mở được ghi chú" message="Có thể dữ liệu đang tạm thời không sẵn sàng." retry={() => void query.refetch()} /></Page>;
  const note = liveNote ?? query.data;
  if (!note) return <Page><StatePanel kind="empty" title="Không tìm thấy ghi chú" message="Ghi chú này có thể đã bị xóa trên thiết bị." retry={() => router.back()} /></Page>;

  const resolve = async (choice: "server" | "local") => { await resolveConflict(id, choice); await query.refetch(); if (accountId) setNotes(await listNotes(accountId)); };
  const openMap = () => { if (note.lat != null && note.lng != null) void Linking.openURL(`https://maps.google.com/?q=${note.lat},${note.lng}`); };
  const shareLink = async () => {
    const url = createNoteDeepLink(note.id);
    try { await Share.share({ message: `${note.title}\n${url}`, url }); }
    catch { Alert.alert("Không thể chia sẻ", "Liên kết ghi chú chưa thể mở để chia sẻ."); }
  };

  return <Page><ScrollView className="flex-1" showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 34 }}>
    <View className="flex-row items-center justify-between pb-4 pt-3">
      <IconButton label="Quay lại danh sách" onPress={() => router.back()}><ArrowLeft color={colors.ink} size={19} /></IconButton>
      <View className="items-center"><Text className="text-[10px] font-extrabold uppercase tracking-[1.7px]" style={{ color: colors.brand }}>FIELD JOURNAL</Text><Text className="mt-0.5 text-[13px] font-bold" style={{ color: colors.ink }}>Chi tiết quan sát</Text></View>
      <IconButton label="Chia sẻ ghi chú" onPress={() => void shareLink()}><Share2 color={colors.ink} size={18} /></IconButton>
    </View>
    <Animated.View entering={reduceMotion ? undefined : FadeInDown.duration(400)} className="overflow-hidden rounded-[28px] border" style={{ borderColor: colors.line, backgroundColor: colors.brandSoft }}>
      {note.photoUri ? <Image accessibilityLabel={`Ảnh đính kèm: ${note.title}`} source={{ uri: note.photoUri }} resizeMode="cover" style={{ width: "100%", height: 260, backgroundColor: colors.soft }} /> : <View className="h-[190px] items-center justify-center overflow-hidden">
        <View className="absolute -right-5 -top-16 h-[190px] w-[190px] rounded-full" style={{ backgroundColor: colors.brand, opacity: 0.1 }} />
        <View className="h-[82px] w-[82px] items-center justify-center rounded-[28px] border" style={{ backgroundColor: colors.surface, borderColor: colors.line, transform: [{ rotate: "-8deg" }] }}><MapPin size={37} color={colors.brand} strokeWidth={1.7} /></View>
        <Text className="mt-4 text-[10px] font-extrabold uppercase tracking-[2.5px]" style={{ color: colors.brand }}>Field observation</Text>
      </View>}
    </Animated.View>

    <Animated.View entering={reduceMotion ? undefined : FadeInDown.delay(70).duration(420)} className="pt-5">
      <View className="mb-3 flex-row items-center justify-between"><StatusPill status={note.status} /><View className="flex-row items-center gap-1.5"><CalendarDays size={14} color={colors.muted} /><Text style={{ color: colors.muted, fontSize: 12, fontWeight: "600" }}>{new Date(note.createdAt).toLocaleDateString()}</Text></View></View>
      <Text className="text-[29px] font-extrabold leading-[36px]" style={{ color: colors.ink }}>{note.title}</Text>
      <Surface className="mt-5 px-5 py-5">
        <View className="mb-3 flex-row items-center gap-2"><View className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: colors.accent }} /><Text className="text-[11px] font-extrabold uppercase tracking-[1.5px]" style={{ color: colors.brand }}>Ghi chép thực địa</Text></View>
        <Text selectable className="text-[16px] leading-[27px]" style={{ color: colors.ink }}>{note.body}</Text>
      </Surface>

      {note.lat != null && note.lng != null ? <Pressable accessibilityRole="button" accessibilityLabel="Mở vị trí của ghi chú trên bản đồ" onPress={openMap} className="mt-4 flex-row items-center gap-3 rounded-[22px] border p-4" style={{ backgroundColor: colors.raised, borderColor: colors.line }}>
        <View className="h-11 w-11 items-center justify-center rounded-[15px]" style={{ backgroundColor: colors.brandSoft }}><MapPin color={colors.brand} size={20} /></View><View className="flex-1"><Text className="text-[13px] font-extrabold" style={{ color: colors.ink }}>Vị trí quan sát</Text><Text className="mt-1 text-[12px]" style={{ color: colors.muted }}>{note.lat.toFixed(5)}, {note.lng.toFixed(5)}</Text></View><MapPin color={colors.brand} size={16} />
      </Pressable> : null}

      {note.syncError ? <View accessibilityRole="alert" className="mt-4 rounded-[22px] border p-4" style={{ backgroundColor: colors.soft, borderColor: colors.line }}><View className="flex-row items-center gap-2"><CloudUpload color={note.status === "conflict" ? colors.danger : colors.warning} size={18} /><Text className="font-extrabold" style={{ color: note.status === "conflict" ? colors.danger : colors.warning }}>{note.status === "conflict" ? "Cần giải quyết xung đột" : "Đồng bộ đang gặp lỗi"}</Text></View><Text className="mt-2 text-[14px] leading-5" style={{ color: colors.ink }}>{note.syncError}</Text></View> : null}

      {note.status === "conflict" ? <Surface className="mt-4">
        <Text className="text-base font-extrabold" style={{ color: colors.ink }}>Chọn phiên bản cần giữ</Text><Text className="mb-4 mt-2 text-[13px] leading-5" style={{ color: colors.muted }}>Bản máy chủ và bản trên thiết bị được giữ riêng cho đến khi bạn chọn.</Text>
        <Button title="Tải bản từ máy chủ" variant="secondary" onPress={() => void resolve("server")} />
        <View className="mt-2"><Button title="Giữ bản trên thiết bị" onPress={() => void resolve("local")} /></View>
      </Surface> : null}

      {note.status === "failed" ? <View className="mt-4"><Button title="Thử đồng bộ lại" onPress={() => void retryNote(note.id).then(() => query.refetch())} icon={<RotateCw color={colors.paper} size={18} />} /></View> : null}
      <View className="mt-5 flex-row gap-3">
        <View className="flex-1"><Button title="Chỉnh sửa" variant="secondary" onPress={() => router.push({ pathname: "/notes/new", params: { editId: note.id } })} icon={<Pencil color={colors.ink} size={17} />} /></View>
        <View className="flex-1"><Button title="Chia sẻ" variant="secondary" onPress={() => void shareLink()} icon={<Share2 color={colors.ink} size={17} />} /></View>
      </View>
    </Animated.View>
  </ScrollView></Page>;
}
