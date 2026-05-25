// mobile/app/add-task.tsx
// FE-12: Add Custom Task screen

import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { MaterialIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useCreateCustomDeadline } from "@/hooks/useDeadlines";
import { DEADLINE_CATEGORIES } from "@/constants";
import type { DeadlineCategory } from "@/constants";

const C = {
  bg:        "#f3faff",
  surface:   "#ffffff",
  primary:   "#000b25",
  mid:       "#44474e",
  muted:     "#75777f",
  border:    "#c5c6cf",
  borderSoft:"#e6f6ff",
  container: "#dbf1fe",
  error:     "#ba1a1a",
  errorBg:   "#ffdad6",
  burs:      "#1A3C5E",
  bursBg:    "#EAF0F7",
  cipa:      "#2E6B4F",
  cipaBg:    "#E8F4EE",
  labour:    "#6B3A7D",
  labourBg:  "#F3EEF7",
  custom:    "#7D5A1E",
  customBg:  "#F7F1E8",
};

const CAT: Record<DeadlineCategory, { bg: string; text: string; label: string }> = {
  BURS:   { bg: C.bursBg,   text: C.burs,   label: "BURS" },
  CIPA:   { bg: C.cipaBg,   text: C.cipa,   label: "CIPA" },
  LABOUR: { bg: C.labourBg, text: C.labour, label: "Labour Act" },
  CUSTOM: { bg: C.customBg, text: C.custom, label: "Custom" },
};

const RECURRENCE_OPTIONS = ["monthly", "quarterly", "annually"] as const;
type Recurrence = typeof RECURRENCE_OPTIONS[number];

