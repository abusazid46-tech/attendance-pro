import { Ionicons } from "@expo/vector-icons";
import { Link, router, type Href } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { Alert, Image, Pressable, ScrollView, Share, StyleSheet, Text, View } from "react-native";
import { BottomNav } from "@/components/bottom-nav";
import { useBackendDashboard, type AttendanceRecord, type Paper, type Student } from "@/services/app-data";
import { apiBackend } from "@/services/api-backend";
import { registerForPushNotifications } from "@/services/notifications";
import { loadProfilePhoto, pickProfilePhoto, uploadAndStoreProfilePhoto } from "@/services/profile-photo";
import { tokenStorage } from "@/services/token-storage";
import { useAuthStore } from "@/store/auth";
import { colors, spacing, thresholdColor } from "@/theme";

type Period = "week" | "month" | "year";

const periods: Array<{ id: Period; label: string }> = [
  { id: "week", label: "Week" },
  { id: "month", label: "Month" },
  { id: "year", label: "Year" }
];

export default function DashboardScreen() {
  const { data, online } = useBackendDashboard();
  const clearAuth = useAuthStore((state) => state.clear);
  const user = useAuthStore((state) => state.user);
  const { teacherProfile, papers, students, classSessions, attendanceRecords, masters, cards } = data;
  const [selectedSemesterId, setSelectedSemesterId] = useState("");
  const [selectedPaperId, setSelectedPaperId] = useState("");
  const [period, setPeriod] = useState<Period>("month");
  const [photoUri, setPhotoUri] = useState<string | undefined>();

  useEffect(() => {
    registerForPushNotifications().catch(() => undefined);
  }, []);

  useEffect(() => {
    let mounted = true;
    const ownerKeys = [user?.id, user?.email, teacherProfile.email, teacherProfile.teacherId].filter(Boolean) as string[];
    if (teacherProfile.avatarUrl || user?.avatarUrl) {
      setPhotoUri(teacherProfile.avatarUrl ?? user?.avatarUrl);
      return;
    }
    Promise.all(ownerKeys.map((key) => loadProfilePhoto(key))).then((values) => {
      if (mounted) setPhotoUri(values.find(Boolean) ?? undefined);
    });
    return () => {
      mounted = false;
    };
  }, [teacherProfile.avatarUrl, teacherProfile.email, teacherProfile.teacherId, user?.avatarUrl, user?.email, user?.id]);

  useEffect(() => {
    if (!selectedSemesterId && masters.semesters[0]?.id) setSelectedSemesterId(masters.semesters[0].id);
  }, [masters.semesters, selectedSemesterId]);

  const semesterPapers = useMemo(
    () => papers.filter((paper) => !selectedSemesterId || paper.semesterId === selectedSemesterId),
    [papers, selectedSemesterId]
  );
  const currentPaper = semesterPapers.find((paper) => paper.id === selectedPaperId) ?? semesterPapers[0] ?? papers[0];

  useEffect(() => {
    if (currentPaper?.id && selectedPaperId !== currentPaper.id) setSelectedPaperId(currentPaper.id);
  }, [currentPaper?.id, selectedPaperId]);

  const filteredRecords = useMemo(
    () => attendanceRecords.filter((record) => (!currentPaper?.id || record.subjectId === currentPaper.id) && isInPeriod(record.date, period)),
    [attendanceRecords, currentPaper?.id, period]
  );
  const filteredStudents = useMemo(
    () => filterStudentsForPaper(students, currentPaper, filteredRecords),
    [students, currentPaper, filteredRecords]
  );
  const filteredSessions = useMemo(
    () => classSessions.filter((item) => (!currentPaper?.id || item.subjectId === currentPaper.id) && isInPeriod(item.classDate ?? item.date, period)),
    [classSessions, currentPaper?.id, period]
  );
  const graph = useMemo(() => buildGraph(filteredRecords, period), [filteredRecords, period]);
  const present = filteredRecords.filter((item) => item.status === "PRESENT").length;
  const average = filteredRecords.length ? Math.round((present / filteredRecords.length) * 100) : cards.averageAttendance;
  const defaulters = filteredStudents.filter((item) => item.total > 0 && item.attendance < 75).length;

  const logout = async () => {
    Alert.alert(
      "Lock or Sign Out",
      "Lock app to keep Fingerprint Quick Unlock ready, or perform a full sign out to remove account from this device.",
      [
        {
          text: "Lock App (Keep Biometrics)",
          onPress: async () => {
            await tokenStorage.clearActiveSession();
            clearAuth();
            router.replace("/login");
          }
        },
        {
          text: "Full Sign Out (Remove)",
          style: "destructive",
          onPress: async () => {
            await tokenStorage.clearAll();
            clearAuth();
            router.replace("/login");
          }
        },
        { text: "Cancel", style: "cancel" }
      ]
    );
  };

  const changePhoto = async () => {
    const photo = await pickProfilePhoto();
    if (!photo) return;
    setPhotoUri(photo.uri);
    const finalUri = await uploadAndStoreProfilePhoto([user?.id, user?.email, teacherProfile.email, teacherProfile.teacherId], photo);
    setPhotoUri(finalUri);
  };

  const shareCsv = async () => {
    const csv = [
      `Report: Dashboard CSV`,
      `Period: ${period.toUpperCase()}`,
      `Teacher: ${teacherProfile.name}`,
      `Semester: ${currentPaper?.semester ?? "All"}`,
      `Paper: ${currentPaper ? paperLabel(currentPaper) : "All"}`,
      `Classes Taken: ${filteredSessions.length || cards.totalClasses}`,
      `Attendance Avg: ${average}%`,
      `Students: ${filteredStudents.length || cards.totalStudents}`,
      `Defaulters: ${defaulters || cards.defaulters}`,
      "",
      "Roll No,Student Name,Classes Attended,Total Classes,Attendance %",
      ...filteredStudents.map((student) => `${student.rollNumber},${student.name},${student.present},${student.total},${student.attendance}`)
    ].join("\n");
    try {
      await apiBackend.generateReport({
        type: "SUBJECT",
        format: "EXCEL",
        title: `${currentPaper?.code ?? "Dashboard"} CSV Attendance`,
        filters: { subjectId: currentPaper?.id, period }
      });
      await Share.share({ title: `${currentPaper?.code ?? "Dashboard"} attendance CSV`, message: csv });
    } catch {
      await Share.share({ title: `${currentPaper?.code ?? "Dashboard"} attendance CSV`, message: csv }).catch(() => {
        Alert.alert("CSV report", csv);
      });
    }
  };

  return (
    <View style={styles.shell}>
      <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <View style={styles.headerTop}>
            <Pressable style={styles.photo} onPress={changePhoto} accessibilityRole="button" accessibilityLabel="Upload faculty photo">
              {photoUri ? <Image source={{ uri: photoUri }} style={styles.photoImage} /> : <Text style={styles.photoText}>{initials(teacherProfile.name)}</Text>}
              <View style={styles.photoAction}>
                <Ionicons name="camera" size={13} color="#fff" />
              </View>
            </Pressable>
            <Pressable style={styles.logoutButton} onPress={logout}>
              <Ionicons name="log-out-outline" size={18} color={colors.red} />
              <Text style={styles.logoutText}>Logout</Text>
            </Pressable>
          </View>
          <View style={styles.headerText}>
            <Text style={styles.kicker}>Smart Attendance Assistant</Text>
            <Text style={styles.teacher}>{teacherProfile.name}</Text>
            <Text style={styles.meta}>{teacherProfile.designation} / {teacherProfile.department}</Text>
            <Text style={online ? styles.online : styles.offline}>{online ? "Connected to backend" : "Backend offline"}</Text>
          </View>
        </View>

        <View style={styles.grid}>
          <Metric title="Classes Taken" value={filteredSessions.length || cards.totalClasses} icon="calendar" tone={colors.primary} onPress={shareCsv} />
          <Metric title="Attendance Avg" value={`${average}%`} icon="analytics" tone={thresholdColor(average)} onPress={shareCsv} />
          <Metric title="Students" value={filteredStudents.length || cards.totalStudents} icon="people" tone="#2563eb" onPress={shareCsv} />
          <Metric title="Defaulters" value={defaulters || cards.defaulters} icon="warning" tone={colors.red} onPress={shareCsv} />
        </View>

        <Link href="/take-attendance" asChild>
          <Pressable style={styles.primaryAction}>
            <Ionicons name="add-circle" size={22} color="#fff" />
            <Text style={styles.primaryActionText}>Start New Class</Text>
          </Pressable>
        </Link>

        <View style={styles.actions}>
          <Action href="/setup-wizard" icon="person-circle" label="Teacher" />
          <Action href="/academics-setup" icon="people-circle" label="Students" />
          <Action href="/backup-restore" icon="settings" label="Settings" />
          <Action href="/student-analytics" icon="trending-up" label="Analytics" />
          <Action href="/reports" icon="document-text" label="Reports" />
          <Action href="/class-diary" icon="book" label="Diary" />
        </View>

        <View style={styles.selectorPanel}>
          <Text style={styles.panelTitle}>Semester</Text>
          <View style={styles.chipRow}>
            {masters.semesters.length ? masters.semesters.map((semester) => (
              <Pressable key={semester.id} onPress={() => setSelectedSemesterId(semester.id)} style={[styles.chip, selectedSemesterId === semester.id && styles.activeChip]}>
                <Text style={[styles.chipText, selectedSemesterId === semester.id && styles.activeChipText]}>{semester.name}</Text>
              </Pressable>
            )) : <Text style={styles.emptyText}>No semesters added yet.</Text>}
          </View>
          <Text style={styles.panelTitle}>Paper</Text>
          <View style={styles.chipRow}>
            {semesterPapers.length ? semesterPapers.map((paper) => (
              <Pressable key={paper.id} onPress={() => setSelectedPaperId(paper.id)} style={[styles.chip, styles.paperChip, currentPaper?.id === paper.id && styles.activeChip]}>
                <Text style={[styles.chipText, styles.paperChipText, currentPaper?.id === paper.id && styles.activeChipText]}>{paperLabel(paper)}</Text>
              </Pressable>
            )) : <Text style={styles.emptyText}>No papers in this semester.</Text>}
          </View>
        </View>

        <View style={styles.panel}>
          <View style={styles.panelHeader}>
            <View>
              <Text style={styles.panelTitle}>Attendance Calendar</Text>
              <Text style={styles.panelMeta}>{currentPaper ? `${paperLabel(currentPaper)} / ${currentPaper.semester}` : "Select paper"}</Text>
            </View>
            <Pressable style={styles.csvButton} onPress={shareCsv}>
              <Ionicons name="download-outline" size={17} color="#fff" />
              <Text style={styles.csvText}>Report CSV</Text>
            </Pressable>
          </View>
          <View style={styles.segmented}>
            {periods.map((item) => (
              <Pressable key={item.id} onPress={() => setPeriod(item.id)} style={[styles.segment, period === item.id && styles.activeSegment]}>
                <Text style={[styles.segmentText, period === item.id && styles.activeSegmentText]}>{item.label}</Text>
              </Pressable>
            ))}
          </View>
          {filteredSessions.length ? filteredSessions.map((item) => (
            <View key={item.id ?? `${item.date}-${item.status}`} style={styles.calendarRow}>
              <View style={[styles.dot, { backgroundColor: item.color }]} />
              <View style={styles.calendarText}>
                <Text style={styles.calendarDate}>{item.date}</Text>
                <Text style={styles.calendarTopic}>{item.topic}</Text>
              </View>
              <Text style={[styles.calendarStatus, { color: item.color }]}>{item.status}</Text>
            </View>
          )) : <Text style={styles.emptyText}>No classes recorded for this selection.</Text>}
        </View>

        <View style={styles.panel}>
          <View style={styles.panelHeader}>
            <Text style={styles.panelTitle}>{periodLabel(period)} Graph</Text>
            <Text style={styles.panelMeta}>{filteredRecords.length} records</Text>
          </View>
          {graph.length ? graph.map((item) => (
            <View key={item.label} style={styles.barRow}>
              <Text style={styles.barLabel}>{item.label}</Text>
              <View style={styles.barTrack}>
                <View style={[styles.barFill, { width: `${item.percentage}%`, backgroundColor: thresholdColor(item.percentage) }]} />
              </View>
              <Text style={styles.percent}>{item.percentage}%</Text>
            </View>
          )) : <Text style={styles.emptyText}>No graph data for this selection.</Text>}
        </View>
      </ScrollView>
      <BottomNav />
    </View>
  );
}

