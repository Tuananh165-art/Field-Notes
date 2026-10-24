import * as FileSystem from "expo-file-system/legacy";
import * as ImageManipulator from "expo-image-manipulator";
import * as ImagePicker from "expo-image-picker";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

const avatarFilePattern = /^avatar-[a-z0-9-]+\.jpg$/;

function avatarKey(ownerId: string) {
  if (!/^[A-Za-z0-9._-]{1,128}$/.test(ownerId)) throw new Error("Không thể xác định tài khoản để lưu ảnh đại diện.");
  return `field-notes.avatar.${ownerId}`;
}

function avatarDirectory() {
  if (!FileSystem.documentDirectory) throw new Error("Thiết bị không có thư mục lưu ảnh đại diện.");
  return `${FileSystem.documentDirectory}profile-avatars/`;
}

export async function loadAvatar(ownerId: string): Promise<string | null> {
  if (Platform.OS === "web") return null;
  const filename = await SecureStore.getItemAsync(avatarKey(ownerId));
  if (!filename || !avatarFilePattern.test(filename)) return null;
  const uri = `${avatarDirectory()}${filename}`;
  return (await FileSystem.getInfoAsync(uri)).exists ? uri : null;
}

export async function chooseAvatar(ownerId: string): Promise<string | null> {
  if (Platform.OS === "web") throw new Error("Chọn ảnh đại diện hiện hỗ trợ trên ứng dụng điện thoại.");
  const key = avatarKey(ownerId);
  const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], allowsEditing: true, aspect: [1, 1], quality: 0.85 });
  if (result.canceled || !result.assets[0]) return null;

  const image = await ImageManipulator.manipulateAsync(result.assets[0].uri, [{ resize: { width: 512 } }], { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG });
  const directory = avatarDirectory();
  await FileSystem.makeDirectoryAsync(directory, { intermediates: true });
  const filename = `avatar-${Date.now()}-${Math.random().toString(36).slice(2)}.jpg`;
  const uri = `${directory}${filename}`;
  const previous = await SecureStore.getItemAsync(key);
  await FileSystem.copyAsync({ from: image.uri, to: uri });
  try {
    await SecureStore.setItemAsync(key, filename);
  } catch (error) {
    await FileSystem.deleteAsync(uri, { idempotent: true }).catch(() => undefined);
    throw error;
  }
  if (previous && previous !== filename && avatarFilePattern.test(previous)) {
    await FileSystem.deleteAsync(`${directory}${previous}`, { idempotent: true }).catch(() => undefined);
  }
  return uri;
}
