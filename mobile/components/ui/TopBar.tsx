// mobile/components/ui/TopBar.tsx
//
// Shared top bar used across all tab screens.
// The avatar is a pressable "person" icon that navigates to /profile (view screen).

import { MaterialIcons } from "@expo/vector-icons";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";

const C = {
  primary:   "#000b25",
  container: "#dbf1fe",
  border:    "#c5c6cf",
  burs:      "#1A3C5E",
  bursBg:    "#EAF0F7",
};

interface TopBarProps {
  /** Optional: render a back arrow instead of the menu icon */
  showBack?: boolean;
}

export function TopBar({ showBack = false }: TopBarProps) {
  return (
    <View style={s.topBar}>
      <View style={s.left}>
        {showBack ? (
          <Pressable
            onPress={() => router.back()}
            style={({ pressed }) => [s.iconBtn, pressed && s.pressed]}
            hitSlop={8}
          >
            <MaterialIcons name="arrow-back" size={24} color={C.primary} />
          </Pressable>
        ) : (
          <MaterialIcons name="menu" size={24} color={C.primary} />
        )}
        <Text style={s.appTitle}>CompliancePro Botswana</Text>
      </View>

      {/* Profile avatar — tapping navigates to /profile (read-only view) */}
      <Pressable
        onPress={() => router.push("/profile")}
        style={({ pressed }) => [s.avatar, pressed && s.avatarPressed]}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel="View business profile"
      >
        <MaterialIcons name="person" size={22} color={C.burs} />
      </Pressable>
    </View>
  );
}

const s = StyleSheet.create({
  topBar: {
    flexDirection:     "row",
    justifyContent:    "space-between",
    alignItems:        "center",
    height:            56,
    paddingHorizontal: 16,
    backgroundColor:   C.container,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  left: {
    flexDirection: "row",
    alignItems:    "center",
    gap:           12,
  },
  appTitle: {
    fontSize:   17,
    fontFamily: "PublicSans_700Bold",
    color:      C.primary,
  },
  iconBtn: {
    padding: 2,
  },
  pressed: {
    opacity: 0.6,
  },

  // Avatar circle
  avatar: {
    width:           38,
    height:          38,
    borderRadius:    19,
    backgroundColor: C.bursBg,
    alignItems:      "center",
    justifyContent:  "center",
    borderWidth:     1,
    borderColor:     C.border,
  },
  avatarPressed: {
    opacity:         0.7,
    backgroundColor: "#d5ecf8",
  },
});