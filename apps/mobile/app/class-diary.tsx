import AsyncStorage from "@react-native-async-storage/async-storage";
import { Ionicons } from "@expo/vector-icons";
import { useEffect, useMemo, useState } from "react";
import { Alert, Pressable, ScrollView, Share, StyleSheet, Text, TextInput, View } from "react-native";
import { BottomNav } from "@/components/bottom-nav";
import { apiBackend } from "@/services/api-backend";
import { useBackendDashboard, type AttendanceRecord, type Paper } from "@/services/app-data";
import { colors, spacing } from "@/theme";

type DiaryEntry = {
  id: string;
  date: string;
  semesterId?: string;
  semesterName?: string;
  paperId?: string;
  paperCode?: string;
  paperName?: string;
  classNumber: string;
  topic: string;
  assignment: string;
  notes: string;
  observations: string;
  createdAt: string;
  present?: number;
  absent?: number;
};

const diaryKey = "attendance.classDiary.entries";

export default function ClassDiaryScreen() {
  const { data, online, refresh } = useBackendDashboard();
  const { attendanceRecords, classSessions, papers, masters, ids } = data;
  const [entries, setEntries] = useState<DiaryEntry[]>([]);
  const [selectedDate, setSelectedDate] = useState(toApiDate(new Date()));
  const [calendarMonth, setCalendarMonth] = useState(toMonthKey(new Date()));
  const [selectedSemesterId, setSelectedSemesterId] = useState("");
  const [selectedPaperId, setSelectedPaperId] = useState("");
  const [topic, setTopic] = useState("");
  const [classNumber, setClassNumber] = useState("");
  const [assignment, setAssignment] = useState("");
  const [notes, setNotes] = useState("");
  const [observations, setObservations] = useState("");

  useEffect(() => {
    AsyncStorage.getItem(diaryKey)
      .then((value) => setEntries(value ? JSON.parse(value) : []))
      .catch(() => setEntries([]));
  }, []);

  useEffect(() => {
    if (!selectedSemesterId && masters.semesters[0]?.id) setSelectedSemesterId(masters.semesters[0].id);
  }, [masters.semesters, selectedSemesterId]);

  const semesterPapers = useMemo(
    () => papers.filter((paper) => !selectedSemesterId || paper.semesterId === selectedSemesterId),
    [papers, selectedSemesterId]
  );
  const paper = semesterPapers.find((item) => item.id === selectedPaperId) ?? semesterPapers[0] ?? papers[0];
  const selectedSemester = masters.semesters.find((item) => item.id === selectedSemesterId) ?? masters.semesters[0];
  const selectedEntry = entries.find((item) => item.date === selectedDate && (!paper?.id || item.paperId === paper.id));
  const dates = useMemo(() => buildCalendarDates(entries, calendarMonth), [entries, calendarMonth]);
  const attendanceSummary = useMemo(
    () => diaryAttendanceSummary(attendanceRecords, paper?.id, selectedDate, classNumber),
    [attendanceRecords, classNumber, paper?.id, selectedDate]
  );

  useEffect(() => {
    if (paper?.id && selectedPaperId !== paper.id) setSelectedPaperId(paper.id);
  }, [paper?.id, selectedPaperId]);

  useEffect(() => {
    if (/^\d{4}-\d{2}-\d{2}$/.test(selectedDate)) setCalendarMonth(selectedDate.slice(0, 7));
  }, [selectedDate]);

  useEffect(() => {
    const entry = selectedEntry;
    setTopic(entry?.topic ?? "");
    setClassNumber(entry?.classNumber ?? nextClassNumber(classSessions, paper, selectedDate));
    setAssignment(entry?.assignment ?? "");
    setNotes(entry?.notes ?? "");
    setObservations(entry?.observations ?? "");
  }, [classSessions, paper?.id, selectedDate, selectedEntry?.id]);

  const generateNotes = () => {
    if (!topic.trim()) {
      Alert.alert("Topic required", "Enter the topic discussed before generating notes.");
      return;
    }
    setNotes([
      "Key points discussed:",
      `- Meaning and scope of ${topic.trim()}.`,
      "- Important definitions, examples, and classroom discussion points.",
      "- Practical relevance for examination and professional use.",
      "",
      "Suggested follow-up:",
      "- Revise the core concepts before the next class.",
      assignment.trim() ? `- Complete: ${assignment.trim()}` : "- Prepare two short questions from today's topic."
    ].join("\n"));
  };

  const save = async () => {
    if (!paper?.id) {
      Alert.alert("Paper required", "Select semester and paper before saving the diary.");
      return;
    }
    if (!topic.trim()) {
      Alert.alert("Topic required", "Enter the topic taught before saving.");
      return;
    }

    const entry: DiaryEntry = {
      id: selectedEntry?.id ?? `${selectedDate}-${paper.id}-${Date.now()}`,
      date: selectedDate,
      semesterId: selectedSemester?.id,
      semesterName: selectedSemester?.name ?? paper.semester,
      paperId: paper.id,
      paperCode: paper.code,
      paperName: paper.name,
      classNumber: classNumber || "1",
      topic,
      assignment,
      notes,
      observations,
      present: attendanceSummary.present,
      absent: attendanceSummary.absent,
      createdAt: selectedEntry?.createdAt ?? new Date().toISOString()
    };

    const next = [entry, ...entries.filter((item) => item.id !== entry.id)];
    await AsyncStorage.setItem(diaryKey, JSON.stringify(next));
    setEntries(next);

    try {
      await apiBackend.createClassSession({
        teacherId: ids.teacherId,
        academicSessionId: ids.academicSessionId,
        departmentId: paper.departmentId ?? ids.departmentId,
        courseId: paper.courseId ?? ids.courseId,
        semesterId: paper.semesterId ?? ids.semesterId,
        sectionId: paper.sectionId ?? ids.sectionId,
        subjectId: paper.id,
        date: selectedDate,
        classNumber: Number(classNumber) || 1,
        topicTaught: topic,
        durationMinutes: 60,
        assignmentGiven: assignment,
        notes,
        observations
      });
      await refresh();
      Alert.alert("Diary saved", "Saved in phone storage and synced with the backend.");
    } catch {
      Alert.alert("Diary saved in phone", "Backend sync will be possible when the network is available.");
    }
  };

  const shareNotes = async () => {
    const message = buildShareText(selectedEntry ?? {
      id: "draft",
      date: selectedDate,
      paperCode: paper?.code,
      paperName: paper?.name,
      semesterName: selectedSemester?.name ?? paper?.semester,
      classNumber,
      topic,
      assignment,
      notes,
      observations,
      present: attendanceSummary.present,
      absent: attendanceSummary.absent,
      createdAt: new Date().toISOString()
    });
    try {
      await Share.share({ title: "Class diary notes", message });
    } catch {
      Alert.alert("Share unavailable", message);
    }
  };

  return (
    <View style={styles.shell}>
      <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
        <View style={styles.panel}>
          <View style={styles.headerRow}>
            <Ionicons name="book" size={26} color={colors.primary} />
            <View style={styles.headerText}>
              <Text style={styles.title}>Class Diary</Text>
              <Text style={styles.meta}>Saved diary entries are listed below and synced with backend when online.</Text>
              <Text style={online ? styles.online : styles.offline}>{online ? "Connected to backend" : "Backend offline"}</Text>
            </View>
          </View>
        </View>

        <View style={styles.panel}>
          <View style={styles.calendarHeader}>
            <Pressable style={styles.monthButton} onPress={() => setCalendarMonth(moveMonth(calendarMonth, -1))}>
              <Ionicons name="chevron-back" size={18} color={colors.primaryDark} />
            </Pressable>
            <Text style={styles.panelTitle}>{formatMonth(calendarMonth)}</Text>
            <Pressable style={styles.monthButton} onPress={() => setCalendarMonth(moveMonth(calendarMonth, 1))}>
              <Ionicons name="chevron-forward" size={18} color={colors.primaryDark} />
            </Pressable>
          </View>
          <View style={styles.calendarGrid}>
            {dates.map((date) => {
              const active = date.value === selectedDate;
              const hasEntry = entries.some((item) => item.date === date.value);
              return (
                <Pressable key={date.value} onPress={() => setSelectedDate(date.value)} style={[styles.dateChip, active && styles.activeDateChip, hasEntry && styles.entryDateChip]}>
                  <Text style={[styles.dateDay, active && styles.activeDateText]}>{date.day}</Text>
                  <Text style={[styles.dateMonth, active && styles.activeDateText]}>{date.month}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <View style={styles.panel}>
          <Text style={styles.panelTitle}>Semester and Paper</Text>
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

        <Field label="Date" value={selectedDate} onChangeText={setSelectedDate} />
        <Field label="Class Number" value={classNumber} onChangeText={setClassNumber} keyboardType="number-pad" />
        <Field label="Topic Taught" value={topic} onChangeText={setTopic} />
        <Field label="Assignment Given" value={assignment} onChangeText={setAssignment} multiline />
        <Field label="Notes" value={notes} onChangeText={setNotes} multiline />
        <Field label="Important Observations" value={observations} onChangeText={setObservations} multiline />

        <View style={styles.buttonRow}>
          <Pressable style={styles.secondaryButton} onPress={generateNotes}>
            <Ionicons name="sparkles" size={18} color={colors.primaryDark} />
            <Text style={styles.secondaryText}>Generate Note</Text>
          </Pressable>
          <Pressable style={styles.secondaryButton} onPress={shareNotes}>
            <Ionicons name="share-social" size={18} color={colors.primaryDark} />
            <Text style={styles.secondaryText}>Share</Text>
          </Pressable>
        </View>

        <Pressable style={styles.submit} onPress={save}>
          <Text style={styles.submitText}>Save Diary</Text>
        </Pressable>

        <View style={styles.panel}>
          <Text style={styles.panelTitle}>Saved Diary Entries</Text>
          {entries.length ? entries.map((item) => (
            <Pressable key={item.id} style={styles.sessionRow} onPress={() => {
              setSelectedDate(item.date);
              setSelectedSemesterId(item.semesterId ?? selectedSemesterId);
              setSelectedPaperId(item.paperId ?? selectedPaperId);
            }}>
              <View style={styles.dateBadge}>
                <Text style={styles.dateText}>{formatShortDate(item.date)}</Text>
              </View>
              <View style={styles.sessionText}>
                <Text style={styles.sessionTitle}>{item.topic}</Text>
                <Text style={styles.meta}>{entryPaperLabel(item)} / Class {item.classNumber}</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.muted} />
            </Pressable>
          )) : <Text style={styles.emptyText}>No diary entries saved yet.</Text>}
        </View>
      </ScrollView>
      <BottomNav />
    </View>
  );
}

function Field({
  label,
  value,
  onChangeText,
  multiline,
  keyboardType
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  multiline?: boolean;
  keyboardType?: "default" | "number-pad";
}) {
  return (
    <View>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        multiline={multiline}
        keyboardType={keyboardType}
        style={[styles.input, multiline && styles.multiline]}
        placeholderTextColor={colors.muted}
      />
    </View>
  );
}

function toApiDate(value: Date) {
  return value.toISOString().slice(0, 10);
}

function toMonthKey(value: Date) {
  return value.toISOString().slice(0, 7);
}

function buildCalendarDates(entries: DiaryEntry[], monthKey: string) {
  const values = new Set<string>();
  const [year, month] = monthKey.split("-").map(Number);
  const daysInMonth = new Date(year, month, 0).getDate();
  for (let day = 1; day <= daysInMonth; day += 1) {
    const date = new Date(Date.UTC(year, month - 1, day));
    values.add(toApiDate(date));
  }
  entries.filter((entry) => entry.date.startsWith(monthKey)).forEach((entry) => values.add(entry.date));
  return Array.from(values).sort((a, b) => a.localeCompare(b)).map((value) => {
    const date = new Date(value);
    return {
      value,
      day: Number.isNaN(date.getTime()) ? value.slice(-2) : date.toLocaleDateString("en-IN", { day: "2-digit" }),
      month: Number.isNaN(date.getTime()) ? value.slice(5, 7) : date.toLocaleDateString("en-IN", { month: "short" })
    };
  });
}

function moveMonth(monthKey: string, delta: number) {
  const [year, month] = monthKey.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1 + delta, 1));
  return toMonthKey(date);
}

function formatMonth(monthKey: string) {
  const [year, month] = monthKey.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, 1));
  return date.toLocaleDateString("en-IN", { month: "long", year: "numeric" });
}