export default function AddTaskScreen() {
  const router = useRouter();
  const { mutate: createTask, isPending } = useCreateCustomDeadline();

  const [name, setName] = useState("");
  const [category, setCategory] = useState<DeadlineCategory>("CUSTOM");
  const [dueDate, setDueDate] = useState("");
  const [notes, setNotes] = useState("");
  const [recurring, setRecurring] = useState(false);
  const [recurrence, setRecurrence] = useState<Recurrence>("monthly");
  const [errors, setErrors] = useState<{ name?: string; dueDate?: string }>({});

  const validate = (): boolean => {
    const e: typeof errors = {};
    if (!name.trim()) e.name = "Task name is required.";
    if (!dueDate.trim()) {
      e.dueDate = "Due date is required.";
    } else {
      const parsed = new Date(dueDate);
      if (isNaN(parsed.getTime())) {
        e.dueDate = "Enter a valid date (YYYY-MM-DD).";
      } else if (parsed <= new Date()) {
        e.dueDate = "Due date must be in the future.";
      }
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSave = () => {
    if (!validate()) return;
    createTask(
      {
        name: name.trim(),
        category,
        due_date: dueDate,
        notes: notes.trim() || undefined,
        recurrence: recurring ? recurrence : undefined,
      } as any,
      {
        onSuccess: () => router.back(),
        onError: () => Alert.alert("Error", "Could not save task. Please try again."),
      }
    );
  };

  return (
    <SafeAreaView style={s.safe} edges={["top", "bottom"]}>
      {/* Header */}
      <View style={s.header}>
        <Pressable onPress={() => router.back()} style={s.backBtn}>
          <MaterialIcons name="arrow-back" size={22} color={C.primary} />
        </Pressable>
        <Text style={s.title}>Add Custom Task</Text>
        <View style={{ width: 38 }} />
      </View>

      <ScrollView style={s.scroll} contentContainerStyle={s.body} showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled">

        {/* Task name */}
        <View style={s.field}>
          <Text style={s.label}>TASK NAME *</Text>
          <TextInput
            style={[s.input, errors.name && s.inputError]}
            placeholder="e.g. Renew trade licence"
            placeholderTextColor={C.muted}
            value={name}
            onChangeText={(v) => { setName(v); if (errors.name) setErrors({ ...errors, name: undefined }); }}
            maxLength={120}
          />
          {errors.name && <Text style={s.errorText}>{errors.name}</Text>}
        </View>

        {/* Category */}
        <View style={s.field}>
          <Text style={s.label}>CATEGORY *</Text>
          <View style={s.catGrid}>
            {DEADLINE_CATEGORIES.map((c) => (
              <Pressable
                key={c}
                style={[s.catBtn, category === c && { backgroundColor: CAT[c].text, borderColor: CAT[c].text }]}
                onPress={() => setCategory(c)}
              >
                <Text style={[s.catBtnText, category === c && { color: "#fff" }]}>{CAT[c].label}</Text>
              </Pressable>
            ))}
          </View>
        </View>

        {/* Due date */}
        <View style={s.field}>
          <Text style={s.label}>DUE DATE *</Text>
          <TextInput
            style={[s.input, errors.dueDate && s.inputError]}
            placeholder="YYYY-MM-DD"
            placeholderTextColor={C.muted}
            value={dueDate}
            onChangeText={(v) => { setDueDate(v); if (errors.dueDate) setErrors({ ...errors, dueDate: undefined }); }}
            maxLength={10}
            keyboardType="numbers-and-punctuation"
          />
          {errors.dueDate && <Text style={s.errorText}>{errors.dueDate}</Text>}
        </View>

        {/* Notes */}
        <View style={s.field}>
          <Text style={s.label}>NOTES (OPTIONAL)</Text>
          <TextInput
            style={[s.input, s.textArea]}
            placeholder="Add any context or reminders…"
            placeholderTextColor={C.muted}
            value={notes}
            onChangeText={setNotes}
            maxLength={500}
            multiline
            numberOfLines={4}
            textAlignVertical="top"
          />
          <Text style={s.charCount}>{notes.length}/500</Text>
        </View>

        {/* Recurrence toggle */}
        <View style={s.field}>
          <View style={s.toggleRow}>
            <View>
              <Text style={s.toggleLabel}>Recurring task</Text>
              <Text style={s.toggleDesc}>Auto-create next occurrence after completion</Text>
            </View>
            <Switch
              value={recurring}
              onValueChange={setRecurring}
              trackColor={{ false: C.border, true: C.primary }}
              thumbColor="#fff"
            />
          </View>
          {recurring && (
            <View style={s.recurrenceRow}>
              {RECURRENCE_OPTIONS.map((r) => (
                <Pressable
                  key={r}
                  style={[s.recBtn, recurrence === r && s.recBtnActive]}
                  onPress={() => setRecurrence(r)}
                >
                  <Text style={[s.recBtnText, recurrence === r && s.recBtnTextActive]}>
                    {r.charAt(0).toUpperCase() + r.slice(1)}
                  </Text>
                </Pressable>
              ))}
            </View>
          )}
        </View>
      </ScrollView>

      {/* Save button */}
      <View style={s.footer}>
        <Pressable style={[s.saveBtn, isPending && s.saveBtnLoading]} onPress={handleSave} disabled={isPending}>
          {isPending ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <>
              <MaterialIcons name="check" size={18} color="#fff" />
              <Text style={s.saveBtnText}>Save Task</Text>
            </>
          )}
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:          { flex: 1, backgroundColor: C.bg },
  header:        { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, height: 56, backgroundColor: C.container, borderBottomWidth: 1, borderBottomColor: C.border },
  backBtn:       { width: 38, height: 38, alignItems: "center", justifyContent: "center" },
  title:         { fontSize: 16, fontFamily: "PublicSans_700Bold", color: C.primary },
  scroll:        { flex: 1 },
  body:          { padding: 20, gap: 4 },
  footer:        { padding: 16, paddingBottom: 20, borderTopWidth: 1, borderTopColor: C.border, backgroundColor: C.surface },

  field:         { marginBottom: 22 },
  label:         { fontSize: 10, fontFamily: "PublicSans_700Bold", color: C.muted, letterSpacing: 1.2, textTransform: "uppercase", marginBottom: 8 },
  input:         { borderWidth: 1, borderColor: C.border, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, fontFamily: "PublicSans_400Regular", color: C.primary, backgroundColor: C.surface },
  inputError:    { borderColor: C.error },
  textArea:      { height: 96, paddingTop: 12 },
  charCount:     { fontSize: 10, color: C.muted, textAlign: "right", marginTop: 4 },
  errorText:     { fontSize: 12, color: C.error, marginTop: 4, fontFamily: "PublicSans_400Regular" },

  catGrid:       { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  catBtn:        { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 8, borderWidth: 1, borderColor: C.border, backgroundColor: C.surface },
  catBtnText:    { fontSize: 13, fontFamily: "PublicSans_600SemiBold", color: C.mid },

  toggleRow:     { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  toggleLabel:   { fontSize: 14, fontFamily: "PublicSans_600SemiBold", color: C.primary, marginBottom: 2 },
  toggleDesc:    { fontSize: 11, color: C.muted },
  recurrenceRow: { flexDirection: "row", gap: 8, marginTop: 14 },
  recBtn:        { flex: 1, paddingVertical: 10, borderRadius: 8, borderWidth: 1, borderColor: C.border, alignItems: "center" },
  recBtnActive:  { backgroundColor: C.primary, borderColor: C.primary },
  recBtnText:    { fontSize: 12, fontFamily: "PublicSans_600SemiBold", color: C.muted },
  recBtnTextActive:{ color: "#fff" },

  saveBtn:       { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: C.primary, borderRadius: 12, paddingVertical: 15 },
  saveBtnLoading:{ opacity: 0.7 },
  saveBtnText:   { color: "#fff", fontFamily: "PublicSans_700Bold", fontSize: 15 },
});