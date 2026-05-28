// mobile/app/(tabs)/reports.tsx
// FE-17: Reports — period picker, generate button, history list, share

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
import { format, parseISO } from "date-fns";
import { TopBar } from "@/components/ui/TopBar";
import {
  useReportHistory,
  useGenerateReport,
  shareReport,
  type ReportRecord,
  type GenerateReportPayload,
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

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
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
  year: number; setYear: (y: number) => void;
  month: number; setMonth: (m: number) => void;
  quarter: number; setQuarter: (q: number) => void;
}) {
  const types: { id: ReportType; label: string; icon: string; desc: string }[] = [
    { id: "monthly",   label: "Monthly",   icon: "calendar-today",  desc: "Single month summary"   },
    { id: "quarterly", label: "Quarterly", icon: "date-range",      desc: "3-month overview"       },
    { id: "annual",    label: "Annual",    icon: "calendar-month",  desc: "Full financial year"    },
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
            <Text style={[pp.typeDesc, reportType === t.id && { color: "rgba(255,255,255,0.7)" }]}>{t.desc}</Text>
          </Pressable>
        ))}
      </View>

      {/* Year selector */}
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

      {/* Month selector (monthly only) */}
      {reportType === "monthly" && (
        <>
          <Text style={pp.sectionLabel}>MONTH</Text>
          <View style={pp.monthGrid}>
            {MONTHS.map((m, i) => {
              const mNum = i + 1;
              const disabled = year === THIS_YEAR && mNum > THIS_MONTH;
              return (
                <Pressable
                  key={m}
                  style={[pp.monthChip, month === mNum && pp.chipActive, disabled && pp.chipDisabled]}
                  onPress={() => !disabled && setMonth(mNum)}
                  disabled={disabled}
                >
                  <Text style={[pp.chipText, month === mNum && pp.chipTextActive, disabled && { color: C.border }]}>{m}</Text>
                </Pressable>
              );
            })}
          </View>
        </>
      )}

      {/* Quarter selector */}
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
  wrap:          { backgroundColor: C.surface, borderRadius: 16, borderWidth: 1, borderColor: C.border, padding: 16, marginBottom: 16 },
  sectionLabel:  { fontSize: 10, fontFamily: "PublicSans_700Bold", color: C.muted, letterSpacing: 1.2, textTransform: "uppercase", marginBottom: 10, marginTop: 14 },
  typeRow:       { flexDirection: "row", gap: 8 },
  typeCard:      { flex: 1, backgroundColor: C.bg, borderRadius: 12, borderWidth: 1, borderColor: C.border, padding: 12, alignItems: "center", gap: 4 },
  typeCardActive:{ backgroundColor: C.primary, borderColor: C.primary },
  typeLabel:     { fontSize: 13, fontFamily: "PublicSans_700Bold", color: C.mid },
  typeLabelActive:{ color: "#fff" },
  typeDesc:      { fontSize: 10, fontFamily: "PublicSans_400Regular", color: C.muted, textAlign: "center" },
  chipRow:       { flexDirection: "row", gap: 8, flexWrap: "wrap" },
  chip:          { paddingHorizontal: 16, paddingVertical: 9, borderRadius: 999, borderWidth: 1, borderColor: C.border, backgroundColor: C.bg },
  chipActive:    { backgroundColor: C.primary, borderColor: C.primary },
  chipDisabled:  { opacity: 0.4 },
  chipText:      { fontSize: 12, fontFamily: "PublicSans_600SemiBold", color: C.muted },
  chipTextActive:{ color: "#fff" },
  monthGrid:     { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  monthChip:     { width: "22%", paddingVertical: 9, borderRadius: 8, borderWidth: 1, borderColor: C.border, backgroundColor: C.bg, alignItems: "center" },
});

// ── Report history row ────────────────────────────────────────────────────────
function ReportRow({ report }: { report: ReportRecord }) {
  const [sharing, setSharing] = useState(false);

  const handleShare = async () => {
    setSharing(true);
    try {
      await shareReport(report);
    } catch (err: any) {
      Alert.alert("Share failed", err?.message ?? "Could not share the report.");
    } finally {
      setSharing(false);
    }
  };

  const sizeKb = Math.round(report.file_size_bytes / 1024);

  return (
    <View style={rr.row}>
      <View style={rr.iconWrap}>
        <MaterialIcons name="picture-as-pdf" size={24} color={C.error} />
      </View>
      <View style={rr.info}>
        <Text style={rr.label}>{report.period_label}</Text>
        <Text style={rr.meta}>
          {report.report_type.charAt(0).toUpperCase() + report.report_type.slice(1)}
          {"  ·  "}{sizeKb} KB
          {"  ·  "}{format(parseISO(report.generated_at), "d MMM yyyy")}
        </Text>
      </View>
      <Pressable
        style={({ pressed }) => [rr.shareBtn, pressed && { opacity: 0.7 }]}
        onPress={handleShare}
        disabled={sharing}
      >
        {sharing
          ? <ActivityIndicator size="small" color={C.burs} />
          : <MaterialIcons name="ios-share" size={20} color={C.burs} />
        }
      </Pressable>
    </View>
  );
}

