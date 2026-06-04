// mobile/app/profile.tsx
//
// Business Profile VIEW screen — reached by tapping the avatar in the top bar.
// Fetches GET /business/profile and displays the data in a clean read-only layout.
// The user can tap "Edit Profile" to go to the existing /business-profile form,
// with all fields pre-populated via router params.

import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
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
import { api } from "@/lib/api";
import type { BusinessProfile } from "@/types";

const C = {
  bg:          "#f3faff",
  surface:     "#ffffff",
  primary:     "#000b25",
  mid:         "#44474e",
  muted:       "#75777f",
  border:      "#c5c6cf",
  container:   "#dbf1fe",
  containerLow:"#e6f6ff",
  secondary:   "#2a6b2c",
  secondaryBg: "#acf4a4",
  secondaryText:"#307231",
  error:       "#ba1a1a",
  errorBg:     "#ffdad6",
  burs:        "#1A3C5E",
  bursBg:      "#EAF0F7",
  amber:       "#D4830A",
  amberBg:     "#FEF3E2",
};

const COMPANY_TYPE_LABELS: Record<string, string> = {
  sole_trader: "Sole Trader",
  pty_ltd:     "Pty Ltd (Private Limited Company)",
  partnership: "Partnership",
  ngo:         "NGO / Non-Profit",
};

function fetchProfile(): Promise<BusinessProfile> {
  return api.get("/business/profile").then((r) => r.data);
}

function navigateToEdit(profile: BusinessProfile) {
  router.push({
    pathname: "/business-profile",
    params: {
      edit:               "true",
      business_name:      profile.business_name,
      company_type:       profile.company_type,
      cipa_number:        profile.cipa_number  ?? "",
      burs_tin:           profile.burs_tin     ?? "",
      vat_registered:     profile.vat_registered     ? "true" : "false",
      vat_filing_monthly: profile.vat_filing_monthly ? "true" : "false",
    },
  });
}

function InfoRow({
  icon, label, value, valueColor,
}: {
  icon: React.ComponentProps<typeof MaterialIcons>["name"];
  label: string;
  value: string;
  valueColor?: string;
}) {
  return (
    <View style={s.infoRow}>
      <View style={s.infoIcon}>
        <MaterialIcons name={icon} size={18} color={C.burs} />
      </View>
      <View style={s.infoBody}>
        <Text style={s.infoLabel}>{label}</Text>
        <Text style={[s.infoValue, valueColor ? { color: valueColor } : null]}>
          {value}
        </Text>
      </View>
    </View>
  );
}

function StatusBadge({ active, labelTrue, labelFalse }: { active: boolean; labelTrue: string; labelFalse: string }) {
  return (
    <View style={[s.badge, active ? s.badgeActive : s.badgeInactive]}>
      <MaterialIcons
        name={active ? "check-circle" : "cancel"}
        size={13}
        color={active ? C.secondaryText : C.muted}
      />
      <Text style={[s.badgeText, active ? s.badgeTextActive : s.badgeTextInactive]}>
        {active ? labelTrue : labelFalse}
      </Text>
    </View>
  );
}

