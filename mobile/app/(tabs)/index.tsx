// mobile/app/(tabs)/index.tsx — Collapsible deadline sections
import { useRouter } from "expo-router";
import { useRef, useState } from "react";
import {
  ActivityIndicator, Animated, Platform, Pressable, RefreshControl,
  ScrollView, StatusBar, StyleSheet, Text, TouchableOpacity, View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { MaterialIcons } from "@expo/vector-icons";
import { useDeadlines, useUpdateDeadlineStatus } from "@/hooks/useDeadlines";
import { useHealthScore } from "@/hooks/useHealthScore";
import { PenaltyExposureModal } from "@/components/PenaltyExposureModal";
import { TopBar } from "@/components/ui/TopBar";
import type { Deadline } from "@/types";

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

// ── Section config ────────────────────────────────────────────────────────────
type SectionId = "overdue" | "upcoming" | "completed";
const SECTION_META: Record<SectionId, {
  label: string; icon: string; accentColor: string; defaultOpen: boolean;
}> = {
  overdue:   { label: "Overdue",   icon: "error-outline",   accentColor: C.error,     defaultOpen: true  },
  upcoming:  { label: "Upcoming",  icon: "schedule",        accentColor: C.amber,     defaultOpen: true  },
  completed: { label: "Completed", icon: "check-circle",    accentColor: C.secondary, defaultOpen: false },
};

// ── Health Score Gauge ────────────────────────────────────────────────────────
function ScoreGauge({ score, band }: { score: number; band: string }) {
  const ringColor =
    band === "green" ? C.secondary : band === "amber" ? C.amber : C.error;
  const label =
    band === "green" ? "GOOD STANDING" : band === "amber" ? "ATTENTION" : "CRITICAL";
  return (
    <View style={ss.gaugeWrap}>
      <View style={[ss.gaugeOuter, { borderColor: C.borderSoft }]}>
        <View style={[ss.gaugeInner, { borderColor: ringColor }]} />
        <View style={ss.gaugeCenter}>
          <Text style={[ss.gaugeScore, { color: C.primary }]}>{score}%</Text>
          <Text style={[ss.gaugeLabel, { color: ringColor }]}>{label}</Text>
        </View>
      </View>
    </View>
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

  const daysColor = isComplete ? C.secondary
    : isOverdue ? C.error
    : days <= 7 ? C.amber
    : C.secondaryText;

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
        {item.penalty_info ? (
          <Text style={ss.cardPenalty} numberOfLines={1}>{item.penalty_info}</Text>
        ) : null}
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
function CollapsibleSection({
  id, items, onMarkComplete,
}: {
  id: SectionId;
  items: Deadline[];
  onMarkComplete: (id: number) => void;
}) {
  const meta = SECTION_META[id];
  const [open, setOpen] = useState(meta.defaultOpen);
  const anim = useRef(new Animated.Value(meta.defaultOpen ? 1 : 0)).current;
  const chevronAnim = useRef(new Animated.Value(meta.defaultOpen ? 1 : 0)).current;

  const toggle = () => {
    const toValue = open ? 0 : 1;
    Animated.parallel([
      Animated.spring(anim, { toValue, useNativeDriver: false, friction: 12, tension: 80 }),
      Animated.spring(chevronAnim, { toValue, useNativeDriver: true, friction: 12, tension: 80 }),
    ]).start();
    setOpen(!open);
  };

  const chevronRotate = chevronAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "180deg"],
  });

  const estimatedHeight = items.length * 160 + 16;
  const maxHeight = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, estimatedHeight],
  });
  const opacity = anim.interpolate({ inputRange: [0, 0.4, 1], outputRange: [0, 0.6, 1] });

  if (items.length === 0) return null;

  return (
    <View style={ss.section}>
      <TouchableOpacity
        style={[ss.sectionHeader, open && ss.sectionHeaderOpen]}
        onPress={toggle}
        activeOpacity={0.75}
      >
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
          {items.map((item) => (
            <DeadlineCard key={item.id} item={item} onMarkComplete={onMarkComplete} />
          ))}
        </View>
      </Animated.View>
    </View>
  );
}

