// mobile/app/(tabs)/index.tsx
// FE-20: 6-month compliance trend chart (react-native-svg sparkline)
// FE-21: Health score breakdown modal (category-level score detail)
// All existing Week 3/4 functionality preserved

import { useRouter } from "expo-router";
import { useRef, useState } from "react";
import {
  ActivityIndicator, Animated, Modal, Platform, Pressable,
  RefreshControl, ScrollView, StatusBar, StyleSheet, Text,
  TouchableOpacity, View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { MaterialIcons } from "@expo/vector-icons";
import Svg, { Polyline, Circle, Line, Text as SvgText, Defs, LinearGradient, Stop, Rect } from "react-native-svg";
import { useDeadlines, useUpdateDeadlineStatus } from "@/hooks/useDeadlines";
import { useHealthScore } from "@/hooks/useHealthScore";
import { useTrendData, buildStaticTrend } from "@/hooks/useTrendData";
import type { TrendPoint } from "@/hooks/useTrendData";
import { useOnboardingProgress } from "@/hooks/useOnboardingProgress";
import { PenaltyExposureModal } from "@/components/PenaltyExposureModal";
import { ComplianceCalendarModal } from "@/components/ComplianceCalendarModal";
import { OnboardingProgressCard } from "@/components/OnboardingProgressCard";
import { TopBar } from "@/components/ui/TopBar";
import type { Deadline, HealthScoreBreakdown } from "@/types";

// ── Design tokens ─────────────────────────────────────────────────────────────
const C = {
  bg:           "#f3faff",
  surface:      "#ffffff",
  primary:      "#000b25",
  mid:          "#44474e",
  muted:        "#75777f",
  border:       "#c5c6cf",
  borderSoft:   "#e6f6ff",
  secondary:    "#2a6b2c",
  secondaryBg:  "#acf4a4",
  secondaryText:"#307231",
  error:        "#ba1a1a",
  errorBg:      "#ffdad6",
  amber:        "#D4830A",
  amberBg:      "#FEF3E2",
  burs:         "#1A3C5E",
  bursBg:       "#EAF0F7",
  cipaBar:      "#2E6B4F",
  cipaBg:       "#E8F4EE",
  labour:       "#6B3A7D",
  labourBg:     "#F3EEF7",
  custom:       "#7D5A1E",
  customBg:     "#F7F1E8",
  container:    "#dbf1fe",
  containerLow: "#e6f6ff",
};

const CAT: Record<string, { bg: string; text: string; bar: string }> = {
  BURS:   { bg: C.bursBg,   text: C.burs,    bar: C.burs    },
  CIPA:   { bg: C.cipaBg,   text: C.cipaBar, bar: C.cipaBar },
  LABOUR: { bg: C.labourBg, text: C.labour,  bar: C.labour  },
  CUSTOM: { bg: C.customBg, text: C.custom,  bar: C.custom  },
};

const FILTERS = [
  { value: "ALL",    label: "All",    icon: "apps"            },
  { value: "BURS",   label: "BURS",   icon: "account-balance" },
  { value: "CIPA",   label: "CIPA",   icon: "business"        },
  { value: "LABOUR", label: "Labour", icon: "people"          },
  { value: "CUSTOM", label: "Custom", icon: "tune"            },
] as const;
type Filter = typeof FILTERS[number]["value"];

type SectionId = "overdue" | "upcoming" | "completed";
const SECTION_META: Record<SectionId, { label: string; icon: string; accentColor: string; defaultOpen: boolean }> = {
  overdue:   { label: "Overdue",   icon: "error-outline", accentColor: C.error,     defaultOpen: true  },
  upcoming:  { label: "Upcoming",  icon: "schedule",      accentColor: C.amber,     defaultOpen: true  },
  completed: { label: "Completed", icon: "check-circle",  accentColor: C.secondary, defaultOpen: false },
};

// ── FE-21: Health Score Breakdown Modal ───────────────────────────────────────
function HealthBreakdownModal({
  visible,
  onClose,
  score,
  band,
  breakdown,
}: {
  visible: boolean;
  onClose: () => void;
  score: number;
  band: string;
  breakdown: HealthScoreBreakdown[];
}) {
  const ringColor = band === "green" ? C.secondary : band === "amber" ? C.amber : C.error;
  const bandLabel = band === "green" ? "Good Standing" : band === "amber" ? "Needs Attention" : "Critical";

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={bm.safe}>
        {/* Header */}
        <View style={bm.header}>
          <View>
            <Text style={bm.eyebrow}>COMPLIANCE HEALTH SCORE</Text>
            <Text style={[bm.score, { color: ringColor }]}>{score}%</Text>
            <View style={[bm.bandChip, { backgroundColor: ringColor + "18" }]}>
              <Text style={[bm.bandText, { color: ringColor }]}>{bandLabel.toUpperCase()}</Text>
            </View>
          </View>
          <Pressable onPress={onClose} style={bm.closeBtn} hitSlop={8}>
            <MaterialIcons name="close" size={22} color={C.primary} />
          </Pressable>
        </View>

        <ScrollView style={bm.scroll} contentContainerStyle={bm.scrollContent} showsVerticalScrollIndicator={false}>
          <Text style={bm.sectionLabel}>BREAKDOWN BY CATEGORY</Text>

          {breakdown.length === 0 ? (
            <View style={bm.empty}>
              <MaterialIcons name="pie-chart" size={40} color={C.border} />
              <Text style={bm.emptyText}>No breakdown data yet.</Text>
            </View>
          ) : (
            breakdown.map((b) => {
              const cat = CAT[b.category] ?? CAT.CUSTOM;
              const pct = b.total > 0 ? Math.round((b.complete / b.total) * 100) : 0;
              return (
                <View key={b.category} style={bm.catCard}>
                  {/* Category header */}
                  <View style={bm.catHeader}>
                    <View style={[bm.catDot, { backgroundColor: cat.bar }]} />
                    <Text style={bm.catName}>{b.category}</Text>
                    <Text style={[bm.catScore, { color: cat.bar }]}>{b.score}%</Text>
                  </View>

                  {/* Progress bar */}
                  <View style={bm.barTrack}>
                    <View style={[bm.barFill, { width: `${pct}%`, backgroundColor: cat.bar }]} />
                  </View>

                  {/* Stats row */}
                  <View style={bm.statsRow}>
                    <View style={bm.statItem}>
                      <MaterialIcons name="check-circle" size={14} color={C.secondaryText} />
                      <Text style={bm.statLabel}>{b.complete} complete</Text>
                    </View>
                    <View style={bm.statItem}>
                      <MaterialIcons name="schedule" size={14} color={C.amber} />
                      <Text style={bm.statLabel}>{b.total - b.complete - b.overdue} pending</Text>
                    </View>
                    <View style={bm.statItem}>
                      <MaterialIcons name="error" size={14} color={C.error} />
                      <Text style={bm.statLabel}>{b.overdue} overdue</Text>
                    </View>
                  </View>

                  {/* Score pill */}
                  <View style={[bm.scorePill, { backgroundColor: cat.bg }]}>
                    <Text style={[bm.scorePillText, { color: cat.text }]}>
                      Category score: {b.score}/100
                    </Text>
                  </View>
                </View>
              );
            })
          )}

          {/* How score is calculated */}
          <View style={bm.formula}>
            <MaterialIcons name="info-outline" size={14} color={C.muted} />
            <Text style={bm.formulaText}>
              Overall score = weighted average across all categories. Each on-time filing adds points; overdue items subtract. Custom tasks contribute when completed.
            </Text>
          </View>
          <View style={{ height: 40 }} />
        </ScrollView>
      </View>
    </Modal>
  );
}

