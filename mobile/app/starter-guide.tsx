/**
 * /starter-guide — FE-24
 *
 * 4-phase accordion screen showing all onboarding steps with status icons.
 * - Active phase auto-expands; completed phases collapse with green checkmark.
 * - Overall progress pill in header.
 * - Matches CompliancePro design system: PublicSans, C tokens, TopBar.
 *
 * Step detail (documents, portal link, Mark Complete button) is FE-25.
 * "Setup Complete" celebration flow is FE-26.
 */
import { useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  Pressable,
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { MaterialIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useOnboardingSteps, useCompleteOnboarding } from "@/hooks/useOnboardingProgress";
import { TopBar } from "@/components/ui/TopBar";
import type { OnboardingPhase, OnboardingStep } from "@/types";

// ── Design tokens ─────────────────────────────────────────────────────────────
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

const PHASE_META: Record<number, { label: string; icon: React.ComponentProps<typeof MaterialIcons>["name"] }> = {
  1: { label: "Register Your Business",     icon: "business"         },
  2: { label: "Set Up Your Taxes",          icon: "account-balance"  },
  3: { label: "Employment & Licensing",     icon: "people"           },
  4: { label: "Activate Ongoing Compliance",icon: "verified"         },
};

// ── Step row ──────────────────────────────────────────────────────────────────
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
      {/* Status icon */}
      <View style={[s.stepIcon, step.completed ? s.stepIconDone : s.stepIconPending]}>
        {step.completed ? (
          <MaterialIcons name="check" size={14} color={C.secondaryText} />
        ) : (
          <View style={s.stepDot} />
        )}
      </View>

      {/* Title + documents hint */}
      <View style={s.stepBody}>
        <Text
          style={[s.stepTitle, step.completed && s.stepTitleDone]}
          numberOfLines={2}
        >
          {step.title}
        </Text>
        {step.documents.length > 0 && (
          <Text style={s.stepDocs} numberOfLines={1}>
            {step.documents.length} document{step.documents.length > 1 ? "s" : ""} required
          </Text>
        )}
      </View>

      {/* Chevron */}
      <MaterialIcons name="chevron-right" size={18} color={C.border} />
    </Pressable>
  );
}

