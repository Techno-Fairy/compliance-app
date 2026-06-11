/**
 * app/starter-guide.tsx — FE-24 (revised: Steps 1-3)
 *
 * PUBLIC screen — no JWT required.
 *
 * Changes from original:
 *  Step 1 — Screen renders without a JWT token; step data is static local JSON.
 *            "Exit / Save for later?" prompt warns progress is local only.
 *  Step 2 — Reads / writes progress to SQLite via localOnboardingProgress.ts.
 *            Checkmarks and progress pills are driven by local data.
 *  Step 3 — When all 15 steps are complete, shows a persistent
 *            "Create Your Compliance Account" button instead of "Go to Dashboard".
 */
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  BackHandler,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { MaterialIcons } from "@expo/vector-icons";
import { useRouter, useFocusEffect } from "expo-router";
import * as SecureStore from "expo-secure-store";
import { TopBar } from "@/components/ui/TopBar";
import { useOnboardingSteps } from "@/hooks/useOnboardingProgress";
import {
  getLocalProgress,
  markLocalStep,
  type LocalStepProgress,
} from "@/lib/localOnboardingProgress";
import type { OnboardingPhase, OnboardingStep } from "@/types";

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
};

const PHASE_META: Record<
  number,
  { label: string; icon: React.ComponentProps<typeof MaterialIcons>["name"] }
> = {
  1: { label: "Register Your Business",      icon: "business"         },
  2: { label: "Set Up Your Taxes",           icon: "account-balance"  },
  3: { label: "Employment & Licensing",      icon: "people"           },
  4: { label: "Activate Ongoing Compliance", icon: "verified"         },
};

