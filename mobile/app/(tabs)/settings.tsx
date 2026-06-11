// mobile/app/(tabs)/settings.tsx
// FE-18: Settings — notification prefs, invite team, edit account details, logout, delete account
// FE-19: Client switcher row (visible for accountant / admin roles)

import { useEffect, useState } from "react";
import { View, Text, Pressable, StyleSheet, Alert, ScrollView } from "react-native";
import { router } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { MaterialIcons } from "@expo/vector-icons";
import { useAuthStore } from "@/store/auth";
import { useCurrentUser } from "@/hooks/useBusinesses";

const C = {
  bg:         "#f3faff",
  surface:    "#ffffff",
  primary:    "#000b25",
  mid:        "#44474e",
  muted:      "#75777f",
  border:     "#c5c6cf",
  borderSoft: "#e6f6ff",
  container:  "#dbf1fe",
  containerLow: "#e6f6ff",
  error:      "#ba1a1a",
  errorBg:    "#ffdad6",
  burs:       "#1A3C5E",
  bursBg:     "#EAF0F7",
  secondary:  "#2a6b2c",
  secondaryBg:"#acf4a4",
  secondaryText:"#307231",
  amber:      "#D4830A",
  amberBg:    "#FEF3E2",
  labour:     "#6B3A7D",
  labourBg:   "#F3EEF7",
  teal:       "#006874",
  tealBg:     "#d8f3f6",
};

function SettingsRow({
  icon, iconBg, iconColor, label, subtitle, onPress, destructive, badge,
}: {
  icon: string; iconBg?: string; iconColor?: string;
  label: string; subtitle?: string;
  onPress: () => void; destructive?: boolean; badge?: string;
}) {
  return (
    <Pressable style={({ pressed }) => [s.row, pressed && { opacity: 0.7 }]} onPress={onPress}>
      <View style={[s.rowIcon, { backgroundColor: iconBg ?? (destructive ? C.errorBg : C.bursBg) }]}>
        <MaterialIcons name={icon as any} size={20} color={iconColor ?? (destructive ? C.error : C.burs)} />
      </View>
      <View style={s.rowBody}>
        <Text style={[s.rowLabel, destructive && { color: C.error }]}>{label}</Text>
        {subtitle && <Text style={s.rowSubtitle}>{subtitle}</Text>}
      </View>
      {badge && (
        <View style={s.badge}><Text style={s.badgeText}>{badge}</Text></View>
      )}
      <MaterialIcons name="chevron-right" size={18} color={C.border} />
    </Pressable>
  );
}

// ── Edit Account Details Modal (Step 2 — replaces ChangePasswordModal) ────────
import { Modal, TextInput, ActivityIndicator } from "react-native";
import { api } from "@/lib/api";
import { useQueryClient } from "@tanstack/react-query";

function EditAccountModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const qc = useQueryClient();

  const [currentPw,  setCurrentPw]  = useState("");
  const [newEmail,   setNewEmail]   = useState("");
  const [newPw,      setNewPw]      = useState("");
  const [confirmPw,  setConfirmPw]  = useState("");
  const [showPw,     setShowPw]     = useState(false);
  const [saving,     setSaving]     = useState(false);
  const [err,        setErr]        = useState("");

  const reset = () => {
    setCurrentPw(""); setNewEmail(""); setNewPw(""); setConfirmPw(""); setErr("");
  };

  const handleSave = async () => {
    setErr("");

    // ── Client-side validation ────────────────────────────────────────────
    if (!currentPw) {
      setErr("Current password is required."); return;
    }
    if (!newEmail && !newPw) {
      setErr("Enter a new email address, a new password, or both."); return;
    }
    if (newPw && newPw.length < 8) {
      setErr("New password must be at least 8 characters."); return;
    }
    if (newPw && newPw !== confirmPw) {
      setErr("New passwords do not match."); return;
    }
    if (newEmail && !newEmail.includes("@")) {
      setErr("Enter a valid email address."); return;
    }

    setSaving(true);
    try {
      await api.patch("/auth/me", {
        current_password: currentPw,
        new_email:    newEmail   || undefined,
        new_password: newPw      || undefined,
      });

      // Invalidate the current user query so the UI refreshes
      qc.invalidateQueries({ queryKey: ["current-user"] });

      reset();
      onClose();
      Alert.alert(
        "Details updated",
        newEmail && newPw ? "Email and password have been updated." :
        newEmail          ? "Email address has been updated." :
                            "Password has been updated."
      );
    } catch (e: any) {
      const detail = e?.response?.data?.detail;
      setErr(
        typeof detail === "object" ? detail.message :
        typeof detail === "string" ? detail :
        "Could not update details. Check your current password and try again."
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="formSheet" onRequestClose={onClose}>
      <View style={ed.safe}>
        <View style={ed.header}>
          <Text style={ed.title}>Edit Account Details</Text>
          <Pressable onPress={() => { reset(); onClose(); }} hitSlop={8}>
            <MaterialIcons name="close" size={22} color={C.primary} />
          </Pressable>
        </View>

        <ScrollView style={ed.scroll} contentContainerStyle={ed.body} keyboardShouldPersistTaps="handled">

          {/* Current password — always required */}
          <View style={ed.fieldGroup}>
            <Text style={ed.label}>Current Password *</Text>
            <TextInput
              style={ed.input}
              secureTextEntry
              value={currentPw}
              onChangeText={setCurrentPw}
              placeholder="Enter your current password"
              placeholderTextColor={C.muted}
              autoCapitalize="none"
            />
          </View>

          <View style={ed.divider} />

          {/* New email — optional */}
          <View style={ed.sectionHint}>
            <MaterialIcons name="info-outline" size={14} color={C.muted} />
            <Text style={ed.sectionHintText}>
              Fill in the fields you want to change. Leave blank to keep current.
            </Text>
          </View>

          <View style={ed.fieldGroup}>
            <Text style={ed.label}>New Email Address</Text>
            <TextInput
              style={ed.input}
              value={newEmail}
              onChangeText={setNewEmail}
              placeholder="new@example.co.bw"
              placeholderTextColor={C.muted}
              keyboardType="email-address"
              autoCapitalize="none"
            />
          </View>

          {/* New password — optional */}
          <View style={ed.fieldGroup}>
            <Text style={ed.label}>New Password</Text>
            <View style={{ position: "relative" }}>
              <TextInput
                style={[ed.input, { paddingRight: 46 }]}
                secureTextEntry={!showPw}
                value={newPw}
                onChangeText={setNewPw}
                placeholder="At least 8 characters"
                placeholderTextColor={C.muted}
                autoCapitalize="none"
              />
              <Pressable
                style={ed.eyeBtn}
                onPress={() => setShowPw((p) => !p)}
                hitSlop={8}
              >
                <MaterialIcons name={showPw ? "visibility-off" : "visibility"} size={18} color={C.muted} />
              </Pressable>
            </View>
          </View>

          <View style={ed.fieldGroup}>
            <Text style={ed.label}>Confirm New Password</Text>
            <TextInput
              style={ed.input}
              secureTextEntry={!showPw}
              value={confirmPw}
              onChangeText={setConfirmPw}
              placeholder="Repeat new password"
              placeholderTextColor={C.muted}
              autoCapitalize="none"
            />
          </View>

          {err ? (
            <View style={ed.errRow}>
              <MaterialIcons name="error-outline" size={14} color={C.error} />
              <Text style={ed.errText}>{err}</Text>
            </View>
          ) : null}

          <Pressable
            style={({ pressed }) => [ed.btn, pressed && { opacity: 0.8 }, saving && { opacity: 0.6 }]}
            onPress={handleSave}
            disabled={saving}
          >
            {saving
              ? <ActivityIndicator color="#fff" size="small" />
              : <Text style={ed.btnText}>Save Changes</Text>
            }
          </Pressable>
        </ScrollView>
      </View>
    </Modal>
  );
}

const ed = StyleSheet.create({
  safe:        { flex: 1, backgroundColor: C.bg },
  header:      { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 20, borderBottomWidth: 1, borderBottomColor: C.border, backgroundColor: C.container },
  title:       { fontSize: 17, fontFamily: "PublicSans_700Bold", color: C.primary },
  scroll:      { flex: 1 },
  body:        { padding: 20, gap: 16 },
  fieldGroup:  { gap: 6 },
  label:       { fontSize: 13, fontFamily: "PublicSans_600SemiBold", color: C.mid },
  input:       { backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, fontFamily: "PublicSans_400Regular", color: C.primary },
  eyeBtn:      { position: "absolute", right: 12, top: 13 },
  divider:     { height: 1, backgroundColor: C.borderSoft },
  sectionHint: { flexDirection: "row", alignItems: "flex-start", gap: 6, backgroundColor: C.containerLow, borderRadius: 8, padding: 10 },
  sectionHintText: { flex: 1, fontSize: 12, fontFamily: "PublicSans_400Regular", color: C.muted, lineHeight: 17 },
  errRow:      { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: C.errorBg, borderRadius: 8, padding: 10 },
  errText:     { flex: 1, fontSize: 12, color: C.error, fontFamily: "PublicSans_400Regular" },
  btn:         { backgroundColor: C.primary, borderRadius: 12, paddingVertical: 14, alignItems: "center", marginTop: 8 },
  btnText:     { color: "#fff", fontFamily: "PublicSans_700Bold", fontSize: 15 },
});

// ── Invite Team Modal (FE-18 — unchanged) ─────────────────────────────────────
function InviteTeamModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const [email,   setEmail]   = useState("");
  const [role,    setRole]    = useState<"accountant" | "admin">("accountant");
  const [sending, setSending] = useState(false);
  const [err,     setErr]     = useState("");

  const roles: { value: "accountant" | "admin"; label: string; desc: string }[] = [
    { value: "accountant", label: "Accountant",    desc: "Can view deadlines and upload documents"   },
    { value: "admin",      label: "Administrator", desc: "Full access including user management"     },
  ];

  const handleSend = async () => {
    if (!email.includes("@")) { setErr("Please enter a valid email address."); return; }
    setSending(true); setErr("");
    try {
      await api.post("/team/invite", { email, role });
      setEmail(""); onClose();
      Alert.alert("Invite sent", `An invitation has been sent to ${email}.`);
    } catch (e: any) {
      setErr(e?.response?.data?.detail ?? "Could not send invite. Please try again.");
    } finally { setSending(false); }
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="formSheet" onRequestClose={onClose}>
      <View style={inv.safe}>
        <View style={inv.header}>
          <Text style={inv.title}>Invite Team Member</Text>
          <Pressable onPress={onClose} hitSlop={8}><MaterialIcons name="close" size={22} color={C.primary} /></Pressable>
        </View>
        <ScrollView style={inv.scroll} contentContainerStyle={inv.body} keyboardShouldPersistTaps="handled">
          <Text style={inv.label}>Email Address</Text>
          <TextInput
            style={inv.input}
            value={email}
            onChangeText={setEmail}
            placeholder="colleague@company.co.bw"
            placeholderTextColor={C.muted}
            keyboardType="email-address"
            autoCapitalize="none"
          />

          <Text style={[inv.label, { marginTop: 16 }]}>Role</Text>
          {roles.map((r) => (
            <Pressable
              key={r.value}
              style={[inv.roleCard, role === r.value && inv.roleCardActive]}
              onPress={() => setRole(r.value)}
            >
              <View style={inv.roleCheck}>
                <MaterialIcons
                  name={role === r.value ? "radio-button-checked" : "radio-button-unchecked"}
                  size={20}
                  color={role === r.value ? C.burs : C.border}
                />
              </View>
              <View>
                <Text style={[inv.roleLabel, role === r.value && { color: C.burs }]}>{r.label}</Text>
                <Text style={inv.roleDesc}>{r.desc}</Text>
              </View>
            </Pressable>
          ))}

          {err ? (
            <View style={inv.errRow}>
              <MaterialIcons name="error-outline" size={14} color={C.error} />
              <Text style={inv.errText}>{err}</Text>
            </View>
          ) : null}

          <Pressable
            style={({ pressed }) => [inv.btn, pressed && { opacity: 0.8 }, sending && { opacity: 0.6 }]}
            onPress={handleSend} disabled={sending}
          >
            {sending ? <ActivityIndicator color="#fff" size="small" /> : (
              <>
                <MaterialIcons name="send" size={16} color="#fff" />
                <Text style={inv.btnText}>Send Invite</Text>
              </>
            )}
          </Pressable>
        </ScrollView>
      </View>
    </Modal>
  );
}

