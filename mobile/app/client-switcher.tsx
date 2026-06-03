// mobile/app/client-switcher.tsx
// FE-19: Client switcher UI for Accountant / Admin role
// Accessible from the TopBar avatar menu when role !== "business_owner"

import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { MaterialIcons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useAccessibleBusinesses, useSwitchBusiness, type AccessibleBusiness } from "@/hooks/useBusinesses";

const C = {
  bg:           "#f3faff",
  surface:      "#ffffff",
  primary:      "#000b25",
  mid:          "#44474e",
  muted:        "#75777f",
  border:       "#c5c6cf",
  borderSoft:   "#e6f6ff",
  container:    "#dbf1fe",
  containerLow: "#e6f6ff",
  secondary:    "#2a6b2c",
  secondaryBg:  "#acf4a4",
  secondaryText:"#307231",
  error:        "#ba1a1a",
  errorBg:      "#ffdad6",
  amber:        "#D4830A",
  amberBg:      "#FEF3E2",
  burs:         "#1A3C5E",
  bursBg:       "#EAF0F7",
};

function bandColor(band?: string) {
  if (band === "green")  return { bg: C.secondaryBg, text: C.secondaryText, icon: "check-circle"  as const };
  if (band === "amber")  return { bg: C.amberBg,     text: C.amber,         icon: "warning"        as const };
  if (band === "red")    return { bg: C.errorBg,     text: C.error,         icon: "error"          as const };
  return                        { bg: C.containerLow, text: C.muted,         icon: "radio-button-unchecked" as const };
}

function companyTypeLabel(t: string) {
  const map: Record<string, string> = {
    sole_trader: "Sole Trader", pty_ltd: "Pty Ltd",
    partnership: "Partnership", ngo: "NGO",
  };
  return map[t] ?? t;
}

// ── Business card ─────────────────────────────────────────────────────────────
function BusinessCard({
  biz,
  onSwitch,
  switching,
}: {
  biz: AccessibleBusiness;
  onSwitch: () => void;
  switching: boolean;
}) {
  const bc = bandColor(biz.health_band);

  return (
    <Pressable
      style={({ pressed }) => [s.bizCard, pressed && { opacity: 0.82 }]}
      onPress={onSwitch}
      disabled={switching}
    >
      {/* Left bar — health colour */}
      <View style={[s.bizBar, { backgroundColor: bc.text }]} />

      {/* Avatar */}
      <View style={[s.bizAvatar, { backgroundColor: bc.bg }]}>
        <Text style={[s.bizAvatarText, { color: bc.text }]}>
          {biz.business_name.slice(0, 2).toUpperCase()}
        </Text>
      </View>

      {/* Info */}
      <View style={s.bizInfo}>
        <Text style={s.bizName} numberOfLines={1}>{biz.business_name}</Text>
        <Text style={s.bizMeta}>
          {companyTypeLabel(biz.company_type)}{"  ·  "}{biz.owner_name}
        </Text>
        <View style={s.bizBadgeRow}>
          {biz.health_score !== undefined && (
            <View style={[s.bizBadge, { backgroundColor: bc.bg }]}>
              <MaterialIcons name={bc.icon} size={11} color={bc.text} />
              <Text style={[s.bizBadgeText, { color: bc.text }]}>{biz.health_score}%</Text>
            </View>
          )}
          {(biz.overdue_count ?? 0) > 0 && (
            <View style={[s.bizBadge, { backgroundColor: C.errorBg }]}>
              <MaterialIcons name="warning" size={11} color={C.error} />
              <Text style={[s.bizBadgeText, { color: C.error }]}>{biz.overdue_count} overdue</Text>
            </View>
          )}
        </View>
      </View>

      {/* CTA */}
      {switching ? (
        <ActivityIndicator size="small" color={C.burs} style={{ marginRight: 4 }} />
      ) : (
        <View style={s.switchBtn}>
          <Text style={s.switchBtnText}>Switch</Text>
          <MaterialIcons name="arrow-forward" size={14} color={C.burs} />
        </View>
      )}
    </Pressable>
  );
}

