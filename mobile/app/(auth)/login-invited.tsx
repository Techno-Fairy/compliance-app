// mobile/app/(auth)/login-invited.tsx
//
// Login screen for users who already have an account and received a team invite.
// After login, immediately calls POST /team/accept/{token}.

import React, { useState } from "react";
import {
  View, Text, TextInput, Pressable, StyleSheet,
  ActivityIndicator, Alert, ScrollView, TouchableOpacity,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { MaterialIcons, Ionicons } from "@expo/vector-icons";
import { api } from "@/lib/api";
import { useAuthStore } from "@/store/auth";

const C = {
  bg:        "#f3faff",
  primary:   "#000b25",
  mid:       "#44474e",
  muted:     "#75777f",
  border:    "#c5c6cf",
  surface:   "#ffffff",
  secondary: "#2a6b2c",
  secondaryBg: "#e8f5e9",
  error:     "#ba1a1a",
  errorBg:   "#ffdad6",
  container: "#dbf1fe",
};

export default function LoginInvitedScreen() {
  const { token } = useLocalSearchParams<{ token: string }>();

  const [email,        setEmail]        = useState("");
  const [password,     setPassword]     = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading,      setLoading]      = useState(false);
  const [apiError,     setApiError]     = useState("");

  const login = useAuthStore((s) => s.login);

  const handleLogin = async () => {
    setApiError("");
    const mail = email.trim().toLowerCase();
    if (!mail.includes("@"))
      return Alert.alert("Validation", "Enter a valid email address.");
    if (!password)
      return Alert.alert("Validation", "Password is required.");

    setLoading(true);
    try {
      await login(mail, password);

      if (token) {
        try {
          await api.post(`/team/accept/${token}`);
        } catch (inviteErr: any) {
          const msg =
            inviteErr?.response?.data?.detail?.message ??
            "Login succeeded but the invite could not be accepted. " +
            "Ask the business owner to resend the invite.";
          Alert.alert("Invite Issue", msg, [
            { text: "OK", onPress: () => router.replace("/(tabs)" as any) },
          ]);
          return;
        }
        router.replace("/client-switcher" as any);
      } else {
        router.replace("/(tabs)" as any);
      }
    } catch (err: any) {
      const detail = err?.response?.data?.detail;
      const msg =
        typeof detail === "object"
          ? detail?.message
          : typeof detail === "string"
          ? detail
          : "Invalid email or password.";
      setApiError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView
      contentContainerStyle={s.container}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
          <MaterialIcons name="arrow-back" size={22} color={C.primary} />
        </TouchableOpacity>
      </View>

      {token ? (
        <View style={s.inviteBadge}>
          <MaterialIcons name="mail" size={16} color={C.secondary} />
          <Text style={s.inviteText}>
            Log in to accept your team invitation.
          </Text>
        </View>
      ) : null}

      <View style={s.intro}>
        <Text style={s.title}>Welcome Back</Text>
        <Text style={s.sub}>Log in to your CompliancePro account.</Text>
      </View>

      {apiError ? (
        <View style={s.errorBanner}>
          <MaterialIcons name="error-outline" size={16} color={C.error} />
          <Text style={s.errorText}>{apiError}</Text>
        </View>
      ) : null}

      <View style={s.form}>
        <View style={s.field}>
          <Text style={s.label}>EMAIL ADDRESS</Text>
          <View style={s.inputWrap}>
            <View style={s.inputIcon}>
              <MaterialIcons name="mail" size={18} color={C.mid} />
            </View>
            <TextInput
              style={s.input}
              placeholder="your@email.com"
              placeholderTextColor="#a0a3ab"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              returnKeyType="next"
              blurOnSubmit={false}
            />
          </View>
        </View>

        <View style={s.field}>
          <Text style={s.label}>PASSWORD</Text>
          <View style={s.inputWrap}>
            <View style={s.inputIcon}>
              <MaterialIcons name="lock" size={18} color={C.mid} />
            </View>
            <TextInput
              style={[s.input, { paddingRight: 48 }]}
              placeholder="Your password"
              placeholderTextColor="#a0a3ab"
              secureTextEntry={!showPassword}
              value={password}
              onChangeText={setPassword}
              returnKeyType="done"
              onSubmitEditing={handleLogin}
            />
            <TouchableOpacity
              style={s.eye}
              onPress={() => setShowPassword(!showPassword)}
            >
              <Ionicons
                name={showPassword ? "eye-off" : "eye"}
                size={18}
                color={C.mid}
              />
            </TouchableOpacity>
          </View>
        </View>

        <Pressable
          style={[s.btn, loading && s.btnDisabled]}
          onPress={handleLogin}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Text style={s.btnText}>
                {token ? "Log In & Accept Invite" : "Log In"}
              </Text>
              <MaterialIcons name="arrow-forward" size={20} color="#fff" />
            </>
          )}
        </Pressable>

        <View style={s.switchRow}>
          <Text style={s.switchText}>Don't have an account?</Text>
          <TouchableOpacity
            onPress={() =>
              router.push({
                pathname: "/(auth)/register-invited" as any,
                params: token ? { token } : {},
              })
            }
          >
            <Text style={s.switchLink}> Register instead</Text>
          </TouchableOpacity>
        </View>
      </View>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  container:   { flexGrow: 1, backgroundColor: C.bg, paddingHorizontal: 20, paddingBottom: 40 },
  header:      { height: 64, justifyContent: "center" },
  backBtn:     { width: 40, height: 40, borderRadius: 20, justifyContent: "center", alignItems: "center", backgroundColor: C.container },

  inviteBadge: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: C.secondaryBg, borderRadius: 12, padding: 14, borderWidth: 1, borderColor: "#c8e6c9", marginBottom: 20 },
  inviteText:  { flex: 1, fontSize: 13, color: C.secondary, fontFamily: "PublicSans_400Regular" },

  intro:       { marginBottom: 24 },
  title:       { fontSize: 30, fontFamily: "PublicSans_700Bold", color: C.primary, marginBottom: 6 },
  sub:         { fontSize: 14, fontFamily: "PublicSans_400Regular", color: C.mid, lineHeight: 21 },

  errorBanner: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: C.errorBg, borderRadius: 10, padding: 12, marginBottom: 16 },
  errorText:   { flex: 1, fontSize: 13, color: C.error, fontFamily: "PublicSans_400Regular" },

  form:        { gap: 18 },
  field:       { gap: 6 },
  label:       { fontSize: 11, fontFamily: "PublicSans_600SemiBold", letterSpacing: 0.7, color: C.mid, textTransform: "uppercase", marginLeft: 2 },
  inputWrap:   { flexDirection: "row", alignItems: "center", backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, borderRadius: 14, height: 52 },
  inputIcon:   { marginLeft: 14, marginRight: 4 },
  input:       { flex: 1, fontSize: 15, fontFamily: "PublicSans_400Regular", color: C.primary, paddingVertical: 12, paddingHorizontal: 10 },
  eye:         { position: "absolute", right: 14 },

  btn:         { backgroundColor: C.primary, borderRadius: 14, paddingVertical: 16, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, marginTop: 8, elevation: 3 },
  btnDisabled: { opacity: 0.6 },
  btnText:     { fontSize: 17, fontFamily: "PublicSans_600SemiBold", color: "#fff" },

  switchRow:   { flexDirection: "row", justifyContent: "center", marginTop: 4 },
  switchText:  { fontSize: 13, fontFamily: "PublicSans_400Regular", color: C.mid },
  switchLink:  { fontSize: 13, fontFamily: "PublicSans_700Bold", color: C.primary },
});