const inv = StyleSheet.create({
  safe:        { flex: 1, backgroundColor: C.bg },
  header:      { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 20, borderBottomWidth: 1, borderBottomColor: C.border, backgroundColor: C.container },
  title:       { fontSize: 17, fontFamily: "PublicSans_700Bold", color: C.primary },
  scroll:      { flex: 1 },
  body:        { padding: 20, gap: 8 },
  label:       { fontSize: 13, fontFamily: "PublicSans_600SemiBold", color: C.mid, marginBottom: 6 },
  input:       { backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, fontFamily: "PublicSans_400Regular", color: C.primary },
  roleCard:    { flexDirection: "row", alignItems: "flex-start", gap: 10, padding: 14, borderRadius: 12, borderWidth: 1, borderColor: C.border, backgroundColor: C.surface, marginBottom: 8 },
  roleCardActive:{ borderColor: C.burs, backgroundColor: C.bursBg },
  roleCheck:   { marginTop: 1 },
  roleLabel:   { fontSize: 14, fontFamily: "PublicSans_600SemiBold", color: C.primary, marginBottom: 2 },
  roleDesc:    { fontSize: 12, fontFamily: "PublicSans_400Regular", color: C.muted },
  errRow:      { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: C.errorBg, borderRadius: 8, padding: 10, marginTop: 4 },
  errText:     { flex: 1, fontSize: 12, color: C.error },
  btn:         { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: C.primary, borderRadius: 12, paddingVertical: 14, marginTop: 12 },
  btnText:     { color: "#fff", fontFamily: "PublicSans_700Bold", fontSize: 15 },
});

