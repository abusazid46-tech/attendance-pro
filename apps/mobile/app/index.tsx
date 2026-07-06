import { Redirect } from "expo-router";
import { useAuthStore } from "@/store/auth";

export default function Index() {
  const token = useAuthStore((state) => state.accessToken);
  return <Redirect href={token ? "/dashboard" : "/login"} />;
}
