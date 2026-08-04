import { Redirect } from "expo-router";
import { useEffect, useState } from "react";
import { View } from "react-native";
import { tokenStorage } from "@/services/token-storage";
import { useAuthStore } from "@/store/auth";

export default function Index() {
  const token = useAuthStore((state) => state.accessToken);
  const [storedToken, setStoredToken] = useState<string | null>();

  useEffect(() => {
    tokenStorage.getAccessToken().then(setStoredToken).catch(() => setStoredToken(null));
  }, []);

  if (storedToken === undefined) return <View />;
  return <Redirect href={token || storedToken ? "/dashboard" : "/login"} />;
}
