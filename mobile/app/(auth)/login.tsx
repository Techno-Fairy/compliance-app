// mobile/app/(auth)/login.tsx
import { useState } from "react";
import {
  View, Text, TextInput, Pressable,
  StyleSheet, ActivityIndicator, Alert, ScrollView,
  TouchableOpacity, Image,
} from "react-native";
import { router } from "expo-router";
import { useAuthStore } from "@/store/auth";
import { api } from "@/lib/api";
import { MaterialIcons, Ionicons } from "@expo/vector-icons";
import { useFonts, PublicSans_400Regular, PublicSans_600SemiBold, PublicSans_700Bold } from "@expo-google-fonts/public-sans";

export default function LoginScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const login = useAuthStore((s) => s.login);

  const [fontsLoaded] = useFonts({
    PublicSans_400Regular,
    PublicSans_600SemiBold,
    PublicSans_700Bold,
  });

  if (!fontsLoaded) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#4b5e87" />
      </View>
    );
  }

  const handleLogin = async () => {
    const trimmedEmail = email.trim().toLowerCase();
    if (!trimmedEmail.includes("@")) {
      return Alert.alert("Validation", "Enter a valid email address.");
    }
    if (password.length === 0) {
      return Alert.alert("Validation", "Password is required.");
    }

    setLoading(true);
    try {
      await login(trimmedEmail, password);
      // After successful login, check if business profile exists
      const profileCheck = await api.get("/business/profile").catch(() => null);
      if (profileCheck && profileCheck.status === 200) {
        router.replace("/(tabs)");
      } else {
        router.replace("/business-profile"); // now at root level
      }
    } catch (err: any) {
      const msg = err?.response?.data?.detail?.message ?? "Invalid credentials. Try again.";
      Alert.alert("Login Failed", msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
      {/* Header with back button */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <MaterialIcons name="arrow-back" size={24} color="#000b25" />
        </TouchableOpacity>
      </View>

      {/* Brand & Intro */}
      <View style={styles.introSection}>
        <Text style={styles.title}>Welcome Back</Text>
        <Text style={styles.subtitle}>
          Sign in to continue managing your compliance dashboard.
        </Text>
      </View>

      {/* Form Fields */}
      <View style={styles.form}>
        {/* Email */}
        <View style={styles.field}>
          <Text style={styles.label}>EMAIL ADDRESS</Text>
          <View style={styles.inputContainer}>
            <MaterialIcons name="mail" size={20} color="#44474e" style={styles.leftIcon} />
            <TextInput
              style={styles.input}
              placeholder="motsamai@business.bw"
              placeholderTextColor="#a0a3ab"
              autoCapitalize="none"
              keyboardType="email-address"
              value={email}
              onChangeText={setEmail}
            />
          </View>
        </View>

        {/* Password */}
        <View style={styles.field}>
          <Text style={styles.label}>PASSWORD</Text>
          <View style={styles.inputContainer}>
            <MaterialIcons name="lock" size={20} color="#44474e" style={styles.leftIcon} />
            <TextInput
              style={styles.input}
              placeholder="••••••••"
              placeholderTextColor="#a0a3ab"
              secureTextEntry={!showPassword}
              value={password}
              onChangeText={setPassword}
            />
            <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={styles.rightIcon}>
              <Ionicons name={showPassword ? "eye-off" : "eye"} size={20} color="#44474e" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Sign In Button */}
        <Pressable
          style={[styles.loginButton, loading && styles.disabled]}
          onPress={handleLogin}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#ffffff" />
          ) : (
            <>
              <Text style={styles.loginText}>Sign In</Text>
              <MaterialIcons name="arrow-forward" size={20} color="#ffffff" />
            </>
          )}
        </Pressable>

        {/* Register Link */}
        <View style={styles.registerContainer}>
          <Text style={styles.registerText}>Don't have an account?</Text>
          <TouchableOpacity onPress={() => router.push("/(auth)/register")}>
            <Text style={styles.registerLink}> Register</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Decorative Footer */}
      <View style={styles.footer}>
        <View style={styles.encryptedBadge}>
          <MaterialIcons name="verified-user" size={16} color="#2a6b2c" />
          <Text style={styles.encryptedText}>END-TO-END ENCRYPTED</Text>
        </View>
        <View style={styles.imageWrapper}>
          <Image
            source={{ uri: "https://lh3.googleusercontent.com/aida-public/AB6AXuAiTHY3nqAQToUR5h9n1BQHoastxzSVu3Dvftcdt0vvot0jUWvtzpChHXDiFYDSXhVpNzEN4vyIkPWo_QBS3Ya8AZ_ApIgcfBg_K868mA7hqC-odDffROhaEh_Btu_r0oMB64Hy8Y3UygLDmJFbYgcYAbav4xOBmqmshJnCsXSkSDmA-vyeE5vcyPdyR-W7W_z4eHU0UzJqVuZhvQRR1BkrrqtuUFVzulI5Kp3mNikkoKwvMKfv2aA1Jv9M5fnWBaVcRCu4J07ogCnH" }}
            style={styles.footerImage}
            resizeMode="cover"
          />
          <View style={styles.imageOverlay}>
            <Text style={styles.imageCaption}>
              Secure access to BURS, CIPA, and Labour compliance data.
            </Text>
          </View>
        </View>
      </View>
    </ScrollView>
  );
}

