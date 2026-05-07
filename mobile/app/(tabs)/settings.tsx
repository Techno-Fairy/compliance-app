import { View, Text, Pressable, StyleSheet, Alert } from "react-native";
import { router } from "expo-router";
import { useAuthStore } from "@/store/auth";

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
    <View style={s.container}>
      <Text style={s.heading}>Settings</Text>
      <Text style={s.placeholder}>Week 5 — notifications, team invite, change password.</Text>
      <Pressable style={s.logoutBtn} onPress={handleLogout}>
        <Text style={s.logoutText}>Sign Out</Text>
      </Pressable>
    </View>
  );
}

const s = StyleSheet.create({
  container:   { flex: 1, padding: 24, backgroundColor: "#fff" },
  heading:     { fontSize: 24, fontWeight: "700", marginTop: 48, marginBottom: 16 },
  placeholder: { color: "#999", fontSize: 14, marginBottom: 32 },
  logoutBtn:   { borderWidth: 1, borderColor: "#c00", borderRadius: 8, padding: 14, alignItems: "center" },
  logoutText:  { color: "#c00", fontWeight: "600", fontSize: 15 },
});
