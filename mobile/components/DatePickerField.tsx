// mobile/components/DatePickerField.tsx
// Reusable calendar date picker — no third-party dependency.
// Renders a tappable field that opens a modal with a month/year
// navigation header and a full 7-column day grid.

import React, { useState } from "react";
import {
  FlatList, Modal, Pressable, StyleSheet,
  Text, TouchableOpacity, View,
} from "react-native";
import { MaterialIcons } from "@expo/vector-icons";

// ── Tokens (matches the app palette) ─────────────────────────────────────────
const C = {
  bg:       "#f3faff",
  surface:  "#ffffff",
  primary:  "#000b25",
  mid:      "#44474e",
  muted:    "#75777f",
  border:   "#c5c6cf",
  soft:     "#e6f6ff",
  error:    "#ba1a1a",
  today:    "#dbf1fe",
};

const DAYS   = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
const MONTHS = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December",
];

function daysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}
function firstWeekday(year: number, month: number) {
  return new Date(year, month, 1).getDay();
}
function toISO(year: number, month: number, day: number) {
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

interface Props {
  label: string;
  value: string;          // ISO "YYYY-MM-DD" or ""
  onChange: (iso: string) => void;
  placeholder?: string;
  error?: string;
  minDate?: Date;         // dates before this are disabled
  optional?: boolean;     // shows "(optional)" in label
}

export function DatePickerField({ label, value, onChange, placeholder, error, minDate, optional }: Props) {
  const today   = new Date();
  const initYear  = value ? parseInt(value.slice(0, 4), 10) : today.getFullYear();
  const initMonth = value ? parseInt(value.slice(5, 7), 10) - 1 : today.getMonth();

  const [open,  setOpen]  = useState(false);
  const [year,  setYear]  = useState(initYear);
  const [month, setMonth] = useState(initMonth);

  // Formatted display value
  const display = value
    ? new Date(value + "T00:00:00").toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })
    : "";

  const prevMonth = () => {
    if (month === 0) { setMonth(11); setYear(y => y - 1); }
    else setMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (month === 11) { setMonth(0); setYear(y => y + 1); }
    else setMonth(m => m + 1);
  };

  const selectDay = (day: number) => {
    onChange(toISO(year, month, day));
    setOpen(false);
  };

  const isDisabled = (day: number) => {
    if (!minDate) return false;
    const d = new Date(year, month, day);
    return d < minDate;
  };
  const isToday = (day: number) =>
    year === today.getFullYear() && month === today.getMonth() && day === today.getDate();
  const isSelected = (day: number) =>
    value === toISO(year, month, day);

  // Build the grid: leading empty slots + day numbers
  const totalDays = daysInMonth(year, month);
  const offset    = firstWeekday(year, month);
  const cells: (number | null)[] = [
    ...Array(offset).fill(null),
    ...Array.from({ length: totalDays }, (_, i) => i + 1),
  ];
  // Pad to complete last row
  while (cells.length % 7 !== 0) cells.push(null);

  return (
    <View style={dp.field}>
      <Text style={dp.label}>
        {label.toUpperCase()}{optional ? <Text style={dp.optional}> (optional)</Text> : " *"}
      </Text>

      {/* Trigger */}
      <TouchableOpacity
        style={[dp.trigger, error ? dp.triggerError : null]}
        onPress={() => {
          // Sync nav state with current value when opening
          if (value) {
            setYear(parseInt(value.slice(0, 4), 10));
            setMonth(parseInt(value.slice(5, 7), 10) - 1);
          }
          setOpen(true);
        }}
        activeOpacity={0.75}
      >
        <MaterialIcons name="calendar-today" size={18} color={display ? C.primary : C.muted} />
        <Text style={display ? dp.triggerValue : dp.triggerPlaceholder}>
          {display || (placeholder ?? "Select date")}
        </Text>
        {display ? (
          <TouchableOpacity onPress={(e) => { e.stopPropagation(); onChange(""); }} hitSlop={8}>
            <MaterialIcons name="close" size={16} color={C.muted} />
          </TouchableOpacity>
        ) : (
          <MaterialIcons name="expand-more" size={18} color={C.muted} />
        )}
      </TouchableOpacity>

      {error ? <Text style={dp.error}>{error}</Text> : null}

      {/* Calendar modal */}
      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={dp.overlay} onPress={() => setOpen(false)}>
          <Pressable style={dp.sheet} onPress={(e) => e.stopPropagation()}>

            {/* Month navigation */}
            <View style={dp.navRow}>
              <TouchableOpacity onPress={prevMonth} style={dp.navBtn} hitSlop={8}>
                <MaterialIcons name="chevron-left" size={24} color={C.primary} />
              </TouchableOpacity>
              <Text style={dp.navTitle}>{MONTHS[month]} {year}</Text>
              <TouchableOpacity onPress={nextMonth} style={dp.navBtn} hitSlop={8}>
                <MaterialIcons name="chevron-right" size={24} color={C.primary} />
              </TouchableOpacity>
            </View>

            {/* Day-of-week header */}
            <View style={dp.weekRow}>
              {DAYS.map((d) => (
                <Text key={d} style={dp.weekDay}>{d}</Text>
              ))}
            </View>

            {/* Day grid */}
            <View style={dp.grid}>
              {cells.map((day, idx) => {
                if (!day) return <View key={`e${idx}`} style={dp.cell} />;
                const disabled = isDisabled(day);
                const selected = isSelected(day);
                const todayCell = isToday(day);
                return (
                  <TouchableOpacity
                    key={`d${day}`}
                    style={[
                      dp.cell,
                      todayCell && !selected && dp.cellToday,
                      selected && dp.cellSelected,
                      disabled && dp.cellDisabled,
                    ]}
                    onPress={() => !disabled && selectDay(day)}
                    disabled={disabled}
                    activeOpacity={0.7}
                  >
                    <Text style={[
                      dp.cellText,
                      selected && dp.cellTextSelected,
                      disabled && dp.cellTextDisabled,
                    ]}>
                      {day}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Today shortcut */}
            <TouchableOpacity
              style={dp.todayBtn}
              onPress={() => {
                setYear(today.getFullYear());
                setMonth(today.getMonth());
              }}
            >
              <Text style={dp.todayBtnText}>Jump to today</Text>
            </TouchableOpacity>

          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const CELL_SIZE = 40;

const dp = StyleSheet.create({
  field:        { marginBottom: 22 },
  label:        { fontSize: 10, fontFamily: "PublicSans_700Bold", color: C.muted, letterSpacing: 1.2, marginBottom: 8 },
  optional:     { fontFamily: "PublicSans_400Regular", color: C.muted, textTransform: "none" },

  trigger:      { flexDirection: "row", alignItems: "center", gap: 10, borderWidth: 1, borderColor: C.border, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 13, backgroundColor: C.surface },
  triggerError: { borderColor: C.error },
  triggerValue: { flex: 1, fontSize: 14, fontFamily: "PublicSans_400Regular", color: C.primary },
  triggerPlaceholder: { flex: 1, fontSize: 14, fontFamily: "PublicSans_400Regular", color: C.muted },

  error:        { fontSize: 12, color: C.error, marginTop: 4, fontFamily: "PublicSans_400Regular" },

  overlay:      { flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "center", alignItems: "center", padding: 20 },
  sheet:        { backgroundColor: C.surface, borderRadius: 18, padding: 16, width: "100%", maxWidth: 360 },

  navRow:       { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 14 },
  navBtn:       { padding: 4 },
  navTitle:     { fontSize: 16, fontFamily: "PublicSans_700Bold", color: C.primary },

  weekRow:      { flexDirection: "row", marginBottom: 6 },
  weekDay:      { width: CELL_SIZE, textAlign: "center", fontSize: 11, fontFamily: "PublicSans_700Bold", color: C.muted, paddingVertical: 4 },

  grid:         { flexDirection: "row", flexWrap: "wrap" },
  cell:         { width: CELL_SIZE, height: CELL_SIZE, alignItems: "center", justifyContent: "center", borderRadius: 10 },
  cellToday:    { backgroundColor: C.today },
  cellSelected: { backgroundColor: C.primary },
  cellDisabled: { opacity: 0.25 },
  cellText:     { fontSize: 14, fontFamily: "PublicSans_400Regular", color: C.primary },
  cellTextSelected: { color: "#fff", fontFamily: "PublicSans_700Bold" },
  cellTextDisabled: { color: C.muted },

  todayBtn:     { alignItems: "center", paddingTop: 12, paddingBottom: 4 },
  todayBtnText: { fontSize: 12, fontFamily: "PublicSans_600SemiBold", color: C.primary, textDecorationLine: "underline" },
});