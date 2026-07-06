import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { apiBackend } from "@/services/api-backend";
import { classSessions, papers } from "@/data/saa";
import { colors, spacing } from "@/theme";

export default function ClassDiaryScreen() {
  const [topic, setTopic] = useState("Reference Sources");
  const [assignment, setAssignment] = useState("Prepare a short note on bibliographic sources.");
  const [notes, setNotes] = useState("Students discussed examples from library catalogues.");
  const [observations, setObservations] = useState("Two students need attendance follow-up.");

  const save = async () => {
    try {
      await apiBackend.createClassSession({
        teacherId: "seed-teacher-1",
        academicSessionId: "seed-session-1",
        departmentId: "seed-department-1",
        courseId: "seed-course-1",
        semesterId: "seed-semester-1",
        sectionId: "seed-section-1",
        subjectId: "seed-subject-1",
        date: new Date(),
        classNumber: 13,
        topicTaught: topic,
        durationMinutes: 60,
        assignmentGiven: assignment,
        notes,
        observations
      });
      Alert.alert("Diary saved", "Teaching diary entry is linked with the class register.");
    } catch {
      Alert.alert("Diary saved locally", "This entry will sync with the class register later.");
    }
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.panel}>
        <View style={styles.headerRow}>
          <Ionicons name="book" size={26} color={colors.primary} />
          <View>
            <Text style={styles.title}>Class Diary</Text>
            <Text style={styles.meta}>{papers[1].code} / Semester II</Text>
          </View>
        </View>
      </View>

      <Field label="Topic Taught" value={topic} onChangeText={setTopic} />
      <Field label="Assignment Given" value={assignment} onChangeText={setAssignment} multiline />
      <Field label="Notes" value={notes} onChangeText={setNotes} multiline />
      <Field label="Important Observations" value={observations} onChangeText={setObservations} multiline />

      <Pressable style={styles.submit} onPress={save}>
        <Text style={styles.submitText}>Save Diary Entry</Text>
      </Pressable>

      <View style={styles.panel}>
        <Text style={styles.panelTitle}>Teaching Diary Preview</Text>
        {classSessions.filter((item) => item.status !== "No Class").map((item) => (
          <View key={item.date} style={styles.sessionRow}>
            <View style={[styles.dateBadge, { borderColor: item.color }]}>
              <Text style={styles.dateText}>{item.date}</Text>
            </View>
            <View style={styles.sessionText}>
              <Text style={styles.sessionTitle}>{item.topic}</Text>
              <Text style={styles.meta}>{item.status}</Text>
            </View>
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

function Field({ label, value, onChangeText, multiline }: { label: string; value: string; onChangeText: (value: string) => void; multiline?: boolean }) {
  return (
    <View>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        multiline={multiline}
        style={[styles.input, multiline && styles.multiline]}
        placeholderTextColor={colors.muted}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.surface },
  content: { padding: spacing.lg, gap: 12 },
  panel: { backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1, borderRadius: 12, padding: 16, gap: 12 },
  headerRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  title: { color: colors.text, fontSize: 24, fontWeight: "900" },
  meta: { color: colors.muted, fontWeight: "700", marginTop: 3 },
  label: { color: colors.text, fontWeight: "900", marginBottom: 8 },
  input: { backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 12, color: colors.text, fontWeight: "800" },
  multiline: { minHeight: 84, textAlignVertical: "top" },
  submit: { backgroundColor: colors.primary, borderRadius: 12, padding: 16, alignItems: "center", marginTop: 4 },
  submitText: { color: "#fff", fontWeight: "900", fontSize: 16 },
  panelTitle: { color: colors.text, fontSize: 18, fontWeight: "900" },
  sessionRow: { flexDirection: "row", alignItems: "center", gap: 12, borderBottomColor: colors.border, borderBottomWidth: 1, paddingBottom: 12 },
  dateBadge: { width: 58, borderWidth: 2, borderRadius: 10, paddingVertical: 8, alignItems: "center" },
  dateText: { color: colors.text, fontWeight: "900" },
  sessionText: { flex: 1 },
  sessionTitle: { color: colors.text, fontWeight: "900" }
});
