import { Ionicons } from "@expo/vector-icons";
import { useEffect, useMemo, useState } from "react";
import { Alert, Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { BottomNav } from "@/components/bottom-nav";
import { apiBackend } from "@/services/api-backend";
import { useBackendDashboard, type AttendanceRecord, type Paper, type Student } from "@/services/app-data";
import { colors, spacing, thresholdColor } from "@/theme";

type Period = "week" | "month" | "year";

const periods: Array<{ id: Period; label: string }> = [
  { id: "week", label: "Week" },
  { id: "month", label: "Month" },
  { id: "year", label: "Year" }
];
const statuses = ["PRESENT", "ABSENT", "LATE", "LEAVE"] as const;
const statusLabel: Record<(typeof statuses)[number], string> = {
  PRESENT: "P",
  ABSENT: "A",
  LATE: "L",
  LEAVE: "I"
};

export default function StudentAnalyticsScreen() {
  const { data, online, refresh } = useBackendDashboard();
  const { students, papers, masters, attendanceRecords } = data;
  const [selectedSemesterId, setSelectedSemesterId] = useState("");
  const [selectedPaperId, setSelectedPaperId] = useState("");
  const [period, setPeriod] = useState<Period>("month");
  const [activeStudent, setActiveStudent] = useState<Student | null>(null);
  const [studentRecords, setStudentRecords] = useState<AttendanceRecord[]>([]);

  useEffect(() => {
    if (!selectedSemesterId && masters.semesters[0]?.id) setSelectedSemesterId(masters.semesters[0].id);
  }, [masters.semesters, selectedSemesterId]);

  const semesterPapers = useMemo(
    () => papers.filter((paper) => !selectedSemesterId || paper.semesterId === selectedSemesterId),
    [papers, selectedSemesterId]
  );
  const paperWithRecords = useMemo(
    () => semesterPapers.find((item) => attendanceRecords.some((record) => record.subjectId === item.id)),
    [attendanceRecords, semesterPapers]
  );
  const paper = semesterPapers.find((item) => item.id === selectedPaperId) ?? paperWithRecords ?? semesterPapers[0] ?? papers[0];

  useEffect(() => {
    if (paper?.id && selectedPaperId !== paper.id) setSelectedPaperId(paper.id);
  }, [paper?.id, selectedPaperId]);

  const paperRecords = useMemo(
    () => attendanceRecords.filter((record) => !paper?.id || record.subjectId === paper.id),
    [attendanceRecords, paper?.id]
  );
  const filteredRecords = useMemo(
    () => paperRecords.filter((record) => isInPeriod(record.date, period)),
    [paperRecords, period]
  );
  const visibleRecords = filteredRecords.length ? filteredRecords : paperRecords;
  const hasAttendance = paperRecords.length > 0;
  const periodHasAttendance = filteredRecords.length > 0;
  const periodHint = hasAttendance && !periodHasAttendance ? `No ${period} records. Showing all saved records for this paper.` : "";
  const noAttendanceText = "No attendance submitted for this paper yet. Take attendance first, then analytics will appear here.";
  const filteredStudents = useMemo(
    () => filterStudentsForPaper(students, paper, visibleRecords),
    [students, paper, visibleRecords]
  );
  const present = visibleRecords.filter((item) => item.status === "PRESENT").length;
  const total = visibleRecords.length;
  const absent = visibleRecords.filter((item) => item.status === "ABSENT").length;
  const late = visibleRecords.filter((item) => item.status === "LATE").length;
  const average = total ? Math.round((present / total) * 100) : 0;
  const defaulters = hasAttendance ? filteredStudents.filter((student) => student.total > 0 && student.attendance < 75) : [];
  const graph = buildGraph(visibleRecords, period);

  const openStudent = async (student: Student) => {
    setActiveStudent(student);
    setStudentRecords([]);
    try {
      const response = await apiBackend.studentRecords(student.id, paper?.id ? { subjectId: paper.id } : undefined);
      setStudentRecords((response.records ?? []).map(normalizeRecord));
    } catch {
      setStudentRecords(visibleRecords.filter((record) => record.studentId === student.id));
    }
  };

  const removeStudent = (student: Student) => {
    Alert.alert("Remove student", `Remove ${student.name} and linked attendance records?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Remove",
        style: "destructive",
        onPress: async () => {
          try {
            await apiBackend.deleteStudent(student.id);
            setActiveStudent(null);
            await refresh();
          } catch (error) {
            Alert.alert("Remove failed", error instanceof Error ? error.message : "The backend did not remove this student.");
          }
        }
      }
    ]);
  };

  const updateRecordStatus = async (recordId: string, status: AttendanceRecord["status"]) => {
    try {
      await apiBackend.updateAttendance(recordId, { status });
      setStudentRecords((current) => current.map((record) => record.id === recordId ? { ...record, status } : record));
      await refresh();
    } catch (error) {
      Alert.alert("Update failed", error instanceof Error ? error.message : "Attendance record could not be updated.");
    }
  };

  return (
    <View style={styles.shell}>
      <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
        <View style={styles.hero}>
          <Text style={styles.label}>{paper ? `${paperLabel(paper)} / ${paper.semester}` : "Attendance"}</Text>
          <Text style={[styles.overall, { color: thresholdColor(average) }]}>{average}%</Text>
          <Text style={styles.meta}>{hasAttendance ? `${present} present / ${absent} absent / ${late} late` : noAttendanceText}</Text>
          {periodHint ? <Text style={styles.note}>{periodHint}</Text> : null}
          <Text style={online ? styles.online : styles.offline}>{online ? "Connected to backend" : "Backend offline"}</Text>
        </View>

        <View style={styles.chartPanel}>
          <Text style={styles.panelTitle}>Choose Semester and Paper</Text>
          <View style={styles.chipRow}>
            {masters.semesters.length ? masters.semesters.map((semester) => (
              <Pressable key={semester.id} onPress={() => setSelectedSemesterId(semester.id)} style={[styles.chip, selectedSemesterId === semester.id && styles.activeChip]}>
                <Text style={[styles.chipText, selectedSemesterId === semester.id && styles.activeChipText]}>{semester.name}</Text>
              </Pressable>
            )) : <Text style={styles.emptyText}>No semesters added yet.</Text>}
          </View>
          <View style={styles.chipRow}>
            {semesterPapers.length ? semesterPapers.map((item) => (
              <Pressable key={item.id} onPress={() => setSelectedPaperId(item.id)} style={[styles.chip, styles.paperChip, paper?.id === item.id && styles.activeChip]}>
                <Text style={[styles.chipText, styles.paperChipText, paper?.id === item.id && styles.activeChipText]}>{paperLabel(item)}</Text>
              </Pressable>
            )) : <Text style={styles.emptyText}>No papers for this semester.</Text>}
          </View>
        </View>

        <View style={styles.chartPanel}>
          <Text style={styles.panelTitle}>Present / Absent / Late</Text>
          <View style={styles.pieRow}>
            <PieSegment label="Present" value={present} color={colors.primary} />
            <PieSegment label="Absent" value={absent} color={colors.red} />
            <PieSegment label="Late" value={late} color={colors.orange} />
          </View>
        </View>

        <View style={styles.chartPanel}>
          <Text style={styles.panelTitle}>Student-wise Attendance</Text>
          {!hasAttendance ? <Text style={styles.emptyText}>{noAttendanceText}</Text> : filteredStudents.length ? filteredStudents.map((item) => (
            <View key={item.id} style={styles.card}>
              <View style={styles.row}>
                <Pressable style={styles.studentBlock} onPress={() => openStudent(item)}>
                  <Text style={styles.subject}>{item.rollNumber}. {item.name}</Text>
                  <Text style={styles.meta}>{item.present} classes attended out of {item.total} classes</Text>
                </Pressable>
                <Pressable style={styles.removeButton} onPress={() => removeStudent(item)}>
                  <Ionicons name="trash-outline" size={18} color={colors.red} />
                </Pressable>
                <Text style={[styles.percent, { color: thresholdColor(item.attendance) }]}>{item.attendance}%</Text>
              </View>
              <View style={styles.track}>
                <View style={[styles.fill, { width: `${item.attendance}%`, backgroundColor: thresholdColor(item.attendance) }]} />
              </View>
            </View>
          )) : <Text style={styles.emptyText}>No student attendance records yet.</Text>}
        </View>

        <View style={styles.chartPanel}>
          <View style={styles.headerRow}>
            <Text style={styles.panelTitle}>Attendance Defaulters</Text>
            <Ionicons name="warning" size={20} color={colors.red} />
          </View>
          {!hasAttendance ? <Text style={styles.emptyText}>{noAttendanceText}</Text> : defaulters.length ? defaulters.map((item) => (
            <Pressable key={item.id} style={styles.defaulter} onPress={() => openStudent(item)}>
              <View>
                <Text style={styles.subject}>{item.rollNumber}. {item.name}</Text>
                <Text style={styles.meta}>{item.present} classes attended out of {item.total} classes</Text>
              </View>
              <Text style={[styles.percent, { color: thresholdColor(item.attendance) }]}>{item.attendance}%</Text>
            </Pressable>
          )) : <Text style={styles.emptyText}>No defaulters yet.</Text>}
        </View>

        <View style={styles.chartPanel}>
          <View style={styles.headerRow}>
            <Text style={styles.panelTitle}>{periodLabel(period)} Graph</Text>
            <View style={styles.segmented}>
              {periods.map((item) => (
                <Pressable key={item.id} onPress={() => setPeriod(item.id)} style={[styles.segment, period === item.id && styles.activeSegment]}>
                  <Text style={[styles.segmentText, period === item.id && styles.activeSegmentText]}>{item.label}</Text>
                </Pressable>
              ))}
            </View>
          </View>
          {!hasAttendance ? <Text style={styles.emptyText}>{noAttendanceText}</Text> : graph.length ? graph.map((item) => (
            <View key={item.label} style={styles.trendRow}>
              <Text style={styles.month}>{item.label}</Text>
              <View style={styles.track}>
                <View style={[styles.fill, { width: `${item.percentage}%`, backgroundColor: thresholdColor(item.percentage) }]} />
              </View>
              <Text style={styles.trendPercent}>{item.percentage}%</Text>
            </View>
          )) : <Text style={styles.emptyText}>No graph data yet.</Text>}
        </View>
      </ScrollView>

      <Modal visible={Boolean(activeStudent)} animationType="slide" onRequestClose={() => setActiveStudent(null)}>
        <View style={styles.modal}>
          <View style={styles.modalHeader}>
            <View>
              <Text style={styles.modalTitle}>{activeStudent?.name}</Text>
              <Text style={styles.meta}>{activeStudent?.present} classes attended out of {activeStudent?.total} classes</Text>
            </View>
            <Pressable style={styles.closeButton} onPress={() => setActiveStudent(null)}>
              <Ionicons name="close" size={22} color={colors.text} />
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={styles.modalContent}>
            {studentRecords.length ? studentRecords.map((record) => (
              <View key={record.id} style={styles.recordRow}>
                <View style={styles.recordInfo}>
                  <Text style={styles.subject}>{formatDate(record.date)} / {recordSubjectLabel(record, paper)}</Text>
                  <Text style={styles.meta}>{record.topic ?? "Class record"}</Text>
                </View>
                <View style={styles.statusEditor}>
                  {statuses.map((status) => {
                    const active = record.status === status;
                    return (
                      <Pressable key={status} onPress={() => updateRecordStatus(record.id, status)} style={[styles.statusButton, active && { backgroundColor: statusColor(status), borderColor: statusColor(status) }]}>
                        <Text style={[styles.statusButtonText, active && styles.statusButtonTextActive]}>{statusLabel[status]}</Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            )) : <Text style={styles.emptyText}>No class records found for this student.</Text>}
          </ScrollView>
        </View>
      </Modal>
      <BottomNav />
    </View>
  );
}

function PieSegment({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <View style={styles.pieSegment}>
      <View style={[styles.pieCircle, { borderColor: color }]}>
        <Text style={[styles.pieValue, { color }]}>{value}</Text>
      </View>
      <Text style={styles.pieLabel}>{label}</Text>
    </View>
  );
}

function normalizeRecord(item: any): AttendanceRecord {
  return {
    id: item.id,
    studentId: item.studentId ?? item.student_id ?? "",
    subjectId: item.subjectId ?? item.subject_id ?? "",
    date: item.date ?? "",
    status: item.status ?? "ABSENT",
    remark: item.remark,
    subjectCode: item.subjectCode ?? item.subject_code,
    subjectName: item.subjectName ?? item.subject_name,
    classNumber: item.classNumber ?? item.class_number,
    topic: item.topic ?? item.topic_taught
  };
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

function filterStudentsForPaper(students: Student[], paper: Paper | undefined, records: AttendanceRecord[]) {
  if (!paper) return students;
  const ids = new Set(records.map((record) => record.studentId));
  const base = students.filter((student) => !paper.semesterId || student.semesterId === paper.semesterId || ids.has(student.id));
  return base.map((student) => {
    const own = records.filter((record) => record.studentId === student.id);
    if (!own.length) return { ...student, present: 0, absent: 0, late: 0, leave: 0, total: 0, attendance: 0 };
    const present = own.filter((record) => record.status === "PRESENT").length;
    return {
      ...student,
      present,
      absent: own.filter((record) => record.status === "ABSENT").length,
      late: own.filter((record) => record.status === "LATE").length,
      leave: own.filter((record) => record.status === "LEAVE").length,
      total: own.length,
      attendance: Math.round((present / own.length) * 100)
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

function periodLabel(period: Period) {
  if (period === "week") return "Week wise";
  if (period === "month") return "Month wise";
  return "Year wise";
}

function paperLabel(paper: Paper) {
  return `${paper.code} - ${paper.name}`;
}

function recordSubjectLabel(record: AttendanceRecord, paper: Paper | undefined) {
  const code = record.subjectCode ?? paper?.code;
  const name = record.subjectName ?? paper?.name;
  if (code && name) return `${code} - ${name}`;
  return code ?? name ?? "Paper";
}

function statusColor(status: AttendanceRecord["status"]) {
  if (status === "PRESENT") return colors.primary;
  if (status === "LATE") return colors.orange;
  if (status === "LEAVE") return "#2563eb";
  return colors.red;
}

function formatDate(raw: string) {
  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? raw : date.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

const styles = StyleSheet.create({
  shell: { flex: 1, backgroundColor: colors.surface },
  screen: { flex: 1, backgroundColor: colors.surface },
  content: { padding: spacing.lg, gap: 14, paddingBottom: 28 },
  hero: { backgroundColor: colors.card, borderRadius: 12, borderWidth: 1, borderColor: colors.border, padding: 20 },
  label: { color: colors.muted, fontWeight: "800" },
  overall: { fontSize: 54, fontWeight: "900", marginTop: 6 },
  meta: { color: colors.muted, marginTop: 5, fontWeight: "700" },
  note: { color: colors.orange, marginTop: 6, fontWeight: "800", fontSize: 12 },
  online: { color: colors.primaryDark, marginTop: 8, fontWeight: "900", fontSize: 12 },
  offline: { color: colors.orange, marginTop: 8, fontWeight: "900", fontSize: 12 },
  chartPanel: { backgroundColor: colors.card, borderRadius: 12, borderWidth: 1, borderColor: colors.border, padding: 16, gap: 12 },
  panelTitle: { color: colors.text, fontSize: 18, fontWeight: "900" },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { borderWidth: 1, borderColor: colors.border, backgroundColor: "#f8fafc", borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8 },
  paperChip: { maxWidth: "100%", borderRadius: 14 },
  activeChip: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { color: colors.text, fontWeight: "900" },
  paperChipText: { flexShrink: 1, lineHeight: 19 },
  activeChipText: { color: "#fff" },
  pieRow: { flexDirection: "row", justifyContent: "space-between", gap: 10 },
  pieSegment: { alignItems: "center", flex: 1 },
  pieCircle: { width: 78, height: 78, borderRadius: 39, borderWidth: 8, alignItems: "center", justifyContent: "center" },
  pieValue: { fontWeight: "900", fontSize: 18 },
  pieLabel: { color: colors.text, fontWeight: "800", marginTop: 8 },
  card: { borderBottomWidth: 1, borderBottomColor: colors.border, paddingBottom: 12 },
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 10 },
  studentBlock: { flex: 1 },
  subject: { color: colors.text, fontWeight: "900" },
  percent: { fontWeight: "900", fontSize: 14 },
  removeButton: { width: 36, height: 36, borderRadius: 18, borderWidth: 1, borderColor: colors.border, alignItems: "center", justifyContent: "center" },
  track: { height: 10, borderRadius: 999, backgroundColor: "#e2e8f0", marginTop: 10, flex: 1 },
  fill: { height: 10, borderRadius: 999 },
  headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },
  defaulter: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12, borderBottomWidth: 1, borderBottomColor: colors.border, paddingBottom: 12 },
  segmented: { flexDirection: "row", borderWidth: 1, borderColor: colors.border, borderRadius: 10, overflow: "hidden" },
  segment: { paddingHorizontal: 10, paddingVertical: 8, backgroundColor: "#f8fafc" },
  activeSegment: { backgroundColor: "#dcfce7" },
  segmentText: { color: colors.muted, fontWeight: "900", fontSize: 12 },
  activeSegmentText: { color: colors.primaryDark },
  trendRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  month: { width: 58, color: colors.text, fontWeight: "900" },
  trendPercent: { width: 44, textAlign: "right", color: colors.muted, fontWeight: "900" },
  emptyText: { color: colors.muted, fontWeight: "800", paddingVertical: 8 },
  modal: { flex: 1, backgroundColor: colors.surface, paddingTop: 28 },
  modalHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: spacing.lg, borderBottomWidth: 1, borderBottomColor: colors.border, backgroundColor: colors.card },
  modalTitle: { color: colors.text, fontWeight: "900", fontSize: 24 },
  closeButton: { width: 40, height: 40, borderRadius: 20, borderWidth: 1, borderColor: colors.border, alignItems: "center", justifyContent: "center" },
  modalContent: { padding: spacing.lg, gap: 10 },
  recordRow: { backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1, borderRadius: 12, padding: 14, gap: 10 },
  recordInfo: { gap: 2 },
  statusEditor: { flexDirection: "row", gap: 8 },
  statusButton: { width: 36, height: 36, borderRadius: 18, borderWidth: 1, borderColor: colors.border, alignItems: "center", justifyContent: "center" },
  statusButtonText: { color: colors.text, fontWeight: "900" },
  statusButtonTextActive: { color: "#fff" }
});
