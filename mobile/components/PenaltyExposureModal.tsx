// mobile/components/PenaltyExposureModal.tsx
// FE-11: Penalty Exposure modal — per-deadline BWP breakdown

import React from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { usePenaltyExposure } from "@/hooks/usePenaltyExposure";
import type { PenaltyItem } from "@/hooks/usePenaltyExposure";

const C = {
  bg:        "#f3faff",
  surface:   "#ffffff",
  primary:   "#000b25",
  mid:       "#44474e",
  muted:     "#75777f",
  border:    "#c5c6cf",
  borderSoft:"#e6f6ff",
  error:     "#ba1a1a",
  errorBg:   "#ffdad6",
  secondary: "#2a6b2c",
  secondaryBg:"#acf4a4",
  burs:      "#1A3C5E",
  bursBg:    "#EAF0F7",
  cipa:      "#2E6B4F",
  cipaBg:    "#E8F4EE",
  labour:    "#6B3A7D",
  labourBg:  "#F3EEF7",
  custom:    "#7D5A1E",
  customBg:  "#F7F1E8",
  amber:     "#D4830A",
  amberBg:   "#FEF3E2",
};

const CAT_COLOR: Record<string, { bg: string; text: string }> = {
  BURS:   { bg: C.bursBg, text: C.burs },
  CIPA:   { bg: C.cipaBg, text: C.cipa },
  LABOUR: { bg: C.labourBg, text: C.labour },
  CUSTOM: { bg: C.customBg, text: C.custom },
};

