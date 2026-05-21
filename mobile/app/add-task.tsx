// mobile/app/add-task.tsx
// FE-12: Add Custom Task screen — name, category, due date picker, recurrence toggle
import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { MaterialIcons } from "@expo/vector-icons";
import { useCreateCustomDeadline } from "@/hooks/useDeadlines";
import { useOfflineQueue } from "@/hooks/useOfflineQueue";
import { useQueryClient } from "@tanstack/react-query";

// ── Design tokens ─────────────────────────────────────────────────────────────
const C = {
  bg:           "#f3faff",
  surface:      "#ffffff",
  primary:      "#000b25",
  mid:          "#44474e",
  muted:        "#75777f",
  border:       "#c5c6cf",
  borderSoft:   "#e6f6ff",
  secondary:    "#2a6b2c",
  secondaryBg:  "#acf4a4",
  error:        "#ba1a1a",
  errorBg:      "#ffdad6",
  amber:        "#D4830A",
  amberBg:      "#FEF3E2",
  burs:         "#1A3C5E",
  bursBg:       "#EAF0F7",
  cipaBar:      "#2E6B4F",
  cipaBg:       "#E8F4EE",
  labour:       "#6B3A7D",
  labourBg:     "#F3EEF7",
  custom:       "#7D5A1E",
  customBg:     "#F7F1E8",
  container:    "#dbf1fe",
  containerLow: "#e6f6ff",
};

const CATEGORIES = [
  { value: "BURS",   label: "BURS",   bg: C.bursBg,   text: C.burs    },
  { value: "CIPA",   label: "CIPA",   bg: C.cipaBg,   text: C.cipaBar },
  { value: "LABOUR", label: "LABOUR", bg: C.labourBg, text: C.labour  },
  { value: "CUSTOM", label: "CUSTOM", bg: C.customBg, text: C.custom  },
] as const;

type Category = typeof CATEGORIES[number]["value"];

const RECURRENCES = [
  { value: null,        label: "None"       },
  { value: "monthly",   label: "Monthly"    },
  { value: "quarterly", label: "Quarterly"  },
  { value: "annually",  label: "Annually"   },
] as const;

type Recurrence = "monthly" | "quarterly" | "annually" | null;

// ── Simple date wheel picker ──────────────────────────────────────────────────
function DatePicker({
  value,
  onChange,
}: {
  value: string; // YYYY-MM-DD
  onChange: (v: string) => void;
}) {
  const today = new Date();
  const [year,  setYear]  = useState(value ? parseInt(value.slice(0, 4)) : today.getFullYear());
  const [month, setMonth] = useState(value ? parseInt(value.slice(5, 7)) : today.getMonth() + 1);
  const [day,   setDay]   = useState(value ? parseInt(value.slice(8, 10)) : today.getDate());

  const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const daysInMonth = new Date(year, month, 0).getDate();
  const years = Array.from({ length: 5 }, (_, i) => today.getFullYear() + i);

  const emit = (y: number, m: number, d: number) => {
    const safeDay = Math.min(d, new Date(y, m, 0).getDate());
    onChange(`${y}-${String(m).padStart(2, "0")}-${String(safeDay).padStart(2, "0")}`);
  };

  const Spinner = ({
    items,
    selected,
    onSelect,
    display,
  }: {
    items: (string | number)[];
    selected: string | number;
    onSelect: (v: any) => void;
    display?: (v: any) => string;
  }) => (
    <ScrollView
      style={ss.spinnerScroll}
      showsVerticalScrollIndicator={false}
      snapToInterval={40}
      decelerationRate="fast"
    >
      {items.map((item) => (
        <Pressable
          key={String(item)}
          style={[ss.spinnerItem, selected === item && ss.spinnerItemActive]}
          onPress={() => onSelect(item)}
        >
          <Text style={[ss.spinnerText, selected === item && ss.spinnerTextActive]}>
            {display ? display(item) : String(item)}
          </Text>
        </Pressable>
      ))}
    </ScrollView>
  );

  return (
    <View style={ss.datePickerWrap}>
      <View style={ss.datePickerInner}>
        {/* Day */}
        <View style={ss.spinnerCol}>
          <Text style={ss.spinnerLabel}>Day</Text>
          <Spinner
            items={Array.from({ length: daysInMonth }, (_, i) => i + 1)}
            selected={day}
            onSelect={(d: number) => { setDay(d); emit(year, month, d); }}
            display={(v) => String(v).padStart(2, "0")}
          />
        </View>
        {/* Month */}
        <View style={ss.spinnerCol}>
          <Text style={ss.spinnerLabel}>Month</Text>
          <Spinner
            items={Array.from({ length: 12 }, (_, i) => i + 1)}
            selected={month}
            onSelect={(m: number) => { setMonth(m); emit(year, m, day); }}
            display={(v) => MONTHS[v - 1]}
          />
        </View>
        {/* Year */}
        <View style={ss.spinnerCol}>
          <Text style={ss.spinnerLabel}>Year</Text>
          <Spinner
            items={years}
            selected={year}
            onSelect={(y: number) => { setYear(y); emit(y, month, day); }}
          />
        </View>
      </View>
      {/* Selection highlight overlay */}
      <View pointerEvents="none" style={ss.datePickerHighlight} />
    </View>
  );
}

