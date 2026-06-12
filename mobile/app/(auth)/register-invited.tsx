// mobile/app/(auth)/register-invited.tsx
//
// Simplified registration for users who received a team invite.
// Collects only: full name, email, password.
// After registering, immediately calls POST /team/accept/{token}.
// No business profile setup required.

import React, { useState, useRef } from "react";
import {
  View, Text, TextInput, Pressable, StyleSheet,
  ActivityIndicator, Alert, ScrollView, TouchableOpacity,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { MaterialIcons, Ionicons } from "@expo/vector-icons";
import * as SecureStore from "expo-secure-store";
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
  teal:      "#006874",
  tealBg:    "#d8f3f6",
  error:     "#ba1a1a",
  errorBg:   "#ffdad6",
  container: "#dbf1fe",
};

export default function RegisterInvitedScreen() {
  const { token } = useLocalSearchParams<{ token: string }>();

  const [fullName,     setFullName]     = useState("");
  const [email,        setEmail]        = useState("");
  const [password,     setPassword]     = useState("");
  const [confirm,      setConfirm]      = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm,  setShowConfirm]  = useState(false);
  const [loading,      setLoading]      = useState(false);
  const [apiError,     setApiError]     = useState("");

  const register = useAuthStore((s) => s.register);

  const emailRef    = useRef<TextInput>(null);
  const passwordRef = useRef<TextInput>(null);
  const confirmRef  = useRef<TextInput>(null);

  const validateEmail = (e: string) =>
    /^[^\s@]+@([^\s@.,]+\.)+[^\s@.,]{2,}$/.test(e.toLowerCase());

  const handleRegister = async () => {
    setApiError("");
    const name = fullName.trim();
    const mail = email.trim().toLowerCase();

    if (name.length < 2)
      return Alert.alert("Validation", "Please enter your full name.");
    if (!validateEmail(mail))
      return Alert.alert("Validation", "Enter a valid email address.");
    if (password.length < 8)
      return Alert.alert("Validation", "Password must be at least 8 characters.");
    if (password !== confirm)
      return Alert.alert("Validation", "Passwords do not match.");

    setLoading(true);
    try {
      // Step 1: create the account (simple — no business profile)
      await register(name, mail, password);

      // Step 2: accept the invite token if one was provided
      if (token) {
        try {
          await api.post(`/team/accept/${token}`);
        } catch (inviteErr: any) {
          // Invite accept failed — account was still created successfully.
          // Common cause: token expired or email mismatch.
          const msg =
            inviteErr?.response?.data?.detail?.message ??
            "Your account was created but the invite could not be accepted. " +
            "Ask the business owner to resend the invite.";
          Alert.alert("Invite Issue", msg, [
            { text: "OK", onPress: () => router.replace("/(tabs)" as any) },
          ]);
          return;
        }
      }

      // Success — go to client switcher if we accepted an invite,
      // otherwise go to dashboard
      router.replace(
        token ? ("/client-switcher" as any) : ("/(tabs)" as any)
      );
    } catch (err: any) {
      const detail = err?.response?.data?.detail;
      const msg =
        typeof detail === "object"
          ? detail?.message
          : typeof detail === "string"
          ? detail
          : "Registration failed. Please try again.";
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
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
          <MaterialIcons name="arrow-back" size={22} color={C.primary} />
        </TouchableOpacity>
      </View>

      {/* Invite badge */}
      {token ? (
        <View style={s.inviteBadge}>
          <MaterialIcons name="mail" size={16} color={C.secondary} />
          <Text style={s.inviteText}>
            You have been invited to join a business on CompliancePro.
            Create your account to accept.
          </Text>
        </View>
      ) : null}

      {/* Intro */}
      <View style={s.intro}>
        <Text style={s.title}>Create Account</Text>
        <Text style={s.sub}>
          Enter your details to get started. No business registration required.
        </Text>
      </View>

      {/* Error banner */}
      {apiError ? (
        <View style={s.errorBanner}>
          <MaterialIcons name="error-outline" size={16} color={C.error} />
          <Text style={s.errorText}>{apiError}</Text>
        </View>
      ) : null}

      {/* Form */}
      <View style={s.form}>
        {/* Full name */}
        <View style={s.field}>
          <Text style={s.label}>FULL NAME</Text>
          <View style={s.inputWrap}>
            <View style={s.inputIcon}>
              <MaterialIcons name="person" size={18} color={C.mid} />
            </View>
            <TextInput
              style={s.input}
              placeholder="Motsamai Kgosi"
              placeholderTextColor="#a0a3ab"
              value={fullName}
              onChangeText={setFullName}
              autoCapitalize="words"
              returnKeyType="next"
              onSubmitEditing={() => emailRef.current?.focus()}
              blurOnSubmit={false}
            />
          </View>
        </View>

        {/* Email */}
        <View style={s.field}>
          <Text style={s.label}>EMAIL ADDRESS</Text>
          <View style={s.inputWrap}>
            <View style={s.inputIcon}>
              <MaterialIcons name="mail" size={18} color={C.mid} />
            </View>
            <TextInput
              ref={emailRef}
              style={s.input}
              placeholder="motsamai@example.com"
              placeholderTextColor="#a0a3ab"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              returnKeyType="next"
              onSubmitEditing={() => passwordRef.current?.focus()}
              blurOnSubmit={false}
            />
          </View>
        </View>

        {/* Password */}
        <View style={s.field}>
          <Text style={s.label}>PASSWORD</Text>
          <View style={s.inputWrap}>
            <View style={s.inputIcon}>
              <MaterialIcons name="lock" size={18} color={C.mid} />
            </View>
            <TextInput
              ref={passwordRef}
              style={[s.input, { paddingRight: 48 }]}
              placeholder="Min. 8 characters"
              placeholderTextColor="#a0a3ab"
              secureTextEntry={!showPassword}
              value={password}
              onChangeText={setPassword}
              returnKeyType="next"
              onSubmitEditing={() => confirmRef.current?.focus()}
              blurOnSubmit={false}
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

        {/* Confirm password */}
        <View style={s.field}>
          <Text style={s.label}>CONFIRM PASSWORD</Text>
          <View style={s.inputWrap}>
            <View style={s.inputIcon}>
              <MaterialIcons name="lock-outline" size={18} color={C.mid} />
            </View>
            <TextInput
              ref={confirmRef}
              style={[s.input, { paddingRight: 48 }]}
              placeholder="Repeat password"
              placeholderTextColor="#a0a3ab"
              secureTextEntry={!showConfirm}
              value={confirm}
              onChangeText={setConfirm}
              returnKeyType="done"
              onSubmitEditing={handleRegister}
            />
            <TouchableOpacity
              style={s.eye}
              onPress={() => setShowConfirm(!showConfirm)}
            >
              <Ionicons
                name={showConfirm ? "eye-off" : "eye"}
                size={18}
                color={C.mid}
              />
            </TouchableOpacity>
          </View>
        </View>

        {/* Submit */}
        <Pressable
          style={[s.btn, loading && s.btnDisabled]}
          onPress={handleRegister}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Text style={s.btnText}>
                {token ? "Create Account & Accept Invite" : "Create Account"}
              </Text>
              <MaterialIcons name="arrow-forward" size={20} color="#fff" />
            </>
          )}
        </Pressable>

        {/* Already have account */}
        <View style={s.loginRow}>
          <Text style={s.loginText}>Already have an account?</Text>
          <TouchableOpacity
            onPress={() =>
              router.push({
                pathname: "/(auth)/login-invited" as any,
                params: token ? { token } : {},
              })
            }
          >
            <Text style={s.loginLink}> Log in instead</Text>
          </TouchableOpacity>
        </View>
      </View>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  container:    { flexGrow: 1, backgroundColor: C.bg, paddingHorizontal: 20, paddingBottom: 40 },
  header:       { height: 64, justifyContent: "center" },
  backBtn:      { width: 40, height: 40, borderRadius: 20, justifyContent: "center", alignItems: "center", backgroundColor: C.container },

  inviteBadge:  { flexDirection: "row", alignItems: "flex-start", gap: 10, backgroundColor: C.secondaryBg, borderRadius: 12, padding: 14, borderWidth: 1, borderColor: "#c8e6c9", marginBottom: 20 },
  inviteText:   { flex: 1, fontSize: 13, color: C.secondary, lineHeight: 19, fontFamily: "PublicSans_400Regular" },

  intro:        { marginBottom: 24 },
  title:        { fontSize: 30, fontFamily: "PublicSans_700Bold", color: C.primary, marginBottom: 6 },
  sub:          { fontSize: 14, fontFamily: "PublicSans_400Regular", color: C.mid, lineHeight: 21 },

  errorBanner:  { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: C.errorBg, borderRadius: 10, padding: 12, marginBottom: 16 },
  errorText:    { flex: 1, fontSize: 13, color: C.error, fontFamily: "PublicSans_400Regular" },

  form:         { gap: 18 },
  field:        { gap: 6 },
  label:        { fontSize: 11, fontFamily: "PublicSans_600SemiBold", letterSpacing: 0.7, color: C.mid, textTransform: "uppercase", marginLeft: 2 },
  inputWrap:    { flexDirection: "row", alignItems: "center", backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, borderRadius: 14, height: 52 },
  inputIcon:    { marginLeft: 14, marginRight: 4 },
  input:        { flex: 1, fontSize: 15, fontFamily: "PublicSans_400Regular", color: C.primary, paddingVertical: 12, paddingHorizontal: 10 },
  eye:          { position: "absolute", right: 14 },

  btn:          { backgroundColor: C.primary, borderRadius: 14, paddingVertical: 16, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, marginTop: 8, elevation: 3 },
  btnDisabled:  { opacity: 0.6 },
  btnText:      { fontSize: 17, fontFamily: "PublicSans_600SemiBold", color: "#fff" },

  loginRow:     { flexDirection: "row", justifyContent: "center", marginTop: 4 },
  loginText:    { fontSize: 13, fontFamily: "PublicSans_400Regular", color: C.mid },
  loginLink:    { fontSize: 13, fontFamily: "PublicSans_700Bold", color: C.primary },
});