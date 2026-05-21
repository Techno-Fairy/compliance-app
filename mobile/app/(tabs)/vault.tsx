// mobile/app/(tabs)/vault.tsx
// FE-09: list, search, upload FAB, swipe-to-delete
// FE-10: camera + file picker integration
// FE-11: upload progress indicator, error & empty states
import { useState, useCallback, useMemo, useRef } from "react";
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { MaterialIcons } from "@expo/vector-icons";
import * as DocumentPicker from "expo-document-picker";
import * as ImagePicker from "expo-image-picker";
import * as FileSystem from "expo-file-system";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  runOnJS,
} from "react-native-reanimated";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { useDocuments, useDeleteDocument, useUploadDocument } from "@/hooks/useDocuments";
import { useOfflineQueue } from "@/hooks/useOfflineQueue";
import { useQueryClient } from "@tanstack/react-query";
import type { Document } from "@/types";

// ── Design tokens ─────────────────────────────────────────────────────────────
const C = {
  bg:            "#f3faff",
  surface:       "#ffffff",
  primary:       "#000b25",
  mid:           "#44474e",
  muted:         "#75777f",
  border:        "#c5c6cf",
  borderSoft:    "#e6f6ff",
  secondary:     "#2a6b2c",
  secondaryBg:   "#acf4a4",
  secondaryText: "#307231",
  error:         "#ba1a1a",
  errorBg:       "#ffdad6",
  amber:         "#D4830A",
  amberBg:       "#FEF3E2",
  burs:          "#1A3C5E",
  bursBg:        "#EAF0F7",
  cipaBar:       "#2E6B4F",
  cipaBg:        "#E8F4EE",
  labour:        "#6B3A7D",
  labourBg:      "#F3EEF7",
  custom:        "#7D5A1E",
  customBg:      "#F7F1E8",
  container:     "#dbf1fe",
  containerLow:  "#e6f6ff",
};

const CAT_STYLE: Record<string, { bg: string; text: string; bar: string }> = {
  BURS:   { bg: C.bursBg,   text: C.burs,    bar: C.burs    },
  CIPA:   { bg: C.cipaBg,   text: C.cipaBar, bar: C.cipaBar },
  LABOUR: { bg: C.labourBg, text: C.labour,  bar: C.labour  },
  KYC:    { bg: "#F0ECF7",  text: "#5C3A7D", bar: "#5C3A7D" },
  CUSTOM: { bg: C.customBg, text: C.custom,  bar: C.custom  },
};
const cs = (cat: string) => CAT_STYLE[cat] ?? CAT_STYLE.CUSTOM;

const FILTERS = ["ALL", "BURS", "CIPA", "LABOUR", "KYC", "CUSTOM"] as const;
type Filter = typeof FILTERS[number];

const CATEGORIES = ["BURS", "CIPA", "LABOUR", "KYC", "CUSTOM"] as const;
type Category = typeof CATEGORIES[number];

const { width } = Dimensions.get("window");
const DELETE_WIDTH = 72;

// ── Helpers ───────────────────────────────────────────────────────────────────
function expiryStatus(expiry?: string): "ok" | "expiring" | "expired" | null {
  if (!expiry) return null;
  const days = Math.ceil((new Date(expiry).getTime() - Date.now()) / 86_400_000);
  if (days < 0)   return "expired";
  if (days <= 30) return "expiring";
  return "ok";
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-BW", {
    day: "2-digit", month: "short", year: "numeric",
  });
}

function fileIcon(filename: string): "picture-as-pdf" | "image" | "description" {
  const ext = filename.split(".").pop()?.toLowerCase() ?? "";
  if (ext === "pdf") return "picture-as-pdf";
  if (["jpg", "jpeg", "png", "gif", "webp"].includes(ext)) return "image";
  return "description";
}

// ── Upload Progress Bar ───────────────────────────────────────────────────────
// FE-11: visual progress indicator
function UploadProgressBar({ progress }: { progress: number }) {
  return (
    <View style={up.wrap}>
      <View style={up.track}>
        <View style={[up.fill, { width: `${Math.min(100, progress)}%` }]} />
      </View>
      <Text style={up.label}>{Math.round(progress)}%</Text>
    </View>
  );
}
const up = StyleSheet.create({
  wrap:  { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 10 },
  track: { flex: 1, height: 6, backgroundColor: C.containerLow, borderRadius: 3, overflow: "hidden" },
  fill:  { height: 6, backgroundColor: C.cipaBar, borderRadius: 3 },
  label: { fontSize: 12, fontFamily: "PublicSans_700Bold", color: C.cipaBar, width: 36, textAlign: "right" },
});