// ── Add Task Screen ───────────────────────────────────────────────────────────
export default function AddTaskScreen() {
  const qc = useQueryClient();
  const { mutateAsync: createDeadline, isPending } = useCreateCustomDeadline();
  const { addToQueue } = useOfflineQueue(() => {
    qc.invalidateQueries({ queryKey: ["deadlines"] });
  });

  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const defaultDate = tomorrow.toISOString().slice(0, 10);

  const [name,        setName]        = useState("");
  const [category,    setCategory]    = useState<Category>("CUSTOM");
  const [dueDate,     setDueDate]     = useState(defaultDate);
  const [notes,       setNotes]       = useState("");
  const [recurrence,  setRecurrence]  = useState<Recurrence>(null);
  const [recurring,   setRecurring]   = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [nameError,   setNameError]   = useState("");

  const validate = () => {
    if (!name.trim()) { setNameError("Task name is required."); return false; }
    setNameError("");
    return true;
  };

  const handleSubmit = async () => {
    if (!validate()) return;

    const payload = {
      name: name.trim(),
      category,
      due_date: dueDate,
      notes: notes.trim() || undefined,
      recurrence: recurring ? recurrence ?? undefined : undefined,
    };

    try {
      await createDeadline(payload as any);
      router.back();
    } catch (err: any) {
      if (!err?.response) {
        // Offline — queue it
        await addToQueue({
          method: "POST",
          url: "/deadlines/custom",
          body: JSON.stringify(payload),
        });
        Alert.alert(
          "Saved Offline",
          "You're offline. This task will be synced automatically when you reconnect.",
          [{ text: "OK", onPress: () => router.back() }]
        );
      } else {
        Alert.alert("Error", err?.response?.data?.detail?.message ?? "Failed to create task.");
      }
    }
  };

  const formattedDate = new Date(dueDate + "T00:00:00").toLocaleDateString("en-BW", {
    weekday: "short", day: "numeric", month: "long", year: "numeric",
  });

  return (
    <SafeAreaView style={ss.safe} edges={["top"]}>
      <StatusBar barStyle="dark-content" backgroundColor={C.container} />

      {/* Header */}
      <View style={ss.header}>
        <Pressable style={ss.backBtn} onPress={() => router.back()} hitSlop={8}>
          <MaterialIcons name="arrow-back" size={22} color={C.primary} />
        </Pressable>
        <Text style={ss.headerTitle}>Add Custom Task</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView
        style={ss.scroll}
        contentContainerStyle={ss.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Task name */}
        <View style={ss.fieldGroup}>
          <Text style={ss.fieldLabel}>Task Name <Text style={ss.required}>*</Text></Text>
          <TextInput
            style={[ss.textField, nameError && ss.textFieldError]}
            placeholder="e.g. Submit VAT Return"
            placeholderTextColor={C.muted}
            value={name}
            onChangeText={(v) => { setName(v); if (v.trim()) setNameError(""); }}
            returnKeyType="next"
            maxLength={120}
          />
          {nameError ? (
            <View style={ss.fieldErrorRow}>
              <MaterialIcons name="error" size={13} color={C.error} />
              <Text style={ss.fieldError}>{nameError}</Text>
            </View>
          ) : null}
        </View>

        {/* Category */}
        <View style={ss.fieldGroup}>
          <Text style={ss.fieldLabel}>Category</Text>
          <View style={ss.catGrid}>
            {CATEGORIES.map((cat) => {
              const active = category === cat.value;
              return (
                <Pressable
                  key={cat.value}
                  style={[ss.catCard, active && { backgroundColor: cat.bg, borderColor: cat.text }]}
                  onPress={() => setCategory(cat.value)}
                >
                  <View style={[ss.catDot, { backgroundColor: active ? cat.text : C.border }]} />
                  <Text style={[ss.catLabel, active && { color: cat.text, fontFamily: "PublicSans_700Bold" }]}>
                    {cat.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* Due date */}
        <View style={ss.fieldGroup}>
          <Text style={ss.fieldLabel}>Due Date</Text>
          <Pressable
            style={ss.dateTrigger}
            onPress={() => setShowDatePicker(!showDatePicker)}
          >
            <MaterialIcons name="calendar-today" size={18} color={C.cipaBar} />
            <Text style={ss.dateTriggerText}>{formattedDate}</Text>
            <MaterialIcons
              name={showDatePicker ? "expand-less" : "expand-more"}
              size={20}
              color={C.muted}
            />
          </Pressable>
          {showDatePicker && (
            <DatePicker value={dueDate} onChange={setDueDate} />
          )}
        </View>

        {/* Recurrence toggle */}
        <View style={ss.fieldGroup}>
          <View style={ss.toggleRow}>
            <View style={ss.toggleLeft}>
              <MaterialIcons name="repeat" size={18} color={recurring ? C.cipaBar : C.muted} />
              <View>
                <Text style={ss.fieldLabel}>Recurring Task</Text>
                <Text style={ss.fieldHint}>Repeats automatically after completion</Text>
              </View>
            </View>
            <Switch
              value={recurring}
              onValueChange={setRecurring}
              trackColor={{ false: C.border, true: C.cipaBar }}
              thumbColor={C.surface}
            />
          </View>

          {recurring && (
            <View style={ss.recurrenceRow}>
              {RECURRENCES.filter((r) => r.value !== null).map((r) => {
                const active = recurrence === r.value;
                return (
                  <Pressable
                    key={r.value ?? "none"}
                    style={[ss.recurrenceChip, active && ss.recurrenceChipActive]}
                    onPress={() => setRecurrence(r.value as Recurrence)}
                  >
                    <Text style={[ss.recurrenceChipText, active && ss.recurrenceChipTextActive]}>
                      {r.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          )}
        </View>

        {/* Notes */}
        <View style={ss.fieldGroup}>
          <Text style={ss.fieldLabel}>Notes <Text style={ss.fieldOptional}>(optional)</Text></Text>
          <TextInput
            style={[ss.textField, ss.textArea]}
            placeholder="Add any notes, requirements, or reminders…"
            placeholderTextColor={C.muted}
            value={notes}
            onChangeText={setNotes}
            multiline
            numberOfLines={4}
            maxLength={500}
            textAlignVertical="top"
          />
          <Text style={ss.charCount}>{notes.length}/500</Text>
        </View>

        {/* Offline note */}
        <View style={ss.offlineNote}>
          <MaterialIcons name="cloud-off" size={14} color={C.muted} />
          <Text style={ss.offlineNoteText}>
            Tasks saved offline will sync automatically when you reconnect.
          </Text>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Submit */}
      <View style={ss.footer}>
        <Pressable
          style={({ pressed }) => [ss.cancelBtn, pressed && { opacity: 0.7 }]}
          onPress={() => router.back()}
        >
          <Text style={ss.cancelText}>Cancel</Text>
        </Pressable>
        <Pressable
          style={({ pressed }) => [ss.submitBtn, pressed && { opacity: 0.8 }, isPending && { opacity: 0.6 }]}
          onPress={handleSubmit}
          disabled={isPending}
        >
          {isPending
            ? <ActivityIndicator color="#fff" size="small" />
            : (
              <>
                <MaterialIcons name="add-task" size={18} color="#fff" />
                <Text style={ss.submitText}>Save Task</Text>
              </>
            )
          }
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const ss = StyleSheet.create({
  safe:           { flex: 1, backgroundColor: C.bg },
  header:         { flexDirection: "row", alignItems: "center", justifyContent: "space-between", height: 56, paddingHorizontal: 16, backgroundColor: C.container, borderBottomWidth: 1, borderBottomColor: C.border },
  backBtn:        { width: 36, height: 36, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  headerTitle:    { fontSize: 17, fontFamily: "PublicSans_700Bold", color: C.primary },
  scroll:         { flex: 1 },
  scrollContent:  { paddingHorizontal: 16, paddingTop: 20, paddingBottom: 8 },

  // Fields
  fieldGroup:     { marginBottom: 24 },
  fieldLabel:     { fontSize: 13, fontFamily: "PublicSans_600SemiBold", color: C.mid, marginBottom: 8 },
  fieldHint:      { fontSize: 11, fontFamily: "PublicSans_400Regular", color: C.muted, marginTop: 1 },
  fieldOptional:  { color: C.muted, fontFamily: "PublicSans_400Regular" },
  required:       { color: C.error },
  textField:      { backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 13, fontSize: 15, fontFamily: "PublicSans_400Regular", color: C.primary },
  textFieldError: { borderColor: C.error, backgroundColor: C.errorBg },
  textArea:       { height: 100, paddingTop: 13 },
  fieldErrorRow:  { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 5 },
  fieldError:     { fontSize: 12, color: C.error, fontFamily: "PublicSans_400Regular" },
  charCount:      { fontSize: 11, color: C.muted, textAlign: "right", marginTop: 4 },

  // Category grid
  catGrid:        { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  catCard:        { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 14, paddingVertical: 11, borderRadius: 10, borderWidth: 1.5, borderColor: C.border, backgroundColor: C.surface, minWidth: 110 },
  catDot:         { width: 8, height: 8, borderRadius: 4 },
  catLabel:       { fontSize: 13, fontFamily: "PublicSans_600SemiBold", color: C.muted },

  // Date trigger
  dateTrigger:    { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 13 },
  dateTriggerText:{ flex: 1, fontSize: 15, fontFamily: "PublicSans_400Regular", color: C.primary },

  // Date picker drum
  datePickerWrap:  { marginTop: 10, backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, borderRadius: 12, overflow: "hidden" },
  datePickerInner: { flexDirection: "row", height: 200 },
  datePickerHighlight: { position: "absolute", top: "50%", left: 0, right: 0, height: 40, marginTop: -20, backgroundColor: C.containerLow, borderTopWidth: 1, borderBottomWidth: 1, borderColor: C.border, zIndex: -1 },
  spinnerCol:     { flex: 1, alignItems: "center", paddingTop: 8 },
  spinnerLabel:   { fontSize: 10, fontFamily: "PublicSans_600SemiBold", color: C.muted, letterSpacing: 0.8, textTransform: "uppercase", marginBottom: 4 },
  spinnerScroll:  { flex: 1, width: "100%" },
  spinnerItem:    { height: 40, alignItems: "center", justifyContent: "center" },
  spinnerItemActive: { },
  spinnerText:    { fontSize: 15, fontFamily: "PublicSans_400Regular", color: C.muted },
  spinnerTextActive: { fontFamily: "PublicSans_700Bold", color: C.primary },

  // Recurrence toggle
  toggleRow:      { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  toggleLeft:     { flexDirection: "row", alignItems: "center", gap: 12, flex: 1 },
  recurrenceRow:  { flexDirection: "row", gap: 8, marginTop: 12, flexWrap: "wrap" },
  recurrenceChip: { paddingHorizontal: 16, paddingVertical: 9, borderRadius: 999, borderWidth: 1, borderColor: C.border, backgroundColor: C.surface },
  recurrenceChipActive: { backgroundColor: C.containerLow, borderColor: C.cipaBar },
  recurrenceChipText: { fontSize: 13, fontFamily: "PublicSans_600SemiBold", color: C.muted },
  recurrenceChipTextActive: { color: C.cipaBar },

  // Offline note
  offlineNote:    { flexDirection: "row", alignItems: "flex-start", gap: 8, backgroundColor: C.containerLow, borderRadius: 10, padding: 12, marginBottom: 8 },
  offlineNoteText:{ flex: 1, fontSize: 12, fontFamily: "PublicSans_400Regular", color: C.muted, lineHeight: 17 },

  // Footer
  footer:         { flexDirection: "row", gap: 12, paddingHorizontal: 16, paddingVertical: 14, backgroundColor: C.surface, borderTopWidth: 1, borderTopColor: C.border },
  cancelBtn:      { flex: 1, paddingVertical: 14, borderRadius: 12, borderWidth: 1, borderColor: C.border, alignItems: "center" },
  cancelText:     { fontSize: 15, fontFamily: "PublicSans_600SemiBold", color: C.mid },
  submitBtn:      { flex: 2, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 14, borderRadius: 12, backgroundColor: C.primary },
  submitText:     { fontSize: 15, fontFamily: "PublicSans_700Bold", color: "#fff" },
});