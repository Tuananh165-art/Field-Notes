import { useState } from "react";
import { Image, KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, View } from "react-native";
import { Alert } from "@/utils/appAlert";
import { router, useLocalSearchParams } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import Animated, { FadeInDown, useReducedMotion } from "react-native-reanimated";
import { Camera, Check, CloudOff, ImagePlus, Images, MapPin, Save, X } from "lucide-react-native";
import { Button, Field, IconButton, Page, ScreenIntro, StatePanel, Surface } from "@/components/ui";
import { captureLocation, createNote, updateExistingNote, pickFromLibrary, pickPhoto } from "@/services/noteService";
import { getNote } from "@/data/database";
import { useAppStore } from "@/store/appStore";
import { useTheme } from "@/theme/useTheme";
import type { Note } from "@/types/note";

export default function NewNoteModal() {
  const { editId } = useLocalSearchParams<{ editId?: string }>();
  const accountId = useAppStore((state) => state.accountId);
  const editing = useQuery({ queryKey: ["note", accountId, editId], queryFn: () => getNote(editId!, accountId!), enabled: Boolean(editId && accountId) });
  if (editId && editing.isLoading) return <Page><StatePanel kind="loading" title="Đang mở ghi chú" message="Đọc dữ liệu để chỉnh sửa…" /></Page>;
  if (editId && editing.isError) return <Page><StatePanel kind="error" title="Không mở được ghi chú" message="Hãy thử tải lại trước khi chỉnh sửa." retry={() => void editing.refetch()} /></Page>;
  if (editId && !editing.data) return <Page><StatePanel kind="empty" title="Không tìm thấy ghi chú" message="Ghi chú có thể đã bị xóa khỏi thiết bị." retry={() => router.back()} /></Page>;
  return <NoteEditor key={editId ?? "new"} editId={editId} initial={editing.data ?? null} />;
}

