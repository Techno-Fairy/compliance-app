/**
 * app/index.tsx — Landing screen
 *
 * Replaces the old `<Redirect href="/(auth)/login" />` stub.
 *
 * Two paths:
 *  A) "I already have a registered business" → existing login / register flow
 *  B) "I'm starting a new business"          → public Starter Guide (no login)
 *
 * If the user already has a stored JWT access token they are forwarded
 * directly to the dashboard, skipping this screen entirely.
 */
import { useEffect } from "react";
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  StatusBar,
  Image,
} from "react-native";
import { useRouter } from "expo-router";
import * as SecureStore from "expo-secure-store";
import { SafeAreaView } from "react-native-safe-area-context";
import { MaterialIcons } from "@expo/vector-icons";

const C = {
  bg:       "#f3faff",
  primary:  "#000b25",
  mid:      "#44474e",
  muted:    "#75777f",
  teal:     "#006874",
  tealBg:   "#d8f3f6",
  tealDark: "#004f58",
  secondary:"#2a6b2c",
  border:   "#c5c6cf",
  surface:  "#ffffff",
};

export default function LandingScreen() {
  const router = useRouter();

  // Auto-forward authenticated users straight to dashboard
  useEffect(() => {
    SecureStore.getItemAsync("access_token").then((token) => {
      if (token) router.replace("/(tabs)" as any);
    });
  }, []);

  return (
    <SafeAreaView style={s.safe}>
      <StatusBar barStyle="dark-content" backgroundColor={C.bg} />

      {/* ── Hero ── */}
      <View style={s.hero}>
        <View style={s.logoCircle}>
          <MaterialIcons name="verified-user" size={38} color={C.teal} />
        </View>
        <Text style={s.appName}>CompliancePro</Text>
        <Text style={s.tagline}>Botswana Business Compliance</Text>
        <Text style={s.subtext}>
          Track BURS, CIPA, and Labour Act obligations — all in one place.
        </Text>
      </View>

      {/* ── Choice cards ── */}
      <View style={s.cards}>
        {/* Path A: Established business */}
        <Pressable
          style={({ pressed }) => [s.card, s.cardPrimary, pressed && { opacity: 0.88 }]}
          onPress={() => router.push("/(auth)/login" as any)}
          accessibilityRole="button"
          accessibilityLabel="Log in or register for an existing business"
        >
          <View style={s.cardIcon}>
            <MaterialIcons name="business" size={26} color={C.teal} />
          </View>
          <View style={s.cardText}>
            <Text style={s.cardTitle}>I have a registered business</Text>
            <Text style={s.cardDesc}>Log in or create an account for your existing business.</Text>
          </View>
          <MaterialIcons name="chevron-right" size={22} color={C.muted} />
        </Pressable>

        {/* Path B: Starting out */}
        <Pressable
          style={({ pressed }) => [s.card, s.cardSecondary, pressed && { opacity: 0.88 }]}
          onPress={() => router.push("/starter-guide" as any)}
          accessibilityRole="button"
          accessibilityLabel="Open the Business Starter Guide"
        >
          <View style={[s.cardIcon, s.cardIconGreen]}>
            <MaterialIcons name="rocket-launch" size={26} color={C.secondary} />
          </View>
          <View style={s.cardText}>
            <Text style={[s.cardTitle, { color: C.secondary }]}>I'm starting a new business</Text>
            <Text style={s.cardDesc}>
              Step-by-step guide to CIPA registration, BURS tax setup, and more.
            </Text>
          </View>
          <MaterialIcons name="chevron-right" size={22} color={C.muted} />
        </Pressable>

        {/* Path C: Invited accountant */}
        <Pressable
          style={({ pressed }) => [s.card, s.cardInvited, pressed && { opacity: 0.88 }]}
          onPress={() => router.push("/(auth)/register-invited" as any)}
          accessibilityRole="button"
          accessibilityLabel="Accept a team invitation"
        >
          <View style={[s.cardIcon, s.cardIconAmber]}>
            <MaterialIcons name="mail" size={26} color="#7D5A1E" />
          </View>
          <View style={s.cardText}>
            <Text style={[s.cardTitle, { color: "#7D5A1E" }]}>I received an invitation</Text>
            <Text style={s.cardDesc}>
              Accept a team invite and access a client's compliance dashboard.
            </Text>
          </View>
          <MaterialIcons name="chevron-right" size={22} color={C.muted} />
        </Pressable>
      </View>

      {/* ── Footer note ── */}
      <Text style={s.footer}>
        No business registration required to accept an invite.
      </Text>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: C.bg, paddingHorizontal: 20 },

  hero: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 20,
    gap: 8,
  },
  logoCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: C.tealBg,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: C.teal + "55",
    marginBottom: 6,
  },
  appName:  { fontSize: 28, fontFamily: "PublicSans_700Bold", color: C.primary },
  tagline:  { fontSize: 14, fontFamily: "PublicSans_600SemiBold", color: C.teal },
  subtext:  {
    fontSize: 13,
    fontFamily: "PublicSans_400Regular",
    color: C.muted,
    textAlign: "center",
    lineHeight: 19,
    marginTop: 4,
    maxWidth: 280,
  },

  cards: { gap: 12, marginBottom: 24 },

  card: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: C.surface,
    borderRadius: 16,
    padding: 16,
    gap: 12,
    borderWidth: 1,
    borderColor: C.border,
  },
  cardPrimary:   { borderLeftWidth: 4, borderLeftColor: C.teal },
  cardSecondary: { borderLeftWidth: 4, borderLeftColor: C.secondary },
  cardInvited:   { borderLeftWidth: 4, borderLeftColor: "#D4830A" },
  cardIconAmber: { backgroundColor: "#FEF3E2" },

  cardIcon: {
    width: 46,
    height: 46,
    borderRadius: 12,
    backgroundColor: C.tealBg,
    alignItems: "center",
    justifyContent: "center",
  },
  cardIconGreen: { backgroundColor: "#e8f5e9" },

  cardText:  { flex: 1, gap: 3 },
  cardTitle: { fontSize: 14, fontFamily: "PublicSans_700Bold", color: C.primary },
  cardDesc:  { fontSize: 12, fontFamily: "PublicSans_400Regular", color: C.muted, lineHeight: 17 },

  footer: {
    textAlign: "center",
    fontSize: 12,
    fontFamily: "PublicSans_400Regular",
    color: C.muted,
    marginBottom: 12,
  },
});