export default function ProfileScreen() {
  const { data: profile, isLoading, isError, refetch } = useQuery<BusinessProfile>({
    queryKey: ["business-profile"],
    queryFn: fetchProfile,
  });

  return (
    <SafeAreaView style={s.safe} edges={["top"]}>
      {/* Header */}
      <View style={s.header}>
        <Pressable
          onPress={() => router.back()}
          style={({ pressed }) => [s.backBtn, pressed && { opacity: 0.6 }]}
          hitSlop={8}
        >
          <MaterialIcons name="arrow-back" size={24} color={C.primary} />
        </Pressable>
        <Text style={s.headerTitle}>Business Profile</Text>
        {profile ? (
          <Pressable
            onPress={() => navigateToEdit(profile)}
            style={({ pressed }) => [s.editBtn, pressed && { opacity: 0.7 }]}
            hitSlop={8}
          >
            <MaterialIcons name="edit" size={18} color={C.burs} />
            <Text style={s.editBtnText}>Edit</Text>
          </Pressable>
        ) : (
          <View style={s.editBtnPlaceholder} />
        )}
      </View>

      {isLoading && (
        <View style={s.centred}>
          <ActivityIndicator size="large" color={C.secondary} />
          <Text style={s.loadingText}>Fetching profile…</Text>
        </View>
      )}

      {isError && (
        <View style={s.centred}>
          <View style={s.errorIcon}>
            <MaterialIcons name="cloud-off" size={36} color={C.error} />
          </View>
          <Text style={s.errorTitle}>Could not load profile</Text>
          <Text style={s.errorDesc}>Check your connection and try again.</Text>
          <Pressable style={s.retryBtn} onPress={() => refetch()}>
            <Text style={s.retryText}>Retry</Text>
          </Pressable>
        </View>
      )}

      {profile && (
        <ScrollView style={s.scroll} contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
          <View style={s.heroCard}>
            <View style={s.avatarCircle}>
              <MaterialIcons name="business" size={36} color={C.burs} />
            </View>
            <Text style={s.heroName}>{profile.business_name}</Text>
            <Text style={s.heroType}>
              {COMPANY_TYPE_LABELS[profile.company_type] ?? profile.company_type}
            </Text>
            <View style={s.badgeRow}>
              <StatusBadge
                active={profile.vat_registered}
                labelTrue="VAT Registered"
                labelFalse="Not VAT Registered"
              />
              {profile.vat_registered && (
                <StatusBadge
                  active={profile.vat_filing_monthly}
                  labelTrue="Monthly Filing"
                  labelFalse="Bi-monthly Filing"
                />
              )}
            </View>
          </View>

          <View style={s.card}>
            <Text style={s.cardTitle}>REGISTRATION DETAILS</Text>
            <InfoRow
              icon="badge"
              label="CIPA Registration Number"
              value={profile.cipa_number ?? "Not provided"}
              valueColor={profile.cipa_number ? C.primary : C.muted}
            />
            <View style={s.divider} />
            <InfoRow
              icon="receipt-long"
              label="BURS Tax Identification Number (TIN)"
              value={profile.burs_tin ?? "Not provided"}
              valueColor={profile.burs_tin ? C.primary : C.muted}
            />
            <View style={s.divider} />
            <InfoRow
              icon="category"
              label="Company Type"
              value={COMPANY_TYPE_LABELS[profile.company_type] ?? profile.company_type}
            />
          </View>

          <View style={s.card}>
            <Text style={s.cardTitle}>VAT DETAILS</Text>
            <InfoRow
              icon="account-balance"
              label="VAT Status"
              value={profile.vat_registered ? "Registered for VAT" : "Not registered for VAT"}
              valueColor={profile.vat_registered ? C.secondaryText : C.muted}
            />
            {profile.vat_registered && (
              <>
                <View style={s.divider} />
                <InfoRow
                  icon="calendar-today"
                  label="Filing Frequency"
                  value={profile.vat_filing_monthly ? "Monthly" : "Bi-monthly (every 2 months)"}
                />
              </>
            )}
          </View>

          <View style={s.tipCard}>
            <MaterialIcons name="info" size={18} color={C.secondary} />
            <Text style={s.tipText}>
              Keep your CIPA and BURS details up to date to avoid delays during annual filing season.
            </Text>
          </View>

          <Pressable
            style={({ pressed }) => [s.editCta, pressed && { opacity: 0.85 }]}
            onPress={() => navigateToEdit(profile)}
          >
            <MaterialIcons name="edit" size={18} color="#fff" />
            <Text style={s.editCtaText}>Edit Business Profile</Text>
          </Pressable>

          <View style={{ height: 40 }} />
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:    { flex: 1, backgroundColor: C.bg },
  scroll:  { flex: 1 },
  content: { paddingHorizontal: 16, paddingTop: 8 },
  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    height: 56, paddingHorizontal: 16, backgroundColor: C.container,
    borderBottomWidth: 1, borderBottomColor: C.border,
  },
  headerTitle: { fontSize: 17, fontFamily: "PublicSans_700Bold", color: C.primary, flex: 1, textAlign: "center" },
  backBtn:            { padding: 2 },
  editBtn:            { flexDirection: "row", alignItems: "center", gap: 4 },
  editBtnText:        { fontSize: 13, fontFamily: "PublicSans_600SemiBold", color: C.burs },
  editBtnPlaceholder: { width: 48 },
  centred:     { flex: 1, alignItems: "center", justifyContent: "center", padding: 32, gap: 12 },
  loadingText: { fontSize: 14, fontFamily: "PublicSans_400Regular", color: C.muted, marginTop: 8 },
  errorIcon:   { width: 72, height: 72, borderRadius: 36, backgroundColor: C.errorBg, alignItems: "center", justifyContent: "center" },
  errorTitle:  { fontSize: 17, fontFamily: "PublicSans_700Bold", color: C.primary },
  errorDesc:   { fontSize: 13, fontFamily: "PublicSans_400Regular", color: C.muted, textAlign: "center", lineHeight: 19 },
  retryBtn:    { backgroundColor: C.primary, borderRadius: 10, paddingVertical: 12, paddingHorizontal: 28, marginTop: 4 },
  retryText:   { color: "#fff", fontFamily: "PublicSans_600SemiBold", fontSize: 14 },
  heroCard: {
    backgroundColor: C.surface, borderRadius: 16, marginTop: 16, marginBottom: 12,
    padding: 24, alignItems: "center", borderWidth: 1, borderColor: C.border, gap: 8,
  },
  avatarCircle: {
    width: 72, height: 72, borderRadius: 36, backgroundColor: C.bursBg,
    alignItems: "center", justifyContent: "center", marginBottom: 4,
  },
  heroName: { fontSize: 22, fontFamily: "PublicSans_700Bold", color: C.primary, textAlign: "center" },
  heroType: { fontSize: 13, fontFamily: "PublicSans_400Regular", color: C.muted, textAlign: "center" },
  badgeRow: { flexDirection: "row", gap: 8, flexWrap: "wrap", justifyContent: "center", marginTop: 4 },
  badge: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999, borderWidth: 1 },
  badgeActive:        { backgroundColor: C.secondaryBg, borderColor: C.secondaryText },
  badgeInactive:      { backgroundColor: C.containerLow, borderColor: C.border },
  badgeText:          { fontSize: 11, fontFamily: "PublicSans_600SemiBold" },
  badgeTextActive:    { color: C.secondaryText },
  badgeTextInactive:  { color: C.muted },
  card: { backgroundColor: C.surface, borderRadius: 14, marginBottom: 12, borderWidth: 1, borderColor: C.border, overflow: "hidden" },
  cardTitle: {
    fontSize: 10, fontFamily: "PublicSans_600SemiBold", color: C.muted, letterSpacing: 1.5,
    textTransform: "uppercase", paddingHorizontal: 16, paddingTop: 14, paddingBottom: 10,
  },
  divider: { height: 1, backgroundColor: C.border, marginHorizontal: 16 },
  infoRow: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 14, gap: 12 },
  infoIcon: { width: 36, height: 36, borderRadius: 10, backgroundColor: C.bursBg, alignItems: "center", justifyContent: "center" },
  infoBody:  { flex: 1 },
  infoLabel: { fontSize: 11, fontFamily: "PublicSans_400Regular", color: C.muted, marginBottom: 2 },
  infoValue: { fontSize: 14, fontFamily: "PublicSans_600SemiBold", color: C.primary },
  tipCard: {
    flexDirection: "row", alignItems: "flex-start", gap: 10, backgroundColor: C.container,
    borderLeftWidth: 3, borderLeftColor: C.secondary, borderRadius: 10, padding: 14, marginBottom: 16,
  },
  tipText: { flex: 1, fontSize: 12, fontFamily: "PublicSans_400Regular", color: C.mid, lineHeight: 18 },
  editCta: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    backgroundColor: C.primary, borderRadius: 12, paddingVertical: 16, marginBottom: 8,
  },
  editCtaText: { fontSize: 15, fontFamily: "PublicSans_700Bold", color: "#fff" },
});