const bm = StyleSheet.create({
  safe:       { flex: 1, backgroundColor: C.bg },
  header:     { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", paddingHorizontal: 20, paddingTop: 20, paddingBottom: 16, backgroundColor: C.container, borderBottomWidth: 1, borderBottomColor: C.border },
  eyebrow:    { fontSize: 10, fontFamily: "PublicSans_700Bold", color: C.burs, letterSpacing: 1.4, textTransform: "uppercase", marginBottom: 4 },
  score:      { fontSize: 44, fontFamily: "PublicSans_700Bold", lineHeight: 50, marginBottom: 6 },
  bandChip:   { alignSelf: "flex-start", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6 },
  bandText:   { fontSize: 10, fontFamily: "PublicSans_700Bold", letterSpacing: 0.8 },
  closeBtn:   { padding: 4, marginTop: 4 },
  scroll:     { flex: 1 },
  scrollContent:{ paddingHorizontal: 16, paddingTop: 16 },
  sectionLabel:{ fontSize: 10, fontFamily: "PublicSans_700Bold", color: C.muted, letterSpacing: 1.2, textTransform: "uppercase", marginBottom: 12 },
  catCard:    { backgroundColor: C.surface, borderRadius: 14, padding: 16, marginBottom: 10, borderWidth: 1, borderColor: C.border, gap: 10 },
  catHeader:  { flexDirection: "row", alignItems: "center", gap: 8 },
  catDot:     { width: 10, height: 10, borderRadius: 5 },
  catName:    { flex: 1, fontSize: 15, fontFamily: "PublicSans_700Bold", color: C.primary },
  catScore:   { fontSize: 20, fontFamily: "PublicSans_700Bold" },
  barTrack:   { height: 8, backgroundColor: C.containerLow, borderRadius: 4, overflow: "hidden" },
  barFill:    { height: 8, borderRadius: 4 },
  statsRow:   { flexDirection: "row", gap: 16 },
  statItem:   { flexDirection: "row", alignItems: "center", gap: 4 },
  statLabel:  { fontSize: 11, fontFamily: "PublicSans_400Regular", color: C.mid },
  scorePill:  { alignSelf: "flex-start", paddingHorizontal: 10, paddingVertical: 5, borderRadius: 6 },
  scorePillText:{ fontSize: 12, fontFamily: "PublicSans_600SemiBold" },
  formula:    { flexDirection: "row", alignItems: "flex-start", gap: 6, backgroundColor: C.surface, borderRadius: 10, padding: 12, borderWidth: 1, borderColor: C.border, marginTop: 8 },
  formulaText:{ flex: 1, fontSize: 11, color: C.muted, lineHeight: 16 },
  empty:      { alignItems: "center", gap: 10, paddingVertical: 32 },
  emptyText:  { fontSize: 14, color: C.muted },
});

// ── FE-20: Trend Chart ────────────────────────────────────────────────────────
const CHART_W = 320;
const CHART_H = 100;
const CHART_PAD_X = 28;
const CHART_PAD_Y = 12;

function TrendChart({ score, band }: { score: number; band: string }) {
  const { data: trendData } = useTrendData();
  // Guard: fall back to static trend if API data is missing or has no points
  const trend = (trendData?.points?.length ?? 0) > 0 ? trendData! : buildStaticTrend(score);

  const points = trend.points ?? [];
  if (points.length === 0) return null;

  const minScore = Math.min(...points.map((p) => p.score)) - 10;
  const maxScore = Math.max(...points.map((p) => p.score)) + 5;
  const range = Math.max(maxScore - minScore, 20);

  // Map data to SVG coords
  const toX = (i: number) =>
    CHART_PAD_X + (i / (points.length - 1)) * (CHART_W - CHART_PAD_X * 2);
  const toY = (s: number) =>
    CHART_PAD_Y + (1 - (s - minScore) / range) * (CHART_H - CHART_PAD_Y * 2);

  const polyPoints = points.map((p, i) => `${toX(i)},${toY(p.score)}`).join(" ");
  const lineColor = band === "green" ? C.secondary : band === "amber" ? C.amber : C.error;
  const dirIcon = trend.direction === "up" ? "trending-up" : trend.direction === "down" ? "trending-down" : "trending-flat";
  const dirColor = trend.direction === "up" ? C.secondaryText : trend.direction === "down" ? C.error : C.amber;

  return (
    <View style={tc.wrap}>
      {/* Title row */}
      <View style={tc.titleRow}>
        <Text style={tc.title}>6-Month Trend</Text>
        <View style={tc.changeRow}>
          <MaterialIcons name={dirIcon as any} size={16} color={dirColor} />
          <Text style={[tc.changeTxt, { color: dirColor }]}>
            {trend.change_pct >= 0 ? "+" : ""}{trend.change_pct}pts
          </Text>
        </View>
      </View>

      {/* SVG chart */}
      <View style={{ alignSelf: "stretch" }}>
      <Svg width="100%" height={CHART_H + 20} viewBox={`0 0 ${CHART_W} ${CHART_H + 20}`}>
        {/* Horizontal grid lines */}
        {[25, 50, 75, 100].map((v) => {
          const y = toY(v);
          if (y < CHART_PAD_Y || y > CHART_H - CHART_PAD_Y) return null;
          return (
            <Line key={v} x1={CHART_PAD_X} y1={y} x2={CHART_W - CHART_PAD_X} y2={y}
              stroke={C.border} strokeWidth="0.5" strokeDasharray="3 3" />
          );
        })}

        {/* Line */}
        <Polyline
          points={polyPoints}
          fill="none"
          stroke={lineColor}
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Data points */}
        {points.map((p: TrendPoint, i: number) => (
          <Circle
            key={i}
            cx={toX(i)}
            cy={toY(p.score)}
            r={i === points.length - 1 ? 5 : 3}
            fill={i === points.length - 1 ? lineColor : C.surface}
            stroke={lineColor}
            strokeWidth="2"
          />
        ))}

        {/* Month labels */}
        {points.map((p: TrendPoint, i: number) => (
          <SvgText
            key={i}
            x={toX(i)}
            y={CHART_H + 14}
            fontSize="9"
            fill={C.muted}
            textAnchor="middle"
            fontFamily="PublicSans_600SemiBold"
          >
            {p.month}
          </SvgText>
        ))}
      </Svg>
      </View>

      {/* Mini legend */}
      <View style={tc.legendRow}>
        {points.slice(-1).map((p) => (
          <View key="now" style={tc.legendItem}>
            <View style={[tc.legendDot, { backgroundColor: lineColor }]} />
            <Text style={tc.legendText}>Now: {p.score}%</Text>
          </View>
        ))}
        <Text style={tc.legendMuted}>Pull to refresh</Text>
      </View>
    </View>
  );
}

