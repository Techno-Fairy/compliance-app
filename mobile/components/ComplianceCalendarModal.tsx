// mobile/components/ComplianceCalendarModal.tsx
// FE-22: Compliance Calendar — monthly view of all deadlines

import React, { useState } from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import type { Deadline } from "@/types";

// ── Design tokens (match index.tsx) ──────────────────────────────────────────
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
  cipa:         "#2E6B4F",
  cipaBg:       "#E8F4EE",
  labour:       "#6B3A7D",
  labourBg:     "#F3EEF7",
  custom:       "#7D5A1E",
  customBg:     "#F7F1E8",
  container:    "#dbf1fe",
};

const CAT: Record<string, { bg: string; bar: string }> = {
  BURS:   { bg: C.bursBg,   bar: C.burs },
  CIPA:   { bg: C.cipaBg,   bar: C.cipa },
  LABOUR: { bg: C.labourBg, bar: C.labour },
  CUSTOM: { bg: C.customBg, bar: C.custom },
};

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const SHORT_DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export interface ComplianceCalendarModalProps {
  visible: boolean;
  onClose: () => void;
  deadlines: Deadline[];
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function parseLocalDate(iso: string): Date {
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  return new Date(y, m - 1, d, 12);
}

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function statusDotColor(status: Deadline["status"], daysRemaining: number | undefined): string {
  if (status === "complete") return C.secondary;
  if (status === "missed") return C.error;
  if (daysRemaining !== undefined && daysRemaining < 0) return C.error;
  if (daysRemaining !== undefined && daysRemaining <= 7) return C.amber;
  return C.burs;
}

// ── Sub-components ────────────────────────────────────────────────────────────

function DayCell({
  day,
  isToday,
  isCurrentMonth,
  items,
  onPress,
}: {
  day: Date;
  isToday: boolean;
  isCurrentMonth: boolean;
  items: Deadline[];
  onPress: (day: Date, items: Deadline[]) => void;
}) {
  const hasDots = items.length > 0;
  return (
    <Pressable
      style={[
        cl.dayCell,
        isToday && cl.dayCellToday,
        !isCurrentMonth && cl.dayCellOtherMonth,
      ]}
      onPress={() => hasDots && onPress(day, items)}
    >
      <Text
        style={[
          cl.dayNum,
          isToday && cl.dayNumToday,
          !isCurrentMonth && cl.dayNumOther,
        ]}
      >
        {day.getDate()}
      </Text>
      {hasDots && (
        <View style={cl.dotRow}>
          {items.slice(0, 3).map((item, idx) => (
            <View
              key={idx}
              style={[
                cl.dot,
                { backgroundColor: statusDotColor(item.status, item.days_remaining) },
              ]}
            />
          ))}
          {items.length > 3 && (
            <Text style={cl.dotMore}>+{items.length - 3}</Text>
          )}
        </View>
      )}
    </Pressable>
  );
}

function DayDetailSheet({
  date,
  items,
  onClose,
  onNavigate,
}: {
  date: Date;
  items: Deadline[];
  onClose: () => void;
  onNavigate: (id: number) => void;
}) {
  return (
    <View style={ds.sheet}>
      <View style={ds.header}>
        <Text style={ds.headerTitle}>
          {MONTH_NAMES[date.getMonth()]} {date.getDate()}
        </Text>
        <Pressable onPress={onClose} hitSlop={8}>
          <MaterialIcons name="close" size={20} color={C.mid} />
        </Pressable>
      </View>
      {items.map((item) => {
        const cat = CAT[item.category] ?? CAT.CUSTOM;
        const isComplete = item.status === "complete";
        const isOverdue =
          item.status === "missed" ||
          (item.days_remaining !== undefined && item.days_remaining < 0);
        const daysColor = isComplete
          ? C.secondary
          : isOverdue
          ? C.error
          : item.days_remaining !== undefined && item.days_remaining <= 7
          ? C.amber
          : C.mid;

        const daysLabel = isComplete
          ? "Completed"
          : isOverdue
          ? `${Math.abs(item.days_remaining ?? 0)}d overdue`
          : item.days_remaining === 0
          ? "Due today"
          : `Due in ${item.days_remaining}d`;

        return (
          <Pressable
            key={item.id}
            style={ds.row}
            onPress={() => onNavigate(item.id)}
          >
            <View style={[ds.catBar, { backgroundColor: cat.bar }]} />
            <View style={ds.rowBody}>
              <View style={ds.rowTop}>
                <View style={[ds.chip, { backgroundColor: cat.bg }]}>
                  <Text style={[ds.chipText, { color: cat.bar }]}>
                    {item.category}
                  </Text>
                </View>
                <Text style={[ds.daysText, { color: daysColor }]}>
                  {daysLabel}
                </Text>
              </View>
              <Text style={ds.name} numberOfLines={2}>
                {item.name}
              </Text>
              {isComplete && (
                <View style={ds.completeRow}>
                  <MaterialIcons
                    name="check-circle"
                    size={13}
                    color={C.secondary}
                  />
                  <Text style={ds.completeText}> Filed &amp; complete</Text>
                </View>
              )}
            </View>
            <MaterialIcons name="chevron-right" size={18} color={C.border} />
          </Pressable>
        );
      })}
    </View>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

export function ComplianceCalendarModal({
  visible,
  onClose,
  deadlines,
}: ComplianceCalendarModalProps) {
  const router = useRouter();
  const now = new Date();
  const [viewYear, setViewYear] = useState(now.getFullYear());
  const [viewMonth, setViewMonth] = useState(now.getMonth());
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);
  const [selectedItems, setSelectedItems] = useState<Deadline[]>([]);

  // ── Build calendar grid ──────────────────────────────────────────────────
  const firstOfMonth = new Date(viewYear, viewMonth, 1);
  const startDow = firstOfMonth.getDay();
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const daysInPrevMonth = new Date(viewYear, viewMonth, 0).getDate();

  const totalCells = Math.ceil((startDow + daysInMonth) / 7) * 7;

  const cells: Date[] = Array.from({ length: totalCells }, (_, i) => {
    const offset = i - startDow;
    if (offset < 0) {
      return new Date(viewYear, viewMonth - 1, daysInPrevMonth + offset + 1, 12);
    } else if (offset >= daysInMonth) {
      return new Date(viewYear, viewMonth + 1, offset - daysInMonth + 1, 12);
    } else {
      return new Date(viewYear, viewMonth, offset + 1, 12);
    }
  });

  function itemsForDay(day: Date): Deadline[] {
    return deadlines.filter((d) => {
      try {
        return isSameDay(parseLocalDate(d.due_date), day);
      } catch {
        return false;
      }
    });
  }

  function prevMonth() {
    if (viewMonth === 0) { setViewMonth(11); setViewYear((y) => y - 1); }
    else { setViewMonth((m) => m - 1); }
    setSelectedDay(null);
  }

  function nextMonth() {
    if (viewMonth === 11) { setViewMonth(0); setViewYear((y) => y + 1); }
    else { setViewMonth((m) => m + 1); }
    setSelectedDay(null);
  }

  function handleDayPress(day: Date, items: Deadline[]) {
    setSelectedDay(day);
    setSelectedItems(items);
  }

  function handleNavigateDeadline(id: number) {
    onClose();
    router.push(`/deadline/${id}` as any);
  }

  // ── Summary counts ───────────────────────────────────────────────────────
  const monthDeadlines = deadlines.filter((d) => {
    try {
      const date = parseLocalDate(d.due_date);
      return date.getFullYear() === viewYear && date.getMonth() === viewMonth;
    } catch { return false; }
  });
  const overdueCount = monthDeadlines.filter(
    (d) => d.status === "missed" || (d.days_remaining !== undefined && d.days_remaining < 0 && d.status !== "complete")
  ).length;
  const completedCount = monthDeadlines.filter((d) => d.status === "complete").length;
  const pendingCount = monthDeadlines.length - overdueCount - completedCount;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={cl.safe}>
        {/* Header */}
        <View style={cl.header}>
          <Text style={cl.eyebrow}>COMPLIANCE CALENDAR</Text>
          <Pressable onPress={onClose} hitSlop={8} style={cl.closeBtn}>
            <MaterialIcons name="close" size={22} color={C.primary} />
          </Pressable>
        </View>

        <ScrollView
          style={cl.scroll}
          contentContainerStyle={cl.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Month navigator */}
          <View style={cl.navRow}>
            <Pressable onPress={prevMonth} hitSlop={8} style={cl.navBtn}>
              <MaterialIcons name="chevron-left" size={26} color={C.primary} />
            </Pressable>
            <Text style={cl.monthTitle}>
              {MONTH_NAMES[viewMonth]} {viewYear}
            </Text>
            <Pressable onPress={nextMonth} hitSlop={8} style={cl.navBtn}>
              <MaterialIcons name="chevron-right" size={26} color={C.primary} />
            </Pressable>
          </View>

          {/* Summary pills */}
          <View style={cl.summaryRow}>
            <View style={[cl.pill, { backgroundColor: C.errorBg }]}>
              <MaterialIcons name="warning" size={12} color={C.error} />
              <Text style={[cl.pillText, { color: C.error }]}>{overdueCount} overdue</Text>
            </View>
            <View style={[cl.pill, { backgroundColor: C.amberBg }]}>
              <MaterialIcons name="schedule" size={12} color={C.amber} />
              <Text style={[cl.pillText, { color: C.amber }]}>{pendingCount} pending</Text>
            </View>
            <View style={[cl.pill, { backgroundColor: C.secondaryBg }]}>
              <MaterialIcons name="check-circle" size={12} color={C.secondary} />
              <Text style={[cl.pillText, { color: C.secondary }]}>{completedCount} done</Text>
            </View>
          </View>

          {/* Day-of-week headers */}
          <View style={cl.dowRow}>
            {SHORT_DAYS.map((d) => (
              <Text key={d} style={cl.dowLabel}>{d}</Text>
            ))}
          </View>

          {/* Calendar grid */}
          <View style={cl.grid}>
            {cells.map((day, idx) => {
              const items = itemsForDay(day);
              const isCurrentMonth = day.getMonth() === viewMonth && day.getFullYear() === viewYear;
              const isToday = isSameDay(day, now);
              return (
                <DayCell
                  key={idx}
                  day={day}
                  isToday={isToday}
                  isCurrentMonth={isCurrentMonth}
                  items={items}
                  onPress={handleDayPress}
                />
              );
            })}
          </View>

          {/* Legend */}
          <View style={cl.legend}>
            {[
              { label: "Overdue",      color: C.error     },
              { label: "Due soon (≤7d)", color: C.amber   },
              { label: "Upcoming",     color: C.burs      },
              { label: "Completed",    color: C.secondary },
            ].map(({ label, color }) => (
              <View key={label} style={cl.legendItem}>
                <View style={[cl.legendDot, { backgroundColor: color }]} />
                <Text style={cl.legendText}>{label}</Text>
              </View>
            ))}
          </View>

          {/* Day detail sheet */}
          {selectedDay && selectedItems.length > 0 && (
            <DayDetailSheet
              date={selectedDay}
              items={selectedItems}
              onClose={() => setSelectedDay(null)}
              onNavigate={handleNavigateDeadline}
            />
          )}

          {/* All deadlines this month */}
          {monthDeadlines.length === 0 ? (
            <View style={cl.empty}>
              <MaterialIcons name="event-available" size={40} color={C.border} />
              <Text style={cl.emptyTitle}>No deadlines this month</Text>
              <Text style={cl.emptyDesc}>
                Navigate to another month to see upcoming obligations.
              </Text>
            </View>
          ) : (
            <View style={cl.listSection}>
              <Text style={cl.listLabel}>ALL DEADLINES — {MONTH_NAMES[viewMonth].toUpperCase()}</Text>
              {monthDeadlines
                .sort((a, b) => parseLocalDate(a.due_date).getTime() - parseLocalDate(b.due_date).getTime())
                .map((item) => {
                  const cat = CAT[item.category] ?? CAT.CUSTOM;
                  const isComplete = item.status === "complete";
                  const isOverdue =
                    item.status === "missed" ||
                    (item.days_remaining !== undefined && item.days_remaining < 0 && !isComplete);
                  const daysColor = isComplete
                    ? C.secondary
                    : isOverdue
                    ? C.error
                    : item.days_remaining !== undefined && item.days_remaining <= 7
                    ? C.amber
                    : C.mid;
                  const daysLabel = isComplete
                    ? "Complete"
                    : isOverdue
                    ? `${Math.abs(item.days_remaining ?? 0)}d overdue`
                    : item.days_remaining === 0
                    ? "Due today"
                    : `${item.days_remaining}d`;

                  const dueDate = parseLocalDate(item.due_date);
                  const dayStr = `${dueDate.getDate()} ${MONTH_NAMES[dueDate.getMonth()].slice(0, 3)}`;

                  return (
                    <Pressable
                      key={item.id}
                      style={({ pressed }) => [cl.listRow, pressed && { opacity: 0.75 }]}
                      onPress={() => handleNavigateDeadline(item.id)}
                    >
                      <View style={[cl.listBar, { backgroundColor: cat.bar }]} />
                      <View style={cl.listBody}>
                        <View style={cl.listTop}>
                          <View style={[cl.listChip, { backgroundColor: cat.bg }]}>
                            <Text style={[cl.listChipText, { color: cat.bar }]}>{item.category}</Text>
                          </View>
                          <Text style={cl.listDate}>{dayStr}</Text>
                          <Text style={[cl.listDays, { color: daysColor }]}>{daysLabel}</Text>
                        </View>
                        <Text style={cl.listName} numberOfLines={2}>{item.name}</Text>
                      </View>
                      <MaterialIcons name="chevron-right" size={18} color={C.border} />
                    </Pressable>
                  );
                })}
            </View>
          )}

          <View style={{ height: 40 }} />
        </ScrollView>
      </View>
    </Modal>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const CELL_SIZE = 46;

const cl = StyleSheet.create({
  safe:        { flex: 1, backgroundColor: C.bg },
  header:      { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingTop: 20, paddingBottom: 12, backgroundColor: C.container, borderBottomWidth: 1, borderBottomColor: C.border },
  eyebrow:     { fontSize: 10, fontFamily: "PublicSans_700Bold", color: C.burs, letterSpacing: 1.4, textTransform: "uppercase" },
  closeBtn:    { padding: 4 },
  scroll:      { flex: 1 },
  scrollContent: { paddingHorizontal: 16, paddingTop: 16 },

  navRow:      { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 },
  navBtn:      { padding: 4 },
  monthTitle:  { fontSize: 20, fontFamily: "PublicSans_700Bold", color: C.primary },

  summaryRow:  { flexDirection: "row", gap: 8, marginBottom: 16, justifyContent: "center" },
  pill:        { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  pillText:    { fontSize: 11, fontFamily: "PublicSans_700Bold" },

  dowRow:      { flexDirection: "row", marginBottom: 4 },
  dowLabel:    { flex: 1, textAlign: "center", fontSize: 11, fontFamily: "PublicSans_700Bold", color: C.muted },

  grid:        { flexDirection: "row", flexWrap: "wrap", marginBottom: 16 },
  dayCell:     { width: `${100 / 7}%`, height: CELL_SIZE, alignItems: "center", justifyContent: "center", borderRadius: 6, paddingTop: 2 },
  dayCellToday:      { backgroundColor: C.container, borderWidth: 1, borderColor: C.burs },
  dayCellOtherMonth: { opacity: 0.35 },
  dayNum:      { fontSize: 13, fontFamily: "PublicSans_700Bold", color: C.primary },
  dayNumToday: { color: C.burs },
  dayNumOther: { color: C.muted },
  dotRow:      { flexDirection: "row", gap: 2, marginTop: 2, alignItems: "center" },
  dot:         { width: 5, height: 5, borderRadius: 3 },
  dotMore:     { fontSize: 8, color: C.muted },

  legend:      { flexDirection: "row", flexWrap: "wrap", gap: 12, marginBottom: 20, justifyContent: "center" },
  legendItem:  { flexDirection: "row", alignItems: "center", gap: 4 },
  legendDot:   { width: 7, height: 7, borderRadius: 4 },
  legendText:  { fontSize: 11, color: C.muted },

  listSection: { marginTop: 8 },
  listLabel:   { fontSize: 10, fontFamily: "PublicSans_700Bold", color: C.muted, letterSpacing: 1.2, textTransform: "uppercase", marginBottom: 8 },
  listRow:     { flexDirection: "row", alignItems: "center", backgroundColor: C.surface, borderRadius: 10, marginBottom: 8, borderWidth: 1, borderColor: C.border, overflow: "hidden" },
  listBar:     { width: 4, alignSelf: "stretch" },
  listBody:    { flex: 1, padding: 12 },
  listTop:     { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 4 },
  listChip:    { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 4 },
  listChipText:{ fontSize: 10, fontFamily: "PublicSans_700Bold" },
  listDate:    { fontSize: 11, color: C.muted, flex: 1 },
  listDays:    { fontSize: 11, fontFamily: "PublicSans_700Bold" },
  listName:    { fontSize: 14, fontFamily: "PublicSans_700Bold", color: C.primary, lineHeight: 19 },

  empty:       { alignItems: "center", justifyContent: "center", paddingVertical: 40, gap: 8 },
  emptyTitle:  { fontSize: 16, fontFamily: "PublicSans_700Bold", color: C.primary, marginTop: 8 },
  emptyDesc:   { fontSize: 13, color: C.muted, textAlign: "center", lineHeight: 18 },
});

// ── Day detail sheet styles ───────────────────────────────────────────────────

const ds = StyleSheet.create({
  sheet:       { backgroundColor: C.surface, borderRadius: 14, borderWidth: 1, borderColor: C.border, marginBottom: 20, overflow: "hidden" },
  header:      { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 14, paddingVertical: 12, backgroundColor: C.container, borderBottomWidth: 1, borderBottomColor: C.border },
  headerTitle: { fontSize: 14, fontFamily: "PublicSans_700Bold", color: C.primary },
  row:         { flexDirection: "row", alignItems: "center", paddingRight: 12, borderBottomWidth: 1, borderBottomColor: C.borderSoft, overflow: "hidden" },
  catBar:      { width: 4, alignSelf: "stretch" },
  rowBody:     { flex: 1, padding: 12 },
  rowTop:      { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 4 },
  chip:        { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 4 },
  chipText:    { fontSize: 10, fontFamily: "PublicSans_700Bold" },
  daysText:    { fontSize: 11, fontFamily: "PublicSans_700Bold" },
  name:        { fontSize: 14, fontFamily: "PublicSans_700Bold", color: C.primary, lineHeight: 19 },
  completeRow: { flexDirection: "row", alignItems: "center", marginTop: 4 },
  completeText:{ fontSize: 11, color: C.secondary },
});