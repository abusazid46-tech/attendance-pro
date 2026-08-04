import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import { Alert, Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { apiBackend } from "@/services/api-backend";
import { useBackendDashboard } from "@/services/app-data";
import { loadProfilePhoto, pickProfilePhoto, type PickedProfilePhoto, uploadAndStoreProfilePhoto } from "@/services/profile-photo";
import { tokenStorage } from "@/services/token-storage";
import { useAuthStore } from "@/store/auth";
import { colors, spacing } from "@/theme";

export default function SetupWizardScreen() {
  const setAuthSession = useAuthStore((state) => state.setSession);
  const authUser = useAuthStore((state) => state.user);
  const { data } = useBackendDashboard();
  const profile = data.teacherProfile;
  const [message, setMessage] = useState<{ tone: "error" | "success"; text: string }>();
  const [name, setName] = useState("");
  const [designation, setDesignation] = useState("");
  const [department, setDepartment] = useState("");
  const [institution, setInstitution] = useState("");
  const [mobile, setMobile] = useState("");
  const [email, setEmail] = useState("");
  const [session, setAcademicSession] = useState("2026-27");
  const [password, setPassword] = useState("");
  const [passwordConfirmation, setPasswordConfirmation] = useState("");
  const [selectedPhoto, setSelectedPhoto] = useState<PickedProfilePhoto>();
  const [photoChanged, setPhotoChanged] = useState(false);
  const [saving, setSaving] = useState(false);
  const [existingToken, setExistingToken] = useState<string | null>(null);
  const [profileLoaded, setProfileLoaded] = useState(false);

  useEffect(() => {
    tokenStorage.getAccessToken().then(setExistingToken).catch(() => setExistingToken(null));
  }, []);

  useEffect(() => {
    if (!existingToken || profileLoaded || !profile?.name || profile.name === "Faculty") return;
    setName(profile.name ?? "");
    setDesignation(profile.designation ?? "");
    setDepartment(profile.department ?? "");
    setInstitution(profile.institutionName ?? "");
    setMobile(profile.mobileNumber ?? "");
    setEmail(profile.email ?? authUser?.email ?? "");
    setAcademicSession(profile.academicSession ?? session);
    setProfileLoaded(true);

    const ownerKeys = [authUser?.id, authUser?.email, profile.email, profile.teacherId].filter(Boolean) as string[];
    if (profile.avatarUrl || authUser?.avatarUrl) {
      setSelectedPhoto({ uri: profile.avatarUrl ?? authUser?.avatarUrl ?? "" });
      return;
    }
    Promise.all(ownerKeys.map((key) => loadProfilePhoto(key))).then((values) => {
      const uri = values.find(Boolean);
      if (uri) setSelectedPhoto({ uri });
    }).catch(() => undefined);
  }, [authUser?.avatarUrl, authUser?.email, authUser?.id, existingToken, profile, profileLoaded, session]);

  const choosePhoto = async () => {
    const photo = await pickProfilePhoto();
    if (photo) {
      setSelectedPhoto(photo);
      setPhotoChanged(true);
    }
  };

  const save = async () => {
    setMessage(undefined);

    if (!name || !department || !institution || !mobile || !email || !session) {
      const text = "Fill name, department, institution, mobile, email, and academic session.";
      setMessage({ tone: "error", text });
      Alert.alert("Details required", text);
      return;
    }

    if (!existingToken && (!password || password.length < 8)) {
      const text = "Use at least 8 characters for the password.";
      setMessage({ tone: "error", text });
      Alert.alert("Password required", text);
      return;
    }

    if (!existingToken && password !== passwordConfirmation) {
      const text = "Confirm password must match.";
      setMessage({ tone: "error", text });
      Alert.alert("Password mismatch", text);
      return;
    }

    setSaving(true);
    try {
      if (existingToken) {
        await apiBackend.saveTeacherProfile({
          name,
          designation,
          department,
          institutionName: institution,
          mobileNumber: mobile,
          email
        });
        let avatarUrl = selectedPhoto?.uri;
        if (selectedPhoto && photoChanged) {
          avatarUrl = await uploadAndStoreProfilePhoto([authUser?.id, authUser?.email, email, profile?.teacherId], selectedPhoto);
        }
        if (authUser) {
          setAuthSession({ ...authUser, fullName: name, email, avatarUrl }, existingToken);
        }
        if (session) await apiBackend.createAcademicSession(session).catch(() => undefined);
        Alert.alert("Teacher updated", "Teacher profile and academic session are saved.");
        router.replace("/dashboard");
        return;
      }
      const data = await apiBackend.registerTeacher({
        name,
        designation,
        department,
        institutionName: institution,
        mobileNumber: mobile,
        email,
        academicSession: session,
        password,
        passwordConfirmation
      });
      await tokenStorage.save(data.accessToken, data.refreshToken);
      setAuthSession(data.user, data.accessToken);
      if (selectedPhoto) {
        const avatarUrl = await uploadAndStoreProfilePhoto([data.user?.id, data.user?.email], selectedPhoto);
        setAuthSession({ ...data.user, avatarUrl }, data.accessToken);
      }
      Alert.alert("Academic session created", "Your faculty workspace is ready. Add semesters, papers, and students next.");
      router.replace("/academics-setup");
    } catch (error) {
      const detail = error instanceof Error ? error.message : "Check the details or start the backend API.";
      const text = `Registration failed. ${detail}`;
      setMessage({ tone: "error", text });
      Alert.alert("Registration failed", text);
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
        <Text style={styles.kicker}>Stage 1 / First Time Setup</Text>
        <Text style={styles.title}>Create Your Account</Text>
        <Text style={styles.meta}>{existingToken ? "Edit the teacher profile and academic session." : "Register the teacher and create the first academic session on the live backend."}</Text>
      </View>

      {message ? (
        <View style={[styles.message, message.tone === "error" ? styles.messageError : styles.messageSuccess]}>
          <Text style={[styles.messageText, message.tone === "error" ? styles.messageErrorText : styles.messageSuccessText]}>{message.text}</Text>
        </View>
      ) : null}

      <View style={styles.formCard}>
        <View style={styles.photoRow}>
          <Pressable style={styles.photoCircle} onPress={choosePhoto} accessibilityRole="button" accessibilityLabel="Upload faculty photo">
            {selectedPhoto?.uri ? (
              <Image source={{ uri: selectedPhoto.uri }} style={styles.photoImage} />
            ) : (
              <Ionicons name="camera" size={26} color={colors.primaryDark} />
            )}
          </Pressable>
          <Pressable style={styles.photoButton} onPress={choosePhoto}>
            <Ionicons name="image-outline" size={18} color={colors.primaryDark} />
            <Text style={styles.photoButtonText}>{selectedPhoto ? "Change Photo" : "Upload Photo"}</Text>
          </Pressable>
        </View>
        <Field label="Name" value={name} onChangeText={setName} />
        <Field label="Designation" value={designation} onChangeText={setDesignation} />
        <Field label="Department" value={department} onChangeText={setDepartment} />
        <Field label="College / University Name" value={institution} onChangeText={setInstitution} />
        <Field label="Mobile Number" value={mobile} onChangeText={setMobile} keyboardType="phone-pad" />
        <Field label="Email" value={email} onChangeText={setEmail} keyboardType="email-address" />
        <Field label="Academic Session" value={session} onChangeText={setAcademicSession} />
        {!existingToken ? <>
          <Field label="Password" value={password} onChangeText={setPassword} secureTextEntry />
          <Field label="Confirm Password" value={passwordConfirmation} onChangeText={setPasswordConfirmation} secureTextEntry />
        </> : null}
      </View>

      <Pressable style={[styles.submit, saving && styles.disabled]} onPress={save} disabled={saving}>
        <Text style={styles.submitText}>{saving ? "Saving..." : existingToken ? "Save Teacher Profile" : "Create Academic Session"}</Text>
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
  photoRow: { flexDirection: "row", alignItems: "center", gap: 14, paddingBottom: 4 },
  photoCircle: { width: 82, height: 82, borderRadius: 41, borderWidth: 4, borderColor: colors.primary, backgroundColor: "#f0fdf4", alignItems: "center", justifyContent: "center", overflow: "hidden" },
  photoImage: { width: "100%", height: "100%", borderRadius: 41 },
  photoButton: { flex: 1, minHeight: 46, borderRadius: 12, borderWidth: 1, borderColor: "#b7e4c7", backgroundColor: "#f0fdf4", alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 8 },
  photoButtonText: { color: colors.primaryDark, fontWeight: "900" },
  message: { borderRadius: 12, borderWidth: 1, padding: 12 },
  messageError: { backgroundColor: "#fef2f2", borderColor: "#fecaca" },
  messageSuccess: { backgroundColor: "#f0fdf4", borderColor: "#bbf7d0" },
  messageText: { fontWeight: "900", lineHeight: 20 },
  messageErrorText: { color: colors.red },
  messageSuccessText: { color: colors.primaryDark },
  field: { gap: 8 },
  label: { color: colors.text, fontWeight: "900" },
  input: { backgroundColor: "#f8fafc", borderColor: colors.border, borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 13, color: colors.text, fontWeight: "800" },
  submit: { backgroundColor: colors.primary, borderRadius: 12, padding: 16, alignItems: "center", marginTop: 8 },
  disabled: { opacity: 0.65 },
  submitText: { color: "#fff", fontWeight: "900", fontSize: 16 }
});