const tc = StyleSheet.create({
  wrap:      { marginTop: 12, alignSelf: "stretch" },
  titleRow:  { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 6 },
  title:     { fontSize: 13, fontFamily: "PublicSans_600SemiBold", color: C.mid },
  changeRow: { flexDirection: "row", alignItems: "center", gap: 3 },
  changeTxt: { fontSize: 12, fontFamily: "PublicSans_700Bold" },
  legendRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 2 },
  legendItem:{ flexDirection: "row", alignItems: "center", gap: 5 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendText:{ fontSize: 11, fontFamily: "PublicSans_600SemiBold", color: C.mid },
  legendMuted:{ fontSize: 10, color: C.muted },
});

// ── Health Score Gauge ────────────────────────────────────────────────────────
function ScoreGauge({ score, band, onPress }: { score: number; band: string; onPress: () => void }) {
  const ringColor = band === "green" ? C.secondary : band === "amber" ? C.amber : C.error;
  const label = band === "green" ? "GOOD STANDING" : band === "amber" ? "ATTENTION" : "CRITICAL";
  return (
    <Pressable style={ss.gaugeWrap} onPress={onPress} hitSlop={8}>
      <View style={[ss.gaugeOuter, { borderColor: C.borderSoft }]}>
        <View style={[ss.gaugeInner, { borderColor: ringColor }]} />
        <View style={ss.gaugeCenter}>
          <Text style={[ss.gaugeScore, { color: C.primary }]}>{score}%</Text>
          <Text style={[ss.gaugeLabel, { color: ringColor }]}>{label}</Text>
        </View>
      </View>
      <View style={ss.gaugeTapHint}>
        <MaterialIcons name="bar-chart" size={13} color={C.muted} />
        <Text style={ss.gaugeTapText}>Tap for breakdown</Text>
      </View>
    </Pressable>
  );
}