const rr = StyleSheet.create({
  row:      { flexDirection: "row", alignItems: "center", backgroundColor: C.surface, borderRadius: 12, padding: 14, marginBottom: 10, gap: 12, borderWidth: 1, borderColor: C.border },
  iconWrap: { width: 42, height: 42, borderRadius: 10, backgroundColor: C.errorBg, alignItems: "center", justifyContent: "center" },
  info:     { flex: 1 },
  label:    { fontSize: 14, fontFamily: "PublicSans_700Bold", color: C.primary, marginBottom: 3 },
  meta:     { fontSize: 11, fontFamily: "PublicSans_400Regular", color: C.muted },
  shareBtn: { width: 38, height: 38, borderRadius: 9, borderWidth: 1, borderColor: C.border, alignItems: "center", justifyContent: "center" },
});

// ── Main Screen ───────────────────────────────────────────────────────────────
export default function ReportsScreen() {
  const [reportType, setReportType] = useState<ReportType>("monthly");
  const [year,       setYear]       = useState(THIS_YEAR);
  const [month,      setMonth]      = useState(THIS_MONTH);
  const [quarter,    setQuarter]    = useState(Math.ceil(THIS_MONTH / 3));

  const { data: history, isLoading: histLoading, refetch } = useReportHistory();
  const { mutateAsync: generate, isPending: generating }   = useGenerateReport();

  const handleGenerate = async () => {
    const payload: GenerateReportPayload = {
      report_type: reportType,
      year,
      ...(reportType === "monthly"   ? { month }   : {}),
      ...(reportType === "quarterly" ? { quarter } : {}),
    };

    try {
      const report = await generate(payload);
      Alert.alert(
        "Report Ready",
        `${report.period_label} report generated.`,
        [
          { text: "Share", onPress: () => shareReport(report).catch(() => {}) },
          { text: "OK" },
        ]
      );
    } catch {
      Alert.alert("Generation failed", "Could not generate the report. Please try again.");
    }
  };

  const periodLabel = (() => {
    if (reportType === "monthly")   return `${MONTHS[month - 1]} ${year}`;
    if (reportType === "quarterly") return `${QUARTERS[quarter - 1]} ${year}`;
    return `Full Year ${year}`;
  })();

  return (
    <SafeAreaView style={s.safe} edges={["top"]}>
      <TopBar />

      <ScrollView style={s.scroll} contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
        <View style={s.pageHeader}>
          <Text style={s.pageTitle}>Reports</Text>
          <Text style={s.pageSub}>Generate and download compliance reports in PDF format.</Text>
        </View>

        {/* Period picker */}
        <PeriodPicker
          reportType={reportType} setReportType={setReportType}
          year={year} setYear={setYear}
          month={month} setMonth={setMonth}
          quarter={quarter} setQuarter={setQuarter}
        />

        {/* Generate button */}
        <Pressable
          style={({ pressed }) => [s.generateBtn, pressed && { opacity: 0.85 }, generating && { opacity: 0.6 }]}
          onPress={handleGenerate}
          disabled={generating}
        >
          {generating ? (
            <>
              <ActivityIndicator color="#fff" size="small" />
              <Text style={s.generateBtnText}>Generating…</Text>
            </>
          ) : (
            <>
              <MaterialIcons name="picture-as-pdf" size={20} color="#fff" />
              <Text style={s.generateBtnText}>Generate {periodLabel} Report</Text>
            </>
          )}
        </Pressable>

        <Text style={s.generateHint}>
          Reports include all deadlines, compliance scores, and penalties for the selected period.
        </Text>

        {/* History */}
        <View style={s.historyHeader}>
          <Text style={s.sectionTitle}>Generated Reports</Text>
          {histLoading && <ActivityIndicator size="small" color={C.burs} />}
        </View>

        {!histLoading && (history?.length ?? 0) === 0 && (
          <View style={s.emptyBox}>
            <MaterialIcons name="description" size={44} color={C.border} />
            <Text style={s.emptyTitle}>No reports yet</Text>
            <Text style={s.emptyDesc}>Generate your first report above.</Text>
          </View>
        )}

        {history?.map((r) => <ReportRow key={r.id} report={r} />)}

        <View style={{ height: 80 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:        { flex: 1, backgroundColor: C.bg },
  scroll:      { flex: 1 },
  content:     { paddingHorizontal: 16, paddingBottom: 24 },

  pageHeader:  { paddingTop: 20, paddingBottom: 20 },
  pageTitle:   { fontSize: 26, fontFamily: "PublicSans_700Bold", color: C.primary, marginBottom: 6 },
  pageSub:     { fontSize: 14, fontFamily: "PublicSans_400Regular", color: C.muted, lineHeight: 20 },

  generateBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, backgroundColor: C.primary, borderRadius: 14, paddingVertical: 16, marginBottom: 10 },
  generateBtnText: { color: "#fff", fontFamily: "PublicSans_700Bold", fontSize: 15 },
  generateHint:{ fontSize: 12, fontFamily: "PublicSans_400Regular", color: C.muted, textAlign: "center", lineHeight: 17, marginBottom: 24 },

  historyHeader:{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 },
  sectionTitle: { fontSize: 17, fontFamily: "PublicSans_700Bold", color: C.primary },

  emptyBox:    { alignItems: "center", paddingVertical: 40, gap: 10 },
  emptyTitle:  { fontSize: 16, fontFamily: "PublicSans_700Bold", color: C.primary },
  emptyDesc:   { fontSize: 13, color: C.muted, textAlign: "center" },
});