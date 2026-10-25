import { useMemo } from "react";
import { Linking, Pressable, ScrollView, Text, View } from "react-native";
import { router } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowUpRight, MapPin } from "lucide-react-native";
import { Page, ScreenIntro, StatePanel, Surface } from "@/components/ui";
import { refreshNotes } from "@/services/noteService";
import { useAppStore } from "@/store/appStore";
import { useTheme } from "@/theme/useTheme";

export default function WebMapScreen() {
  const { colors } = useTheme();
  const notes = useAppStore((state) => state.notes);
  const accountId = useAppStore((state) => state.accountId);
  const query = useQuery({ queryKey: ["local-notes", accountId], queryFn: refreshNotes });
  const located = useMemo(() => notes.filter((note) => note.lat != null && note.lng != null), [notes]);

  if (query.isLoading && notes.length === 0) return <Page><StatePanel kind="loading" title="Đang tải vị trí" message="Tìm ghi chú đã gắn tọa độ…" /></Page>;
  if (query.isError && notes.length === 0) return <Page><StatePanel kind="error" title="Không đọc được vị trí" message="Thử tải lại dữ liệu vị trí." retry={() => void query.refetch()} /></Page>;

  return <Page><ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>
    <ScreenIntro kicker="ATLAS · FIELD JOURNAL" title="Địa điểm đã ghé" subtitle="Trên web, chọn một vị trí để mở ghi chú hoặc xem trên Google Maps." />
    {located.length === 0 ? <Surface className="items-center px-6 py-8">
      <MapPin size={38} color={colors.brand} />
      <Text className="mt-4 text-center text-xl font-extrabold" style={{ color: colors.ink }}>Chưa có điểm ghé thăm</Text>
      <Text className="mt-2 text-center leading-6" style={{ color: colors.muted }}>Gắn vị trí khi tạo ghi chú để xem tại đây.</Text>
    </Surface> : located.map((note) => <Surface key={note.id} className="mb-3">
      <View className="flex-row items-center gap-3">
        <View className="h-11 w-11 items-center justify-center rounded-2xl" style={{ backgroundColor: colors.brandSoft }}><MapPin color={colors.brand} size={20} /></View>
        <View className="flex-1"><Text style={{ color: colors.ink, fontWeight: "800", fontSize: 16 }}>{note.title}</Text><Text className="mt-1" style={{ color: colors.muted, fontSize: 12 }}>{note.lat!.toFixed(5)}, {note.lng!.toFixed(5)}</Text></View>
      </View>
      <View className="mt-4 flex-row flex-wrap gap-3">
        <Pressable accessibilityRole="button" onPress={() => router.push({ pathname: "/notes/[id]", params: { id: note.id } })} style={{ borderRadius: 14, paddingVertical: 12, paddingHorizontal: 15, backgroundColor: colors.brand }}><Text style={{ color: colors.paper, fontWeight: "800" }}>Mở ghi chú</Text></Pressable>
        <Pressable accessibilityRole="link" accessibilityLabel={`Xem vị trí ${note.title} trên Google Maps`} onPress={() => void Linking.openURL(`https://maps.google.com/?q=${note.lat},${note.lng}`)} style={{ borderRadius: 14, paddingVertical: 12, paddingHorizontal: 15, borderWidth: 1, borderColor: colors.line, flexDirection: "row", alignItems: "center", gap: 7 }}><Text style={{ color: colors.ink, fontWeight: "800" }}>Xem trên Google Maps</Text><ArrowUpRight color={colors.brand} size={16} /></Pressable>
      </View>
    </Surface>)}
  </ScrollView></Page>;
}
