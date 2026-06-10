/**
 * app/guide-register.tsx — Step 3
 *
 * PUBLIC registration screen shown after the user completes all 15
 * Starter Guide steps.
 *
 * Collects:
 *   Personal   — full name, email, password
 *   Business   — business name, company type, CIPA number, BURS TIN,
 *                VAT registered, VAT filing frequency
 *
 * On submit → POST /auth/register-with-profile (Step 4 backend endpoint).
 * On success → sync local progress (Step 5), navigate to /(tabs).
 */
import { useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { MaterialIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import * as SecureStore from "expo-secure-store";
import { TopBar } from "@/components/ui/TopBar";
import { api } from "@/lib/api";
import {
  exportLocalProgress,
  clearLocalProgress,
} from "@/lib/localOnboardingProgress";
import type { TokenResponse } from "@/types";

const C = {
  bg:          "#f3faff",
  surface:     "#ffffff",
  primary:     "#000b25",
  mid:         "#44474e",
  muted:       "#75777f",
  border:      "#c5c6cf",
  borderSoft:  "#e6f6ff",
  teal:        "#006874",
  tealBg:      "#d8f3f6",
  tealDark:    "#004f58",
  tealLight:   "#e8f8fa",
  secondary:   "#2a6b2c",
  secondaryBg: "#acf4a4",
  error:       "#ba1a1a",
  errorBg:     "#ffdad6",
  containerLow:"#e6f6ff",
};

type CompanyType = "sole_trader" | "pty_ltd" | "partnership" | "ngo";
const COMPANY_TYPES: { value: CompanyType; label: string }[] = [
  { value: "sole_trader",  label: "Sole Trader" },
  { value: "pty_ltd",      label: "Pty Ltd (Private Company)" },
  { value: "partnership",  label: "Partnership" },
  { value: "ngo",          label: "NGO / Non-Profit" },
];

// ── Reusable field component ──────────────────────────────────────────────────
function Field({
  label,
  placeholder,
  value,
  onChange,
  secure,
  showToggle,
  onToggle,
  keyType = "default",
  optional,
  hint,
}: {
  label: string;
  placeholder: string;
  value: string;
  onChange: (t: string) => void;
  secure?: boolean;
  showToggle?: boolean;
  onToggle?: () => void;
  keyType?: any;
  optional?: boolean;
  hint?: string;
}) {
  return (
    <View style={sf.field}>
      <View style={sf.labelRow}>
        <Text style={sf.label}>{label}</Text>
        {optional && <Text style={sf.optional}>optional</Text>}
      </View>
      {hint && <Text style={sf.hint}>{hint}</Text>}
      <View style={sf.inputWrap}>
        <TextInput
          style={sf.input}
          placeholder={placeholder}
          placeholderTextColor="#a0a3ab"
          autoCapitalize="none"
          keyboardType={keyType}
          secureTextEntry={secure && !showToggle}
          value={value}
          onChangeText={onChange}
        />
        {onToggle && (
          <TouchableOpacity style={sf.eyeBtn} onPress={onToggle}>
            <MaterialIcons
              name={showToggle ? "visibility-off" : "visibility"}
              size={18}
              color={C.muted}
            />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

// ── Company type picker ───────────────────────────────────────────────────────
function CompanyTypePicker({
  value,
  onChange,
}: {
  value: CompanyType;
  onChange: (v: CompanyType) => void;
}) {
  return (
    <View style={sf.field}>
      <Text style={sf.label}>Company Type</Text>
      <View style={sf.typePicker}>
        {COMPANY_TYPES.map((t) => (
          <Pressable
            key={t.value}
            style={[sf.typeChip, value === t.value && sf.typeChipActive]}
            onPress={() => onChange(t.value)}
            accessibilityRole="radio"
            accessibilityState={{ checked: value === t.value }}
          >
            <Text
              style={[
                sf.typeChipText,
                value === t.value && sf.typeChipTextActive,
              ]}
            >
              {t.label}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

// ── Toggle row ────────────────────────────────────────────────────────────────
function ToggleRow({
  label,
  value,
  onChange,
  hint,
}: {
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
  hint?: string;
}) {
  return (
    <Pressable style={sf.toggleRow} onPress={() => onChange(!value)}>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={sf.toggleLabel}>{label}</Text>
        {hint && <Text style={sf.hint}>{hint}</Text>}
      </View>
      <View style={[sf.toggleTrack, value && sf.toggleTrackOn]}>
        <View style={[sf.toggleThumb, value && sf.toggleThumbOn]} />
      </View>
    </Pressable>
  );
}

// ── Main screen ───────────────────────────────────────────────────────────────
export default function GuideRegisterScreen() {
  const router = useRouter();

  // Personal
  const [fullName,   setFullName]   = useState("");
  const [email,      setEmail]      = useState("");
  const [password,   setPassword]   = useState("");
  const [showPass,   setShowPass]   = useState(false);

  // Business
  const [bizName,        setBizName]        = useState("");
  const [companyType,    setCompanyType]    = useState<CompanyType>("pty_ltd");
  const [cipaNumber,     setCipaNumber]     = useState("");
  const [bursTin,        setBursTin]        = useState("");
  const [vatRegistered,  setVatRegistered]  = useState(false);
  const [vatMonthly,     setVatMonthly]     = useState(true);

  const [loading,  setLoading]  = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);

  const handleRegister = async () => {
    // Basic client-side validation
    if (!fullName.trim() || fullName.trim().length < 2) {
      setApiError("Please enter your full name (at least 2 characters).");
      return;
    }
    if (!email.trim()) {
      setApiError("Please enter your email address.");
      return;
    }
    if (!password || password.length < 8) {
      setApiError("Password must be at least 8 characters.");
      return;
    }
    if (!bizName.trim()) {
      setApiError("Please enter your business name.");
      return;
    }

    setApiError(null);
    setLoading(true);

    try {
      // ── Step 4: POST /auth/register-with-profile ──────────────────────
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

      // Persist tokens
      await SecureStore.setItemAsync("access_token",  data.access_token);
      await SecureStore.setItemAsync("refresh_token", data.refresh_token);

      // ── Step 5: Sync local progress to the backend ────────────────────
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
        // Non-fatal — the user has their account; the sync can be retried
      }

      // Clear local data now that it's on the server
      await clearLocalProgress();

      // Navigate to dashboard
      router.replace("/(tabs)" as any);
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
    <SafeAreaView style={sf.safe}>
      <StatusBar barStyle="dark-content" backgroundColor={C.bg} />
      <TopBar title="Create Your Account" showBack />

      <ScrollView
        style={sf.scroll}
        contentContainerStyle={sf.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* ── Hero ── */}
        <View style={sf.hero}>
          <View style={sf.heroIcon}>
            <MaterialIcons name="verified" size={28} color={C.teal} />
          </View>
          <View style={{ flex: 1, gap: 3 }}>
            <Text style={sf.heroTitle}>Almost there!</Text>
            <Text style={sf.heroSub}>
              Create your free account to activate your compliance dashboard.
            </Text>
          </View>
        </View>

        {/* ── Error ── */}
        {apiError && (
          <View style={sf.errorBox}>
            <MaterialIcons name="error-outline" size={16} color={C.error} />
            <Text style={sf.errorText}>{apiError}</Text>
          </View>
        )}

        {/* ── Personal details ── */}
        <View style={sf.section}>
          <Text style={sf.sectionTitle}>Your Details</Text>
          <Field label="Full Name"     placeholder="Thabo Moatlhodi" value={fullName} onChange={setFullName} />
          <Field label="Email Address" placeholder="thabo@example.co.bw" value={email} onChange={setEmail} keyType="email-address" />
          <Field
            label="Password" placeholder="At least 8 characters" value={password}
            onChange={setPassword} secure showToggle={showPass} onToggle={() => setShowPass((p) => !p)}
          />
        </View>

        {/* ── Business details ── */}
        <View style={sf.section}>
          <Text style={sf.sectionTitle}>Your Business</Text>
          <Field label="Business Name" placeholder="Moatlhodi Trading (Pty) Ltd" value={bizName} onChange={setBizName} />
          <CompanyTypePicker value={companyType} onChange={setCompanyType} />
          <Field
            label="CIPA Number"  placeholder="BW-12345678" value={cipaNumber}
            onChange={setCipaNumber} optional
            hint="From your Certificate of Incorporation. Add now or later in Settings."
          />
          <Field
            label="BURS TIN" placeholder="P03212345678" value={bursTin}
            onChange={setBursTin} optional
            hint="Your Tax Identification Number from BURS. Add now or later."
          />
          <ToggleRow
            label="Registered for VAT"
            value={vatRegistered}
            onChange={setVatRegistered}
            hint="Required if annual turnover ≥ BWP 1,000,000."
          />
          {vatRegistered && (
            <ToggleRow
              label="Monthly VAT filing"
              value={vatMonthly}
              onChange={setVatMonthly}
              hint="Toggle off for bi-monthly filing."
            />
          )}
        </View>

        {/* ── Submit ── */}
        <Pressable
          style={({ pressed }) => [
            sf.submitBtn,
            loading && sf.submitBtnDisabled,
            pressed && { opacity: 0.88 },
          ]}
          onPress={handleRegister}
          disabled={loading}
          accessibilityRole="button"
          accessibilityLabel="Create account and activate dashboard"
        >
          {loading ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <>
              <MaterialIcons name="person-add" size={18} color="#fff" />
              <Text style={sf.submitBtnText}>Create Account & Activate Dashboard</Text>
            </>
          )}
        </Pressable>

        <Text style={sf.disclaimer}>
          By creating an account you agree to our Terms of Service. Your data is
          stored securely and never sold.
        </Text>

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const sf = StyleSheet.create({
  safe:          { flex: 1, backgroundColor: C.bg },
  scroll:        { flex: 1 },
  scrollContent: { paddingHorizontal: 16, paddingTop: 12 },

  hero: {
    flexDirection: "row", alignItems: "center", gap: 14,
    backgroundColor: C.tealLight, borderRadius: 14,
    padding: 16, marginBottom: 16,
    borderWidth: 1, borderColor: C.teal + "33",
  },
  heroIcon: {
    width: 50, height: 50, borderRadius: 25,
    backgroundColor: C.tealBg, alignItems: "center", justifyContent: "center",
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
    padding: 16, marginBottom: 14, gap: 12,
    borderWidth: 1, borderColor: C.borderSoft,
  },
  sectionTitle: {
    fontSize: 12, fontFamily: "PublicSans_700Bold", color: C.teal,
    textTransform: "uppercase", letterSpacing: 0.9, marginBottom: 2,
  },

  field:     { gap: 4 },
  labelRow:  { flexDirection: "row", alignItems: "center", gap: 6 },
  label:     { fontSize: 13, fontFamily: "PublicSans_600SemiBold", color: C.mid },
  optional:  { fontSize: 11, fontFamily: "PublicSans_400Regular", color: C.muted, fontStyle: "italic" },
  hint:      { fontSize: 11, fontFamily: "PublicSans_400Regular", color: C.muted, lineHeight: 16 },
  inputWrap: { position: "relative" },
  input: {
    backgroundColor: C.containerLow, borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 11,
    fontSize: 14, fontFamily: "PublicSans_400Regular", color: C.primary,
    borderWidth: 1, borderColor: C.border,
  },
  eyeBtn: { position: "absolute", right: 12, top: 11 },

  typePicker:         { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  typeChip: {
    paddingHorizontal: 12, paddingVertical: 7,
    borderRadius: 8, borderWidth: 1.5, borderColor: C.border,
    backgroundColor: C.surface,
  },
  typeChipActive:     { borderColor: C.teal, backgroundColor: C.tealBg },
  typeChipText:       { fontSize: 12, fontFamily: "PublicSans_600SemiBold", color: C.muted },
  typeChipTextActive: { color: C.tealDark },

  toggleRow: {
    flexDirection: "row", alignItems: "center", gap: 12,
    paddingVertical: 6,
  },
  toggleLabel: { fontSize: 13, fontFamily: "PublicSans_600SemiBold", color: C.mid },
  toggleTrack: {
    width: 44, height: 24, borderRadius: 12,
    backgroundColor: C.border, justifyContent: "center", padding: 2,
  },
  toggleTrackOn:  { backgroundColor: C.teal },
  toggleThumb:    { width: 20, height: 20, borderRadius: 10, backgroundColor: "#fff", alignSelf: "flex-start" },
  toggleThumbOn:  { alignSelf: "flex-end" },

  submitBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10,
    backgroundColor: C.secondary, borderRadius: 14,
    paddingVertical: 16, paddingHorizontal: 20, marginBottom: 12,
  },
  submitBtnDisabled: { opacity: 0.6 },
  submitBtnText: { fontSize: 15, fontFamily: "PublicSans_700Bold", color: "#fff", letterSpacing: 0.3 },

  disclaimer: {
    textAlign: "center", fontSize: 11,
    fontFamily: "PublicSans_400Regular", color: C.muted, lineHeight: 16,
    marginBottom: 8,
  },
});