// ── Skeleton ──────────────────────────────────────────────────────────────────
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
  const [activeFilter, setActiveFilter] = useState<Filter>("ALL");
  const [refreshing, setRefreshing]     = useState(false);
  const [penaltyVisible, setPenaltyVisible] = useState(false);

  const { data: deadlines, isLoading: dlLoading, isError: dlError, refetch: refetchDl } =
    useDeadlines(activeFilter === "ALL" ? undefined : activeFilter);

  const { data: scoreData, isLoading: scoreLoading, refetch: refetchScore } = useHealthScore();
  const { mutate: updateStatus } = useUpdateDeadlineStatus();

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

  const score = scoreData?.score ?? 85;
  const band  = scoreData?.band  ?? "green";

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
        {/* ── Overdue urgent banner ────────────────────────────────────────── */}
        {overdueItems.length > 0 && (
          <View style={ss.overdueBanner}>
            <MaterialIcons name="warning" size={20} color={C.error} />
            <View style={ss.overdueBody}>
              <Text style={ss.overdueTitle}>{overdueItems.length} Overdue Task{overdueItems.length > 1 ? "s" : ""}</Text>
              <Text style={ss.overdueDesc}>File immediately to avoid BURS/CIPA penalties.</Text>
            </View>
          </View>
        )}

        {/* ── Health score ─────────────────────────────────────────────────── */}
        <View style={ss.scoreCard}>
          <Text style={ss.scoreEyebrow}>COMPLIANCE HEALTH SCORE</Text>
          {scoreLoading ? (
            <ActivityIndicator color={C.secondary} style={{ marginVertical: 20 }} />
          ) : (
            <>
              <ScoreGauge score={score} band={band} />
              <Text style={ss.scoreDesc}>
                Your business is mostly compliant. Complete the{" "}
                <Text style={{ fontWeight: "700", color: C.primary }}>
                  {upcomingItems.length + overdueItems.length} pending tasks
                </Text>{" "}
                to reach 100%.
              </Text>
              {scoreData?.breakdown?.length ? (
                <View style={ss.breakdown}>
                  {scoreData.breakdown.map((b: any) => {
                    const cat = CAT[b.category] ?? CAT.CUSTOM;
                    return (
                      <View key={b.category} style={ss.bkRow}>
                        <View style={[ss.bkDot, { backgroundColor: cat.bar }]} />
                        <Text style={ss.bkCat}>{b.category}</Text>
                        <View style={ss.bkBarWrap}>
                          <View style={[ss.bkBar, { width: `${b.score}%`, backgroundColor: cat.bar }]} />
                        </View>
                        <Text style={ss.bkScore}>{b.score}</Text>
                      </View>
                    );
                  })}
                </View>
              ) : null}
            </>
          )}
        </View>

        {/* ── Penalty exposure ─────────────────────────────────────────────── */}
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

        {/* ── Category filter grid ─────────────────────────────────────────── */}
        <View style={ss.filterGrid}>
          <Pressable
            style={[ss.filterTile, ss.filterTileFull, activeFilter === "ALL" && ss.filterTileActive]}
            onPress={() => setActiveFilter("ALL")}
          >
            <MaterialIcons name="apps" size={16} color={activeFilter === "ALL" ? "#fff" : C.muted} />
            <Text style={[ss.filterTileText, activeFilter === "ALL" && ss.filterTileTextActive]}>All Deadlines</Text>
          </Pressable>
          <View style={ss.filterGridRow}>
            {FILTERS.filter((f) => f.value !== "ALL").slice(0, 2).map((f) => {
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
          <View style={ss.filterGridRow}>
            {FILTERS.filter((f) => f.value !== "ALL").slice(2).map((f) => {
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
        </View>

        {/* ── Deadlines header ─────────────────────────────────────────────── */}
        <View style={ss.listHeaderRow}>
          <Text style={ss.listTitle}>
            {activeFilter === "ALL" ? "All Deadlines" : `${activeFilter} Deadlines`}
          </Text>
          <Text style={ss.listSubtitle}>
            {hasItems ? `${(deadlines ?? []).length} total` : ""}
          </Text>
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
          <View style={ss.tipImgWrap}>
            <View style={ss.tipImgPlaceholder} />
          </View>
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

      <PenaltyExposureModal visible={penaltyVisible} onClose={() => setPenaltyVisible(false)} />
    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const ss = StyleSheet.create({
  safe:          { flex: 1, backgroundColor: C.bg },
  scroll:        { flex: 1 },
  scrollContent: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 16 },

  overdueBanner: { flexDirection: "row", alignItems: "flex-start", backgroundColor: C.errorBg, borderRadius: 14, padding: 14, marginTop: 14, marginBottom: 4, gap: 10, borderWidth: 1, borderColor: "#F5C6C2" },
  overdueBody:   { flex: 1 },
  overdueTitle:  { fontSize: 14, fontWeight: "700", color: C.error, marginBottom: 2 },
  overdueDesc:   { fontSize: 12, color: C.error, opacity: 0.85 },

  scoreCard:     { backgroundColor: C.surface, borderRadius: 16, padding: 20, marginTop: 14, marginBottom: 4, borderWidth: 1, borderColor: C.border, alignItems: "center" },
  scoreEyebrow:  { fontSize: 10, fontWeight: "600", color: C.muted, letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 16 },
  scoreDesc:     { fontSize: 13, color: C.mid, textAlign: "center", maxWidth: 260, lineHeight: 19, marginTop: 8 },

  gaugeWrap:     { alignItems: "center", marginBottom: 8 },
  gaugeOuter:    { width: 148, height: 148, borderRadius: 74, borderWidth: 12, alignItems: "center", justifyContent: "center" },
  gaugeInner:    { position: "absolute", width: 120, height: 120, borderRadius: 60, borderWidth: 4 },
  gaugeCenter:   { alignItems: "center" },
  gaugeScore:    { fontSize: 38, fontWeight: "700", lineHeight: 42 },
  gaugeLabel:    { fontSize: 10, fontWeight: "700", letterSpacing: 1.5, marginTop: 2 },

  breakdown:     { width: "100%", gap: 8, marginTop: 16 },
  bkRow:         { flexDirection: "row", alignItems: "center", gap: 8 },
  bkDot:         { width: 8, height: 8, borderRadius: 4 },
  bkCat:         { fontSize: 11, fontWeight: "600", color: C.primary, width: 52 },
  bkBarWrap:     { flex: 1, height: 5, backgroundColor: C.borderSoft, borderRadius: 3, overflow: "hidden" },
  bkBar:         { height: 5, borderRadius: 3 },
  bkScore:       { fontSize: 11, fontWeight: "700", color: C.muted, width: 26, textAlign: "right" },

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

  skel:          { backgroundColor: C.border, borderRadius: 4 },

  errorBox:      { alignItems: "center", padding: 32, gap: 10 },
  errorText:     { color: C.error, fontSize: 14 },
  retryBtn:      { paddingHorizontal: 20, paddingVertical: 8, backgroundColor: C.primary, borderRadius: 8 },
  retryText:     { color: "#fff", fontWeight: "600" },
  emptyBox:      { alignItems: "center", padding: 40 },
  emptyTitle:    { fontSize: 18, fontWeight: "700", color: C.primary, marginTop: 10, marginBottom: 6 },
  emptyDesc:     { fontSize: 13, color: C.muted, textAlign: "center", lineHeight: 19 },

  tipCard:       { backgroundColor: C.container, borderRadius: 14, padding: 14, flexDirection: "row-reverse", alignItems: "center", gap: 14, borderWidth: 1, borderColor: C.border, marginTop: 8 },
  tipImgWrap:    { width: 80, height: 80, borderRadius: 10, overflow: "hidden" },
  tipImgPlaceholder: { width: "100%", height: "100%", backgroundColor: "#0b2147", borderRadius: 10 },
  tipBody:       { flex: 1 },
  tipEyebrow:    { fontSize: 9, fontWeight: "600", color: C.burs, letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 4 },
  tipTitle:      { fontSize: 14, fontWeight: "700", color: C.primary, marginBottom: 4 },
  tipDesc:       { fontSize: 12, color: C.muted, lineHeight: 17 },

  fab:           { position: "absolute", right: 16, bottom: 90, backgroundColor: C.primary, width: 52, height: 52, borderRadius: 14, justifyContent: "center", alignItems: "center", shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 8, elevation: 6 },
});