// ── Swipeable document row ────────────────────────────────────────────────────
function SwipeableDocumentRow({ item, onDelete }: { item: Document; onDelete: (id: number) => void }) {
  const translateX = useSharedValue(0);
  const catStyle   = cs(item.category);
  const expiry     = expiryStatus(item.expiry_date);
  const icon       = fileIcon(item.filename);

  const showDeleteAlert = () => {
    Alert.alert(
      "Delete Document",
      `Remove "${item.filename}" from the vault?`,
      [
        { text: "Cancel", style: "cancel", onPress: () => { translateX.value = withTiming(0); } },
        { text: "Delete", style: "destructive", onPress: () => onDelete(item.id) },
      ]
    );
  };

  const pan = Gesture.Pan()
    .activeOffsetX([-10, 10])
    .onUpdate((e) => {
      translateX.value = Math.min(0, Math.max(e.translationX, -DELETE_WIDTH));
    })
    .onEnd(() => {
      if (translateX.value < -DELETE_WIDTH / 2) {
        translateX.value = withTiming(-DELETE_WIDTH);
      } else {
        translateX.value = withTiming(0);
      }
    });

  const cardAnim = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  return (
    <View style={ss.rowWrapper}>
      <Pressable style={ss.deleteLayer} onPress={() => runOnJS(showDeleteAlert)()}>
        <MaterialIcons name="delete" size={20} color="#fff" />
        <Text style={ss.deleteLayerLabel}>Delete</Text>
      </Pressable>

      <GestureDetector gesture={pan}>
        <Animated.View style={[ss.docCard, cardAnim]}>
          <View style={[ss.docBar, { backgroundColor: catStyle.bar }]} />
          <View style={[ss.docIconWrap, { backgroundColor: catStyle.bg }]}>
            <MaterialIcons name={icon} size={20} color={catStyle.text} />
          </View>
          <View style={ss.docInfo}>
            <Text style={ss.docName} numberOfLines={1}>{item.filename}</Text>
            <View style={ss.docMeta}>
              <View style={[ss.catChip, { backgroundColor: catStyle.bg }]}>
                <Text style={[ss.catChipText, { color: catStyle.text }]}>{item.category}</Text>
              </View>
              <Text style={ss.docDate}>{formatDate(item.uploaded_at)}</Text>
              {expiry === "expiring" && (
                <View style={[ss.expiryBadge, { backgroundColor: C.amberBg }]}>
                  <MaterialIcons name="warning" size={10} color={C.amber} />
                  <Text style={[ss.expiryBadgeText, { color: C.amber }]}>Expiring</Text>
                </View>
              )}
              {expiry === "expired" && (
                <View style={[ss.expiryBadge, { backgroundColor: C.errorBg }]}>
                  <MaterialIcons name="error" size={10} color={C.error} />
                  <Text style={[ss.expiryBadgeText, { color: C.error }]}>Expired</Text>
                </View>
              )}
            </View>
          </View>
          <Pressable style={ss.moreBtn} hitSlop={12}>
            <MaterialIcons name="more-vert" size={20} color={C.muted} />
          </Pressable>
        </Animated.View>
      </GestureDetector>
    </View>
  );
}

// ── Skeleton ──────────────────────────────────────────────────────────────────
function SkeletonRow() {
  return (
    <View style={[ss.docCard, { opacity: 0.28, marginBottom: 10 }]}>
      <View style={[ss.docBar, { backgroundColor: C.border }]} />
      <View style={[ss.docIconWrap, { backgroundColor: C.border }]} />
      <View style={ss.docInfo}>
        <View style={[ss.skel, { width: "62%", height: 13, marginBottom: 8 }]} />
        <View style={[ss.skel, { width: "38%", height: 10 }]} />
      </View>
    </View>
  );
}

// ── Stats strip ───────────────────────────────────────────────────────────────
function StatsStrip({ docs }: { docs: Document[] }) {
  const verified = docs.filter((d) => !d.expiry_date || expiryStatus(d.expiry_date) === "ok").length;
  const expiring = docs.filter((d) => expiryStatus(d.expiry_date) === "expiring").length;
  const expired  = docs.filter((d) => expiryStatus(d.expiry_date) === "expired").length;

  const chips = [
    { label: `${docs.length} Total`,   icon: "folder"   as const, color: C.burs,        bg: C.bursBg      },
    { label: `${verified} Verified`,   icon: "verified" as const, color: C.secondaryText,bg: C.secondaryBg },
    { label: `${expiring} Expiring`,   icon: "warning"  as const, color: C.amber,        bg: C.amberBg     },
    { label: `${expired} Expired`,     icon: "error"    as const, color: C.error,        bg: C.errorBg     },
  ];

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={ss.statsRow}>
      {chips.map((c) => (
        <View key={c.label} style={[ss.statChip, { backgroundColor: c.bg }]}>
          <MaterialIcons name={c.icon} size={14} color={c.color} />
          <Text style={[ss.statLabel, { color: c.color }]}>{c.label}</Text>
        </View>
      ))}
    </ScrollView>
  );
}