function nextClassNumber(classSessions: { subjectId?: string; classDate?: string; classNumber?: number }[], paper: Paper | undefined, selectedDate: string) {
  if (!paper?.id) return "1";
  const numbers = classSessions
    .filter((item) => item.subjectId === paper.id && (item.classDate ?? "").slice(0, 10) === selectedDate)
    .map((item) => Number(item.classNumber ?? 0))
    .filter((value) => Number.isFinite(value) && value > 0);
  return String(numbers.length ? Math.max(...numbers) + 1 : 1);
}

function formatShortDate(raw: string) {
  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? raw : date.toLocaleDateString("en-IN", { day: "2-digit", month: "short" });
}

function paperLabel(paper: Paper) {
  return `${paper.code} - ${paper.name}`;
}

function entryPaperLabel(entry: Partial<DiaryEntry>) {
  if (entry.paperCode && entry.paperName) return `${entry.paperCode} - ${entry.paperName}`;
  return entry.paperCode ?? entry.paperName ?? "Paper";
}

function buildShareText(entry: Partial<DiaryEntry>) {
  return [
    "Teaching Diary",
    `Date: ${entry.date ?? ""}`,
    `Semester: ${entry.semesterName ?? ""}`,
    `Paper: ${entryPaperLabel(entry)}`,
    `Topic Taught: ${entry.topic ?? ""}`,
    `Present: ${entry.present ?? 0}`,
    `Absent: ${entry.absent ?? 0}`,
    `Note: ${cleanDiaryNotes(entry.notes, entry.topic)}`,
    entry.assignment ? `Assignment: ${entry.assignment}` : "",
    entry.observations ? `Observation: ${entry.observations}` : ""
  ].filter(Boolean).join("\n");
}

