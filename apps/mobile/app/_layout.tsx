import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useState } from "react";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AnimatedSplash } from "@/components/animated-splash";
import { colors } from "@/theme";

export default function RootLayout() {
  const [client] = useState(() => new QueryClient());
  const [showSplash, setShowSplash] = useState(true);

  return (
    <QueryClientProvider client={client}>
      <SafeAreaProvider>
        <StatusBar style="dark" />
        <Stack screenOptions={{ headerStyle: { backgroundColor: "#edf4f1" }, headerTintColor: colors.text, headerTitleStyle: { fontSize: 22, fontWeight: "900" } }}>
          <Stack.Screen name="index" options={{ headerShown: false }} />
          <Stack.Screen name="login" options={{ title: "Smart Attendance App" }} />
          <Stack.Screen name="dashboard" options={{ title: "My Dashboard" }} />
          <Stack.Screen name="setup-wizard" options={{ title: "Create Your Account" }} />
          <Stack.Screen name="academics-setup" options={{ title: "Academic Setup" }} />
          <Stack.Screen name="take-attendance" options={{ title: "Take Attendance" }} />
          <Stack.Screen name="student-analytics" options={{ title: "Student Analytics" }} />
          <Stack.Screen name="reports" options={{ title: "Reports" }} />
          <Stack.Screen name="class-diary" options={{ title: "Class Diary" }} />
          <Stack.Screen name="backup-restore" options={{ title: "Settings" }} />
          <Stack.Screen name="qr-attendance" options={{ title: "" }} />
        </Stack>
        {showSplash ? <AnimatedSplash onDone={() => setShowSplash(false)} /> : null}
      </SafeAreaProvider>
    </QueryClientProvider>
  );
}