// ── Phase accordion ───────────────────────────────────────────────────────────
function PhaseAccordion({
  phase,
  defaultOpen,
  onStepPress,
}: {
  phase: OnboardingPhase;
  defaultOpen: boolean;
  onStepPress: (step: OnboardingStep) => void;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const anim        = useRef(new Animated.Value(defaultOpen ? 1 : 0)).current;
  const chevronAnim = useRef(new Animated.Value(defaultOpen ? 1 : 0)).current;

  const meta = PHASE_META[phase.phase] ?? { label: `Phase ${phase.phase}`, icon: "checklist" };
  const isPhaseComplete = phase.completed_steps === phase.total_steps && phase.total_steps > 0;
  const progressPct = phase.total_steps > 0
    ? Math.round((phase.completed_steps / phase.total_steps) * 100)
    : 0;

  const toggle = () => {
    const to = open ? 0 : 1;
    Animated.parallel([
      Animated.spring(anim,        { toValue: to, useNativeDriver: false, friction: 14, tension: 80 }),
      Animated.spring(chevronAnim, { toValue: to, useNativeDriver: true,  friction: 14, tension: 80 }),
    ]).start();
    setOpen(!open);
  };

  const estimatedItemH = 72;
  const maxHeight = anim.interpolate({
    inputRange:  [0, 1],
    outputRange: [0, phase.total_steps * estimatedItemH + 24],
  });
  const opacity = anim.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0, 0.6, 1] });
  const chevronRotate = chevronAnim.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "180deg"] });

  return (
    <View style={s.phaseWrap}>
      {/* Phase header */}
      <TouchableOpacity
        style={[
          s.phaseHeader,
          isPhaseComplete && s.phaseHeaderDone,
          open && !isPhaseComplete && s.phaseHeaderOpen,
        ]}
        onPress={toggle}
        activeOpacity={0.78}
        accessibilityRole="button"
        accessibilityLabel={`${meta.label}, ${phase.completed_steps} of ${phase.total_steps} steps complete`}
      >
        {/* Phase icon */}
        <View
          style={[
            s.phaseIconWrap,
            isPhaseComplete ? s.phaseIconWrapDone : s.phaseIconWrapDefault,
          ]}
        >
          {isPhaseComplete ? (
            <MaterialIcons name="check-circle" size={20} color={C.secondaryText} />
          ) : (
            <MaterialIcons name={meta.icon} size={20} color={open ? C.teal : C.mid} />
          )}
        </View>

        {/* Labels */}
        <View style={s.phaseLabelCol}>
          <Text style={s.phaseNum}>PHASE {phase.phase}</Text>
          <Text
            style={[s.phaseLabel, isPhaseComplete && s.phaseLabelDone, open && !isPhaseComplete && s.phaseLabelOpen]}
            numberOfLines={1}
          >
            {meta.label}
          </Text>

          {/* Inline progress bar */}
          <View style={s.phaseBarTrack}>
            <View
              style={[
                s.phaseBarFill,
                {
                  width: `${progressPct}%`,
                  backgroundColor: isPhaseComplete ? C.secondaryText : C.teal,
                },
              ]}
            />
          </View>
        </View>

        {/* Right side: count + chevron */}
        <View style={s.phaseRight}>
          <Text style={[s.phaseCount, isPhaseComplete && { color: C.secondaryText }]}>
            {phase.completed_steps}/{phase.total_steps}
          </Text>
          <Animated.View style={{ transform: [{ rotate: chevronRotate }] }}>
            <MaterialIcons
              name="expand-less"
              size={20}
              color={isPhaseComplete ? C.secondaryText : open ? C.teal : C.muted}
            />
          </Animated.View>
        </View>
      </TouchableOpacity>

      {/* Steps list */}
      <Animated.View style={[s.stepsBody, { maxHeight, opacity }]}>
        <View style={[s.stepsContent, isPhaseComplete && s.stepsContentDone]}>
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

// ── Skeleton loader ───────────────────────────────────────────────────────────
function SkeletonGuide() {
  return (
    <View style={{ gap: 10, opacity: 0.45 }}>
      {[1, 2, 3, 4].map((i) => (
        <View key={i} style={s.skelPhase}>
          <View style={s.skelIcon} />
          <View style={{ flex: 1, gap: 6 }}>
            <View style={[s.skelLine, { width: 60, height: 10 }]} />
            <View style={[s.skelLine, { width: "75%", height: 14 }]} />
            <View style={[s.skelLine, { width: "100%", height: 5 }]} />
          </View>
        </View>
      ))}
    </View>
  );
}

// ── Main screen ───────────────────────────────────────────────────────────────
export default function StarterGuideScreen() {
  const router = useRouter();
  const { data, isLoading, isError, refetch } = useOnboardingSteps();
  const { mutate: completeOnboarding, isPending: isCompleting } = useCompleteOnboarding();
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  const handleStepPress = (step: OnboardingStep) => {
    // FE-25 will implement the step detail expand; for now navigate with step id
    router.push(`/starter-guide/${step.id}` as any);
  };

  // Derive the active phase: first phase that is not yet complete
  const activePhase = data?.phases.find((p) => p.completed_steps < p.total_steps)?.phase ?? 1;

  const fromCache = (data as typeof data & { fromCache?: boolean })?.fromCache;
  const overallPct = data?.overall_progress_pct ?? 0;
  const completedSteps = data?.completed_steps ?? 0;
  const totalSteps = data?.total_steps ?? 0;

  return (
    <SafeAreaView style={s.safe} edges={["top"]}>
      <StatusBar barStyle="dark-content" backgroundColor={C.container} />
      <TopBar showBack />

      <ScrollView
        style={s.scroll}
        contentContainerStyle={s.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.teal} />
        }
      >
        {/* ── Hero header ─────────────────────────────────────────────────── */}
        <View style={s.hero}>
          <View style={s.heroLeft}>
            <Text style={s.heroEyebrow}>BUSINESS SETUP GUIDE</Text>
            <Text style={s.heroTitle}>
              {data?.is_onboarding_complete
                ? "Setup Complete 🎉"
                : "Complete your setup"}
            </Text>
            <Text style={s.heroSub}>
              {data?.is_onboarding_complete
                ? "Your compliance dashboard is fully active."
                : "Follow the steps below to become fully compliant in Botswana."}
            </Text>
          </View>

          {/* Overall progress ring */}
          <View style={s.heroPct}>
            <Text style={s.heroPctNum}>{Math.round(overallPct)}%</Text>
            <Text style={s.heroPctLabel}>done</Text>
          </View>
        </View>

        {/* Overall progress bar */}
        <View style={s.overallBarWrap}>
          <View style={s.overallBarTrack}>
            <View
              style={[
                s.overallBarFill,
                {
                  width: `${overallPct}%`,
                  backgroundColor: data?.is_onboarding_complete ? C.secondaryText : C.teal,
                },
              ]}
            />
          </View>
          <Text style={s.overallBarLabel}>
            {completedSteps} of {totalSteps} steps complete
          </Text>
        </View>

        {/* Offline notice */}
        {fromCache && (
          <View style={s.offlineBanner}>
            <MaterialIcons name="cloud-off" size={14} color={C.amber} />
            <Text style={s.offlineText}>
              Showing cached steps — changes will sync when back online.
            </Text>
          </View>
        )}

        {/* ── Content ─────────────────────────────────────────────────────── */}
        {isLoading && !data && <SkeletonGuide />}

        {isError && !data && (
          <View style={s.errorBox}>
            <MaterialIcons name="wifi-off" size={40} color={C.error} />
            <Text style={s.errorTitle}>Could not load guide</Text>
            <Text style={s.errorDesc}>Check your connection and try again.</Text>
            <Pressable style={s.retryBtn} onPress={() => refetch()}>
              <Text style={s.retryText}>Retry</Text>
            </Pressable>
          </View>
        )}

        {data && (
          <View style={s.phases}>
            {data.phases.map((phase) => (
              <PhaseAccordion
                key={phase.phase}
                phase={phase}
                defaultOpen={phase.phase === activePhase}
                onStepPress={handleStepPress}
              />
            ))}
          </View>
        )}

        {/* FE-26: "Setup Complete" celebration banner + Finish Setup CTA */}
        {data?.is_onboarding_complete && (
          <View style={s.celebrationCard}>
            {/* Confetti-style accent strip */}
            <View style={s.celebrationStrip}>
              {["#acf4a4", "#d8f3f6", "#FEF3E2", "#acf4a4", "#d8f3f6"].map((col, i) => (
                <View key={i} style={[s.celebrationDot, { backgroundColor: col }]} />
              ))}
            </View>

            <View style={s.celebrationBody}>
              {/* Icon */}
              <View style={s.celebrationIcon}>
                <MaterialIcons name="verified" size={32} color={C.secondaryText} />
              </View>

              {/* Message */}
              <Text style={s.celebrationTitle}>Setup Complete! 🎉</Text>
              <Text style={s.celebrationSub}>
                All 4 compliance phases are done. Your health score, penalty
                exposure engine, and deadline tracking are now fully active.
              </Text>

              {/* What's now active list */}
              <View style={s.activatedList}>
                {[
                  { icon: "bar-chart",      label: "Health score activated"          },
                  { icon: "warning",        label: "Penalty exposure engine live"    },
                  { icon: "notifications",  label: "Deadline notifications enabled"  },
                  { icon: "folder-special", label: "Evidence vault ready"            },
                ].map(({ icon, label }) => (
                  <View key={label} style={s.activatedRow}>
                    <MaterialIcons name={icon as any} size={14} color={C.secondaryText} />
                    <Text style={s.activatedLabel}>{label}</Text>
                  </View>
                ))}
              </View>

              {/* Go to Dashboard CTA */}
              <Pressable
                style={({ pressed }) => [
                  s.finishBtn,
                  pressed && { opacity: 0.82 },
                  isCompleting && s.finishBtnDisabled,
                ]}
                onPress={() => {
                  // data.is_onboarding_complete is already true (set by the last
                  // PATCH /onboarding/steps auto-trigger in BE-28). We call the
                  // manual override as a belt-and-braces confirmation, then navigate.
                  completeOnboarding(undefined, {
                    onSuccess: () => router.replace("/(tabs)" as any),
                    onError: () => {
                      // Cache was already flipped optimistically; navigate anyway
                      // so the user isn't blocked. Show a non-blocking notice.
                      Alert.alert(
                        "Almost there",
                        "Your setup is saved locally. The dashboard is now active.",
                        [{ text: "Go to Dashboard", onPress: () => router.replace("/(tabs)" as any) }]
                      );
                    },
                  });
                }}
                disabled={isCompleting}
                accessibilityRole="button"
                accessibilityLabel="Go to your compliance dashboard"
              >
                {isCompleting ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <>
                    <MaterialIcons name="dashboard" size={18} color="#fff" />
                    <Text style={s.finishBtnText}>Go to Dashboard</Text>
                  </>
                )}
              </Pressable>
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

  // Hero
  hero: {
    flexDirection:    "row",
    alignItems:       "center",
    backgroundColor:  C.surface,
    borderRadius:     16,
    padding:          18,
    borderWidth:      1,
    borderColor:      C.borderSoft,
    borderLeftWidth:  4,
    borderLeftColor:  C.teal,
    marginBottom:     12,
  },
  heroLeft:      { flex: 1, gap: 4 },
  heroEyebrow:   { fontSize: 9, fontFamily: "PublicSans_700Bold", color: C.teal, letterSpacing: 1.4, textTransform: "uppercase" },
  heroTitle:     { fontSize: 20, fontFamily: "PublicSans_700Bold", color: C.primary, lineHeight: 26 },
  heroSub:       { fontSize: 12, fontFamily: "PublicSans_400Regular", color: C.muted, lineHeight: 17, marginTop: 2 },
  heroPct:       { alignItems: "center", justifyContent: "center", width: 64, height: 64, borderRadius: 32, backgroundColor: C.tealBg, borderWidth: 3, borderColor: C.teal, marginLeft: 12 },
  heroPctNum:    { fontSize: 18, fontFamily: "PublicSans_700Bold", color: C.tealDark },
  heroPctLabel:  { fontSize: 10, fontFamily: "PublicSans_600SemiBold", color: C.teal, marginTop: -2 },

  // Overall bar
  overallBarWrap:  { marginBottom: 16, gap: 6 },
  overallBarTrack: { height: 8, backgroundColor: C.containerLow, borderRadius: 4, overflow: "hidden" },
  overallBarFill:  { height: 8, borderRadius: 4 },
  overallBarLabel: { fontSize: 11, fontFamily: "PublicSans_600SemiBold", color: C.muted, textAlign: "right" },

  // Offline banner
  offlineBanner: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: C.amberBg, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, marginBottom: 12, borderWidth: 1, borderColor: "#F5D78E" },
  offlineText:   { flex: 1, fontSize: 12, fontFamily: "PublicSans_400Regular", color: C.amber, lineHeight: 17 },

  // Phase accordion
  phases:       { gap: 10 },
  phaseWrap:    { borderRadius: 14, overflow: "hidden", borderWidth: 1, borderColor: C.border },
  phaseHeader:  { flexDirection: "row", alignItems: "center", paddingVertical: 14, paddingHorizontal: 14, backgroundColor: C.surface, gap: 12 },
  phaseHeaderDone: { backgroundColor: C.secondaryBg + "55" },
  phaseHeaderOpen: { backgroundColor: C.tealLight },

  phaseIconWrap:        { width: 40, height: 40, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  phaseIconWrapDefault: { backgroundColor: C.containerLow },
  phaseIconWrapDone:    { backgroundColor: C.secondaryBg },

  phaseLabelCol: { flex: 1, gap: 2 },
  phaseNum:      { fontSize: 9, fontFamily: "PublicSans_700Bold", color: C.muted, letterSpacing: 1.2, textTransform: "uppercase" },
  phaseLabel:    { fontSize: 14, fontFamily: "PublicSans_700Bold", color: C.primary },
  phaseLabelDone:{ color: C.secondaryText },
  phaseLabelOpen:{ color: C.tealDark },
  phaseBarTrack: { height: 4, backgroundColor: C.containerLow, borderRadius: 2, overflow: "hidden", marginTop: 4 },
  phaseBarFill:  { height: 4, borderRadius: 2 },

  phaseRight:    { alignItems: "center", gap: 4 },
  phaseCount:    { fontSize: 12, fontFamily: "PublicSans_700Bold", color: C.muted },

  // Steps list
  stepsBody:    { overflow: "hidden" },
  stepsContent: { backgroundColor: C.containerLow, paddingHorizontal: 14, paddingVertical: 8 },
  stepsContentDone: { backgroundColor: C.secondaryBg + "22" },

  stepDivider: { height: 1, backgroundColor: C.borderSoft, marginVertical: 2 },
  stepRow:     { flexDirection: "row", alignItems: "center", paddingVertical: 10, gap: 12 },
  stepIcon:    { width: 28, height: 28, borderRadius: 14, alignItems: "center", justifyContent: "center", borderWidth: 1.5 },
  stepIconDone:   { backgroundColor: C.secondaryBg, borderColor: C.secondaryText },
  stepIconPending:{ backgroundColor: C.surface, borderColor: C.border },
  stepDot:     { width: 8, height: 8, borderRadius: 4, backgroundColor: C.border },
  stepBody:    { flex: 1, gap: 2 },
  stepTitle:   { fontSize: 13, fontFamily: "PublicSans_600SemiBold", color: C.primary, lineHeight: 18 },
  stepTitleDone:{ color: C.muted, textDecorationLine: "line-through" },
  stepDocs:    { fontSize: 11, fontFamily: "PublicSans_400Regular", color: C.muted },

  // Error
  errorBox:   { alignItems: "center", paddingVertical: 40, gap: 10 },
  errorTitle: { fontSize: 16, fontFamily: "PublicSans_700Bold", color: C.primary },
  errorDesc:  { fontSize: 13, fontFamily: "PublicSans_400Regular", color: C.muted, textAlign: "center" },
  retryBtn:   { marginTop: 8, backgroundColor: C.teal, borderRadius: 10, paddingHorizontal: 28, paddingVertical: 11 },
  retryText:  { fontSize: 14, fontFamily: "PublicSans_700Bold", color: "#fff" },

  // FE-26 — Celebration card
  celebrationCard: {
    backgroundColor: C.surface,
    borderRadius: 16,
    marginTop: 16,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: C.secondary + "55",
  },
  celebrationStrip: {
    flexDirection: "row",
    height: 8,
    overflow: "hidden",
  },
  celebrationDot: {
    flex: 1,
  },
  celebrationBody: {
    padding: 20,
    gap: 12,
    alignItems: "center",
  },
  celebrationIcon: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: C.secondaryBg,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: C.secondary + "55",
  },
  celebrationTitle: {
    fontSize: 20,
    fontFamily: "PublicSans_700Bold",
    color: C.primary,
    textAlign: "center",
  },
  celebrationSub: {
    fontSize: 13,
    fontFamily: "PublicSans_400Regular",
    color: C.mid,
    textAlign: "center",
    lineHeight: 20,
  },
  activatedList: {
    alignSelf: "stretch",
    backgroundColor: C.containerLow,
    borderRadius: 12,
    padding: 14,
    gap: 8,
  },
  activatedRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  activatedLabel: {
    fontSize: 13,
    fontFamily: "PublicSans_600SemiBold",
    color: C.secondaryText,
  },
  finishBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: C.secondary,
    borderRadius: 14,
    paddingVertical: 15,
    paddingHorizontal: 20,
    alignSelf: "stretch",
  },
  finishBtnDisabled: {
    opacity: 0.6,
  },
  finishBtnText: {
    fontSize: 15,
    fontFamily: "PublicSans_700Bold",
    color: "#fff",
    letterSpacing: 0.3,
  },

  // Skeleton
  skelPhase: { flexDirection: "row", alignItems: "center", backgroundColor: C.surface, borderRadius: 14, padding: 14, gap: 12, borderWidth: 1, borderColor: C.border },
  skelIcon:  { width: 40, height: 40, borderRadius: 12, backgroundColor: C.border },
  skelLine:  { backgroundColor: C.border, borderRadius: 4 },
});