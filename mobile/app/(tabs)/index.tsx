import {
  View, Text, FlatList, StyleSheet,
  ActivityIndicator, Pressable,
} from "react-native";
import { router } from "expo-router";
import { useDeadlines } from "@/hooks/useDeadlines";
import { useHealthScore } from "@/hooks/useHealthScore";
import type { Deadline } from "@/types";

function DeadlineCard({ item }: { item: Deadline }) {
  const daysLeft = Math.ceil(
    (new Date(item.due_date).getTime() - Date.now()) / 86_400_000
  );
  const isOverdue = daysLeft < 0;

  return (
    <Pressable style={s.card} onPress={() => router.push(`/deadline/${item.id}` as any)}>
      <View style={s.row}>
        <Text style={s.category}>{item.category}</Text>
        <Text style={[s.status,
          item.status === "missed"   && s.statusMissed,
          item.status === "complete" && s.statusComplete,
        ]}>
          {item.status.toUpperCase()}
        </Text>
      </View>
      <Text style={s.cardTitle}>{item.name}</Text>
      <Text style={[s.daysLeft, isOverdue && s.overdue]}>
        {isOverdue
          ? `${Math.abs(daysLeft)} day${Math.abs(daysLeft) !== 1 ? "s" : ""} overdue`
          : `${daysLeft} day${daysLeft !== 1 ? "s" : ""} remaining`
        }
      </Text>
    </Pressable>
  );
}

export default function DashboardScreen() {
  const { data: deadlines, isLoading, isError } = useDeadlines();
  const { data: scoreData } = useHealthScore();

  if (isLoading) return <ActivityIndicator style={{ flex: 1 }} />;
  if (isError)   return (
    <View style={s.centered}>
      <Text style={s.errorText}>Could not load data. Pull down to retry.</Text>
    </View>
  );

  const overdue = deadlines?.filter((d) => d.status === "missed") ?? [];

  return (
    <View style={s.container}>
      <Text style={s.heading}>Dashboard</Text>

      {/* Health Score */}
      <View style={s.scoreCard}>
        <Text style={s.scoreLabel}>Compliance Health Score</Text>
        <Text style={s.scoreValue}>{scoreData?.score ?? "--"}%</Text>
      </View>

      {/* Overdue banner */}
      {overdue.length > 0 && (
        <View style={s.overdueBanner}>
          <Text style={s.overdueBannerText}>
            ⚠  {overdue.length} overdue item{overdue.length > 1 ? "s" : ""} — action required
          </Text>
        </View>
      )}

      <Text style={s.subheading}>Upcoming Deadlines</Text>

      {deadlines?.length === 0 ? (
        <View style={s.centered}>
          <Text style={s.emptyText}>No upcoming deadlines. You are all clear!</Text>
        </View>
      ) : (
        <FlatList
          data={deadlines}
          keyExtractor={(d) => String(d.id)}
          renderItem={({ item }) => <DeadlineCard item={item} />}
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
}

const s = StyleSheet.create({
  container:        { flex: 1, backgroundColor: "#fff", padding: 16 },
  heading:          { fontSize: 24, fontWeight: "700", marginTop: 48, marginBottom: 16 },
  subheading:       { fontSize: 18, fontWeight: "600", marginBottom: 12, marginTop: 8 },
  scoreCard:        { backgroundColor: "#111", borderRadius: 12, padding: 20, alignItems: "center", marginBottom: 16 },
  scoreLabel:       { color: "#aaa", fontSize: 13 },
  scoreValue:       { color: "#fff", fontSize: 48, fontWeight: "700" },
  overdueBanner:    { backgroundColor: "#1a0000", borderRadius: 8, padding: 12, marginBottom: 12 },
  overdueBannerText:{ color: "#ff4444", fontWeight: "600", fontSize: 13 },
  card:             { backgroundColor: "#f8f8f8", borderRadius: 10, padding: 16, marginBottom: 10 },
  row:              { flexDirection: "row", justifyContent: "space-between" },
  category:         { fontSize: 12, fontWeight: "600", color: "#555" },
  status:           { fontSize: 11, fontWeight: "700", color: "#555" },
  statusMissed:     { color: "#c00" },
  statusComplete:   { color: "#060" },
  cardTitle:        { fontSize: 16, fontWeight: "600", marginTop: 4, color: "#111" },
  daysLeft:         { fontSize: 13, color: "#777", marginTop: 4 },
  overdue:          { color: "#c00", fontWeight: "600" },
  centered:         { flex: 1, justifyContent: "center", alignItems: "center", marginTop: 60 },
  emptyText:        { color: "#999", fontSize: 15, textAlign: "center" },
  errorText:        { color: "#c00", fontSize: 15, textAlign: "center" },
});
