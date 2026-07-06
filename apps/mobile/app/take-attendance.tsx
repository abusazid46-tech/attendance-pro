import * as Location from "expo-location";
import { useMemo, useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { BottomNav } from "@/components/bottom-nav";
import { enqueueOfflineAttendance, syncOfflineAttendance } from "@/services/offline-attendance";
import { apiBackend } from "@/services/api-backend";
import { papers, students, teacherProfile } from "@/data/saa";
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
  const [topic, setTopic] = useState("Reference Sources");
  const [duration, setDuration] = useState("60");
  const [classNumber, setClassNumber] = useState("12");
  const [records, setRecords] = useState<Record<string, (typeof statuses)[number]>>(() => Object.fromEntries(students.map((s) => [s.id, "PRESENT"])));
  const [remarks, setRemarks] = useState<Record<string, string>>({});

  const summary = useMemo(
    () =>
      statuses.map((status) => ({
        status,
        count: Object.values(records).filter((item) => item === status).length
      })),
    [records]
  );

  const submit = async () => {
    const locationPermission = await Location.requestForegroundPermissionsAsync();
    const coords = locationPermission.status === "granted" ? (await Location.getCurrentPositionAsync()).coords : undefined;
    const date = new Date();
    const classPayload = {
      teacherId: "seed-teacher-1",
      academicSessionId: "seed-session-1",
      departmentId: "seed-department-1",
      courseId: "seed-course-1",
      semesterId: "seed-semester-1",
      sectionId: "seed-section-1",
      subjectId: "seed-subject-1",
      date,
      classNumber: Number(classNumber) || 1,
      topicTaught: topic,
      durationMinutes: Number(duration) || 60,
      assignmentGiven: "Read the next section before the next class",
      observations: "Default all present mode used"
    };

    const payload = {
      ...classPayload,
      classSessionId: undefined as string | undefined,
      latitude: coords?.latitude,
      longitude: coords?.longitude,
      records: students.map((student) => ({
        studentId: student.id,
        status: records[student.id],
        remark: remarks[student.id]
      }))
    };

    try {
      const classResponse = await apiBackend.createClassSession(classPayload);
      payload.classSessionId = classResponse.classSession.id;
      await apiBackend.submitAttendance(payload);
      await syncOfflineAttendance();
      Alert.alert("Attendance submitted", "Class diary and attendance register updated.");
    } catch {
      await enqueueOfflineAttendance(payload);
      Alert.alert("Saved offline", "This class will sync automatically when internet returns.");
    }
  };

  return (
    <View style={styles.shell}>
      <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
        <View style={styles.panel}>
        <Text style={styles.kicker}>Class Details</Text>
        <Text style={styles.title}>{papers[1].code} / {papers[1].name}</Text>
        <Text style={styles.meta}>{teacherProfile.academicSession} / Semester II / Today</Text>
        <View style={styles.formRow}>
          <Field label="Class No" value={classNumber} onChangeText={setClassNumber} keyboardType="number-pad" />
          <Field label="Duration" value={duration} onChangeText={setDuration} keyboardType="number-pad" suffix="min" />
        </View>
        <Text style={styles.label}>Topic Taught</Text>
        <TextInput value={topic} onChangeText={setTopic} style={styles.input} placeholder="Topic taught" placeholderTextColor={colors.muted} />
        </View>

        <View style={styles.summaryRow}>
        {summary.map((item) => (
          <View key={item.status} style={styles.summaryChip}>
            <View style={[styles.summaryDot, { backgroundColor: statusColors[item.status] }]} />
            <Text style={styles.summaryText}>{statusLabels[item.status]} {item.count}</Text>
          </View>
        ))}
        </View>

        {students.map((student) => (
        <View key={student.id} style={styles.student}>
          <View style={styles.studentHeader}>
            <View>
              <Text style={styles.studentName}>{student.name}</Text>
              <Text style={styles.roll}>Roll {student.rollNumber}</Text>
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
              placeholder="Remark"
              placeholderTextColor={colors.muted}
            />
          )}
        </View>
        ))}

        <Pressable style={styles.submit} onPress={submit}>
          <Text style={styles.submitText}>Submit Attendance</Text>
        </Pressable>
      </ScrollView>
      <BottomNav />
    </View>
  );
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
  formRow: { flexDirection: "row", gap: 12, marginTop: 16 },
  field: { flex: 1 },
  label: { color: colors.muted, fontWeight: "800", marginBottom: 8, marginTop: 10 },
  inputWrap: { flexDirection: "row", alignItems: "center", backgroundColor: "#f8fafc", borderColor: colors.border, borderWidth: 1, borderRadius: 10, paddingHorizontal: 12 },
  input: { backgroundColor: "#f8fafc", borderColor: colors.border, borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 12, color: colors.text, fontWeight: "800" },
  inlineInput: { flex: 1, paddingVertical: 12, color: colors.text, fontWeight: "900" },
  suffix: { color: colors.muted, fontWeight: "800" },
  summaryRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  summaryChip: { flexDirection: "row", alignItems: "center", gap: 7, backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8 },
  summaryDot: { width: 8, height: 8, borderRadius: 4 },
  summaryText: { color: colors.text, fontWeight: "900" },
  student: { backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1, borderRadius: 12, padding: 14 },
  studentHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 12 },
  studentName: { fontWeight: "900", color: colors.text, fontSize: 16 },
  roll: { color: colors.muted, marginTop: 4, fontWeight: "700" },
  statuses: { flexDirection: "row", gap: 6 },
  status: { width: 34, height: 34, borderRadius: 17, borderWidth: 1, borderColor: colors.border, alignItems: "center", justifyContent: "center" },
  statusText: { color: colors.text, fontWeight: "900" },
  activeText: { color: "#fff" },
  remark: { marginTop: 12, backgroundColor: "#f8fafc", borderColor: colors.border, borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, color: colors.text, fontWeight: "700" },
  submit: { backgroundColor: colors.primary, padding: 16, borderRadius: 12, alignItems: "center", marginTop: 8 },
  submitText: { color: "#fff", fontWeight: "900", fontSize: 16 }
});
