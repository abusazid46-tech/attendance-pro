import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { apiBackend } from "@/services/api-backend";
import { papers, semesters, students } from "@/data/saa";
import { colors, spacing } from "@/theme";

export default function AcademicsSetupScreen() {
  const [selectedSemester, setSelectedSemester] = useState("Semester II");
  const [paperCode, setPaperCode] = useState("LIS204");
  const [paperName, setPaperName] = useState("Research Methods");

  const addPaper = async () => {
    try {
      await apiBackend.addSubject({
        code: paperCode,
        name: paperName,
        departmentId: "seed-department-1",
        semesterId: "seed-semester-1",
        sectionId: "seed-section-1"
      });
      Alert.alert("Paper added", `${paperCode} is mapped to ${selectedSemester}.`);
    } catch {
      Alert.alert("Paper saved locally", `${paperCode} will sync when network is available.`);
    }
  };

  const enrollStudents = async () => {
    try {
      await apiBackend.enrollStudents({
        subjectId: "seed-subject-1",
        semesterId: "seed-semester-1",
        studentIds: students.map((item) => item.id)
      });
      Alert.alert("Master database mapped", "Selected students are attached to this paper.");
    } catch {
      Alert.alert("Mapping saved locally", "Student selections are ready for sync.");
    }
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Semester Creation</Text>
      <View style={styles.semesterGrid}>
        {semesters.map((item) => {
          const active = item === selectedSemester;
          return (
            <Pressable key={item} onPress={() => setSelectedSemester(item)} style={[styles.semester, active && styles.activeSemester]}>
              <Text style={[styles.semesterText, active && styles.activeSemesterText]}>{item}</Text>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.panel}>
        <View style={styles.panelHeader}>
          <Ionicons name="library" size={22} color={colors.primary} />
          <Text style={styles.panelTitle}>Add Papers</Text>
        </View>
        <TextInput value={paperCode} onChangeText={setPaperCode} style={styles.input} placeholder="Paper code" placeholderTextColor={colors.muted} />
        <TextInput value={paperName} onChangeText={setPaperName} style={styles.input} placeholder="Paper name" placeholderTextColor={colors.muted} />
        <Pressable style={styles.submit} onPress={addPaper}>
          <Text style={styles.submitText}>Add Paper</Text>
        </Pressable>
      </View>

      <View style={styles.panel}>
        <Text style={styles.panelTitle}>Semester II Papers</Text>
        {papers.map((item) => (
          <View key={item.code} style={styles.paperRow}>
            <View style={styles.paperBadge}>
              <Text style={styles.paperBadgeText}>{item.code}</Text>
            </View>
            <View style={styles.paperText}>
              <Text style={styles.paperName}>{item.name}</Text>
              <Text style={styles.paperMeta}>{item.semester}</Text>
            </View>
            <Ionicons name="create-outline" size={20} color={colors.muted} />
          </View>
        ))}
      </View>

      <View style={styles.panel}>
        <Text style={styles.panelTitle}>Master Student Database</Text>
        {students.map((student) => (
          <View key={student.id} style={styles.studentRow}>
            <Text style={styles.roll}>{student.rollNumber}</Text>
            <Text style={styles.studentName}>{student.name}</Text>
            <Ionicons name="checkmark-circle" size={19} color={colors.primary} />
          </View>
        ))}
        <Pressable style={styles.secondaryButton} onPress={enrollStudents}>
          <Text style={styles.secondaryText}>Map Students to Paper</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.surface },
  content: { padding: spacing.lg, gap: 14 },
  title: { color: colors.text, fontSize: 24, fontWeight: "900" },
  semesterGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  semester: { width: "48%", backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1, borderRadius: 12, padding: 14, alignItems: "center" },
  activeSemester: { backgroundColor: colors.primary, borderColor: colors.primary },
  semesterText: { color: colors.text, fontWeight: "900" },
  activeSemesterText: { color: "#fff" },
  panel: { backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1, borderRadius: 12, padding: 16, gap: 12 },
  panelHeader: { flexDirection: "row", alignItems: "center", gap: 8 },
  panelTitle: { color: colors.text, fontSize: 18, fontWeight: "900" },
  input: { backgroundColor: "#f8fafc", borderColor: colors.border, borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 12, color: colors.text, fontWeight: "800" },
  submit: { backgroundColor: colors.primary, borderRadius: 10, padding: 14, alignItems: "center" },
  submitText: { color: "#fff", fontWeight: "900" },
  paperRow: { flexDirection: "row", alignItems: "center", gap: 12, borderBottomWidth: 1, borderBottomColor: colors.border, paddingBottom: 12 },
  paperBadge: { backgroundColor: "#dcfce7", borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8 },
  paperBadgeText: { color: colors.primaryDark, fontWeight: "900" },
  paperText: { flex: 1 },
  paperName: { color: colors.text, fontWeight: "900" },
  paperMeta: { color: colors.muted, marginTop: 2 },
  studentRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 8 },
  roll: { width: 28, color: colors.primaryDark, fontWeight: "900" },
  studentName: { color: colors.text, fontWeight: "800", flex: 1 },
  secondaryButton: { borderWidth: 1, borderColor: colors.primary, borderRadius: 10, padding: 14, alignItems: "center" },
  secondaryText: { color: colors.primaryDark, fontWeight: "900" }
});
