import { useCallback, useMemo } from "react";
import { FlatList, Pressable, RefreshControl, ScrollView, Text, TextInput, View } from "react-native";
import { router, useFocusEffect } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import Animated, { FadeInUp, useReducedMotion } from "react-native-reanimated";
import { BookOpen, Check, Cloud, Plus, Search, Sparkles, WifiOff } from "lucide-react-native";
import { Button, Page, ScreenIntro, StatePanel, Surface } from "@/components/ui";
import { NoteCard } from "@/components/NoteCard";
import { filterNotes } from "@/utils/filterNotes";
import { refreshNotes } from "@/services/noteService";
import { getNote, saveNote } from "@/data/database";
import { ApiError, noteApi } from "@/services/noteApi";
import { useAppStore } from "@/store/appStore";
import { useTheme } from "@/theme/useTheme";
import type { NoteFilter } from "@/types/note";

const filters: { key: NoteFilter; label: string }[] = [
  { key: "all", label: "Tất cả" }, { key: "draft", label: "Nháp" }, { key: "queued", label: "Đang chờ" },
  { key: "synced", label: "Đã đồng bộ" }, { key: "failed", label: "Cần thử lại" }, { key: "conflict", label: "Xung đột" },
];

export default function NotesScreen() {
  const { colors } = useTheme();
  const reduceMotion = useReducedMotion();
  const token = useAppStore((state) => state.token);
  const sessionExpired = useAppStore((state) => state.sessionExpired);
  const accountId = useAppStore((state) => state.accountId);
  const notes = useAppStore((state) => state.notes);
  const search = useAppStore((state) => state.search);
  const filter = useAppStore((state) => state.filter);
  const setSearch = useAppStore((state) => state.setSearch);
  const setFilter = useAppStore((state) => state.setFilter);
  const localQuery = useQuery({ queryKey: ["local-notes", accountId], queryFn: refreshNotes });
  const remoteQuery = useQuery({ queryKey: ["remote-notes", accountId], queryFn: async () => {
    const remote = await noteApi.list();
    for (const note of remote.notes) {
      const local = accountId ? await getNote(note.id, accountId) : null;
      if (accountId && (!local || local.status === "synced")) await saveNote({ ...note, status: "synced", syncError: null, attempts: 0 }, accountId, false);
    }
    await refreshNotes();
    return remote;
  }, enabled: Boolean(token && accountId && !sessionExpired), refetchOnWindowFocus: true,
  retry: (failureCount, error) => !(error instanceof ApiError && error.status === 401) && failureCount < 1 });
  const refetchLocal = localQuery.refetch;
  const refetchRemote = remoteQuery.refetch;
  useFocusEffect(useCallback(() => { void refetchLocal(); if (token && !sessionExpired) void refetchRemote(); }, [token, sessionExpired, refetchLocal, refetchRemote]));
  const visible = useMemo(() => filterNotes(notes, search, filter), [notes, search, filter]);
  const pending = notes.filter((item) => ["queued", "failed", "conflict"].includes(item.status)).length;

  if (localQuery.isLoading && notes.length === 0) return <Page><StatePanel kind="loading" title="Đang mở sổ tay" message="Đọc ghi chú đã lưu trên thiết bị…" /></Page>;
  if (localQuery.isError && notes.length === 0) return <Page><StatePanel kind="error" title="Không đọc được ghi chú" message="Thử tải lại dữ liệu trên thiết bị." retry={() => void localQuery.refetch()} /></Page>;

  const listHeader = <View>
    <ScreenIntro kicker="FIELD NOTES · JOURNAL" title="Sổ ghi chép" subtitle="Quan sát và lưu lại mọi điều đáng nhớ — kể cả khi mất sóng." accessory={<View className="h-[54px] w-[54px] items-center justify-center rounded-[20px]" style={{ backgroundColor: colors.brandSoft, borderWidth: 1, borderColor: colors.line }}><BookOpen size={26} color={colors.brand} strokeWidth={1.8} /></View>} />

    <View className="mb-5 h-[58px] flex-row items-center rounded-[18px] border px-4" style={{ backgroundColor: colors.surface, borderColor: colors.line }}>
      <Search size={20} color={colors.muted} />
      <TextInput accessibilityLabel="Tìm tiêu đề hoặc nội dung" placeholder="Tìm trong sổ tay" placeholderTextColor={colors.muted} selectionColor={colors.brand} value={search} onChangeText={setSearch} returnKeyType="search" className="ml-3 flex-1 py-3 text-[15px]" style={{ color: colors.ink }} />
      {search.length > 0 ? <Pressable accessibilityRole="button" accessibilityLabel="Xóa từ khóa tìm kiếm" onPress={() => setSearch("")} className="rounded-full p-2"><Text style={{ color: colors.brand, fontSize: 12, fontWeight: "800" }}>XÓA</Text></Pressable> : null}
    </View>

    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0, flexShrink: 0, maxHeight: 45, marginBottom: 19 }} contentContainerStyle={{ alignItems: "center", gap: 8, paddingRight: 20 }}>
      {filters.map((item) => {
        const active = filter === item.key;
        const count = item.key === "all" ? notes.length : notes.filter((note) => note.status === item.key).length;
        return <Pressable key={item.key} accessibilityRole="button" accessibilityLabel={`Lọc ${item.label}, ${count} ghi chú`} accessibilityState={{ selected: active }} onPress={() => setFilter(item.key)} className="h-10 flex-row items-center rounded-full border px-4" style={{ backgroundColor: active ? colors.brand : colors.surface, borderColor: active ? colors.brand : colors.line, gap: 7 }}>
          {active ? <Check size={14} color={colors.paper} strokeWidth={3} /> : null}
          <Text style={{ color: active ? colors.paper : colors.muted, fontWeight: "700", fontSize: 13 }}>{item.label}</Text>
          <Text style={{ color: active ? colors.paper : colors.muted, fontSize: 12, fontWeight: "800", opacity: 0.82 }}>{count}</Text>
        </Pressable>;
      })}
    </ScrollView>

    <Surface className="mb-5 flex-row items-center justify-between px-4 py-4" style={{ backgroundColor: colors.raised }}>
      <View className="flex-row items-center gap-3">
        <View className="h-10 w-10 items-center justify-center rounded-[15px]" style={{ backgroundColor: pending > 0 ? colors.accent : colors.brandSoft }}>
          {token ? <Cloud size={19} color={pending > 0 ? colors.paper : colors.brand} /> : <WifiOff size={19} color={colors.muted} />}
        </View>
        <View>
          <Text style={{ color: colors.ink, fontWeight: "800", fontSize: 14 }}>{pending > 0 ? `${pending} mục cần đồng bộ` : token ? "Đồng bộ sẵn sàng" : "Lưu an toàn trên máy"}</Text>
          <Text className="mt-0.5" style={{ color: colors.muted, fontSize: 12 }}>{token ? "Các thay đổi được gửi khi có kết nối" : "Đăng nhập để đồng bộ giữa thiết bị"}</Text>
        </View>
      </View>
      <Sparkles size={17} color={colors.brand} />
    </Surface>

    <View className="mb-3 flex-row items-end justify-between">
      <View><Text className="text-[21px] font-extrabold" style={{ color: colors.ink }}>Gần đây</Text><Text className="mt-1 text-xs" style={{ color: colors.muted }}>{visible.length} ghi chú trong chế độ xem này</Text></View>
      <Text className="pb-0.5 text-xs font-bold" style={{ color: colors.brand }}>MỚI NHẤT</Text>
    </View>
    {sessionExpired ? <View accessibilityRole="alert" className="mb-3 rounded-2xl border px-4 py-3" style={{ backgroundColor: colors.soft, borderColor: colors.line }}>
      <Text style={{ color: colors.warning, fontSize: 13, lineHeight: 19 }}>Phiên đăng nhập không còn hợp lệ. Ghi chú vẫn được giữ trên thiết bị; hãy đăng nhập lại bằng cùng tài khoản để tiếp tục đồng bộ.</Text>
      <View className="mt-3"><Button title="Đăng nhập lại" onPress={() => router.push("/(auth)/sign-in")} /></View>
    </View> : remoteQuery.isError ? <View accessibilityRole="alert" className="mb-3 rounded-2xl border px-4 py-3" style={{ backgroundColor: colors.soft, borderColor: colors.line }}><Text style={{ color: colors.warning, fontSize: 13, lineHeight: 19 }}>Máy chủ hiện chưa kết nối. Ghi chú trên thiết bị vẫn dùng được và sẽ đồng bộ sau.</Text></View> : null}
  </View>;

  const emptyState = <Animated.View entering={reduceMotion ? undefined : FadeInUp.duration(430)} className="pt-2">
    <Surface className="items-center px-6 py-8">
      <View className="mb-5 h-[76px] w-[76px] items-center justify-center rounded-[26px]" style={{ backgroundColor: colors.brandSoft, transform: [{ rotate: "-7deg" }] }}><BookOpen size={34} color={colors.brand} strokeWidth={1.7} /></View>
      <Text className="text-center text-[21px] font-extrabold" style={{ color: colors.ink }}>{notes.length ? "Chưa có kết quả phù hợp" : "Bắt đầu câu chuyện của bạn"}</Text>
      <Text className="mt-2 max-w-[290px] text-center text-[14px] leading-6" style={{ color: colors.muted }}>{notes.length ? "Thử từ khóa khác hoặc chọn bộ lọc khác để tìm ghi chú." : "Lưu điều bạn nhìn thấy, một bức ảnh hoặc vị trí. Ghi chú luôn được lưu ngoại tuyến trước."}</Text>
      {!notes.length ? <View className="mt-6 w-full"><Button title="Tạo ghi chú đầu tiên" onPress={() => router.push("/notes/new")} icon={<Plus color={colors.paper} size={18} />} /></View> : null}
    </Surface>
  </Animated.View>;

  return <Page>
    <FlatList data={visible} keyExtractor={(item) => item.id} ListHeaderComponent={listHeader} ListEmptyComponent={emptyState} renderItem={({ item, index }) => <NoteCard note={item} index={index} onPress={() => router.push({ pathname: "/notes/[id]", params: { id: item.id } })} />} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} refreshControl={<RefreshControl refreshing={localQuery.isRefetching} onRefresh={() => void localQuery.refetch()} tintColor={colors.brand} />} contentContainerStyle={{ flexGrow: 1, paddingHorizontal: 20, paddingTop: 18, paddingBottom: 116 }} />
    <Animated.View entering={reduceMotion ? undefined : FadeInUp.duration(350)} className="absolute bottom-5 right-5">
      <Pressable accessibilityRole="button" accessibilityLabel="Tạo ghi chú mới" onPress={() => router.push("/notes/new")} className="h-[62px] w-[62px] items-center justify-center rounded-[22px]" style={{ backgroundColor: colors.accent, shadowColor: colors.shadow, shadowOpacity: 0.23, shadowRadius: 14, shadowOffset: { width: 0, height: 7 }, elevation: 7 }}><Plus size={28} color={colors.paper} strokeWidth={2.6} /></Pressable>
    </Animated.View>
  </Page>;
}
