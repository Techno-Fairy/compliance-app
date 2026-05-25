// mobile/app/history.tsx
// FE-12: Filing History / Audit Trail screen

import React, { useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { MaterialIcons } from "@expo/vector-icons";
import { useRouter, useLocalSearchParams } from "expo-router";
import { format, parseISO } from "date-fns";
import { useFilingHistory } from "@/hooks/useFilingHistory";
import type { HistoryEntry } from "@/hooks/useFilingHistory";

const C = {
  bg:        "#f3faff",
  surface:   "#ffffff",
  primary:   "#000b25",
  mid:       "#44474e",
  muted:     "#75777f",
  border:    "#c5c6cf",
  borderSoft:"#e6f6ff",
  container: "#dbf1fe",
  error:     "#ba1a1a",
  errorBg:   "#ffdad6",
  secondary: "#2a6b2c",
  secondaryBg:"#acf4a4",
  amber:     "#D4830A",
  amberBg:   "#FEF3E2",
  burs:      "#1A3C5E",
  bursBg:    "#EAF0F7",
};

const ACTION_DISPLAY: Record<string, { icon: string; label: string; color: string; bg: string }> = {
  status_updated:  { icon: "check-circle",    label: "Status updated",     color: C.secondary, bg: C.secondaryBg },
  deadline_complete:{ icon: "verified",        label: "Deadline completed", color: C.secondary, bg: C.secondaryBg },
  deadline_missed: { icon: "cancel",           label: "Deadline missed",    color: C.error,     bg: C.errorBg },
  document_upload: { icon: "cloud-upload",     label: "Document uploaded",  color: C.burs,      bg: C.bursBg },
  document_delete: { icon: "delete-outline",   label: "Document deleted",   color: C.amber,     bg: C.amberBg },
  checklist_update:{ icon: "checklist",        label: "Checklist updated",  color: C.mid,       bg: C.borderSoft },
  custom_created:  { icon: "add-task",         label: "Custom task created",color: C.burs,      bg: C.bursBg },
  custom_deleted:  { icon: "remove-circle",    label: "Custom task deleted",color: C.error,     bg: C.errorBg },
};

function getAction(type: string) {
  return ACTION_DISPLAY[type] ?? { icon: "history", label: type.replace(/_/g, " "), color: C.muted, bg: C.borderSoft };
}

function HistoryItem({ entry }: { entry: HistoryEntry }) {
  const action = getAction(entry.action_type);
  return (
    <View style={hi.row}>
      {/* Timeline line */}
      <View style={hi.timeline}>
        <View style={[hi.dot, { backgroundColor: action.bg, borderColor: action.color }]}>
          <MaterialIcons name={action.icon as any} size={14} color={action.color} />
        </View>
        <View style={hi.line} />
      </View>
      {/* Content */}
      <View style={hi.content}>
        <Text style={hi.actionLabel}>{action.label}</Text>
        {entry.deadline_name && (
          <Text style={hi.deadlineName} numberOfLines={2}>{entry.deadline_name}</Text>
        )}
        {entry.document_filename && (
          <View style={hi.fileRow}>
            <MaterialIcons name="attach-file" size={12} color={C.muted} />
            <Text style={hi.filename} numberOfLines={1}>{entry.document_filename}</Text>
          </View>
        )}
        {entry.notes && <Text style={hi.notes} numberOfLines={2}>{entry.notes}</Text>}
        <View style={hi.meta}>
          <Text style={hi.timestamp}>
            {format(parseISO(entry.created_at), "d MMM yyyy, HH:mm")}
          </Text>
          {entry.user_email && (
            <>
              <Text style={hi.metaDot}>·</Text>
              <Text style={hi.user} numberOfLines={1}>{entry.user_email}</Text>
            </>
          )}
        </View>
      </View>
    </View>
  );
}

const hi = StyleSheet.create({
  row:          { flexDirection: "row", gap: 12, paddingBottom: 4 },
  timeline:     { alignItems: "center", width: 32 },
  dot:          { width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center", borderWidth: 1, zIndex: 1 },
  line:         { flex: 1, width: 1, backgroundColor: C.border, marginTop: 2 },
  content:      { flex: 1, backgroundColor: C.surface, borderRadius: 12, padding: 12, marginBottom: 10, borderWidth: 1, borderColor: C.border },
  actionLabel:  { fontSize: 11, fontFamily: "PublicSans_700Bold", color: C.muted, textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 3 },
  deadlineName: { fontSize: 14, fontFamily: "PublicSans_700Bold", color: C.primary, marginBottom: 3, lineHeight: 19 },
  fileRow:      { flexDirection: "row", alignItems: "center", gap: 3, marginBottom: 3 },
  filename:     { fontSize: 11, color: C.burs, fontFamily: "PublicSans_400Regular", flex: 1 },
  notes:        { fontSize: 12, color: C.mid, lineHeight: 17, marginBottom: 3 },
  meta:         { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 4 },
  timestamp:    { fontSize: 10, color: C.muted, fontFamily: "PublicSans_400Regular" },
  metaDot:      { fontSize: 10, color: C.muted },
  user:         { fontSize: 10, color: C.muted, fontFamily: "PublicSans_400Regular", flex: 1 },
});

export default function FilingHistoryScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ deadline_id?: string }>();
  const deadlineId = params.deadline_id ? Number(params.deadline_id) : undefined;

  const { data: history, isLoading, isError, refetch } = useFilingHistory(deadlineId);

  const grouped = React.useMemo(() => {
    if (!history) return [];
    const map = new Map<string, HistoryEntry[]>();
    for (const entry of history) {
      const day = format(parseISO(entry.created_at), "MMMM d, yyyy");
      if (!map.has(day)) map.set(day, []);
      map.get(day)!.push(entry);
    }
    return Array.from(map.entries());
  }, [history]);

  return (
    <SafeAreaView style={s.safe} edges={["top"]}>
      <View style={s.header}>
        <Pressable onPress={() => router.back()} style={s.backBtn}>
          <MaterialIcons name="arrow-back" size={22} color={C.primary} />
        </Pressable>
        <View style={s.headerCenter}>
          <Text style={s.title}>Filing History</Text>
          {deadlineId && <Text style={s.subtitle}>Filtered by deadline</Text>}
        </View>
        {/* Export button (wired to API in Week 4) */}
        <Pressable style={s.exportBtn}>
          <MaterialIcons name="ios-share" size={20} color={C.burs} />
        </Pressable>
      </View>

      {isLoading && <ActivityIndicator color={C.burs} style={{ marginTop: 48 }} />}

      {isError && (
        <View style={s.emptyBox}>
          <MaterialIcons name="error-outline" size={40} color={C.error} />
          <Text style={s.emptyTitle}>Could not load history</Text>
          <Pressable style={s.retryBtn} onPress={() => refetch()}>
            <Text style={s.retryText}>Retry</Text>
          </Pressable>
        </View>
      )}

      {!isLoading && !isError && grouped.length === 0 && (
        <View style={s.emptyBox}>
          <MaterialIcons name="history" size={52} color={C.border} />
          <Text style={s.emptyTitle}>No filing history yet</Text>
          <Text style={s.emptyDesc}>
            Complete your first deadline to start your audit trail.
          </Text>
        </View>
      )}

      {!isLoading && grouped.length > 0 && (
        <ScrollView style={s.scroll} contentContainerStyle={s.scrollContent} showsVerticalScrollIndicator={false}>
          {grouped.map(([day, entries]) => (
            <View key={day}>
              <Text style={s.dayLabel}>{day}</Text>
              {entries.map((e) => <HistoryItem key={e.id} entry={e} />)}
            </View>
          ))}
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