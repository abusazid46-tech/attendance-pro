import { Link, usePathname } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors } from "@/theme";

const tabs = [
  { href: "/dashboard", label: "My Dashboard", icon: "home-outline" },
  { href: "/take-attendance", label: "Take Attendance", icon: "checkbox-outline" },
  { href: "/student-analytics", label: "Analytics", icon: "bar-chart-outline" },
  { href: "/reports", label: "Reports", icon: "document-text-outline" },
  { href: "/backup-restore", label: "Settings", icon: "settings-outline" }
] as const;

export function BottomNav() {
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const bottomPadding = Math.max(insets.bottom, 18);

  return (
    <View style={[styles.wrap, { paddingBottom: bottomPadding }]}>
      {tabs.map((tab) => {
        const active = pathname === tab.href;
        return (
          <Link key={tab.href} href={tab.href} asChild>
            <Pressable style={styles.item}>
              <View style={[styles.iconBadge, active && styles.activeIconBadge]}>
                <Ionicons name={tab.icon} size={17} color={active ? "#fff" : colors.muted} />
              </View>
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
    backgroundColor: "#eef5f1",
    paddingTop: 9,
    minHeight: 80
  },
  item: { alignItems: "center", justifyContent: "center", flex: 1, gap: 4, minHeight: 48 },
  iconBadge: { width: 26, height: 26, borderRadius: 13, alignItems: "center", justifyContent: "center", backgroundColor: "#ffffff", borderWidth: 1, borderColor: "#b7e4c7" },
  activeIconBadge: { backgroundColor: colors.primary, borderColor: colors.primary },
  iconText: { color: colors.muted, fontSize: 13, fontWeight: "900" },
  activeIconText: { color: "#fff" },
  label: { color: colors.muted, fontSize: 10, fontWeight: "900", textAlign: "center" },
  activeLabel: { color: colors.primaryDark }
});
