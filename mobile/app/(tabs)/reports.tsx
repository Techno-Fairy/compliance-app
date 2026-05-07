import { View, Text, StyleSheet } from "react-native";
export default function ReportsScreen() {
  return (
    <View style={s.container}>
      <Text style={s.heading}>Reports</Text>
      <Text style={s.placeholder}>Week 4 — month/year picker and PDF generation.</Text>
    </View>
  );
}
const s = StyleSheet.create({
  container:   { flex: 1, padding: 24, backgroundColor: "#fff" },
  heading:     { fontSize: 24, fontWeight: "700", marginTop: 48, marginBottom: 16 },
  placeholder: { color: "#999", fontSize: 14 },
});
