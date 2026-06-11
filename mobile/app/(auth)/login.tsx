import { useState } from "react";
import {
  View, Text, TextInput, Pressable,
  StyleSheet, ActivityIndicator, Alert, ScrollView,
  TouchableOpacity, ImageBackground,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { useAuthStore } from "@/store/auth";
import { api } from "@/lib/api";
import { MaterialIcons } from "@expo/vector-icons";
import { useFonts, PublicSans_400Regular, PublicSans_600SemiBold, PublicSans_700Bold } from "@expo-google-fonts/public-sans";

export default function LoginScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberDevice, setRememberDevice] = useState(false);
  const [loading, setLoading] = useState(false);
  const login = useAuthStore((s) => s.login);

  const [fontsLoaded] = useFonts({ PublicSans_400Regular, PublicSans_600SemiBold, PublicSans_700Bold });

  if (!fontsLoaded) return <View style={s.loading}><ActivityIndicator size="large" color="#000b25" /></View>;

  const handleLogin = async () => {
    const trimmedEmail = email.trim().toLowerCase();
    if (!trimmedEmail.includes("@")) return Alert.alert("Validation", "Enter a valid email address.");
    if (password.length === 0) return Alert.alert("Validation", "Password is required.");
    setLoading(true);
    try {
      await login(trimmedEmail, password);
      const profileCheck = await api.get("/business/profile").catch(() => null);
      router.replace(profileCheck?.status === 200 ? "/(tabs)" : "/business-profile");
    } catch (err: any) {
      Alert.alert("Login Failed", err?.response?.data?.detail?.message ?? "Invalid credentials. Try again.");
    } finally { setLoading(false); }
  };

  return (
    <View style={s.root}>
      {/* Hero panel */}
      <ImageBackground
        source={{ uri: "https://lh3.googleusercontent.com/aida-public/AB6AXuCWkNy77fmY1rQH83xGvouQfxpa8IVyrPa5JkSPPdR1eoEsfHbjirP0fXknvtIsO-E6Oi5lgTmdNFITvjsvWQWs6-NzyfU-O-KWUeHkNJPexbRycEGA8QBzPYc5HbM_ilZUXktA72tVsuiKTAl3vipnDvwiPposNxCXqqI8QV6Wf24wopMG1GzYgPUCG-Hm3CY-UizgHFT17zoOFAWohIMhVskQDdscJCzEf1hTh0zCUyXRsI7s6X_HPN0CmXhOB_lCXP8U1FGkC_j2" }}
        style={s.hero}
        imageStyle={{ opacity: 0.35 }}
      >
        <SafeAreaView edges={["top"]} style={{ flex: 1 }}>
          <View style={s.heroOverlay}>
            {/* Back to landing */}
            <TouchableOpacity
              style={s.backBtn}
              onPress={() => router.replace("/")}
              accessibilityRole="button"
              accessibilityLabel="Back to home"
              hitSlop={12}
            >
              <MaterialIcons name="arrow-back" size={20} color="#ffffff" />
            </TouchableOpacity>

            <View style={s.heroBrand}>
              <MaterialIcons name="security" size={26} color="#ffffff" />
              <Text style={s.heroBrandText}>CompliancePro Botswana</Text>
            </View>
            <View>
              <Text style={s.heroHeadline}>Secure Access</Text>
              <Text style={s.heroSub}>
                Enter your credentials to manage your business compliance standing with CIPA and BURS.
              </Text>
            </View>
            <View style={s.encBadge}>
              <MaterialIcons name="verified-user" size={14} color="#acf4a4" />
              <Text style={s.encText}>End-to-End Encrypted</Text>
            </View>
          </View>
        </SafeAreaView>
      </ImageBackground>

      {/* Form panel */}
      <ScrollView style={s.panel} contentContainerStyle={s.panelContent} showsVerticalScrollIndicator={false}>
        <Text style={s.title}>Welcome Back</Text>
        <Text style={s.sub}>Login to your corporate compliance portal.</Text>

        {/* Email */}
        <View style={s.field}>
          <Text style={s.label}>EMAIL ADDRESS</Text>
          <View style={s.inputWrap}>
            <TextInput style={s.input} placeholder="name@company.co.bw" placeholderTextColor="#a0a3ab"
              autoCapitalize="none" keyboardType="email-address" value={email} onChangeText={setEmail} />
          </View>
        </View>

        {/* Password */}
        <View style={s.field}>
          <View style={s.labelRow}>
            <Text style={s.label}>PASSWORD</Text>
            <TouchableOpacity><Text style={s.forgot}>Forgot Password?</Text></TouchableOpacity>
          </View>
          <View style={s.inputWrap}>
            <TextInput style={[s.input, { paddingRight: 48 }]} placeholder="••••••••" placeholderTextColor="#a0a3ab"
              secureTextEntry={!showPassword} value={password} onChangeText={setPassword} />
            <TouchableOpacity style={s.eye} onPress={() => setShowPassword(!showPassword)}>
              <MaterialIcons name={showPassword ? "visibility" : "visibility-off"} size={20} color="#44474e" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Remember device */}
        <TouchableOpacity style={s.rememberRow} onPress={() => setRememberDevice(!rememberDevice)} activeOpacity={0.7}>
          <View style={[s.checkbox, rememberDevice && s.checkboxOn]}>
            {rememberDevice && <MaterialIcons name="check" size={12} color="#fff" />}
          </View>
          <Text style={s.rememberText}>Remember this device</Text>
        </TouchableOpacity>

        {/* Login button */}
        <Pressable style={[s.btn, loading && s.btnDisabled]} onPress={handleLogin} disabled={loading}>
          {loading ? <ActivityIndicator color="#fff" /> : (
            <><Text style={s.btnText}>Login</Text><MaterialIcons name="login" size={20} color="#fff" /></>
          )}
        </Pressable>

        {/* Divider */}
        <View style={s.divider}>
          <View style={s.divLine} /><Text style={s.divText}>OR</Text><View style={s.divLine} />
        </View>

        {/* Register */}
        <View style={s.regRow}>
          <Text style={s.regText}>Don't have an account?</Text>
          <TouchableOpacity onPress={() => router.push("/(auth)/register")}>
            <Text style={s.regLink}> Register</Text>
          </TouchableOpacity>
        </View>

        {/* Trust badges */}
        <View style={s.trust}>
          <View style={s.trustItem}><MaterialIcons name="account-balance" size={16} color="#44474e" /><Text style={s.trustLabel}>BURS COMPLIANT</Text></View>
          <View style={s.trustItem}><MaterialIcons name="business" size={16} color="#44474e" /><Text style={s.trustLabel}>CIPA INTEGRATED</Text></View>
        </View>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  loading:       { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#f3faff" },
  root:          { flex: 1, backgroundColor: "#ffffff" },
  hero:          { width: "100%", height: 230, backgroundColor: "#000b25" },
  heroOverlay:   { flex: 1, backgroundColor: "rgba(0,11,37,0.75)", paddingHorizontal: 20, paddingTop: 8, paddingBottom: 18, justifyContent: "space-between" },
  backBtn:       { width: 36, height: 36, borderRadius: 18, backgroundColor: "rgba(255,255,255,0.15)", alignItems: "center", justifyContent: "center", alignSelf: "flex-start" },
  heroBrand:     { flexDirection: "row", alignItems: "center", gap: 10 },
  heroBrandText: { fontSize: 17, fontFamily: "PublicSans_700Bold", color: "#ffffff" },
  heroHeadline:  { fontSize: 30, fontFamily: "PublicSans_700Bold", color: "#ffffff", letterSpacing: -0.6, marginBottom: 6 },
  heroSub:       { fontSize: 13, fontFamily: "PublicSans_400Regular", color: "#b3c6f5", lineHeight: 19, maxWidth: 280 },
  encBadge:      { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "rgba(0,11,37,0.5)", borderRadius: 999, paddingHorizontal: 12, paddingVertical: 5, borderWidth: 1, borderColor: "rgba(255,255,255,0.2)", alignSelf: "flex-start" },
  encText:       { fontSize: 11, fontFamily: "PublicSans_600SemiBold", color: "#ffffff", letterSpacing: 0.3 },
  panel:         { flex: 1, backgroundColor: "#ffffff" },
  panelContent:  { paddingHorizontal: 20, paddingTop: 28, paddingBottom: 40 },
  title:         { fontSize: 26, fontFamily: "PublicSans_700Bold", color: "#071e27", marginBottom: 4, letterSpacing: -0.5 },
  sub:           { fontSize: 14, fontFamily: "PublicSans_400Regular", color: "#44474e", marginBottom: 24, lineHeight: 20 },
  field:         { marginBottom: 16 },
  label:         { fontSize: 11, fontFamily: "PublicSans_600SemiBold", letterSpacing: 0.7, color: "#071e27", textTransform: "uppercase", marginBottom: 6, marginLeft: 2 },
  labelRow:      { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 6 },
  forgot:        { fontSize: 11, fontFamily: "PublicSans_600SemiBold", color: "#000b25", letterSpacing: 0.4 },
  inputWrap:     { backgroundColor: "#e6f6ff", borderWidth: 1, borderColor: "#c5c6cf", borderRadius: 14, height: 50, justifyContent: "center" },
  input:         { fontSize: 15, fontFamily: "PublicSans_400Regular", color: "#071e27", paddingHorizontal: 16, height: "100%" },
  eye:           { position: "absolute", right: 14, top: "50%", marginTop: -10 },
  rememberRow:   { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 20 },
  checkbox:      { width: 18, height: 18, borderRadius: 4, borderWidth: 1.5, borderColor: "#75777f", justifyContent: "center", alignItems: "center" },
  checkboxOn:    { backgroundColor: "#000b25", borderColor: "#000b25" },
  rememberText:  { fontSize: 13, fontFamily: "PublicSans_400Regular", color: "#44474e" },
  btn:           { backgroundColor: "#000b25", borderRadius: 999, height: 54, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, marginBottom: 20, shadowColor: "#000", shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.15, shadowRadius: 6, elevation: 4 },
  btnDisabled:   { opacity: 0.6 },
  btnText:       { fontSize: 14, fontFamily: "PublicSans_700Bold", color: "#ffffff", letterSpacing: 0.3 },
  divider:       { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 20 },
  divLine:       { flex: 1, height: 1, backgroundColor: "#c5c6cf" },
  divText:       { fontSize: 11, fontFamily: "PublicSans_600SemiBold", color: "#44474e", letterSpacing: 0.5 },
  regRow:        { flexDirection: "row", justifyContent: "center", marginBottom: 28 },
  regText:       { fontSize: 13, fontFamily: "PublicSans_400Regular", color: "#44474e" },
  regLink:       { fontSize: 13, fontFamily: "PublicSans_700Bold", color: "#000b25" },
  trust:         { flexDirection: "row", justifyContent: "center", gap: 24, opacity: 0.4 },
  trustItem:     { flexDirection: "row", alignItems: "center", gap: 5 },
  trustLabel:    { fontSize: 9, fontFamily: "PublicSans_600SemiBold", color: "#44474e", letterSpacing: 1 },
});