// mobile/app/(auth)/register.tsx
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

const CustomCheckbox = ({ value, onValueChange }: { value: boolean; onValueChange: (val: boolean) => void }) => (
  <Pressable
    onPress={() => onValueChange(!value)}
    style={({ pressed }) => ({
      width: 20, height: 20, borderRadius: 5,
      borderWidth: 1.5, borderColor: value ? "#000b25" : "#c5c6cf",
      backgroundColor: value ? "#000b25" : "transparent",
      justifyContent: "center", alignItems: "center", opacity: pressed ? 0.7 : 1,
    })}
  >
    {value && <MaterialIcons name="check" size={13} color="#fff" />}
  </Pressable>
);

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

  const [fontsLoaded] = useFonts({ PublicSans_400Regular, PublicSans_600SemiBold, PublicSans_700Bold });
  if (!fontsLoaded) return <View style={s.loading}><ActivityIndicator size="large" color="#000b25" /></View>;

  const validateEmail = (e: string) => /^[^\s@]+@([^\s@.,]+\.)+[^\s@.,]{2,}$/.test(e.toLowerCase());

  const handleRegister = async () => {
    const name = fullName.trim();
    const mail = email.trim().toLowerCase();
    if (name.length < 2) return Alert.alert("Validation", "Please enter your full name.");
    if (!validateEmail(mail)) return Alert.alert("Validation", "Enter a valid email address.");
    if (password.length < 8) return Alert.alert("Validation", "Password must be at least 8 characters.");
    if (password !== confirm) return Alert.alert("Validation", "Passwords do not match.");
    if (!agreeTerms) return Alert.alert("Validation", "You must agree to the Terms of Service and Privacy Policy.");
    setLoading(true);
    try {
      await register(name, mail, password);
      setShowSuccess(true);
    } catch (err: any) {
      Alert.alert("Error", err?.response?.data?.detail?.message ?? "Registration failed. Try again.");
    } finally { setLoading(false); }
  };

  const handleSuccessClose = () => { setShowSuccess(false); router.replace("/business-profile"); };

  const Field = ({ label, placeholder, value, onChange, secure, showToggle, onToggle, keyType = "default" }: any) => (
    <View style={s.field}>
      <Text style={s.label}>{label}</Text>
      <View style={s.inputWrap}>
        <View style={s.inputIcon}><MaterialIcons name={secure !== undefined ? "lock" : label.toLowerCase().includes("email") ? "mail" : "person"} size={18} color="#44474e" /></View>
        <TextInput
          style={[s.input, showToggle && { paddingRight: 48 }]}
          placeholder={placeholder} placeholderTextColor="#a0a3ab"
          autoCapitalize="none" keyboardType={keyType}
          secureTextEntry={secure && !showToggle}
          value={value} onChangeText={onChange}
        />
        {onToggle && (
          <TouchableOpacity style={s.eye} onPress={onToggle}>
            <Ionicons name={showToggle ? "eye-off" : "eye"} size={18} color="#44474e" />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );

  return (
    <ScrollView contentContainerStyle={s.container} showsVerticalScrollIndicator={false}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
          <MaterialIcons name="arrow-back" size={22} color="#000b25" />
        </TouchableOpacity>
      </View>

      {/* Intro */}
      <View style={s.intro}>
        <Text style={s.title}>Create Account</Text>
        <Text style={s.sub}>Secure your business standing with professional regulatory monitoring.</Text>
      </View>

      {/* Form */}
      <View style={s.form}>
        <Field label="FULL NAME" placeholder="Motsamai Kgosi" value={fullName} onChange={setFullName} />
        <Field label="EMAIL ADDRESS" placeholder="motsamai@business.bw" value={email} onChange={setEmail} keyType="email-address" />
        <View style={s.field}>
          <Text style={s.label}>PASSWORD</Text>
          <View style={s.inputWrap}>
            <View style={s.inputIcon}><MaterialIcons name="lock" size={18} color="#44474e" /></View>
            <TextInput style={[s.input, { paddingRight: 48 }]} placeholder="••••••••" placeholderTextColor="#a0a3ab"
              secureTextEntry={!showPassword} value={password} onChangeText={setPassword} />
            <TouchableOpacity style={s.eye} onPress={() => setShowPassword(!showPassword)}>
              <Ionicons name={showPassword ? "eye-off" : "eye"} size={18} color="#44474e" />
            </TouchableOpacity>
          </View>
        </View>
        <View style={s.field}>
          <Text style={s.label}>CONFIRM PASSWORD</Text>
          <View style={s.inputWrap}>
            <View style={s.inputIcon}><MaterialIcons name="lock-outline" size={18} color="#44474e" /></View>
            <TextInput style={[s.input, { paddingRight: 48 }]} placeholder="••••••••" placeholderTextColor="#a0a3ab"
              secureTextEntry={!showConfirm} value={confirm} onChangeText={setConfirm} />
            <TouchableOpacity style={s.eye} onPress={() => setShowConfirm(!showConfirm)}>
              <Ionicons name={showConfirm ? "eye-off" : "eye"} size={18} color="#44474e" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Terms */}
        <View style={s.termsRow}>
          <CustomCheckbox value={agreeTerms} onValueChange={setAgreeTerms} />
          <Text style={s.termsText}>
            I agree to the <Text style={s.link}>Terms of Service</Text> and <Text style={s.link}>Privacy Policy</Text> regarding BURS and CIPA data processing.
          </Text>
        </View>

        {/* Register button */}
        <Pressable style={[s.btn, loading && s.btnDisabled]} onPress={handleRegister} disabled={loading}>
          {loading ? <ActivityIndicator color="#fff" /> : (
            <><Text style={s.btnText}>Register</Text><MaterialIcons name="arrow-forward" size={20} color="#fff" /></>
          )}
        </Pressable>

        <View style={s.loginRow}>
          <Text style={s.loginText}>Already have an account?</Text>
          <TouchableOpacity onPress={() => router.push("/(auth)/login")}>
            <Text style={s.loginLink}> Login</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Decorative footer */}
      <View style={s.footer}>
        <View style={s.encBadge}>
          <MaterialIcons name="verified-user" size={15} color="#2a6b2c" />
          <Text style={s.encText}>END-TO-END ENCRYPTED</Text>
        </View>
        <View style={s.imgWrap}>
          <Image
            source={{ uri: "https://lh3.googleusercontent.com/aida-public/AB6AXuAiTHY3nqAQToUR5h9n1BQHoastxzSVu3Dvftcdt0vvot0jUWvtzpChHXDiFYDSXhVpNzEN4vyIkPWo_QBS3Ya8AZ_ApIgcfBg_K868mA7hqC-odDffROhaEh_Btu_r0oMB64Hy8Y3UygLDmJFbYgcYAbav4xOBmqmshJnCsXSkSDmA-vyeE5vcyPdyR-W7W_z4eHU0UzJqVuZhvQRR1BkrrqtuUFVzulI5Kp3mNikkoKwvMKfv2aA1Jv9M5fnWBaVcRCu4J07ogCnH" }}
            style={s.footerImg}
            resizeMode="cover"
          />
          <View style={s.imgOverlay}>
            <Text style={s.imgCaption}>Professional Compliance Management for Botswana Enterprises</Text>
          </View>
        </View>
      </View>

      {/* Success modal */}
      <Modal visible={showSuccess} transparent animationType="fade">
        <View style={s.modalOverlay}>
          <View style={s.modalCard}>
            <View style={s.successIconWrap}>
              <Ionicons name="checkmark-circle" size={60} color="#307231" />
            </View>
            <Text style={s.modalTitle}>Registration Success</Text>
            <Text style={s.modalMsg}>Welcome to CompliancePro Botswana. We've sent a verification link to your email.</Text>
            <Pressable style={s.modalBtn} onPress={handleSuccessClose}>
              <Text style={s.modalBtnText}>Set Up Business</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  loading:       { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#f3faff" },
  container:     { flexGrow: 1, backgroundColor: "#f3faff", paddingHorizontal: 16, paddingBottom: 32 },
  header:        { height: 64, justifyContent: "center" },
  backBtn:       { width: 40, height: 40, borderRadius: 20, justifyContent: "center", alignItems: "center", backgroundColor: "#dbf1fe" },
  intro:         { marginTop: 4, marginBottom: 28 },
  title:         { fontSize: 32, fontFamily: "PublicSans_700Bold", color: "#000b25", marginBottom: 6, letterSpacing: -0.64 },
  sub:           { fontSize: 15, fontFamily: "PublicSans_400Regular", color: "#44474e", lineHeight: 22 },
  form:          { gap: 18 },
  field:         { gap: 6 },
  label:         { fontSize: 11, fontFamily: "PublicSans_600SemiBold", letterSpacing: 0.7, color: "#44474e", textTransform: "uppercase", marginLeft: 2 },
  inputWrap:     { flexDirection: "row", alignItems: "center", backgroundColor: "#ffffff", borderWidth: 1, borderColor: "#c5c6cf", borderRadius: 14, height: 52 },
  inputIcon:     { marginLeft: 14, marginRight: 4 },
  input:         { flex: 1, fontSize: 15, fontFamily: "PublicSans_400Regular", color: "#071e27", paddingVertical: 12, paddingHorizontal: 10 },
  eye:           { position: "absolute", right: 14 },
  termsRow:      { flexDirection: "row", alignItems: "flex-start", gap: 12, marginTop: 4 },
  termsText:     { flex: 1, fontSize: 13, fontFamily: "PublicSans_400Regular", color: "#44474e", lineHeight: 19 },
  link:          { fontFamily: "PublicSans_600SemiBold", color: "#2a6b2c" },
  btn:           { backgroundColor: "#000b25", borderRadius: 14, paddingVertical: 16, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, marginTop: 4, shadowColor: "#000", shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.12, shadowRadius: 5, elevation: 3 },
  btnDisabled:   { opacity: 0.6 },
  btnText:       { fontSize: 18, fontFamily: "PublicSans_600SemiBold", color: "#ffffff" },
  loginRow:      { flexDirection: "row", justifyContent: "center" },
  loginText:     { fontSize: 13, fontFamily: "PublicSans_400Regular", color: "#44474e" },
  loginLink:     { fontSize: 13, fontFamily: "PublicSans_700Bold", color: "#000b25" },
  footer:        { marginTop: 36, alignItems: "center" },
  encBadge:      { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: "#dbf1fe", paddingHorizontal: 16, paddingVertical: 8, borderRadius: 999, borderWidth: 1, borderColor: "#c5c6cf", marginBottom: 20 },
  encText:       { fontSize: 11, fontFamily: "PublicSans_600SemiBold", color: "#307231", letterSpacing: 0.5 },
  imgWrap:       { width: "100%", maxWidth: 320, height: 180, borderRadius: 14, overflow: "hidden" },
  footerImg:     { width: "100%", height: "100%", opacity: 0.45 },
  imgOverlay:    { position: "absolute", bottom: 0, left: 0, right: 0, backgroundColor: "rgba(243,250,255,0.85)", paddingVertical: 8, paddingHorizontal: 12 },
  imgCaption:    { fontSize: 11, fontFamily: "PublicSans_400Regular", color: "#44474e", textAlign: "center", fontStyle: "italic" },
  modalOverlay:  { flex: 1, backgroundColor: "rgba(243,250,255,0.94)", justifyContent: "center", alignItems: "center", paddingHorizontal: 24 },
  modalCard:     { backgroundColor: "#ffffff", borderRadius: 16, padding: 28, alignItems: "center", width: "100%", maxWidth: 320, borderWidth: 1, borderColor: "#c5c6cf", shadowColor: "#000", shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.12, shadowRadius: 16, elevation: 8 },
  successIconWrap: { width: 88, height: 88, borderRadius: 44, backgroundColor: "#acf4a4", justifyContent: "center", alignItems: "center", marginBottom: 16 },
  modalTitle:    { fontSize: 22, fontFamily: "PublicSans_600SemiBold", color: "#000b25", marginBottom: 8 },
  modalMsg:      { fontSize: 14, fontFamily: "PublicSans_400Regular", color: "#44474e", textAlign: "center", marginBottom: 24, lineHeight: 20 },
  modalBtn:      { backgroundColor: "#000b25", paddingVertical: 13, paddingHorizontal: 28, borderRadius: 12 },
  modalBtnText:  { fontSize: 17, fontFamily: "PublicSans_600SemiBold", color: "#ffffff" },
});