// ----- Styles (matching register screen) -----
const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#f3faff",
  },
  container: {
    flexGrow: 1,
    backgroundColor: "#f3faff",
    paddingHorizontal: 16,
    paddingBottom: 32,
  },
  header: {
    height: 64,
    justifyContent: "center",
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
  },
  introSection: {
    marginTop: 8,
    marginBottom: 32,
  },
  title: {
    fontSize: 32,
    fontFamily: "PublicSans_700Bold",
    color: "#000b25",
    marginBottom: 6,
    letterSpacing: -0.64,
  },
  subtitle: {
    fontSize: 16,
    fontFamily: "PublicSans_400Regular",
    color: "#44474e",
    lineHeight: 24,
  },
  form: {
    gap: 20,
  },
  field: {
    gap: 4,
  },
  label: {
    fontSize: 12,
    fontFamily: "PublicSans_600SemiBold",
    letterSpacing: 0.6,
    color: "#44474e",
    marginLeft: 4,
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#c5c6cf",
    borderRadius: 12,
    height: 52,
  },
  leftIcon: {
    marginLeft: 16,
  },
  rightIcon: {
    marginRight: 16,
  },
  input: {
    flex: 1,
    fontSize: 16,
    fontFamily: "PublicSans_400Regular",
    color: "#071e27",
    paddingVertical: 12,
    paddingHorizontal: 12,
  },
  loginButton: {
    backgroundColor: "#000b25",
    borderRadius: 12,
    paddingVertical: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginTop: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  disabled: {
    opacity: 0.6,
  },
  loginText: {
    fontSize: 20,
    fontFamily: "PublicSans_600SemiBold",
    color: "#ffffff",
  },
  registerContainer: {
    flexDirection: "row",
    justifyContent: "center",
    marginTop: 24,
    marginBottom: 16,
  },
  registerText: {
    fontSize: 14,
    fontFamily: "PublicSans_400Regular",
    color: "#44474e",
  },
  registerLink: {
    fontSize: 14,
    fontFamily: "PublicSans_700Bold",
    color: "#000b25",
    marginLeft: 4,
  },
  footer: {
    marginTop: 32,
    alignItems: "center",
  },
  encryptedBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#dbf1fe",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#c5c6cf",
    marginBottom: 24,
  },
  encryptedText: {
    fontSize: 12,
    fontFamily: "PublicSans_600SemiBold",
    color: "#307231",
    letterSpacing: 0.6,
  },
  imageWrapper: {
    width: "100%",
    maxWidth: 320,
    height: 192,
    borderRadius: 12,
    overflow: "hidden",
    position: "relative",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  footerImage: {
    width: "100%",
    height: "100%",
  },
  imageOverlay: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "rgba(243, 250, 255, 0.8)",
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  imageCaption: {
    fontSize: 11,
    fontFamily: "PublicSans_400Regular",
    color: "#44474e",
    textAlign: "center",
    fontStyle: "italic",
  },
});