// ── Deadline Card ─────────────────────────────────────────────────────────────
function DeadlineCard({ item, onMarkComplete }: { item: Deadline; onMarkComplete: (id: number) => void }) {
  const router = useRouter();
  const cat = CAT[item.category] ?? CAT.CUSTOM;
  const days = item.days_remaining ?? 0;
  const isOverdue = days < 0;
  const isComplete = item.status === "complete";

  const daysLabel = isComplete ? "Completed"
    : isOverdue ? `${Math.abs(days)}d overdue`
    : days === 0 ? "Due today"
    : `Due in ${days} days`;

  const daysColor = isComplete ? C.secondary : isOverdue ? C.error : days <= 7 ? C.amber : C.secondaryText;

  return (
    <Pressable
      style={({ pressed }) => [ss.card, pressed && ss.cardPressed]}
      onPress={() => router.push(`/deadline/${item.id}` as any)}
    >
      <View style={[ss.cardBar, { backgroundColor: cat.bar }]} />
      <View style={ss.cardBody}>
        <View style={ss.cardTop}>
          <View style={[ss.chip, { backgroundColor: cat.bg }]}>
            <Text style={[ss.chipText, { color: cat.text }]}>{item.category}</Text>
          </View>
          <Text style={[ss.daysText, { color: daysColor }]}>{daysLabel}</Text>
        </View>
        <Text style={ss.cardTitle} numberOfLines={2}>{item.name}</Text>
        {item.penalty_info && <Text style={ss.cardPenalty} numberOfLines={1}>{item.penalty_info}</Text>}
        {!isComplete && (
          <View style={ss.cardActions}>
            <Pressable
              style={({ pressed }) => [ss.btnPrimary, pressed && { opacity: 0.75 }]}
              onPress={() => onMarkComplete(item.id)}
            >
              <Text style={ss.btnPrimaryText}>File Now</Text>
            </Pressable>
            <Pressable
              style={({ pressed }) => [ss.btnOutline, pressed && { opacity: 0.75 }]}
              onPress={() => router.push(`/deadline/${item.id}` as any)}
            >
              <Text style={ss.btnOutlineText}>View Requirements</Text>
            </Pressable>
          </View>
        )}
        {isComplete && (
          <View style={ss.completeRow}>
            <MaterialIcons name="check-circle" size={15} color={C.secondary} />
            <Text style={ss.completeText}>  Filed & complete</Text>
          </View>
        )}
      </View>
    </Pressable>
  );
}

