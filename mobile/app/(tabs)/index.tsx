// mobile/app/(tabs)/index.tsx
import { useRouter } from "expo-router";
import { useState } from "react";
import {
  ActivityIndicator, Pressable, RefreshControl,
  ScrollView, StatusBar, StyleSheet, Text, View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { MaterialIcons } from "@expo/vector-icons";
import { useDeadlines, useUpdateDeadlineStatus } from "@/hooks/useDeadlines";
import { useHealthScore } from "@/hooks/useHealthScore";
import type { Deadline } from "@/types";

// ── Design tokens ─────────────────────────────────────────────────────────────
const C = {
  bg:       "#f3faff",
  surface:  "#ffffff",
  primary:  "#000b25",
  mid:      "#44474e",
  muted:    "#75777f",
  border:   "#c5c6cf",
  borderSoft: "#e6f6ff",
  secondary: "#2a6b2c",
  secondaryBg: "#acf4a4",
  secondaryText: "#307231",
  error:    "#ba1a1a",
  errorBg:  "#ffdad6",
  amber:    "#D4830A",
  amberBg:  "#FEF3E2",
  burs:     "#1A3C5E",
  bursBg:   "#EAF0F7",
  cipaBar:  "#2E6B4F",
  cipaBg:   "#E8F4EE",
  labour:   "#6B3A7D",
  labourBg: "#F3EEF7",
  custom:   "#7D5A1E",
  customBg: "#F7F1E8",
  container: "#dbf1fe",
  containerLow: "#e6f6ff",
};

const CAT: Record<string, { bg: string; text: string; bar: string }> = {
  BURS:   { bg: C.bursBg,   text: C.burs,   bar: C.burs   },
  CIPA:   { bg: C.cipaBg,   text: C.cipaBar,bar: C.cipaBar },
  LABOUR: { bg: C.labourBg, text: C.labour, bar: C.labour  },
  CUSTOM: { bg: C.customBg, text: C.custom, bar: C.custom  },
};

const FILTERS = ["ALL", "BURS", "CIPA", "LABOUR", "CUSTOM"] as const;
type Filter = typeof FILTERS[number];

// ── Health Score Gauge ────────────────────────────────────────────────────────
function ScoreGauge({ score, band }: { score: number; band: string }) {
  const ringColor = band === "green" ? C.secondary : band === "amber" ? C.amber : C.error;
  const label = band === "green" ? "GOOD STANDING" : band === "amber" ? "ATTENTION" : "CRITICAL";

  return (
    <View style={ss.gaugeWrap}>
      {/* Outer ring */}
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

  const daysLabel = isComplete ? "Completed" : isOverdue ? `${Math.abs(days)}d overdue` : days === 0 ? "Due today" : `Due in ${days} days`;
  const daysColor = isComplete ? C.secondary : isOverdue ? C.error : days <= 7 ? C.amber : C.secondaryText;

  return (
    <Pressable style={({ pressed }) => [ss.card, pressed && ss.cardPressed]} onPress={() => router.push(`/deadline/${item.id}` as any)}>
      <View style={[ss.cardBar, { backgroundColor: cat.bar }]} />
      <View style={ss.cardBody}>
        <View style={ss.cardTop}>
          <View style={[ss.chip, { backgroundColor: cat.bg }]}>
            <Text style={[ss.chipText, { color: cat.text }]}>{item.category}</Text>
          </View>
          <Text style={[ss.daysText, { color: daysColor }]}>{daysLabel}</Text>
        </View>
        <Text style={ss.cardTitle} numberOfLines={2}>{item.name}</Text>
        {item.penalty_info ? <Text style={ss.cardPenalty} numberOfLines={1}>{item.penalty_info}</Text> : null}
        {!isComplete && (
          <View style={ss.cardActions}>
            <Pressable style={({ pressed }) => [ss.btnPrimary, pressed && { opacity: 0.75 }]} onPress={() => onMarkComplete(item.id)}>
              <Text style={ss.btnPrimaryText}>File Now</Text>
            </Pressable>
            <Pressable style={({ pressed }) => [ss.btnOutline, pressed && { opacity: 0.75 }]} onPress={() => router.push(`/deadline/${item.id}` as any)}>
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

// ── Skeleton ──────────────────────────────────────────────────────────────────
function SkeletonCard() {
  return (
    <View style={[ss.card, { opacity: 0.35 }]}>
      <View style={[ss.cardBar, { backgroundColor: C.border }]} />
      <View style={ss.cardBody}>
        <View style={[ss.skel, { width: 70, height: 22, marginBottom: 10 }]} />
        <View style={[ss.skel, { width: "88%", height: 16, marginBottom: 6 }]} />
        <View style={[ss.skel, { width: "55%", height: 13 }]} />
      </View>
    </View>
  );
}

// ── Dashboard ─────────────────────────────────────────────────────────────────
export default function DashboardScreen() {
  const [activeFilter, setActiveFilter] = useState<Filter>("ALL");
  const [refreshing, setRefreshing] = useState(false);

  const { data: deadlines, isLoading: dlLoading, isError: dlError, refetch: refetchDl } = useDeadlines(activeFilter === "ALL" ? undefined : activeFilter);
  const { data: scoreData, isLoading: scoreLoading, refetch: refetchScore } = useHealthScore();
  const { mutate: updateStatus } = useUpdateDeadlineStatus();

  const onRefresh = async () => { setRefreshing(true); await Promise.all([refetchDl(), refetchScore()]); setRefreshing(false); };
  const handleMarkComplete = (id: number) => updateStatus({ id, status: "complete" });

  const overdue = deadlines?.filter((d) => d.status !== "complete" && (d.days_remaining ?? 0) < 0) ?? [];
  const score = scoreData?.score ?? 85;
  const band  = scoreData?.band  ?? "green";

  return (
    <SafeAreaView style={ss.safe} edges={["top"]}>
      <StatusBar barStyle="dark-content" backgroundColor={C.container} />

      {/* Top bar */}
      <View style={ss.topBar}>
        <View style={ss.topBarLeft}>
          <MaterialIcons name="menu" size={24} color={C.primary} />
          <Text style={ss.appTitle}>CompliancePro Botswana</Text>
        </View>
        <View style={ss.avatar}>
          <Text style={ss.avatarText}>BW</Text>
        </View>
      </View>

      <ScrollView
        style={ss.scroll}
        contentContainerStyle={ss.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.secondary} />}
      >
        {/* Overdue banner */}
        {overdue.length > 0 && (
          <View style={ss.overdueBanner}>
            <MaterialIcons name="warning" size={20} color={C.error} />
            <View style={ss.overdueBody}>
              <Text style={ss.overdueTitle}>{overdue.length} Overdue Task{overdue.length > 1 ? "s" : ""}</Text>
              <Text style={ss.overdueDesc}>File immediately to avoid BURS/CIPA penalties.</Text>
            </View>
            <Pressable><Text style={ss.overdueResolve}>Resolve</Text></Pressable>
          </View>
        )}

        {/* Compliance Health Score card */}
        <View style={ss.scoreCard}>
          <Text style={ss.scoreEyebrow}>COMPLIANCE HEALTH SCORE</Text>
          {scoreLoading ? (
            <ActivityIndicator color={C.secondary} style={{ marginVertical: 20 }} />
          ) : (
            <>
              <ScoreGauge score={score} band={band} />
              <Text style={ss.scoreDesc}>
                Your business is mostly compliant. Complete the{" "}
                <Text style={{ fontFamily: "PublicSans_700Bold", color: C.primary }}>
                  {deadlines?.filter(d => d.status !== "complete").length ?? 2} upcoming tasks
                </Text>{" "}
                to reach 100%.
              </Text>
              {/* Category breakdown */}
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

        {/* Filter chips */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={ss.filterRow}>
          {FILTERS.map((f) => (
            <Pressable key={f} style={[ss.filterChip, activeFilter === f && ss.filterChipActive]} onPress={() => setActiveFilter(f)}>
              <Text style={[ss.filterText, activeFilter === f && ss.filterTextActive]}>{f}</Text>
            </Pressable>
          ))}
        </ScrollView>

        {/* Deadlines section */}
        <View style={ss.listHeader}>
          <Text style={ss.listTitle}>Upcoming Deadlines</Text>
          <MaterialIcons name="filter-list" size={20} color={C.muted} />
        </View>

        {dlLoading && <><SkeletonCard /><SkeletonCard /></>}

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
            <MaterialIcons name="check-circle" size={44} color={C.secondary} />
            <Text style={ss.emptyTitle}>All clear</Text>
            <Text style={ss.emptyDesc}>No deadlines found for this category. You're fully compliant.</Text>
          </View>
        )}

        {!dlLoading && deadlines?.map((item) => (
          <DeadlineCard key={item.id} item={item} onMarkComplete={handleMarkComplete} />
        ))}

        {/* Compliance tip */}
        <View style={ss.tipCard}>
          <View style={ss.tipImgWrap}>
            <View style={ss.tipImgPlaceholder} />
          </View>
          <View style={ss.tipBody}>
            <Text style={ss.tipEyebrow}>COMPLIANCE TIP</Text>
            <Text style={ss.tipTitle}>Did you know?</Text>
            <Text style={ss.tipDesc}>Late CIPA filings incur a recurring monthly fee. File early to save BWP 500.</Text>
          </View>
        </View>

        <View style={{ height: 32 }} />
      </ScrollView>

      {/* FAB */}
      <Pressable style={ss.fab}>
        <MaterialIcons name="add" size={26} color="#ffffff" />
      </Pressable>
    </SafeAreaView>
  );
}

const ss = StyleSheet.create({
  safe:          { flex: 1, backgroundColor: C.bg },
  scroll:        { flex: 1 },
  scrollContent: { paddingHorizontal: 16, paddingTop: 8 },

  // Top bar (matches header in HTML, inside safe area)
  topBar:        { flexDirection: "row", justifyContent: "space-between", alignItems: "center", height: 56, paddingHorizontal: 16, backgroundColor: C.container, borderBottomWidth: 1, borderBottomColor: C.border },
  topBarLeft:    { flexDirection: "row", alignItems: "center", gap: 12 },
  appTitle:      { fontSize: 17, fontFamily: "PublicSans_700Bold", color: C.primary },
  avatar:        { width: 38, height: 38, borderRadius: 19, backgroundColor: C.burs, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: C.border },
  avatarText:    { color: "#fff", fontFamily: "PublicSans_700Bold", fontSize: 13 },

  // Overdue banner
  overdueBanner: { flexDirection: "row", alignItems: "flex-start", backgroundColor: C.errorBg, borderRadius: 14, padding: 14, marginTop: 14, marginBottom: 4, gap: 10, borderWidth: 1, borderColor: "#F5C6C2" },
  overdueBody:   { flex: 1 },
  overdueTitle:  { fontSize: 14, fontFamily: "PublicSans_700Bold", color: C.error, marginBottom: 2 },
  overdueDesc:   { fontSize: 12, color: C.error, opacity: 0.85 },
  overdueResolve: { fontSize: 11, fontFamily: "PublicSans_700Bold", color: C.error, textTransform: "uppercase", letterSpacing: 0.5, marginTop: 2 },

  // Score card
  scoreCard:     { backgroundColor: C.surface, borderRadius: 16, padding: 20, marginTop: 14, marginBottom: 4, borderWidth: 1, borderColor: C.border, alignItems: "center", position: "relative", overflow: "hidden" },
  scoreEyebrow:  { fontSize: 10, fontFamily: "PublicSans_600SemiBold", color: C.muted, letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 16 },
  scoreDesc:     { fontSize: 13, fontFamily: "PublicSans_400Regular", color: C.mid, textAlign: "center", maxWidth: 260, lineHeight: 19, marginTop: 8 },
  // Green left border on score card (from HTML)
  scoreCardAccent: { position: "absolute", left: 0, top: 0, bottom: 0, width: 4, backgroundColor: C.secondary },

  // Gauge
  gaugeWrap:     { alignItems: "center", marginBottom: 8 },
  gaugeOuter:    { width: 148, height: 148, borderRadius: 74, borderWidth: 12, alignItems: "center", justifyContent: "center" },
  gaugeInner:    { position: "absolute", width: 120, height: 120, borderRadius: 60, borderWidth: 4 },
  gaugeCenter:   { alignItems: "center" },
  gaugeScore:    { fontSize: 38, fontFamily: "PublicSans_700Bold", lineHeight: 42 },
  gaugeLabel:    { fontSize: 10, fontFamily: "PublicSans_700Bold", letterSpacing: 1.5, marginTop: 2 },

  // Breakdown
  breakdown:     { width: "100%", gap: 8, marginTop: 16 },
  bkRow:         { flexDirection: "row", alignItems: "center", gap: 8 },
  bkDot:         { width: 8, height: 8, borderRadius: 4 },
  bkCat:         { fontSize: 11, fontFamily: "PublicSans_600SemiBold", color: C.primary, width: 52 },
  bkBarWrap:     { flex: 1, height: 5, backgroundColor: C.borderSoft, borderRadius: 3, overflow: "hidden" },
  bkBar:         { height: 5, borderRadius: 3 },
  bkScore:       { fontSize: 11, fontFamily: "PublicSans_700Bold", color: C.muted, width: 26, textAlign: "right" },

  // Filters
  filterRow:     { paddingVertical: 14, gap: 8 },
  filterChip:    { paddingHorizontal: 18, paddingVertical: 8, borderRadius: 999, backgroundColor: C.container, borderWidth: 1, borderColor: C.border },
  filterChipActive: { backgroundColor: C.primary, borderColor: C.primary },
  filterText:    { fontSize: 12, fontFamily: "PublicSans_600SemiBold", color: C.muted },
  filterTextActive: { color: "#fff" },

  // List header
  listHeader:    { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12, paddingHorizontal: 2 },
  listTitle:     { fontSize: 18, fontFamily: "PublicSans_700Bold", color: C.primary },

  // Card
  card:          { backgroundColor: C.surface, borderRadius: 14, marginBottom: 12, flexDirection: "row", borderWidth: 1, borderColor: C.border, overflow: "hidden" },
  cardPressed:   { opacity: 0.84 },
  cardBar:       { width: 4 },
  cardBody:      { flex: 1, padding: 14 },
  cardTop:       { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 },
  chip:          { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6 },
  chipText:      { fontSize: 11, fontFamily: "PublicSans_700Bold", letterSpacing: 0.4 },
  daysText:      { fontSize: 12, fontFamily: "PublicSans_600SemiBold" },
  cardTitle:     { fontSize: 15, fontFamily: "PublicSans_700Bold", color: C.primary, marginBottom: 4, lineHeight: 21 },
  cardPenalty:   { fontSize: 12, color: C.muted, marginBottom: 12 },
  cardActions:   { flexDirection: "row", gap: 8 },
  btnPrimary:    { flex: 1, backgroundColor: C.primary, borderRadius: 10, paddingVertical: 10, alignItems: "center" },
  btnPrimaryText: { color: "#fff", fontSize: 12, fontFamily: "PublicSans_700Bold", letterSpacing: 0.3 },
  btnOutline:    { paddingHorizontal: 12, borderRadius: 10, paddingVertical: 10, borderWidth: 1, borderColor: C.border, alignItems: "center" },
  btnOutlineText: { color: C.primary, fontSize: 12, fontFamily: "PublicSans_600SemiBold" },
  completeRow:   { flexDirection: "row", alignItems: "center" },
  completeText:  { fontSize: 13, color: C.secondary, fontFamily: "PublicSans_600SemiBold" },

  // Skeleton
  skel:          { backgroundColor: C.border, borderRadius: 4 },

  // Error/Empty
  errorBox:      { alignItems: "center", padding: 32 },
  errorText:     { color: C.error, fontSize: 14, marginBottom: 12 },
  retryBtn:      { paddingHorizontal: 20, paddingVertical: 8, backgroundColor: C.primary, borderRadius: 8 },
  retryText:     { color: "#fff", fontFamily: "PublicSans_600SemiBold" },
  emptyBox:      { alignItems: "center", padding: 40 },
  emptyTitle:    { fontSize: 18, fontFamily: "PublicSans_700Bold", color: C.primary, marginTop: 10, marginBottom: 6 },
  emptyDesc:     { fontSize: 13, color: C.muted, textAlign: "center", lineHeight: 19 },

  // Tip card
  tipCard:       { backgroundColor: C.container, borderRadius: 14, padding: 14, flexDirection: "row-reverse", alignItems: "center", gap: 14, borderWidth: 1, borderColor: C.border, marginTop: 4 },
  tipImgWrap:    { width: 80, height: 80, borderRadius: 10, overflow: "hidden" },
  tipImgPlaceholder: { width: "100%", height: "100%", backgroundColor: "#0b2147", borderRadius: 10 },
  tipBody:       { flex: 1 },
  tipEyebrow:    { fontSize: 9, fontFamily: "PublicSans_600SemiBold", color: C.burs, letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 4 },
  tipTitle:      { fontSize: 14, fontFamily: "PublicSans_700Bold", color: C.primary, marginBottom: 4 },
  tipDesc:       { fontSize: 12, color: C.muted, lineHeight: 17 },

  // FAB
  fab:           { position: "absolute", right: 16, bottom: 90, backgroundColor: C.primary, width: 52, height: 52, borderRadius: 14, justifyContent: "center", alignItems: "center", shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 8, elevation: 6 },
});
