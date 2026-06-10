/**
 * app/starter-guide/[id].tsx — FE-25
 *
 * Step detail screen for the Business Starter Guide.
 * Accessible from: StarterGuideScreen (FE-24) > PhaseAccordion > StepRow tap
 *
 * Shows:
 *  - Phase badge + step title
 *  - Plain-language description
 *  - Required documents checklist (read-only; informational per PRD)
 *  - Portal deep link button (Linking.openURL)
 *  - Mark Complete / Mark Incomplete toggle with confirm dialog
 *    → PATCH /onboarding/steps/{step_id} via useMarkStepComplete
 *
 * Design system: PublicSans, C tokens, TopBar (showBack).
 */

import { useCallback, useState } from "react";
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
import { useOnboardingSteps, useMarkStepComplete } from "@/hooks/useOnboardingProgress";
import { TopBar } from "@/components/ui/TopBar";
import type { OnboardingStep } from "@/types";

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
  burs:          "#1A3C5E",
  bursBg:        "#EAF0F7",
};

const PHASE_LABELS: Record<number, string> = {
  1: "Register Your Business",
  2: "Set Up Your Taxes",
  3: "Employment & Licensing",
  4: "Activate Ongoing Compliance",
};

// ── Small helper: cross-platform toast ───────────────────────────────────────
function showToast(message: string) {
  if (Platform.OS === "android") {
    ToastAndroid.show(message, ToastAndroid.SHORT);
  } else {
    // On iOS fall back to a brief Alert — a production app would use
    // a custom toast lib here, but this keeps zero extra dependencies.
    Alert.alert("", message);
  }
}

// ── Document row (read-only) ──────────────────────────────────────────────────
function DocumentRow({ label }: { label: string }) {
  return (
    <View style={s.docRow}>
      <View style={s.docIcon}>
        <MaterialIcons name="description" size={14} color={C.teal} />
      </View>
      <Text style={s.docLabel}>{label}</Text>
    </View>
  );
}

// ── Portal button ─────────────────────────────────────────────────────────────
function PortalButton({ url }: { url: string }) {
  const handlePress = useCallback(() => {
    Linking.canOpenURL(url)
      .then((supported) => {
        if (supported) {
          return Linking.openURL(url);
        }
        Alert.alert(
          "Cannot open link",
          "Please visit the portal manually in your browser.",
          [{ text: "OK" }]
        );
      })
      .catch(() =>
        Alert.alert("Error", "Could not open the portal. Please try again.")
      );
  }, [url]);

  // Extract a readable domain label from the URL
  let domainLabel = url;
  try {
    domainLabel = new URL(url).hostname.replace(/^www\./, "");
  } catch {
    // keep raw url
  }

  return (
    <Pressable
      style={({ pressed }) => [s.portalBtn, pressed && { opacity: 0.75 }]}
      onPress={handlePress}
      accessibilityRole="link"
      accessibilityLabel={`Open portal: ${domainLabel}`}
    >
      <MaterialIcons name="open-in-browser" size={18} color={C.teal} />
      <View style={s.portalBtnBody}>
        <Text style={s.portalBtnText}>Open Portal</Text>
        <Text style={s.portalBtnSub} numberOfLines={1}>{domainLabel}</Text>
      </View>
      <MaterialIcons name="chevron-right" size={20} color={C.teal} />
    </Pressable>
  );
}