// ── Screen ────────────────────────────────────────────────────────────────────
export default function ClientSwitcherScreen() {
  const [search,       setSearch]       = useState("");
  const [switchingId,  setSwitchingId]  = useState<number | null>(null);
  const [refreshing,   setRefreshing]   = useState(false);

  const { data: businesses, isLoading, isError, refetch } = useAccessibleBusinesses();
  const { mutateAsync: switchBusiness } = useSwitchBusiness();

  const filtered = (businesses ?? []).filter((b) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      b.business_name.toLowerCase().includes(q) ||
      b.owner_name.toLowerCase().includes(q) ||
      b.owner_email.toLowerCase().includes(q)
    );
  });

  const handleSwitch = async (biz: AccessibleBusiness) => {
    setSwitchingId(biz.id);
    try {
      await switchBusiness(biz.id);
      Alert.alert(
        "Switched",
        `You are now viewing ${biz.business_name}.`,
        [{ text: "OK", onPress: () => router.replace("/(tabs)") }]
      );
    } catch {
      Alert.alert("Error", "Could not switch business. Please try again.");
    } finally {
      setSwitchingId(null);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  return (
    <SafeAreaView style={s.safe} edges={["top"]}>
      {/* Header */}
      <View style={s.header}>
        <Pressable onPress={() => router.back()} style={s.backBtn} hitSlop={8}>
          <MaterialIcons name="arrow-back" size={22} color={C.primary} />
        </Pressable>
        <View style={s.headerCenter}>
          <Text style={s.headerTitle}>Switch Client</Text>
          <Text style={s.headerSub}>Select a business to view</Text>
        </View>
        <View style={{ width: 38 }} />
      </View>

      {/* Search */}
      <View style={s.searchSection}>
        <View style={s.searchWrap}>
          <MaterialIcons name="search" size={19} color={C.muted} />
          <TextInput
            style={s.searchInput}
            placeholder="Search by business or owner…"
            placeholderTextColor={C.muted}
            value={search}
            onChangeText={setSearch}
          />
          {search.length > 0 && (
            <Pressable onPress={() => setSearch("")} hitSlop={8}>
              <MaterialIcons name="close" size={17} color={C.muted} />
            </Pressable>
          )}
        </View>
        {!isLoading && (
          <View style={s.countRow}>
            <MaterialIcons name="business" size={14} color={C.muted} />
            <Text style={s.countText}>
              {filtered.length} {filtered.length === 1 ? "client" : "clients"}
              {search ? " found" : " accessible"}
            </Text>
          </View>
        )}
      </View>

      {/* Loading */}
      {isLoading && (
        <View style={s.centred}>
          <ActivityIndicator size="large" color={C.burs} />
          <Text style={s.loadingText}>Loading clients…</Text>
        </View>
      )}

      {/* Error */}
      {isError && (
        <View style={s.centred}>
          <MaterialIcons name="cloud-off" size={44} color={C.error} />
          <Text style={s.errorTitle}>Could not load clients</Text>
          <Pressable style={s.retryBtn} onPress={() => refetch()}>
            <Text style={s.retryText}>Retry</Text>
          </Pressable>
        </View>
      )}

      {/* List */}
      {!isLoading && !isError && (
        <ScrollView
          style={s.scroll}
          contentContainerStyle={s.scrollContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.burs} />
          }
        >
          {filtered.length === 0 ? (
            <View style={s.emptyBox}>
              <MaterialIcons name="search-off" size={44} color={C.border} />
              <Text style={s.emptyTitle}>{search ? "No results" : "No clients yet"}</Text>
              <Text style={s.emptyDesc}>
                {search
                  ? `No businesses matched "${search}".`
                  : "No client businesses have been assigned to your account."}
              </Text>
            </View>
          ) : (
            <>
              {/* Health summary strip */}
              <View style={s.summaryRow}>
                {["green","amber","red"].map((band) => {
                  const count = (businesses ?? []).filter((b) => b.health_band === band).length;
                  const bc = bandColor(band);
                  return (
                    <View key={band} style={[s.summaryChip, { backgroundColor: bc.bg }]}>
                      <MaterialIcons name={bc.icon} size={13} color={bc.text} />
                      <Text style={[s.summaryText, { color: bc.text }]}>{count}</Text>
                    </View>
                  );
                })}
              </View>

              {filtered.map((biz) => (
                <BusinessCard
                  key={biz.id}
                  biz={biz}
                  onSwitch={() => handleSwitch(biz)}
                  switching={switchingId === biz.id}
                />
              ))}
            </>
          )}
          <View style={{ height: 40 }} />
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:        { flex: 1, backgroundColor: C.bg },
  header:      { flexDirection: "row", alignItems: "center", justifyContent: "space-between", height: 64, paddingHorizontal: 16, backgroundColor: C.container, borderBottomWidth: 1, borderBottomColor: C.border },
  backBtn:     { width: 38, height: 38, alignItems: "center", justifyContent: "center" },
  headerCenter:{ flex: 1, alignItems: "center" },
  headerTitle: { fontSize: 16, fontFamily: "PublicSans_700Bold", color: C.primary },
  headerSub:   { fontSize: 11, fontFamily: "PublicSans_400Regular", color: C.muted, marginTop: 1 },

  searchSection: { paddingHorizontal: 16, paddingTop: 14, paddingBottom: 4 },
  searchWrap:  { flexDirection: "row", alignItems: "center", backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, borderRadius: 12, height: 46, paddingHorizontal: 14, gap: 10 },
  searchInput: { flex: 1, fontSize: 14, fontFamily: "PublicSans_400Regular", color: C.primary },
  countRow:    { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 4, marginTop: 8, marginBottom: 2 },
  countText:   { fontSize: 12, fontFamily: "PublicSans_400Regular", color: C.muted },

  centred:     { flex: 1, alignItems: "center", justifyContent: "center", gap: 12, padding: 32 },
  loadingText: { fontSize: 14, color: C.muted, fontFamily: "PublicSans_400Regular" },
  errorTitle:  { fontSize: 16, fontFamily: "PublicSans_700Bold", color: C.primary },
  retryBtn:    { paddingHorizontal: 22, paddingVertical: 10, backgroundColor: C.primary, borderRadius: 10 },
  retryText:   { color: "#fff", fontFamily: "PublicSans_600SemiBold", fontSize: 13 },

  scroll:      { flex: 1 },
  scrollContent:{ paddingHorizontal: 16, paddingTop: 12 },

  summaryRow:  { flexDirection: "row", gap: 8, marginBottom: 14 },
  summaryChip: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999 },
  summaryText: { fontSize: 12, fontFamily: "PublicSans_700Bold" },

  bizCard:     { flexDirection: "row", alignItems: "center", backgroundColor: C.surface, borderRadius: 14, borderWidth: 1, borderColor: C.border, marginBottom: 10, overflow: "hidden", gap: 12 },
  bizBar:      { width: 4, alignSelf: "stretch" },
  bizAvatar:   { width: 44, height: 44, borderRadius: 11, alignItems: "center", justifyContent: "center", marginLeft: 4 },
  bizAvatarText:{ fontSize: 15, fontFamily: "PublicSans_700Bold" },
  bizInfo:     { flex: 1, paddingVertical: 14 },
  bizName:     { fontSize: 14, fontFamily: "PublicSans_700Bold", color: C.primary, marginBottom: 2 },
  bizMeta:     { fontSize: 11, fontFamily: "PublicSans_400Regular", color: C.muted, marginBottom: 6 },
  bizBadgeRow: { flexDirection: "row", gap: 6, flexWrap: "wrap" },
  bizBadge:    { flexDirection: "row", alignItems: "center", gap: 3, paddingHorizontal: 7, paddingVertical: 3, borderRadius: 5 },
  bizBadgeText:{ fontSize: 10, fontFamily: "PublicSans_700Bold" },
  switchBtn:   { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 14, paddingVertical: 10, marginRight: 12, borderRadius: 9, borderWidth: 1, borderColor: C.border },
  switchBtnText:{ fontSize: 12, fontFamily: "PublicSans_600SemiBold", color: C.burs },

  emptyBox:    { alignItems: "center", paddingVertical: 56, gap: 10 },
  emptyTitle:  { fontSize: 17, fontFamily: "PublicSans_700Bold", color: C.primary },
  emptyDesc:   { fontSize: 13, color: C.muted, textAlign: "center", lineHeight: 19, maxWidth: 260 },
});