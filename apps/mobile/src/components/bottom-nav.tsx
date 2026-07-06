import { Ionicons } from "@expo/vector-icons";
import { Link, usePathname } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors } from "@/theme";

const tabs = [
  { href: "/dashboard", label: "Home", icon: "home" },
  { href: "/take-attendance", label: "Class", icon: "add-circle" },
  { href: "/student-analytics", label: "Analytics", icon: "analytics" },
  { href: "/reports", label: "Reports", icon: "document-text" },
  { href: "/backup-restore", label: "Backup", icon: "cloud-upload" }
] as const;

export function BottomNav() {
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const bottomPadding = Math.max(insets.bottom, 20);

  return (
    <View style={[styles.wrap, { paddingBottom: bottomPadding }]}>
      {tabs.map((tab) => {
        const active = pathname === tab.href;
        return (
          <Link key={tab.href} href={tab.href} asChild>
            <Pressable style={styles.item}>
              <Ionicons name={tab.icon} size={22} color={active ? colors.primaryDark : colors.muted} />
              <Text style={[styles.label, active && styles.activeLabel]}>{tab.label}</Text>
            </Pressable>
          </Link>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.card,
    paddingTop: 10,
    minHeight: 78
  },
  item: { alignItems: "center", justifyContent: "center", flex: 1, gap: 4, minHeight: 48 },
  label: { color: colors.muted, fontSize: 11, fontWeight: "900" },
  activeLabel: { color: colors.primaryDark }
});