// ── Step detail content (rendered once the step is resolved) ──────────────────
function StepDetail({
  step,
  onMarkToggle,
  isPending,
}: {
  step: OnboardingStep;
  onMarkToggle: () => void;
  isPending: boolean;
}) {
  const phaseLabel = PHASE_LABELS[step.phase] ?? `Phase ${step.phase}`;

  return (
    <>
      {/* Phase + step number badge */}
      <View style={s.badgeRow}>
        <View style={s.phaseBadge}>
          <Text style={s.phaseBadgeText}>PHASE {step.phase}</Text>
        </View>
        <View style={s.stepNumBadge}>
          <Text style={s.stepNumText}>Step {step.step_number}</Text>
        </View>
      </View>

      {/* Phase label */}
      <Text style={s.phaseLabel}>{phaseLabel}</Text>

      {/* Step title */}
      <Text style={s.stepTitle}>{step.title}</Text>

      {/* Completion status chip */}
      {step.completed && (
        <View style={s.completedBanner}>
          <MaterialIcons name="check-circle" size={16} color={C.secondaryText} />
          <Text style={s.completedBannerText}>
            Step completed{step.completed_at ? ` · ${new Date(step.completed_at).toLocaleDateString("en-BW", { day: "numeric", month: "short", year: "numeric" })}` : ""}
          </Text>
        </View>
      )}

      {/* Description */}
      <View style={s.section}>
        <Text style={s.sectionTitle}>What to do</Text>
        <Text style={s.description}>{step.description}</Text>
      </View>

      {/* Documents checklist */}
      {step.documents.length > 0 && (
        <View style={s.section}>
          <View style={s.sectionHeader}>
            <MaterialIcons name="folder-open" size={16} color={C.teal} />
            <Text style={s.sectionTitle}>Documents required</Text>
            <View style={s.docCount}>
              <Text style={s.docCountText}>{step.documents.length}</Text>
            </View>
          </View>
          <Text style={s.sectionSub}>
            Gather these before visiting the portal or office.
          </Text>
          <View style={s.docList}>
            {step.documents.map((doc, idx) => (
              <DocumentRow key={idx} label={doc} />
            ))}
          </View>
        </View>
      )}

      {/* Portal deep link */}
      {!!step.portal_url && (
        <View style={s.section}>
          <Text style={s.sectionTitle}>Portal</Text>
          <PortalButton url={step.portal_url} />
        </View>
      )}

      {/* Mark Complete / Incomplete button */}
      <View style={s.actionSection}>
        {step.completed ? (
          <>
            <View style={s.doneCard}>
              <MaterialIcons name="verified" size={22} color={C.secondaryText} />
              <Text style={s.doneCardText}>This step is marked as complete.</Text>
            </View>
            <Pressable
              style={({ pressed }) => [s.undoBtn, pressed && { opacity: 0.75 }, isPending && s.btnDisabled]}
              onPress={onMarkToggle}
              disabled={isPending}
              accessibilityRole="button"
              accessibilityLabel="Mark step as incomplete"
            >
              {isPending ? (
                <ActivityIndicator size="small" color={C.muted} />
              ) : (
                <>
                  <MaterialIcons name="undo" size={16} color={C.muted} />
                  <Text style={s.undoBtnText}>Mark as Incomplete</Text>
                </>
              )}
            </Pressable>
          </>
        ) : (
          <Pressable
            style={({ pressed }) => [s.markCompleteBtn, pressed && { opacity: 0.82 }, isPending && s.btnDisabled]}
            onPress={onMarkToggle}
            disabled={isPending}
            accessibilityRole="button"
            accessibilityLabel="Mark step as complete"
          >
            {isPending ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <>
                <MaterialIcons name="check-circle" size={18} color="#fff" />
                <Text style={s.markCompleteBtnText}>Mark Step Complete</Text>
              </>
            )}
          </Pressable>
        )}
      </View>
    </>
  );
}

// ── Skeleton loader ───────────────────────────────────────────────────────────
function StepSkeleton() {
  return (
    <View style={{ gap: 14, opacity: 0.45 }}>
      <View style={{ flexDirection: "row", gap: 8 }}>
        <View style={[s.skel, { width: 80, height: 22, borderRadius: 11 }]} />
        <View style={[s.skel, { width: 60, height: 22, borderRadius: 11 }]} />
      </View>
      <View style={[s.skel, { width: 120, height: 13 }]} />
      <View style={[s.skel, { width: "85%", height: 22 }]} />
      <View style={[s.skel, { width: "100%", height: 80, borderRadius: 12 }]} />
      <View style={[s.skel, { width: "100%", height: 120, borderRadius: 12 }]} />
    </View>
  );
}

