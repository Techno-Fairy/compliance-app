/**
 * OnboardingProgressCard — FE-23
 *
 * Shown on the Dashboard when is_onboarding_complete = false.
 * Displays phase progress pills and overall % complete with a
 * "Continue Setup" CTA that navigates to /starter-guide.
 *
 * Hidden entirely once is_onboarding_complete = true (gated in index.tsx).
 */
import { useRouter } from "expo-router";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { useOnboardingProgress } from "@/hooks/useOnboardingProgress";

// ── Design tokens (mirrors index.tsx) ────────────────────────────────────────
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
  secondary:     "#2a6b2c",
  secondaryBg:   "#acf4a4",
  secondaryText: "#307231",
  amber:         "#D4830A",
  amberBg:       "#FEF3E2",
  container:     "#dbf1fe",
  containerLow:  "#e6f6ff",
};

const PHASE_LABELS: Record<number, string> = {
  1: "Register",
  2: "Taxes",
  3: "Employment",
  4: "Activate",
};

export function OnboardingProgressCard() {
  const router = useRouter();
  const { data, isLoading, isError, refetch } = useOnboardingProgress();

  // ── Loading state ────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <View style={s.card}>
        <View style={s.headerRow}>
          <Text style={s.eyebrow}>BUSINESS SETUP GUIDE</Text>
        </View>
        <ActivityIndicator color={C.teal} style={{ marginVertical: 16 }} />
      </View>
    );
  }

  // ── Error / no data ──────────────────────────────────────────────────────
  if (isError || !data) {
    return (
      <View style={s.card}>
        <View style={s.headerRow}>
          <Text style={s.eyebrow}>BUSINESS SETUP GUIDE</Text>
        </View>
        <View style={s.errorRow}>
          <MaterialIcons name="wifi-off" size={16} color={C.muted} />
          <Text style={s.errorText}>Could not load progress.</Text>
          <Pressable onPress={() => refetch()} hitSlop={8}>
            <Text style={s.retryText}>Retry</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  const { steps_complete, steps_total, phases_complete, phases, is_complete } = data;
  const pct = steps_total > 0 ? Math.round((steps_complete / steps_total) * 100) : 0;
  const fromCache = (data as typeof data & { fromCache?: boolean }).fromCache;

  // Don't render if somehow complete (parent should gate this, but belt-and-braces)
  if (is_complete) return null;

  return (
    <View style={s.card}>
      {/* ── Header ────────────────────────────────────────────────────────── */}
      <View style={s.headerRow}>
        <View style={s.headerLeft}>
          <View style={s.iconWrap}>
            <MaterialIcons name="checklist" size={18} color={C.teal} />
          </View>
          <View>
            <Text style={s.eyebrow}>BUSINESS SETUP GUIDE</Text>
            <Text style={s.headline}>
              {steps_complete} of {steps_total} steps complete
            </Text>
          </View>
        </View>
        <Text style={s.pctBadge}>{pct}%</Text>
      </View>

      {/* ── Overall progress bar ───────────────────────────────────────────── */}
      <View style={s.barTrack}>
        <View
          style={[
            s.barFill,
            {
              width: `${pct}%`,
              backgroundColor: pct === 100 ? C.secondary : C.teal,
            },
          ]}
        />
      </View>

      {/* ── Phase pills ───────────────────────────────────────────────────── */}
      <View style={s.pillsRow}>
        {phases.map((phase) => {
          const isPhaseComplete = phase.is_complete;
          const isActive = !isPhaseComplete && phases_complete === phase.phase - 1;
          const label = PHASE_LABELS[phase.phase] ?? `Phase ${phase.phase}`;

          return (
            <View
              key={phase.phase}
              style={[
                s.pill,
                isPhaseComplete && s.pillComplete,
                isActive && s.pillActive,
                !isPhaseComplete && !isActive && s.pillPending,
              ]}
            >
              {isPhaseComplete ? (
                <MaterialIcons name="check" size={11} color={C.secondaryText} />
              ) : (
                <Text style={[s.pillNum, isActive && s.pillNumActive]}>
                  {phase.phase}
                </Text>
              )}
              <Text
                style={[
                  s.pillLabel,
                  isPhaseComplete && s.pillLabelComplete,
                  isActive && s.pillLabelActive,
                ]}
                numberOfLines={1}
              >
                {label}
              </Text>
            </View>
          );
        })}
      </View>

      {/* ── Offline notice ────────────────────────────────────────────────── */}
      {fromCache && (
        <View style={s.offlineRow}>
          <MaterialIcons name="cloud-off" size={12} color={C.amber} />
          <Text style={s.offlineText}>Showing cached data</Text>
        </View>
      )}

      {/* ── CTA ───────────────────────────────────────────────────────────── */}
      <Pressable
        style={({ pressed }) => [s.ctaBtn, pressed && { opacity: 0.82 }]}
        onPress={() => router.push("/starter-guide" as any)}
        accessibilityRole="button"
        accessibilityLabel="Continue business setup"
      >
        <MaterialIcons name="arrow-forward" size={16} color="#fff" />
        <Text style={s.ctaText}>Continue Setup</Text>
      </Pressable>
    </View>
  );
}

const s = StyleSheet.create({
  card: {
    backgroundColor: C.surface,
    borderRadius: 16,
    padding: 18,
    marginTop: 14,
    marginBottom: 4,
    borderWidth: 1,
    borderColor: C.borderSoft,
    gap: 14,
    // Subtle teal left accent
    borderLeftWidth: 4,
    borderLeftColor: C.teal,
  },

  // Header
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flex: 1,
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: C.tealBg,
    alignItems: "center",
    justifyContent: "center",
  },
  eyebrow: {
    fontSize: 9,
    fontFamily: "PublicSans_700Bold",
    color: C.teal,
    letterSpacing: 1.4,
    textTransform: "uppercase",
    marginBottom: 2,
  },
  headline: {
    fontSize: 14,
    fontFamily: "PublicSans_700Bold",
    color: C.primary,
  },
  pctBadge: {
    fontSize: 26,
    fontFamily: "PublicSans_700Bold",
    color: C.teal,
    marginLeft: 8,
  },

  // Progress bar
  barTrack: {
    height: 7,
    backgroundColor: C.containerLow,
    borderRadius: 4,
    overflow: "hidden",
  },
  barFill: {
    height: 7,
    borderRadius: 4,
  },

  // Phase pills
  pillsRow: {
    flexDirection: "row",
    gap: 6,
  },
  pill: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    paddingVertical: 6,
    paddingHorizontal: 4,
    borderRadius: 8,
    borderWidth: 1,
  },
  pillComplete: {
    backgroundColor: C.secondaryBg,
    borderColor: C.secondaryText,
  },
  pillActive: {
    backgroundColor: C.tealBg,
    borderColor: C.teal,
  },
  pillPending: {
    backgroundColor: C.bg,
    borderColor: C.border,
  },
  pillNum: {
    fontSize: 11,
    fontFamily: "PublicSans_700Bold",
    color: C.muted,
  },
  pillNumActive: {
    color: C.tealDark,
  },
  pillLabel: {
    fontSize: 10,
    fontFamily: "PublicSans_600SemiBold",
    color: C.muted,
  },
  pillLabelComplete: {
    color: C.secondaryText,
  },
  pillLabelActive: {
    color: C.tealDark,
  },

  // Offline notice
  offlineRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  offlineText: {
    fontSize: 11,
    fontFamily: "PublicSans_400Regular",
    color: C.amber,
  },

  // CTA button
  ctaBtn: {
    backgroundColor: C.teal,
    borderRadius: 12,
    paddingVertical: 13,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  ctaText: {
    fontSize: 14,
    fontFamily: "PublicSans_700Bold",
    color: "#ffffff",
    letterSpacing: 0.3,
  },

  // Error state
  errorRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 8,
  },
  errorText: {
    fontSize: 13,
    color: C.muted,
    flex: 1,
  },
  retryText: {
    fontSize: 13,
    fontFamily: "PublicSans_700Bold",
    color: C.teal,
  },
});