// ── Static step data (Step 1: no backend call required) ───────────────────────
const STATIC_PHASES: OnboardingPhase[] = [
  {
    phase: 1,
    total_steps: 3,
    completed_steps: 0,
    steps: [
      {
        id: 1, phase: 1, step_number: 1, completed: false, completed_at: null,
        title: "Reserve your company / business name",
        description:
          "Choose at least three proposed names and submit them to CIPA via OBRS. " +
          "CIPA checks availability and reserves the approved name for 30 days.",
        portal_url: "https://obrs.gov.bw",
        documents: ["3 proposed names", "ID copy", "BWP 80 reservation fee"],
      },
      {
        id: 2, phase: 1, step_number: 2, completed: false, completed_at: null,
        title: "Incorporate or register the business",
        description:
          "Pty Ltd: file Memorandum & Articles of Association. " +
          "Sole trader or partnership: complete the relevant CIPA registration form.",
        portal_url: "https://obrs.gov.bw",
        documents: [
          "Memorandum & Articles (Pty Ltd) OR registration form (sole trader/partnership)",
          "ID copies for all directors / partners",
          "Registered office address proof",
        ],
      },
      {
        id: 3, phase: 1, step_number: 3, completed: false, completed_at: null,
        title: "Collect Certificate of Incorporation / Registration",
        description:
          "Download your CIPA certificate from OBRS once issued. Keep the original — " +
          "it is required for BURS registration.",
        portal_url: "https://obrs.gov.bw",
        documents: ["CIPA certificate (download or collect in person)"],
      },
    ],
  },
  {
    phase: 2,
    total_steps: 4,
    completed_steps: 0,
    steps: [
      {
        id: 4, phase: 2, step_number: 1, completed: false, completed_at: null,
        title: "Register for a Tax Identification Number (TIN)",
        description:
          "Register with BURS to receive your TIN. Required before you can file any " +
          "tax returns. Can be done at a BURS office or via eServices.",
        portal_url: "https://eservices.burs.org.bw",
        documents: [
          "CIPA certificate",
          "Director's / owner's ID copy",
          "Proof of business address (lease or utility bill)",
        ],
      },
      {
        id: 5, phase: 2, step_number: 2, completed: false, completed_at: null,
        title: "Assess your VAT registration obligation",
        description:
          "VAT registration is compulsory if your annual turnover meets or exceeds " +
          "BWP 1,000,000. You may register voluntarily below this threshold.",
        portal_url: "https://eservices.burs.org.bw",
        documents: [
          "TIN",
          "Estimated annual turnover (for BURS assessment)",
        ],
      },
      {
        id: 6, phase: 2, step_number: 3, completed: false, completed_at: null,
        title: "Register for PAYE (if employing staff)",
        description:
          "If you pay salaries, you must register as a PAYE employer with BURS and " +
          "remit employee tax monthly.",
        portal_url: "https://eservices.burs.org.bw",
        documents: ["TIN", "List of employees", "Employment contracts"],
      },
      {
        id: 7, phase: 2, step_number: 4, completed: false, completed_at: null,
        title: "Register for Withholding Tax (if applicable)",
        description:
          "Required if your business pays dividends, royalties, or management fees " +
          "to non-residents.",
        portal_url: "https://eservices.burs.org.bw",
        documents: ["TIN", "Details of non-resident payees"],
      },
    ],
  },
  {
    phase: 3,
    total_steps: 4,
    completed_steps: 0,
    steps: [
      {
        id: 8, phase: 3, step_number: 1, completed: false, completed_at: null,
        title: "Obtain a Trade Licence",
        description:
          "A trade licence from MITI (or your Local Council) is required before you " +
          "begin trading. The type of licence depends on your business activity.",
        portal_url: "https://miti.gov.bw",
        documents: [
          "CIPA certificate",
          "Lease agreement / proof of premises",
          "Completed trade licence application form",
          "ID copy",
        ],
      },
      {
        id: 9, phase: 3, step_number: 2, completed: false, completed_at: null,
        title: "Prepare employment contracts",
        description:
          "The Botswana Employment Act (s.28) requires a written employment contract " +
          "within the first month of employment. Download the MITI minimum wage schedule.",
        portal_url: "https://miti.gov.bw",
        documents: [
          "Written employment contract (one per employee)",
          "MITI minimum wage schedule",
        ],
      },
      {
        id: 10, phase: 3, step_number: 3, completed: false, completed_at: null,
        title: "Register for Workers Compensation (BOCCIM)",
        description:
          "Optional but strongly recommended. Provides employer liability cover for " +
          "workplace injuries.",
        portal_url: "https://boccim.co.bw",
        documents: ["CIPA certificate", "List of employees"],
      },
      {
        id: 11, phase: 3, step_number: 4, completed: false, completed_at: null,
        title: "Set up payroll and leave records",
        description:
          "The Labour Act requires written leave records. Set up a payroll spreadsheet " +
          "or accounting software to track salaries, leave balances, and deductions.",
        portal_url: null,
        documents: [
          "Payroll register (spreadsheet or software)",
          "Leave record per employee",
        ],
      },
    ],
  },
];

const TOTAL_STEPS = STATIC_PHASES.reduce((acc, p) => acc + p.total_steps, 0);

// ── Helpers ───────────────────────────────────────────────────────────────────
function buildPhasesWithProgress(
  progressMap: Record<number, LocalStepProgress>
): OnboardingPhase[] {
  return STATIC_PHASES.map((phase) => {
    const steps = phase.steps.map((step) => {
      const local = progressMap[step.id];
      return {
        ...step,
        completed: local?.completed ?? false,
        completed_at: local?.completed_at ?? null,
      };
    });
    const completed_steps = steps.filter((s) => s.completed).length;
    return { ...phase, steps, completed_steps };
  });
}

