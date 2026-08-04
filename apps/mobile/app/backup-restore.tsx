import { Ionicons } from "@expo/vector-icons";
import { Link } from "expo-router";
import { useEffect, useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { BottomNav } from "@/components/bottom-nav";
import { apiBackend } from "@/services/api-backend";
import { useBackendDashboard } from "@/services/app-data";
import { createLocalBackup, formatBackupDate, formatBytes, listLocalBackups, restoreLocalBackup, shareBackup, type LocalBackupSnapshot } from "@/services/backup-service";
import { colors, spacing } from "@/theme";

type BackupSnapshot = { id: string; target: string; date: string; size: string; status: string };

export default function BackupRestoreScreen() {
  const { data, online: dashboardOnline } = useBackendDashboard();
  const [serverSnapshots, setServerSnapshots] = useState<BackupSnapshot[]>([]);
  const [localSnapshots, setLocalSnapshots] = useState<LocalBackupSnapshot[]>([]);
  const [online, setOnline] = useState(false);
  const [busy, setBusy] = useState(false);

  const loadBackups = async () => {
    const local = await listLocalBackups();
    setLocalSnapshots(local);
    try {
      const response = await apiBackend.backups();
      setServerSnapshots(response.backups.map((item: BackupSnapshot) => ({ ...item, target: item.target === "GOOGLE_DRIVE" ? "Google Drive" : "Phone Storage" })));
      setOnline(true);
    } catch {
      setOnline(false);
    }
  };

  useEffect(() => {
    loadBackups();
  }, []);

  const createBackup = async (target: "GOOGLE_DRIVE" | "LOCAL_STORAGE") => {
    setBusy(true);
    try {
      const snapshot = await createLocalBackup(target, data);
      if (target === "GOOGLE_DRIVE") {
        await shareBackup(snapshot);
      }
      await apiBackend.createBackup({
        target,
        metadata: {
          source: "mobile",
          localBackupId: snapshot.id,
          size: snapshot.size,
          summary: snapshot.summary
        }
      }).catch(() => undefined);
      await loadBackups();
      Alert.alert(
        "Backup complete",
        `${target === "GOOGLE_DRIVE" ? "Drive share package" : "Phone storage snapshot"} created.\nStudents: ${snapshot.summary.students}\nPapers: ${snapshot.summary.papers}\nRecords: ${snapshot.summary.attendanceRecords}`
      );
    } catch {
      Alert.alert("Backup failed", "The phone backup could not be created.");
    } finally {
      setBusy(false);
    }
  };

  const restoreBackup = async (id: string) => {
    setBusy(true);
    try {
      const snapshot = await restoreLocalBackup(id);
      Alert.alert(
        "Restore complete",
        `Local app data restored from ${formatBackupDate(snapshot.createdAt)}.\nLocal items restored: ${snapshot.summary.localItems}\nBackend attendance remains synced from the server.`
      );
      await loadBackups();
    } catch (error) {
      const detail = error instanceof Error ? error.message : "This snapshot is not available on this phone.";
      Alert.alert("Restore failed", detail);
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.shell}>
      <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
        <View style={styles.hero}>
          <Ionicons name="shield-checkmark" size={34} color={colors.primary} />
          <Text style={styles.title}>Settings</Text>
          <Text style={styles.meta}>Teacher profile, student master database, semesters, papers, backup, and restore.</Text>
          <Text style={online || dashboardOnline ? styles.online : styles.offline}>{online || dashboardOnline ? "Connected to backend" : "Backend offline"}</Text>
        </View>
        <View style={styles.panel}>
          <Text style={styles.panelTitle}>App Setup</Text>
          <Link href="/setup-wizard" asChild>
            <Pressable style={styles.settingsRow}>
              <Ionicons name="person-circle" size={24} color={colors.primary} />
              <View style={styles.snapshotText}>
                <Text style={styles.snapshotTitle}>Teacher</Text>
                <Text style={styles.meta}>One-time setup. Open to edit teacher details.</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.muted} />
            </Pressable>
          </Link>
          <Link href="/academics-setup" asChild>
            <Pressable style={styles.settingsRow}>
              <Ionicons name="people-circle" size={24} color={colors.primary} />
              <View style={styles.snapshotText}>
                <Text style={styles.snapshotTitle}>Students</Text>
                <Text style={styles.meta}>Master student database, semesters, and papers.</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.muted} />
            </Pressable>
          </Link>
        </View>
        <View style={styles.buttonRow}>
          <Pressable style={[styles.primaryButton, busy && styles.disabled]} onPress={() => createBackup("GOOGLE_DRIVE")} disabled={busy}>
            <Ionicons name="cloud-upload" size={20} color="#fff" />
            <Text style={styles.primaryText}>Share to Drive</Text>
          </Pressable>
          <Pressable style={[styles.secondaryButton, busy && styles.disabled]} onPress={() => createBackup("LOCAL_STORAGE")} disabled={busy}>
            <Ionicons name="phone-portrait" size={20} color={colors.primaryDark} />
            <Text style={styles.secondaryText}>Phone Storage</Text>
          </Pressable>
        </View>
        <View style={styles.panel}>
          <Text style={styles.panelTitle}>Phone Restore Points</Text>
          {localSnapshots.length ? localSnapshots.map((item) => (
            <View key={item.id} style={styles.snapshot}>
              <Ionicons name={item.target === "GOOGLE_DRIVE" ? "cloud-done" : "folder"} size={22} color={colors.primary} />
              <View style={styles.snapshotText}>
                <Text style={styles.snapshotTitle}>{item.target === "GOOGLE_DRIVE" ? "Drive Package" : "Phone Storage"}</Text>
                <Text style={styles.meta}>{formatBackupDate(item.createdAt)} / {formatBytes(item.size)}</Text>
                <Text style={styles.meta}>{item.summary.students} students, {item.summary.papers} papers, {item.summary.attendanceRecords} records</Text>
              </View>
              <Pressable style={styles.restoreButton} onPress={() => restoreBackup(item.id)} disabled={busy}>
                <Text style={styles.restoreText}>Restore</Text>
              </Pressable>
            </View>
          )) : <Text style={styles.emptyText}>No backup records yet.</Text>}
        </View>
        <View style={styles.panel}>
          <Text style={styles.panelTitle}>Backend Backup Log</Text>
          {serverSnapshots.length ? serverSnapshots.map((item) => (
            <View key={item.id} style={styles.serverSnapshot}>
              <Ionicons name={item.target === "Google Drive" ? "cloud-done" : "server"} size={22} color={colors.primary} />
              <View style={styles.snapshotText}>
                <Text style={styles.snapshotTitle}>{item.target}</Text>
                <Text style={styles.meta}>{item.date} / {item.status}</Text>
              </View>
            </View>
          )) : <Text style={styles.emptyText}>No backend backup log yet.</Text>}
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
  online: { color: colors.primaryDark, fontWeight: "900", marginTop: 8, fontSize: 12 },
  offline: { color: colors.orange, fontWeight: "900", marginTop: 8, fontSize: 12 },
  buttonRow: { flexDirection: "row", gap: 12 },
  primaryButton: { flex: 1, backgroundColor: colors.primary, borderRadius: 12, padding: 15, alignItems: "center", gap: 7 },
  primaryText: { color: "#fff", fontWeight: "900" },
  secondaryButton: { flex: 1, borderColor: colors.primary, borderWidth: 1, borderRadius: 12, padding: 15, alignItems: "center", gap: 7 },
  secondaryText: { color: colors.primaryDark, fontWeight: "900" },
  disabled: { opacity: 0.55 },
  panel: { backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1, borderRadius: 12, padding: 16, gap: 12 },
  panelTitle: { color: colors.text, fontSize: 18, fontWeight: "900" },
  snapshot: { flexDirection: "row", alignItems: "center", gap: 12, borderBottomColor: colors.border, borderBottomWidth: 1, paddingBottom: 12 },
  serverSnapshot: { flexDirection: "row", alignItems: "center", gap: 12, borderBottomColor: colors.border, borderBottomWidth: 1, paddingBottom: 12 },
  settingsRow: { flexDirection: "row", alignItems: "center", gap: 12, borderBottomColor: colors.border, borderBottomWidth: 1, paddingBottom: 12 },
  snapshotText: { flex: 1 },
  snapshotTitle: { color: colors.text, fontWeight: "900" },
  restoreButton: { backgroundColor: "#f0fdf4", borderRadius: 9, paddingHorizontal: 12, paddingVertical: 8 },
  restoreText: { color: colors.primaryDark, fontWeight: "900" },
  emptyText: { color: colors.muted, fontWeight: "800", paddingVertical: 8 }
});
