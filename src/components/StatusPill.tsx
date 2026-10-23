import { Text, View } from "react-native";
import type { NoteStatus } from "@/types/note";
import { useTheme } from "@/theme/useTheme";

const labels: Record<NoteStatus, string> = { draft: "Bản nháp", queued: "Đang chờ", synced: "Đã đồng bộ", failed: "Cần thử lại", conflict: "Có xung đột" };
export function StatusPill({ status }: { status: NoteStatus }) {
  const { colors } = useTheme();
  const tint = status === "synced" ? colors.positive : status === "failed" || status === "conflict" ? colors.danger : status === "queued" ? colors.warning : colors.muted;
  return <View accessibilityRole="text" accessibilityLabel={`Trạng thái: ${labels[status]}`} className="flex-row items-center gap-1.5 rounded-full border px-3 py-1.5" style={{ backgroundColor: status === "synced" ? colors.brandSoft : colors.soft, borderColor: colors.line }}><View className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: tint }} /><Text style={{ color: tint, fontSize: 11, fontWeight: "800" }}>{labels[status]}</Text></View>;
}
