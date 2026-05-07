import { useState } from "react";
import {
  View, Text, TextInput, Pressable,
  StyleSheet, ActivityIndicator, Alert,
} from "react-native";
import { router } from "expo-router";
import { useAuthStore } from "@/store/auth";

export default function LoginScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const login = useAuthStore((s) => s.login);

  const handleLogin = async () => {
    if (!email.trim() || !password) {
      Alert.alert("Validation", "Please enter your email and password.");
      return;
    }
    setLoading(true);
    try {
      await login(email.trim().toLowerCase(), password);
      router.replace("/(tabs)");
    } catch {
      Alert.alert("Login Failed", "Invalid email or password. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={s.container}>
      <Text style={s.title}>Sign In</Text>
      <TextInput
        style={s.input} placeholder="Email" value={email}
        onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address"
      />
      <TextInput
        style={s.input} placeholder="Password" value={password}
        onChangeText={setPassword} secureTextEntry
      />
      <Pressable style={[s.button, loading && s.disabled]} onPress={handleLogin} disabled={loading}>
        {loading
          ? <ActivityIndicator color="#fff" />
          : <Text style={s.buttonText}>Sign In</Text>
        }
      </Pressable>
      <Pressable onPress={() => router.push("/(auth)/register")}>
        <Text style={s.link}>Don't have an account? Register</Text>
      </Pressable>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, justifyContent: "center", padding: 24, backgroundColor: "#fff" },
  title:     { fontSize: 28, fontWeight: "700", marginBottom: 32, color: "#111" },
  input:     { borderWidth: 1, borderColor: "#ccc", borderRadius: 8, padding: 14, marginBottom: 16, fontSize: 16 },
  button:    { backgroundColor: "#111", borderRadius: 8, padding: 16, alignItems: "center", marginTop: 8 },
  disabled:  { opacity: 0.6 },
  buttonText:{ color: "#fff", fontSize: 16, fontWeight: "600" },
  link:      { textAlign: "center", marginTop: 20, color: "#555", fontSize: 14 },
});
