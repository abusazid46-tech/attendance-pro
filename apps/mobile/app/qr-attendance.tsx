import { View, StyleSheet } from "react-native";
import { BottomNav } from "@/components/bottom-nav";
import { colors } from "@/theme";

export default function QrAttendanceScreen() {
  return (
    <View style={styles.shell}>
      <View style={styles.screen} />
      <BottomNav />
    </View>
  );
}

const styles = StyleSheet.create({
  shell: { flex: 1, backgroundColor: colors.surface },
  screen: { flex: 1, backgroundColor: colors.surface }
});