function Metric({ title, value, icon, tone, onPress }: { title: string; value: string | number; icon: keyof typeof Ionicons.glyphMap; tone: string; onPress: () => void }) {
  return (
    <Pressable style={({ pressed }) => [styles.metric, pressed && styles.metricPressed]} onPress={onPress} accessibilityRole="button" accessibilityLabel={`${title} CSV report`}>
      <Ionicons name={icon} size={22} color={tone} />
      <Text style={styles.metricValue}>{value}</Text>
      <Text style={styles.metricTitle}>{title}</Text>
      <View style={styles.metricReport}>
        <Ionicons name="download-outline" size={13} color={colors.primaryDark} />
        <Text style={styles.metricReportText}>Report CSV</Text>
      </View>
    </Pressable>
  );
}

function Action({ href, icon, label }: { href: Href; icon: keyof typeof Ionicons.glyphMap; label: string }) {
  return (
    <Link href={href} asChild>
      <Pressable style={styles.action}>
        <Ionicons name={icon} size={21} color={colors.primaryDark} />
        <Text style={styles.actionText}>{label}</Text>
      </Pressable>
    </Link>
  );
}

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((item) => item[0]?.toUpperCase()).join("") || "SA";
}

function paperLabel(paper: Paper) {
  return `${paper.code} - ${paper.name}`;
}

