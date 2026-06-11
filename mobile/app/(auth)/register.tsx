/**
 * app/(auth)/register.tsx — unified registration screen
 *
 * Replaces both the old (auth)/register.tsx and guide-register.tsx.
 *
 * Two entry points:
 *   A) Login page → "Register" link  (params.fromGuide absent)
 *   B) Starter Guide celebration banner → router.push("/(auth)/register",
 *        { params: { fromGuide: "true" } })
 *
 * Endpoint: POST /auth/register-with-profile
 *   - Creates user + business profile in one shot
 *   - Sets is_onboarding_complete = true (guide-completers) or false (direct)
 *   - After success, if fromGuide=true, syncs local SQLite progress to backend
 */
import { useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { MaterialIcons, Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import * as SecureStore from "expo-secure-store";
import { api } from "@/lib/api";
import {
  exportLocalProgress,
  clearLocalProgress,
} from "@/lib/localOnboardingProgress";
import type { TokenResponse } from "@/types";

const C = {
  bg:           "#f3faff",
  surface:      "#ffffff",
  primary:      "#000b25",
  mid:          "#44474e",
  muted:        "#75777f",
  border:       "#c5c6cf",
  borderSoft:   "#e6f6ff",
  teal:         "#006874",
  tealBg:       "#d8f3f6",
  tealDark:     "#004f58",
  tealLight:    "#e8f8fa",
  secondary:    "#2a6b2c",
  secondaryBg:  "#acf4a4",
  container:    "#dbf1fe",
  containerLow: "#e6f6ff",
  error:        "#ba1a1a",
  errorBg:      "#ffdad6",
};

type CompanyType = "sole_trader" | "pty_ltd" | "partnership" | "ngo";
const COMPANY_TYPES: { value: CompanyType; label: string }[] = [
  { value: "pty_ltd",      label: "Pty Ltd" },
  { value: "sole_trader",  label: "Sole Trader" },
  { value: "partnership",  label: "Partnership" },
  { value: "ngo",          label: "NGO / Non-Profit" },
];

export default function RegisterScreen() {
  const { fromGuide } = useLocalSearchParams<{ fromGuide?: string }>();
  const isFromGuide = fromGuide === "true";

  // ── Personal ──────────────────────────────────────────────────────────────
  const [fullName,     setFullName]     = useState("");
  const [email,        setEmail]        = useState("");
  const [password,     setPassword]     = useState("");
  const [confirm,      setConfirm]      = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm,  setShowConfirm]  = useState(false);
  const [agreeTerms,   setAgreeTerms]   = useState(false);

  // ── Business ──────────────────────────────────────────────────────────────
  const [bizName,       setBizName]       = useState("");
  const [companyType,   setCompanyType]   = useState<CompanyType>("pty_ltd");
  const [cipaNumber,    setCipaNumber]    = useState("");
  const [bursTin,       setBursTin]       = useState("");
  const [vatRegistered, setVatRegistered] = useState(false);
  const [vatMonthly,    setVatMonthly]    = useState(true);

  const [loading,  setLoading]  = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);

  // Refs for keyboard flow
  const emailRef   = useRef<TextInput>(null);
  const passRef    = useRef<TextInput>(null);
  const confirmRef = useRef<TextInput>(null);
  const bizRef     = useRef<TextInput>(null);
  const cipaRef    = useRef<TextInput>(null);
  const tinRef     = useRef<TextInput>(null);

  const validateEmail = (e: string) =>
    /^[^\s@]+@([^\s@.,]+\.)+[^\s@.,]{2,}$/.test(e.toLowerCase());

  const handleRegister = async () => {
    setApiError(null);

    // ── Validation ──────────────────────────────────────────────────────────
    if (fullName.trim().length < 2)
      return setApiError("Please enter your full name (at least 2 characters).");
    if (!validateEmail(email.trim()))
      return setApiError("Enter a valid email address.");
    if (password.length < 8)
      return setApiError("Password must be at least 8 characters.");
    if (password !== confirm)
      return setApiError("Passwords do not match.");
    if (!agreeTerms)
      return setApiError("You must agree to the Terms of Service and Privacy Policy.");
    if (!bizName.trim())
      return setApiError("Please enter your business name.");

    setLoading(true);

    try {
      // ── POST /auth/register-with-profile ──────────────────────────────────
      const { data } = await api.post<TokenResponse>(
        "/auth/register-with-profile",
        {
          full_name:          fullName.trim(),
          email:              email.trim().toLowerCase(),
          password,
          business_name:      bizName.trim(),
          company_type:       companyType,
          cipa_number:        cipaNumber.trim() || null,
          burs_tin:           bursTin.trim()    || null,
          vat_registered:     vatRegistered,
          vat_filing_monthly: vatMonthly,
        }
      );

      await SecureStore.setItemAsync("access_token",  data.access_token);
      await SecureStore.setItemAsync("refresh_token", data.refresh_token);

      // ── Sync local guide progress (guide path only) ───────────────────────
      if (isFromGuide) {
        try {
          const completed = await exportLocalProgress();
          if (completed.length > 0) {
            await api.post("/onboarding/sync-local-progress", {
              completed_steps: completed.map((r) => ({
                step_id:      r.step_id,
                completed_at: r.completed_at,
              })),
            });
          }
        } catch {
          // Non-fatal — account exists, sync can be retried later
        }
        await clearLocalProgress();
      }

      router.replace("/(tabs)");
    } catch (err: any) {
      const detail = err?.response?.data?.detail;
      if (typeof detail === "object" && detail?.message) {
        setApiError(detail.message);
      } else if (typeof detail === "string") {
        setApiError(detail);
      } else {
        setApiError("Registration failed. Please check your details and try again.");
      }
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={s.safe} edges={["top"]}>
      <StatusBar barStyle="dark-content" backgroundColor={C.bg} />

      {/* Top bar */}
      <View style={s.topBar}>
        <TouchableOpacity
          style={s.backBtn}
          onPress={() => router.back()}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <MaterialIcons name="arrow-back" size={22} color={C.primary} />
        </TouchableOpacity>
        <Text style={s.topBarTitle}>Create Account</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        style={s.scroll}
        contentContainerStyle={s.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Hero */}
        <View style={s.hero}>
          <View style={s.heroIcon}>
            <MaterialIcons name="verified-user" size={28} color={C.teal} />
          </View>
          <View style={{ flex: 1, gap: 3 }}>
            <Text style={s.heroTitle}>
              {isFromGuide ? "Almost there!" : "Join CompliancePro"}
            </Text>
            <Text style={s.heroSub}>
              {isFromGuide
                ? "Create your free account to activate your compliance dashboard."
                : "Secure your business standing with professional regulatory monitoring."}
            </Text>
          </View>
        </View>

        {/* Error banner */}
        {apiError && (
          <View style={s.errorBox}>
            <MaterialIcons name="error-outline" size={16} color={C.error} />
            <Text style={s.errorText}>{apiError}</Text>
          </View>
        )}

        {/* ── Personal details ── */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>Your Details</Text>

          <View style={s.field}>
            <Text style={s.label}>FULL NAME</Text>
            <View style={s.inputWrap}>
              <MaterialIcons name="person" size={18} color={C.mid} style={s.inputIcon} />
              <TextInput
                style={s.input} placeholder="Motsamai Kgosi"
                placeholderTextColor="#a0a3ab" value={fullName}
                onChangeText={setFullName} returnKeyType="next"
                onSubmitEditing={() => emailRef.current?.focus()}
              />
            </View>
          </View>

          <View style={s.field}>
            <Text style={s.label}>EMAIL ADDRESS</Text>
            <View style={s.inputWrap}>
              <MaterialIcons name="mail" size={18} color={C.mid} style={s.inputIcon} />
              <TextInput
                ref={emailRef} style={s.input}
                placeholder="motsamai@business.bw" placeholderTextColor="#a0a3ab"
                autoCapitalize="none" keyboardType="email-address"
                value={email} onChangeText={setEmail}
                returnKeyType="next" onSubmitEditing={() => passRef.current?.focus()}
              />
            </View>
          </View>

          <View style={s.field}>
            <Text style={s.label}>PASSWORD</Text>
            <View style={s.inputWrap}>
              <MaterialIcons name="lock" size={18} color={C.mid} style={s.inputIcon} />
              <TextInput
                ref={passRef} style={[s.input, { paddingRight: 48 }]}
                placeholder="At least 8 characters" placeholderTextColor="#a0a3ab"
                secureTextEntry={!showPassword} value={password}
                onChangeText={setPassword} returnKeyType="next"
                onSubmitEditing={() => confirmRef.current?.focus()}
              />
              <TouchableOpacity style={s.eyeBtn} onPress={() => setShowPassword((p) => !p)}>
                <Ionicons name={showPassword ? "eye-off" : "eye"} size={18} color={C.muted} />
              </TouchableOpacity>
            </View>
          </View>

          <View style={s.field}>
            <Text style={s.label}>CONFIRM PASSWORD</Text>
            <View style={s.inputWrap}>
              <MaterialIcons name="lock-outline" size={18} color={C.mid} style={s.inputIcon} />
              <TextInput
                ref={confirmRef} style={[s.input, { paddingRight: 48 }]}
                placeholder="Re-enter password" placeholderTextColor="#a0a3ab"
                secureTextEntry={!showConfirm} value={confirm}
                onChangeText={setConfirm} returnKeyType="next"
                onSubmitEditing={() => bizRef.current?.focus()}
              />
              <TouchableOpacity style={s.eyeBtn} onPress={() => setShowConfirm((p) => !p)}>
                <Ionicons name={showConfirm ? "eye-off" : "eye"} size={18} color={C.muted} />
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* ── Business details ── */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>Your Business</Text>

          <View style={s.field}>
            <Text style={s.label}>BUSINESS NAME</Text>
            <View style={s.inputWrap}>
              <MaterialIcons name="business" size={18} color={C.mid} style={s.inputIcon} />
              <TextInput
                ref={bizRef} style={s.input}
                placeholder="e.g. Kgale Tech Solutions (Pty) Ltd"
                placeholderTextColor="#a0a3ab" value={bizName}
                onChangeText={setBizName} returnKeyType="next"
                onSubmitEditing={() => cipaRef.current?.focus()}
              />
            </View>
            <Text style={s.hint}>Must match your CIPA certificate exactly.</Text>
          </View>

          {/* Company type chips */}
          <View style={s.field}>
            <Text style={s.label}>COMPANY TYPE</Text>
            <View style={s.typeGrid}>
              {COMPANY_TYPES.map((t) => (
                <Pressable
                  key={t.value}
                  style={[s.typeChip, companyType === t.value && s.typeChipActive]}
                  onPress={() => setCompanyType(t.value)}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: companyType === t.value }}
                >
                  <Text style={[s.typeChipText, companyType === t.value && s.typeChipTextActive]}>
                    {t.label}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>

          <View style={s.field}>
            <Text style={s.label}>CIPA NUMBER <Text style={s.optional}>optional</Text></Text>
            <View style={s.inputWrap}>
              <MaterialIcons name="tag" size={18} color={C.mid} style={s.inputIcon} />
              <TextInput
                ref={cipaRef} style={s.input}
                placeholder="BW-12345678" placeholderTextColor="#a0a3ab"
                value={cipaNumber} onChangeText={setCipaNumber}
                returnKeyType="next" onSubmitEditing={() => tinRef.current?.focus()}
                autoCapitalize="characters"
              />
            </View>
            <Text style={s.hint}>From your Certificate of Incorporation. Add now or later in Settings.</Text>
          </View>

          <View style={s.field}>
            <Text style={s.label}>BURS TIN <Text style={s.optional}>optional</Text></Text>
            <View style={s.inputWrap}>
              <MaterialIcons name="receipt-long" size={18} color={C.mid} style={s.inputIcon} />
              <TextInput
                ref={tinRef} style={s.input}
                placeholder="P03212345678" placeholderTextColor="#a0a3ab"
                keyboardType="default" value={bursTin}
                onChangeText={setBursTin} returnKeyType="done"
              />
            </View>
            <Text style={s.hint}>Your Tax Identification Number from BURS. Add now or later.</Text>
          </View>

          {/* VAT toggles */}
          <View style={s.toggleRow}>
            <View style={{ flex: 1 }}>
              <Text style={s.toggleLabel}>Registered for VAT</Text>
              <Text style={s.hint}>Required if annual turnover ≥ BWP 1,000,000.</Text>
            </View>
            <Switch
              value={vatRegistered} onValueChange={setVatRegistered}
              trackColor={{ false: C.border, true: C.teal }}
              thumbColor="#ffffff"
            />
          </View>

          {vatRegistered && (
            <View style={s.toggleRow}>
              <View style={{ flex: 1 }}>
                <Text style={s.toggleLabel}>Monthly VAT filing</Text>
                <Text style={s.hint}>Toggle off for bi-monthly filing.</Text>
              </View>
              <Switch
                value={vatMonthly} onValueChange={setVatMonthly}
                trackColor={{ false: C.border, true: C.teal }}
                thumbColor="#ffffff"
              />
            </View>
          )}
        </View>

        {/* Terms */}
        <Pressable style={s.termsRow} onPress={() => setAgreeTerms((v) => !v)}>
          <View style={[s.checkbox, agreeTerms && s.checkboxOn]}>
            {agreeTerms && <MaterialIcons name="check" size={13} color="#fff" />}
          </View>
          <Text style={s.termsText}>
            I agree to the{" "}
            <Text style={s.termsLink}>Terms of Service</Text> and{" "}
            <Text style={s.termsLink}>Privacy Policy</Text>
            {" "}regarding BURS and CIPA data processing.
          </Text>
        </Pressable>

        {/* Submit */}
        <Pressable
          style={[s.submitBtn, loading && s.submitBtnDisabled]}
          onPress={handleRegister}
          disabled={loading}
          accessibilityRole="button"
          accessibilityLabel="Create account"
        >
          {loading ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <>
              <MaterialIcons name="person-add" size={18} color="#fff" />
              <Text style={s.submitBtnText}>Create Account</Text>
            </>
          )}
        </Pressable>

        <View style={s.loginRow}>
          <Text style={s.loginText}>Already have an account?</Text>
          <TouchableOpacity onPress={() => router.replace("/(auth)/login")}>
            <Text style={s.loginLink}> Login</Text>
          </TouchableOpacity>
        </View>

        {/* Trust badges */}
        <View style={s.trust}>
          <View style={s.trustItem}>
            <MaterialIcons name="verified-user" size={13} color={C.muted} />
            <Text style={s.trustLabel}>END-TO-END ENCRYPTED</Text>
          </View>
          <View style={s.trustItem}>
            <MaterialIcons name="account-balance" size={13} color={C.muted} />
            <Text style={s.trustLabel}>BURS COMPLIANT</Text>
          </View>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:         { flex: 1, backgroundColor: C.bg },
  scroll:       { flex: 1 },
  scrollContent:{ paddingHorizontal: 16, paddingBottom: 16 },

  topBar: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    height: 56, paddingHorizontal: 12,
    backgroundColor: C.container,
    borderBottomWidth: 1, borderBottomColor: C.border,
  },
  backBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: C.surface, alignItems: "center", justifyContent: "center",
  },
  topBarTitle: { fontSize: 16, fontFamily: "PublicSans_700Bold", color: C.primary },

  hero: {
    flexDirection: "row", alignItems: "center", gap: 14,
    backgroundColor: C.tealLight, borderRadius: 14,
    padding: 16, marginTop: 16, marginBottom: 16,
    borderWidth: 1, borderColor: C.teal + "33",
  },
  heroIcon: {
    width: 50, height: 50, borderRadius: 25,
    backgroundColor: C.tealBg, alignItems: "center", justifyContent: "center",
    flexShrink: 0,
  },
  heroTitle: { fontSize: 16, fontFamily: "PublicSans_700Bold", color: C.tealDark },
  heroSub:   { fontSize: 12, fontFamily: "PublicSans_400Regular", color: C.tealDark, lineHeight: 17 },

  errorBox: {
    flexDirection: "row", alignItems: "flex-start", gap: 8,
    backgroundColor: C.errorBg, borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 10, marginBottom: 12,
  },
  errorText: { flex: 1, fontSize: 13, fontFamily: "PublicSans_400Regular", color: C.error, lineHeight: 18 },

  section: {
    backgroundColor: C.surface, borderRadius: 16,
    padding: 16, marginBottom: 14, gap: 14,
    borderWidth: 1, borderColor: C.borderSoft,
  },
  sectionTitle: {
    fontSize: 11, fontFamily: "PublicSans_700Bold", color: C.teal,
    textTransform: "uppercase", letterSpacing: 1,
  },

  field:    { gap: 5 },
  label:    { fontSize: 11, fontFamily: "PublicSans_600SemiBold", letterSpacing: 0.7, color: C.mid, textTransform: "uppercase", marginLeft: 2 },
  optional: { fontFamily: "PublicSans_400Regular", letterSpacing: 0, textTransform: "none", color: C.muted },
  hint:     { fontSize: 11, fontFamily: "PublicSans_400Regular", color: C.muted, lineHeight: 16, marginLeft: 2 },

  inputWrap: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: C.containerLow, borderWidth: 1,
    borderColor: C.border, borderRadius: 12, height: 48,
  },
  inputIcon: { marginLeft: 12, marginRight: 4 },
  input: {
    flex: 1, fontSize: 14, fontFamily: "PublicSans_400Regular",
    color: C.primary, paddingVertical: 12, paddingHorizontal: 8,
  },
  eyeBtn: { position: "absolute", right: 12 },

  typeGrid:         { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  typeChip:         { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 8, borderWidth: 1.5, borderColor: C.border, backgroundColor: C.surface },
  typeChipActive:   { borderColor: C.teal, backgroundColor: C.tealBg },
  typeChipText:     { fontSize: 12, fontFamily: "PublicSans_600SemiBold", color: C.muted },
  typeChipTextActive:{ color: C.tealDark },

  toggleRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 4 },
  toggleLabel:{ fontSize: 13, fontFamily: "PublicSans_600SemiBold", color: C.mid },

  termsRow: { flexDirection: "row", alignItems: "flex-start", gap: 12, marginBottom: 16 },
  checkbox: { width: 20, height: 20, borderRadius: 5, borderWidth: 1.5, borderColor: C.border, justifyContent: "center", alignItems: "center", marginTop: 1, flexShrink: 0 },
  checkboxOn:{ backgroundColor: C.primary, borderColor: C.primary },
  termsText: { flex: 1, fontSize: 13, fontFamily: "PublicSans_400Regular", color: C.mid, lineHeight: 19 },
  termsLink: { fontFamily: "PublicSans_600SemiBold", color: C.secondary },

  submitBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    backgroundColor: C.primary, borderRadius: 14,
    paddingVertical: 16, marginBottom: 16,
    shadowColor: "#000", shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.12, shadowRadius: 5, elevation: 3,
  },
  submitBtnDisabled:{ opacity: 0.6 },
  submitBtnText: { fontSize: 16, fontFamily: "PublicSans_700Bold", color: "#fff" },

  loginRow:  { flexDirection: "row", justifyContent: "center", marginBottom: 24 },
  loginText: { fontSize: 13, fontFamily: "PublicSans_400Regular", color: C.mid },
  loginLink: { fontSize: 13, fontFamily: "PublicSans_700Bold", color: C.primary },

  trust:      { flexDirection: "row", justifyContent: "center", gap: 20, opacity: 0.4, marginBottom: 8 },
  trustItem:  { flexDirection: "row", alignItems: "center", gap: 5 },
  trustLabel: { fontSize: 9, fontFamily: "PublicSans_600SemiBold", color: C.muted, letterSpacing: 0.8 },
});