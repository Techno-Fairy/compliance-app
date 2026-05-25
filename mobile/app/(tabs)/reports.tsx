// mobile/app/(tabs)/reports.tsx
import { MaterialIcons } from "@expo/vector-icons";
import { View, Text, StyleSheet, ScrollView, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { TopBar } from "@/components/ui/TopBar";

const C = {
  bg:          "#f3faff",
  surface:     "#ffffff",
  primary:     "#000b25",
  mid:         "#44474e",
  muted:       "#75777f",
  border:      "#c5c6cf",
  container:   "#dbf1fe",
  secondary:   "#2a6b2c",
  secondaryBg: "#acf4a4",
  secondaryText:"#307231",
  burs:        "#1A3C5E",
  bursBg:      "#EAF0F7",
  amber:       "#D4830A",
  amberBg:     "#FEF3E2",
};

const REPORT_TYPES = [
  { icon: "receipt-long"  as const, label: "VAT Summary",           sub: "FY 2023–24",   color: C.burs,   bg: C.bursBg  },
  { icon: "account-balance" as const, label: "CIPA Filing History", sub: "All years",     color: C.secondary, bg: C.secondaryBg },
  { icon: "groups"        as const, label: "Labour Compliance",     sub: "Current year",  color: C.amber,  bg: C.amberBg },
  { icon: "summarize"     as const, label: "Full Compliance Report", sub: "PDF export",   color: C.primary,bg: "#e8eaf6" },
];

export default function ReportsScreen() {
  return (
    <SafeAreaView style={s.safe} edges={["top"]}>
      <TopBar />

      <ScrollView style={s.scroll} contentContainerStyle={s.content}>
        <View style={s.pageHeader}>
          <Text style={s.pageTitle}>Reports</Text>
          <Text style={s.pageSubtitle}>Download and review your compliance reports by period.</Text>
        </View>

        {/* Coming soon card */}
        <View style={s.placeholderCard}>
          <View style={s.iconCircle}>
            <MaterialIcons name="bar-chart" size={36} color={C.burs} />
          </View>
          <Text style={s.placeholderTitle}>Coming in Week 4</Text>
          <Text style={s.placeholderDesc}>
            Month/year picker, analytics breakdown, and PDF generation will be available here.
          </Text>
        </View>

        {/* Report type previews */}
        <Text style={s.sectionLabel}>AVAILABLE REPORTS</Text>
        {REPORT_TYPES.map((r) => (
          <Pressable key={r.label} style={({ pressed }) => [s.reportRow, pressed && s.rowPressed]}>
            <View style={[s.reportIcon, { backgroundColor: r.bg }]}>
              <MaterialIcons name={r.icon} size={22} color={r.color} />
            </View>
            <View style={s.reportBody}>
              <Text style={s.reportLabel}>{r.label}</Text>
              <Text style={s.reportSub}>{r.sub}</Text>
            </View>
            <MaterialIcons name="download" size={20} color={C.muted} />
          </Pressable>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:        { flex: 1, backgroundColor: C.bg },
  scroll:      { flex: 1 },
  content:     { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 120 },

  topBar:      { flexDirection: "row", justifyContent: "space-between", alignItems: "center", height: 56, paddingHorizontal: 16, backgroundColor: C.container, borderBottomWidth: 1, borderBottomColor: C.border },
  topBarLeft:  { flexDirection: "row", alignItems: "center", gap: 12 },
  appTitle:    { fontSize: 17, fontFamily: "PublicSans_700Bold", color: C.primary },
  avatar:      { width: 38, height: 38, borderRadius: 19, backgroundColor: C.burs, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: C.border },
  avatarText:  { color: "#fff", fontFamily: "PublicSans_700Bold", fontSize: 13 },

  pageHeader:  { marginTop: 20, marginBottom: 24 },
  pageTitle:   { fontSize: 26, fontFamily: "PublicSans_700Bold", color: C.primary, marginBottom: 6 },
  pageSubtitle:{ fontSize: 14, fontFamily: "PublicSans_400Regular", color: C.muted, lineHeight: 20 },

  placeholderCard:  { backgroundColor: C.surface, borderRadius: 16, padding: 28, alignItems: "center", borderWidth: 1, borderColor: C.border, marginBottom: 24, gap: 12 },
  iconCircle:       { width: 72, height: 72, borderRadius: 36, backgroundColor: C.bursBg, alignItems: "center", justifyContent: "center" },
  placeholderTitle: { fontSize: 17, fontFamily: "PublicSans_700Bold", color: C.primary },
  placeholderDesc:  { fontSize: 13, fontFamily: "PublicSans_400Regular", color: C.muted, textAlign: "center", lineHeight: 19 },

  sectionLabel: { fontSize: 10, fontFamily: "PublicSans_600SemiBold", color: C.muted, letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 12 },

  reportRow:   { flexDirection: "row", alignItems: "center", backgroundColor: C.surface, borderRadius: 12, padding: 14, marginBottom: 10, gap: 12, borderWidth: 1, borderColor: C.border },
  rowPressed:  { opacity: 0.75 },
  reportIcon:  { width: 44, height: 44, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  reportBody:  { flex: 1 },
  reportLabel: { fontSize: 14, fontFamily: "PublicSans_600SemiBold", color: C.primary },
  reportSub:   { fontSize: 12, fontFamily: "PublicSans_400Regular", color: C.muted, marginTop: 2 },
});