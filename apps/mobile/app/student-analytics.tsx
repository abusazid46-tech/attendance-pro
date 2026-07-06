import { Ionicons } from "@expo/vector-icons";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { BottomNav } from "@/components/bottom-nav";
import { monthlyTrend, papers, students } from "@/data/saa";
import { colors, spacing, thresholdColor } from "@/theme";

const present = students.reduce((sum, item) => sum + item.present, 0);
const total = students.reduce((sum, item) => sum + item.total, 0);
const absent = total - present;
const late = 9;

export default function StudentAnalyticsScreen() {
  const average = Math.round((present / total) * 100);
  const defaulters = students.filter((student) => student.attendance < 75);

  return (
    <View style={styles.shell}>
      <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
        <View style={styles.hero}>
          <Text style={styles.label}>LIS202 Attendance</Text>
          <Text style={[styles.overall, { color: thresholdColor(average) }]}>{average}%</Text>
          <Text style={styles.meta}>{present} present / {absent} absent / {late} late</Text>
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
          {students.map((item) => (
            <View key={item.id} style={styles.card}>
              <View style={styles.row}>
                <View style={styles.studentBlock}>
                  <Text style={styles.subject}>{item.rollNumber}. {item.name}</Text>
                  <Text style={styles.meta}>{item.present} attended out of {item.total}</Text>
                </View>
                <Text style={[styles.percent, { color: thresholdColor(item.attendance) }]}>{item.attendance}%</Text>
              </View>
              <View style={styles.track}>
                <View style={[styles.fill, { width: `${item.attendance}%`, backgroundColor: thresholdColor(item.attendance) }]} />
              </View>
            </View>
          ))}
        </View>

        <View style={styles.chartPanel}>
          <View style={styles.headerRow}>
            <Text style={styles.panelTitle}>Attendance Defaulters</Text>
            <Ionicons name="warning" size={20} color={colors.red} />
          </View>
          {defaulters.map((item) => (
            <View key={item.id} style={styles.defaulter}>
              <View>
                <Text style={styles.subject}>{item.rollNumber}. {item.name}</Text>
                <Text style={styles.meta}>{papers[1].code} / minimum required 75%</Text>
              </View>
              <Text style={[styles.percent, { color: thresholdColor(item.attendance) }]}>{item.attendance}%</Text>
            </View>
          ))}
        </View>

        <View style={styles.chartPanel}>
          <Text style={styles.panelTitle}>Monthly Attendance Trend</Text>
          {monthlyTrend.map((item) => (
            <View key={item.month} style={styles.trendRow}>
              <Text style={styles.month}>{item.month}</Text>
              <View style={styles.track}>
                <View style={[styles.fill, { width: `${item.percentage}%`, backgroundColor: thresholdColor(item.percentage) }]} />
              </View>
              <Text style={styles.trendPercent}>{item.percentage}%</Text>
            </View>
          ))}
        </View>
      </ScrollView>
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

const styles = StyleSheet.create({
  shell: { flex: 1, backgroundColor: colors.surface },
  screen: { flex: 1, backgroundColor: colors.surface },
  content: { padding: spacing.lg, gap: 14, paddingBottom: 28 },
  hero: { backgroundColor: colors.card, borderRadius: 12, borderWidth: 1, borderColor: colors.border, padding: 20 },
  label: { color: colors.muted, fontWeight: "800" },
  overall: { fontSize: 54, fontWeight: "900", marginTop: 6 },
  meta: { color: colors.muted, marginTop: 5, fontWeight: "700" },
  chartPanel: { backgroundColor: colors.card, borderRadius: 12, borderWidth: 1, borderColor: colors.border, padding: 16, gap: 12 },
  panelTitle: { color: colors.text, fontSize: 18, fontWeight: "900" },
  pieRow: { flexDirection: "row", justifyContent: "space-between", gap: 10 },
  pieSegment: { alignItems: "center", flex: 1 },
  pieCircle: { width: 78, height: 78, borderRadius: 39, borderWidth: 8, alignItems: "center", justifyContent: "center" },
  pieValue: { fontWeight: "900", fontSize: 18 },
  pieLabel: { color: colors.text, fontWeight: "800", marginTop: 8 },
  card: { borderBottomWidth: 1, borderBottomColor: colors.border, paddingBottom: 12 },
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 12 },
  studentBlock: { flex: 1 },
  subject: { color: colors.text, fontWeight: "900" },
  percent: { fontWeight: "900", fontSize: 17 },
  track: { height: 10, borderRadius: 999, backgroundColor: "#e2e8f0", marginTop: 10, flex: 1 },
  fill: { height: 10, borderRadius: 999 },
  headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  defaulter: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12, borderBottomWidth: 1, borderBottomColor: colors.border, paddingBottom: 12 },
  trendRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  month: { width: 34, color: colors.text, fontWeight: "900" },
  trendPercent: { width: 44, textAlign: "right", color: colors.muted, fontWeight: "900" }
});
