// mobile/app/(tabs)/vault.tsx
// FE-09: Evidence Locker — document list, search, upload FAB, expiry badges, swipe-to-delete
// FE-10: Camera / file picker integration; upload progress indicator

import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  Modal,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { MaterialIcons } from "@expo/vector-icons";
import * as DocumentPicker from "expo-document-picker";
import * as ImagePicker from "expo-image-picker";
import { differenceInDays, format, parseISO } from "date-fns";
import { useDocuments, useDeleteDocument, useUploadDocument } from "@/hooks/useDocuments";
import type { Document } from "@/types";

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
  amber:      "#D4830A",
  amberBg:    "#FEF3E2",
  secondary:  "#2a6b2c",
  secondaryBg:"#acf4a4",
  burs:       "#1A3C5E",
  bursBg:     "#EAF0F7",
};

const DOC_CATEGORIES = ["VAT Return", "PAYE Receipt", "CIT Return", "CIPA Certificate", "Trade Licence", "Employment Contract", "Other"] as const;
type DocCategory = typeof DOC_CATEGORIES[number];

// Maps the human-readable label to the snake_case value the API accepts
const CATEGORY_API_VALUE: Record<DocCategory, string> = {
  "VAT Return":          "vat_receipt",
  "PAYE Receipt":        "paye_receipt",
  "CIT Return":          "cit_receipt",
  "CIPA Certificate":    "cipa_certificate",
  "Trade Licence":       "trade_licence",
  "Employment Contract": "employment_contract",
  "Other":               "other",
};

