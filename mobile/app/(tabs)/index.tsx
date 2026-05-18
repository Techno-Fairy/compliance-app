import { useRouter } from "expo-router";
import { useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useDeadlines } from "@/hooks/useDeadlines";
import { useHealthScore } from "@/hooks/useHealthScore";
import { useUpdateDeadlineStatus } from "@/hooks/useDeadlines";
import type { Deadline } from "@/types";

// ── Palette ──────────────────────────────────────────────────────────────────
const C = {
  bg:        "#F7F6F2",
  surface:   "#FFFFFF",
  black:     "#0D0D0D",
  mid:       "#6B6B6B",
  muted:     "#B0AEA8",
  border:    "#E8E6E1",
  overdue:   "#C0392B",
  overdueB:  "#FDECEA",
  complete:  "#1E7E50",
  amber:     "#D4830A",
  amberB:    "#FEF3E2",
  burs:      "#1A3C5E",
  bursB:     "#EAF0F7",
  cipa:      "#2E6B4F",
  cipaB:     "#E8F4EE",
  labour:    "#6B3A7D",
  labourB:   "#F3EEF7",
  custom:    "#7D5A1E",
  customB:   "#F7F1E8",
  primary:   "#0D0D0D",
  accent:    "#1A3C5E",
};

// ── Category config ───────────────────────────────────────────────────────────
const CAT: Record<string, { bg: string; text: string; bar: string }> = {
  BURS:   { bg: C.bursB,   text: C.burs,   bar: C.burs   },
  CIPA:   { bg: C.cipaB,   text: C.cipa,   bar: C.cipa   },
  LABOUR: { bg: C.labourB, text: C.labour, bar: C.labour  },
  CUSTOM: { bg: C.customB, text: C.custom, bar: C.custom  },
};

const FILTERS = ["ALL", "BURS", "CIPA", "LABOUR", "CUSTOM"] as const;
type Filter = typeof FILTERS[number];

// ── Health Score Ring ─────────────────────────────────────────────────────────
function ScoreRing({ score, band }: { score: number; band: string }) {
  const size = 140;
  const stroke = 10;
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const fill = (score / 100) * circ;

  const ringColor =
    band === "green" ? C.complete :
    band === "amber" ? C.amber : C.overdue;

  const label =
    band === "green" ? "HEALTHY" :
    band === "amber" ? "ATTENTION" : "CRITICAL";

  return (
    <View style={ss.ringWrap}>
      {/* SVG-like ring using border trick */}
      <View style={[ss.ringOuter, { borderColor: C.border }]}>
        <View style={[ss.ringInner, { borderColor: ringColor }]} />
        <View style={ss.ringCenter}>
          <Text style={[ss.ringScore, { color: ringColor }]}>{score}</Text>
          <Text style={[ss.ringLabel, { color: ringColor }]}>{label}</Text>
        </View>
      </View>
    </View>
  );
}

// ── Deadline Card ─────────────────────────────────────────────────────────────
function DeadlineCard({
  item,
  onMarkComplete,
}: {
  item: Deadline;
  onMarkComplete: (id: number) => void;
}) {
  const router = useRouter();
  const cat = CAT[item.category] ?? CAT.CUSTOM;
  const days = item.days_remaining ?? 0;
  const isOverdue = days < 0;
  const isComplete = item.status === "complete";

  const daysLabel =
    isComplete ? "Completed"
    : isOverdue ? `${Math.abs(days)}d overdue`
    : days === 0 ? "Due today"
    : `${days}d remaining`;

  const daysColor =
    isComplete ? C.complete
    : isOverdue ? C.overdue
    : days <= 7  ? C.amber
    : C.mid;

  return (
    <Pressable
      style={({ pressed }) => [ss.card, pressed && ss.cardPressed]}
      onPress={() => router.push(`/deadline/${item.id}` as any)}
    >
      {/* Left accent bar */}
      <View style={[ss.cardBar, { backgroundColor: cat.bar }]} />

      <View style={ss.cardBody}>
        {/* Top row */}
        <View style={ss.cardTop}>
          <View style={[ss.chip, { backgroundColor: cat.bg }]}>
            <Text style={[ss.chipText, { color: cat.text }]}>{item.category}</Text>
          </View>
          <Text style={[ss.daysText, { color: daysColor }]}>{daysLabel}</Text>
        </View>

        {/* Title */}
        <Text style={ss.cardTitle} numberOfLines={2}>{item.name}</Text>

        {/* Penalty info */}
        {item.penalty_info ? (
          <Text style={ss.cardPenalty} numberOfLines={1}>{item.penalty_info}</Text>
        ) : null}

        {/* Actions */}
        {!isComplete && (
          <View style={ss.cardActions}>
            <Pressable
              style={({ pressed }) => [ss.btnPrimary, pressed && { opacity: 0.75 }]}
              onPress={() => onMarkComplete(item.id)}
            >
              <Text style={ss.btnPrimaryText}>Mark Complete</Text>
            </Pressable>
            <Pressable
              style={({ pressed }) => [ss.btnOutline, pressed && { opacity: 0.75 }]}
              onPress={() => router.push(`/deadline/${item.id}` as any)}
            >
              <Text style={ss.btnOutlineText}>Details</Text>
            </Pressable>
          </View>
        )}

        {isComplete && (
          <View style={ss.completeRow}>
            <Text style={ss.completeText}>✓  Filed &amp; complete</Text>
          </View>
        )}
      </View>
    </Pressable>
  );
}

