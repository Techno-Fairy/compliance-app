import { View, Text, StyleSheet } from "react-native";
export default function VaultScreen() {
  return (
    <View style={s.container}>
      <Text style={s.heading}>Document Vault</Text>
      <Text style={s.placeholder}>Week 3 — document list, upload FAB, and swipe-to-delete.</Text>
    </View>
  );
}
const s = StyleSheet.create({
  container:   { flex: 1, padding: 24, backgroundColor: "#fff" },
  heading:     { fontSize: 24, fontWeight: "700", marginTop: 48, marginBottom: 16 },
  placeholder: { color: "#999", fontSize: 14 },
});