function NoteEditor({ editId, initial }: { editId?: string; initial: Note | null }) {
  const { colors } = useTheme();
  const [title, setTitle] = useState(initial?.title ?? "");
  const [body, setBody] = useState(initial?.body ?? "");
  const [photo, setPhoto] = useState<string | null>(initial?.photoUri ?? null);
  const [point, setPoint] = useState<{ lat: number; lng: number } | null>(initial?.lat != null && initial.lng != null ? { lat: initial.lat, lng: initial.lng } : null);
  const [busy, setBusy] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const save = async () => {
    if (!title.trim() || !body.trim()) { Alert.alert("Ghi chú chưa đầy đủ", "Hãy nhập tiêu đề và nội dung quan sát."); return; }
    setBusy(true); setSaveError(null);
    try {
      const input = { title, body, photoUri: photo, lat: point?.lat, lng: point?.lng };
      const note = editId ? await updateExistingNote(editId, input) : await createNote(input);
      router.replace({ pathname: "/notes/[id]", params: { id: note.id } });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Hãy thử lại. Chưa xác nhận nội dung đã được lưu.";
      setSaveError(message); Alert.alert("Chưa lưu được ghi chú", message);
    } finally { setBusy(false); }
  };
  const addPhoto = async (source: "camera" | "library") => {
    try {
      const uri = source === "camera" ? await pickPhoto() : await pickFromLibrary();
      if (uri) setPhoto(uri);
      else Alert.alert("Chưa có ảnh", "Bạn đã hủy hoặc quyền truy cập chưa được cấp. Ghi chú vẫn có thể lưu mà không cần ảnh.");
    } catch { Alert.alert(source === "camera" ? "Camera chưa sẵn sàng" : "Thư viện chưa sẵn sàng", "Bạn vẫn có thể tiếp tục ghi chú và thêm ảnh sau."); }
  };
  const addLocation = async () => {
    try { const value = await captureLocation(); if (value) setPoint(value); else Alert.alert("Không có vị trí", "Quyền vị trí bị từ chối hoặc bạn đã hủy. Bạn vẫn có thể lưu ghi chú không vị trí."); }
    catch { Alert.alert("Không lấy được vị trí", "Bạn vẫn có thể lưu ghi chú và thêm vị trí lần sau."); }
  };

  const reduceMotion = useReducedMotion();
  return <Page><KeyboardAvoidingView className="flex-1" behavior={Platform.OS === "ios" ? "padding" : undefined}>
    <View className="flex-row items-center justify-between px-5 pb-2 pt-3">
      <IconButton label="Đóng tạo ghi chú" onPress={() => router.back()}><X color={colors.ink} size={19} /></IconButton>
      <View className="items-center"><Text className="text-[15px] font-extrabold" style={{ color: colors.ink }}>{editId ? "Chỉnh sửa" : "Ghi chú mới"}</Text><Text className="mt-0.5 text-[10px] font-extrabold uppercase tracking-[1.4px]" style={{ color: colors.brand }}>Field entry</Text></View>
      <Pressable accessibilityRole="button" accessibilityLabel="Lưu ghi chú" onPress={() => void save()} disabled={busy} className="min-h-11 flex-row items-center gap-1.5 rounded-2xl px-3" style={{ backgroundColor: colors.brandSoft, opacity: busy ? 0.55 : 1 }}><Save color={colors.brand} size={16} /><Text style={{ color: colors.brand, fontWeight: "800" }}>{busy ? "Đang lưu" : "Lưu"}</Text></Pressable>
    </View>
    <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} className="flex-1 px-5 pt-3" contentContainerStyle={{ paddingBottom: 32 }}>
      <ScreenIntro kicker="FIELD NOTE · OFFLINE FIRST" title={editId ? "Hoàn thiện quan sát" : "Bạn vừa thấy gì?"} subtitle="Ghi lại chi tiết khi nó còn mới. Thông tin được lưu trên máy trước khi đồng bộ." />
      <Animated.View entering={reduceMotion ? undefined : FadeInDown.delay(80).duration(420)}>
        <Field label="Tiêu đề" placeholder="Ví dụ: Lớp đất ven suối" value={title} onChangeText={setTitle} maxLength={100} returnKeyType="next" />
        <Field label="Quan sát chi tiết" placeholder="Mô tả màu sắc, hình dạng, âm thanh hoặc điều khiến bạn chú ý…" multiline value={body} onChangeText={setBody} maxLength={5000} />
        <Text className="mb-5 -mt-3 text-right text-[11px] font-semibold" style={{ color: colors.muted }}>{body.length.toLocaleString()} / 5.000 ký tự</Text>

        <Surface className="mb-4">
          <View className="mb-4 flex-row items-center justify-between"><View><Text className="text-[17px] font-extrabold" style={{ color: colors.ink }}>Tư liệu hiện trường</Text><Text className="mt-1 text-[12px]" style={{ color: colors.muted }}>Ảnh và vị trí giúp quan sát đầy đủ hơn</Text></View><ImagePlus color={colors.brand} size={21} /></View>
          <View className="flex-row gap-3">
            <Pressable accessibilityRole="button" accessibilityLabel={photo ? "Chụp lại ảnh" : "Chụp ảnh"} onPress={() => void addPhoto("camera")} className="min-h-[76px] flex-1 items-center justify-center rounded-2xl border px-2" style={{ backgroundColor: colors.raised, borderColor: colors.line, gap: 6 }}><Camera color={colors.brand} size={20} /><Text className="text-center text-[12px] font-extrabold" style={{ color: colors.ink }}>{photo ? "Chụp lại" : "Chụp ảnh"}</Text></Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel={photo ? "Đổi ảnh từ thư viện" : "Chọn ảnh từ thư viện"} onPress={() => void addPhoto("library")} className="min-h-[76px] flex-1 items-center justify-center rounded-2xl border px-2" style={{ backgroundColor: colors.raised, borderColor: colors.line, gap: 6 }}><Images color={colors.brand} size={20} /><Text className="text-center text-[12px] font-extrabold" style={{ color: colors.ink }}>{photo ? "Đổi ảnh" : "Thư viện"}</Text></Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel={point ? "Cập nhật vị trí" : "Gắn vị trí hiện tại"} onPress={() => void addLocation()} className="min-h-[76px] flex-1 items-center justify-center rounded-2xl border px-2" style={{ backgroundColor: point ? colors.brandSoft : colors.raised, borderColor: point ? colors.brand : colors.line, gap: 6 }}><MapPin color={colors.brand} size={20} /><Text className="text-center text-[12px] font-extrabold" style={{ color: colors.ink }}>{point ? "Đã định vị" : "Vị trí"}</Text></Pressable>
          </View>
          {photo ? <View className="mt-4 overflow-hidden rounded-[20px] border" style={{ borderColor: colors.line }}><Image accessibilityLabel="Ảnh đính kèm ghi chú" source={{ uri: photo }} resizeMode="cover" style={{ width: "100%", height: 190, backgroundColor: colors.soft }} /><View className="flex-row items-center justify-between px-3 py-2.5" style={{ backgroundColor: colors.raised }}><View className="flex-row items-center gap-2"><Check size={15} color={colors.positive} /><Text className="text-[12px] font-bold" style={{ color: colors.ink }}>Ảnh đã được lưu vào thiết bị</Text></View><Pressable accessibilityRole="button" accessibilityLabel="Gỡ ảnh đính kèm" onPress={() => setPhoto(null)} className="h-9 w-9 items-center justify-center rounded-xl"><X color={colors.danger} size={18} /></Pressable></View></View> : null}
          {point ? <View className="mt-3 flex-row items-center gap-2 rounded-2xl px-3.5 py-3" style={{ backgroundColor: colors.brandSoft }}><MapPin size={17} color={colors.brand} /><Text className="flex-1 text-[13px] font-bold" style={{ color: colors.ink }}>{point.lat.toFixed(5)}, {point.lng.toFixed(5)}</Text><Check size={16} color={colors.brand} /></View> : null}
        </Surface>

        <View className="mb-5 flex-row items-start gap-3 rounded-2xl border px-4 py-3.5" style={{ backgroundColor: colors.raised, borderColor: colors.line }}><CloudOff size={18} color={colors.brand} /><Text className="flex-1 text-[13px] leading-5" style={{ color: colors.muted }}>Bạn có thể lưu ghi chú ngay cả khi không có mạng. Ảnh, vị trí và nội dung sẽ ở trên thiết bị cho đến khi đồng bộ.</Text></View>
        {saveError ? <Text accessibilityRole="alert" className="mb-4 rounded-2xl border p-4" style={{ backgroundColor: colors.soft, borderColor: colors.line, color: colors.danger }}>{saveError}</Text> : null}
        <Button title={editId ? "Lưu thay đổi" : "Lưu ghi chú"} onPress={() => void save()} disabled={busy} loading={busy} icon={<Save color={colors.paper} size={18} />} />
      </Animated.View>
    </ScrollView>
  </KeyboardAvoidingView></Page>;
}