// ── Skeleton ──────────────────────────────────────────────────────────────────
function SkeletonCard() {
  return (
    <View style={[ss.card, { opacity: 0.4 }]}>
      <View style={[ss.cardBar, { backgroundColor: C.border }]} />
      <View style={ss.cardBody}>
        <View style={[ss.skeletonLine, { width: 80, height: 20, marginBottom: 10 }]} />
        <View style={[ss.skeletonLine, { width: "90%", height: 16, marginBottom: 6 }]} />
        <View style={[ss.skeletonLine, { width: "60%", height: 14 }]} />
      </View>
    </View>
  );
}

// ── Main Dashboard ────────────────────────────────────────────────────────────
export default function DashboardScreen() {
  const [activeFilter, setActiveFilter] = useState<Filter>("ALL");
  const [refreshing, setRefreshing] = useState(false);

  const {
    data: deadlines,
    isLoading: dlLoading,
    isError: dlError,
    refetch: refetchDl,
  } = useDeadlines(activeFilter === "ALL" ? undefined : activeFilter);

  const {
    data: scoreData,
    isLoading: scoreLoading,
    refetch: refetchScore,
  } = useHealthScore();

  const { mutate: updateStatus } = useUpdateDeadlineStatus();

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([refetchDl(), refetchScore()]);
    setRefreshing(false);
  };

  const handleMarkComplete = (id: number) => {
    updateStatus({ id, status: "complete" });
  };

  const overdue = deadlines?.filter(
    (d) => d.status !== "complete" && (d.days_remaining ?? 0) < 0
  ) ?? [];

  const score = scoreData?.score ?? 0;
  const band  = scoreData?.band  ?? "green";

  return (
    <SafeAreaView style={ss.safe} edges={["top"]}>
      <StatusBar barStyle="dark-content" backgroundColor={C.bg} />

      <ScrollView
        style={ss.scroll}
        contentContainerStyle={ss.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.accent} />
        }
      >
        {/* ── Header ─────────────────────────────────────────────────────── */}
        <View style={ss.header}>
          <View>
            <Text style={ss.headerEyebrow}>Good day</Text>
            <Text style={ss.headerTitle}>Compliance{"\n"}Dashboard</Text>
          </View>
          <View style={ss.headerAvatar}>
            <Text style={ss.headerAvatarText}>BW</Text>
          </View>
        </View>

        {/* ── Overdue Banner ─────────────────────────────────────────────── */}
        {overdue.length > 0 && (
          <View style={ss.overdueBanner}>
            <Text style={ss.overdueIcon}>⚠</Text>
            <View style={ss.overdueBody}>
              <Text style={ss.overdueTitle}>
                {overdue.length} overdue item{overdue.length > 1 ? "s" : ""}
              </Text>
              <Text style={ss.overdueDesc}>
                File immediately to avoid BURS/CIPA penalties.
              </Text>
            </View>
          </View>
        )}

        {/* ── Health Score ───────────────────────────────────────────────── */}
        <View style={ss.scoreCard}>
          <Text style={ss.scoreEyebrow}>Compliance Health Score</Text>

          {scoreLoading ? (
            <ActivityIndicator color={C.accent} style={{ marginVertical: 20 }} />
          ) : (
            <>
              <ScoreRing score={score} band={band} />

              {/* Category breakdown */}
              {scoreData?.breakdown?.length ? (
                <View style={ss.breakdown}>
                  {scoreData.breakdown.map((b: any) => {
                    const cat = CAT[b.category] ?? CAT.CUSTOM;
                    return (
                      <View key={b.category} style={ss.breakdownRow}>
                        <View style={[ss.breakdownDot, { backgroundColor: cat.bar }]} />
                        <Text style={ss.breakdownCat}>{b.category}</Text>
                        <View style={ss.breakdownBarWrap}>
                          <View
                            style={[
                              ss.breakdownBar,
                              { width: `${b.score}%`, backgroundColor: cat.bar },
                            ]}
                          />
                        </View>
                        <Text style={ss.breakdownScore}>{b.score}</Text>
                      </View>
                    );
                  })}
                </View>
              ) : null}
            </>
          )}
        </View>

        {/* ── Filters ────────────────────────────────────────────────────── */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={ss.filterRow}
        >
          {FILTERS.map((f) => (
            <Pressable
              key={f}
              style={[ss.filterChip, activeFilter === f && ss.filterChipActive]}
              onPress={() => setActiveFilter(f)}
            >
              <Text
                style={[
                  ss.filterText,
                  activeFilter === f && ss.filterTextActive,
                ]}
              >
                {f}
              </Text>
            </Pressable>
          ))}
        </ScrollView>

        {/* ── Deadline List ──────────────────────────────────────────────── */}
        <View style={ss.listHeader}>
          <Text style={ss.listTitle}>Upcoming Deadlines</Text>
          {deadlines && (
            <Text style={ss.listCount}>{deadlines.length}</Text>
          )}
        </View>

        {dlLoading && (
          <>
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </>
        )}

        {dlError && (
          <View style={ss.errorBox}>
            <Text style={ss.errorText}>Could not load deadlines.</Text>
            <Pressable onPress={() => refetchDl()} style={ss.retryBtn}>
              <Text style={ss.retryText}>Retry</Text>
            </Pressable>
          </View>
        )}

        {!dlLoading && !dlError && deadlines?.length === 0 && (
          <View style={ss.emptyBox}>
            <Text style={ss.emptyIcon}>✓</Text>
            <Text style={ss.emptyTitle}>All clear</Text>
            <Text style={ss.emptyDesc}>
              No deadlines found for this category. You are fully compliant.
            </Text>
          </View>
        )}

        {!dlLoading &&
          deadlines?.map((item) => (
            <DeadlineCard
              key={item.id}
              item={item}
              onMarkComplete={handleMarkComplete}
            />
          ))}

        {/* ── Compliance Tip ─────────────────────────────────────────────── */}
        <View style={ss.tipCard}>
          <Text style={ss.tipEyebrow}>COMPLIANCE TIP</Text>
          <Text style={ss.tipTitle}>Did you know?</Text>
          <Text style={ss.tipDesc}>
            Late CIPA filings incur a recurring monthly fee of BWP 250. Filing
            early keeps your company in good standing and avoids deregistration risk.
          </Text>
        </View>

        <View style={{ height: 32 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const ss = StyleSheet.create({
  safe:           { flex: 1, backgroundColor: C.bg },
  scroll:         { flex: 1 },
  scrollContent:  { paddingHorizontal: 20 },

  // Header
  header:         { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", paddingTop: 24, paddingBottom: 20 },
  headerEyebrow:  { fontSize: 13, color: C.mid, letterSpacing: 1, textTransform: "uppercase", marginBottom: 4 },
  headerTitle:    { fontSize: 30, fontWeight: "800", color: C.black, lineHeight: 34 },
  headerAvatar:   { width: 44, height: 44, borderRadius: 22, backgroundColor: C.accent, alignItems: "center", justifyContent: "center" },
  headerAvatarText: { color: "#fff", fontWeight: "700", fontSize: 14 },

  // Overdue banner
  overdueBanner:  { flexDirection: "row", alignItems: "flex-start", backgroundColor: C.overdueB, borderRadius: 12, padding: 14, marginBottom: 16, gap: 10, borderWidth: 1, borderColor: "#F5C6C2" },
  overdueIcon:    { fontSize: 18, color: C.overdue, marginTop: 1 },
  overdueBody:    { flex: 1 },
  overdueTitle:   { fontSize: 14, fontWeight: "700", color: C.overdue, marginBottom: 2 },
  overdueDesc:    { fontSize: 13, color: C.overdue, opacity: 0.85 },

  // Score card
  scoreCard:      { backgroundColor: C.surface, borderRadius: 16, padding: 20, marginBottom: 16, borderWidth: 1, borderColor: C.border },
  scoreEyebrow:   { fontSize: 11, fontWeight: "700", color: C.mid, letterSpacing: 1.5, textTransform: "uppercase", textAlign: "center", marginBottom: 16 },

  // Ring
  ringWrap:       { alignItems: "center", marginBottom: 20 },
  ringOuter:      { width: 140, height: 140, borderRadius: 70, borderWidth: 10, alignItems: "center", justifyContent: "center" },
  ringInner:      { position: "absolute", width: 114, height: 114, borderRadius: 57, borderWidth: 4 },
  ringCenter:     { alignItems: "center" },
  ringScore:      { fontSize: 38, fontWeight: "800", lineHeight: 42 },
  ringLabel:      { fontSize: 10, fontWeight: "700", letterSpacing: 1.5 },

  // Breakdown
  breakdown:      { gap: 8 },
  breakdownRow:   { flexDirection: "row", alignItems: "center", gap: 8 },
  breakdownDot:   { width: 8, height: 8, borderRadius: 4 },
  breakdownCat:   { fontSize: 12, fontWeight: "600", color: C.black, width: 56 },
  breakdownBarWrap: { flex: 1, height: 6, backgroundColor: C.border, borderRadius: 3, overflow: "hidden" },
  breakdownBar:   { height: 6, borderRadius: 3 },
  breakdownScore: { fontSize: 12, fontWeight: "700", color: C.mid, width: 28, textAlign: "right" },

  // Filters
  filterRow:      { paddingVertical: 4, gap: 8, marginBottom: 20 },
  filterChip:     { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: C.surface, borderWidth: 1, borderColor: C.border },
  filterChipActive: { backgroundColor: C.black, borderColor: C.black },
  filterText:     { fontSize: 13, fontWeight: "600", color: C.mid },
  filterTextActive: { color: "#fff" },

  // List header
  listHeader:     { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 },
  listTitle:      { fontSize: 17, fontWeight: "700", color: C.black },
  listCount:      { fontSize: 13, fontWeight: "700", color: C.mid },

  // Card
  card:           { backgroundColor: C.surface, borderRadius: 14, marginBottom: 12, flexDirection: "row", borderWidth: 1, borderColor: C.border, overflow: "hidden" },
  cardPressed:    { opacity: 0.85 },
  cardBar:        { width: 4 },
  cardBody:       { flex: 1, padding: 14 },
  cardTop:        { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 },
  chip:           { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 6 },
  chipText:       { fontSize: 11, fontWeight: "700", letterSpacing: 0.5 },
  daysText:       { fontSize: 12, fontWeight: "600" },
  cardTitle:      { fontSize: 15, fontWeight: "700", color: C.black, marginBottom: 4, lineHeight: 20 },
  cardPenalty:    { fontSize: 12, color: C.mid, marginBottom: 12 },
  cardActions:    { flexDirection: "row", gap: 8 },
  btnPrimary:     { flex: 1, backgroundColor: C.black, borderRadius: 8, paddingVertical: 9, alignItems: "center" },
  btnPrimaryText: { color: "#fff", fontSize: 13, fontWeight: "700" },
  btnOutline:     { paddingHorizontal: 14, borderRadius: 8, paddingVertical: 9, borderWidth: 1, borderColor: C.border, alignItems: "center" },
  btnOutlineText: { color: C.black, fontSize: 13, fontWeight: "600" },
  completeRow:    { flexDirection: "row", alignItems: "center" },
  completeText:   { fontSize: 13, color: C.complete, fontWeight: "600" },

  // Skeleton
  skeletonLine:   { backgroundColor: C.border, borderRadius: 4 },

  // Error / Empty
  errorBox:       { alignItems: "center", padding: 32 },
  errorText:      { color: C.overdue, fontSize: 14, marginBottom: 12 },
  retryBtn:       { paddingHorizontal: 20, paddingVertical: 8, backgroundColor: C.black, borderRadius: 8 },
  retryText:      { color: "#fff", fontWeight: "600" },
  emptyBox:       { alignItems: "center", padding: 40 },
  emptyIcon:      { fontSize: 40, color: C.complete, marginBottom: 12 },
  emptyTitle:     { fontSize: 18, fontWeight: "700", color: C.black, marginBottom: 6 },
  emptyDesc:      { fontSize: 14, color: C.mid, textAlign: "center", lineHeight: 20 },

  // Tip card
  tipCard:        { backgroundColor: C.bursB, borderRadius: 14, padding: 16, borderWidth: 1, borderColor: "#C8D8E8", marginTop: 4 },
  tipEyebrow:     { fontSize: 10, fontWeight: "700", color: C.burs, letterSpacing: 1.5, marginBottom: 6 },
  tipTitle:       { fontSize: 14, fontWeight: "700", color: C.burs, marginBottom: 4 },
  tipDesc:        { fontSize: 13, color: C.burs, opacity: 0.8, lineHeight: 19 },
});
