import * as SecureStore from "expo-secure-store";

export const getSessionItem = (key: string) => SecureStore.getItemAsync(key);
export const setSessionItem = (key: string, value: string) => SecureStore.setItemAsync(key, value);
export const deleteSessionItem = (key: string) => SecureStore.deleteItemAsync(key);
