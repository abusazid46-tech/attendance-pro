import { Ionicons } from "@expo/vector-icons";
import { useEffect, useMemo, useState } from "react";
import { Alert, Pressable, ScrollView, Share, StyleSheet, Text, TextInput, View } from "react-native";
import { BottomNav } from "@/components/bottom-nav";
import { apiBackend } from "@/services/api-backend";
import { useBackendDashboard, type AttendanceRecord, type Paper, type Student } from "@/services/app-data";
import { saveAndShareReport } from "@/services/report-download";
import { buildClientExcelReport } from "@/services/client-pdf";
import { colors, spacing, thresholdColor } from "@/theme";

const reportTypes = [
  "Daily Attendance Register",
  "Monthly Attendance Summary",
  "Subject-wise Attendance",
  "Student Wise Report",
  "Teaching Diary",
  "Defaulter List"
];

export default function ReportsScreen() {
  const { data, online } = useBackendDashboard();
  const { papers, students, masters, attendanceRecords } = data;
  const [selected, setSelected] = useState(reportTypes[5]);
  const [selectedSemesterId, setSelectedSemesterId] = useState("");
  const [selectedPaperId, setSelectedPaperId] = useState("");
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);
  const [startDate, setStartDate] = useState(monthStartDate());
  const [endDate, setEndDate] = useState(todayDate());
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    if (!selectedSemesterId && masters.semesters[0]?.id) setSelectedSemesterId(masters.semesters[0].id);
  }, [masters.semesters, selectedSemesterId]);

  const semesterPapers = useMemo(
    () => papers.filter((paper) => !selectedSemesterId || paper.semesterId === selectedSemesterId),
    [papers, selectedSemesterId]
  );
  const selectedSemester = masters.semesters.find((item) => item.id === selectedSemesterId);
  const paper = semesterPapers.find((item) => item.id === selectedPaperId) ?? semesterPapers[0];

  useEffect(() => {
    if (paper?.id && selectedPaperId !== paper.id) setSelectedPaperId(paper.id);
  }, [paper?.id, selectedPaperId]);

  const filteredRecords = useMemo(
    () => attendanceRecords.filter((record) => {
      const inPaper = paper?.id ? record.subjectId === paper.id : false;
      const inDate = (!startDate || record.date >= startDate) && (!endDate || record.date <= endDate);
      return inPaper && inDate;
    }),
    [attendanceRecords, endDate, paper?.id, startDate]
  );
  const reportStudents = useMemo(
    () => filterStudentsForSelection(students, paper, selectedSemesterId, filteredRecords),
    [students, paper, selectedSemesterId, filteredRecords]
  );
  const defaulters = reportStudents.filter((item) => item.total > 0 && item.attendance < 75);
  const selectedStudents = reportStudents.filter((item) => selectedStudentIds.includes(item.id));
  const shareTargets = selectedStudents.length ? selectedStudents : defaulters;

  const generateExcelReport = async () => {
    if (!semesterPapers.length) {
      Alert.alert("Paper required", "Add a paper before generating reports.");
      return;
    }
    if (!paper?.id) {
      Alert.alert("Select paper", "Select one paper before generating a report.");
      return;
    }
    try {
      setGenerating(true);
      let reportFile: { fileName: string; mimeType: string; encoding: string; contentBase64: string } | undefined;

      if (online) {
        try {
          reportFile = await apiBackend.generateReport({
            type: reportTypeCode(selected),
            format: "EXCEL",
            title: selected,
            filters: {
              subjectId: paper?.id,
              subjectCode: paper?.code,
              subjectName: paper?.name,
              semesterId: selectedSemesterId,
              semester: selectedSemester?.name ?? paper?.semester,
              startDate,
              endDate,
              studentIds: selectedStudentIds
            }
          });
        } catch {
          // Backend did not respond or failed; seamless client fallback below
        }
      }

      if (!reportFile) {
        const clientOptions = {
          title: selected,
          type: reportTypeCode(selected),
          paper,
          semesterName: selectedSemester?.name ?? paper?.semester,
          teacherName: data.teacherProfile?.name,
          startDate,
          endDate,
          students: reportStudents,
          records: filteredRecords,
          classSessions: data.classSessions
        };
        reportFile = buildClientExcelReport(clientOptions);
      }

      const saved = await saveAndShareReport(reportFile);
      Alert.alert("Report Ready", `${reportFile.fileName} is ready and opened for sharing or printing.\n${saved.uri}`);
    } catch (error) {
      Alert.alert("Report failed", error instanceof Error ? error.message : "Could not generate this report.");
    } finally {
      setGenerating(false);
    }
  };

  const shareReport = async (channel: string) => {
    if (!semesterPapers.length) {
      Alert.alert("Paper required", "Add a paper before sharing reports.");
      return;
    }
    if (!paper?.id) {
      Alert.alert("Select paper", "Select one paper before sharing a report.");
      return;
    }
    const message = buildShareMessage(shareTargets, paper, selected);
    if (!shareTargets.length) {
      Alert.alert("No students selected", "Select one or more defaulters or students before sharing.");
      return;
    }
    try {
      await Share.share({ title: `${selected} - ${channel}`, message });
    } catch {
      Alert.alert("Share unavailable", message);
    }
  };

  const toggleStudent = (studentId: string) => {
    setSelectedStudentIds((current) => current.includes(studentId) ? current.filter((id) => id !== studentId) : [...current, studentId]);
  };

  return (
    <View style={styles.shell}>
      <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
        <View style={styles.panel}>
          <Text style={styles.title}>Download Reports</Text>
          <Text style={styles.meta}>{paper ? paperLabel(paper) : `${selectedSemester?.name ?? "Semester"} / Select one paper`}</Text>
          <Text style={online ? styles.online : styles.offline}>{online ? "Connected to backend" : "Backend offline"}</Text>
        </View>

        <View style={styles.panel}>
          <Text style={styles.panelTitle}>Choose Semester and Paper</Text>
          <View style={styles.chipRow}>
            {masters.semesters.length ? masters.semesters.map((semester) => (
              <Pressable key={semester.id} onPress={() => setSelectedSemesterId(semester.id)} style={[styles.chip, selectedSemesterId === semester.id && styles.activeChip]}>
                <Text style={[styles.chipText, selectedSemesterId === semester.id && styles.activeChipText]}>{semester.name}</Text>
              </Pressable>
            )) : <Text style={styles.emptyText}>No semesters added yet.</Text>}
          </View>
          <View style={styles.chipRow}>
            {semesterPapers.length ? (
              <>
                <View style={styles.listLabel}>
                  <Ionicons name="list-outline" size={16} color={colors.primaryDark} />
                  <Text style={styles.listLabelText}>List of Papers</Text>
                </View>
                {semesterPapers.map((item) => (
                  <Pressable key={item.id} onPress={() => setSelectedPaperId(item.id)} style={[styles.chip, styles.paperChip, paper?.id === item.id && styles.activeChip]}>
                    <Text style={[styles.chipText, styles.paperChipText, paper?.id === item.id && styles.activeChipText]}>{paperLabel(item)}</Text>
                  </Pressable>
                ))}
              </>
            ) : <Text style={styles.emptyText}>No papers for this semester.</Text>}
          </View>
          <View style={styles.dateRow}>
            <View style={styles.dateField}>
              <Text style={styles.dateLabel}>From</Text>
              <TextInput value={startDate} onChangeText={setStartDate} style={styles.dateInput} placeholder="YYYY-MM-DD" placeholderTextColor={colors.muted} />
            </View>
            <View style={styles.dateField}>
              <Text style={styles.dateLabel}>To</Text>
              <TextInput value={endDate} onChangeText={setEndDate} style={styles.dateInput} placeholder="YYYY-MM-DD" placeholderTextColor={colors.muted} />
            </View>
          </View>
        </View>

        {reportTypes.map((item) => {
          const active = selected === item;
          return (
            <Pressable key={item} style={[styles.reportType, active && styles.activeReport]} onPress={() => setSelected(item)}>
              <Ionicons name={active ? "radio-button-on" : "radio-button-off"} size={21} color={active ? colors.primary : colors.muted} />
              <Text style={[styles.reportText, active && styles.activeReportText]}>{item}</Text>
            </Pressable>
          );
        })}

        <View style={styles.buttonRow}>
          <Pressable style={[styles.primaryButton, generating && styles.disabled]} onPress={generateExcelReport} disabled={generating}>
            <Ionicons name="grid-outline" size={18} color="#fff" />
            <Text style={styles.primaryText}>{generating ? "Generating Excel Report..." : "Generate Excel Report"}</Text>
          </Pressable>
        </View>

        <View style={styles.panel}>
          <Text style={styles.panelTitle}>Student Wise Report</Text>
          {reportStudents.length ? reportStudents.map((item) => (
            <StudentRow key={item.id} item={item} selected={selectedStudentIds.includes(item.id)} onPress={() => toggleStudent(item.id)} />
          )) : <Text style={styles.emptyText}>No student records yet.</Text>}
        </View>

        <View style={styles.panel}>
          <Text style={styles.panelTitle}>Defaulters</Text>
          {defaulters.length ? defaulters.map((item) => (
            <StudentRow key={item.id} item={item} selected={selectedStudentIds.includes(item.id)} onPress={() => toggleStudent(item.id)} />
          )) : <Text style={styles.emptyText}>No low-attendance students yet.</Text>}
        </View>

        <View style={styles.panel}>
          <Text style={styles.panelTitle}>Share Report</Text>
          <Text style={styles.message}>{buildShareMessage(shareTargets.slice(0, 3), paper, selected)}</Text>
          <View style={styles.channelRow}>
            {["WhatsApp", "Email", "Telegram"].map((item) => (
              <Pressable key={item} style={styles.channel} onPress={() => shareReport(item)}>
                <Ionicons name={item === "Email" ? "mail" : item === "Telegram" ? "send" : "logo-whatsapp"} size={18} color={colors.primaryDark} />
                <Text style={styles.channelText}>{item}</Text>
              </Pressable>
            ))}
          </View>
        </View>
      </ScrollView>
      <BottomNav />
    </View>
  );
}

