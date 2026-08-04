import { Ionicons } from "@expo/vector-icons";
import { zodResolver } from "@hookform/resolvers/zod";
import * as LocalAuthentication from "expo-local-authentication";
import { Link, router } from "expo-router";
import { useEffect, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { Alert, Modal, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { z } from "zod";
import { apiBackend } from "@/services/api-backend";
import { tokenStorage } from "@/services/token-storage";
import { useAuthStore } from "@/store/auth";
import { colors, spacing } from "@/theme";

const emptyToUndefined = (value: unknown) => (typeof value === "string" && value.trim() === "" ? undefined : value);

const schema = z.object({
  email: z.preprocess(emptyToUndefined, z.string().email().optional()),
  mobileNumber: z.preprocess(emptyToUndefined, z.string().min(7).optional()),
  password: z.string().min(8)
}).refine((value) => Boolean(value.email || value.mobileNumber), {
  message: "Enter email or mobile number",
  path: ["email"]
});

export default function LoginScreen() {
  const setSession = useAuthStore((state) => state.setSession);
  const [storedToken, setStoredToken] = useState<string | null>(null);
  const [recoveryOpen, setRecoveryOpen] = useState(false);
  const [recoveryEmail, setRecoveryEmail] = useState("");
  const [recoveryMobile, setRecoveryMobile] = useState("");
  const [recoveryCode, setRecoveryCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newPasswordConfirmation, setNewPasswordConfirmation] = useState("");
  const [recoveryLoading, setRecoveryLoading] = useState(false);
  const { control, handleSubmit, formState } = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: { email: "", mobileNumber: "", password: "" }
  });

  useEffect(() => {
    tokenStorage.getAccessToken().then(setStoredToken).catch(() => setStoredToken(null));
  }, []);

  const submit = handleSubmit(async (values) => {
    try {
      const data = await apiBackend.login(values);
      await tokenStorage.save(data.accessToken, data.refreshToken);
      setSession(data.user, data.accessToken);
      setStoredToken(data.accessToken);
      router.replace("/dashboard");
    } catch {
      Alert.alert("Login failed", "Check your email/mobile and password, or create a new faculty account.");
    }
  });

  const quickUnlock = async () => {
    if (!storedToken) {
      Alert.alert("Login required", "Login once with password before using fingerprint quick unlock.");
      return;
    }

    try {
      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      const enrolled = await LocalAuthentication.isEnrolledAsync();
      if (!hasHardware || !enrolled) {
        Alert.alert("Fingerprint unavailable", "No fingerprint or device biometric is enrolled on this phone.");
        return;
      }

      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: "Unlock Smart Attendance",
        cancelLabel: "Cancel",
        fallbackLabel: "Use device passcode",
        disableDeviceFallback: false
      });

      if (result.success) {
        const accessToken = await tokenStorage.getAccessToken();
        if (!accessToken) {
          setStoredToken(null);
          Alert.alert("Login required", "Your saved login expired. Login once with password to enable fingerprint again.");
          return;
        }
        try {
          const dashboard = await apiBackend.dashboard();
          const profile = dashboard.teacherProfile ?? {};
          setSession({
            id: profile.userId ?? profile.id ?? profile.teacherId ?? "faculty",
            email: profile.email ?? "",
            fullName: profile.name ?? profile.fullName ?? "Faculty",
            role: "FACULTY",
            avatarUrl: profile.avatarUrl
          }, accessToken);
        } catch {
          await tokenStorage.clear();
          setStoredToken(null);
          Alert.alert("Login expired", "Please login with password once. Fingerprint will work again after that.");
          return;
        }
        router.replace("/dashboard");
      } else {
        Alert.alert("Unlock cancelled", "Fingerprint quick unlock was not completed.");
      }
    } catch {
      Alert.alert("Fingerprint unavailable", "Biometric unlock is not available on this device.");
    }
  };

  const requestRecoveryCode = async () => {
    if (!recoveryEmail && !recoveryMobile) {
      Alert.alert("Recovery details required", "Enter the registered email or mobile number.");
      return;
    }
    setRecoveryLoading(true);
    try {
      const response = await apiBackend.forgotPassword({
        email: recoveryEmail.trim() || undefined,
        mobileNumber: recoveryMobile.trim() || undefined
      });
      if (response.recoveryCode) setRecoveryCode(response.recoveryCode);
      Alert.alert("Recovery code generated", response.recoveryCode ? `Your recovery code is ${response.recoveryCode}` : response.message);
    } catch {
      Alert.alert("Recovery failed", "No matching account was found, or the backend is unavailable.");
    } finally {
      setRecoveryLoading(false);
    }
  };

  const resetPassword = async () => {
    if (!recoveryCode || newPassword.length < 8 || newPassword !== newPasswordConfirmation) {
      Alert.alert("Check reset details", "Enter the recovery code and matching password of at least 8 characters.");
      return;
    }
    setRecoveryLoading(true);
    try {
      await apiBackend.resetPassword({
        token: recoveryCode.trim(),
        password: newPassword,
        passwordConfirmation: newPasswordConfirmation
      });
      setRecoveryOpen(false);
      setRecoveryCode("");
      setNewPassword("");
      setNewPasswordConfirmation("");
      Alert.alert("Password changed", "Login with the new password now.");
    } catch {
      Alert.alert("Reset failed", "The recovery code is invalid, expired, or the backend is unavailable.");
    } finally {
      setRecoveryLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.hero}>
        <View style={styles.logo}>
          <Ionicons name="shield-checkmark" size={28} color="#fff" />
        </View>
        <Text style={styles.eyebrow}>Smart Attendance App</Text>
        <Text style={styles.title}>Teacher Login</Text>
        <Text style={styles.subtitle}>Use fingerprint quick unlock after the first successful login.</Text>
      </View>

      <View style={styles.card}>
        {storedToken ? (
          <Pressable style={styles.quickButton} onPress={quickUnlock}>
            <Ionicons name="finger-print" size={22} color={colors.primaryDark} />
            <Text style={styles.quickButtonText}>Fingerprint / Quick Unlock</Text>
          </Pressable>
        ) : null}
        <Controller control={control} name="email" render={({ field }) => <TextInput style={styles.input} placeholder="Email" placeholderTextColor={colors.muted} autoCapitalize="none" keyboardType="email-address" value={field.value} onChangeText={field.onChange} />} />
        <Controller control={control} name="mobileNumber" render={({ field }) => <TextInput style={styles.input} placeholder="Mobile number" placeholderTextColor={colors.muted} keyboardType="phone-pad" value={field.value} onChangeText={field.onChange} />} />
        <Controller control={control} name="password" render={({ field }) => <TextInput style={styles.input} placeholder="Password" placeholderTextColor={colors.muted} secureTextEntry value={field.value} onChangeText={field.onChange} />} />
        <Pressable style={[styles.button, formState.isSubmitting && styles.disabled]} onPress={submit} disabled={formState.isSubmitting}>
          <Ionicons name="lock-closed" size={18} color="#fff" />
          <Text style={styles.buttonText}>{formState.isSubmitting ? "Signing in..." : "Login Securely"}</Text>
        </Pressable>
        <Pressable style={styles.recoveryLink} onPress={() => setRecoveryOpen(true)}>
          <Text style={styles.recoveryLinkText}>Forgot password?</Text>
        </Pressable>
        {!storedToken ? <Link href="/setup-wizard" style={styles.link}>Create Your Account</Link> : null}
      </View>
      <Modal visible={recoveryOpen} animationType="slide" transparent onRequestClose={() => setRecoveryOpen(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Password Recovery</Text>
              <Pressable onPress={() => setRecoveryOpen(false)}>
                <Ionicons name="close" size={22} color={colors.text} />
              </Pressable>
            </View>
            <TextInput style={styles.input} placeholder="Registered email" placeholderTextColor={colors.muted} autoCapitalize="none" keyboardType="email-address" value={recoveryEmail} onChangeText={setRecoveryEmail} />
            <TextInput style={styles.input} placeholder="Registered mobile number" placeholderTextColor={colors.muted} keyboardType="phone-pad" value={recoveryMobile} onChangeText={setRecoveryMobile} />
            <Pressable style={[styles.secondaryButton, recoveryLoading && styles.disabled]} onPress={requestRecoveryCode} disabled={recoveryLoading}>
              <Ionicons name="key-outline" size={18} color={colors.primaryDark} />
              <Text style={styles.secondaryButtonText}>{recoveryLoading ? "Please wait..." : "Get Recovery Code"}</Text>
            </Pressable>
            <TextInput style={styles.input} placeholder="Recovery code" placeholderTextColor={colors.muted} keyboardType="number-pad" value={recoveryCode} onChangeText={setRecoveryCode} />
            <TextInput style={styles.input} placeholder="New password" placeholderTextColor={colors.muted} secureTextEntry value={newPassword} onChangeText={setNewPassword} />
            <TextInput style={styles.input} placeholder="Confirm new password" placeholderTextColor={colors.muted} secureTextEntry value={newPasswordConfirmation} onChangeText={setNewPasswordConfirmation} />
            <Pressable style={[styles.button, recoveryLoading && styles.disabled]} onPress={resetPassword} disabled={recoveryLoading}>
              <Ionicons name="shield-checkmark" size={18} color="#fff" />
              <Text style={styles.buttonText}>Reset Password</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
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
  quickButton: { minHeight: 52, borderRadius: 14, borderWidth: 1, borderColor: "#b7e4c7", backgroundColor: "#f0fdf4", flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, marginBottom: 14 },
  quickButtonText: { color: colors.primaryDark, fontWeight: "900" },
  input: { backgroundColor: "#f8fafc", borderWidth: 1, borderColor: colors.border, padding: 16, borderRadius: 12, marginBottom: 14, color: colors.text, fontWeight: "700" },
  button: { backgroundColor: colors.primary, padding: 16, borderRadius: 12, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 8, marginTop: 8 },
  disabled: { opacity: 0.65 },
  buttonText: { color: "#fff", fontWeight: "900" },
  recoveryLink: { alignItems: "center", marginTop: 14 },
  recoveryLinkText: { color: colors.primaryDark, fontWeight: "900" },
  link: { marginTop: 18, color: colors.primary, fontWeight: "800", textAlign: "center" },
  modalBackdrop: { flex: 1, backgroundColor: "rgba(15, 23, 42, 0.45)", justifyContent: "flex-end" },
  modalCard: { backgroundColor: colors.card, borderTopLeftRadius: 22, borderTopRightRadius: 22, padding: spacing.lg, borderColor: colors.border, borderWidth: 1 },
  modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 14 },
  modalTitle: { color: colors.text, fontSize: 20, fontWeight: "900" },
  secondaryButton: { minHeight: 52, borderRadius: 12, borderWidth: 1, borderColor: "#b7e4c7", backgroundColor: "#f0fdf4", flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, marginBottom: 14 },
  secondaryButtonText: { color: colors.primaryDark, fontWeight: "900" }
});