function fmt(n: number) {
  return `BWP ${n.toLocaleString("en-BW", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function PenaltyRow({ item, onNavigate }: { item: PenaltyItem; onNavigate: () => void }) {
  const cat = CAT_COLOR[item.category] ?? CAT_COLOR.CUSTOM;
  return (
    <Pressable style={pr.row} onPress={onNavigate}>
      <View style={pr.top}>
        <View style={[pr.chip, { backgroundColor: cat.bg }]}>
          <Text style={[pr.chipText, { color: cat.text }]}>{item.category}</Text>
        </View>
        <Text style={pr.overdue}>
          {item.days_overdue > 0 ? `${item.days_overdue} days overdue` : "Due today"}
        </Text>
      </View>
      <Text style={pr.name} numberOfLines={2}>{item.name}</Text>
      <View style={pr.amounts}>
        {item.fixed_penalty > 0 && (
          <View style={pr.amountRow}>
            <Text style={pr.amountLabel}>Fixed penalty</Text>
            <Text style={pr.amountValue}>{fmt(item.fixed_penalty)}</Text>
          </View>
        )}
        {item.interest_penalty > 0 && (
          <View style={pr.amountRow}>
            <Text style={pr.amountLabel}>Interest (1.5%/month)</Text>
            <Text style={pr.amountValue}>{fmt(item.interest_penalty)}</Text>
          </View>
        )}
        <View style={[pr.amountRow, pr.totalRow]}>
          <Text style={pr.totalLabel}>Total exposure</Text>
          <Text style={pr.totalValue}>{fmt(item.total_penalty_bwp)}</Text>
        </View>
      </View>
      <View style={pr.viewRow}>
        <Text style={pr.viewText}>View deadline</Text>
        <MaterialIcons name="arrow-forward" size={14} color={C.burs} />
      </View>
    </Pressable>
  );
}

const pr = StyleSheet.create({
  row:        { backgroundColor: "#fff", borderRadius: 12, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: C.border },
  top:        { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 6 },
  chip:       { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  chipText:   { fontSize: 10, fontFamily: "PublicSans_700Bold", letterSpacing: 0.4 },
  overdue:    { fontSize: 11, fontFamily: "PublicSans_600SemiBold", color: C.error },
  name:       { fontSize: 14, fontFamily: "PublicSans_700Bold", color: C.primary, marginBottom: 10, lineHeight: 20 },
  amounts:    { gap: 4, borderTopWidth: 1, borderTopColor: C.borderSoft, paddingTop: 10 },
  amountRow:  { flexDirection: "row", justifyContent: "space-between" },
  amountLabel:{ fontSize: 12, color: C.muted, fontFamily: "PublicSans_400Regular" },
  amountValue:{ fontSize: 12, color: C.mid, fontFamily: "PublicSans_600SemiBold" },
  totalRow:   { marginTop: 4, paddingTop: 4, borderTopWidth: 1, borderTopColor: C.borderSoft },
  totalLabel: { fontSize: 13, fontFamily: "PublicSans_700Bold", color: C.primary },
  totalValue: { fontSize: 13, fontFamily: "PublicSans_700Bold", color: C.error },
  viewRow:    { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 8 },
  viewText:   { fontSize: 11, fontFamily: "PublicSans_600SemiBold", color: C.burs },
});

interface PenaltyExposureModalProps {
  visible: boolean;
  onClose: () => void;
}

export function PenaltyExposureModal({ visible, onClose }: PenaltyExposureModalProps) {
  const router = useRouter();
  const { data, isLoading } = usePenaltyExposure();

  const total = data?.total_exposure_bwp ?? 0;
  const breakdown = data?.breakdown ?? [];
  const isClean = !isLoading && total === 0;

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={m.safe}>
        {/* Header */}
        <View style={m.header}>
          <View>
            <Text style={m.eyebrow}>PENALTY EXPOSURE</Text>
            <Text style={m.title}>
              {isLoading ? "Calculating…" : isClean ? "No exposure" : fmt(total)}
            </Text>
          </View>
          <Pressable onPress={onClose} style={m.closeBtn}>
            <MaterialIcons name="close" size={22} color={C.primary} />
          </Pressable>
        </View>

        {/* Total exposure banner */}
        {!isLoading && !isClean && (
          <View style={m.banner}>
            <MaterialIcons name="warning" size={18} color={C.error} />
            <Text style={m.bannerText}>
              Filing today stops further penalties. Calculated per BURS published schedule.
            </Text>
          </View>
        )}

        {/* Body */}
        {isLoading ? (
          <ActivityIndicator color={C.burs} style={{ marginTop: 48 }} />
        ) : isClean ? (
          <View style={m.clean}>
            <MaterialIcons name="check-circle" size={56} color={C.secondary} />
            <Text style={m.cleanTitle}>No penalty exposure</Text>
            <Text style={m.cleanDesc}>All deadlines are current. Well done!</Text>
          </View>
        ) : (
          <ScrollView style={m.scroll} contentContainerStyle={m.scrollContent} showsVerticalScrollIndicator={false}>
            <Text style={m.sectionLabel}>{breakdown.length} deadline{breakdown.length !== 1 ? "s" : ""} with penalties</Text>
            {breakdown.map((item) => (
              <PenaltyRow
                key={item.deadline_id}
                item={item}
                onNavigate={() => {
                  onClose();
                  router.push(`/deadline/${item.deadline_id}` as any);
                }}
              />
            ))}
            {/* Formula note */}
            <View style={m.formula}>
              <MaterialIcons name="info-outline" size={14} color={C.muted} />
              <Text style={m.formulaText}>
                Penalty = Fixed amount + (Outstanding balance × 1.5% × months overdue). Based on BURS published penalty schedule. Figures are indicative.
              </Text>
            </View>
            <View style={{ height: 32 }} />
          </ScrollView>
        )}
      </View>
    </Modal>
  );
}

const m = StyleSheet.create({
  safe:         { flex: 1, backgroundColor: C.bg },
  header:       { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", paddingHorizontal: 20, paddingTop: 20, paddingBottom: 16, backgroundColor: C.errorBg, borderBottomWidth: 1, borderBottomColor: "#F5C6C2" },
  eyebrow:      { fontSize: 10, fontFamily: "PublicSans_700Bold", color: C.error, letterSpacing: 1.4, textTransform: "uppercase", marginBottom: 4 },
  title:        { fontSize: 28, fontFamily: "PublicSans_700Bold", color: C.error },
  closeBtn:     { padding: 4 },
  banner:       { flexDirection: "row", alignItems: "flex-start", gap: 8, backgroundColor: C.errorBg, paddingHorizontal: 20, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: "#F5C6C2" },
  bannerText:   { flex: 1, fontSize: 12, color: C.error, lineHeight: 17 },
  scroll:       { flex: 1 },
  scrollContent:{ paddingHorizontal: 16, paddingTop: 16 },
  sectionLabel: { fontSize: 11, fontFamily: "PublicSans_600SemiBold", color: C.muted, textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 12 },
  clean:        { flex: 1, alignItems: "center", justifyContent: "center", paddingBottom: 60 },
  cleanTitle:   { fontSize: 20, fontFamily: "PublicSans_700Bold", color: C.primary, marginTop: 14, marginBottom: 6 },
  cleanDesc:    { fontSize: 13, color: C.muted, textAlign: "center" },
  formula:      { flexDirection: "row", alignItems: "flex-start", gap: 6, backgroundColor: C.surface, borderRadius: 10, padding: 12, borderWidth: 1, borderColor: C.border, marginTop: 4 },
  formulaText:  { flex: 1, fontSize: 11, color: C.muted, lineHeight: 16 },
});