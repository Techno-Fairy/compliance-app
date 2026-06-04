// mobile/hooks/useTrendData.ts
// FE-20: 6-month compliance trend data for dashboard chart

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";

export interface TrendPoint {
  month: string;        // "Jan", "Feb", etc.
  month_iso: string;   // "2025-01"
  score: number;        // 0-100
  completed: number;
  total: number;
  overdue: number;
}

export interface TrendData {
  points: TrendPoint[];
  direction: "up" | "down" | "flat";
  change_pct: number;   // e.g. +5.2 or -3.0
}

export function useTrendData() {
  return useQuery<TrendData>({
    queryKey: ["compliance-trend"],
    queryFn: async () => {
      const { data } = await api.get<TrendData>("/analytics/trend");
      return data;
    },
    staleTime: 1000 * 60 * 10,
  });
}

// ── Static fallback for when API isn't ready ──────────────────────────────────
export function buildStaticTrend(currentScore: number): TrendData {
  const now = new Date();
  const points: TrendPoint[] = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
    const monthNames = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
    // Simulate a gently improving trend towards the current score
    const base = Math.max(40, currentScore - 20 + i * 4);
    const score = i === 5 ? currentScore : base + Math.round((Math.random() - 0.5) * 8);
    return {
      month:     monthNames[d.getMonth()],
      month_iso: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
      score:     Math.min(100, Math.max(0, score)),
      completed: Math.round(score / 10),
      total:     10,
      overdue:   Math.max(0, 10 - Math.round(score / 10)),
    };
  });

  const first = points[0].score;
  const last  = points[points.length - 1].score;
  const change_pct = parseFloat((last - first).toFixed(1));

  return {
    points,
    direction: change_pct > 0 ? "up" : change_pct < 0 ? "down" : "flat",
    change_pct,
  };
}