// mobile/app/history.tsx
// FE-12: Filing History / Audit Trail screen
//
// Reached from:
//   - Settings tab → Filing History (no filter)
//   - Deadline Detail → Filing History link (filtered by deadline_id param)
//
// Export button calls POST /reports/history to generate a PDF audit trail.

import React from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { MaterialIcons } from "@expo/vector-icons";
import { useRouter, useLocalSearchParams } from "expo-router";
import { format, parseISO } from "date-fns";
import { useFilingHistory } from "@/hooks/useFilingHistory";
import { api } from "@/lib/api";
import type { FilingHistoryEntry } from "@/types";

export type HistoryEntry = FilingHistoryEntry;

const C = {
  bg:         "#f3faff",
  surface:    "#ffffff",
  primary:    "#000b25",
  mid:        "#44474e",
  muted:      "#75777f",
  border:     "#c5c6cf",
  borderSoft: "#e6f6ff",
  container:  "#dbf1fe",
  error:      "#ba1a1a",
  errorBg:    "#ffdad6",
  secondary:  "#2a6b2c",
  secondaryBg:"#acf4a4",
  amber:      "#D4830A",
  amberBg:    "#FEF3E2",
  burs:       "#1A3C5E",
  bursBg:     "#EAF0F7",
};

const ACTION_DISPLAY: Record<string, { icon: string; label: string; color: string; bg: string }> = {
  status_updated:   { icon: "check-circle",  label: "Status updated",      color: C.secondary, bg: C.secondaryBg },
  deadline_complete:{ icon: "verified",       label: "Deadline completed",  color: C.secondary, bg: C.secondaryBg },
  deadline_missed:  { icon: "cancel",         label: "Deadline missed",     color: C.error,     bg: C.errorBg     },
  document_upload:  { icon: "cloud-upload",   label: "Document uploaded",   color: C.burs,      bg: C.bursBg      },
  document_delete:  { icon: "delete-outline", label: "Document deleted",    color: C.amber,     bg: C.amberBg     },
  checklist_update: { icon: "checklist",      label: "Checklist updated",   color: C.mid,       bg: C.borderSoft  },
  custom_created:   { icon: "add-task",       label: "Custom task created", color: C.burs,      bg: C.bursBg      },
  custom_deleted:   { icon: "remove-circle",  label: "Custom task deleted", color: C.error,     bg: C.errorBg     },
};

function getAction(type: string) {
  return (
    ACTION_DISPLAY[type] ?? {
      icon: "history",
      label: type.replace(/_/g, " "),
      color: C.muted,
      bg: C.borderSoft,
    }
  );
}

// ── Single history item ────────────────────────────────────────────────────────
function HistoryItem({ entry }: { entry: HistoryEntry }) {
  const action = getAction(entry.action);
  return (
    <View style={hi.row}>
      {/* Timeline */}
      <View style={hi.timeline}>
        <View style={[hi.dot, { backgroundColor: action.bg, borderColor: action.color }]}>
          <MaterialIcons name={action.icon as any} size={14} color={action.color} />
        </View>
        <View style={hi.line} />
      </View>

      {/* Content card */}
      <View style={hi.content}>
        <Text style={hi.actionLabel}>{action.label}</Text>

        {/* Deadline name (joined field — present when API returns it) */}
        {entry.deadline_name && (
          <Text style={hi.deadlineName} numberOfLines={2}>{entry.deadline_name}</Text>
        )}

        {/* Core description — always present */}
        {entry.description ? (
          <Text style={hi.description} numberOfLines={3}>{entry.description}</Text>
        ) : null}

        {/* Attached document filename (joined field) */}
        {entry.document_filename && (
          <View style={hi.fileRow}>
            <MaterialIcons name="attach-file" size={12} color={C.muted} />
            <Text style={hi.filename} numberOfLines={1}>{entry.document_filename}</Text>
          </View>
        )}

        {/* Extra notes (joined field) */}
        {entry.notes && (
          <Text style={hi.notes} numberOfLines={2}>{entry.notes}</Text>
        )}

        {/* Meta row: timestamp · user */}
        <View style={hi.meta}>
          <Text style={hi.timestamp}>
            {format(parseISO(entry.created_at), "d MMM yyyy, HH:mm")}
          </Text>
          {/* performed_by is the canonical field from the DB */}
          {(entry.user_email ?? entry.performed_by) && (
            <>
              <Text style={hi.metaDot}>·</Text>
              <Text style={hi.user} numberOfLines={1}>
                {entry.user_email ?? entry.performed_by}
              </Text>
            </>
          )}
        </View>
      </View>
    </View>
  );
}

