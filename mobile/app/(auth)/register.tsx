import { useState } from "react";
import {
  View, Text, TextInput, Pressable,
  StyleSheet, ActivityIndicator, Alert, ScrollView,
  Modal, Image, TouchableOpacity,
} from "react-native";
import { router } from "expo-router";
import { useAuthStore } from "@/store/auth";
import { MaterialIcons, Ionicons } from "@expo/vector-icons";
import { useFonts, PublicSans_400Regular, PublicSans_600SemiBold, PublicSans_700Bold } from "@expo-google-fonts/public-sans";

// Custom checkbox using Pressable – no native dependencies
const CustomCheckbox = ({ value, onValueChange }: { value: boolean; onValueChange: (val: boolean) => void }) => {
  return (
    <Pressable
      onPress={() => onValueChange(!value)}
      style={({ pressed }) => ({
        width: 22,
        height: 22,
        borderRadius: 6,
        borderWidth: 2,
        borderColor: value ? "#4b5e87" : "#c5c6cf",
        backgroundColor: value ? "#4b5e87" : "transparent",
        justifyContent: "center",
        alignItems: "center",
        opacity: pressed ? 0.7 : 1,
      })}
    >
      {value && <MaterialIcons name="check" size={16} color="#fff" />}
    </Pressable>
  );
};

export default function RegisterScreen() {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [agreeTerms, setAgreeTerms] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const register = useAuthStore((s) => s.register);

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

  const validateEmail = (email: string) => {
    const re = /^[^\s@]+@([^\s@.,]+\.)+[^\s@.,]{2,}$/;
    return re.test(email.toLowerCase());
  };

  const handleRegister = async () => {
    const trimmedName = fullName.trim();
    const trimmedEmail = email.trim().toLowerCase();

    if (trimmedName.length < 2) {
      return Alert.alert("Validation", "Please enter your full name.");
    }
    if (!validateEmail(trimmedEmail)) {
      return Alert.alert("Validation", "Enter a valid email address.");
    }
    if (password.length < 8) {
      return Alert.alert("Validation", "Password must be at least 8 characters.");
    }
    if (password !== confirm) {
      return Alert.alert("Validation", "Passwords do not match.");
    }
    if (!agreeTerms) {
      return Alert.alert("Validation", "You must agree to the Terms of Service and Privacy Policy.");
    }

    setLoading(true);
    try {
      await register(trimmedName, trimmedEmail, password);
      setShowSuccess(true);
    } catch (err: any) {
      const msg = err?.response?.data?.detail?.message ?? "Registration failed. Try again.";
      Alert.alert("Error", msg);
    } finally {
      setLoading(false);
    }
  };

  // Navigate to business profile setup after dismissing the success modal
  const handleSuccessClose = () => {
    setShowSuccess(false);
    router.replace("/business-profile");
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
        <Text style={styles.title}>Create Account</Text>
        <Text style={styles.subtitle}>
          Secure your business standing with professional regulatory monitoring.
        </Text>
      </View>

      {/* Form Fields */}
      <View style={styles.form}>
        {/* Full Name */}
        <View style={styles.field}>
          <Text style={styles.label}>FULL NAME</Text>
          <View style={styles.inputContainer}>
            <MaterialIcons name="person" size={20} color="#44474e" style={styles.leftIcon} />
            <TextInput
              style={styles.input}
              placeholder="Motsamai Kgosi"
              placeholderTextColor="#a0a3ab"
              value={fullName}
              onChangeText={setFullName}
            />
          </View>
        </View>

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

        {/* Confirm Password */}
        <View style={styles.field}>
          <Text style={styles.label}>CONFIRM PASSWORD</Text>
          <View style={styles.inputContainer}>
            <MaterialIcons name="lock-reset" size={20} color="#44474e" style={styles.leftIcon} />
            <TextInput
              style={styles.input}
              placeholder="••••••••"
              placeholderTextColor="#a0a3ab"
              secureTextEntry={!showConfirm}
              value={confirm}
              onChangeText={setConfirm}
            />
            <TouchableOpacity onPress={() => setShowConfirm(!showConfirm)} style={styles.rightIcon}>
              <Ionicons name={showConfirm ? "eye-off" : "eye"} size={20} color="#44474e" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Terms Checkbox */}
        <View style={styles.termsRow}>
          <CustomCheckbox value={agreeTerms} onValueChange={setAgreeTerms} />
          <Text style={styles.termsText}>
            I agree to the{" "}
            <Text style={styles.linkText}>Terms of Service</Text> and{" "}
            <Text style={styles.linkText}>Privacy Policy</Text> regarding BURS and CIPA data processing.
          </Text>
        </View>

        {/* Register Button */}
        <Pressable
          style={[styles.registerButton, loading && styles.disabled]}
          onPress={handleRegister}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#ffffff" />
          ) : (
            <>
              <Text style={styles.registerText}>Register</Text>
              <MaterialIcons name="arrow-forward" size={20} color="#ffffff" />
            </>
          )}
        </Pressable>

        {/* Login Link */}
        <View style={styles.loginContainer}>
          <Text style={styles.loginText}>Already have an account?</Text>
          <TouchableOpacity onPress={() => router.push("/(auth)/login")}>
            <Text style={styles.loginLink}> Login</Text>
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
              Professional Compliance Management for Botswana Enterprises
            </Text>
          </View>
        </View>
      </View>

      {/* Success Modal */}
      <Modal visible={showSuccess} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.successIcon}>
              <Ionicons name="checkmark-circle" size={64} color="#307231" />
            </View>
            <Text style={styles.modalTitle}>Registration Successful</Text>
            <Text style={styles.modalMessage}>
              Account created successfully. Let's set up your business profile.
            </Text>
            <Pressable style={styles.modalButton} onPress={handleSuccessClose}>
              <Text style={styles.modalButtonText}>Set Up Business</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

// ----- Styles -----
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
  termsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginTop: 8,
  },
  termsText: {
    flex: 1,
    fontSize: 14,
    fontFamily: "PublicSans_400Regular",
    color: "#44474e",
    lineHeight: 20,
  },
  linkText: {
    fontFamily: "PublicSans_600SemiBold",
    color: "#2a6b2c",
  },
  registerButton: {
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
  registerText: {
    fontSize: 20,
    fontFamily: "PublicSans_600SemiBold",
    color: "#ffffff",
  },
  loginContainer: {
    flexDirection: "row",
    justifyContent: "center",
    marginTop: 24,
    marginBottom: 16,
  },
  loginText: {
    fontSize: 14,
    fontFamily: "PublicSans_400Regular",
    color: "#44474e",
  },
  loginLink: {
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
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(243, 250, 255, 0.95)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 24,
  },
  modalCard: {
    backgroundColor: "#ffffff",
    borderRadius: 12,
    padding: 24,
    alignItems: "center",
    width: "100%",
    maxWidth: 320,
    borderWidth: 1,
    borderColor: "#c5c6cf",
  },
  successIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "#acf4a4",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 24,
    fontFamily: "PublicSans_600SemiBold",
    color: "#000b25",
    marginBottom: 8,
  },
  modalMessage: {
    fontSize: 14,
    fontFamily: "PublicSans_400Regular",
    color: "#44474e",
    textAlign: "center",
    marginBottom: 24,
  },
  modalButton: {
    backgroundColor: "#000b25",
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
  },
  modalButtonText: {
    fontSize: 20,
    fontFamily: "PublicSans_600SemiBold",
    color: "#ffffff",
  },
});