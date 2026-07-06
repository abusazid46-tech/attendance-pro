import { Ionicons } from "@expo/vector-icons";
import { Link } from "expo-router";
import { useEffect } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { BottomNav } from "@/components/bottom-nav";
import { classSessions, monthlyTrend, papers, students, teacherProfile } from "@/data/saa";
import { registerForPushNotifications } from "@/services/notifications";
import { colors, spacing, thresholdColor } from "@/theme";

const totalClasses = 45;
const averageAttendance = Math.round(students.reduce((sum, item) => sum + item.attendance, 0) / students.length);
const defaulters = students.filter((item) => item.attendance < 75);

export default function DashboardScreen() {
  useEffect(() => {
    registerForPushNotifications().catch(() => undefined);
  }, []);

  return (
    <View style={styles.shell}>
      <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <View style={styles.headerText}>
            <Text style={styles.kicker}>Smart Attendance Assistant</Text>
            <Text style={styles.title}>{teacherProfile.name}</Text>
            <Text style={styles.meta}>{teacherProfile.designation} / {teacherProfile.department}</Text>
          </View>
          <View style={styles.sessionPill}>
            <Text style={styles.sessionText}>{teacherProfile.academicSession}</Text>
          </View>
        </View>

        <View style={styles.grid}>
          <Metric title="Classes Taken" value={totalClasses} icon="calendar" tone={colors.primary} />
          <Metric title="Attendance Avg" value={`${averageAttendance}%`} icon="analytics" tone={thresholdColor(averageAttendance)} />
          <Metric title="Students" value={students.length} icon="people" tone="#2563eb" />
          <Metric title="Defaulters" value={defaulters.length} icon="warning" tone={colors.red} />
        </View>

        <Link href="/take-attendance" asChild>
          <Pressable style={styles.primaryAction}>
            <Ionicons name="add-circle" size={22} color="#fff" />
            <Text style={styles.primaryActionText}>Start New Class</Text>
          </Pressable>
        </Link>

        <View style={styles.actions}>
          <Action href="/setup-wizard" icon="person-add" label="Setup" />
          <Action href="/academics-setup" icon="school" label="Semesters" />
          <Action href="/student-analytics" icon="trending-up" label="Analytics" />
          <Action href="/reports" icon="document-text" label="Reports" />
          <Action href="/class-diary" icon="book" label="Diary" />
          <Action href="/backup-restore" icon="cloud-upload" label="Backup" />
        </View>

        <View style={styles.panel}>
          <View style={styles.panelHeader}>
            <Text style={styles.panelTitle}>Current Paper</Text>
            <Text style={styles.panelMeta}>{papers[1].semester}</Text>
          </View>
          <Text style={styles.paperCode}>{papers[1].code}</Text>
          <Text style={styles.paperName}>{papers[1].name}</Text>
        </View>

        <View style={styles.panel}>
          <View style={styles.panelHeader}>
            <Text style={styles.panelTitle}>Attendance Calendar</Text>
            <Text style={styles.panelMeta}>LIS202</Text>
          </View>
          {classSessions.map((item) => (
            <View key={`${item.date}-${item.status}`} style={styles.calendarRow}>
              <View style={[styles.dot, { backgroundColor: item.color }]} />
              <View style={styles.calendarText}>
                <Text style={styles.calendarDate}>{item.date}</Text>
                <Text style={styles.calendarTopic}>{item.topic}</Text>
              </View>
              <Text style={[styles.calendarStatus, { color: item.color }]}>{item.status}</Text>
            </View>
          ))}
        </View>

        <View style={styles.panel}>
          <View style={styles.panelHeader}>
            <Text style={styles.panelTitle}>Monthly Trend</Text>
            <Text style={styles.panelMeta}>Semester II</Text>
          </View>
          {monthlyTrend.map((item) => (
            <View key={item.month} style={styles.barRow}>
              <Text style={styles.barLabel}>{item.month}</Text>
              <View style={styles.barTrack}>
                <View style={[styles.barFill, { width: `${item.percentage}%`, backgroundColor: thresholdColor(item.percentage) }]} />
              </View>
              <Text style={styles.percent}>{item.percentage}%</Text>
            </View>
          ))}
        </View>
      </ScrollView>
      <BottomNav />
    </View>
  );
}

function Metric({ title, value, icon, tone }: { title: string; value: string | number; icon: keyof typeof Ionicons.glyphMap; tone: string }) {
  return (
    <View style={styles.metric}>
      <Ionicons name={icon} size={22} color={tone} />
      <Text style={styles.metricValue}>{value}</Text>
      <Text style={styles.metricTitle}>{title}</Text>
    </View>
  );
}

function Action({ href, icon, label }: { href: string; icon: keyof typeof Ionicons.glyphMap; label: string }) {
  return (
    <Link href={href} asChild>
      <Pressable style={styles.action}>
        <Ionicons name={icon} size={21} color={colors.primaryDark} />
        <Text style={styles.actionText}>{label}</Text>
      </Pressable>
    </Link>
  );
}

const styles = StyleSheet.create({
  shell: { flex: 1, backgroundColor: colors.surface },
  screen: { flex: 1, backgroundColor: colors.surface },
  content: { padding: spacing.lg, gap: spacing.lg, paddingBottom: 32 },
  header: { flexDirection: "row", justifyContent: "space-between", gap: 12, alignItems: "flex-start" },
  headerText: { flex: 1, minWidth: 0 },
  kicker: { color: colors.primaryDark, fontWeight: "900", textTransform: "uppercase", fontSize: 12 },
  title: { color: colors.text, fontSize: 28, fontWeight: "900", marginTop: 4, flexShrink: 1 },
  meta: { color: colors.muted, marginTop: 4, lineHeight: 20 },
  sessionPill: { backgroundColor: "#dbeafe", borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8, flexShrink: 0 },
  sessionText: { color: "#1d4ed8", fontWeight: "900" },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  metric: { width: "47%", backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1, borderRadius: 12, padding: 16, minHeight: 116 },
  metricValue: { fontSize: 28, fontWeight: "900", color: colors.text, marginTop: 10 },
  metricTitle: { color: colors.muted, marginTop: 4, fontWeight: "700" },
  primaryAction: { backgroundColor: colors.primary, borderRadius: 12, padding: 16, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  primaryActionText: { color: "#fff", fontWeight: "900", fontSize: 16 },
  actions: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  action: { width: "31%", minHeight: 78, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: 12, alignItems: "center", justifyContent: "center", gap: 7 },
  actionText: { color: colors.text, fontWeight: "800", fontSize: 12 },
  panel: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: 16 },
  panelHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  panelTitle: { fontSize: 18, fontWeight: "900", color: colors.text },
  panelMeta: { color: colors.muted, fontWeight: "800" },
  paperCode: { color: colors.primaryDark, fontWeight: "900", marginTop: 14 },
  paperName: { color: colors.text, fontSize: 20, fontWeight: "900", marginTop: 3 },
  calendarRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: colors.border },
  dot: { width: 10, height: 10, borderRadius: 5 },
  calendarText: { flex: 1 },
  calendarDate: { color: colors.text, fontWeight: "900" },
  calendarTopic: { color: colors.muted, marginTop: 2 },
  calendarStatus: { fontWeight: "900", fontSize: 12 },
  barRow: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 14 },
  barLabel: { width: 34, color: colors.text, fontWeight: "800" },
  barTrack: { flex: 1, height: 10, backgroundColor: "#e2e8f0", borderRadius: 999 },
  barFill: { height: 10, borderRadius: 999 },
  percent: { width: 42, textAlign: "right", color: colors.muted, fontWeight: "800" }
});