function isInPeriod(rawDate: string, period: Period) {
  if (!rawDate) return false;
  const date = new Date(rawDate);
  if (Number.isNaN(date.getTime())) return true;
  const now = new Date();
  if (period === "week") {
    const weekAgo = new Date(now);
    weekAgo.setDate(now.getDate() - 6);
    weekAgo.setHours(0, 0, 0, 0);
    return date >= weekAgo && date <= now;
  }
  if (period === "month") return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth();
  return date.getFullYear() === now.getFullYear();
}

function periodLabel(period: Period) {
  if (period === "week") return "Week wise";
  if (period === "month") return "Month wise";
  return "Year wise";
}

function filterStudentsForPaper(students: Student[], paper: Paper | undefined, records: AttendanceRecord[]) {
  if (!paper) return students;
  const ids = new Set(records.map((record) => record.studentId));
  const base = students.filter((student) => !paper.semesterId || student.semesterId === paper.semesterId || ids.has(student.id));
  if (!records.length) return base;
  return base.map((student) => {
    const own = records.filter((record) => record.studentId === student.id);
    const present = own.filter((record) => record.status === "PRESENT").length;
    return {
      ...student,
      present,
      absent: own.filter((record) => record.status === "ABSENT").length,
      late: own.filter((record) => record.status === "LATE").length,
      leave: own.filter((record) => record.status === "LEAVE").length,
      total: own.length,
      attendance: own.length ? Math.round((present / own.length) * 100) : 0
    };
  });
}

