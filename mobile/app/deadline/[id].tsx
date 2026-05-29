// mobile/app/deadline/[id].tsx
// S-03 — Deadline Detail Screen
// PRD flow F-03: Dashboard > Deadline Card > Deadline Detail > Pre-Filing Checklist
//                > Open Portal (deep link) > Return > Upload Receipt > Mark Complete

import React, { useState, useCallback } from "react";
import {
  ActivityIndicator,
  Alert,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  Modal,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { MaterialIcons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as DocumentPicker from "expo-document-picker";
import * as ImagePicker from "expo-image-picker";
import { format, parseISO } from "date-fns";
import { useDeadlines, useUpdateDeadlineStatus } from "@/hooks/useDeadlines";
import { useUploadDocument } from "@/hooks/useDocuments";
import type { Deadline } from "@/types";

// ── Design tokens (matches the rest of the app) ──────────────────────────────
const C = {
  bg:          "#f3faff",
  surface:     "#ffffff",
  primary:     "#000b25",
  mid:         "#44474e",
  muted:       "#75777f",
  border:      "#c5c6cf",
  borderSoft:  "#e6f6ff",
  secondary:   "#2a6b2c",
  secondaryBg: "#acf4a4",
  secondaryText:"#307231",
  error:       "#ba1a1a",
  errorBg:     "#ffdad6",
  amber:       "#D4830A",
  amberBg:     "#FEF3E2",
  burs:        "#1A3C5E",
  bursBg:      "#EAF0F7",
  cipaBar:     "#2E6B4F",
  cipaBg:      "#E8F4EE",
  labour:      "#6B3A7D",
  labourBg:    "#F3EEF7",
  custom:      "#7D5A1E",
  customBg:    "#F7F1E8",
  container:   "#dbf1fe",
  containerLow:"#e6f6ff",
};

const CAT: Record<string, { bg: string; text: string; bar: string }> = {
  BURS:   { bg: C.bursBg,   text: C.burs,    bar: C.burs    },
  CIPA:   { bg: C.cipaBg,   text: C.cipaBar, bar: C.cipaBar },
  LABOUR: { bg: C.labourBg, text: C.labour,  bar: C.labour  },
  CUSTOM: { bg: C.customBg, text: C.custom,  bar: C.custom  },
};

// ── Pre-filing checklist items by category ───────────────────────────────────
// These mirror the PRD spec (S-03): documents and information needed before
// visiting the BURS / CIPA portal. They are stored locally (toggled client-side).
const CHECKLIST_ITEMS: Record<string, string[]> = {
  BURS: [
    "Gather all sales invoices for the period",
    "Gather all purchase / input invoices",
    "Reconcile bank statements to sales figures",
    "Calculate VAT output and input amounts",
    "Note your TIN and VAT registration number",
    "Open eservices.burs.org.bw in browser (or tap portal button below)",
  ],
  CIPA: [
    "Locate your company registration certificate",
    "Confirm registered business address is current",
    "Confirm directors' details are up to date",
    "Prepare annual return fee payment (check CIPA schedule)",
    "Open obrs.gov.bw in browser (or tap portal button below)",
  ],
  LABOUR: [
    "Review all employment contracts are signed",
    "Check leave records are up to date",
    "Confirm PAYE deductions have been made",
    "Ensure payslips have been issued for the period",
    "Document any disciplinary actions taken",
  ],
  CUSTOM: [
    "Review the specific requirements for this obligation",
    "Gather supporting documentation",
    "Confirm the deadline date and authority",
  ],
};

// ── Portal URLs by category ───────────────────────────────────────────────────
const PORTAL_URLS: Record<string, { url: string; label: string }> = {
  BURS:   { url: "https://eservices.burs.org.bw", label: "Open BURS Portal" },
  CIPA:   { url: "https://obrs.gov.bw",            label: "Open CIPA / OBRS Portal" },
  LABOUR: { url: "https://www.mlha.gov.bw",         label: "Open Labour Portal" },
  CUSTOM: { url: "",                                label: "Open Portal" },
};

// ── Upload Modal (reused from vault pattern) ──────────────────────────────────
const DOC_CATEGORIES = [
  "VAT Return", "PAYE Receipt", "CIT Return",
  "CIPA Certificate", "Trade Licence", "Employment Contract", "Other",
] as const;
type DocCategory = typeof DOC_CATEGORIES[number];

const CATEGORY_API_VALUE: Record<DocCategory, string> = {
  "VAT Return":          "vat_receipt",
  "PAYE Receipt":        "paye_receipt",
  "CIT Return":          "cit_receipt",
  "CIPA Certificate":    "cipa_certificate",
  "Trade Licence":       "trade_licence",
  "Employment Contract": "employment_contract",
  "Other":               "other",
};

function UploadModal({
  visible, onClose, onUpload, deadlineId,
}: {
  visible: boolean;
  onClose: () => void;
  onUpload: (f: { uri: string; name: string; mimeType: string; category: string; deadline_id: number }) => void;
  deadlineId: number;
}) {
  const [category, setCategory] = useState<DocCategory>("VAT Return");
  const [picked, setPicked] = useState<{ uri: string; name: string; mimeType: string } | null>(null);

  const reset = () => { setPicked(null); setCategory("VAT Return"); };

  const pickDocument = async () => {
    const result = await DocumentPicker.getDocumentAsync({
      type: ["application/pdf", "image/jpeg", "image/png",
             "application/vnd.openxmlformats-officedocument.wordprocessingml.document"],
      copyToCacheDirectory: true,
    });
    if (!result.canceled && result.assets[0]) {
      const a = result.assets[0];
      if ((a.size ?? 0) > 10 * 1024 * 1024) {
        Alert.alert("File too large", "Maximum 10 MB per file.");
        return;
      }
      setPicked({ uri: a.uri, name: a.name, mimeType: a.mimeType ?? "application/octet-stream" });
    }
  };

  const pickCamera = async () => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) { Alert.alert("Permission needed", "Camera access is required to take a photo."); return; }
    const result = await ImagePicker.launchCameraAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.85 });
    if (!result.canceled && result.assets[0]) {
      const a = result.assets[0];
      setPicked({ uri: a.uri, name: `receipt_${Date.now()}.jpg`, mimeType: "image/jpeg" });
    }
  };

  const handleConfirm = () => {
    if (!picked) { Alert.alert("No file selected", "Please pick a file or take a photo first."); return; }
    onUpload({ ...picked, category: CATEGORY_API_VALUE[category], deadline_id: deadlineId });
    reset();
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
        <View style={ss.modalHeader}>
          <Text style={ss.modalTitle}>Upload Receipt</Text>
          <Pressable onPress={() => { reset(); onClose(); }}>
            <MaterialIcons name="close" size={24} color={C.primary} />
          </Pressable>
        </View>
        <ScrollView style={{ flex: 1, padding: 20 }}>
          {/* Category picker */}
          <Text style={ss.fieldLabel}>Document Category</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 20 }}>
            {DOC_CATEGORIES.map((cat) => (
              <Pressable
                key={cat}
                style={[ss.categoryChip, category === cat && ss.categoryChipActive]}
                onPress={() => setCategory(cat)}
              >
                <Text style={[ss.categoryChipText, category === cat && ss.categoryChipTextActive]}>{cat}</Text>
              </Pressable>
            ))}
          </ScrollView>

          {/* File source buttons */}
          <Text style={ss.fieldLabel}>Select File</Text>
          <View style={{ flexDirection: "row", gap: 12, marginBottom: 20 }}>
            <Pressable style={[ss.sourceBtn, { flex: 1 }]} onPress={pickDocument}>
              <MaterialIcons name="folder-open" size={22} color={C.primary} />
              <Text style={ss.sourceBtnText}>Browse Files</Text>
            </Pressable>
            <Pressable style={[ss.sourceBtn, { flex: 1 }]} onPress={pickCamera}>
              <MaterialIcons name="camera-alt" size={22} color={C.primary} />
              <Text style={ss.sourceBtnText}>Take Photo</Text>
            </Pressable>
          </View>

          {picked && (
            <View style={ss.pickedRow}>
              <MaterialIcons name="insert-drive-file" size={20} color={C.secondary} />
              <Text style={ss.pickedName} numberOfLines={1}>{picked.name}</Text>
              <Pressable onPress={() => setPicked(null)}>
                <MaterialIcons name="close" size={18} color={C.muted} />
              </Pressable>
            </View>
          )}
        </ScrollView>

        <View style={ss.modalFooter}>
          <Pressable style={[ss.btnPrimary, { flex: 1 }]} onPress={handleConfirm}>
            <Text style={ss.btnPrimaryText}>Upload</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

