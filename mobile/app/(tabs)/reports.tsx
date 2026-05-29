// mobile/app/(tabs)/reports.tsx
// FE-17: Reports — period picker, generate compliance PDF, share

import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { MaterialIcons } from "@expo/vector-icons";
import { TopBar } from "@/components/ui/TopBar";
import {
  useGenerateReport,
  shareReport,
  buildPeriodLabel,
  type GenerateReportPayload,
  type GeneratedReport,
} from "@/hooks/useReports";

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

type ReportType = "monthly" | "quarterly" | "annual";

const MONTHS   = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const QUARTERS = ["Q1 (Jan–Mar)","Q2 (Apr–Jun)","Q3 (Jul–Sep)","Q4 (Oct–Dec)"];

const THIS_YEAR  = new Date().getFullYear();
const THIS_MONTH = new Date().getMonth() + 1;
const YEARS = [THIS_YEAR, THIS_YEAR - 1, THIS_YEAR - 2];

// ── Period Picker ─────────────────────────────────────────────────────────────
function PeriodPicker({
  reportType, setReportType,
  year, setYear,
  month, setMonth,
  quarter, setQuarter,
}: {
  reportType: ReportType; setReportType: (t: ReportType) => void;
  year: number;           setYear:       (y: number) => void;
  month: number;          setMonth:      (m: number) => void;
  quarter: number;        setQuarter:    (q: number) => void;
}) {
  const types: { id: ReportType; label: string; icon: string; desc: string }[] = [
    { id: "monthly",   label: "Monthly",   icon: "calendar-today", desc: "Single month summary" },
    { id: "quarterly", label: "Quarterly", icon: "date-range",     desc: "3-month overview"     },
    { id: "annual",    label: "Annual",    icon: "calendar-month", desc: "Full financial year"  },
  ];

  return (
    <View style={pp.wrap}>
      <Text style={pp.sectionLabel}>REPORT TYPE</Text>
      <View style={pp.typeRow}>
        {types.map((t) => (
          <Pressable
            key={t.id}
            style={[pp.typeCard, reportType === t.id && pp.typeCardActive]}
            onPress={() => setReportType(t.id)}
          >
            <MaterialIcons name={t.icon as any} size={22} color={reportType === t.id ? "#fff" : C.muted} />
            <Text style={[pp.typeLabel, reportType === t.id && pp.typeLabelActive]}>{t.label}</Text>
            <Text style={[pp.typeDesc,  reportType === t.id && { color: "rgba(255,255,255,0.7)" }]}>{t.desc}</Text>
          </Pressable>
        ))}
      </View>

      <Text style={pp.sectionLabel}>YEAR</Text>
      <View style={pp.chipRow}>
        {YEARS.map((y) => (
          <Pressable
            key={y}
            style={[pp.chip, year === y && pp.chipActive]}
            onPress={() => setYear(y)}
          >
            <Text style={[pp.chipText, year === y && pp.chipTextActive]}>{y}</Text>
          </Pressable>
        ))}
      </View>

      {reportType === "monthly" && (
        <>
          <Text style={pp.sectionLabel}>MONTH</Text>
          <View style={pp.monthGrid}>
            {MONTHS.map((m, i) => {
              const mNum    = i + 1;
              const disabled = year === THIS_YEAR && mNum > THIS_MONTH;
              return (
                <Pressable
                  key={m}
                  style={[pp.monthChip, month === mNum && pp.chipActive, disabled && pp.chipDisabled]}
                  onPress={() => !disabled && setMonth(mNum)}
                  disabled={disabled}
                >
                  <Text style={[pp.chipText, month === mNum && pp.chipTextActive, disabled && { color: C.border }]}>
                    {m}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </>
      )}

      {reportType === "quarterly" && (
        <>
          <Text style={pp.sectionLabel}>QUARTER</Text>
          <View style={pp.chipRow}>
            {QUARTERS.map((q, i) => (
              <Pressable
                key={q}
                style={[pp.chip, { flex: 1 }, quarter === i + 1 && pp.chipActive]}
                onPress={() => setQuarter(i + 1)}
              >
                <Text style={[pp.chipText, quarter === i + 1 && pp.chipTextActive]}>{q}</Text>
              </Pressable>
            ))}
          </View>
        </>
      )}
    </View>
  );
}

const pp = StyleSheet.create({
  wrap:           { backgroundColor: C.surface, borderRadius: 16, borderWidth: 1, borderColor: C.border, padding: 16, marginBottom: 16 },
  sectionLabel:   { fontSize: 10, fontFamily: "PublicSans_700Bold", color: C.muted, letterSpacing: 1.2, textTransform: "uppercase", marginBottom: 10, marginTop: 14 },
  typeRow:        { flexDirection: "row", gap: 8 },
  typeCard:       { flex: 1, backgroundColor: C.bg, borderRadius: 12, borderWidth: 1, borderColor: C.border, padding: 12, alignItems: "center", gap: 4 },
  typeCardActive: { backgroundColor: C.primary, borderColor: C.primary },
  typeLabel:      { fontSize: 13, fontFamily: "PublicSans_700Bold", color: C.mid },
  typeLabelActive:{ color: "#fff" },
  typeDesc:       { fontSize: 10, fontFamily: "PublicSans_400Regular", color: C.muted, textAlign: "center" },
  chipRow:        { flexDirection: "row", gap: 8, flexWrap: "wrap" },
  chip:           { paddingHorizontal: 16, paddingVertical: 9, borderRadius: 999, borderWidth: 1, borderColor: C.border, backgroundColor: C.bg },
  chipActive:     { backgroundColor: C.primary, borderColor: C.primary },
  chipDisabled:   { opacity: 0.4 },
  chipText:       { fontSize: 12, fontFamily: "PublicSans_600SemiBold", color: C.muted },
  chipTextActive: { color: "#fff" },
  monthGrid:      { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  monthChip:      { width: "22%", paddingVertical: 9, borderRadius: 8, borderWidth: 1, borderColor: C.border, backgroundColor: C.bg, alignItems: "center" },
});

// ── Last Generated Card ───────────────────────────────────────────────────────
function GeneratedCard({ report, onShare }: { report: GeneratedReport; onShare: () => void }) {
  const [sharing, setSharing] = useState(false);

  const handleShare = async () => {
    setSharing(true);
    try {
      await onShare();
    } finally {
      setSharing(false);
    }
  };

  return (
    <View style={gc.card}>
      <View style={gc.iconWrap}>
        <MaterialIcons name="check-circle" size={22} color={C.secondary} />
      </View>
      <View style={gc.info}>
        <Text style={gc.label}>Report ready</Text>
        <Text style={gc.period}>{report.period_label}</Text>
      </View>
      <Pressable
        style={({ pressed }) => [gc.shareBtn, pressed && { opacity: 0.7 }]}
        onPress={handleShare}
        disabled={sharing}
      >
        {sharing
          ? <ActivityIndicator size="small" color={C.burs} />
          : <>
              <MaterialIcons name="ios-share" size={18} color="#fff" />
              <Text style={gc.shareBtnText}>Share</Text>
            </>
        }
      </Pressable>
    </View>
  );
}

const gc = StyleSheet.create({
  card:     { flexDirection: "row", alignItems: "center", backgroundColor: C.secondaryBg, borderRadius: 14, padding: 14, marginBottom: 20, gap: 12, borderWidth: 1, borderColor: C.secondary + "44" },
  iconWrap: { width: 40, height: 40, borderRadius: 10, backgroundColor: "#fff", alignItems: "center", justifyContent: "center" },
  info:     { flex: 1 },
  label:    { fontSize: 11, fontFamily: "PublicSans_600SemiBold", color: C.secondaryText, marginBottom: 2 },
  period:   { fontSize: 15, fontFamily: "PublicSans_700Bold", color: C.secondary },
  shareBtn: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: C.primary, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 10 },
  shareBtnText: { color: "#fff", fontSize: 13, fontFamily: "PublicSans_700Bold" },
});

// ── Main Screen ───────────────────────────────────────────────────────────────
export default function ReportsScreen() {
  const [reportType, setReportType] = useState<ReportType>("monthly");
  const [year,       setYear]       = useState(THIS_YEAR);
  const [month,      setMonth]      = useState(THIS_MONTH);
  const [quarter,    setQuarter]    = useState(Math.ceil(THIS_MONTH / 3));
  const [lastReport, setLastReport] = useState<GeneratedReport | null>(null);

  const { mutateAsync: generate, isPending: generating } = useGenerateReport();

  const payload: GenerateReportPayload = {
    report_type: reportType,
    year,
    ...(reportType === "monthly"   ? { month }   : {}),
    ...(reportType === "quarterly" ? { quarter } : {}),
  };

  const periodLabel = buildPeriodLabel(payload);

  const handleGenerate = async () => {
    try {
      const report = await generate(payload);
      setLastReport(report);
      // Auto-trigger share sheet immediately after generation
      shareReport(report).catch(() => {});
    } catch (err: any) {
      const msg: string = err?.message ?? "";
      if (msg.includes("401") || msg.includes("403")) {
        Alert.alert("Session expired", "Please log out and log back in.");
      } else if (msg.includes("404")) {
        Alert.alert("No data yet", "No compliance data found for this business profile. Add some deadlines first.");
      } else {
        Alert.alert("Generation failed", "Could not generate the report. Please check your connection and try again.");
      }
    }
  };

  const handleShare = async () => {
    if (!lastReport) return;
    try {
      await shareReport(lastReport);
    } catch (err: any) {
      Alert.alert("Share failed", err?.message ?? "Could not share the report.");
    }
  };

  return (
    <SafeAreaView style={s.safe} edges={["top"]}>
      <TopBar />

      <ScrollView style={s.scroll} contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
        <View style={s.pageHeader}>
          <Text style={s.pageTitle}>Reports</Text>
          <Text style={s.pageSub}>
            Generate a compliance summary PDF for any period. Includes all deadlines,
            health score, and evidence uploaded to your Locker.
          </Text>
        </View>

        {/* Last generated report */}
        {lastReport && (
          <GeneratedCard report={lastReport} onShare={handleShare} />
        )}

        {/* Period picker */}
        <PeriodPicker
          reportType={reportType} setReportType={setReportType}
          year={year}             setYear={setYear}
          month={month}           setMonth={setMonth}
          quarter={quarter}       setQuarter={setQuarter}
        />

        {/* Generate button */}
        <Pressable
          style={({ pressed }) => [s.generateBtn, (pressed || generating) && { opacity: 0.75 }]}
          onPress={handleGenerate}
          disabled={generating}
        >
          {generating ? (
            <>
              <ActivityIndicator color="#fff" size="small" />
              <Text style={s.generateBtnText}>Building PDF…</Text>
            </>
          ) : (
            <>
              <MaterialIcons name="picture-as-pdf" size={20} color="#fff" />
              <Text style={s.generateBtnText}>Generate {periodLabel} Report</Text>
            </>
          )}
        </Pressable>

        <Text style={s.generateHint}>
          The PDF is generated on demand and opened in your device's share sheet.
          You can save it to Files, email it, or attach it to a tender application.
        </Text>

        {/* What's included info box */}
        <View style={s.infoBox}>
          <Text style={s.infoTitle}>What's included</Text>
          {[
            { icon: "health-and-safety", text: "Compliance health score for the period" },
            { icon: "event",             text: "All deadlines — status, due date, category" },
            { icon: "folder-open",       text: "Evidence Locker document inventory" },
            { icon: "warning",           text: "Overdue count and penalty summary" },
          ].map((item) => (
            <View key={item.text} style={s.infoRow}>
              <MaterialIcons name={item.icon as any} size={16} color={C.burs} />
              <Text style={s.infoText}>{item.text}</Text>
            </View>
          ))}
        </View>

        <View style={{ height: 80 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:         { flex: 1, backgroundColor: C.bg },
  scroll:       { flex: 1 },
  content:      { paddingHorizontal: 16, paddingBottom: 24 },

  pageHeader:   { paddingTop: 20, paddingBottom: 20 },
  pageTitle:    { fontSize: 26, fontFamily: "PublicSans_700Bold", color: C.primary, marginBottom: 6 },
  pageSub:      { fontSize: 14, fontFamily: "PublicSans_400Regular", color: C.muted, lineHeight: 20 },

  generateBtn:     { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, backgroundColor: C.primary, borderRadius: 14, paddingVertical: 16, marginBottom: 10 },
  generateBtnText: { color: "#fff", fontFamily: "PublicSans_700Bold", fontSize: 15 },
  generateHint:    { fontSize: 12, fontFamily: "PublicSans_400Regular", color: C.muted, textAlign: "center", lineHeight: 17, marginBottom: 24 },

  infoBox:   { backgroundColor: C.bursBg, borderRadius: 14, padding: 16, gap: 12, borderWidth: 1, borderColor: C.borderSoft },
  infoTitle: { fontSize: 13, fontFamily: "PublicSans_700Bold", color: C.primary, marginBottom: 4 },
  infoRow:   { flexDirection: "row", alignItems: "center", gap: 10 },
  infoText:  { fontSize: 13, fontFamily: "PublicSans_400Regular", color: C.mid, flex: 1 },
});