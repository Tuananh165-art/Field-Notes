import { Redirect } from "expo-router";
import { useAppStore } from "@/store/appStore";

export default function IndexRoute() {
  const token = useAppStore((state) => state.token);
  return <Redirect href={token ? "/(tabs)" : "/(auth)/sign-in"} />;
}