// ── Collapsible Section ───────────────────────────────────────────────────────
function CollapsibleSection({ id, items, onMarkComplete }: { id: SectionId; items: Deadline[]; onMarkComplete: (id: number) => void }) {
  const meta = SECTION_META[id];
  const [open, setOpen] = useState(meta.defaultOpen);
  const anim        = useRef(new Animated.Value(meta.defaultOpen ? 1 : 0)).current;
  const chevronAnim = useRef(new Animated.Value(meta.defaultOpen ? 1 : 0)).current;

  const toggle = () => {
    const toValue = open ? 0 : 1;
    Animated.parallel([
      Animated.spring(anim,        { toValue, useNativeDriver: false, friction: 12, tension: 80 }),
      Animated.spring(chevronAnim, { toValue, useNativeDriver: true,  friction: 12, tension: 80 }),
    ]).start();
    setOpen(!open);
  };

  const chevronRotate = chevronAnim.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "180deg"] });
  const maxHeight = anim.interpolate({ inputRange: [0, 1], outputRange: [0, items.length * 160 + 16] });
  const opacity   = anim.interpolate({ inputRange: [0, 0.4, 1], outputRange: [0, 0.6, 1] });

  if (items.length === 0) return null;
  return (
    <View style={ss.section}>
      <TouchableOpacity style={[ss.sectionHeader, open && ss.sectionHeaderOpen]} onPress={toggle} activeOpacity={0.75}>
        <View style={[ss.sectionIconWrap, { backgroundColor: meta.accentColor + "18" }]}>
          <MaterialIcons name={meta.icon as any} size={16} color={meta.accentColor} />
        </View>
        <Text style={[ss.sectionLabel, { color: meta.accentColor }]}>{meta.label}</Text>
        <View style={ss.sectionRight}>
          <View style={[ss.sectionBadge, { backgroundColor: meta.accentColor }]}>
            <Text style={ss.sectionBadgeText}>{items.length}</Text>
          </View>
          <Animated.View style={{ transform: [{ rotate: chevronRotate }] }}>
            <MaterialIcons name="expand-less" size={20} color={meta.accentColor} />
          </Animated.View>
        </View>
      </TouchableOpacity>
      <Animated.View style={[ss.sectionBody, { maxHeight, opacity }]}>
        <View style={ss.sectionContent}>
          {items.map((item) => <DeadlineCard key={item.id} item={item} onMarkComplete={onMarkComplete} />)}
        </View>
      </Animated.View>
    </View>
  );
}

