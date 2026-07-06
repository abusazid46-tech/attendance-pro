import QRCode from "react-native-qrcode-svg";
import { View, Text, StyleSheet } from "react-native";
import { colors, spacing } from "@/theme";

export default function QrAttendanceScreen() {
  const token = "demo-secure-token-refreshes-from-api";
  return (
    <View style={styles.screen}>
      <Text style={styles.title}>QR Attendance</Text>
      <Text style={styles.subtitle}>Token validity: 5 minutes</Text>
      <View style={styles.qr}>
        <QRCode value={token} size={220} />
      </View>
      <Text style={styles.note}>In production this screen calls `/qr-attendance/sessions`, encrypts the token, and refreshes on expiry.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.surface, padding: spacing.xl },
  title: { fontSize: 28, fontWeight: "900", color: colors.text },
  subtitle: { color: colors.muted, marginTop: 6, marginBottom: 24 },
  qr: { padding: 18, borderRadius: 14, backgroundColor: "#fff", borderWidth: 1, borderColor: colors.border },
  note: { textAlign: "center", color: colors.muted, marginTop: 22, lineHeight: 22 }
});
