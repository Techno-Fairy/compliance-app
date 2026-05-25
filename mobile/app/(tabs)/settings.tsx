import { View, Text, Pressable, StyleSheet, Alert, ScrollView } from "react-native";
import { router } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { MaterialIcons } from "@expo/vector-icons";
import { useAuthStore } from "@/store/auth";

const C = {
  bg:        "#f3faff",
  surface:   "#ffffff",
  primary:   "#000b25",
  mid:       "#44474e",
  muted:     "#75777f",
  border:    "#c5c6cf",
  borderSoft:"#e6f6ff",
  container: "#dbf1fe",
  error:     "#ba1a1a",
  errorBg:   "#ffdad6",
  burs:      "#1A3C5E",
  bursBg:    "#EAF0F7",
};

function SettingsRow({ icon, label, onPress, destructive }: {
  icon: string; label: string; onPress: () => void; destructive?: boolean;
}) {
  return (
    <Pressable style={({ pressed }) => [s.row, pressed && { opacity: 0.7 }]} onPress={onPress}>
      <View style={[s.rowIcon, destructive && s.rowIconDestructive]}>
        <MaterialIcons name={icon as any} size={20} color={destructive ? C.error : C.burs} />
      </View>
      <Text style={[s.rowLabel, destructive && { color: C.error }]}>{label}</Text>
      <MaterialIcons name="chevron-right" size={18} color={C.border} />
    </Pressable>
  );
}

export default function SettingsScreen() {
  const logout = useAuthStore((s) => s.logout);

  const handleLogout = () => {
    Alert.alert("Sign Out", "Are you sure you want to sign out?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Sign Out", style: "destructive",
        onPress: async () => {
          await logout();
          router.replace("/(auth)/login");
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={s.safe} edges={["top"]}>
      <View style={s.header}>
        <Text style={s.title}>Settings</Text>
      </View>
      <ScrollView style={s.scroll} contentContainerStyle={s.body} showsVerticalScrollIndicator={false}>
        <Text style={s.section}>COMPLIANCE</Text>
        <View style={s.card}>
          <SettingsRow icon="history" label="Filing History" onPress={() => router.push("/history" as any)} />
        </View>

        <Text style={s.section}>ACCOUNT</Text>
        <View style={s.card}>
          <SettingsRow icon="notifications" label="Notification Preferences" onPress={() => Alert.alert("Coming in Week 4")} />
          <View style={s.divider} />
          <SettingsRow icon="group" label="Invite Team Member" onPress={() => Alert.alert("Coming in Week 5")} />
          <View style={s.divider} />
          <SettingsRow icon="lock" label="Change Password" onPress={() => Alert.alert("Coming in Week 5")} />
        </View>

        <Text style={s.section}>DANGER ZONE</Text>
        <View style={s.card}>
          <SettingsRow icon="logout" label="Sign Out" onPress={handleLogout} destructive />
          <View style={s.divider} />
          <SettingsRow icon="delete-forever" label="Delete Account" onPress={() => Alert.alert("Coming in Week 5")} destructive />
        </View>

        <Text style={s.version}>CompliancePro Botswana  ·  v1.0.0-dev</Text>
        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:    { flex: 1, backgroundColor: C.bg },
  header:  { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 12, backgroundColor: C.container, borderBottomWidth: 1, borderBottomColor: C.border },
  title:   { fontSize: 22, fontFamily: "PublicSans_700Bold", color: C.primary },
  scroll:  { flex: 1 },
  body:    { padding: 16 },
  section: { fontSize: 10, fontFamily: "PublicSans_700Bold", color: C.muted, letterSpacing: 1.2, textTransform: "uppercase", marginBottom: 8, marginTop: 16, paddingHorizontal: 4 },
  card:    { backgroundColor: C.surface, borderRadius: 12, borderWidth: 1, borderColor: C.border, overflow: "hidden" },
  divider: { height: 1, backgroundColor: C.borderSoft, marginHorizontal: 16 },
  row:     { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 14, gap: 12 },
  rowIcon: { width: 34, height: 34, borderRadius: 8, backgroundColor: C.bursBg, alignItems: "center", justifyContent: "center" },
  rowIconDestructive: { backgroundColor: C.errorBg },
  rowLabel:{ flex: 1, fontSize: 14, fontFamily: "PublicSans_600SemiBold", color: C.primary },
  version: { fontSize: 11, color: C.muted, textAlign: "center", marginTop: 24 },
});