function StudentRow({ item, selected, onPress }: { item: Student; selected: boolean; onPress: () => void }) {
  return (
    <Pressable style={[styles.studentRow, selected && styles.selectedStudent]} onPress={onPress}>
      <Ionicons name={selected ? "checkbox" : "square-outline"} size={22} color={selected ? colors.primary : colors.muted} />
      <View style={styles.studentInfo}>
        <Text style={styles.student}>{item.rollNumber}. {item.name}</Text>
        <Text style={styles.meta}>{item.present} classes attended out of {item.total} classes</Text>
      </View>
      <Text style={[styles.percent, { color: thresholdColor(item.attendance) }]}>{item.attendance}%</Text>
    </Pressable>
  );
}

function filterStudentsForSelection(students: Student[], paper: Paper | undefined, semesterId: string, records: AttendanceRecord[]) {
  if (!paper) {
    const base = semesterId ? students.filter((student) => student.semesterId === semesterId) : students;
    return records.length ? base.map((student) => withPaperAttendance(student, records)) : base;
  }
  const mapped = students.filter((student) => student.enrolledSubjectIds?.includes(paper.id));
  if (mapped.length) {
    return mapped.map((student) => withPaperAttendance(student, records));
  }
  const ids = new Set(records.map((record) => record.studentId));
  const base = students.filter((student) => !paper.semesterId || student.semesterId === paper.semesterId || ids.has(student.id));
  return base.map((student) => withPaperAttendance(student, records));
}