function SkeletonSection() {
  return (
    <View style={[ss.section, { opacity: 0.4 }]}>
      <View style={[ss.sectionHeader, { backgroundColor: C.border }]} />
      <View style={{ paddingTop: 8 }}>
        {[0, 1].map((i) => (
          <View key={i} style={[ss.card, { marginBottom: 10 }]}>
            <View style={[ss.cardBar, { backgroundColor: C.border }]} />
            <View style={[ss.cardBody, { gap: 8 }]}>
              <View style={[ss.skel, { width: 70, height: 20 }]} />
              <View style={[ss.skel, { width: "80%", height: 14 }]} />
              <View style={[ss.skel, { width: "50%", height: 12 }]} />
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}

// ── Dashboard ─────────────────────────────────────────────────────────────────
export default function DashboardScreen() {
  const router = useRouter();
  const [activeFilter,       setActiveFilter]       = useState<Filter>("ALL");
  const [refreshing,         setRefreshing]         = useState(false);
  const [penaltyVisible,     setPenaltyVisible]     = useState(false);
  const [breakdownVisible,   setBreakdownVisible]   = useState(false);  // FE-21
  const [calendarVisible,    setCalendarVisible]    = useState(false);  // FE-22

  const { data: deadlines, isLoading: dlLoading, isError: dlError, refetch: refetchDl } =
    useDeadlines(activeFilter === "ALL" ? undefined : activeFilter);
  const { data: scoreData, isLoading: scoreLoading, refetch: refetchScore } = useHealthScore();
  const { data: onboardingData } = useOnboardingProgress();
  const { mutate: updateStatus } = useUpdateDeadlineStatus();

  // FE-23: gate — show onboarding card until is_onboarding_complete = true
  const showOnboardingCard = onboardingData ? !onboardingData.is_complete : false;

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([refetchDl(), refetchScore()]);
    setRefreshing(false);
  };

  const handleMarkComplete = (id: number) => updateStatus({ id, status: "complete" });

  const overdueItems   = deadlines?.filter((d) => d.status !== "complete" && (d.days_remaining ?? 0) < 0)  ?? [];
  const upcomingItems  = deadlines?.filter((d) => d.status !== "complete" && (d.days_remaining ?? 0) >= 0) ?? [];
  const completedItems = deadlines?.filter((d) => d.status === "complete") ?? [];
  const hasItems = overdueItems.length + upcomingItems.length + completedItems.length > 0;

  const score     = scoreData?.score     ?? 85;
  const band      = scoreData?.band      ?? "green";
  const breakdown = scoreData?.breakdown ?? [];

  return (
    <SafeAreaView style={ss.safe} edges={["top"]}>
      <StatusBar barStyle="dark-content" backgroundColor={C.container} />
      <TopBar />

      <ScrollView
        style={ss.scroll}
        contentContainerStyle={ss.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.secondary} />}
      >
        {/* Overdue urgent banner */}
        {overdueItems.length > 0 && (
          <View style={ss.overdueBanner}>
            <MaterialIcons name="warning" size={20} color={C.error} />
            <View style={ss.overdueBody}>
              <Text style={ss.overdueTitle}>{overdueItems.length} Overdue Task{overdueItems.length > 1 ? "s" : ""}</Text>
              <Text style={ss.overdueDesc}>File immediately to avoid BURS/CIPA penalties.</Text>
            </View>
          </View>
        )}

        {/* FE-23: Onboarding card — shown when setup incomplete, hidden once done */}
        {showOnboardingCard && <OnboardingProgressCard />}

        {/* Health score card — tappable (FE-21) — hidden until onboarding complete */}
        {!showOnboardingCard && (
        <View style={ss.scoreCard}>
          <View style={ss.scoreCardHeader}>
            <Text style={ss.scoreEyebrow}>COMPLIANCE HEALTH SCORE</Text>
            <Pressable
              onPress={() => setCalendarVisible(true)}
              style={ss.calendarBtn}
              hitSlop={8}
              accessibilityLabel="Open compliance calendar"
            >
              <MaterialIcons name="calendar-month" size={18} color={C.burs} />
            </Pressable>
          </View>
          {scoreLoading ? (
            <ActivityIndicator color={C.secondary} style={{ marginVertical: 20 }} />
          ) : (
            <>
              {/* Gauge — tap opens breakdown modal */}
              <ScoreGauge score={score} band={band} onPress={() => setBreakdownVisible(true)} />

              <Text style={ss.scoreDesc}>
                {upcomingItems.length + overdueItems.length > 0
                  ? <>Complete the{" "}<Text style={{ fontWeight: "700", color: C.primary }}>{upcomingItems.length + overdueItems.length} pending tasks</Text>{" "}to reach 100%.</>
                  : "All deadlines complete. Keep it up!"}
              </Text>

              {/* FE-20: Trend chart inline in score card */}
              <TrendChart score={score} band={band} />
            </>
          )}
        </View>
        )}

        {/* Penalty exposure tap card */}
        <Pressable style={ss.penaltyCard} onPress={() => setPenaltyVisible(true)}>
          <View style={ss.penaltyLeft}>
            <MaterialIcons name="warning" size={18} color={C.error} />
            <View>
              <Text style={ss.penaltyEyebrow}>PENALTY EXPOSURE</Text>
              <Text style={ss.penaltyDesc}>Tap to view BWP breakdown</Text>
            </View>
          </View>
          <MaterialIcons name="chevron-right" size={20} color={C.border} />
        </Pressable>

        {/* Category filter grid */}
        <View style={ss.filterGrid}>
          <Pressable
            style={[ss.filterTile, ss.filterTileFull, activeFilter === "ALL" && ss.filterTileActive]}
            onPress={() => setActiveFilter("ALL")}
          >
            <MaterialIcons name="apps" size={16} color={activeFilter === "ALL" ? "#fff" : C.muted} />
            <Text style={[ss.filterTileText, activeFilter === "ALL" && ss.filterTileTextActive]}>All Deadlines</Text>
          </Pressable>
          {[FILTERS.filter((f) => f.value !== "ALL").slice(0, 2), FILTERS.filter((f) => f.value !== "ALL").slice(2)].map((row, ri) => (
            <View key={ri} style={ss.filterGridRow}>
              {row.map((f) => {
                const cat = CAT[f.value];
                const isActive = activeFilter === f.value;
                return (
                  <Pressable
                    key={f.value}
                    style={[ss.filterTile, ss.filterTileHalf, isActive && ss.filterTileActive, !isActive && cat && { borderLeftWidth: 3, borderLeftColor: cat.bar }]}
                    onPress={() => setActiveFilter(f.value)}
                  >
                    <MaterialIcons name={f.icon as any} size={16} color={isActive ? "#fff" : cat?.bar ?? C.muted} />
                    <Text style={[ss.filterTileText, isActive && ss.filterTileTextActive, !isActive && cat && { color: cat.bar }]}>{f.label}</Text>
                  </Pressable>
                );
              })}
            </View>
          ))}
        </View>

        {/* Deadlines header */}
        <View style={ss.listHeaderRow}>
          <Text style={ss.listTitle}>{activeFilter === "ALL" ? "All Deadlines" : `${activeFilter} Deadlines`}</Text>
          <Text style={ss.listSubtitle}>{hasItems ? `${(deadlines ?? []).length} total` : ""}</Text>
        </View>

        {dlLoading && <><SkeletonSection /><SkeletonSection /></>}

        {dlError && (
          <View style={ss.errorBox}>
            <MaterialIcons name="wifi-off" size={36} color={C.error} />
            <Text style={ss.errorText}>Could not load deadlines.</Text>
            <Pressable onPress={() => refetchDl()} style={ss.retryBtn}>
              <Text style={ss.retryText}>Retry</Text>
            </Pressable>
          </View>
        )}

        {!dlLoading && !dlError && !hasItems && (
          <View style={ss.emptyBox}>
            <MaterialIcons name="check-circle" size={44} color={C.secondary} />
            <Text style={ss.emptyTitle}>All clear</Text>
            <Text style={ss.emptyDesc}>No deadlines found. You're fully compliant.</Text>
          </View>
        )}

        {!dlLoading && !dlError && (
          <>
            <CollapsibleSection id="overdue"   items={overdueItems}   onMarkComplete={handleMarkComplete} />
            <CollapsibleSection id="upcoming"  items={upcomingItems}  onMarkComplete={handleMarkComplete} />
            <CollapsibleSection id="completed" items={completedItems} onMarkComplete={handleMarkComplete} />
          </>
        )}

        {/* ── Compliance tip ───────────────────────────────────────────────── */}
        <View style={ss.tipCard}>
          <View style={ss.tipImgWrap}><View style={ss.tipImgPlaceholder} /></View>
          <View style={ss.tipBody}>
            <Text style={ss.tipEyebrow}>COMPLIANCE TIP</Text>
            <Text style={ss.tipTitle}>Did you know?</Text>
            <Text style={ss.tipDesc}>
              Late CIPA filings incur a recurring monthly fee. File early to save BWP 500.
            </Text>
          </View>
        </View>

        <View style={{ height: 32 }} />
      </ScrollView>

      {/* ── FAB ─────────────────────────────────────────────────────────────── */}
      <Pressable style={ss.fab} onPress={() => router.push("/add-task" as any)}>
        <MaterialIcons name="add" size={26} color="#ffffff" />
      </Pressable>

      {/* Modals */}
      <PenaltyExposureModal visible={penaltyVisible} onClose={() => setPenaltyVisible(false)} />

      {/* FE-21: Health Score Breakdown Modal */}
      <HealthBreakdownModal
        visible={breakdownVisible}
        onClose={() => setBreakdownVisible(false)}
        score={score}
        band={band}
        breakdown={breakdown}
      />

      {/* FE-22: Compliance Calendar Modal */}
      <ComplianceCalendarModal
        visible={calendarVisible}
        onClose={() => setCalendarVisible(false)}
        deadlines={deadlines ?? []}
      />
    </SafeAreaView>
  );
}

// ── Styles (unchanged from existing index.tsx) ────────────────────────────────
const ss = StyleSheet.create({
  safe:          { flex: 1, backgroundColor: C.bg },
  scroll:        { flex: 1 },
  scrollContent: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 16 },

  overdueBanner: { flexDirection: "row", alignItems: "flex-start", backgroundColor: C.errorBg, borderRadius: 14, padding: 14, marginTop: 14, marginBottom: 4, gap: 10, borderWidth: 1, borderColor: "#F5C6C2" },
  overdueBody:   { flex: 1 },
  overdueTitle:  { fontSize: 14, fontWeight: "700", color: C.error, marginBottom: 2 },
  overdueDesc:   { fontSize: 12, color: C.error, opacity: 0.85 },

  scoreCard:     { backgroundColor: C.surface, borderRadius: 16, padding: 20, marginTop: 14, marginBottom: 4, borderWidth: 1, borderColor: C.border, alignItems: "center" },
  scoreCardHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", width: "100%", marginBottom: 16 },
  scoreEyebrow:  { fontSize: 10, fontWeight: "600", color: C.muted, letterSpacing: 1.5, textTransform: "uppercase" },
  calendarBtn:   { width: 32, height: 32, borderRadius: 8, backgroundColor: C.bursBg, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: C.border },
  scoreDesc:     { fontSize: 13, color: C.mid, textAlign: "center", maxWidth: 260, lineHeight: 19, marginTop: 8 },

  gaugeWrap:     { alignItems: "center", marginBottom: 4 },
  gaugeOuter:    { width: 148, height: 148, borderRadius: 74, borderWidth: 12, alignItems: "center", justifyContent: "center" },
  gaugeInner:    { position: "absolute", width: 120, height: 120, borderRadius: 60, borderWidth: 4 },
  gaugeCenter:   { alignItems: "center" },
  gaugeScore:    { fontSize: 38, fontWeight: "700", lineHeight: 42 },
  gaugeLabel:    { fontSize: 10, fontWeight: "700", letterSpacing: 1.5, marginTop: 2 },
  gaugeTapHint:  { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 8 },
  gaugeTapText:  { fontSize: 11, color: C.muted, fontFamily: "PublicSans_400Regular" },

  penaltyCard:   { flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: C.errorBg, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, marginBottom: 4, borderWidth: 1, borderColor: "#F5C6C2" },
  penaltyLeft:   { flexDirection: "row", alignItems: "center", gap: 10 },
  penaltyEyebrow:{ fontSize: 12, fontWeight: "700", color: C.error },
  penaltyDesc:   { fontSize: 11, color: C.error, opacity: 0.75, marginTop: 1 },

  filterGrid:    { marginTop: 14, marginBottom: 4, gap: 8 },
  filterGridRow: { flexDirection: "row", gap: 8 },
  filterTile:    { flexDirection: "row", alignItems: "center", gap: 7, paddingHorizontal: 14, paddingVertical: 11, borderRadius: 12, backgroundColor: C.surface, borderWidth: 1, borderColor: C.border },
  filterTileFull:{ width: "100%" },
  filterTileHalf:{ flex: 1, minWidth: 0 },
  filterTileActive:     { backgroundColor: C.primary, borderColor: C.primary, borderLeftWidth: 1 },
  filterTileText:       { fontSize: 13, fontWeight: "600", color: C.muted },
  filterTileTextActive: { color: "#fff" },

  listHeaderRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 16, marginBottom: 8, paddingHorizontal: 2 },
  listTitle:     { fontSize: 18, fontWeight: "700", color: C.primary },
  listSubtitle:  { fontSize: 12, color: C.muted },

  section:            { marginBottom: 8 },
  sectionHeader:      { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 13, paddingHorizontal: 14, backgroundColor: C.surface, borderRadius: 14, borderWidth: 1, borderColor: C.border },
  sectionHeaderOpen:  { borderBottomLeftRadius: 0, borderBottomRightRadius: 0, borderBottomWidth: 0 },
  sectionIconWrap:    { width: 30, height: 30, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  sectionLabel:       { flex: 1, fontSize: 14, fontWeight: "700", letterSpacing: 0.3 },
  sectionRight:       { flexDirection: "row", alignItems: "center", gap: 8 },
  sectionBadge:       { minWidth: 22, height: 22, borderRadius: 11, paddingHorizontal: 6, alignItems: "center", justifyContent: "center" },
  sectionBadgeText:   { color: "#fff", fontSize: 11, fontWeight: "700" },
  sectionBody:        { overflow: "hidden" },
  sectionContent:     { paddingTop: 8, paddingBottom: 4, paddingHorizontal: 10, backgroundColor: C.containerLow, borderWidth: 1, borderTopWidth: 0, borderColor: C.border, borderBottomLeftRadius: 14, borderBottomRightRadius: 14 },

  card:          { backgroundColor: C.surface, borderRadius: 12, marginBottom: 8, flexDirection: "row", borderWidth: 1, borderColor: C.border, overflow: "hidden" },
  cardPressed:   { opacity: 0.84 },
  cardBar:       { width: 4 },
  cardBody:      { flex: 1, padding: 14 },
  cardTop:       { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 },
  chip:          { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6 },
  chipText:      { fontSize: 11, fontWeight: "700", letterSpacing: 0.4 },
  daysText:      { fontSize: 12, fontWeight: "600" },
  cardTitle:     { fontSize: 15, fontWeight: "700", color: C.primary, marginBottom: 4, lineHeight: 21 },
  cardPenalty:   { fontSize: 12, color: C.muted, marginBottom: 12 },
  cardActions:   { flexDirection: "row", gap: 8 },
  btnPrimary:    { flex: 1, backgroundColor: C.primary, borderRadius: 10, paddingVertical: 10, alignItems: "center" },
  btnPrimaryText:{ color: "#fff", fontSize: 12, fontWeight: "700", letterSpacing: 0.3 },
  btnOutline:    { paddingHorizontal: 12, borderRadius: 10, paddingVertical: 10, borderWidth: 1, borderColor: C.border, alignItems: "center" },
  btnOutlineText:{ color: C.primary, fontSize: 12, fontWeight: "600" },
  completeRow:   { flexDirection: "row", alignItems: "center" },
  completeText:  { fontSize: 13, color: C.secondary, fontWeight: "600" },

  skel:    { backgroundColor: C.border, borderRadius: 4 },
  errorBox:{ alignItems: "center", padding: 32, gap: 10 },
  errorText:{ color: C.error, fontSize: 14 },
  retryBtn:{ paddingHorizontal: 20, paddingVertical: 8, backgroundColor: C.primary, borderRadius: 8 },
  retryText:{ color: "#fff", fontWeight: "600" },
  emptyBox:{ alignItems: "center", padding: 40 },
  emptyTitle:{ fontSize: 18, fontWeight: "700", color: C.primary, marginTop: 10, marginBottom: 6 },
  emptyDesc:{ fontSize: 13, color: C.muted, textAlign: "center", lineHeight: 19 },

  tipCard:        { backgroundColor: C.container, borderRadius: 14, padding: 14, flexDirection: "row-reverse", alignItems: "center", gap: 14, borderWidth: 1, borderColor: C.border, marginTop: 8 },
  tipImgWrap:     { width: 80, height: 80, borderRadius: 10, overflow: "hidden" },
  tipImgPlaceholder:{ width: "100%", height: "100%", backgroundColor: "#0b2147", borderRadius: 10 },
  tipBody:        { flex: 1 },
  tipEyebrow:     { fontSize: 9, fontWeight: "600", color: C.burs, letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 4 },
  tipTitle:       { fontSize: 14, fontWeight: "700", color: C.primary, marginBottom: 4 },
  tipDesc:        { fontSize: 12, color: C.muted, lineHeight: 17 },

  fab: { position: "absolute", right: 16, bottom: 90, backgroundColor: C.primary, width: 52, height: 52, borderRadius: 14, justifyContent: "center", alignItems: "center", shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 8, elevation: 6 },
});