// ── Folder grid ───────────────────────────────────────────────────────────────
function FolderGrid({ docs, onSelect }: { docs: Document[]; onSelect: (f: Filter) => void }) {
  const counts = useMemo(() => {
    const map: Record<string, number> = {};
    docs.forEach((d) => { map[d.category] = (map[d.category] ?? 0) + 1; });
    return Object.entries(map);
  }, [docs]);

  if (!counts.length) return null;
  return (
    <View style={ss.folderGrid}>
      {counts.map(([cat, count]) => {
        const c = cs(cat);
        return (
          <Pressable key={cat} style={({ pressed }) => [ss.folderCard, pressed && { opacity: 0.75 }]} onPress={() => onSelect(cat as Filter)}>
            <View style={[ss.folderIconWrap, { backgroundColor: c.bg }]}>
              <MaterialIcons name="folder" size={26} color={c.bar} />
            </View>
            <Text style={ss.folderName}>{cat}</Text>
            <Text style={ss.folderCount}>{count} doc{count !== 1 ? "s" : ""}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

// ── Empty state ───────────────────────────────────────────────────────────────
// FE-11: proper empty state
function EmptyState({ query, category, onUpload }: { query: string; category: Filter; onUpload: () => void }) {
  if (query) return (
    <View style={ss.emptyBox}>
      <MaterialIcons name="search-off" size={48} color={C.border} />
      <Text style={ss.emptyTitle}>No results</Text>
      <Text style={ss.emptyDesc}>No documents matched "{query}".</Text>
    </View>
  );
  return (
    <View style={ss.emptyBox}>
      <MaterialIcons name="folder-open" size={52} color={C.border} />
      <Text style={ss.emptyTitle}>
        {category === "ALL" ? "Vault is empty" : `No ${category} documents`}
      </Text>
      <Text style={ss.emptyDesc}>
        {category === "ALL"
          ? "Upload your first compliance document to get started."
          : `You have no ${category} documents yet. Tap upload to add one.`}
      </Text>
      <Pressable style={ss.emptyUploadBtn} onPress={onUpload}>
        <MaterialIcons name="upload-file" size={16} color="#fff" />
        <Text style={ss.emptyUploadText}>Upload Document</Text>
      </Pressable>
    </View>
  );
}

// ── Source picker modal ───────────────────────────────────────────────────────
// FE-10: camera vs file picker
function SourcePickerModal({
  visible,
  onClose,
  onCamera,
  onFiles,
}: {
  visible: boolean;
  onClose: () => void;
  onCamera: () => void;
  onFiles: () => void;
}) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={src.backdrop} onPress={onClose}>
        <View style={src.sheet}>
          <View style={src.handle} />
          <Text style={src.title}>Add Document</Text>
          <Text style={src.subtitle}>Choose how to add your document</Text>

          <Pressable style={src.option} onPress={() => { onClose(); onCamera(); }}>
            <View style={[src.optionIcon, { backgroundColor: C.cipaBg }]}>
              <MaterialIcons name="camera-alt" size={26} color={C.cipaBar} />
            </View>
            <View style={src.optionText}>
              <Text style={src.optionTitle}>Camera</Text>
              <Text style={src.optionDesc}>Scan or photograph a document</Text>
            </View>
            <MaterialIcons name="chevron-right" size={20} color={C.muted} />
          </Pressable>

          <Pressable style={src.option} onPress={() => { onClose(); onFiles(); }}>
            <View style={[src.optionIcon, { backgroundColor: C.bursBg }]}>
              <MaterialIcons name="upload-file" size={26} color={C.burs} />
            </View>
            <View style={src.optionText}>
              <Text style={src.optionTitle}>Files / Gallery</Text>
              <Text style={src.optionDesc}>PDF, image or document from storage</Text>
            </View>
            <MaterialIcons name="chevron-right" size={20} color={C.muted} />
          </Pressable>

          <Pressable style={src.cancelBtn} onPress={onClose}>
            <Text style={src.cancelText}>Cancel</Text>
          </Pressable>
        </View>
      </Pressable>
    </Modal>
  );
}
const src = StyleSheet.create({
  backdrop:    { flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "flex-end" },
  sheet:       { backgroundColor: C.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 40 },
  handle:      { width: 40, height: 4, backgroundColor: C.border, borderRadius: 2, alignSelf: "center", marginBottom: 20 },
  title:       { fontSize: 18, fontFamily: "PublicSans_700Bold", color: C.primary, marginBottom: 4 },
  subtitle:    { fontSize: 13, fontFamily: "PublicSans_400Regular", color: C.muted, marginBottom: 20 },
  option:      { flexDirection: "row", alignItems: "center", gap: 14, padding: 14, borderRadius: 14, borderWidth: 1, borderColor: C.border, marginBottom: 12, backgroundColor: C.bg },
  optionIcon:  { width: 48, height: 48, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  optionText:  { flex: 1 },
  optionTitle: { fontSize: 15, fontFamily: "PublicSans_700Bold", color: C.primary, marginBottom: 2 },
  optionDesc:  { fontSize: 12, fontFamily: "PublicSans_400Regular", color: C.muted },
  cancelBtn:   { marginTop: 4, paddingVertical: 14, alignItems: "center", borderRadius: 12, borderWidth: 1, borderColor: C.border },
  cancelText:  { fontSize: 15, fontFamily: "PublicSans_600SemiBold", color: C.mid },
});

// ── Upload Sheet ──────────────────────────────────────────────────────────────
// FE-11: progress bar + error state
function UploadSheet({
  visible,
  onClose,
  pickedFile,
  onPickFile,
  onPickCamera,
}: {
  visible: boolean;
  onClose: () => void;
  pickedFile: { name: string; uri: string; mimeType: string } | null;
  onPickFile: () => void;
  onPickCamera: () => void;
}) {
  const qc = useQueryClient();
  const { mutateAsync: uploadDoc } = useUploadDocument();
  const { addToQueue } = useOfflineQueue(() => qc.invalidateQueries({ queryKey: ["documents"] }));

  const [category,  setCategory]  = useState<Category>("BURS");
  const [expiry,    setExpiry]    = useState("");
  const [progress,  setProgress]  = useState(0);
  const [uploading, setUploading] = useState(false);
  const [uploadErr, setUploadErr] = useState<string | null>(null);
  const [done,      setDone]      = useState(false);

  const reset = () => { setProgress(0); setUploading(false); setUploadErr(null); setDone(false); setExpiry(""); };

  const handleClose = () => { reset(); onClose(); };

  const handleUpload = async () => {
    if (!pickedFile) { Alert.alert("No file", "Please select a file first."); return; }
    setUploading(true);
    setUploadErr(null);
    setProgress(0);

    // Simulate incremental progress while reading file (FE-11)
    const tick = setInterval(() => {
      setProgress((p) => (p < 60 ? p + 10 : p));
    }, 120);

    try {
      const base64 = await FileSystem.readAsStringAsync(pickedFile.uri, {
        encoding: FileSystem.EncodingType.Base64,
      });
      clearInterval(tick);
      setProgress(75);

      await uploadDoc({
        filename:    pickedFile.name,
        category,
        expiry_date: expiry || undefined,
        fileBase64:  base64,
        mimeType:    pickedFile.mimeType,
      });

      setProgress(100);
      setDone(true);
      setTimeout(handleClose, 900);
    } catch (err: any) {
      clearInterval(tick);
      if (!err?.response) {
        // Offline — queue it
        const base64 = await FileSystem.readAsStringAsync(pickedFile.uri, {
          encoding: FileSystem.EncodingType.Base64,
        });
        await addToQueue({
          method: "POST",
          url:    "/documents",
          body:   JSON.stringify({ filename: pickedFile.name, category, expiry_date: expiry || undefined, fileBase64: base64, mimeType: pickedFile.mimeType }),
        });
        Alert.alert("Saved Offline", "Upload queued — will sync when you reconnect.", [{ text: "OK", onPress: handleClose }]);
      } else {
        setUploadErr(err?.response?.data?.detail ?? "Upload failed. Please try again.");
        setUploading(false);
        setProgress(0);
      }
    }
  };

  if (!visible) return null;

  return (
    <View style={us.backdrop}>
      <Pressable style={us.dismiss} onPress={handleClose} />
      <View style={us.sheet}>
        <View style={us.handle} />
        <Text style={us.title}>Upload Document</Text>

        {/* File picker area */}
        <View style={us.fileRow}>
          <Pressable style={us.fileBtn} onPress={onPickFile}>
            <MaterialIcons name="upload-file" size={20} color={C.burs} />
            <Text style={us.fileBtnText}>Files</Text>
          </Pressable>
          <Pressable style={us.fileBtn} onPress={onPickCamera}>
            <MaterialIcons name="camera-alt" size={20} color={C.cipaBar} />
            <Text style={us.fileBtnText}>Camera</Text>
          </Pressable>
        </View>

        {/* Picked file display */}
        {pickedFile ? (
          <View style={us.pickedFile}>
            <MaterialIcons name={fileIcon(pickedFile.name)} size={22} color={C.cipaBar} />
            <Text style={us.pickedFileName} numberOfLines={1}>{pickedFile.name}</Text>
            <MaterialIcons name="check-circle" size={18} color={C.secondaryText} />
          </View>
        ) : (
          <View style={us.noFile}>
            <MaterialIcons name="cloud-upload" size={28} color={C.border} />
            <Text style={us.noFileText}>No file selected yet</Text>
          </View>
        )}

        {/* Category selector */}
        <Text style={us.label}>Category</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={us.catRow}>
          {CATEGORIES.map((cat) => {
            const c = cs(cat);
            const active = category === cat;
            return (
              <Pressable
                key={cat}
                style={[us.catPill, active && { backgroundColor: c.bg, borderColor: c.bar }]}
                onPress={() => setCategory(cat)}
              >
                <Text style={[us.catPillText, active && { color: c.text }]}>{cat}</Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {/* Expiry */}
        <Text style={us.label}>Expiry Date <Text style={us.optional}>(optional · YYYY-MM-DD)</Text></Text>
        <TextInput
          style={us.textField}
          placeholder="e.g. 2025-12-31"
          placeholderTextColor={C.muted}
          value={expiry}
          onChangeText={setExpiry}
          keyboardType="numbers-and-punctuation"
        />

        {/* FE-11: Progress bar */}
        {uploading && <UploadProgressBar progress={progress} />}

        {/* FE-11: Error state */}
        {uploadErr && (
          <View style={us.errorRow}>
            <MaterialIcons name="error-outline" size={15} color={C.error} />
            <Text style={us.errorText}>{uploadErr}</Text>
          </View>
        )}

        {/* FE-11: Success state */}
        {done && (
          <View style={us.successRow}>
            <MaterialIcons name="check-circle" size={15} color={C.secondaryText} />
            <Text style={us.successText}>Uploaded successfully!</Text>
          </View>
        )}

        <Pressable
          style={({ pressed }) => [us.submitBtn, pressed && { opacity: 0.8 }, (uploading || done) && { opacity: 0.55 }]}
          onPress={handleUpload}
          disabled={uploading || done}
        >
          {uploading
            ? <ActivityIndicator color="#fff" size="small" />
            : <Text style={us.submitText}>Upload to Vault</Text>
          }
        </Pressable>
      </View>
    </View>
  );
}

const us = StyleSheet.create({
  backdrop:      { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "flex-end", zIndex: 100 },
  dismiss:       { flex: 1 },
  sheet:         { backgroundColor: C.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 48, gap: 12 },
  handle:        { width: 40, height: 4, backgroundColor: C.border, borderRadius: 2, alignSelf: "center", marginBottom: 4 },
  title:         { fontSize: 18, fontFamily: "PublicSans_700Bold", color: C.primary },
  fileRow:       { flexDirection: "row", gap: 10 },
  fileBtn:       { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 12, borderRadius: 12, borderWidth: 1, borderColor: C.border, backgroundColor: C.bg },
  fileBtnText:   { fontSize: 14, fontFamily: "PublicSans_600SemiBold", color: C.primary },
  pickedFile:    { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: C.cipaBg, borderRadius: 10, padding: 12 },
  pickedFileName:{ flex: 1, fontSize: 13, fontFamily: "PublicSans_600SemiBold", color: C.primary },
  noFile:        { alignItems: "center", gap: 6, paddingVertical: 18, borderWidth: 1, borderColor: C.border, borderStyle: "dashed", borderRadius: 12, backgroundColor: C.bg },
  noFileText:    { fontSize: 13, color: C.muted, fontFamily: "PublicSans_400Regular" },
  label:         { fontSize: 12, fontFamily: "PublicSans_600SemiBold", color: C.mid },
  optional:      { color: C.muted, fontFamily: "PublicSans_400Regular" },
  catRow:        { gap: 8, paddingVertical: 2 },
  catPill:       { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, borderWidth: 1, borderColor: C.border, backgroundColor: C.surface },
  catPillText:   { fontSize: 12, fontFamily: "PublicSans_600SemiBold", color: C.muted },
  textField:     { backgroundColor: C.bg, borderWidth: 1, borderColor: C.border, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 11, fontSize: 14, fontFamily: "PublicSans_400Regular", color: C.primary },
  errorRow:      { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: C.errorBg, borderRadius: 8, padding: 10 },
  errorText:     { flex: 1, fontSize: 12, fontFamily: "PublicSans_400Regular", color: C.error },
  successRow:    { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: C.secondaryBg, borderRadius: 8, padding: 10 },
  successText:   { fontSize: 12, fontFamily: "PublicSans_600SemiBold", color: C.secondaryText },
  submitBtn:     { backgroundColor: C.primary, borderRadius: 12, paddingVertical: 14, alignItems: "center" },
  submitText:    { color: "#fff", fontSize: 15, fontFamily: "PublicSans_700Bold" },
});

// ── Vault Screen ──────────────────────────────────────────────────────────────
export default function VaultScreen() {
  const [searchQuery,    setSearchQuery]    = useState("");
  const [activeFilter,   setActiveFilter]   = useState<Filter>("ALL");
  const [showSource,     setShowSource]     = useState(false);
  const [showUpload,     setShowUpload]     = useState(false);
  const [pickedFile,     setPickedFile]     = useState<{ name: string; uri: string; mimeType: string } | null>(null);
  const [refreshing,     setRefreshing]     = useState(false);

  const qc = useQueryClient();
  const { data: docs = [], isLoading, isError, refetch } = useDocuments(
    activeFilter === "ALL" ? undefined : activeFilter
  );
  const { mutate: deleteDoc } = useDeleteDocument();
  const { addToQueue } = useOfflineQueue(() => qc.invalidateQueries({ queryKey: ["documents"] }));

  const filtered = useMemo(() => {
    if (!searchQuery.trim()) return docs;
    const q = searchQuery.toLowerCase();
    return docs.filter(
      (d) => d.filename.toLowerCase().includes(q) || d.category.toLowerCase().includes(q)
    );
  }, [docs, searchQuery]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }, [refetch]);

  // FE-10: Camera via expo-image-picker
  const handleCamera = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permission needed", "Camera access is required to scan documents.");
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.85,
      allowsEditing: true,
    });
    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      const name  = `scan_${Date.now()}.jpg`;
      setPickedFile({ name, uri: asset.uri, mimeType: "image/jpeg" });
      setShowUpload(true);
    }
  };

  // FE-10: File picker via expo-document-picker
  const handleFiles = async () => {
    const result = await DocumentPicker.getDocumentAsync({
      type: ["application/pdf", "image/*"],
      copyToCacheDirectory: true,
    });
    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      setPickedFile({ name: asset.name, uri: asset.uri, mimeType: asset.mimeType ?? "application/octet-stream" });
      setShowUpload(true);
    }
  };

  const handleDelete = useCallback(async (id: number) => {
    try {
      deleteDoc(id);
    } catch (err: any) {
      if (!err?.response) {
        await addToQueue({ method: "DELETE", url: `/documents/${id}` });
      }
    }
  }, [deleteDoc, addToQueue]);

  return (
    <SafeAreaView style={ss.safe} edges={["top"]}>
      <StatusBar barStyle="dark-content" backgroundColor={C.container} />

      {/* Top bar */}
      <View style={ss.topBar}>
        <View style={ss.topBarLeft}>
          <MaterialIcons name="lock" size={20} color={C.primary} />
          <Text style={ss.appTitle}>Compliance Vault</Text>
        </View>
        <Pressable
          style={ss.addTaskBtn}
          onPress={() => router.push("/add-task" as any)}
          hitSlop={8}
        >
          <MaterialIcons name="add-task" size={16} color={C.primary} />
          <Text style={ss.addTaskText}>Add Task</Text>
        </Pressable>
      </View>

      <ScrollView
        style={ss.scroll}
        contentContainerStyle={ss.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.cipaBar} />}
      >
        {/* Search bar */}
        <View style={ss.searchWrap}>
          <MaterialIcons name="search" size={19} color={C.muted} />
          <TextInput
            style={ss.searchInput}
            placeholder="Search documents…"
            placeholderTextColor={C.muted}
            value={searchQuery}
            onChangeText={setSearchQuery}
            returnKeyType="search"
          />
          {searchQuery.length > 0 && (
            <Pressable onPress={() => setSearchQuery("")} hitSlop={8}>
              <MaterialIcons name="close" size={17} color={C.muted} />
            </Pressable>
          )}
        </View>

        {/* Stats */}
        {!isLoading && docs.length > 0 && <StatsStrip docs={docs} />}

        {/* Filter chips */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={ss.filterRow}>
          {FILTERS.map((f) => (
            <Pressable
              key={f}
              style={[ss.filterChip, activeFilter === f && ss.filterChipActive]}
              onPress={() => setActiveFilter(f)}
            >
              <Text style={[ss.filterText, activeFilter === f && ss.filterTextActive]}>{f}</Text>
            </Pressable>
          ))}
        </ScrollView>

        {/* Loading skeletons */}
        {isLoading && <><SkeletonRow /><SkeletonRow /><SkeletonRow /></>}

        {/* FE-11: Error state */}
        {isError && (
          <View style={ss.errorBox}>
            <MaterialIcons name="cloud-off" size={40} color={C.error} />
            <Text style={ss.errorTitle}>Could not load documents</Text>
            <Text style={ss.errorDesc}>Check your connection and try again.</Text>
            <Pressable style={ss.retryBtn} onPress={() => refetch()}>
              <Text style={ss.retryText}>Retry</Text>
            </Pressable>
          </View>
        )}

        {/* Document list */}
        {!isLoading && !isError && (
          <>
            {filtered.length > 0 && (
              <>
                <View style={ss.sectionHeader}>
                  <Text style={ss.sectionTitle}>
                    {activeFilter === "ALL" ? "All Documents" : activeFilter}
                  </Text>
                  <Text style={ss.sectionCount}>{filtered.length}</Text>
                </View>
                {filtered.map((doc) => (
                  <SwipeableDocumentRow key={doc.id} item={doc} onDelete={handleDelete} />
                ))}
              </>
            )}

            {/* FE-11: Empty state */}
            {filtered.length === 0 && (
              <EmptyState
                query={searchQuery}
                category={activeFilter}
                onUpload={() => setShowSource(true)}
              />
            )}

            {/* Folder grid */}
            {activeFilter === "ALL" && !searchQuery && docs.length > 0 && (
              <>
                <View style={ss.sectionHeader}>
                  <Text style={ss.sectionTitle}>Browse by Category</Text>
                </View>
                <FolderGrid docs={docs} onSelect={(f) => { setActiveFilter(f); setSearchQuery(""); }} />
              </>
            )}
          </>
        )}

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* FE-10: Source picker (camera vs files) */}
      <SourcePickerModal
        visible={showSource}
        onClose={() => setShowSource(false)}
        onCamera={() => handleCamera()}
        onFiles={() => handleFiles()}
      />

      {/* Upload sheet with progress */}
      <UploadSheet
        visible={showUpload}
        onClose={() => { setShowUpload(false); setPickedFile(null); }}
        pickedFile={pickedFile}
        onPickFile={handleFiles}
        onPickCamera={handleCamera}
      />

      {/* FAB */}
      <Pressable style={ss.fab} onPress={() => setShowSource(true)}>
        <MaterialIcons name="add" size={26} color="#fff" />
      </Pressable>
    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const ss = StyleSheet.create({
  safe:           { flex: 1, backgroundColor: C.bg },
  scroll:         { flex: 1 },
  scrollContent:  { paddingHorizontal: 16, paddingTop: 8 },

  // Top bar
  topBar:         { flexDirection: "row", justifyContent: "space-between", alignItems: "center", height: 56, paddingHorizontal: 16, backgroundColor: C.container, borderBottomWidth: 1, borderBottomColor: C.border },
  topBarLeft:     { flexDirection: "row", alignItems: "center", gap: 10 },
  appTitle:       { fontSize: 17, fontFamily: "PublicSans_700Bold", color: C.primary },
  addTaskBtn:     { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 10, borderWidth: 1, borderColor: C.border, backgroundColor: C.surface },
  addTaskText:    { fontSize: 12, fontFamily: "PublicSans_600SemiBold", color: C.primary },

  // Search
  searchWrap:     { flexDirection: "row", alignItems: "center", backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, borderRadius: 12, height: 48, paddingHorizontal: 14, marginTop: 16, gap: 10 },
  searchInput:    { flex: 1, fontSize: 14, fontFamily: "PublicSans_400Regular", color: C.primary },

  // Stats
  statsRow:       { paddingVertical: 12, gap: 8 },
  statChip:       { flexDirection: "row", alignItems: "center", paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999, gap: 5 },
  statLabel:      { fontSize: 11, fontFamily: "PublicSans_600SemiBold" },

  // Filters
  filterRow:      { paddingVertical: 12, gap: 8 },
  filterChip:     { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 999, backgroundColor: C.container, borderWidth: 1, borderColor: C.border },
  filterChipActive:{ backgroundColor: C.primary, borderColor: C.primary },
  filterText:     { fontSize: 12, fontFamily: "PublicSans_600SemiBold", color: C.muted },
  filterTextActive:{ color: "#fff" },

  // Section
  sectionHeader:  { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 8, marginBottom: 12, paddingHorizontal: 2 },
  sectionTitle:   { fontSize: 16, fontFamily: "PublicSans_700Bold", color: C.primary },
  sectionCount:   { fontSize: 12, fontFamily: "PublicSans_600SemiBold", color: C.muted, backgroundColor: C.containerLow, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 99 },

  // Swipeable doc row
  rowWrapper:     { marginBottom: 10, borderRadius: 14, overflow: "hidden", position: "relative" },
  deleteLayer:    { position: "absolute", right: 0, top: 0, bottom: 0, width: DELETE_WIDTH, backgroundColor: C.error, alignItems: "center", justifyContent: "center", gap: 3 },
  deleteLayerLabel:{ color: "#fff", fontSize: 10, fontFamily: "PublicSans_600SemiBold" },
  docCard:        { flexDirection: "row", alignItems: "center", backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, borderRadius: 14, overflow: "hidden", gap: 12 },
  docBar:         { width: 4, alignSelf: "stretch" },
  docIconWrap:    { width: 40, height: 40, borderRadius: 10, alignItems: "center", justifyContent: "center", marginLeft: 4 },
  docInfo:        { flex: 1, paddingVertical: 14 },
  docName:        { fontSize: 13, fontFamily: "PublicSans_700Bold", color: C.primary, marginBottom: 5 },
  docMeta:        { flexDirection: "row", alignItems: "center", gap: 7, flexWrap: "wrap" },
  catChip:        { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  catChipText:    { fontSize: 9, fontFamily: "PublicSans_700Bold", letterSpacing: 0.4, textTransform: "uppercase" },
  docDate:        { fontSize: 11, color: C.muted, fontFamily: "PublicSans_400Regular" },
  expiryBadge:    { flexDirection: "row", alignItems: "center", gap: 3, paddingHorizontal: 5, paddingVertical: 2, borderRadius: 4 },
  expiryBadgeText:{ fontSize: 9, fontFamily: "PublicSans_600SemiBold" },
  moreBtn:        { padding: 14 },
  skel:           { backgroundColor: C.border, borderRadius: 4 },

  // Error state
  errorBox:       { alignItems: "center", paddingVertical: 48, gap: 10 },
  errorTitle:     { fontSize: 16, fontFamily: "PublicSans_700Bold", color: C.primary },
  errorDesc:      { fontSize: 13, color: C.muted, textAlign: "center" },
  retryBtn:       { marginTop: 6, paddingHorizontal: 22, paddingVertical: 10, backgroundColor: C.primary, borderRadius: 10 },
  retryText:      { color: "#fff", fontFamily: "PublicSans_600SemiBold", fontSize: 13 },

  // Empty state
  emptyBox:       { alignItems: "center", paddingVertical: 52, gap: 10 },
  emptyTitle:     { fontSize: 17, fontFamily: "PublicSans_700Bold", color: C.primary },
  emptyDesc:      { fontSize: 13, color: C.muted, textAlign: "center", lineHeight: 19, maxWidth: 260 },
  emptyUploadBtn: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 8, paddingHorizontal: 20, paddingVertical: 12, backgroundColor: C.primary, borderRadius: 12 },
  emptyUploadText:{ color: "#fff", fontSize: 14, fontFamily: "PublicSans_700Bold" },

  // Folder grid
  folderGrid:     { flexDirection: "row", flexWrap: "wrap", gap: 12, marginBottom: 8 },
  folderCard:     { width: (width - 44) / 2, backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, borderRadius: 14, padding: 14, gap: 6 },
  folderIconWrap: { width: 44, height: 44, borderRadius: 11, alignItems: "center", justifyContent: "center" },
  folderName:     { fontSize: 13, fontFamily: "PublicSans_700Bold", color: C.primary },
  folderCount:    { fontSize: 11, color: C.muted, fontFamily: "PublicSans_400Regular" },

  // FAB
  fab:            { position: "absolute", right: 16, bottom: 90, backgroundColor: C.primary, width: 52, height: 52, borderRadius: 14, justifyContent: "center", alignItems: "center", shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 8, elevation: 6 },
});