// ── Main Settings Screen ──────────────────────────────────────────────────────
export default function SettingsScreen() {
  const logout = useAuthStore((st) => st.logout);
  const { data: currentUser } = useCurrentUser();
  // Step 2: renamed state var from showChangePassword → showEditAccount
  const [showEditAccount, setShowEditAccount] = useState(false);
  const [showInvite,      setShowInvite]      = useState(false);

  const isAccountantOrAdmin =
    currentUser?.role === "accountant" || currentUser?.role === "admin";

  const handleLogout = () => {
    Alert.alert("Sign Out", "Are you sure you want to sign out?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Sign Out", style: "destructive",
        onPress: async () => { await logout(); router.replace("/(auth)/login"); },
      },
    ]);
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      "Delete Account",
      "This will permanently delete your account and all data. This cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete", style: "destructive",
          onPress: async () => {
            try {
              await api.delete("/auth/account");
              await logout();
              router.replace("/(auth)/login");
            } catch {
              Alert.alert("Error", "Could not delete account. Please contact support.");
            }
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={s.safe} edges={["top"]}>
      <View style={s.header}>
        <Text style={s.title}>Settings</Text>
      </View>

      <ScrollView style={s.scroll} contentContainerStyle={s.body} showsVerticalScrollIndicator={false}>

        {/* FE-19: Client switcher — only for accountant/admin */}
        {isAccountantOrAdmin && (
          <>
            <Text style={s.section}>CLIENT MANAGEMENT</Text>
            <View style={s.card}>
              <SettingsRow
                icon="switch-account"
                iconBg={C.labourBg}
                iconColor={C.labour}
                label="Switch Client"
                subtitle="View and manage a different business"
                onPress={() => router.push("/client-switcher" as any)}
              />
            </View>
          </>
        )}

        {/* Compliance */}
        <Text style={s.section}>COMPLIANCE</Text>
        <View style={s.card}>
          <SettingsRow
            icon="checklist" iconBg={C.tealBg} iconColor={C.teal}
            label="Business Setup Guide"
            subtitle="Step-by-step Botswana compliance onboarding"
            onPress={() => router.push("/starter-guide" as any)}
          />
          <View style={s.divider} />
          <SettingsRow
            icon="history" iconBg={C.bursBg} iconColor={C.burs}
            label="Filing History"
            subtitle="Audit trail of all compliance actions"
            onPress={() => router.push("/history" as any)}
          />
          <View style={s.divider} />
          <SettingsRow
            icon="menu-book" iconBg={C.secondaryBg} iconColor={C.secondary}
            label="Knowledge Base"
            subtitle="BURS, CIPA and labour guides"
            onPress={() => router.push("/knowledge-base" as any)}
          />
        </View>

        {/* Notifications */}
        <Text style={s.section}>NOTIFICATIONS</Text>
        <View style={s.card}>
          <SettingsRow
            icon="notifications" iconBg={C.amberBg} iconColor={C.amber}
            label="Notification Preferences"
            subtitle="Reminders, penalty alerts, weekly digest"
            onPress={() => router.push("/notification-preferences" as any)}
          />
        </View>

        {/* Account — Step 2: "Change Password" → "Edit Account Details" */}
        <Text style={s.section}>ACCOUNT</Text>
        <View style={s.card}>
          <SettingsRow
            icon="group" iconBg={C.bursBg} iconColor={C.burs}
            label="Invite Team Member"
            subtitle="Add an accountant or admin to your business"
            onPress={() => setShowInvite(true)}
          />
          <View style={s.divider} />
          <SettingsRow
            icon="manage-accounts" iconBg={C.containerLow} iconColor={C.mid}
            label="Edit Account Details"
            subtitle="Change email or password"
            onPress={() => setShowEditAccount(true)}
          />
          <View style={s.divider} />
          <SettingsRow
            icon="person" iconBg={C.bursBg} iconColor={C.burs}
            label="Business Profile"
            subtitle="View and edit your registration details"
            onPress={() => router.push("/profile" as any)}
          />
        </View>

        {/* Danger zone */}
        <Text style={s.section}>DANGER ZONE</Text>
        <View style={s.card}>
          <SettingsRow icon="logout" label="Sign Out" onPress={handleLogout} destructive />
          <View style={s.divider} />
          <SettingsRow icon="delete-forever" label="Delete Account" onPress={handleDeleteAccount} destructive />
        </View>

        <Text style={s.version}>CompliancePro Botswana  ·  v1.0.0-w6</Text>
        <View style={{ height: 40 }} />
      </ScrollView>

      {/* FE-18 Modals */}
      <EditAccountModal visible={showEditAccount} onClose={() => setShowEditAccount(false)} />
      <InviteTeamModal  visible={showInvite}      onClose={() => setShowInvite(false)} />
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:       { flex: 1, backgroundColor: C.bg },
  header:     { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 12, backgroundColor: C.container, borderBottomWidth: 1, borderBottomColor: C.border },
  title:      { fontSize: 22, fontFamily: "PublicSans_700Bold", color: C.primary },
  scroll:     { flex: 1 },
  body:       { padding: 16 },
  section:    { fontSize: 10, fontFamily: "PublicSans_700Bold", color: C.muted, letterSpacing: 1.2, textTransform: "uppercase", marginBottom: 8, marginTop: 16, paddingHorizontal: 4 },
  card:       { backgroundColor: C.surface, borderRadius: 12, borderWidth: 1, borderColor: C.border, overflow: "hidden" },
  divider:    { height: 1, backgroundColor: C.borderSoft, marginHorizontal: 16 },
  row:        { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 14, gap: 12 },
  rowIcon:    { width: 34, height: 34, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  rowBody:    { flex: 1 },
  rowLabel:   { fontSize: 14, fontFamily: "PublicSans_600SemiBold", color: C.primary },
  rowSubtitle:{ fontSize: 11, fontFamily: "PublicSans_400Regular", color: C.muted, marginTop: 1 },
  badge:      { backgroundColor: C.amberBg, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999, marginRight: 4 },
  badgeText:  { fontSize: 10, fontFamily: "PublicSans_700Bold", color: C.amber },
  version:    { fontSize: 11, color: C.muted, textAlign: "center", marginTop: 24 },
});