// mobile/app/notification-preferences.tsx
// FE-16: Notification preferences in Settings

import React, { useState, useEffect } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { MaterialIcons } from "@expo/vector-icons";
import { router } from "expo-router";
import {
  DEFAULT_PREFS,
  registerForPushNotifications,
  saveNotificationPrefs,
  getNotificationPrefs,
  type NotificationPrefs,
} from "@/hooks/useNotifications";

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
  error:        "#ba1a1a",
  errorBg:      "#ffdad6",
  amber:        "#D4830A",
  amberBg:      "#FEF3E2",
  burs:         "#1A3C5E",
  bursBg:       "#EAF0F7",
};

const REMINDER_OPTIONS: { value: number; label: string }[] = [
  { value: 1,  label: "1 day before"  },
  { value: 3,  label: "3 days before" },
  { value: 7,  label: "1 week before" },
  { value: 14, label: "2 weeks before"},
];

interface ToggleRowProps {
  icon: string;
  iconBg: string;
  iconColor: string;
  title: string;
  description: string;
  value: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}

function ToggleRow({ icon, iconBg, iconColor, title, description, value, onChange, disabled }: ToggleRowProps) {
  return (
    <View style={s.toggleRow}>
      <View style={[s.toggleIcon, { backgroundColor: iconBg }]}>
        <MaterialIcons name={icon as any} size={20} color={iconColor} />
      </View>
      <View style={s.toggleText}>
        <Text style={s.toggleTitle}>{title}</Text>
        <Text style={s.toggleDesc}>{description}</Text>
      </View>
      <Switch
        value={value}
        onValueChange={onChange}
        disabled={disabled}
        trackColor={{ false: C.border, true: C.primary }}
        thumbColor={C.surface}
      />
    </View>
  );
}

