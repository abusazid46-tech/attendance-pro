import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { apiBackend } from "@/services/api-backend";
import { tokenStorage } from "@/services/token-storage";
import { useAuthStore } from "@/store/auth";
import { colors, spacing } from "@/theme";

export default function SetupWizardScreen() {
  const setAuthSession = useAuthStore((state) => state.setSession);
  const [name, setName] = useState("");
  const [designation, setDesignation] = useState("");
  const [department, setDepartment] = useState("");
  const [institution, setInstitution] = useState("");
  const [mobile, setMobile] = useState("");
  const [email, setEmail] = useState("");
  const [employeeCode, setEmployeeCode] = useState("");
  const [session, setAcademicSession] = useState("2026-2027");
  const [password, setPassword] = useState("");
  const [passwordConfirmation, setPasswordConfirmation] = useState("");
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!name || !department || !institution || !mobile || !email || !session) {
      Alert.alert("Details required", "Fill name, department, institution, mobile, email, and academic session.");
      return;
    }

    if (!password || password.length < 8) {
      Alert.alert("Password required", "Use at least 8 characters.");
      return;
    }

    if (password !== passwordConfirmation) {
      Alert.alert("Password mismatch", "Confirm password must match.");
      return;
    }

    setSaving(true);
    try {
      const data = await apiBackend.registerTeacher({
        name,
        designation,
        department,
        institutionName: institution,
        mobileNumber: mobile,
        email,
        employeeCode: employeeCode || undefined,
        academicSession: session,
        password,
        passwordConfirmation
      });
      await tokenStorage.save(data.accessToken, data.refreshToken);
      setAuthSession(data.user, data.accessToken);
      Alert.alert("Account created", "Your faculty workspace is ready.");
      router.replace("/dashboard");
    } catch {
      Alert.alert("Registration failed", "Check the details. Email, mobile, or employee code may already be registered.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.panel}>
        <View style={styles.iconWrap}>
          <Ionicons name="person-add" size={28} color="#fff" />
        </View>
        <Text style={styles.kicker}>Faculty onboarding</Text>
        <Text style={styles.title}>Create Teacher Account</Text>
        <Text style={styles.meta}>This creates a real login on the live institution backend.</Text>
      </View>

      <View style={styles.formCard}>
        <Field label="Name" value={name} onChangeText={setName} />
        <Field label="Designation" value={designation} onChangeText={setDesignation} />
        <Field label="Department" value={department} onChangeText={setDepartment} />
        <Field label="College or University" value={institution} onChangeText={setInstitution} />
        <Field label="Mobile Number" value={mobile} onChangeText={setMobile} keyboardType="phone-pad" />
        <Field label="Email" value={email} onChangeText={setEmail} keyboardType="email-address" />
        <Field label="Employee Code" value={employeeCode} onChangeText={setEmployeeCode} />
        <Field label="Academic Session" value={session} onChangeText={setAcademicSession} />
        <Field label="Password" value={password} onChangeText={setPassword} secureTextEntry />
        <Field label="Confirm Password" value={passwordConfirmation} onChangeText={setPasswordConfirmation} secureTextEntry />
      </View>

      <Pressable style={[styles.submit, saving && styles.disabled]} onPress={save} disabled={saving}>
        <Text style={styles.submitText}>{saving ? "Creating account..." : "Create Faculty Account"}</Text>
      </Pressable>
    </ScrollView>
  );
}

function Field({
  label,
  value,
  onChangeText,
  keyboardType,
  secureTextEntry
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  keyboardType?: "default" | "phone-pad" | "email-address";
  secureTextEntry?: boolean;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput value={value} onChangeText={onChangeText} keyboardType={keyboardType} secureTextEntry={secureTextEntry} style={styles.input} placeholderTextColor={colors.muted} autoCapitalize={keyboardType === "email-address" ? "none" : "sentences"} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.surface },
  content: { padding: spacing.lg, gap: 14, paddingBottom: 34 },
  panel: { backgroundColor: colors.text, borderColor: "#1e293b", borderWidth: 1, borderRadius: 18, padding: 18 },
  iconWrap: { width: 54, height: 54, borderRadius: 17, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center", marginBottom: 14 },
  kicker: { color: "#bbf7d0", fontWeight: "900", textTransform: "uppercase", fontSize: 12 },
  title: { color: "#fff", fontSize: 24, fontWeight: "900", marginTop: 8 },
  meta: { color: "#cbd5e1", marginTop: 6, fontWeight: "700", lineHeight: 21 },
  formCard: { backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1, borderRadius: 18, padding: 16, gap: 12 },
  field: { gap: 8 },
  label: { color: colors.text, fontWeight: "900" },
  input: { backgroundColor: "#f8fafc", borderColor: colors.border, borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 13, color: colors.text, fontWeight: "800" },
  submit: { backgroundColor: colors.primary, borderRadius: 12, padding: 16, alignItems: "center", marginTop: 8 },
  disabled: { opacity: 0.65 },
  submitText: { color: "#fff", fontWeight: "900", fontSize: 16 }
});