// ── Main Screen ───────────────────────────────────────────────────────────────
export default function DeadlineDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const deadlineId = Number(id);

  const { data: deadlines, isLoading, isError } = useDeadlines();
  const updateStatus = useUpdateDeadlineStatus();
  const uploadDocument = useUploadDocument();

  const deadline: Deadline | undefined = deadlines?.find((d) => d.id === deadlineId);

  // Local checklist state (stored client-side per PRD S-03)
  const defaultChecklist = deadline ? CHECKLIST_ITEMS[deadline.category] ?? CHECKLIST_ITEMS.CUSTOM : [];
  const [checked, setChecked] = useState<Record<number, boolean>>({});
  const [uploadVisible, setUploadVisible] = useState(false);
  const [uploading, setUploading] = useState(false);

  const checkedCount = Object.values(checked).filter(Boolean).length;
  const allChecked = defaultChecklist.length > 0 && checkedCount === defaultChecklist.length;

  const toggleItem = useCallback((idx: number) => {
    setChecked((prev) => ({ ...prev, [idx]: !prev[idx] }));
  }, []);

  const handleOpenPortal = () => {
    if (!deadline) return;
    const portalInfo = PORTAL_URLS[deadline.portal_url ? "CUSTOM" : deadline.category];
    const url = deadline.portal_url ?? portalInfo.url;
    if (!url) { Alert.alert("No portal URL", "No portal link is configured for this deadline."); return; }
    Linking.openURL(url).catch(() => Alert.alert("Could not open", "Please open the portal manually in your browser."));
  };

  const handleMarkComplete = () => {
    if (!deadline) return;
    Alert.alert(
      "Mark as Complete",
      "Confirm you have filed this deadline with the relevant authority.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Mark Complete",
          onPress: () => {
            updateStatus.mutate(
              { id: deadlineId, status: "complete" },
              {
                onError: () => Alert.alert("Error", "Could not update status. Please try again."),
              }
            );
          },
        },
      ]
    );
  };

  const handleMarkMissed = () => {
    if (!deadline) return;
    Alert.alert(
      "Mark as Missed",
      "This will record the deadline as missed and penalties will continue to accrue.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Mark Missed",
          style: "destructive",
          onPress: () => {
            updateStatus.mutate(
              { id: deadlineId, status: "missed" },
              {
                onError: () => Alert.alert("Error", "Could not update status. Please try again."),
              }
            );
          },
        },
      ]
    );
  };

  const handleUpload = async (file: {
    uri: string; name: string; mimeType: string; category: string; deadline_id: number;
  }) => {
    setUploading(true);
    try {
      await uploadDocument.mutateAsync({
        uri: file.uri,
        filename: file.name,
        mimeType: file.mimeType,
        category: file.category,
        deadline_id: file.deadline_id,
      });
      Alert.alert("Uploaded", "Receipt saved to your Evidence Locker.");
    } catch {
      Alert.alert("Upload failed", "Please check your connection and try again.");
    } finally {
      setUploading(false);
    }
  };

  // ── Loading ────────────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <SafeAreaView style={[ss.root, { justifyContent: "center", alignItems: "center" }]}>
        <ActivityIndicator size="large" color={C.primary} />
      </SafeAreaView>
    );
  }

  // ── Error / Not Found ──────────────────────────────────────────────────────
  if (isError || !deadline) {
    return (
      <SafeAreaView style={[ss.root, { justifyContent: "center", alignItems: "center", padding: 32 }]}>
        <MaterialIcons name="error-outline" size={48} color={C.error} />
        <Text style={[ss.errorTitle, { marginTop: 16 }]}>Deadline not found</Text>
        <Text style={[ss.errorSub, { marginTop: 8, textAlign: "center" }]}>
          This deadline may have been deleted or the link is invalid.
        </Text>
        <Pressable style={[ss.btnPrimary, { marginTop: 24 }]} onPress={() => router.back()}>
          <Text style={ss.btnPrimaryText}>Go Back</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  // ── Derived state ──────────────────────────────────────────────────────────
  const cat = CAT[deadline.category] ?? CAT.CUSTOM;
  const days = deadline.days_remaining ?? 0;
  const isOverdue = days < 0 && deadline.status !== "complete";
  const isComplete = deadline.status === "complete";
  const isMissed = deadline.status === "missed";

  const portalInfo = PORTAL_URLS[deadline.category] ?? PORTAL_URLS.CUSTOM;
  const dueFormatted = (() => {
    try { return format(parseISO(deadline.due_date), "d MMMM yyyy"); }
    catch { return deadline.due_date; }
  })();

  // Penalty estimate for "file today vs 7 days"
  const fixedPenalty = deadline.fixed_penalty_bwp ?? 0;
  const rate = deadline.monthly_interest_rate ?? 0.015;
  const outstanding = deadline.estimated_outstanding_bwp ?? 0;
  const daysOverdue = Math.max(0, -days);
  const penaltyToday = fixedPenalty + outstanding * rate * (daysOverdue / 30);
  const penaltyIn7 = fixedPenalty + outstanding * rate * ((daysOverdue + 7) / 30);
  const showPenalty = isOverdue && (fixedPenalty > 0 || outstanding > 0);

  return (
    <SafeAreaView style={ss.root} edges={["top", "left", "right"]}>
      {/* Header */}
      <View style={ss.header}>
        <Pressable style={ss.backBtn} onPress={() => router.back()}>
          <MaterialIcons name="arrow-back" size={22} color={C.primary} />
        </Pressable>
        <Text style={ss.headerTitle} numberOfLines={1}>Deadline Detail</Text>
        <Pressable
          style={ss.historyBtn}
          onPress={() => router.push({ pathname: "/history", params: { deadline_id: deadlineId } } as any)}
        >
          <MaterialIcons name="history" size={22} color={C.primary} />
        </Pressable>
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 32 }}>

        {/* Status banner */}
        {isComplete && (
          <View style={[ss.banner, { backgroundColor: C.secondaryBg }]}>
            <MaterialIcons name="check-circle" size={18} color={C.secondary} />
            <Text style={[ss.bannerText, { color: C.secondaryText }]}>  Filed and complete</Text>
          </View>
        )}
        {isOverdue && (
          <View style={[ss.banner, { backgroundColor: C.errorBg }]}>
            <MaterialIcons name="warning" size={18} color={C.error} />
            <Text style={[ss.bannerText, { color: C.error }]}>  This deadline has passed — penalties are accruing</Text>
          </View>
        )}
        {isMissed && !isOverdue && (
          <View style={[ss.banner, { backgroundColor: C.amberBg }]}>
            <MaterialIcons name="cancel" size={18} color={C.amber} />
            <Text style={[ss.bannerText, { color: C.amber }]}>  Marked as missed</Text>
          </View>
        )}

        <View style={ss.content}>
          {/* Category chip + title */}
          <View style={[ss.chip, { backgroundColor: cat.bg, alignSelf: "flex-start", marginBottom: 10 }]}>
            <Text style={[ss.chipText, { color: cat.text }]}>{deadline.category}</Text>
          </View>
          <Text style={ss.title}>{deadline.name}</Text>

          {/* Due date row */}
          <View style={ss.metaRow}>
            <MaterialIcons name="event" size={16} color={C.muted} />
            <Text style={ss.metaText}> Due {dueFormatted}</Text>
            {!isComplete && (
              <View style={[ss.chip, { backgroundColor: isOverdue ? C.errorBg : days <= 7 ? C.amberBg : C.containerLow, marginLeft: "auto" }]}>
                <Text style={[ss.chipText, { color: isOverdue ? C.error : days <= 7 ? C.amber : C.secondaryText }]}>
                  {isOverdue ? `${Math.abs(days)}d overdue` : days === 0 ? "Due today" : `${days}d remaining`}
                </Text>
              </View>
            )}
          </View>

          {/* Notes */}
          {deadline.notes ? (
            <View style={ss.notesBox}>
              <Text style={ss.notesText}>{deadline.notes}</Text>
            </View>
          ) : null}

          {/* Penalty exposure card */}
          {showPenalty && (
            <View style={[ss.card, { borderLeftWidth: 4, borderLeftColor: C.error }]}>
              <Text style={ss.cardTitle}>Penalty Exposure</Text>
              <View style={ss.penaltyRow}>
                <View style={{ flex: 1 }}>
                  <Text style={ss.penaltyLabel}>If filed today</Text>
                  <Text style={[ss.penaltyAmount, { color: C.error }]}>
                    BWP {penaltyToday.toLocaleString("en-BW", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={ss.penaltyLabel}>If filed in 7 days</Text>
                  <Text style={[ss.penaltyAmount, { color: C.error }]}>
                    BWP {penaltyIn7.toLocaleString("en-BW", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </Text>
                </View>
              </View>
              <Text style={ss.penaltyNote}>Based on BURS published penalty schedule (BWP 1,000 fixed + 1.5% monthly interest)</Text>
            </View>
          )}

          {/* Portal deep link */}
          {(portalInfo.url || deadline.portal_url) && !isComplete && (
            <Pressable style={[ss.portalBtn, { borderColor: cat.bar }]} onPress={handleOpenPortal}>
              <MaterialIcons name="open-in-browser" size={18} color={cat.bar} />
              <Text style={[ss.portalBtnText, { color: cat.bar }]}>
                {deadline.portal_url ? "Open Portal" : portalInfo.label}
              </Text>
              <MaterialIcons name="chevron-right" size={18} color={cat.bar} />
            </Pressable>
          )}

          {/* Pre-filing checklist */}
          <View style={ss.section}>
            <Text style={ss.sectionTitle}>
              Pre-Filing Checklist
              <Text style={ss.sectionSub}> ({checkedCount}/{defaultChecklist.length})</Text>
            </Text>
            {defaultChecklist.map((item, idx) => (
              <Pressable
                key={idx}
                style={[ss.checkRow, checked[idx] && ss.checkRowChecked]}
                onPress={() => toggleItem(idx)}
              >
                <View style={[ss.checkbox, checked[idx] && { backgroundColor: C.secondary, borderColor: C.secondary }]}>
                  {checked[idx] && <MaterialIcons name="check" size={14} color="#fff" />}
                </View>
                <Text style={[ss.checkText, checked[idx] && ss.checkTextDone]}>{item}</Text>
              </Pressable>
            ))}
          </View>

          {/* Upload receipt */}
          <View style={ss.section}>
            <Text style={ss.sectionTitle}>Filing Evidence</Text>
            <Text style={ss.sectionBody}>
              After filing, upload your acknowledgement receipt or confirmation from the portal.
              Documents are saved to your Evidence Locker.
            </Text>
            <Pressable
              style={[ss.btnOutline, uploading && { opacity: 0.6 }]}
              onPress={() => setUploadVisible(true)}
              disabled={uploading}
            >
              {uploading ? (
                <ActivityIndicator size="small" color={C.primary} />
              ) : (
                <MaterialIcons name="cloud-upload" size={18} color={C.primary} />
              )}
              <Text style={ss.btnOutlineText}>{uploading ? "Uploading…" : "Upload Receipt"}</Text>
            </Pressable>
          </View>

          {/* Knowledge base link */}
          <Pressable
            style={ss.kbRow}
            onPress={() => router.push({ pathname: "/knowledge-base", params: { category: deadline.category } } as any)}
          >
            <MaterialIcons name="menu-book" size={18} color={C.burs} />
            <Text style={ss.kbText}>View Knowledge Base: {deadline.category} guidance</Text>
            <MaterialIcons name="chevron-right" size={18} color={C.muted} />
          </Pressable>
        </View>
      </ScrollView>

      {/* Bottom action buttons — only shown when not complete */}
      {!isComplete && (
        <View style={ss.bottomBar}>
          <Pressable
            style={[ss.btnMissed, updateStatus.isPending && { opacity: 0.6 }]}
            onPress={handleMarkMissed}
            disabled={updateStatus.isPending}
          >
            <Text style={ss.btnMissedText}>Mark Missed</Text>
          </Pressable>
          <Pressable
            style={[
              ss.btnComplete,
              (!allChecked || updateStatus.isPending) && { opacity: 0.5 },
            ]}
            onPress={handleMarkComplete}
            disabled={!allChecked || updateStatus.isPending}
          >
            {updateStatus.isPending ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={ss.btnCompleteText}>Mark Complete</Text>
            )}
          </Pressable>
        </View>
      )}

      {/* Upload modal */}
      <UploadModal
        visible={uploadVisible}
        onClose={() => setUploadVisible(false)}
        onUpload={handleUpload}
        deadlineId={deadlineId}
      />
    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const ss = StyleSheet.create({
  root:         { flex: 1, backgroundColor: C.bg },
  header:       { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 12, backgroundColor: C.surface, borderBottomWidth: 1, borderBottomColor: C.borderSoft },
  backBtn:      { padding: 4, marginRight: 8 },
  historyBtn:   { padding: 4, marginLeft: "auto" },
  headerTitle:  { flex: 1, fontSize: 17, fontWeight: "700", color: C.primary, fontFamily: "PublicSans_700Bold" },

  banner:       { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 10 },
  bannerText:   { fontSize: 14, fontWeight: "600", fontFamily: "PublicSans_600SemiBold" },

  content:      { padding: 20, gap: 0 },
  chip:         { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  chipText:     { fontSize: 12, fontWeight: "600", fontFamily: "PublicSans_600SemiBold" },

  title:        { fontSize: 22, fontWeight: "700", color: C.primary, fontFamily: "PublicSans_700Bold", marginBottom: 10, lineHeight: 30 },
  metaRow:      { flexDirection: "row", alignItems: "center", marginBottom: 16 },
  metaText:     { fontSize: 14, color: C.mid, fontFamily: "PublicSans_400Regular" },

  notesBox:     { backgroundColor: C.containerLow, borderRadius: 10, padding: 14, marginBottom: 16 },
  notesText:    { fontSize: 14, color: C.mid, fontFamily: "PublicSans_400Regular", lineHeight: 20 },

  card:         { backgroundColor: C.surface, borderRadius: 12, padding: 16, marginBottom: 16, shadowColor: "#000", shadowOpacity: 0.04, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 2 },
  cardTitle:    { fontSize: 14, fontWeight: "700", color: C.primary, fontFamily: "PublicSans_700Bold", marginBottom: 12 },
  penaltyRow:   { flexDirection: "row", gap: 16, marginBottom: 10 },
  penaltyLabel: { fontSize: 12, color: C.muted, fontFamily: "PublicSans_400Regular", marginBottom: 4 },
  penaltyAmount:{ fontSize: 18, fontWeight: "700", fontFamily: "PublicSans_700Bold" },
  penaltyNote:  { fontSize: 11, color: C.muted, fontFamily: "PublicSans_400Regular", lineHeight: 16 },

  portalBtn:    { flexDirection: "row", alignItems: "center", gap: 8, borderWidth: 1.5, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 12, marginBottom: 20, backgroundColor: C.surface },
  portalBtnText:{ flex: 1, fontSize: 15, fontWeight: "600", fontFamily: "PublicSans_600SemiBold" },

  section:      { marginBottom: 20 },
  sectionTitle: { fontSize: 15, fontWeight: "700", color: C.primary, fontFamily: "PublicSans_700Bold", marginBottom: 12 },
  sectionSub:   { fontSize: 13, fontWeight: "400", color: C.muted, fontFamily: "PublicSans_400Regular" },
  sectionBody:  { fontSize: 14, color: C.mid, fontFamily: "PublicSans_400Regular", lineHeight: 20, marginBottom: 12 },

  checkRow:     { flexDirection: "row", alignItems: "flex-start", gap: 12, paddingVertical: 10, paddingHorizontal: 12, borderRadius: 10, marginBottom: 6, backgroundColor: C.surface, borderWidth: 1, borderColor: C.borderSoft },
  checkRowChecked: { backgroundColor: C.secondaryBg, borderColor: C.secondary + "44" },
  checkbox:     { width: 22, height: 22, borderRadius: 6, borderWidth: 1.5, borderColor: C.border, alignItems: "center", justifyContent: "center", marginTop: 1, flexShrink: 0 },
  checkText:    { flex: 1, fontSize: 14, color: C.primary, fontFamily: "PublicSans_400Regular", lineHeight: 20 },
  checkTextDone:{ textDecorationLine: "line-through", color: C.muted },

  btnPrimary:   { backgroundColor: C.primary, borderRadius: 12, paddingVertical: 14, paddingHorizontal: 20, alignItems: "center", flexDirection: "row", justifyContent: "center", gap: 8 },
  btnPrimaryText:{ color: "#fff", fontSize: 15, fontWeight: "700", fontFamily: "PublicSans_700Bold" },
  btnOutline:   { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, borderWidth: 1.5, borderColor: C.border, borderRadius: 12, paddingVertical: 12, paddingHorizontal: 16, backgroundColor: C.surface },
  btnOutlineText:{ fontSize: 15, fontWeight: "600", color: C.primary, fontFamily: "PublicSans_600SemiBold" },

  kbRow:        { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 14, paddingHorizontal: 16, backgroundColor: C.surface, borderRadius: 12, borderWidth: 1, borderColor: C.borderSoft, marginBottom: 8 },
  kbText:       { flex: 1, fontSize: 14, color: C.burs, fontFamily: "PublicSans_600SemiBold", fontWeight: "600" },

  bottomBar:    { flexDirection: "row", gap: 12, paddingHorizontal: 20, paddingVertical: 16, backgroundColor: C.surface, borderTopWidth: 1, borderTopColor: C.borderSoft },
  btnMissed:    { flex: 1, borderWidth: 1.5, borderColor: C.error, borderRadius: 12, paddingVertical: 14, alignItems: "center" },
  btnMissedText:{ fontSize: 15, fontWeight: "600", color: C.error, fontFamily: "PublicSans_600SemiBold" },
  btnComplete:  { flex: 2, backgroundColor: C.primary, borderRadius: 12, paddingVertical: 14, alignItems: "center" },
  btnCompleteText:{ fontSize: 15, fontWeight: "700", color: "#fff", fontFamily: "PublicSans_700Bold" },

  // Upload modal
  modalHeader:  { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: C.borderSoft, backgroundColor: C.surface },
  modalTitle:   { fontSize: 18, fontWeight: "700", color: C.primary, fontFamily: "PublicSans_700Bold" },
  modalFooter:  { flexDirection: "row", padding: 20, borderTopWidth: 1, borderTopColor: C.borderSoft, backgroundColor: C.surface },
  fieldLabel:   { fontSize: 13, fontWeight: "600", color: C.mid, fontFamily: "PublicSans_600SemiBold", marginBottom: 10 },
  categoryChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1.5, borderColor: C.border, backgroundColor: C.surface, marginRight: 8 },
  categoryChipActive:{ borderColor: C.primary, backgroundColor: C.primary },
  categoryChipText: { fontSize: 13, color: C.mid, fontFamily: "PublicSans_400Regular" },
  categoryChipTextActive:{ color: "#fff", fontWeight: "600", fontFamily: "PublicSans_600SemiBold" },
  sourceBtn:    { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 14, borderWidth: 1.5, borderColor: C.border, borderRadius: 12, backgroundColor: C.surface },
  sourceBtnText:{ fontSize: 14, color: C.primary, fontWeight: "600", fontFamily: "PublicSans_600SemiBold" },
  pickedRow:    { flexDirection: "row", alignItems: "center", gap: 10, padding: 12, backgroundColor: C.secondaryBg, borderRadius: 10 },
  pickedName:   { flex: 1, fontSize: 14, color: C.secondaryText, fontFamily: "PublicSans_400Regular" },

  errorTitle:   { fontSize: 18, fontWeight: "700", color: C.primary, fontFamily: "PublicSans_700Bold" },
  errorSub:     { fontSize: 14, color: C.mid, fontFamily: "PublicSans_400Regular" },
});