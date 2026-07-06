import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useState } from "react";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { colors } from "@/theme";

export default function RootLayout() {
  const [client] = useState(() => new QueryClient());

  return (
    <QueryClientProvider client={client}>
      <SafeAreaProvider>
        <StatusBar style="dark" />
        <Stack screenOptions={{ headerStyle: { backgroundColor: colors.surface }, headerTintColor: colors.text }}>
          <Stack.Screen name="index" options={{ headerShown: false }} />
          <Stack.Screen name="login" options={{ title: "Faculty Login" }} />
          <Stack.Screen name="dashboard" options={{ title: "SAA Dashboard" }} />
          <Stack.Screen name="setup-wizard" options={{ title: "Setup Wizard" }} />
          <Stack.Screen name="academics-setup" options={{ title: "Academic Setup" }} />
          <Stack.Screen name="take-attendance" options={{ title: "Take Attendance" }} />
          <Stack.Screen name="student-analytics" options={{ title: "Student Analytics" }} />
          <Stack.Screen name="reports" options={{ title: "Reports" }} />
          <Stack.Screen name="class-diary" options={{ title: "Class Diary" }} />
          <Stack.Screen name="backup-restore" options={{ title: "Backup & Restore" }} />
          <Stack.Screen name="qr-attendance" options={{ title: "QR Attendance" }} />
        </Stack>
      </SafeAreaProvider>
    </QueryClientProvider>
  );
}
