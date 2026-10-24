import * as ImageManipulator from "expo-image-manipulator";
import * as ImagePicker from "expo-image-picker";

function avatarKey(ownerId: string) {
  if (!/^[A-Za-z0-9._-]{1,128}$/.test(ownerId)) throw new Error("Không thể xác định tài khoản để lưu ảnh đại diện.");
  return `field-notes.avatar.${ownerId}`;
}

export async function loadAvatar(ownerId: string): Promise<string | null> {
  try {
    const value = globalThis.localStorage?.getItem(avatarKey(ownerId));
    return value?.startsWith("data:image/jpeg;base64,") ? value : null;
  } catch { return null; }
}

export async function chooseAvatar(ownerId: string): Promise<string | null> {
  const key = avatarKey(ownerId);
  const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], allowsEditing: true, aspect: [1, 1], quality: 0.85 });
  if (result.canceled || !result.assets[0]) return null;
  const image = await ImageManipulator.manipulateAsync(result.assets[0].uri, [{ resize: { width: 512 } }], { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG, base64: true });
  if (!image.base64) throw new Error("Không thể đọc ảnh đã chọn trong trình duyệt.");
  const uri = `data:image/jpeg;base64,${image.base64}`;
  try { globalThis.localStorage.setItem(key, uri); }
  catch { throw new Error("Không thể lưu ảnh trong trình duyệt. Hãy kiểm tra dung lượng và quyền lưu trữ."); }
  return uri;
}
