import { Ionicons } from "@expo/vector-icons";
import { zodResolver } from "@hookform/resolvers/zod";
import * as LocalAuthentication from "expo-local-authentication";
import { Link, router } from "expo-router";
import { useEffect, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { Alert, Modal, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { z } from "zod";
import { apiBackend } from "@/services/api-backend";
import { refreshAccessToken } from "@/services/api";
import { tokenStorage, type SavedUserProfile } from "@/services/token-storage";
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
  const [hasSavedLogin, setHasSavedLogin] = useState(false);
  const [savedUser, setSavedUser] = useState<SavedUserProfile | null>(null);
  const [biometricReady, setBiometricReady] = useState(false);
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

  const checkBiometrics = async () => {
    try {
      const [accessToken, refreshToken, savedUserProfile, savedCreds, hasHardware, enrolled] = await Promise.all([
        tokenStorage.getAccessToken(),
        tokenStorage.getRefreshToken(),
        tokenStorage.getSavedUser(),
        tokenStorage.getSavedCredentials(),
        LocalAuthentication.hasHardwareAsync(),
        LocalAuthentication.isEnrolledAsync()
      ]);

      const hasAccount = Boolean(accessToken || refreshToken || savedUserProfile || savedCreds);
      setHasSavedLogin(hasAccount);
      setSavedUser(savedUserProfile);
      setBiometricReady(Boolean(hasHardware && enrolled));
    } catch {
      setHasSavedLogin(false);
      setBiometricReady(false);
    }
  };

  useEffect(() => {
    checkBiometrics();
  }, []);

  const submit = handleSubmit(async (values) => {
    try {
      const data = await apiBackend.login(values);
      await tokenStorage.save(data.accessToken, data.refreshToken);

      const userProfile: SavedUserProfile = {
        id: data.user?.id || "faculty",
        email: data.user?.email || values.email || "",
        fullName: data.user?.fullName || data.user?.name || "Faculty Teacher",
        role: data.user?.role || "FACULTY",
        mobileNumber: data.user?.mobileNumber || values.mobileNumber
      };
      await tokenStorage.saveUser(userProfile);
      await tokenStorage.saveCredentials({
        identifier: values.email?.trim() || values.mobileNumber?.trim() || "",
        password: values.password
      });

      setSession(userProfile, data.accessToken);
      setHasSavedLogin(true);
      setSavedUser(userProfile);

      router.replace("/dashboard");
    } catch {
      Alert.alert("Login failed", "Check your email/mobile and password, or create a new faculty account.");
    }
  });

  const quickUnlock = async () => {
    try {
      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      const enrolled = await LocalAuthentication.isEnrolledAsync();

      if (!hasHardware) {
        Alert.alert("Biometrics Unavailable", "This device hardware does not support biometric sensors.");
        return;
      }
      if (!enrolled) {
        Alert.alert(
          "Fingerprint Not Enrolled",
          "No fingerprint or face biometric is enrolled on this phone. Please register your fingerprint in your phone's Settings > Security > Fingerprint."
        );
        return;
      }

      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: "Unlock Smart Attendance",
        cancelLabel: "Cancel",
        disableDeviceFallback: false
      });

      if (!result.success) {
        if (result.error === "user_cancel" || result.error === "system_cancel" || result.error === "app_cancel") {
          return;
        }
        Alert.alert("Unlock Incomplete", "Biometric verification was not completed. You can also sign in with password.");
        return;
      }

      // Biometric authentication PASSED on device hardware!
      let token: string | null | undefined = await tokenStorage.getAccessToken();
      const userFromStorage = await tokenStorage.getSavedUser();
      const savedCreds = await tokenStorage.getSavedCredentials();

      // 1. If access token is missing or expired, attempt refresh
      if (!token) {
        token = await refreshAccessToken().catch(() => undefined);
      }

      // 2. If token is still missing/expired, attempt re-login using encrypted credentials
      if (!token && savedCreds) {
        try {
          const isEmail = savedCreds.identifier.includes("@");
          const loginData = await apiBackend.login({
            email: isEmail ? savedCreds.identifier : undefined,
            mobileNumber: !isEmail ? savedCreds.identifier : undefined,
            password: savedCreds.password
          });
          if (loginData?.accessToken) {
            token = loginData.accessToken;
            await tokenStorage.save(loginData.accessToken, loginData.refreshToken);
          }
        } catch {
          // Network offline; proceed with offline-capable session below
        }
      }

      // 3. Resolve user profile (cached or default)
      const activeUser: SavedUserProfile = userFromStorage ?? {
        id: "faculty",
        email: savedCreds?.identifier ?? "",
        fullName: "Faculty Teacher",
        role: "FACULTY"
      };

      // Set session into global store
      setSession(activeUser, token || "offline-biometric-token");

      // 4. Background refresh if token exists, NEVER wipe credentials on failure
      if (token && token !== "offline-biometric-token") {
        apiBackend.dashboard().then((dashboard) => {
          const profile = dashboard?.teacherProfile;
          if (profile) {
            const updatedUser: SavedUserProfile = {
              id: profile.userId ?? profile.id ?? profile.teacherId ?? activeUser.id,
              email: profile.email ?? activeUser.email,
              fullName: profile.name ?? profile.fullName ?? activeUser.fullName,
              role: "FACULTY",
              avatarUrl: profile.avatarUrl
            };
            setSession(updatedUser, token!);
            tokenStorage.saveUser(updatedUser);
          }
        }).catch(() => {
          // Harmless offline fallback: preserve session and local SQLite data
        });
      }

      router.replace("/dashboard");
    } catch (err) {
      Alert.alert("Biometric Error", err instanceof Error ? err.message : "Biometric unlock could not start.");
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
        {hasSavedLogin ? (
          <Pressable style={[styles.quickButton, !biometricReady && styles.quickButtonMuted]} onPress={quickUnlock}>
            <Ionicons name="finger-print" size={24} color={colors.primaryDark} />
            <View style={{ alignItems: "center" }}>
              <Text style={styles.quickButtonText}>
                {biometricReady
                  ? savedUser?.fullName
                    ? `Fingerprint Unlock (${savedUser.fullName})`
                    : "Fingerprint / Quick Unlock"
                  : "Enable Fingerprint in Phone Settings"}
              </Text>
              {biometricReady && savedUser?.email ? (
                <Text style={{ fontSize: 11, color: colors.primaryDark, opacity: 0.8, fontWeight: "700" }}>{savedUser.email}</Text>
              ) : null}
            </View>
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
        {!hasSavedLogin ? <Link href="/setup-wizard" style={styles.link}>Create Your Account</Link> : null}
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
  quickButtonMuted: { backgroundColor: "#f8fafc", borderColor: colors.border },
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
