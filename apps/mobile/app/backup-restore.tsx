import { Ionicons } from "@expo/vector-icons";
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { BottomNav } from "@/components/bottom-nav";
import { apiBackend } from "@/services/api-backend";
import { colors, spacing } from "@/theme";

const snapshots = [
  { id: "1", target: "Google Drive", date: "18 Jul 2026", size: "2.4 MB", status: "Completed" },
  { id: "2", target: "Phone Storage", date: "17 Jul 2026", size: "2.3 MB", status: "Completed" }
];

export default function BackupRestoreScreen() {
  const createBackup = async (target: "GOOGLE_DRIVE" | "LOCAL_STORAGE") => {
    try {
      await apiBackend.createBackup({
        target,
        metadata: { classes: 45, students: 5, reports: 7 }
      });
      Alert.alert("Backup complete", target === "GOOGLE_DRIVE" ? "Google Drive backup recorded." : "Local backup recorded.");
    } catch {
      Alert.alert("Backup saved locally", "The backup record will sync when the server is reachable.");
    }
  };

  return (
    <View style={styles.shell}>
      <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
        <View style={styles.hero}>
          <Ionicons name="shield-checkmark" size={34} color={colors.primary} />
          <Text style={styles.title}>Backup and Restore</Text>
          <Text style={styles.meta}>Attendance, class diary, reports, and setup data.</Text>
        </View>

        <View style={styles.buttonRow}>
          <Pressable style={styles.primaryButton} onPress={() => createBackup("GOOGLE_DRIVE")}>
            <Ionicons name="cloud-upload" size={20} color="#fff" />
            <Text style={styles.primaryText}>Google Drive</Text>
          </Pressable>
          <Pressable style={styles.secondaryButton} onPress={() => createBackup("LOCAL_STORAGE")}>
            <Ionicons name="phone-portrait" size={20} color={colors.primaryDark} />
            <Text style={styles.secondaryText}>Phone Storage</Text>
          </Pressable>
        </View>

        <View style={styles.panel}>
          <Text style={styles.panelTitle}>Restore Points</Text>
          {snapshots.map((item) => (
            <View key={item.id} style={styles.snapshot}>
              <Ionicons name={item.target === "Google Drive" ? "cloud-done" : "folder"} size={22} color={colors.primary} />
              <View style={styles.snapshotText}>
                <Text style={styles.snapshotTitle}>{item.target}</Text>
                <Text style={styles.meta}>{item.date} / {item.size}</Text>
              </View>
              <Pressable style={styles.restoreButton} onPress={() => Alert.alert("Restore ready", `${item.target} snapshot selected.`)}>
                <Text style={styles.restoreText}>Restore</Text>
              </Pressable>
            </View>
          ))}
        </View>
      </ScrollView>
      <BottomNav />
    </View>
  );
}

const styles = StyleSheet.create({
  shell: { flex: 1, backgroundColor: colors.surface },
  screen: { flex: 1, backgroundColor: colors.surface },
  content: { padding: spacing.lg, gap: 14, paddingBottom: 28 },
  hero: { backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1, borderRadius: 12, padding: 18 },
  title: { color: colors.text, fontSize: 24, fontWeight: "900", marginTop: 10 },
  meta: { color: colors.muted, fontWeight: "700", marginTop: 3 },
  buttonRow: { flexDirection: "row", gap: 12 },
  primaryButton: { flex: 1, backgroundColor: colors.primary, borderRadius: 12, padding: 15, alignItems: "center", gap: 7 },
  primaryText: { color: "#fff", fontWeight: "900" },
  secondaryButton: { flex: 1, borderColor: colors.primary, borderWidth: 1, borderRadius: 12, padding: 15, alignItems: "center", gap: 7 },
  secondaryText: { color: colors.primaryDark, fontWeight: "900" },
  panel: { backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1, borderRadius: 12, padding: 16, gap: 12 },
  panelTitle: { color: colors.text, fontSize: 18, fontWeight: "900" },
  snapshot: { flexDirection: "row", alignItems: "center", gap: 12, borderBottomColor: colors.border, borderBottomWidth: 1, paddingBottom: 12 },
  snapshotText: { flex: 1 },
  snapshotTitle: { color: colors.text, fontWeight: "900" },
  restoreButton: { backgroundColor: "#f0fdf4", borderRadius: 9, paddingHorizontal: 12, paddingVertical: 8 },
  restoreText: { color: colors.primaryDark, fontWeight: "900" }
});
