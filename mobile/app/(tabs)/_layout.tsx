import { Tabs } from "expo-router";

export default function TabsLayout() {
  return (
    <Tabs screenOptions={{ tabBarActiveTintColor: "#111", headerShown: false }}>
      <Tabs.Screen name="index"    options={{ title: "Dashboard" }} />
      <Tabs.Screen name="vault"    options={{ title: "Documents" }} />
      <Tabs.Screen name="reports"  options={{ title: "Reports" }} />
      <Tabs.Screen name="settings" options={{ title: "Settings" }} />
    </Tabs>
  );
}