function UploadModal({ visible, onClose, onUpload }: {
  visible: boolean; onClose: () => void;
  onUpload: (f: { uri: string; name: string; mimeType: string; category: string; expiry_date?: string }) => void;
}) {
  const [category, setCategory] = useState<DocCategory>("VAT Return");
  const [expiryDate, setExpiryDate] = useState("");
  const [picked, setPicked] = useState<{ uri: string; name: string; mimeType: string } | null>(null);

  const reset = () => { setPicked(null); setCategory("VAT Return"); setExpiryDate(""); };

  const pickDocument = async () => {
    const result = await DocumentPicker.getDocumentAsync({
      type: ["application/pdf", "image/jpeg", "image/png",
             "application/vnd.openxmlformats-officedocument.wordprocessingml.document"],
      copyToCacheDirectory: true,
    });
    if (!result.canceled && result.assets[0]) {
      const a = result.assets[0];
      if ((a.size ?? 0) > 10 * 1024 * 1024) { Alert.alert("File too large", "Maximum 10 MB."); return; }
      setPicked({ uri: a.uri, name: a.name, mimeType: a.mimeType ?? "application/octet-stream" });
    }
  };

  const pickCamera = async () => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) { Alert.alert("Permission required", "Camera access is needed to take a photo."); return; }
    const result = await ImagePicker.launchCameraAsync({ quality: 0.85 });
    if (!result.canceled && result.assets[0]) {
      const a = result.assets[0];
      setPicked({ uri: a.uri, name: `photo_${Date.now()}.jpg`, mimeType: "image/jpeg" });
    }
  };

  const handleConfirm = () => {
    if (!picked) { Alert.alert("No file", "Please select a file or take a photo."); return; }
    onUpload({ ...picked, category: CATEGORY_API_VALUE[category], expiry_date: expiryDate || undefined });
    reset(); onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={um.safe} edges={["top", "bottom"]}>
        <View style={um.header}>
          <Text style={um.title}>Upload Document</Text>
          <Pressable onPress={() => { reset(); onClose(); }} style={um.closeBtn}>
            <MaterialIcons name="close" size={22} color={C.primary} />
          </Pressable>
        </View>
        <ScrollView contentContainerStyle={um.body} showsVerticalScrollIndicator={false}>
          <View style={um.section}>
            <Text style={um.label}>FILE</Text>
            {picked ? (
              <View style={um.pickedBox}>
                <MaterialIcons name="insert-drive-file" size={28} color={C.burs} />
                <View style={um.pickedInfo}>
                  <Text style={um.pickedName} numberOfLines={1}>{picked.name}</Text>
                  <Text style={um.pickedMime}>{picked.mimeType}</Text>
                </View>
                <Pressable onPress={() => setPicked(null)}><MaterialIcons name="close" size={18} color={C.muted} /></Pressable>
              </View>
            ) : (
              <View style={um.pickRow}>
                <Pressable style={um.pickBtn} onPress={pickDocument}>
                  <MaterialIcons name="folder-open" size={22} color={C.primary} />
                  <Text style={um.pickBtnText}>Files</Text>
                </Pressable>
                <Pressable style={um.pickBtn} onPress={pickCamera}>
                  <MaterialIcons name="camera-alt" size={22} color={C.primary} />
                  <Text style={um.pickBtnText}>Camera</Text>
                </Pressable>
              </View>
            )}
          </View>
          <View style={um.section}>
            <Text style={um.label}>CATEGORY *</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={um.catRow}>
              {DOC_CATEGORIES.map((c) => (
                <Pressable key={c} style={[um.catChip, category === c && um.catChipActive]} onPress={() => setCategory(c)}>
                  <Text style={[um.catChipText, category === c && um.catChipTextActive]}>{c}</Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>
          <View style={um.section}>
            <Text style={um.label}>EXPIRY DATE (OPTIONAL)</Text>
            <TextInput style={um.input} placeholder="YYYY-MM-DD" placeholderTextColor={C.muted}
              value={expiryDate} onChangeText={setExpiryDate} maxLength={10} />
            <Text style={um.hint}>Enter for tax clearance certificates and trade licences.</Text>
          </View>
        </ScrollView>
        <View style={um.footer}>
          <Pressable style={[um.confirmBtn, !picked && um.confirmBtnDisabled]} onPress={handleConfirm} disabled={!picked}>
            <MaterialIcons name="cloud-upload" size={18} color="#fff" />
            <Text style={um.confirmBtnText}>Upload Document</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

function ExpiryBadge({ expiryDate }: { expiryDate: string }) {
  const days = differenceInDays(parseISO(expiryDate), new Date());
  if (days < 0) return (
    <View style={[eb.badge, eb.expired]}>
      <MaterialIcons name="error-outline" size={11} color={C.error} />
      <Text style={[eb.text, { color: C.error }]}>Expired</Text>
    </View>
  );
  if (days <= 30) return (
    <View style={[eb.badge, eb.expiringSoon]}>
      <MaterialIcons name="access-time" size={11} color={C.amber} />
      <Text style={[eb.text, { color: C.amber }]}>{days}d left</Text>
    </View>
  );
  return (
    <View style={[eb.badge, eb.ok]}>
      <Text style={[eb.text, { color: C.secondary }]}>Exp {format(parseISO(expiryDate), "dd MMM yy")}</Text>
    </View>
  );
}
const eb = StyleSheet.create({
  badge:        { flexDirection: "row", alignItems: "center", gap: 3, paddingHorizontal: 7, paddingVertical: 3, borderRadius: 999, marginTop: 4, alignSelf: "flex-start" },
  expired:      { backgroundColor: C.errorBg },
  expiringSoon: { backgroundColor: C.amberBg },
  ok:           { backgroundColor: C.secondaryBg },
  text:         { fontSize: 10, fontFamily: "PublicSans_600SemiBold" },
});

function DocumentRow({ doc, onDelete }: { doc: Document; onDelete: (id: number) => void }) {
  const [swiped, setSwiped] = useState(false);
  const ext = doc.filename.split(".").pop()?.toUpperCase() ?? "FILE";
  const iconName: string = ["PDF"].includes(ext) ? "picture-as-pdf" : ["JPG","JPEG","PNG"].includes(ext) ? "image" : "insert-drive-file";

  const handleDelete = () => {
    Alert.alert("Delete document", `Remove "${doc.filename}" from your Evidence Locker?`, [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: () => onDelete(doc.id) },
    ]);
    setSwiped(false);
  };

  return (
    <View style={dr.wrap}>
      <Pressable style={dr.deleteAction} onPress={handleDelete}>
        <MaterialIcons name="delete-outline" size={22} color="#fff" />
        <Text style={dr.deleteText}>Delete</Text>
      </Pressable>
      <Pressable style={[dr.row, swiped && dr.rowSwiped]} onLongPress={() => setSwiped(!swiped)} delayLongPress={300}>
        <View style={dr.iconWrap}>
          <MaterialIcons name={iconName as any} size={26} color={C.burs} />
        </View>
        <View style={dr.info}>
          <Text style={dr.filename} numberOfLines={1}>{doc.filename}</Text>
          <Text style={dr.meta}>{doc.category}{"  ·  "}{format(parseISO(doc.uploaded_at), "dd MMM yyyy")}</Text>
          {doc.expiry_date ? <ExpiryBadge expiryDate={doc.expiry_date} /> : null}
        </View>
        <MaterialIcons name="chevron-right" size={20} color={C.border} />
      </Pressable>
    </View>
  );
}
const dr = StyleSheet.create({
  wrap:        { position: "relative", marginBottom: 10, borderRadius: 12, overflow: "hidden" },
  deleteAction:{ position: "absolute", right: 0, top: 0, bottom: 0, width: 88, backgroundColor: C.error, alignItems: "center", justifyContent: "center", gap: 2 },
  deleteText:  { fontSize: 10, fontFamily: "PublicSans_700Bold", color: "#fff", letterSpacing: 0.5 },
  row:         { flexDirection: "row", alignItems: "center", backgroundColor: C.surface, borderRadius: 12, padding: 14, gap: 12, borderWidth: 1, borderColor: C.border },
  rowSwiped:   { transform: [{ translateX: -80 }] },
  iconWrap:    { width: 42, height: 42, borderRadius: 10, backgroundColor: C.bursBg, alignItems: "center", justifyContent: "center" },
  info:        { flex: 1 },
  filename:    { fontSize: 14, fontFamily: "PublicSans_700Bold", color: C.primary, marginBottom: 2 },
  meta:        { fontSize: 11, color: C.muted, fontFamily: "PublicSans_400Regular" },
});

function UploadProgress({ pct }: { pct: number }) {
  return (
    <View style={up.wrap}>
      <View style={up.row}>
        <ActivityIndicator size="small" color={C.burs} />
        <Text style={up.text}>Uploading… {pct}%</Text>
      </View>
      <View style={up.track}><View style={[up.fill, { width: `${pct}%` as any }]} /></View>
    </View>
  );
}
const up = StyleSheet.create({
  wrap:  { backgroundColor: C.bursBg, borderRadius: 10, padding: 12, marginBottom: 12, borderWidth: 1, borderColor: C.borderSoft },
  row:   { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 6 },
  text:  { fontSize: 13, fontFamily: "PublicSans_600SemiBold", color: C.burs },
  track: { height: 5, backgroundColor: C.border, borderRadius: 3, overflow: "hidden" },
  fill:  { height: 5, backgroundColor: C.burs, borderRadius: 3 },
});

export default function VaultScreen() {
  const [modalVisible, setModalVisible] = useState(false);
  const [search, setSearch] = useState("");
  const [uploadPct, setUploadPct] = useState<number | null>(null);

  const { data: docs, isLoading, isError, refetch } = useDocuments();
  const { mutate: deleteDoc } = useDeleteDocument();
  const { mutate: uploadDoc } = useUploadDocument();

  const filtered = (docs ?? []).filter((d) =>
    d.filename.toLowerCase().includes(search.toLowerCase()) ||
    d.category.toLowerCase().includes(search.toLowerCase())
  );

  const handleUpload = (file: { uri: string; name: string; mimeType: string; category: string; expiry_date?: string }) => {
    setUploadPct(0);
    uploadDoc(
      { uri: file.uri, filename: file.name, mimeType: file.mimeType, category: file.category,
        expiry_date: file.expiry_date, onProgress: (p) => setUploadPct(p) },
      { onSuccess: () => { setUploadPct(null); refetch(); },
        onError: () => { setUploadPct(null); Alert.alert("Upload failed", "Check your connection and try again."); } }
    );
  };

  const expiryCount = (docs ?? []).filter((d) => {
    if (!d.expiry_date) return false;
    return differenceInDays(parseISO(d.expiry_date), new Date()) <= 30;
  }).length;

  return (
    <SafeAreaView style={s.safe} edges={["top"]}>
      <View style={s.header}>
        <View>
          <Text style={s.title}>Evidence Locker</Text>
          <Text style={s.subtitle}>{docs?.length ?? 0} document{(docs?.length ?? 0) !== 1 ? "s" : ""} stored</Text>
        </View>
        {expiryCount > 0 && (
          <View style={s.expiryAlert}>
            <MaterialIcons name="access-time" size={14} color={C.amber} />
            <Text style={s.expiryAlertText}>{expiryCount} expiring</Text>
          </View>
        )}
      </View>

      <View style={s.searchWrap}>
        <MaterialIcons name="search" size={18} color={C.muted} style={s.searchIcon} />
        <TextInput style={s.searchInput} placeholder="Search by name or category…" placeholderTextColor={C.muted}
          value={search} onChangeText={setSearch} clearButtonMode="while-editing" />
      </View>

      <ScrollView style={s.scroll} contentContainerStyle={s.scrollContent} showsVerticalScrollIndicator={false}>
        {uploadPct !== null && <UploadProgress pct={uploadPct} />}
        {isLoading && <ActivityIndicator color={C.burs} style={{ marginTop: 40 }} />}
        {isError && (
          <View style={s.emptyBox}>
            <MaterialIcons name="error-outline" size={40} color={C.error} />
            <Text style={s.emptyTitle}>Could not load documents</Text>
            <Pressable style={s.retryBtn} onPress={() => refetch()}><Text style={s.retryText}>Retry</Text></Pressable>
          </View>
        )}
        {!isLoading && !isError && (docs?.length ?? 0) === 0 && (
          <View style={s.emptyBox}>
            <MaterialIcons name="folder-open" size={52} color={C.border} />
            <Text style={s.emptyTitle}>No documents yet</Text>
            <Text style={s.emptyDesc}>Upload your first filing receipt to start your Evidence Locker.</Text>
            <Pressable style={s.emptyUploadBtn} onPress={() => setModalVisible(true)}>
              <MaterialIcons name="cloud-upload" size={16} color="#fff" />
              <Text style={s.emptyUploadText}>Upload First Document</Text>
            </Pressable>
          </View>
        )}
        {!isLoading && !isError && docs && docs.length > 0 && filtered.length === 0 && (
          <View style={s.emptyBox}>
            <MaterialIcons name="search-off" size={40} color={C.border} />
            <Text style={s.emptyTitle}>No results</Text>
            <Text style={s.emptyDesc}>No documents match "{search}"</Text>
          </View>
        )}
        {!isLoading && filtered.map((doc) => (
          <DocumentRow key={doc.id} doc={doc} onDelete={(id) => deleteDoc(id)} />
        ))}
        {!isLoading && filtered.length > 0 && (
          <Pressable style={s.packBtn}>
            <MaterialIcons name="picture-as-pdf" size={18} color={C.burs} />
            <View style={s.packInfo}>
              <Text style={s.packTitle}>Generate Evidence Pack</Text>
              <Text style={s.packDesc}>Bundle all certificates into a single PDF for tender applications.</Text>
            </View>
            <MaterialIcons name="chevron-right" size={20} color={C.border} />
          </Pressable>
        )}
        <View style={{ height: 100 }} />
      </ScrollView>

      <Pressable style={s.fab} onPress={() => setModalVisible(true)}>
        <MaterialIcons name="add" size={26} color="#fff" />
      </Pressable>

      <UploadModal visible={modalVisible} onClose={() => setModalVisible(false)} onUpload={handleUpload} />
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:           { flex: 1, backgroundColor: C.bg },
  header:         { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end", paddingHorizontal: 20, paddingTop: 16, paddingBottom: 12, backgroundColor: C.container, borderBottomWidth: 1, borderBottomColor: C.border },
  title:          { fontSize: 22, fontFamily: "PublicSans_700Bold", color: C.primary },
  subtitle:       { fontSize: 12, fontFamily: "PublicSans_400Regular", color: C.muted, marginTop: 2 },
  expiryAlert:    { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: C.amberBg, paddingHorizontal: 9, paddingVertical: 5, borderRadius: 8 },
  expiryAlertText:{ fontSize: 11, fontFamily: "PublicSans_700Bold", color: C.amber },
  searchWrap:     { flexDirection: "row", alignItems: "center", marginHorizontal: 16, marginVertical: 12, backgroundColor: C.surface, borderRadius: 10, borderWidth: 1, borderColor: C.border, paddingHorizontal: 10 },
  searchIcon:     { marginRight: 6 },
  searchInput:    { flex: 1, height: 40, fontSize: 14, fontFamily: "PublicSans_400Regular", color: C.primary },
  scroll:         { flex: 1 },
  scrollContent:  { paddingHorizontal: 16, paddingTop: 4 },
  emptyBox:       { alignItems: "center", paddingTop: 60, paddingHorizontal: 32 },
  emptyTitle:     { fontSize: 17, fontFamily: "PublicSans_700Bold", color: C.primary, marginTop: 12, marginBottom: 6 },
  emptyDesc:      { fontSize: 13, color: C.muted, textAlign: "center", lineHeight: 19 },
  emptyUploadBtn: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 20, backgroundColor: C.primary, paddingHorizontal: 20, paddingVertical: 12, borderRadius: 10 },
  emptyUploadText:{ color: "#fff", fontFamily: "PublicSans_700Bold", fontSize: 13 },
  retryBtn:       { marginTop: 14, paddingHorizontal: 24, paddingVertical: 10, backgroundColor: C.primary, borderRadius: 8 },
  retryText:      { color: "#fff", fontFamily: "PublicSans_600SemiBold" },
  packBtn:        { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: C.bursBg, borderRadius: 12, padding: 14, marginTop: 4, borderWidth: 1, borderColor: C.borderSoft },
  packInfo:       { flex: 1 },
  packTitle:      { fontSize: 14, fontFamily: "PublicSans_700Bold", color: C.primary },
  packDesc:       { fontSize: 11, color: C.muted, marginTop: 2, lineHeight: 15 },
  fab:            { position: "absolute", right: 16, bottom: 90, backgroundColor: C.primary, width: 52, height: 52, borderRadius: 14, justifyContent: "center", alignItems: "center", shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 8, elevation: 6 },
});

const um = StyleSheet.create({
  safe:             { flex: 1, backgroundColor: C.surface },
  header:           { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: C.border },
  title:            { fontSize: 18, fontFamily: "PublicSans_700Bold", color: C.primary },
  closeBtn:         { padding: 4 },
  body:             { padding: 20, gap: 4 },
  footer:           { padding: 20, paddingTop: 12, borderTopWidth: 1, borderTopColor: C.border },
  section:          { marginBottom: 22 },
  label:            { fontSize: 10, fontFamily: "PublicSans_700Bold", color: C.muted, letterSpacing: 1.2, textTransform: "uppercase", marginBottom: 8 },
  hint:             { fontSize: 11, color: C.muted, marginTop: 4 },
  pickedBox:        { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: C.bursBg, borderRadius: 10, padding: 12, borderWidth: 1, borderColor: C.borderSoft },
  pickedInfo:       { flex: 1 },
  pickedName:       { fontSize: 13, fontFamily: "PublicSans_700Bold", color: C.primary },
  pickedMime:       { fontSize: 11, color: C.muted, marginTop: 1 },
  pickRow:          { flexDirection: "row", gap: 12 },
  pickBtn:          { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, borderWidth: 1, borderColor: C.border, borderRadius: 10, paddingVertical: 14, backgroundColor: C.bg },
  pickBtnText:      { fontSize: 14, fontFamily: "PublicSans_600SemiBold", color: C.primary },
  catRow:           { gap: 8 },
  catChip:          { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8, borderWidth: 1, borderColor: C.border, backgroundColor: C.bg },
  catChipActive:    { backgroundColor: C.primary, borderColor: C.primary },
  catChipText:      { fontSize: 12, fontFamily: "PublicSans_600SemiBold", color: C.muted },
  catChipTextActive:{ color: "#fff" },
  input:            { borderWidth: 1, borderColor: C.border, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, fontFamily: "PublicSans_400Regular", color: C.primary, backgroundColor: C.bg },
  confirmBtn:       { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: C.primary, borderRadius: 12, paddingVertical: 15 },
  confirmBtnDisabled:{ opacity: 0.4 },
  confirmBtnText:   { color: "#fff", fontFamily: "PublicSans_700Bold", fontSize: 15 },
});