function withPaperAttendance(student: Student, records: AttendanceRecord[]) {
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
}

function buildShareMessage(students: Student[], paper: Paper | undefined, reportType: string) {
  const paperText = paper ? paperLabel(paper) : "Select one paper";
  if (!students.length) return "Select students to share an individual report.";
  const lines = students.map((student) => `${student.rollNumber}. ${student.name}: ${student.present} classes attended out of ${student.total} classes (${student.attendance}%)`);
  return `${reportType}\n${paperText}\n${paper?.semester ?? ""}\n\n${lines.join("\n")}`;
}

function paperLabel(paper: Paper) {
  return `${paper.code} - ${paper.name}`;
}

function reportTypeCode(label: string) {
  if (label.includes("Daily")) return "DAILY";
  if (label.includes("Monthly")) return "MONTHLY";
  if (label.includes("Subject")) return "SUBJECT";
  if (label.includes("Student")) return "STUDENT";
  if (label.includes("Diary")) return "TEACHING_DIARY";
  if (label.includes("Defaulter")) return "DEFAULTER";
  return "SUBJECT";
}

function todayDate() {
  return new Date().toISOString().slice(0, 10);
}

function monthStartDate() {
  const date = new Date();
  date.setDate(1);
  return date.toISOString().slice(0, 10);
}