// ── StepRow ───────────────────────────────────────────────────────────────────
function StepRow({
  step,
  onPress,
}: {
  step: OnboardingStep;
  onPress: () => void;
}) {
  return (
    <Pressable
      style={({ pressed }) => [s.stepRow, pressed && { opacity: 0.75 }]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={step.title}
    >
      <View
        style={[s.stepIcon, step.completed ? s.stepIconDone : s.stepIconPending]}
      >
        {step.completed ? (
          <MaterialIcons name="check" size={14} color={C.secondaryText} />
        ) : (
          <View style={s.stepDot} />
        )}
      </View>

      <View style={s.stepBody}>
        <Text
          style={[s.stepTitle, step.completed && s.stepTitleDone]}
          numberOfLines={2}
        >
          {step.title}
        </Text>
        {step.documents.length > 0 && (
          <Text style={s.stepDocs} numberOfLines={1}>
            {step.documents.length} document
            {step.documents.length > 1 ? "s" : ""} required
          </Text>
        )}
      </View>

      <MaterialIcons name="chevron-right" size={18} color={C.muted} />
    </Pressable>
  );
}

// ── PhaseAccordion ────────────────────────────────────────────────────────────
function PhaseAccordion({
  phase,
  isOpen,
  onToggle,
  onStepPress,
}: {
  phase: OnboardingPhase;
  isOpen: boolean;
  onToggle: () => void;
  onStepPress: (step: OnboardingStep) => void;
}) {
  const anim = useRef(new Animated.Value(isOpen ? 1 : 0)).current;

  useEffect(() => {
    Animated.timing(anim, {
      toValue: isOpen ? 1 : 0,
      duration: 220,
      useNativeDriver: false,
    }).start();
  }, [isOpen]);

  const meta = PHASE_META[phase.phase];
  const isDone = phase.completed_steps === phase.total_steps;
  const pct = phase.total_steps
    ? Math.round((phase.completed_steps / phase.total_steps) * 100)
    : 0;

  return (
    <View style={s.phaseWrap}>
      <Pressable
        style={[
          s.phaseHeader,
          isDone && s.phaseHeaderDone,
          isOpen && !isDone && s.phaseHeaderOpen,
        ]}
        onPress={onToggle}
        accessibilityRole="button"
        accessibilityState={{ expanded: isOpen }}
      >
        <View
          style={[
            s.phaseIconWrap,
            isDone ? s.phaseIconWrapDone : s.phaseIconWrapDefault,
          ]}
        >
          {isDone ? (
            <MaterialIcons name="check-circle" size={22} color={C.secondaryText} />
          ) : (
            <MaterialIcons
              name={meta.icon}
              size={22}
              color={isOpen ? C.teal : C.mid}
            />
          )}
        </View>

        <View style={s.phaseLabelCol}>
          <Text style={s.phaseNum}>Phase {phase.phase}</Text>
          <Text
            style={[
              s.phaseLabel,
              isDone && s.phaseLabelDone,
              isOpen && !isDone && s.phaseLabelOpen,
            ]}
          >
            {meta.label}
          </Text>
          <View style={s.phaseBarTrack}>
            <View
              style={[
                s.phaseBarFill,
                {
                  width: `${pct}%`,
                  backgroundColor: isDone ? C.secondary : C.teal,
                },
              ]}
            />
          </View>
        </View>

        <View style={s.phaseRight}>
          <Text style={s.phaseCount}>
            {phase.completed_steps}/{phase.total_steps}
          </Text>
          <MaterialIcons
            name={isOpen ? "expand-less" : "expand-more"}
            size={20}
            color={C.muted}
          />
        </View>
      </Pressable>

      <Animated.View
        style={[
          s.stepsBody,
          {
            maxHeight: anim.interpolate({
              inputRange: [0, 1],
              outputRange: [0, phase.total_steps * 80],
            }),
          },
        ]}
      >
        <View style={[s.stepsContent, isDone && s.stepsContentDone]}>
          {phase.steps.map((step, idx) => (
            <View key={step.id}>
              {idx > 0 && <View style={s.stepDivider} />}
              <StepRow step={step} onPress={() => onStepPress(step)} />
            </View>
          ))}
        </View>
      </Animated.View>
    </View>
  );
}

// ── Main screen ───────────────────────────────────────────────────────────────
export default function StarterGuideScreen() {
  const router = useRouter();

  // ── Auth detection ─────────────────────────────────────────────────────
  // We check for a stored token to decide the data source:
  //   authenticated → GET /onboarding/steps (real server progress)
  //   public        → local SQLite (pre-registration guide)
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);

  useEffect(() => {
    SecureStore.getItemAsync("access_token").then((token) => {
      setIsAuthenticated(!!token);
    });
  }, []);

  // ── Authenticated path: React Query ───────────────────────────────────
  const {
    data: apiData,
    isLoading: apiLoading,
  } = useOnboardingSteps();

  // ── Public path: local SQLite ─────────────────────────────────────────
  const [phases, setPhases] = useState<OnboardingPhase[]>(
    buildPhasesWithProgress({})
  );
  const [localLoading, setLocalLoading] = useState(true);

  const loadLocalProgress = useCallback(async () => {
    const progressMap = await getLocalProgress();
    setPhases(buildPhasesWithProgress(progressMap));
    setLocalLoading(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (isAuthenticated === false) {
        loadLocalProgress();
      }
    }, [isAuthenticated, loadLocalProgress])
  );

  // ── Derived display phases ─────────────────────────────────────────────
  // For authenticated users, map the API response (OnboardingStatus) back
  // to OnboardingPhase[] — the shape is identical so no transform needed,
  // but we strip Phase 4 to match the public guide's 3-phase structure.
  const displayPhases: OnboardingPhase[] = isAuthenticated && apiData
    ? apiData.phases.filter((p) => p.phase <= 3)
    : phases;

  const loading =
    isAuthenticated === null ||
    (isAuthenticated && apiLoading && !apiData) ||
    (!isAuthenticated && localLoading);

  const [openPhase, setOpenPhase] = useState<number>(1);

  // Auto-open first incomplete phase once data is ready
  useEffect(() => {
    if (loading) return;
    const first = displayPhases.find((p) => p.completed_steps < p.total_steps);
    if (first) setOpenPhase(first.phase);
  }, [loading]);

  // ── Derived totals ─────────────────────────────────────────────────────
  const completedSteps = displayPhases.reduce((acc, p) => acc + p.completed_steps, 0);
  const allComplete    = completedSteps === TOTAL_STEPS;
  const pct            = Math.round((completedSteps / TOTAL_STEPS) * 100);

  // ── Exit prompt (Step 1) ────────────────────────────────────────────────
  const handleExit = useCallback(() => {
    if (completedSteps === 0) {
      router.back();
      return;
    }
    Alert.alert(
      "Save and Exit?",
      "Your progress is saved on this device only. " +
        "Create an account later to keep it permanently.",
      [
        { text: "Keep Going", style: "cancel" },
        { text: "Exit", style: "destructive", onPress: () => router.back() },
      ]
    );
  }, [completedSteps, router]);

  // Intercept Android back button
  useFocusEffect(
    useCallback(() => {
      const sub = BackHandler.addEventListener("hardwareBackPress", () => {
        handleExit();
        return true;
      });
      return () => sub.remove();
    }, [handleExit])
  );

  // ── Navigate to step detail ─────────────────────────────────────────────
  const handleStepPress = (step: OnboardingStep) => {
    router.push({
      pathname: "/starter-guide/[id]",
      params: { id: String(step.id) },
    } as any);
  };

  // ── Loading skeleton ────────────────────────────────────────────────────
  if (loading) {
    return (
      <SafeAreaView style={s.safe}>
        <StatusBar barStyle="dark-content" backgroundColor={C.bg} />
        <TopBar title="Business Starter Guide" onBack={handleExit} />
        <View style={{ flex: 1, padding: 16, gap: 12 }}>
          {[1, 2, 3, 4].map((i) => (
            <View key={i} style={s.skelPhase}>
              <View style={s.skelIcon} />
              <View style={{ flex: 1, gap: 6 }}>
                <View style={[s.skelLine, { width: "40%", height: 10 }]} />
                <View style={[s.skelLine, { width: "70%", height: 13 }]} />
              </View>
            </View>
          ))}
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.safe}>
      <StatusBar barStyle="dark-content" backgroundColor={C.bg} />
      <TopBar title="Business Starter Guide" onBack={handleExit} />

      <ScrollView
        style={s.scroll}
        contentContainerStyle={s.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Hero card ── */}
        <View style={s.hero}>
          <View style={s.heroLeft}>
            <Text style={s.heroEyebrow}>Botswana Compliance Setup</Text>
            <Text style={s.heroTitle}>Business Starter Guide</Text>
            <Text style={s.heroSub}>
              3 phases · 11 steps to full compliance
            </Text>
          </View>
          <View style={s.heroPct}>
            <Text style={s.heroPctNum}>{pct}%</Text>
            <Text style={s.heroPctLabel}>done</Text>
          </View>
        </View>

        {/* ── Local-storage notice (public path only) ── */}
        {!isAuthenticated && (
          <View style={s.noticeBanner}>
            <MaterialIcons name="info-outline" size={16} color={C.teal} />
            <Text style={s.noticeText}>
              Progress is saved on this device. Create an account at the end to
              keep it permanently.
            </Text>
          </View>
        )}

        {/* ── Overall progress bar ── */}
        <View style={s.overallBarWrap}>
          <View style={s.overallBarTrack}>
            <View
              style={[
                s.overallBarFill,
                {
                  width: `${pct}%`,
                  backgroundColor: allComplete ? C.secondary : C.teal,
                },
              ]}
            />
          </View>
          <Text style={s.overallBarLabel}>
            {completedSteps} of {TOTAL_STEPS} steps complete
          </Text>
        </View>

        {/* ── Phase accordions ── */}
        <View style={s.phases}>
          {displayPhases.map((phase) => (
            <PhaseAccordion
              key={phase.phase}
              phase={phase}
              isOpen={openPhase === phase.phase}
              onToggle={() =>
                setOpenPhase((prev) =>
                  prev === phase.phase ? 0 : phase.phase
                )
              }
              onStepPress={handleStepPress}
            />
          ))}
        </View>

        {/* ── Step 3: Celebration + Create Account CTA ── */}
        {allComplete && (
          <View style={s.celebrationCard}>
            <View style={s.celebrationStrip}>
              {[C.teal, C.secondary, C.amber, C.teal, C.secondary].map(
                (col, i) => (
                  <View key={i} style={[s.celebrationDot, { backgroundColor: col }]} />
                )
              )}
            </View>
            <View style={s.celebrationBody}>
              <View style={s.celebrationIcon}>
                <MaterialIcons name="celebration" size={30} color={C.secondary} />
              </View>
              <Text style={s.celebrationTitle}>
                Setup Complete!
              </Text>
              <Text style={s.celebrationSub}>
                {isAuthenticated
                  ? "Your business is fully set up. Your compliance dashboard, penalty tracker, and document vault are all active."
                  : "You've finished all 11 steps. Create your free CompliancePro account to activate your compliance dashboard, penalty tracker, and document vault."}
              </Text>

              {/* ── CTA: context-aware ── */}
              {isAuthenticated ? (
                <Pressable
                  style={({ pressed }) => [s.createBtn, pressed && { opacity: 0.88 }]}
                  onPress={() => router.replace("/(tabs)" as any)}
                  accessibilityRole="button"
                  accessibilityLabel="Go to your compliance dashboard"
                >
                  <MaterialIcons name="dashboard" size={18} color="#fff" />
                  <Text style={s.createBtnText}>Go to Dashboard</Text>
                </Pressable>
              ) : (
                <>
                  {/* ── PRIMARY: Create Account ── */}
                  <Pressable
                    style={({ pressed }) => [
                      s.createBtn,
                      pressed && { opacity: 0.88 },
                    ]}
                    onPress={() => router.push({
                      pathname: "/(auth)/register",
                      params: { fromGuide: "true" },
                    } as any)}
                    accessibilityRole="button"
                    accessibilityLabel="Create your compliance account"
                  >
                    <MaterialIcons name="person-add" size={18} color="#fff" />
                    <Text style={s.createBtnText}>Create Your Compliance Account</Text>
                  </Pressable>

                  {/* ── SECONDARY: remind later ── */}
                  <Pressable
                    style={s.laterBtn}
                    onPress={() =>
                      Alert.alert(
                        "You can register later",
                        "Your progress is saved on this device. Come back any time to create your account.",
                        [{ text: "OK" }]
                      )
                    }
                  >
                    <Text style={s.laterBtnText}>Remind me later</Text>
                  </Pressable>
                </>
              )}
            </View>
          </View>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  safe:          { flex: 1, backgroundColor: C.bg },
  scroll:        { flex: 1 },
  scrollContent: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 16 },

  hero: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: C.surface,
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: C.borderSoft,
    borderLeftWidth: 4,
    borderLeftColor: C.teal,
    marginBottom: 10,
  },
  heroLeft:    { flex: 1, gap: 4 },
  heroEyebrow: {
    fontSize: 9, fontFamily: "PublicSans_700Bold", color: C.teal,
    letterSpacing: 1.4, textTransform: "uppercase",
  },
  heroTitle:   { fontSize: 20, fontFamily: "PublicSans_700Bold", color: C.primary, lineHeight: 26 },
  heroSub:     {
    fontSize: 12, fontFamily: "PublicSans_400Regular", color: C.muted,
    lineHeight: 17, marginTop: 2,
  },
  heroPct: {
    alignItems: "center", justifyContent: "center",
    width: 64, height: 64, borderRadius: 32,
    backgroundColor: C.tealBg, borderWidth: 3, borderColor: C.teal, marginLeft: 12,
  },
  heroPctNum:   { fontSize: 18, fontFamily: "PublicSans_700Bold", color: C.tealDark },
  heroPctLabel: { fontSize: 10, fontFamily: "PublicSans_600SemiBold", color: C.teal, marginTop: -2 },

  noticeBanner: {
    flexDirection: "row", alignItems: "flex-start", gap: 8,
    backgroundColor: C.tealLight,
    borderRadius: 10, paddingHorizontal: 12, paddingVertical: 9,
    marginBottom: 12, borderWidth: 1, borderColor: C.teal + "33",
  },
  noticeText: {
    flex: 1, fontSize: 12, fontFamily: "PublicSans_400Regular",
    color: C.tealDark, lineHeight: 17,
  },

  overallBarWrap:  { marginBottom: 16, gap: 6 },
  overallBarTrack: { height: 8, backgroundColor: C.containerLow, borderRadius: 4, overflow: "hidden" },
  overallBarFill:  { height: 8, borderRadius: 4 },
  overallBarLabel: {
    fontSize: 11, fontFamily: "PublicSans_600SemiBold", color: C.muted, textAlign: "right",
  },

  phases: { gap: 10 },

  phaseWrap:       { borderRadius: 14, overflow: "hidden", borderWidth: 1, borderColor: C.border },
  phaseHeader:     {
    flexDirection: "row", alignItems: "center",
    paddingVertical: 14, paddingHorizontal: 14,
    backgroundColor: C.surface, gap: 12,
  },
  phaseHeaderDone: { backgroundColor: C.secondaryBg + "55" },
  phaseHeaderOpen: { backgroundColor: C.tealLight },

  phaseIconWrap:        {
    width: 40, height: 40, borderRadius: 12,
    alignItems: "center", justifyContent: "center",
  },
  phaseIconWrapDefault: { backgroundColor: C.containerLow },
  phaseIconWrapDone:    { backgroundColor: C.secondaryBg },

  phaseLabelCol: { flex: 1, gap: 2 },
  phaseNum:      {
    fontSize: 9, fontFamily: "PublicSans_700Bold",
    color: C.muted, letterSpacing: 1.2, textTransform: "uppercase",
  },
  phaseLabel:     { fontSize: 14, fontFamily: "PublicSans_700Bold", color: C.primary },
  phaseLabelDone: { color: C.secondaryText },
  phaseLabelOpen: { color: C.tealDark },
  phaseBarTrack:  {
    height: 4, backgroundColor: C.containerLow, borderRadius: 2, overflow: "hidden", marginTop: 4,
  },
  phaseBarFill:   { height: 4, borderRadius: 2 },

  phaseRight:  { alignItems: "center", gap: 4 },
  phaseCount:  { fontSize: 12, fontFamily: "PublicSans_700Bold", color: C.muted },

  stepsBody:        { overflow: "hidden" },
  stepsContent:     { backgroundColor: C.containerLow, paddingHorizontal: 14, paddingVertical: 8 },
  stepsContentDone: { backgroundColor: C.secondaryBg + "22" },

  stepDivider: { height: 1, backgroundColor: C.borderSoft, marginVertical: 2 },
  stepRow:     { flexDirection: "row", alignItems: "center", paddingVertical: 10, gap: 12 },
  stepIcon:    {
    width: 28, height: 28, borderRadius: 14,
    alignItems: "center", justifyContent: "center", borderWidth: 1.5,
  },
  stepIconDone:    { backgroundColor: C.secondaryBg, borderColor: C.secondaryText },
  stepIconPending: { backgroundColor: C.surface, borderColor: C.border },
  stepDot:         { width: 8, height: 8, borderRadius: 4, backgroundColor: C.border },
  stepBody:        { flex: 1, gap: 2 },
  stepTitle:       {
    fontSize: 13, fontFamily: "PublicSans_600SemiBold", color: C.primary, lineHeight: 18,
  },
  stepTitleDone:   { color: C.muted, textDecorationLine: "line-through" },
  stepDocs:        { fontSize: 11, fontFamily: "PublicSans_400Regular", color: C.muted },

  // Celebration / CTA
  celebrationCard: {
    backgroundColor: C.surface, borderRadius: 16, marginTop: 16,
    overflow: "hidden", borderWidth: 1, borderColor: C.secondary + "55",
  },
  celebrationStrip: { flexDirection: "row", height: 8, overflow: "hidden" },
  celebrationDot:   { flex: 1 },
  celebrationBody:  { padding: 20, gap: 12, alignItems: "center" },
  celebrationIcon: {
    width: 60, height: 60, borderRadius: 30,
    backgroundColor: C.secondaryBg, alignItems: "center", justifyContent: "center",
    borderWidth: 2, borderColor: C.secondary + "55",
  },
  celebrationTitle: {
    fontSize: 20, fontFamily: "PublicSans_700Bold", color: C.primary, textAlign: "center",
  },
  celebrationSub: {
    fontSize: 13, fontFamily: "PublicSans_400Regular",
    color: C.mid, textAlign: "center", lineHeight: 20,
  },
  createBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    backgroundColor: C.teal, borderRadius: 14,
    paddingVertical: 15, paddingHorizontal: 20, alignSelf: "stretch",
  },
  createBtnText: {
    fontSize: 15, fontFamily: "PublicSans_700Bold", color: "#fff", letterSpacing: 0.3,
  },
  laterBtn: { paddingVertical: 6, paddingHorizontal: 12 },
  laterBtnText: {
    fontSize: 13, fontFamily: "PublicSans_600SemiBold", color: C.muted, textDecorationLine: "underline",
  },

  skelPhase: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: C.surface, borderRadius: 14, padding: 14, gap: 12,
    borderWidth: 1, borderColor: C.border,
  },
  skelIcon:  { width: 40, height: 40, borderRadius: 12, backgroundColor: C.border },
  skelLine:  { backgroundColor: C.border, borderRadius: 4 },
});