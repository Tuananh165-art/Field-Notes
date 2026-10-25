import { useMemo } from "react";
import { Text, View } from "react-native";
import MapView, { Marker } from "react-native-maps";
import { router } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowUpRight, MapPin, Navigation2 } from "lucide-react-native";
import { Button, Page, ScreenIntro, StatePanel, Surface } from "@/components/ui";
import { useAppStore } from "@/store/appStore";
import { useTheme } from "@/theme/useTheme";
import { refreshNotes } from "@/services/noteService";

export default function MapScreen() {
  const { colors, mode } = useTheme();
  const notes = useAppStore((state) => state.notes);
  const accountId = useAppStore((state) => state.accountId);
  const query = useQuery({ queryKey: ["local-notes", accountId], queryFn: refreshNotes });
  const located = useMemo(() => notes.filter((note) => note.lat != null && note.lng != null), [notes]);
  if (query.isLoading && notes.length === 0) return <Page><StatePanel kind="loading" title="Đang tải bản đồ" message="Tìm ghi chú đã gắn tọa độ…" /></Page>;
  if (query.isError && notes.length === 0) return <Page><StatePanel kind="error" title="Không đọc được vị trí" message="Thử tải lại dữ liệu bản đồ." retry={() => void query.refetch()} /></Page>;
  if (located.length === 0) return <Page><View className="flex-1 px-5 pt-5">
    <ScreenIntro kicker="ATLAS · HÀNH TRÌNH CỦA BẠN" title="Bản đồ" subtitle="Mỗi ghim là một quan sát bạn muốn nhớ." />
    <Surface className="mt-1 flex-1 items-center justify-center px-6 py-8">
      <View className="mb-6 h-[96px] w-[96px] items-center justify-center rounded-[32px]" style={{ backgroundColor: colors.brandSoft, transform: [{ rotate: "-8deg" }] }}><MapPin size={42} color={colors.brand} strokeWidth={1.7} /></View>
      <Text className="text-center text-[21px] font-extrabold" style={{ color: colors.ink }}>Chưa có điểm ghé thăm</Text>
      <Text className="mt-2 max-w-[290px] text-center text-[14px] leading-6" style={{ color: colors.muted }}>Gắn vị trí khi tạo ghi chú. Những quan sát của bạn sẽ hiện lên bản đồ tại đây.</Text>
      <View className="mt-6 w-full"><Button title="Tạo ghi chú có vị trí" onPress={() => router.push("/notes/new")} icon={<Navigation2 size={18} color={colors.paper} />} /></View>
    </Surface>
  </View></Page>;

  const first = located[0];
  return <Page><View className="flex-1 px-4 pt-4 pb-3">
    <View className="mb-4 flex-row items-end justify-between px-1">
      <View><Text className="mb-1 text-[11px] font-extrabold uppercase tracking-[2px]" style={{ color: colors.brand }}>ATLAS · FIELD JOURNAL</Text><Text className="text-[25px] font-extrabold" style={{ color: colors.ink }}>Địa điểm đã ghé</Text></View>
      <View className="mb-0.5 flex-row items-center gap-2 rounded-full border px-3 py-2" style={{ backgroundColor: colors.surface, borderColor: colors.line }}><MapPin color={colors.brand} size={15} /><Text className="text-xs font-extrabold" style={{ color: colors.ink }}>{located.length} điểm</Text></View>
    </View>
    <View className="flex-1 overflow-hidden rounded-[28px] border" style={{ borderColor: colors.line, backgroundColor: colors.surface }}>
      <MapView accessibilityLabel="Bản đồ các ghi chú đã gắn vị trí" style={{ flex: 1 }} initialRegion={{ latitude: first.lat!, longitude: first.lng!, latitudeDelta: 0.2, longitudeDelta: 0.2 }} userInterfaceStyle={mode}>
        {located.map((note) => <Marker key={note.id} coordinate={{ latitude: note.lat!, longitude: note.lng! }} title={note.title} description={note.body.slice(0, 120)} pinColor={colors.brand} onCalloutPress={() => router.push({ pathname: "/notes/[id]", params: { id: note.id } })} />)}
      </MapView>
      <View pointerEvents="none" className="absolute bottom-4 left-4 right-4 flex-row items-center gap-3 rounded-[18px] border px-4 py-3" style={{ backgroundColor: colors.surface, borderColor: colors.line, shadowColor: colors.shadow, shadowOpacity: 0.14, shadowRadius: 12, elevation: 5 }}>
        <View className="h-9 w-9 items-center justify-center rounded-xl" style={{ backgroundColor: colors.brandSoft }}><MapPin color={colors.brand} size={17} /></View>
        <View className="flex-1"><Text className="text-[13px] font-extrabold" style={{ color: colors.ink }}>Bản đồ quan sát</Text><Text className="mt-0.5 text-[11px]" style={{ color: colors.muted }}>Chạm điểm ghim để mở ghi chú</Text></View>
        <ArrowUpRight size={18} color={colors.brand} />
      </View>
    </View>
  </View></Page>;
}
