/**
 * app/starter-guide/[id].tsx — FE-25 (revised: Steps 1-2)
 *
 * PUBLIC — no JWT required.
 *
 * Changes from original:
 *  • Step data comes from the static STATIC_STEPS map (no API call).
 *  • Mark Complete / Incomplete writes to SQLite via localOnboardingProgress.ts.
 *  • No useMarkStepComplete mutation (that's the authenticated hook).
 */
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Linking,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  ToastAndroid,
  View,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { MaterialIcons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { TopBar } from "@/components/ui/TopBar";
import {
  getLocalProgress,
  markLocalStep,
} from "@/lib/localOnboardingProgress";
import type { OnboardingStep } from "@/types";

// ── Design tokens ──────────────────────────────────────────────────────────────
const C = {
  bg:            "#f3faff",
  surface:       "#ffffff",
  primary:       "#000b25",
  mid:           "#44474e",
  muted:         "#75777f",
  border:        "#c5c6cf",
  borderSoft:    "#e6f6ff",
  teal:          "#006874",
  tealBg:        "#d8f3f6",
  tealDark:      "#004f58",
  tealLight:     "#e8f8fa",
  secondary:     "#2a6b2c",
  secondaryBg:   "#acf4a4",
  secondaryText: "#307231",
  amber:         "#D4830A",
  amberBg:       "#FEF3E2",
  error:         "#ba1a1a",
  errorBg:       "#ffdad6",
  container:     "#dbf1fe",
  containerLow:  "#e6f6ff",
  burs:          "#1A3C5E",
  bursBg:        "#EAF0F7",
};

const PHASE_LABELS: Record<number, string> = {
  1: "Register Your Business",
  2: "Set Up Your Taxes",
  3: "Employment & Licensing",
  4: "Activate Ongoing Compliance",
};

// ── Static step catalogue (mirrors starter-guide.tsx) ─────────────────────────
// (Centralise to a shared lib if the project grows.)
const STATIC_STEPS: Record<number, OnboardingStep> = {
  1:  { id: 1,  phase: 1, step_number: 1, completed: false, completed_at: null, title: "Reserve your company / business name",         portal_url: "https://obrs.gov.bw",               documents: ["3 proposed names", "ID copy", "BWP 80 reservation fee"],                                                    description: "Choose at least three proposed names and submit them to CIPA via OBRS. CIPA checks availability and reserves the approved name for 30 days." },
  2:  { id: 2,  phase: 1, step_number: 2, completed: false, completed_at: null, title: "Incorporate or register the business",           portal_url: "https://obrs.gov.bw",               documents: ["Memorandum & Articles (Pty Ltd) OR registration form (sole trader/partnership)", "ID copies for all directors / partners", "Registered office address proof"],  description: "Pty Ltd: file Memorandum & Articles of Association. Sole trader or partnership: complete the relevant CIPA registration form." },
  3:  { id: 3,  phase: 1, step_number: 3, completed: false, completed_at: null, title: "Collect Certificate of Incorporation / Registration", portal_url: "https://obrs.gov.bw",          documents: ["CIPA certificate (download or collect in person)"],                                                      description: "Download your CIPA certificate from OBRS once issued. Keep the original — it is required for BURS registration." },
  4:  { id: 4,  phase: 2, step_number: 1, completed: false, completed_at: null, title: "Register for a Tax Identification Number (TIN)",  portal_url: "https://eservices.burs.org.bw",    documents: ["CIPA certificate", "Director's / owner's ID copy", "Proof of business address (lease or utility bill)"],                                    description: "Register with BURS to receive your TIN. Required before you can file any tax returns. Can be done at a BURS office or via eServices." },
  5:  { id: 5,  phase: 2, step_number: 2, completed: false, completed_at: null, title: "Assess your VAT registration obligation",         portal_url: "https://eservices.burs.org.bw",    documents: ["TIN", "Estimated annual turnover (for BURS assessment)"],                                               description: "VAT registration is compulsory if your annual turnover meets or exceeds BWP 1,000,000. You may register voluntarily below this threshold." },
  6:  { id: 6,  phase: 2, step_number: 3, completed: false, completed_at: null, title: "Register for PAYE (if employing staff)",           portal_url: "https://eservices.burs.org.bw",    documents: ["TIN", "List of employees", "Employment contracts"],                                                      description: "If you pay salaries, you must register as a PAYE employer with BURS and remit employee tax monthly." },
  7:  { id: 7,  phase: 2, step_number: 4, completed: false, completed_at: null, title: "Register for Withholding Tax (if applicable)",     portal_url: "https://eservices.burs.org.bw",    documents: ["TIN", "Details of non-resident payees"],                                                                 description: "Required if your business pays dividends, royalties, or management fees to non-residents." },
  8:  { id: 8,  phase: 3, step_number: 1, completed: false, completed_at: null, title: "Obtain a Trade Licence",                          portal_url: "https://miti.gov.bw",               documents: ["CIPA certificate", "Lease agreement / proof of premises", "Completed trade licence application form", "ID copy"],                             description: "A trade licence from MITI (or your Local Council) is required before you begin trading. The type of licence depends on your business activity." },
  9:  { id: 9,  phase: 3, step_number: 2, completed: false, completed_at: null, title: "Prepare employment contracts",                    portal_url: "https://miti.gov.bw",               documents: ["Written employment contract (one per employee)", "MITI minimum wage schedule"],                         description: "The Botswana Employment Act (s.28) requires a written employment contract within the first month of employment." },
  10: { id: 10, phase: 3, step_number: 3, completed: false, completed_at: null, title: "Register for Workers Compensation (BOCCIM)",      portal_url: "https://boccim.co.bw",              documents: ["CIPA certificate", "List of employees"],                                                                 description: "Optional but strongly recommended. Provides employer liability cover for workplace injuries." },
  11: { id: 11, phase: 3, step_number: 4, completed: false, completed_at: null, title: "Set up payroll and leave records",                portal_url: null,                                documents: ["Payroll register (spreadsheet or software)", "Leave record per employee"],                              description: "The Labour Act requires written leave records. Set up a payroll spreadsheet or accounting software to track salaries, leave balances, and deductions." },
};

function showToast(message: string) {
  if (Platform.OS === "android") {
    ToastAndroid.show(message, ToastAndroid.SHORT);
  } else {
    Alert.alert("", message);
  }
}

export default function StarterGuideStepDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  const stepId = parseInt(id ?? "0", 10);
  const baseStep = STATIC_STEPS[stepId];

  const [completed, setCompleted] = useState(false);
  const [completedAt, setCompletedAt] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [ready, setReady] = useState(false);

  // Load local completion state
  useEffect(() => {
    getLocalProgress().then((map) => {
      const local = map[stepId];
      setCompleted(local?.completed ?? false);
      setCompletedAt(local?.completed_at ?? null);
      setReady(true);
    });
  }, [stepId]);

  const handleToggle = useCallback(
    (targetValue: boolean) => {
      const title = targetValue ? "Mark as Complete?" : "Mark as Incomplete?";
      const message = targetValue
        ? "Confirm you have finished this step."
        : "This will unmark the step as complete.";

      Alert.alert(title, message, [
        { text: "Cancel", style: "cancel" },
        {
          text: "Confirm",
          onPress: async () => {
            setSaving(true);
            await markLocalStep(stepId, targetValue);
            setCompleted(targetValue);
            setCompletedAt(targetValue ? new Date().toISOString() : null);
            setSaving(false);
            showToast(targetValue ? "Step marked complete ✓" : "Step unmarked");
          },
        },
      ]);
    },
    [stepId]
  );

  if (!baseStep) {
    return (
      <SafeAreaView style={s.safe}>
        <TopBar title="Step Detail" showBack />
        <View style={s.errorBox}>
          <MaterialIcons name="error-outline" size={40} color={C.error} />
          <Text style={s.errorTitle}>Step not found</Text>
          <Pressable style={s.retryBtn} onPress={() => router.back()}>
            <Text style={s.retryText}>Go Back</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  const step: OnboardingStep = { ...baseStep, completed, completed_at: completedAt };

  return (
    <SafeAreaView style={s.safe}>
      <StatusBar barStyle="dark-content" backgroundColor={C.bg} />
      <TopBar title={`Phase ${step.phase}: ${PHASE_LABELS[step.phase]}`} showBack />

      <ScrollView
        style={s.scroll}
        contentContainerStyle={s.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Status banner ── */}
        {step.completed && (
          <View style={s.successBanner}>
            <MaterialIcons name="check-circle" size={18} color={C.secondaryText} />
            <View style={{ flex: 1 }}>
              <Text style={s.successTitle}>Step complete</Text>
              {completedAt && (
                <Text style={s.successDate}>
                  {new Date(completedAt).toLocaleDateString("en-BW", {
                    day: "numeric", month: "short", year: "numeric",
                  })}
                </Text>
              )}
            </View>
          </View>
        )}

        {/* ── Title ── */}
        <View style={s.titleCard}>
          <View style={s.stepBadge}>
            <Text style={s.stepBadgeText}>
              Step {step.step_number}
            </Text>
          </View>
          <Text style={s.stepTitle}>{step.title}</Text>
        </View>

        {/* ── Description ── */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>What to do</Text>
          <Text style={s.description}>{step.description}</Text>
        </View>

        {/* ── Documents ── */}
        {step.documents.length > 0 && (
          <View style={s.section}>
            <Text style={s.sectionTitle}>Documents you'll need</Text>
            <View style={s.docList}>
              {step.documents.map((doc, idx) => (
                <View key={idx} style={s.docRow}>
                  <MaterialIcons name="description" size={16} color={C.teal} />
                  <Text style={s.docText}>{doc}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* ── Portal link ── */}
        {step.portal_url && (
          <View style={s.section}>
            <Text style={s.sectionTitle}>Online portal</Text>
            <Pressable
              style={({ pressed }) => [s.portalBtn, pressed && { opacity: 0.82 }]}
              onPress={() => Linking.openURL(step.portal_url!)}
            >
              <MaterialIcons name="open-in-new" size={18} color="#fff" />
              <Text style={s.portalBtnText}>
                Open{" "}
                {step.portal_url.includes("burs") ? "BURS" :
                 step.portal_url.includes("obrs") ? "CIPA (OBRS)" :
                 step.portal_url.includes("miti") ? "MITI" :
                 step.portal_url.includes("boccim") ? "BOCCIM" : "Portal"}
              </Text>
            </Pressable>
          </View>
        )}

        {/* ── Mark Complete / Incomplete button ── */}
        <View style={s.actionRow}>
          {!ready ? (
            <ActivityIndicator color={C.teal} />
          ) : step.completed ? (
            <Pressable
              style={({ pressed }) => [s.undoBtn, pressed && { opacity: 0.82 }]}
              onPress={() => handleToggle(false)}
              disabled={saving}
            >
              {saving ? (
                <ActivityIndicator size="small" color={C.muted} />
              ) : (
                <>
                  <MaterialIcons name="undo" size={18} color={C.mid} />
                  <Text style={s.undoBtnText}>Mark as Incomplete</Text>
                </>
              )}
            </Pressable>
          ) : (
            <Pressable
              style={({ pressed }) => [s.completeBtn, pressed && { opacity: 0.88 }]}
              onPress={() => handleToggle(true)}
              disabled={saving}
            >
              {saving ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <>
                  <MaterialIcons name="check-circle-outline" size={18} color="#fff" />
                  <Text style={s.completeBtnText}>Mark Step as Complete</Text>
                </>
              )}
            </Pressable>
          )}
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:          { flex: 1, backgroundColor: C.bg },
  scroll:        { flex: 1 },
  scrollContent: { paddingHorizontal: 16, paddingTop: 12 },

  successBanner: {
    flexDirection: "row", alignItems: "center", gap: 10,
    backgroundColor: C.secondaryBg, borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 10, marginBottom: 12,
    borderWidth: 1, borderColor: C.secondary + "55",
  },
  successTitle: { fontSize: 13, fontFamily: "PublicSans_700Bold", color: C.secondaryText },
  successDate:  { fontSize: 11, fontFamily: "PublicSans_400Regular", color: C.secondary },

  titleCard: {
    backgroundColor: C.surface, borderRadius: 16,
    padding: 18, marginBottom: 12,
    borderWidth: 1, borderColor: C.borderSoft,
    borderLeftWidth: 4, borderLeftColor: C.teal,
    gap: 8,
  },
  stepBadge: {
    alignSelf: "flex-start",
    backgroundColor: C.tealBg, borderRadius: 6,
    paddingHorizontal: 8, paddingVertical: 3,
  },
  stepBadgeText: { fontSize: 11, fontFamily: "PublicSans_700Bold", color: C.teal },
  stepTitle: { fontSize: 17, fontFamily: "PublicSans_700Bold", color: C.primary, lineHeight: 24 },

  section: {
    backgroundColor: C.surface, borderRadius: 14,
    padding: 16, marginBottom: 10,
    borderWidth: 1, borderColor: C.borderSoft, gap: 8,
  },
  sectionTitle: { fontSize: 12, fontFamily: "PublicSans_700Bold", color: C.teal, textTransform: "uppercase", letterSpacing: 0.8 },
  description:  { fontSize: 14, fontFamily: "PublicSans_400Regular", color: C.mid, lineHeight: 21 },

  docList: { gap: 8 },
  docRow:  { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  docText: { flex: 1, fontSize: 13, fontFamily: "PublicSans_400Regular", color: C.mid, lineHeight: 19 },

  portalBtn: {
    flexDirection: "row", alignItems: "center", gap: 8,
    backgroundColor: C.teal, borderRadius: 12,
    paddingVertical: 12, paddingHorizontal: 16,
  },
  portalBtnText: { fontSize: 14, fontFamily: "PublicSans_700Bold", color: "#fff" },

  actionRow:  { marginTop: 8 },
  completeBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    backgroundColor: C.secondary, borderRadius: 14,
    paddingVertical: 15, paddingHorizontal: 20,
  },
  completeBtnText: { fontSize: 15, fontFamily: "PublicSans_700Bold", color: "#fff" },
  undoBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    backgroundColor: C.surface, borderRadius: 14,
    borderWidth: 1, borderColor: C.border,
    paddingVertical: 13, paddingHorizontal: 20,
  },
  undoBtnText: { fontSize: 14, fontFamily: "PublicSans_600SemiBold", color: C.mid },

  errorBox:   { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
  errorTitle: { fontSize: 16, fontFamily: "PublicSans_700Bold", color: C.primary },
  retryBtn:   { backgroundColor: C.teal, borderRadius: 10, paddingHorizontal: 28, paddingVertical: 11 },
  retryText:  { fontSize: 14, fontFamily: "PublicSans_700Bold", color: "#fff" },
});