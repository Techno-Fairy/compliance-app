// mobile/app/(tabs)/_layout.tsx
//
// Custom bottom tab bar that mirrors the HTML reference:
//   - Active tab  → green pill (secondary-container) + filled icon + colored label
//   - Inactive tab → transparent + outline icon + muted label
//
// Icons sourced from @expo/vector-icons MaterialIcons (already in package.json).
// Filled variants use the "rounded" set where available; for "home" we swap
// name to get the filled look (MaterialIcons ships filled as default for most).

import { Tabs } from "expo-router";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { MaterialIcons } from "@expo/vector-icons";
import type { BottomTabBarProps } from "@react-navigation/bottom-tabs";

// ── Design tokens (matches index.tsx and HTML palette) ────────────────────────
const C = {
  surface:          "#f3faff",
  primary:          "#000b25",
  secondary:        "#2a6b2c",
  secondaryBg:      "#acf4a4",   // secondary-container pill
  secondaryText:    "#307231",   // on-secondary-container
  muted:            "#44474e",   // on-surface-variant
  border:           "#c5c6cf",   // outline-variant
};

// ── Tab definitions ───────────────────────────────────────────────────────────
// MaterialIcons ships filled icons by default.
// For inactive states we use the "-outlined" or open variants where they exist.
const TABS: {
  name: string;
  label: string;
  iconActive: React.ComponentProps<typeof MaterialIcons>["name"];
  iconInactive: React.ComponentProps<typeof MaterialIcons>["name"];
}[] = [
  {
    name: "index",
    label: "Home",
    iconActive:   "dashboard",           // filled dashboard
    iconInactive: "dashboard",           // MaterialIcons has no outlined dashboard; we dim it instead
  },
  {
    name: "vault",
    label: "Vault",
    iconActive:   "folder-shared",
    iconInactive: "folder-shared",
  },
  {
    name: "reports",
    label: "Reports",
    iconActive:   "bar-chart",
    iconInactive: "bar-chart",
  },
  {
    name: "settings",
    label: "Settings",
    iconActive:   "settings",
    iconInactive: "settings-suggest",   // subtle difference, or keep same + dim
  },
];

// ── Custom Tab Bar ────────────────────────────────────────────────────────────
function ComplianceTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();

  return (
    <View
      style={[
        styles.bar,
        {
          paddingBottom: insets.bottom > 0 ? insets.bottom : 8,
          height: 64 + (insets.bottom > 0 ? insets.bottom : 8),
        },
      ]}
    >
      {state.routes.map((route, index) => {
        const isActive = state.index === index;
        const tab = TABS[index];

        const onPress = () => {
          const event = navigation.emit({
            type: "tabPress",
            target: route.key,
            canPreventDefault: true,
          });
          if (!isActive && !event.defaultPrevented) {
            navigation.navigate(route.name);
          }
        };

        return (
          <Pressable
            key={route.key}
            onPress={onPress}
            style={({ pressed }) => [
              styles.tabItem,
              pressed && styles.tabItemPressed,
            ]}
            accessibilityRole="button"
            accessibilityState={isActive ? { selected: true } : {}}
            accessibilityLabel={tab?.label}
          >
            {/* Pill + icon + label container */}
            <View style={[styles.pill, isActive && styles.pillActive]}>
              <MaterialIcons
                name={isActive ? tab?.iconActive : tab?.iconInactive}
                size={22}
                color={isActive ? C.secondaryText : C.muted}
              />
              {isActive && (
                <Text style={styles.labelActive}>{tab?.label}</Text>
              )}
            </View>

            {/* Label below pill when inactive */}
            {!isActive && (
              <Text style={styles.labelInactive}>{tab?.label}</Text>
            )}
          </Pressable>
        );
      })}
    </View>
  );
}

// ── Layout ────────────────────────────────────────────────────────────────────
export default function TabsLayout() {
  return (
    <Tabs
      tabBar={(props) => <ComplianceTabBar {...props} />}
      screenOptions={{ headerShown: false }}
    >
      <Tabs.Screen name="index"    options={{ title: "Home" }} />
      <Tabs.Screen name="vault"    options={{ title: "Vault" }} />
      <Tabs.Screen name="reports"  options={{ title: "Reports" }} />
      <Tabs.Screen name="settings" options={{ title: "Settings" }} />
    </Tabs>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  bar: {
    flexDirection:   "row",
    justifyContent:  "space-around",
    alignItems:      "center",
    backgroundColor: C.surface,
    borderTopWidth:  1,
    borderTopColor:  C.border,
    // Elevated card feel
    ...Platform.select({
      ios: {
        shadowColor:   "#000",
        shadowOffset:  { width: 0, height: -2 },
        shadowOpacity: 0.06,
        shadowRadius:  8,
      },
      android: { elevation: 8 },
    }),
  },

  tabItem: {
    flex:           1,
    alignItems:     "center",
    justifyContent: "center",
    paddingTop:     8,
    gap:            2,
  },
  tabItemPressed: {
    opacity: 0.7,
  },

  // The pill — inactive is just transparent sizing so inactive label sits below
  pill: {
    flexDirection:  "row",
    alignItems:     "center",
    justifyContent: "center",
    gap:            6,
    paddingHorizontal: 12,
    paddingVertical:   6,
    borderRadius:   999,             // fully rounded, matches HTML rounded-full
    minWidth:       40,
  },
  pillActive: {
    backgroundColor: C.secondaryBg, // #acf4a4  ← secondary-container from HTML
  },

  // Label inside the active pill
  labelActive: {
    fontSize:    12,
    fontFamily:  "PublicSans_600SemiBold",
    color:       C.secondaryText,   // #307231  ← on-secondary-container
    letterSpacing: 0.05 * 12,
  },

  // Label beneath the icon when inactive
  labelInactive: {
    fontSize:    11,
    fontFamily:  "PublicSans_600SemiBold",
    color:       C.muted,
    letterSpacing: 0.03 * 11,
    marginTop:   2,
  },
});