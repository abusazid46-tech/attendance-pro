import { Ionicons } from "@expo/vector-icons";
import { useEffect, useMemo, useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { BottomNav } from "@/components/bottom-nav";
import { apiBackend } from "@/services/api-backend";
import { useBackendDashboard } from "@/services/app-data";
import { enqueueOfflineAttendance, syncOfflineAttendance } from "@/services/offline-attendance";
import { colors, spacing } from "@/theme";

const statuses = ["PRESENT", "ABSENT", "LATE", "LEAVE"] as const;
const statusLabels: Record<(typeof statuses)[number], string> = {
  PRESENT: "P",
  ABSENT: "A",
  LATE: "L",
  LEAVE: "I"
};
const statusColors: Record<(typeof statuses)[number], string> = {
  PRESENT: colors.primary,
  ABSENT: colors.red,
  LATE: colors.orange,
  LEAVE: "#2563eb"
};

export default function TakeAttendanceScreen() {
  const { data, online, refresh } = useBackendDashboard();
  const { papers, students, teacherProfile, ids, classSessions, masters } = data;
  const [selectedSemesterId, setSelectedSemesterId] = useState("");
  const [selectedPaperId, setSelectedPaperId] = useState("");
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().slice(0, 10));
  const [calendarMonth, setCalendarMonth] = useState(new Date().toISOString().slice(0, 7));
  const semesterPapers = useMemo(
    () => papers.filter((paper) => !selectedSemesterId || paper.semesterId === selectedSemesterId),
    [papers, selectedSemesterId]
  );
  const currentPaper = semesterPapers.find((paper) => paper.id === selectedPaperId) ?? semesterPapers[0] ?? papers[0];
  const attendanceStudents = useMemo(() => {
    if (!currentPaper) return [];
    const mapped = students.filter((student) => student.enrolledSubjectIds?.includes(currentPaper.id));
    if (mapped.length) return mapped;
    const strict = students.filter((student) => {
      const sameSection = currentPaper.sectionId ? student.sectionId === currentPaper.sectionId : true;
      const sameSemester = currentPaper.semesterId ? student.semesterId === currentPaper.semesterId : true;
      return sameSection && sameSemester;
    });
    if (strict.length) return strict;
    return students.filter((student) => !currentPaper.semesterId || student.semesterId === currentPaper.semesterId);
  }, [currentPaper, students]);
  const [topic, setTopic] = useState("");
  const [duration, setDuration] = useState("60");
  const [classNumber, setClassNumber] = useState("");
  const [classStarted, setClassStarted] = useState(false);
  const [records, setRecords] = useState<Record<string, (typeof statuses)[number]>>({});
  const [remarks, setRemarks] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const suggestedClassNumber = useMemo(() => {
    if (!currentPaper?.id) return 1;
    const numbers = classSessions
      .filter((item) => item.subjectId === currentPaper.id && (item.classDate ?? "").slice(0, 10) === selectedDate)
      .map((item) => Number(item.classNumber ?? 0))
      .filter((value) => Number.isFinite(value) && value > 0);
    return numbers.length ? Math.max(...numbers) + 1 : 1;
  }, [classSessions, currentPaper?.id, selectedDate]);

  useEffect(() => {
    if (!selectedSemesterId && masters.semesters[0]?.id) setSelectedSemesterId(masters.semesters[0].id);
  }, [masters.semesters, selectedSemesterId]);

  useEffect(() => {
    if (currentPaper?.id && selectedPaperId !== currentPaper.id) setSelectedPaperId(currentPaper.id);
  }, [currentPaper?.id, selectedPaperId]);

  useEffect(() => {
    if (online) syncOfflineAttendance().then(refresh).catch(() => undefined);
  }, [online]);

  useEffect(() => {
    if (/^\d{4}-\d{2}-\d{2}$/.test(selectedDate)) setCalendarMonth(selectedDate.slice(0, 7));
  }, [selectedDate]);

  useEffect(() => {
    setRecords((previous) => Object.fromEntries(attendanceStudents.map((student) => [student.id, previous[student.id] ?? "PRESENT"])));
  }, [attendanceStudents]);

  const summary = useMemo(
    () =>
      statuses.map((status) => ({
        status,
        count: Object.values(records).filter((item) => item === status).length
      })),
    [records]
  );

  const startAttendance = () => {
    if (!currentPaper?.id) {
      Alert.alert("Paper required", "Add a paper before taking attendance.");
      return;
    }
    if (!attendanceStudents.length) {
      Alert.alert("Students required", "Add students for the selected paper/semester before taking attendance.");
      return;
    }
    if (!topic.trim()) {
      Alert.alert("Topic required", "Enter the class topic before starting attendance.");
      return;
    }
    setClassStarted(true);
  };

  const submit = async () => {
    if (!currentPaper?.id || saving) return;
    if (!attendanceStudents.length) {
      Alert.alert("Students required", "No students are linked to this selected paper.");
      return;
    }
    setSaving(true);
    const date = selectedDate;
    const requestedClassNumber = Number(classNumber);
    const duplicateClassNumber = requestedClassNumber > 0 && classSessions.some((item) =>
      item.subjectId === currentPaper.id &&
      (item.classDate ?? "").slice(0, 10) === selectedDate &&
      Number(item.classNumber ?? 0) === requestedClassNumber
    );
    const effectiveClassNumber = !requestedClassNumber || duplicateClassNumber ? suggestedClassNumber : requestedClassNumber;
    const classPayload = {
      teacherId: ids.teacherId,
      academicSessionId: ids.academicSessionId,
      departmentId: currentPaper.departmentId ?? ids.departmentId,
      courseId: currentPaper.courseId ?? ids.courseId,
      semesterId: currentPaper.semesterId ?? ids.semesterId,
      sectionId: currentPaper.sectionId ?? ids.sectionId,
      subjectId: currentPaper.id,
      date,
      classNumber: effectiveClassNumber,
      topicTaught: topic,
      durationMinutes: Number(duration) || 60,
      assignmentGiven: "",
      observations: ""
    };

    const payload = {
      ...classPayload,
      classSessionId: undefined as string | undefined,
      records: attendanceStudents.map((student) => ({
        studentId: student.id,
        status: records[student.id] ?? "PRESENT",
        remark: remarks[student.id]
      }))
    };

    try {
      const classResponse = await apiBackend.createClassSession(classPayload);
      payload.classSessionId = classResponse.classSession.id;
      await apiBackend.submitAttendance(payload);
      await refresh();
      Alert.alert("Attendance submitted", "Class diary and attendance register updated.");
    } catch (error) {
      await enqueueOfflineAttendance({ classPayload, attendancePayload: payload });
      Alert.alert("Saved offline", "Attendance is saved in phone storage and will sync when the backend is reachable.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={styles.shell}>
      <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
        <View style={styles.panel}>
          <Text style={styles.kicker}>TAKE ATTENDANCE</Text>
          <Text style={styles.title}>{currentPaper ? `${currentPaper.code} / ${currentPaper.name}` : "Select paper"}</Text>
          <Text style={styles.meta}>Date: {formatDate(selectedDate)}</Text>
          <Text style={styles.meta}>{teacherProfile.academicSession} / {currentPaper?.semester ?? "Semester"}</Text>
          <Text style={online ? styles.online : styles.offline}>{online ? "Connected to backend" : "Backend unavailable"}</Text>

          <Text style={styles.label}>Semester</Text>
          <View style={styles.paperPicker}>
            {masters.semesters.length ? masters.semesters.map((semester) => {
              const active = selectedSemesterId === semester.id;
              return (
                <Pressable key={semester.id} onPress={() => setSelectedSemesterId(semester.id)} style={[styles.paperChip, active && styles.activePaperChip]}>
                  <Text style={[styles.paperChipText, active && styles.activePaperChipText]}>{semester.name}</Text>
                </Pressable>
              );
            }) : <Text style={styles.emptyText}>No semesters available. Add semesters in Academic Setup.</Text>}
          </View>

          <Text style={styles.label}>Paper / Subject</Text>
          <View style={styles.paperPicker}>
            {semesterPapers.length ? semesterPapers.map((paper) => {
              const active = currentPaper?.id === paper.id;
              return (
                <Pressable key={paper.id} onPress={() => setSelectedPaperId(paper.id)} style={[styles.paperChip, active && styles.activePaperChip]}>
                  <Text style={[styles.paperChipText, active && styles.activePaperChipText]}>{paper.code} - {paper.name}</Text>
                </Pressable>
              );
            }) : <Text style={styles.emptyText}>No papers available. Add papers in Academic Setup.</Text>}
          </View>

          <Text style={styles.label}>Date</Text>
          <TextInput value={selectedDate} onChangeText={setSelectedDate} style={styles.input} placeholder="YYYY-MM-DD" placeholderTextColor={colors.muted} />
          <View style={styles.calendarPanel}>
            <View style={styles.calendarHeader}>
              <Pressable style={styles.monthButton} onPress={() => setCalendarMonth(moveMonth(calendarMonth, -1))}>
                <Ionicons name="chevron-back" size={18} color={colors.primaryDark} />
              </Pressable>
              <Text style={styles.calendarTitle}>{formatMonth(calendarMonth)}</Text>
              <Pressable style={styles.monthButton} onPress={() => setCalendarMonth(moveMonth(calendarMonth, 1))}>
                <Ionicons name="chevron-forward" size={18} color={colors.primaryDark} />
              </Pressable>
              <Pressable style={styles.todayButton} onPress={() => setSelectedDate(new Date().toISOString().slice(0, 10))}>
                <Text style={styles.todayText}>Today</Text>
              </Pressable>
            </View>
            <View style={styles.calendarGrid}>
              {buildMonthDates(calendarMonth).map((date) => {
                const active = date.value === selectedDate;
                return (
                  <Pressable key={date.value} onPress={() => setSelectedDate(date.value)} style={[styles.dateChip, active && styles.activeDateChip]}>
                    <Text style={[styles.dateDay, active && styles.activeDateText]}>{date.day}</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          <View style={styles.formRow}>
            <Field label="Class Number" value={classNumber} onChangeText={setClassNumber} keyboardType="number-pad" />
            <Field label="Duration" value={duration} onChangeText={setDuration} keyboardType="number-pad" suffix="min" />
          </View>
          <Text style={styles.label}>Topic Taught</Text>
          <TextInput value={topic} onChangeText={setTopic} style={styles.input} placeholder="" placeholderTextColor={colors.muted} />
          {!classStarted ? (
            <Pressable style={styles.submit} onPress={startAttendance}>
              <Text style={styles.submitText}>START ATTENDANCE</Text>
            </Pressable>
          ) : null}
        </View>

        {classStarted ? <>
          <View style={styles.stageHeader}>
            <Text style={styles.kicker}>Stage 6 / Attendance Screen</Text>
            <Text style={styles.legend}>P Present / A Absent / L Late / I Leave Informed</Text>
          </View>

          <View style={styles.summaryRow}>
            {summary.map((item) => (
              <View key={item.status} style={styles.summaryChip}>
                <View style={[styles.summaryDot, { backgroundColor: statusColors[item.status] }]} />
                <Text style={styles.summaryText}>{statusLabels[item.status]} {item.count}</Text>
              </View>
            ))}
          </View>

          {attendanceStudents.length ? attendanceStudents.map((student) => (
            <View key={student.id} style={styles.student}>
              <View style={styles.studentHeader}>
                <View style={styles.studentInfo}>
                  <Text style={styles.roll}>Roll {student.rollNumber}</Text>
                  <Text style={styles.studentName}>{student.name}</Text>
                </View>
                <View style={styles.statuses}>
                  {statuses.map((status) => {
                    const active = records[student.id] === status;
                    return (
                      <Pressable
                        key={status}
                        onPress={() => setRecords((prev) => ({ ...prev, [student.id]: status }))}
                        style={[styles.status, active && { backgroundColor: statusColors[status], borderColor: statusColors[status] }]}
                      >
                        <Text style={[styles.statusText, active && styles.activeText]}>{statusLabels[status]}</Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
              {records[student.id] !== "PRESENT" && (
                <TextInput
                  value={remarks[student.id] ?? student.remark}
                  onChangeText={(value) => setRemarks((prev) => ({ ...prev, [student.id]: value }))}
                  style={styles.remark}
                  placeholder="Remark: Medical Leave / NCC Camp / Sports Event"
                  placeholderTextColor={colors.muted}
                />
              )}
            </View>
          )) : <Text style={styles.emptyText}>No students available. Add students in Academic Setup.</Text>}

          <Pressable style={[styles.submit, saving && styles.disabled]} onPress={submit} disabled={saving}>
            <Text style={styles.submitText}>{saving ? "Submitting..." : "Submit Attendance"}</Text>
          </Pressable>
        </> : null}
      </ScrollView>
      <BottomNav />
    </View>
  );
}

function formatDate(raw: string) {
  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? raw : date.toLocaleDateString("en-IN", { day: "2-digit", month: "long", year: "numeric" });
}

function moveMonth(monthKey: string, delta: number) {
  const [year, month] = monthKey.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1 + delta, 1)).toISOString().slice(0, 7);
}

function formatMonth(monthKey: string) {
  const [year, month] = monthKey.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, 1)).toLocaleDateString("en-IN", { month: "long", year: "numeric" });
}

function buildMonthDates(monthKey: string) {
  const [year, month] = monthKey.split("-").map(Number);
  const daysInMonth = new Date(year, month, 0).getDate();
  return Array.from({ length: daysInMonth }, (_, index) => {
    const day = index + 1;
    const date = new Date(Date.UTC(year, month - 1, day));
    return {
      value: date.toISOString().slice(0, 10),
      day: String(day).padStart(2, "0")
    };
  });
}

function Field({
  label,
  value,
  onChangeText,
  keyboardType,
  suffix
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  keyboardType?: "default" | "number-pad";
  suffix?: string;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.inputWrap}>
        <TextInput value={value} onChangeText={onChangeText} keyboardType={keyboardType} style={styles.inlineInput} placeholderTextColor={colors.muted} />
        {suffix ? <Text style={styles.suffix}>{suffix}</Text> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  shell: { flex: 1, backgroundColor: colors.surface },
  screen: { flex: 1, backgroundColor: colors.surface },
  content: { padding: spacing.lg, gap: 12, paddingBottom: 28 },
  panel: { backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1, borderRadius: 12, padding: 16 },
  kicker: { color: colors.primaryDark, fontWeight: "900", fontSize: 12, textTransform: "uppercase" },
  title: { color: colors.text, fontSize: 20, fontWeight: "900", marginTop: 6, lineHeight: 26 },
  meta: { color: colors.muted, marginTop: 4, fontWeight: "700" },
  online: { color: colors.primaryDark, marginTop: 6, fontWeight: "900", fontSize: 12 },
  offline: { color: colors.orange, marginTop: 6, fontWeight: "900", fontSize: 12 },
  formRow: { flexDirection: "row", gap: 12, marginTop: 16 },
  field: { flex: 1 },
  label: { color: colors.muted, fontWeight: "800", marginBottom: 8, marginTop: 10 },
  inputWrap: { flexDirection: "row", alignItems: "center", backgroundColor: "#f8fafc", borderColor: colors.border, borderWidth: 1, borderRadius: 10, paddingHorizontal: 12 },
  input: { backgroundColor: "#f8fafc", borderColor: colors.border, borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 12, color: colors.text, fontWeight: "800" },
  inlineInput: { flex: 1, paddingVertical: 12, color: colors.text, fontWeight: "900" },
  suffix: { color: colors.muted, fontWeight: "800" },
  summaryRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  paperPicker: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  paperChip: { borderWidth: 1, borderColor: colors.border, backgroundColor: "#f8fafc", borderRadius: 14, paddingHorizontal: 12, paddingVertical: 8, maxWidth: "100%" },
  activePaperChip: { backgroundColor: colors.primary, borderColor: colors.primary },
  paperChipText: { color: colors.text, fontWeight: "900", flexShrink: 1, lineHeight: 19 },
  activePaperChipText: { color: "#fff" },
  calendarPanel: { marginTop: 10, borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: 10, backgroundColor: "#ffffff" },
  calendarHeader: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 10 },
  monthButton: { width: 36, height: 34, borderWidth: 1, borderColor: colors.border, borderRadius: 9, alignItems: "center", justifyContent: "center", backgroundColor: "#f8fafc" },
  calendarTitle: { flex: 1, color: colors.text, fontWeight: "900" },
  todayButton: { borderWidth: 1, borderColor: "#bbf7d0", backgroundColor: "#f0fdf4", borderRadius: 999, paddingHorizontal: 10, paddingVertical: 7 },
  todayText: { color: colors.primaryDark, fontWeight: "900", fontSize: 12 },
  calendarGrid: { flexDirection: "row", flexWrap: "wrap", gap: 7 },
  dateChip: { width: 38, height: 34, borderWidth: 1, borderColor: colors.border, borderRadius: 9, alignItems: "center", justifyContent: "center", backgroundColor: "#f8fafc" },
  activeDateChip: { backgroundColor: colors.primary, borderColor: colors.primary },
  dateDay: { color: colors.text, fontWeight: "900", fontSize: 12 },
  activeDateText: { color: "#fff" },
  stageHeader: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: 14, gap: 4 },
  legend: { color: colors.muted, fontWeight: "800" },
  summaryChip: { flexDirection: "row", alignItems: "center", gap: 7, backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8 },
  summaryDot: { width: 8, height: 8, borderRadius: 4 },
  summaryText: { color: colors.text, fontWeight: "900" },
  student: { backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1, borderRadius: 12, padding: 14 },
  studentHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 12 },
  studentInfo: { flex: 1 },
  studentName: { fontWeight: "900", color: colors.text, fontSize: 16 },
  roll: { color: colors.muted, marginTop: 4, fontWeight: "700" },
  statuses: { flexDirection: "row", gap: 6 },
  status: { width: 34, height: 34, borderRadius: 17, borderWidth: 1, borderColor: colors.border, alignItems: "center", justifyContent: "center" },
  statusText: { color: colors.text, fontWeight: "900" },
  activeText: { color: "#fff" },
  remark: { marginTop: 12, backgroundColor: "#f8fafc", borderColor: colors.border, borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, color: colors.text, fontWeight: "700" },
  submit: { backgroundColor: colors.primary, padding: 16, borderRadius: 12, alignItems: "center", marginTop: 8 },
  submitText: { color: "#fff", fontWeight: "900", fontSize: 16 },
  disabled: { opacity: 0.65 },
  emptyText: { color: colors.muted, fontWeight: "800", paddingVertical: 8 }
});
