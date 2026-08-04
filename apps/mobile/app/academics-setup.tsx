import { Ionicons } from "@expo/vector-icons";
import { useEffect, useMemo, useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { apiBackend } from "@/services/api-backend";
import { useBackendDashboard, type Paper, type Student } from "@/services/app-data";
import { colors, spacing } from "@/theme";

export default function AcademicsSetupScreen() {
  const { data, online, refresh } = useBackendDashboard();
  const { papers, students, ids, masters } = data;
  const [selectedSemesterId, setSelectedSemesterId] = useState("");
  const [editingSemesterId, setEditingSemesterId] = useState<string>();
  const [selectedPaperId, setSelectedPaperId] = useState("");
  const [semesterName, setSemesterName] = useState("");
  const [paperCode, setPaperCode] = useState("");
  const [paperName, setPaperName] = useState("");
  const [editingPaperId, setEditingPaperId] = useState<string>();
  const [rollNumber, setRollNumber] = useState("");
  const [studentName, setStudentName] = useState("");
  const [editingStudentId, setEditingStudentId] = useState<string>();
  const [bulkRows, setBulkRows] = useState("");
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);

  const selectedSemester = masters.semesters.find((item) => item.id === selectedSemesterId) ?? masters.semesters[0];
  const selectedSection = masters.sections.find((item) => item.semesterId === selectedSemester?.id) ?? masters.sections[0];
  const semesterPapers = useMemo(() => {
    if (!selectedSemester) return papers;
    return papers.filter((paper) => paper.semesterId === selectedSemester.id || paper.semester === selectedSemester.name);
  }, [papers, selectedSemester]);
  const selectedPaper = semesterPapers.find((item) => item.id === selectedPaperId) ?? semesterPapers[0] ?? papers[0];
  const semesterStudents = useMemo(
    () => students.filter((student) => !selectedSemester?.id || student.semesterId === selectedSemester.id),
    [students, selectedSemester?.id]
  );
  const mappedCount = semesterStudents.filter((student) => selectedPaper?.id && student.enrolledSubjectIds?.includes(selectedPaper.id)).length;

  useEffect(() => {
    if (!selectedSemesterId && masters.semesters[0]?.id) setSelectedSemesterId(masters.semesters[0].id);
  }, [masters.semesters, selectedSemesterId]);

  useEffect(() => {
    if (selectedPaper?.id && selectedPaperId !== selectedPaper.id) setSelectedPaperId(selectedPaper.id);
  }, [selectedPaper?.id, selectedPaperId]);

  useEffect(() => {
    if (!selectedPaper?.id) {
      setSelectedStudentIds([]);
      return;
    }
    setSelectedStudentIds(semesterStudents.filter((student) => student.enrolledSubjectIds?.includes(selectedPaper.id)).map((student) => student.id));
  }, [selectedPaper?.id, semesterStudents]);

  const saveSemester = async () => {
    if (!semesterName.trim()) {
      Alert.alert("Semester required", "Enter Semester I, Semester II, etc.");
      return;
    }
    try {
      const response = editingSemesterId
        ? await apiBackend.updateSemester(editingSemesterId, { name: semesterName.trim(), courseId: ids.courseId || undefined })
        : await apiBackend.createSemester({ name: semesterName.trim(), courseId: ids.courseId || undefined, sectionName: "A" });
      await refresh();
      setSelectedSemesterId(response.semester?.id ?? editingSemesterId ?? "");
      setEditingSemesterId(undefined);
      setSemesterName("");
      Alert.alert(editingSemesterId ? "Semester updated" : "Semester added", `${semesterName.trim()} is ready for papers and students.`);
    } catch {
      Alert.alert("Semester failed", "Semester could not be saved to the backend.");
    }
  };

  const editSemester = (semester: { id: string; name: string }) => {
    setEditingSemesterId(semester.id);
    setSelectedSemesterId(semester.id);
    setSemesterName(semester.name);
  };

  const deleteSemester = (semesterId: string) => {
    Alert.alert("Delete semester", "This will remove the semester, papers, student mapping, and linked setup rows. Continue?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            await apiBackend.deleteSemester(semesterId);
            await refresh();
            if (selectedSemesterId === semesterId) setSelectedSemesterId("");
            if (editingSemesterId === semesterId) {
              setEditingSemesterId(undefined);
              setSemesterName("");
            }
            Alert.alert("Semester deleted", "Semester removed from backend.");
          } catch {
            Alert.alert("Delete failed", "Semester could not be deleted.");
          }
        }
      }
    ]);
  };

  const savePaper = async () => {
    const semesterId = selectedSemester?.id ?? ids.semesterId;
    const sectionId = selectedSection?.id ?? ids.sectionId;
    if (!paperCode.trim() || !paperName.trim()) {
      Alert.alert("Paper required", "Enter paper code and paper name.");
      return;
    }
    if (!ids.departmentId || !semesterId || !sectionId) {
      Alert.alert("Semester required", "Create/select a semester before adding papers.");
      return;
    }
    const payload = {
      code: paperCode.trim(),
      name: paperName.trim(),
      departmentId: ids.departmentId,
      semesterId,
      sectionId
    };
    try {
      if (editingPaperId) {
        await apiBackend.updateSubject(editingPaperId, payload);
      } else {
        await apiBackend.addSubject(payload);
      }
      await refresh();
      setEditingPaperId(undefined);
      setPaperCode("");
      setPaperName("");
      Alert.alert(editingPaperId ? "Paper updated" : "Paper added", `${payload.code} saved.`);
    } catch {
      Alert.alert("Paper failed", "Paper could not be saved to the backend.");
    }
  };

  const editPaper = (paper: Paper) => {
    setEditingPaperId(paper.id);
    setSelectedPaperId(paper.id);
    setPaperCode(paper.code);
    setPaperName(paper.name);
  };

  const cancelPaperEdit = () => {
    setEditingPaperId(undefined);
    setPaperCode("");
    setPaperName("");
  };

  const deletePaper = (paperId: string) => {
    Alert.alert("Delete paper", "This will remove this paper, its mappings, classes, diary entries, and attendance records. Continue?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            await apiBackend.deleteSubject(paperId);
            await refresh();
            if (selectedPaperId === paperId) setSelectedPaperId("");
            if (editingPaperId === paperId) cancelPaperEdit();
            Alert.alert("Paper deleted", "Paper removed from backend.");
          } catch {
            Alert.alert("Delete failed", "Paper could not be deleted.");
          }
        }
      }
    ]);
  };

  const saveStudent = async () => {
    const semesterId = selectedSemester?.id ?? ids.semesterId;
    const sectionId = selectedSection?.id ?? ids.sectionId;
    const courseId = selectedSemester?.courseId ?? ids.courseId;
    if (!rollNumber.trim() || !studentName.trim()) {
      Alert.alert("Student required", "Enter roll number and student name.");
      return;
    }
    if (!ids.departmentId || !courseId || !semesterId || !sectionId) {
      Alert.alert("Semester required", "Create/select a semester before adding students.");
      return;
    }
    try {
      const payload = {
        rollNumber: rollNumber.trim(),
        name: studentName.trim(),
        departmentId: ids.departmentId,
        courseId,
        semesterId,
        sectionId
      };
      if (editingStudentId) {
        await apiBackend.updateStudent(editingStudentId, payload);
      } else {
        await apiBackend.createStudent(payload);
      }
      await refresh();
      setEditingStudentId(undefined);
      setRollNumber("");
      setStudentName("");
      Alert.alert(editingStudentId ? "Student updated" : "Student added", "Master student database updated.");
    } catch {
      Alert.alert("Student failed", "Student could not be saved. Check duplicate roll number.");
    }
  };

  const editStudent = (student: Student) => {
    setEditingStudentId(student.id);
    setRollNumber(student.rollNumber);
    setStudentName(student.name);
  };

  const cancelStudentEdit = () => {
    setEditingStudentId(undefined);
    setRollNumber("");
    setStudentName("");
  };

  const deleteStudent = (student: Student) => {
    Alert.alert("Delete student", `Remove ${student.rollNumber}. ${student.name} and linked attendance records?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            await apiBackend.deleteStudent(student.id);
            await refresh();
            setSelectedStudentIds((current) => current.filter((id) => id !== student.id));
            if (editingStudentId === student.id) cancelStudentEdit();
            Alert.alert("Student deleted", "Student removed from backend.");
          } catch {
            Alert.alert("Delete failed", "Student could not be deleted.");
          }
        }
      }
    ]);
  };

  const uploadBulkStudents = async () => {
    const semesterId = selectedSemester?.id ?? ids.semesterId;
    const sectionId = selectedSection?.id ?? ids.sectionId;
    const courseId = selectedSemester?.courseId ?? ids.courseId;
    const parsed = bulkRows
      .split(/\r?\n/)
      .map((row) => row.split(/,|\t/).map((value) => value.trim()))
      .filter(([roll, name]) => roll && name)
      .map(([rollNumber, name]) => ({ rollNumber, name }));

    if (!parsed.length) {
      Alert.alert("Bulk upload", "Paste Excel rows like: 01, Rahul Das");
      return;
    }
    if (!ids.departmentId || !courseId || !semesterId || !sectionId) {
      Alert.alert("Semester required", "Create/select a semester before bulk upload.");
      return;
    }
    try {
      await apiBackend.bulkStudents({
        students: parsed,
        departmentId: ids.departmentId,
        courseId,
        semesterId,
        sectionId
      });
      await refresh();
      setBulkRows("");
      Alert.alert("Bulk upload complete", `${parsed.length} students saved.`);
    } catch {
      Alert.alert("Bulk upload failed", "Students could not be saved to backend.");
    }
  };

  const mapStudents = async () => {
    const paperId = selectedPaper?.id;
    const semesterId = selectedSemester?.id ?? ids.semesterId;
    if (!paperId || !semesterId) {
      Alert.alert("Mapping unavailable", "Select semester, paper, and add students first.");
      return;
    }
    try {
      await apiBackend.enrollStudents({
        subjectId: paperId,
        semesterId,
        studentIds: selectedStudentIds
      });
      await refresh();
      Alert.alert("Master database mapped", "Students are attached to the selected paper.");
    } catch {
      Alert.alert("Mapping failed", "Student-paper mapping could not be saved.");
    }
  };

  const toggleStudent = (studentId: string) => {
    setSelectedStudentIds((current) => current.includes(studentId) ? current.filter((id) => id !== studentId) : [...current, studentId]);
  };

  const selectAllStudents = () => setSelectedStudentIds(semesterStudents.map((student) => student.id));
  const clearSelectedStudents = () => setSelectedStudentIds([]);

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text style={styles.kicker}>Stages 2-4</Text>
        <Text style={styles.title}>Academic Setup</Text>
        <Text style={online ? styles.online : styles.offline}>{online ? "Connected to backend" : "Backend offline"}</Text>
      </View>

      <View style={styles.panel}>
        <Text style={styles.stage}>Stage 2 / Semester Creation</Text>
        <View style={styles.formRow}>
          <TextInput value={semesterName} onChangeText={setSemesterName} style={[styles.input, styles.flexInput]} placeholder="Semester I" placeholderTextColor={colors.muted} />
          <Pressable style={styles.compactButton} onPress={saveSemester}>
            <Ionicons name="add" size={18} color="#fff" />
            <Text style={styles.compactButtonText}>{editingSemesterId ? "Update Semester" : "Add Semester"}</Text>
          </Pressable>
        </View>
        {editingSemesterId ? (
          <Pressable style={styles.linkButton} onPress={() => {
            setEditingSemesterId(undefined);
            setSemesterName("");
          }}>
            <Text style={styles.linkButtonText}>Cancel semester edit</Text>
          </Pressable>
        ) : null}
        <View style={styles.semesterGrid}>
          {masters.semesters.length ? masters.semesters.map((item) => {
            const active = (selectedSemester?.id ?? "") === item.id;
            return (
              <View key={item.id} style={[styles.semester, active && styles.activeSemester]}>
                <Pressable onPress={() => setSelectedSemesterId(item.id)} style={styles.semesterMain}>
                  <Text style={[styles.semesterText, active && styles.activeSemesterText]}>{item.name}</Text>
                </Pressable>
                <View style={styles.rowActions}>
                  <Pressable onPress={() => editSemester(item)} style={styles.textAction}>
                    <Ionicons name="create-outline" size={15} color={active ? "#fff" : colors.primaryDark} />
                    <Text style={[styles.textActionLabel, active && styles.activeSemesterText]}>Edit</Text>
                  </Pressable>
                  <Pressable onPress={() => deleteSemester(item.id)} style={styles.textAction}>
                    <Ionicons name="trash-outline" size={15} color={active ? "#fff" : colors.red} />
                    <Text style={[styles.textActionLabel, active ? styles.activeSemesterText : styles.dangerText]}>Delete</Text>
                  </Pressable>
                </View>
              </View>
            );
          }) : <Text style={styles.emptyText}>No semesters yet.</Text>}
        </View>
      </View>

      <View style={styles.panel}>
        <Text style={styles.stage}>Stage 3 / Subject-Paper Creation</Text>
        <Text style={styles.panelMeta}>{selectedSemester?.name ?? "Select a semester"}</Text>
        <TextInput value={paperCode} onChangeText={setPaperCode} style={styles.input} placeholder="Paper code, e.g. LIS202" placeholderTextColor={colors.muted} autoCapitalize="characters" />
        <TextInput value={paperName} onChangeText={setPaperName} style={styles.input} placeholder="Paper name, e.g. Information Sources" placeholderTextColor={colors.muted} />
        <Pressable style={styles.submit} onPress={savePaper}>
          <Text style={styles.submitText}>{editingPaperId ? "Update Paper" : "Add Paper"}</Text>
        </Pressable>
        {editingPaperId ? (
          <Pressable style={styles.linkButton} onPress={cancelPaperEdit}>
            <Text style={styles.linkButtonText}>Cancel paper edit</Text>
          </Pressable>
        ) : null}
        {semesterPapers.length ? semesterPapers.map((item) => (
          <View key={item.id} style={styles.paperRow}>
            <Pressable onPress={() => setSelectedPaperId(item.id)} style={[styles.paperBadge, selectedPaper?.id === item.id && styles.activePaperBadge]}>
              <Text style={[styles.paperBadgeText, selectedPaper?.id === item.id && styles.activePaperBadgeText]}>{item.code}</Text>
            </Pressable>
            <View style={styles.paperText}>
              <Text style={styles.paperName}>{item.name}</Text>
              <Text style={styles.paperMeta}>{item.semester}</Text>
            </View>
            <Pressable onPress={() => editPaper(item)} style={styles.labeledIconButton}>
              <Ionicons name="create-outline" size={18} color={colors.primaryDark} />
              <Text style={styles.labeledIconText}>Edit</Text>
            </Pressable>
            <Pressable onPress={() => deletePaper(item.id)} style={styles.labeledIconButton}>
              <Ionicons name="trash-outline" size={18} color={colors.red} />
              <Text style={styles.labeledIconDanger}>Delete</Text>
            </Pressable>
          </View>
        )) : <Text style={styles.emptyText}>No papers for this semester yet.</Text>}
      </View>

      <View style={styles.panel}>
        <Text style={styles.stage}>Stage 4 / Student Database</Text>
        <Text style={styles.panelTitle}>Manual Entry</Text>
        <View style={styles.formRow}>
          <TextInput value={rollNumber} onChangeText={setRollNumber} style={[styles.input, styles.rollInput]} placeholder="01" placeholderTextColor={colors.muted} />
          <TextInput value={studentName} onChangeText={setStudentName} style={[styles.input, styles.flexInput]} placeholder="Rahul Das" placeholderTextColor={colors.muted} />
        </View>
        <Pressable style={styles.secondaryButton} onPress={saveStudent}>
          <Text style={styles.secondaryText}>{editingStudentId ? "Update Student" : "Add Student"}</Text>
        </Pressable>
        {editingStudentId ? (
          <Pressable style={styles.linkButton} onPress={cancelStudentEdit}>
            <Text style={styles.linkButtonText}>Cancel student edit</Text>
          </Pressable>
        ) : null}
        <Text style={styles.panelTitle}>Bulk Upload</Text>
        <TextInput value={bulkRows} onChangeText={setBulkRows} multiline style={[styles.input, styles.bulkInput]} placeholder={"Roll No, Name\n01, Rahul Das\n02, Anita Sharma"} placeholderTextColor={colors.muted} />
        <Pressable style={styles.secondaryButton} onPress={uploadBulkStudents}>
          <Text style={styles.secondaryText}>Upload Excel Rows</Text>
        </Pressable>
        <Text style={styles.panelTitle}>Master Student Database</Text>
        <Text style={styles.panelMeta}>{selectedPaper ? `${selectedPaper.code} - ${selectedPaper.name}: ${selectedStudentIds.length} selected / ${mappedCount} currently mapped` : "Select a paper first"}</Text>
        <View style={styles.mapActions}>
          <Pressable style={styles.smallButton} onPress={selectAllStudents}>
            <Text style={styles.smallButtonText}>Select All</Text>
          </Pressable>
          <Pressable style={styles.smallButton} onPress={clearSelectedStudents}>
            <Text style={styles.smallButtonText}>Clear</Text>
          </Pressable>
        </View>
        {semesterStudents.length ? semesterStudents.map((student) => {
          const selected = selectedStudentIds.includes(student.id);
          return (
          <Pressable key={student.id} style={[styles.studentRow, selected && styles.selectedStudentRow]} onPress={() => toggleStudent(student.id)}>
            <Ionicons name={selected ? "checkbox" : "square-outline"} size={21} color={selected ? colors.primary : colors.muted} />
            <Text style={styles.roll}>{student.rollNumber}</Text>
            <Text style={styles.studentName}>{student.name}</Text>
            {student.enrolledSubjectIds?.includes(selectedPaper?.id ?? "") ? <Ionicons name="link" size={18} color={colors.primaryDark} /> : null}
            <Pressable
              onPress={(event) => {
                event.stopPropagation();
                editStudent(student);
              }}
              style={styles.studentActionButton}
            >
              <Ionicons name="create-outline" size={16} color={colors.primaryDark} />
              <Text style={styles.studentActionText}>Edit</Text>
            </Pressable>
            <Pressable
              onPress={(event) => {
                event.stopPropagation();
                deleteStudent(student);
              }}
              style={styles.studentActionButton}
            >
              <Ionicons name="trash-outline" size={16} color={colors.red} />
              <Text style={styles.studentActionDanger}>Delete</Text>
            </Pressable>
          </Pressable>
          );
        }) : <Text style={styles.emptyText}>No students saved for this semester yet.</Text>}
        <Pressable style={styles.secondaryButton} onPress={mapStudents}>
          <Text style={styles.secondaryText}>Save Selected Students to Paper</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.surface },
  content: { padding: spacing.lg, gap: 14, paddingBottom: 30 },
  header: { gap: 4 },
  kicker: { color: colors.primaryDark, fontWeight: "900", textTransform: "uppercase", fontSize: 12 },
  title: { color: colors.text, fontSize: 26, fontWeight: "900" },
  online: { color: colors.primaryDark, fontWeight: "900" },
  offline: { color: colors.orange, fontWeight: "900" },
  panel: { backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1, borderRadius: 12, padding: 16, gap: 12 },
  stage: { color: colors.text, fontSize: 18, fontWeight: "900" },
  panelTitle: { color: colors.text, fontWeight: "900" },
  panelMeta: { color: colors.muted, fontWeight: "800" },
  formRow: { flexDirection: "row", gap: 10, alignItems: "center" },
  flexInput: { flex: 1 },
  rollInput: { width: 82 },
  bulkInput: { minHeight: 92, textAlignVertical: "top" },
  input: { backgroundColor: "#f8fafc", borderColor: colors.border, borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 12, color: colors.text, fontWeight: "800" },
  compactButton: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, backgroundColor: colors.primary, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 13 },
  compactButtonText: { color: "#fff", fontWeight: "900" },
  semesterGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  semester: { width: "48%", backgroundColor: "#f8fafc", borderColor: colors.border, borderWidth: 1, borderRadius: 10, padding: 10, gap: 8 },
  semesterMain: { alignItems: "center", paddingVertical: 4 },
  activeSemester: { backgroundColor: colors.primary, borderColor: colors.primary },
  semesterText: { color: colors.text, fontWeight: "900" },
  activeSemesterText: { color: "#fff" },
  rowActions: { flexDirection: "row", justifyContent: "center", gap: 8, flexWrap: "wrap" },
  textAction: { flexDirection: "row", alignItems: "center", gap: 3 },
  textActionLabel: { color: colors.primaryDark, fontWeight: "900", fontSize: 11 },
  dangerText: { color: colors.red },
  submit: { backgroundColor: colors.primary, borderRadius: 10, padding: 14, alignItems: "center" },
  submitText: { color: "#fff", fontWeight: "900" },
  linkButton: { alignSelf: "flex-start", paddingVertical: 4 },
  linkButtonText: { color: colors.primaryDark, fontWeight: "900" },
  paperRow: { flexDirection: "row", alignItems: "center", gap: 10, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 12 },
  paperBadge: { backgroundColor: "#dcfce7", borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, minWidth: 70, alignItems: "center" },
  activePaperBadge: { backgroundColor: colors.primary },
  paperBadgeText: { color: colors.primaryDark, fontWeight: "900" },
  activePaperBadgeText: { color: "#fff" },
  paperText: { flex: 1 },
  paperName: { color: colors.text, fontWeight: "900" },
  paperMeta: { color: colors.muted, marginTop: 2 },
  iconButton: { width: 34, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center", backgroundColor: "#f8fafc", borderWidth: 1, borderColor: colors.border },
  labeledIconButton: { minWidth: 54, minHeight: 38, borderRadius: 10, alignItems: "center", justifyContent: "center", backgroundColor: "#f8fafc", borderWidth: 1, borderColor: colors.border, paddingHorizontal: 6, gap: 1 },
  labeledIconText: { color: colors.primaryDark, fontWeight: "900", fontSize: 10 },
  labeledIconDanger: { color: colors.red, fontWeight: "900", fontSize: 10 },
  studentRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 8, borderTopWidth: 1, borderTopColor: colors.border },
  selectedStudentRow: { backgroundColor: "#f0fdf4", borderRadius: 10, paddingHorizontal: 8 },
  roll: { width: 34, color: colors.primaryDark, fontWeight: "900" },
  studentName: { color: colors.text, fontWeight: "800", flex: 1 },
  studentActionButton: { minWidth: 58, minHeight: 36, borderRadius: 10, borderWidth: 1, borderColor: colors.border, alignItems: "center", justifyContent: "center", backgroundColor: "#fff", paddingHorizontal: 6 },
  studentActionText: { color: colors.primaryDark, fontWeight: "900", fontSize: 10 },
  studentActionDanger: { color: colors.red, fontWeight: "900", fontSize: 10 },
  secondaryButton: { borderWidth: 1, borderColor: colors.primary, borderRadius: 10, padding: 14, alignItems: "center" },
  secondaryText: { color: colors.primaryDark, fontWeight: "900" },
  mapActions: { flexDirection: "row", gap: 8 },
  smallButton: { borderWidth: 1, borderColor: colors.border, borderRadius: 9, paddingHorizontal: 12, paddingVertical: 9, backgroundColor: "#f8fafc" },
  smallButtonText: { color: colors.text, fontWeight: "900" },
  emptyText: { color: colors.muted, fontWeight: "800", paddingVertical: 8 }
});