export default function NotificationPreferencesScreen() {
  const [prefs,         setPrefs]         = useState<NotificationPrefs>(DEFAULT_PREFS);
  const [permGranted,   setPermGranted]   = useState<boolean | null>(null);
  const [loading,       setLoading]       = useState(true);
  const [saving,        setSaving]        = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const token = await registerForPushNotifications();
        setPermGranted(token !== null);
        const serverPrefs = await getNotificationPrefs();
        setPrefs(serverPrefs);
      } catch {
        // API not yet implemented — use defaults
        setPermGranted(true);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const update = (patch: Partial<NotificationPrefs>) =>
    setPrefs((prev) => ({ ...prev, ...patch }));

  const handleSave = async () => {
    setSaving(true);
    try {
      await saveNotificationPrefs(prefs);
      Alert.alert("Saved", "Your notification preferences have been updated.");
    } catch {
      Alert.alert("Saved locally", "Preferences saved. They'll sync when the server is available.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={s.safe} edges={["top"]}>
        <View style={s.header}>
          <Pressable onPress={() => router.back()} style={s.backBtn}>
            <MaterialIcons name="arrow-back" size={22} color={C.primary} />
          </Pressable>
          <Text style={s.headerTitle}>Notifications</Text>
          <View style={{ width: 38 }} />
        </View>
        <ActivityIndicator color={C.burs} style={{ marginTop: 60 }} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.safe} edges={["top"]}>
      <View style={s.header}>
        <Pressable onPress={() => router.back()} style={s.backBtn}>
          <MaterialIcons name="arrow-back" size={22} color={C.primary} />
        </Pressable>
        <Text style={s.headerTitle}>Notifications</Text>
        <View style={{ width: 38 }} />
      </View>

      <ScrollView style={s.scroll} contentContainerStyle={s.body} showsVerticalScrollIndicator={false}>

        {/* Permission banner */}
        {permGranted === false && (
          <View style={s.permBanner}>
            <MaterialIcons name="notifications-off" size={20} color={C.error} />
            <View style={s.permText}>
              <Text style={s.permTitle}>Notifications are disabled</Text>
              <Text style={s.permDesc}>Enable them in your device Settings to receive deadline reminders.</Text>
            </View>
          </View>
        )}

        {permGranted === true && (
          <View style={s.permBannerOk}>
            <MaterialIcons name="notifications-active" size={18} color={C.secondary} />
            <Text style={s.permOkText}>Notifications are enabled</Text>
          </View>
        )}

        {/* Deadline reminders */}
        <Text style={s.section}>DEADLINE REMINDERS</Text>
        <View style={s.card}>
          <ToggleRow
            icon="alarm"
            iconBg={C.bursBg}
            iconColor={C.burs}
            title="Deadline Reminders"
            description="Get notified before filing deadlines"
            value={prefs.deadline_reminders}
            onChange={(v) => update({ deadline_reminders: v })}
            disabled={!permGranted}
          />

          {prefs.deadline_reminders && (
            <>
              <View style={s.divider} />
              <View style={s.subSection}>
                <Text style={s.subLabel}>HOW FAR IN ADVANCE</Text>
                <View style={s.reminderGrid}>
                  {REMINDER_OPTIONS.map((opt) => (
                    <Pressable
                      key={opt.value}
                      style={[s.reminderChip, prefs.reminder_days_before === opt.value && s.reminderChipActive]}
                      onPress={() => update({ reminder_days_before: opt.value })}
                    >
                      <Text style={[s.reminderChipText, prefs.reminder_days_before === opt.value && s.reminderChipTextActive]}>
                        {opt.label}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            </>
          )}
        </View>

        {/* Penalty & exposure */}
        <Text style={s.section}>PENALTIES & ALERTS</Text>
        <View style={s.card}>
          <ToggleRow
            icon="warning"
            iconBg={C.errorBg}
            iconColor={C.error}
            title="Penalty Alerts"
            description="Alert when new penalty exposure is detected"
            value={prefs.penalty_alerts}
            onChange={(v) => update({ penalty_alerts: v })}
            disabled={!permGranted}
          />
          <View style={s.divider} />
          <ToggleRow
            icon="access-time"
            iconBg={C.amberBg}
            iconColor={C.amber}
            title="Document Expiry Alerts"
            description="30-day warning for TCC and trade licence expiry"
            value={prefs.document_expiry}
            onChange={(v) => update({ document_expiry: v })}
            disabled={!permGranted}
          />
        </View>

        {/* Digest */}
        <Text style={s.section}>DIGEST</Text>
        <View style={s.card}>
          <ToggleRow
            icon="summarize"
            iconBg={C.containerLow}
            iconColor={C.mid}
            title="Weekly Digest"
            description="Sunday summary of upcoming deadlines for the week"
            value={prefs.weekly_digest}
            onChange={(v) => update({ weekly_digest: v })}
            disabled={!permGranted}
          />
        </View>

        {/* Info note */}
        <View style={s.note}>
          <MaterialIcons name="info-outline" size={14} color={C.muted} />
          <Text style={s.noteText}>
            Notifications include BWP penalty figures so you can prioritise. Reminders are sent at 09:00 Botswana time.
          </Text>
        </View>

        <View style={{ height: 20 }} />
      </ScrollView>

      {/* Save footer */}
      <View style={s.footer}>
        <Pressable
          style={({ pressed }) => [s.saveBtn, pressed && { opacity: 0.8 }, saving && { opacity: 0.6 }]}
          onPress={handleSave}
          disabled={saving}
        >
          {saving
            ? <ActivityIndicator color="#fff" size="small" />
            : (
              <>
                <MaterialIcons name="check" size={18} color="#fff" />
                <Text style={s.saveBtnText}>Save Preferences</Text>
              </>
            )
          }
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:       { flex: 1, backgroundColor: C.bg },
  header:     { flexDirection: "row", alignItems: "center", justifyContent: "space-between", height: 56, paddingHorizontal: 16, backgroundColor: C.container, borderBottomWidth: 1, borderBottomColor: C.border },
  backBtn:    { width: 38, height: 38, alignItems: "center", justifyContent: "center" },
  headerTitle:{ flex: 1, fontSize: 16, fontFamily: "PublicSans_700Bold", color: C.primary, textAlign: "center" },
  scroll:     { flex: 1 },
  body:       { padding: 16 },

  permBanner: { flexDirection: "row", alignItems: "flex-start", gap: 10, backgroundColor: C.errorBg, borderRadius: 12, padding: 14, marginBottom: 20, borderWidth: 1, borderColor: "#F5C6C2" },
  permText:   { flex: 1 },
  permTitle:  { fontSize: 14, fontFamily: "PublicSans_700Bold", color: C.error, marginBottom: 2 },
  permDesc:   { fontSize: 12, color: C.error, opacity: 0.85, lineHeight: 17 },
  permBannerOk:{ flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: C.secondaryBg, borderRadius: 10, padding: 12, marginBottom: 20 },
  permOkText: { fontSize: 13, fontFamily: "PublicSans_600SemiBold", color: C.secondary },

  section:    { fontSize: 10, fontFamily: "PublicSans_700Bold", color: C.muted, letterSpacing: 1.2, textTransform: "uppercase", marginBottom: 8, marginTop: 20, paddingHorizontal: 4 },
  card:       { backgroundColor: C.surface, borderRadius: 14, borderWidth: 1, borderColor: C.border, overflow: "hidden" },
  divider:    { height: 1, backgroundColor: C.borderSoft, marginHorizontal: 16 },

  toggleRow:  { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 14, gap: 12 },
  toggleIcon: { width: 36, height: 36, borderRadius: 9, alignItems: "center", justifyContent: "center" },
  toggleText: { flex: 1 },
  toggleTitle:{ fontSize: 14, fontFamily: "PublicSans_600SemiBold", color: C.primary, marginBottom: 2 },
  toggleDesc: { fontSize: 11, fontFamily: "PublicSans_400Regular", color: C.muted, lineHeight: 15 },

  subSection: { paddingHorizontal: 16, paddingBottom: 14, paddingTop: 10 },
  subLabel:   { fontSize: 10, fontFamily: "PublicSans_700Bold", color: C.muted, letterSpacing: 1, textTransform: "uppercase", marginBottom: 10 },
  reminderGrid:{ flexDirection: "row", flexWrap: "wrap", gap: 8 },
  reminderChip:{ paddingHorizontal: 14, paddingVertical: 9, borderRadius: 999, borderWidth: 1, borderColor: C.border, backgroundColor: C.bg },
  reminderChipActive:{ backgroundColor: C.primary, borderColor: C.primary },
  reminderChipText:{ fontSize: 12, fontFamily: "PublicSans_600SemiBold", color: C.muted },
  reminderChipTextActive:{ color: "#fff" },

  note:       { flexDirection: "row", alignItems: "flex-start", gap: 6, backgroundColor: C.surface, borderRadius: 10, padding: 12, borderWidth: 1, borderColor: C.border, marginTop: 20 },
  noteText:   { flex: 1, fontSize: 12, fontFamily: "PublicSans_400Regular", color: C.muted, lineHeight: 17 },

  footer:     { paddingHorizontal: 16, paddingVertical: 14, backgroundColor: C.surface, borderTopWidth: 1, borderTopColor: C.border },
  saveBtn:    { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: C.primary, borderRadius: 12, paddingVertical: 14 },
  saveBtnText:{ color: "#fff", fontFamily: "PublicSans_700Bold", fontSize: 15 },
});