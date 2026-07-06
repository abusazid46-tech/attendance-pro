import { Ionicons } from "@expo/vector-icons";
import { zodResolver } from "@hookform/resolvers/zod";
import { Link, router } from "expo-router";
import { Controller, useForm } from "react-hook-form";
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { z } from "zod";
import { apiBackend } from "@/services/api-backend";
import { tokenStorage } from "@/services/token-storage";
import { useAuthStore } from "@/store/auth";
import { colors, spacing } from "@/theme";

const schema = z.object({
  email: z.string().email().optional(),
  mobileNumber: z.string().min(7).optional(),
  password: z.string().min(8)
});

export default function LoginScreen() {
  const setSession = useAuthStore((state) => state.setSession);
  const { control, handleSubmit, formState } = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: { email: "", mobileNumber: "", password: "" }
  });

  const submit = handleSubmit(async (values) => {
    try {
      const data = await apiBackend.login(values);
      await tokenStorage.save(data.accessToken, data.refreshToken);
      setSession(data.user, data.accessToken);
      router.replace("/dashboard");
    } catch {
      Alert.alert("Login failed", "Check your email/mobile and password, or create a new faculty account.");
    }
  });

  return (
    <View style={styles.container}>
      <View style={styles.hero}>
        <View style={styles.logo}>
          <Ionicons name="shield-checkmark" size={28} color="#fff" />
        </View>
        <Text style={styles.eyebrow}>Attendance Pro</Text>
        <Text style={styles.title}>Secure faculty login</Text>
        <Text style={styles.subtitle}>Connect to your live institution workspace.</Text>
      </View>

      <View style={styles.card}>
        <Controller control={control} name="email" render={({ field }) => <TextInput style={styles.input} placeholder="Email" placeholderTextColor={colors.muted} autoCapitalize="none" keyboardType="email-address" value={field.value} onChangeText={field.onChange} />} />
        <Controller control={control} name="mobileNumber" render={({ field }) => <TextInput style={styles.input} placeholder="Mobile number" placeholderTextColor={colors.muted} keyboardType="phone-pad" value={field.value} onChangeText={field.onChange} />} />
        <Controller control={control} name="password" render={({ field }) => <TextInput style={styles.input} placeholder="Password" placeholderTextColor={colors.muted} secureTextEntry value={field.value} onChangeText={field.onChange} />} />
        <Pressable style={[styles.button, formState.isSubmitting && styles.disabled]} onPress={submit} disabled={formState.isSubmitting}>
          <Ionicons name="lock-closed" size={18} color="#fff" />
          <Text style={styles.buttonText}>{formState.isSubmitting ? "Signing in..." : "Login Securely"}</Text>
        </Pressable>
        <Link href="/setup-wizard" style={styles.link}>Create new faculty account</Link>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: "center", padding: spacing.lg, backgroundColor: colors.surface, gap: 16 },
  hero: { backgroundColor: colors.text, borderRadius: 18, padding: spacing.xl, borderWidth: 1, borderColor: "#1e293b" },
  logo: { width: 58, height: 58, borderRadius: 18, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center", marginBottom: spacing.lg },
  eyebrow: { color: "#bbf7d0", fontWeight: "900", letterSpacing: 0, marginBottom: 8 },
  title: { fontSize: 30, fontWeight: "900", color: "#fff", marginBottom: 8 },
  subtitle: { color: "#cbd5e1", fontWeight: "700", lineHeight: 22 },
  card: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: 18, padding: spacing.lg },
  input: { backgroundColor: "#f8fafc", borderWidth: 1, borderColor: colors.border, padding: 16, borderRadius: 12, marginBottom: 14, color: colors.text, fontWeight: "700" },
  button: { backgroundColor: colors.primary, padding: 16, borderRadius: 12, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 8, marginTop: 8 },
  disabled: { opacity: 0.65 },
  buttonText: { color: "#fff", fontWeight: "900" },
  link: { marginTop: 18, color: colors.primary, fontWeight: "800", textAlign: "center" }
});