// ── Main screen ───────────────────────────────────────────────────────────────
export default function StepDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const stepId = Number(id);

  const { data, isLoading, isError } = useOnboardingSteps();
  const { mutate: markStep, isPending } = useMarkStepComplete();

  // Resolve the step from the cached phases data
  const step: OnboardingStep | undefined = data?.phases
    .flatMap((p) => p.steps)
    .find((s) => s.id === stepId);

  const handleMarkToggle = useCallback(() => {
    if (!step) return;

    const toComplete = !step.completed;

    if (toComplete) {
      Alert.alert(
        "Mark step as done?",
        `Confirm you have completed:\n\n"${step.title}"`,
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Mark Complete",
            onPress: () => {
              markStep(
                { stepId: step.id, completed: true },
                {
                  onSuccess: () => {
                    showToast("Step marked as complete");
                  },
                  onError: (err: Error) => {
                    // Offline-queued is intentional — the hook already showed
                    // the optimistic update; just confirm to the user.
                    if ((err as unknown as { isOfflineQueued?: boolean }).isOfflineQueued) {
                      showToast("Saved offline — will sync when back online");
                      return;
                    }
                    Alert.alert(
                      "Could not save",
                      "Your change was not saved. Please check your connection and try again.",
                      [{ text: "OK" }]
                    );
                  },
                }
              );
            },
          },
        ]
      );
    } else {
      // Undo: no confirmation required, just toggle back
      markStep(
        { stepId: step.id, completed: false },
        {
          onSuccess: () => showToast("Step marked as incomplete"),
          onError: (err: Error) => {
            if ((err as unknown as { isOfflineQueued?: boolean }).isOfflineQueued) {
              showToast("Saved offline — will sync when back online");
              return;
            }
            Alert.alert("Could not save", "Please check your connection and try again.");
          },
        }
      );
    }
  }, [step, markStep]);

  return (
    <SafeAreaView style={s.safe} edges={["top"]}>
      <StatusBar barStyle="dark-content" backgroundColor={C.container} />
      <TopBar showBack />

      <ScrollView
        style={s.scroll}
        contentContainerStyle={s.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Loading skeleton */}
        {isLoading && !data && <StepSkeleton />}

        {/* Error state */}
        {isError && !data && (
          <View style={s.errorBox}>
            <MaterialIcons name="wifi-off" size={40} color={C.error} />
            <Text style={s.errorTitle}>Could not load step</Text>
            <Text style={s.errorDesc}>Check your connection and try again.</Text>
            <Pressable style={s.retryBtn} onPress={() => router.back()}>
              <Text style={s.retryText}>Go Back</Text>
            </Pressable>
          </View>
        )}

        {/* Step not found (e.g. bad ID) */}
        {!isLoading && !isError && data && !step && (
          <View style={s.errorBox}>
            <MaterialIcons name="search-off" size={40} color={C.muted} />
            <Text style={s.errorTitle}>Step not found</Text>
            <Text style={s.errorDesc}>This step may no longer exist.</Text>
            <Pressable style={s.retryBtn} onPress={() => router.back()}>
              <Text style={s.retryText}>Go Back</Text>
            </Pressable>
          </View>
        )}

        {/* Step detail */}
        {step && (
          <StepDetail
            step={step}
            onMarkToggle={handleMarkToggle}
            isPending={isPending}
          />
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  safe:         { flex: 1, backgroundColor: C.bg },
  scroll:       { flex: 1 },
  scrollContent:{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: 16 },

  // Badges
  badgeRow:     { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 },
  phaseBadge:   { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20, backgroundColor: C.tealBg },
  phaseBadgeText:{ fontSize: 10, fontFamily: "PublicSans_700Bold", color: C.tealDark, letterSpacing: 1.1, textTransform: "uppercase" },
  stepNumBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20, backgroundColor: C.containerLow, borderWidth: 1, borderColor: C.border },
  stepNumText:  { fontSize: 10, fontFamily: "PublicSans_600SemiBold", color: C.mid },

  // Title area
  phaseLabel:   { fontSize: 11, fontFamily: "PublicSans_600SemiBold", color: C.muted, letterSpacing: 0.3, marginBottom: 6, textTransform: "uppercase" },
  stepTitle:    { fontSize: 20, fontFamily: "PublicSans_700Bold", color: C.primary, lineHeight: 28, marginBottom: 12 },

  // Completed banner
  completedBanner: {
    flexDirection: "row", alignItems: "center", gap: 8,
    backgroundColor: C.secondaryBg, borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 10,
    marginBottom: 16, borderWidth: 1, borderColor: C.secondary + "44",
  },
  completedBannerText: { fontSize: 13, fontFamily: "PublicSans_600SemiBold", color: C.secondaryText, flex: 1 },

  // Sections
  section:      { marginBottom: 20 },
  sectionHeader:{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 4 },
  sectionTitle: { fontSize: 13, fontFamily: "PublicSans_700Bold", color: C.primary, letterSpacing: 0.2 },
  sectionSub:   { fontSize: 12, fontFamily: "PublicSans_400Regular", color: C.muted, marginBottom: 10, lineHeight: 17 },
  docCount:     { width: 20, height: 20, borderRadius: 10, backgroundColor: C.tealBg, alignItems: "center", justifyContent: "center", marginLeft: 2 },
  docCountText: { fontSize: 10, fontFamily: "PublicSans_700Bold", color: C.tealDark },

  description:  {
    fontSize: 14, fontFamily: "PublicSans_400Regular", color: C.mid,
    lineHeight: 22, backgroundColor: C.surface, borderRadius: 12,
    padding: 14, borderWidth: 1, borderColor: C.borderSoft,
  },

  // Document list
  docList:      { gap: 6 },
  docRow:       {
    flexDirection: "row", alignItems: "center", gap: 10,
    backgroundColor: C.surface, borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 10,
    borderWidth: 1, borderColor: C.borderSoft,
  },
  docIcon:      {
    width: 28, height: 28, borderRadius: 8,
    backgroundColor: C.tealBg, alignItems: "center", justifyContent: "center",
    flexShrink: 0,
  },
  docLabel:     { flex: 1, fontSize: 13, fontFamily: "PublicSans_400Regular", color: C.primary, lineHeight: 18 },

  // Portal button
  portalBtn:    {
    flexDirection: "row", alignItems: "center", gap: 12,
    backgroundColor: C.surface, borderRadius: 12,
    paddingHorizontal: 16, paddingVertical: 14,
    borderWidth: 1.5, borderColor: C.teal,
  },
  portalBtnBody:{ flex: 1 },
  portalBtnText:{ fontSize: 14, fontFamily: "PublicSans_700Bold", color: C.tealDark },
  portalBtnSub: { fontSize: 11, fontFamily: "PublicSans_400Regular", color: C.teal, marginTop: 1 },

  // Action area
  actionSection:{ marginTop: 4, gap: 10 },

  markCompleteBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    backgroundColor: C.teal, borderRadius: 14,
    paddingVertical: 15, paddingHorizontal: 20,
  },
  markCompleteBtnText: { fontSize: 15, fontFamily: "PublicSans_700Bold", color: "#fff", letterSpacing: 0.2 },

  doneCard:     {
    flexDirection: "row", alignItems: "center", gap: 10,
    backgroundColor: C.secondaryBg, borderRadius: 12,
    paddingHorizontal: 16, paddingVertical: 14,
    borderWidth: 1, borderColor: C.secondary + "44",
  },
  doneCardText: { flex: 1, fontSize: 14, fontFamily: "PublicSans_600SemiBold", color: C.secondaryText },

  undoBtn:      {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6,
    borderWidth: 1, borderColor: C.border, borderRadius: 10,
    paddingVertical: 11, paddingHorizontal: 16,
    backgroundColor: C.surface,
  },
  undoBtnText:  { fontSize: 13, fontFamily: "PublicSans_600SemiBold", color: C.muted },

  btnDisabled:  { opacity: 0.55 },

  // Error / not found
  errorBox:     { alignItems: "center", paddingVertical: 48, gap: 10 },
  errorTitle:   { fontSize: 16, fontFamily: "PublicSans_700Bold", color: C.primary },
  errorDesc:    { fontSize: 13, fontFamily: "PublicSans_400Regular", color: C.muted, textAlign: "center" },
  retryBtn:     { marginTop: 8, backgroundColor: C.teal, borderRadius: 10, paddingHorizontal: 28, paddingVertical: 11 },
  retryText:    { fontSize: 14, fontFamily: "PublicSans_700Bold", color: "#fff" },

  // Skeleton
  skel:         { backgroundColor: C.border, borderRadius: 4 },
});