import { useState } from "react";
import {
  View, Text, TextInput, Pressable,
  StyleSheet, ActivityIndicator, Alert, ScrollView,
} from "react-native";
import { router } from "expo-router";
import { useAuthStore } from "@/store/auth";

export default function RegisterScreen() {
  const [fullName, setFullName] = useState("");
  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm]   = useState("");
  const [loading, setLoading]   = useState(false);
  const register = useAuthStore((s) => s.register);

  const handleRegister = async () => {
    if (!fullName.trim() || fullName.trim().length < 2)
      return Alert.alert("Validation", "Please enter your full name.");
    if (!email.includes("@"))
      return Alert.alert("Validation", "Enter a valid email address.");
    if (password.length < 8)
      return Alert.alert("Validation", "Password must be at least 8 characters.");
    if (password !== confirm)
      return Alert.alert("Validation", "Passwords do not match.");

    setLoading(true);
    try {
      await register(fullName.trim(), email.trim().toLowerCase(), password);
      router.replace("/(tabs)");
    } catch (err: any) {
      const msg = err?.response?.data?.detail?.message ?? "Registration failed. Try again.";
      Alert.alert("Error", msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={s.container}>
      <Text style={s.title}>Create Account</Text>
      <TextInput style={s.input} placeholder="Full Name" value={fullName} onChangeText={setFullName} />
      <TextInput style={s.input} placeholder="Email" value={email} onChangeText={setEmail}
        autoCapitalize="none" keyboardType="email-address" />
      <TextInput style={s.input} placeholder="Password (min 8 characters)"
        value={password} onChangeText={setPassword} secureTextEntry />
      <TextInput style={s.input} placeholder="Confirm Password"
        value={confirm} onChangeText={setConfirm} secureTextEntry />
      <Pressable style={[s.button, loading && s.disabled]} onPress={handleRegister} disabled={loading}>
        {loading
          ? <ActivityIndicator color="#fff" />
          : <Text style={s.buttonText}>Register</Text>
        }
      </Pressable>
      <Pressable onPress={() => router.push("/(auth)/login")}>
        <Text style={s.link}>Already have an account? Sign In</Text>
      </Pressable>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  container: { flexGrow: 1, justifyContent: "center", padding: 24, backgroundColor: "#fff" },
  title:     { fontSize: 28, fontWeight: "700", marginBottom: 32, color: "#111" },
  input:     { borderWidth: 1, borderColor: "#ccc", borderRadius: 8, padding: 14, marginBottom: 16, fontSize: 16 },
  button:    { backgroundColor: "#111", borderRadius: 8, padding: 16, alignItems: "center", marginTop: 8 },
  disabled:  { opacity: 0.6 },
  buttonText:{ color: "#fff", fontSize: 16, fontWeight: "600" },
  link:      { textAlign: "center", marginTop: 20, color: "#555", fontSize: 14 },
});