const styles = StyleSheet.create({
  shell: { flex: 1, backgroundColor: colors.surface },
  screen: { flex: 1, backgroundColor: colors.surface },
  content: { padding: spacing.lg, gap: 12, paddingBottom: 28 },
  panel: { backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1, borderRadius: 12, padding: 16, gap: 10 },
  title: { color: colors.text, fontSize: 24, fontWeight: "900" },
  meta: { color: colors.muted, fontWeight: "700" },
  online: { color: colors.primaryDark, fontWeight: "900", fontSize: 12 },
  offline: { color: colors.orange, fontWeight: "900", fontSize: 12 },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { borderWidth: 1, borderColor: colors.border, backgroundColor: "#f8fafc", borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8 },
  paperChip: { maxWidth: "100%", borderRadius: 14 },
  listLabel: { flexDirection: "row", alignItems: "center", gap: 5, borderWidth: 1, borderColor: "#bbf7d0", backgroundColor: "#f0fdf4", borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8 },
  listLabelText: { color: colors.primaryDark, fontWeight: "900" },
  activeChip: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { color: colors.text, fontWeight: "900" },
  paperChipText: { flexShrink: 1, lineHeight: 19 },
  activeChipText: { color: "#fff" },
  dateRow: { flexDirection: "row", gap: 10 },
  dateField: { flex: 1 },
  dateLabel: { color: colors.text, fontWeight: "900", marginBottom: 6 },
  dateInput: { minHeight: 46, borderWidth: 1, borderColor: colors.border, backgroundColor: "#f8fafc", borderRadius: 10, paddingHorizontal: 10, color: colors.text, fontWeight: "800" },
  reportType: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1, borderRadius: 12, padding: 14 },
  activeReport: { borderColor: colors.primary, backgroundColor: "#f0fdf4" },
  reportText: { color: colors.text, fontWeight: "800", flex: 1 },
  activeReportText: { color: colors.primaryDark },
  buttonRow: { flexDirection: "row", gap: 12 },
  primaryButton: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7, backgroundColor: colors.primary, borderRadius: 12, padding: 15 },
  primaryText: { color: "#fff", fontWeight: "900" },
  secondaryButton: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7, borderWidth: 1, borderColor: colors.primary, borderRadius: 12, padding: 15 },
  secondaryText: { color: colors.primaryDark, fontWeight: "900" },
  disabled: { opacity: 0.6 },
  panelTitle: { color: colors.text, fontSize: 18, fontWeight: "900" },
  studentRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 10, borderBottomWidth: 1, borderBottomColor: colors.border, paddingVertical: 10 },
  selectedStudent: { backgroundColor: "#f0fdf4", borderRadius: 10, paddingHorizontal: 8 },
  studentInfo: { flex: 1 },
  student: { color: colors.text, fontWeight: "900" },
  percent: { fontWeight: "900", fontSize: 17 },
  message: { color: colors.text, fontWeight: "700", lineHeight: 22, backgroundColor: "#f8fafc", borderRadius: 10, padding: 12 },
  emptyText: { color: colors.muted, fontWeight: "800", paddingVertical: 8 },
  channelRow: { flexDirection: "row", gap: 8 },
  channel: { flex: 1, alignItems: "center", gap: 6, borderColor: colors.border, borderWidth: 1, borderRadius: 10, padding: 12 },
  channelText: { color: colors.text, fontWeight: "800", fontSize: 12 }
});