function buildGraph(records: AttendanceRecord[], period: Period) {
  const groups = new Map<string, { present: number; total: number }>();
  records.forEach((record) => {
    const date = new Date(record.date);
    const label = Number.isNaN(date.getTime())
      ? record.date
      : period === "year"
        ? date.toLocaleDateString("en-IN", { month: "short" })
        : date.toLocaleDateString("en-IN", { day: "2-digit", month: "short" });
    const current = groups.get(label) ?? { present: 0, total: 0 };
    current.total += 1;
    if (record.status === "PRESENT") current.present += 1;
    groups.set(label, current);
  });
  return Array.from(groups.entries()).map(([label, item]) => ({
    label,
    percentage: item.total ? Math.round((item.present / item.total) * 100) : 0
  }));
}

const styles = StyleSheet.create({
  shell: { flex: 1, backgroundColor: "#edf4f1" },
  screen: { flex: 1, backgroundColor: "#edf4f1" },
  content: { padding: spacing.lg, gap: spacing.lg, paddingBottom: 32 },
  header: { gap: 12, backgroundColor: "#f5fbf7", borderColor: "#80d7a0", borderWidth: 1.5, borderRadius: 12, padding: 14 },
  headerTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  photo: { width: 74, height: 74, borderRadius: 37, borderWidth: 4, borderColor: colors.primary, backgroundColor: "#ffffff", alignItems: "center", justifyContent: "center" },
  photoImage: { width: "100%", height: "100%", borderRadius: 37 },
  photoText: { color: colors.primaryDark, fontWeight: "900", fontSize: 22 },
  photoAction: { position: "absolute", right: -2, bottom: -2, width: 25, height: 25, borderRadius: 13, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: "#fff" },
  headerText: { minWidth: 0 },
  kicker: { color: colors.primaryDark, fontWeight: "900", textTransform: "uppercase", fontSize: 15 },
  teacher: { color: colors.text, fontSize: 31, lineHeight: 36, fontWeight: "900", marginTop: 8, flexShrink: 1 },
  meta: { color: colors.muted, marginTop: 3, lineHeight: 20 },
  online: { color: colors.primaryDark, marginTop: 6, fontWeight: "900", fontSize: 12 },
  offline: { color: colors.orange, marginTop: 6, fontWeight: "900", fontSize: 12 },
  logoutButton: { minWidth: 88, height: 42, borderRadius: 10, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 5, backgroundColor: colors.card, borderColor: "#fecaca", borderWidth: 1 },
  logoutText: { color: colors.red, fontWeight: "900", fontSize: 12 },
  selectorPanel: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: 16, gap: 10 },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { borderWidth: 1, borderColor: colors.border, backgroundColor: "#f8fafc", borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8 },
  paperChip: { maxWidth: "100%", borderRadius: 14 },
  activeChip: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { color: colors.text, fontWeight: "900" },
  paperChipText: { flexShrink: 1, lineHeight: 19 },
  activeChipText: { color: "#fff" },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 14 },
  metric: { width: "47%", backgroundColor: colors.card, borderColor: colors.primary, borderWidth: 1.5, borderRadius: 8, padding: 16, minHeight: 138 },
  metricPressed: { backgroundColor: "#f0fdf4" },
  metricValue: { fontSize: 31, fontWeight: "900", color: colors.text, marginTop: 12 },
  metricTitle: { color: colors.muted, marginTop: 4, fontWeight: "700" },
  metricReport: { marginTop: 12, flexDirection: "row", alignItems: "center", gap: 5 },
  metricReportText: { color: colors.primaryDark, fontWeight: "900", fontSize: 11 },
  primaryAction: { backgroundColor: colors.primary, borderRadius: 12, padding: 16, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  primaryActionText: { color: "#fff", fontWeight: "900", fontSize: 16 },
  actions: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  action: { width: "31%", minHeight: 78, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: 12, alignItems: "center", justifyContent: "center", gap: 7 },
  actionText: { color: colors.text, fontWeight: "800", fontSize: 12 },
  panel: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: 16 },
  panelHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  panelTitle: { fontSize: 18, fontWeight: "900", color: colors.text },
  panelMeta: { color: colors.muted, fontWeight: "800", marginTop: 2 },
  csvButton: { backgroundColor: colors.primary, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8, flexDirection: "row", alignItems: "center", gap: 6 },
  csvText: { color: "#fff", fontWeight: "900", fontSize: 12 },
  segmented: { flexDirection: "row", borderWidth: 1, borderColor: colors.border, borderRadius: 10, overflow: "hidden", marginTop: 14, marginBottom: 4 },
  segment: { flex: 1, alignItems: "center", paddingVertical: 10, backgroundColor: "#f8fafc" },
  activeSegment: { backgroundColor: "#dcfce7" },
  segmentText: { color: colors.muted, fontWeight: "900" },
  activeSegmentText: { color: colors.primaryDark },
  calendarRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: colors.border },
  dot: { width: 10, height: 10, borderRadius: 5 },
  calendarText: { flex: 1 },
  calendarDate: { color: colors.text, fontWeight: "900" },
  calendarTopic: { color: colors.muted, marginTop: 2 },
  calendarStatus: { fontWeight: "900", fontSize: 12 },
  barRow: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 14 },
  barLabel: { width: 58, color: colors.text, fontWeight: "800" },
  barTrack: { flex: 1, height: 10, backgroundColor: "#e2e8f0", borderRadius: 999 },
  barFill: { height: 10, borderRadius: 999 },
  percent: { width: 42, textAlign: "right", color: colors.muted, fontWeight: "800" },
  emptyText: { color: colors.muted, fontWeight: "800", paddingVertical: 10 }
});
