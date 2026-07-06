import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import { Alert, Pressable, ScrollView, Share, StyleSheet, Text, View } from "react-native";
import { BottomNav } from "@/components/bottom-nav";
import { apiBackend } from "@/services/api-backend";
import { papers, reportTypes, students } from "@/data/saa";
import { colors, spacing, thresholdColor } from "@/theme";

export default function ReportsScreen() {
  const [selected, setSelected] = useState(reportTypes[4]);
  const student = students[2];
  const message = `Dear ${student.name}, your attendance in ${papers[1].code} is ${student.attendance}%. Minimum required attendance is 75%. Please improve your attendance.`;

  const generate = async (format: "PDF" | "EXCEL") => {
    try {
      await apiBackend.generateReport({
        type: selected.includes("Diary") ? "TEACHING_DIARY" : selected.includes("Defaulter") ? "DEFAULTER" : "SUBJECT",
        format,
        title: selected,
        filters: { subjectCode: papers[1].code, semester: "Semester II" }
      });
      Alert.alert("Report generated", `${selected} is ready as ${format}.`);
    } catch {
      Alert.alert("Report queued", `${selected} will be generated when the server is reachable.`);
    }
  };

  const shareReport = async () => {
    try {
      await Share.share({ message });
    } catch {
      Alert.alert("Share unavailable", message);
    }
  };

  return (
    <View style={styles.shell}>
      <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
        <View style={styles.panel}>
          <Text style={styles.title}>Download Reports</Text>
          <Text style={styles.meta}>{papers[1].code} / Semester II / 2026-27</Text>
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
          <Pressable style={styles.primaryButton} onPress={() => generate("PDF")}>
            <Ionicons name="document" size={18} color="#fff" />
            <Text style={styles.primaryText}>PDF</Text>
          </Pressable>
          <Pressable style={styles.secondaryButton} onPress={() => generate("EXCEL")}>
            <Ionicons name="grid" size={18} color={colors.primaryDark} />
            <Text style={styles.secondaryText}>Excel</Text>
          </Pressable>
        </View>

        <View style={styles.panel}>
          <Text style={styles.panelTitle}>Defaulter Preview</Text>
          {students.filter((item) => item.attendance < 75).map((item) => (
            <View key={item.id} style={styles.studentRow}>
              <View>
                <Text style={styles.student}>{item.rollNumber}. {item.name}</Text>
                <Text style={styles.meta}>Classes attended {item.present} / {item.total}</Text>
              </View>
              <Text style={[styles.percent, { color: thresholdColor(item.attendance) }]}>{item.attendance}%</Text>
            </View>
          ))}
        </View>

        <View style={styles.panel}>
          <Text style={styles.panelTitle}>Share Report</Text>
          <Text style={styles.message}>{message}</Text>
          <View style={styles.channelRow}>
            {["WhatsApp", "Email", "Telegram"].map((item) => (
              <Pressable key={item} style={styles.channel} onPress={shareReport}>
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

const styles = StyleSheet.create({
  shell: { flex: 1, backgroundColor: colors.surface },
  screen: { flex: 1, backgroundColor: colors.surface },
  content: { padding: spacing.lg, gap: 12, paddingBottom: 28 },
  panel: { backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1, borderRadius: 12, padding: 16, gap: 10 },
  title: { color: colors.text, fontSize: 24, fontWeight: "900" },
  meta: { color: colors.muted, fontWeight: "700" },
  reportType: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1, borderRadius: 12, padding: 14 },
  activeReport: { borderColor: colors.primary, backgroundColor: "#f0fdf4" },
  reportText: { color: colors.text, fontWeight: "800", flex: 1 },
  activeReportText: { color: colors.primaryDark },
  buttonRow: { flexDirection: "row", gap: 12 },
  primaryButton: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7, backgroundColor: colors.primary, borderRadius: 12, padding: 15 },
  primaryText: { color: "#fff", fontWeight: "900" },
  secondaryButton: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7, borderWidth: 1, borderColor: colors.primary, borderRadius: 12, padding: 15 },
  secondaryText: { color: colors.primaryDark, fontWeight: "900" },
  panelTitle: { color: colors.text, fontSize: 18, fontWeight: "900" },
  studentRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 12, borderBottomWidth: 1, borderBottomColor: colors.border, paddingBottom: 10 },
  student: { color: colors.text, fontWeight: "900" },
  percent: { fontWeight: "900", fontSize: 17 },
  message: { color: colors.text, fontWeight: "700", lineHeight: 22, backgroundColor: "#f8fafc", borderRadius: 10, padding: 12 },
  channelRow: { flexDirection: "row", gap: 8 },
  channel: { flex: 1, alignItems: "center", gap: 6, borderColor: colors.border, borderWidth: 1, borderRadius: 10, padding: 12 },
  channelText: { color: colors.text, fontWeight: "800", fontSize: 12 }
});