function cleanDiaryNotes(notes?: string, topic?: string) {
  const value = (notes ?? "").trim();
  if (!value) return "No notes written yet.";
  const topicLine = topic ? new RegExp(`^Topic:\\s*${escapeRegExp(topic)}\\s*\\n+`, "i") : /^Topic:.*\n+/i;
  return value.replace(topicLine, "").trim() || "No notes written yet.";
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function diaryAttendanceSummary(records: AttendanceRecord[], paperId: string | undefined, date: string, classNumber: string) {
  const selectedClass = Number(classNumber);
  const rows = records.filter((record) => {
    const samePaper = paperId ? record.subjectId === paperId : true;
    const sameDate = (record.date ?? "").slice(0, 10) === date;
    const sameClass = selectedClass > 0 ? Number(record.classNumber ?? 0) === selectedClass : true;
    return samePaper && sameDate && sameClass;
  });
  return {
    present: rows.filter((record) => record.status === "PRESENT").length,
    absent: rows.filter((record) => record.status === "ABSENT").length
  };
}

const styles = StyleSheet.create({
  shell: { flex: 1, backgroundColor: colors.surface },
  screen: { flex: 1, backgroundColor: colors.surface },
  content: { padding: spacing.lg, gap: 12, paddingBottom: 28 },
  panel: { backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1, borderRadius: 12, padding: 16, gap: 12 },
  headerRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  headerText: { flex: 1, minWidth: 0 },
  title: { color: colors.text, fontSize: 24, fontWeight: "900" },
  meta: { color: colors.muted, fontWeight: "700", marginTop: 3 },
  online: { color: colors.primaryDark, fontWeight: "900", marginTop: 5, fontSize: 12 },
  offline: { color: colors.orange, fontWeight: "900", marginTop: 5, fontSize: 12 },
  panelTitle: { color: colors.text, fontSize: 18, fontWeight: "900" },
  calendarHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },
  monthButton: { width: 42, height: 38, borderWidth: 1, borderColor: colors.border, borderRadius: 10, alignItems: "center", justifyContent: "center", backgroundColor: "#f8fafc" },
  calendarGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  dateChip: { width: 54, borderWidth: 1, borderColor: colors.border, borderRadius: 10, paddingVertical: 8, alignItems: "center", backgroundColor: "#f8fafc" },
  activeDateChip: { backgroundColor: colors.primary, borderColor: colors.primary },
  entryDateChip: { borderColor: colors.primary },
  dateDay: { color: colors.text, fontWeight: "900", fontSize: 15 },
  dateMonth: { color: colors.muted, fontWeight: "900", fontSize: 11 },
  activeDateText: { color: "#fff" },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { borderWidth: 1, borderColor: colors.border, backgroundColor: "#f8fafc", borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8 },
  paperChip: { maxWidth: "100%", borderRadius: 14 },
  activeChip: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { color: colors.text, fontWeight: "900" },
  paperChipText: { flexShrink: 1, lineHeight: 19 },
  activeChipText: { color: "#fff" },
  label: { color: colors.text, fontWeight: "900", marginBottom: 8 },
  input: { backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 12, color: colors.text, fontWeight: "800" },
  multiline: { minHeight: 94, textAlignVertical: "top" },
  buttonRow: { flexDirection: "row", gap: 12 },
  secondaryButton: { flex: 1, borderWidth: 1, borderColor: colors.primary, borderRadius: 12, padding: 14, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 8 },
  secondaryText: { color: colors.primaryDark, fontWeight: "900" },
  submit: { backgroundColor: colors.primary, borderRadius: 12, padding: 16, alignItems: "center", marginTop: 4 },
  submitText: { color: "#fff", fontWeight: "900", fontSize: 16 },
  sessionRow: { flexDirection: "row", alignItems: "center", gap: 12, borderBottomColor: colors.border, borderBottomWidth: 1, paddingBottom: 12 },
  dateBadge: { width: 58, borderWidth: 2, borderColor: colors.primary, borderRadius: 10, paddingVertical: 8, alignItems: "center" },
  dateText: { color: colors.text, fontWeight: "900", textAlign: "center" },
  sessionText: { flex: 1 },
  sessionTitle: { color: colors.text, fontWeight: "900" },
  emptyText: { color: colors.muted, fontWeight: "800", paddingVertical: 8 }
});