const hi = StyleSheet.create({
  row:         { flexDirection: "row", gap: 12, paddingBottom: 4 },
  timeline:    { alignItems: "center", width: 32 },
  dot:         { width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center", borderWidth: 1, zIndex: 1 },
  line:        { flex: 1, width: 1, backgroundColor: C.border, marginTop: 2 },
  content:     { flex: 1, backgroundColor: C.surface, borderRadius: 12, padding: 12, marginBottom: 10, borderWidth: 1, borderColor: C.border },
  actionLabel: { fontSize: 11, fontFamily: "PublicSans_700Bold", color: C.muted, textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 3 },
  deadlineName:{ fontSize: 14, fontFamily: "PublicSans_700Bold", color: C.primary, marginBottom: 3, lineHeight: 19 },
  description: { fontSize: 13, color: C.mid, lineHeight: 18, marginBottom: 3 },
  fileRow:     { flexDirection: "row", alignItems: "center", gap: 3, marginBottom: 3 },
  filename:    { fontSize: 11, color: C.burs, fontFamily: "PublicSans_400Regular", flex: 1 },
  notes:       { fontSize: 12, color: C.mid, lineHeight: 17, marginBottom: 3, fontStyle: "italic" },
  meta:        { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 4 },
  timestamp:   { fontSize: 10, color: C.muted, fontFamily: "PublicSans_400Regular" },
  metaDot:     { fontSize: 10, color: C.muted },
  user:        { fontSize: 10, color: C.muted, fontFamily: "PublicSans_400Regular", flex: 1 },
});

// ── Screen ────────────────────────────────────────────────────────────────────
export default function FilingHistoryScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ deadline_id?: string }>();
  const deadlineId = params.deadline_id ? Number(params.deadline_id) : undefined;

  const { data: history, isLoading, isError, refetch } = useFilingHistory(deadlineId);

  // ── Group entries by calendar day ─────────────────────────────────────────
  const grouped = React.useMemo(() => {
    if (!history?.length) return [];
    const map = new Map<string, HistoryEntry[]>();
    for (const entry of history) {
      const day = format(parseISO(entry.created_at), "MMMM d, yyyy");
      if (!map.has(day)) map.set(day, []);
      map.get(day)!.push(entry);
    }
    return Array.from(map.entries());
  }, [history]);

  // ── Export handler ─────────────────────────────────────────────────────────
  const [exporting, setExporting] = React.useState(false);

  const handleExport = async () => {
    setExporting(true);
    try {
      const params: Record<string, number> = {};
      if (deadlineId) params.deadline_id = deadlineId;
      const { data } = await api.post<{ download_url: string }>("/reports/history", params);
      await Share.share({
        title: "Compliance Audit Trail",
        message: data.download_url,
        url: data.download_url,
      });
    } catch {
      Alert.alert(
        "Export unavailable",
        "PDF export will be available once the reports API is live. Your audit trail is safely stored."
      );
    } finally {
      setExporting(false);
    }
  };

  return (
    <SafeAreaView style={s.safe} edges={["top"]}>
      {/* Header */}
      <View style={s.header}>
        <Pressable onPress={() => router.back()} style={s.backBtn}>
          <MaterialIcons name="arrow-back" size={22} color={C.primary} />
        </Pressable>
        <View style={s.headerCenter}>
          <Text style={s.title}>Filing History</Text>
          {deadlineId && <Text style={s.subtitle}>Filtered by deadline</Text>}
        </View>
        {/* Export — wired to POST /reports/history */}
        <Pressable
          style={s.exportBtn}
          onPress={handleExport}
          disabled={exporting || !history?.length}
        >
          {exporting
            ? <ActivityIndicator size="small" color={C.burs} />
            : <MaterialIcons name="ios-share" size={20} color={history?.length ? C.burs : C.border} />
          }
        </Pressable>
      </View>

      {/* Loading */}
      {isLoading && (
        <ActivityIndicator color={C.burs} style={{ marginTop: 48 }} />
      )}

      {/* Error */}
      {isError && (
        <View style={s.emptyBox}>
          <MaterialIcons name="error-outline" size={40} color={C.error} />
          <Text style={s.emptyTitle}>Could not load history</Text>
          <Text style={s.emptyDesc}>Check your connection and try again.</Text>
          <Pressable style={s.retryBtn} onPress={() => refetch()}>
            <Text style={s.retryText}>Retry</Text>
          </Pressable>
        </View>
      )}

      {/* Empty state */}
      {!isLoading && !isError && grouped.length === 0 && (
        <View style={s.emptyBox}>
          <MaterialIcons name="history" size={52} color={C.border} />
          <Text style={s.emptyTitle}>No filing history yet</Text>
          <Text style={s.emptyDesc}>
            Complete your first deadline to start your audit trail.
          </Text>
        </View>
      )}

      {/* Timeline list */}
      {!isLoading && !isError && grouped.length > 0 && (
        <ScrollView
          style={s.scroll}
          contentContainerStyle={s.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {grouped.map(([day, entries]) => (
            <View key={day}>
              <Text style={s.dayLabel}>{day}</Text>
              {entries.map((e) => (
                <HistoryItem key={e.id} entry={e} />
              ))}
            </View>
          ))}

          {/* Audit trail notice */}
          <View style={s.note}>
            <MaterialIcons name="lock-outline" size={13} color={C.muted} />
            <Text style={s.noteText}>
              This audit trail is tamper-evident and can be exported as a PDF for BURS inspections.
            </Text>
          </View>
          <View style={{ height: 40 }} />
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:         { flex: 1, backgroundColor: C.bg },
  header:       { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, height: 56, backgroundColor: C.container, borderBottomWidth: 1, borderBottomColor: C.border },
  backBtn:      { width: 38, height: 38, alignItems: "center", justifyContent: "center" },
  headerCenter: { flex: 1, alignItems: "center" },
  title:        { fontSize: 16, fontFamily: "PublicSans_700Bold", color: C.primary },
  subtitle:     { fontSize: 10, color: C.muted, fontFamily: "PublicSans_400Regular", marginTop: 1 },
  exportBtn:    { width: 38, height: 38, alignItems: "center", justifyContent: "center" },
  scroll:       { flex: 1 },
  scrollContent:{ paddingHorizontal: 16, paddingTop: 16 },
  dayLabel:     { fontSize: 12, fontFamily: "PublicSans_700Bold", color: C.muted, textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 10, marginTop: 8 },
  emptyBox:     { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 32, paddingBottom: 60 },
  emptyTitle:   { fontSize: 17, fontFamily: "PublicSans_700Bold", color: C.primary, marginTop: 12, marginBottom: 6 },
  emptyDesc:    { fontSize: 13, color: C.muted, textAlign: "center", lineHeight: 19 },
  retryBtn:     { marginTop: 14, paddingHorizontal: 24, paddingVertical: 10, backgroundColor: C.primary, borderRadius: 8 },
  retryText:    { color: "#fff", fontFamily: "PublicSans_600SemiBold" },
  note:         { flexDirection: "row", alignItems: "flex-start", gap: 6, backgroundColor: C.surface, borderRadius: 10, padding: 12, borderWidth: 1, borderColor: C.border, marginTop: 8 },
  noteText:     { flex: 1, fontSize: 11, color: C.muted, lineHeight: 16 },
});